import { BrowserWindow } from 'electron';
import { readFile, writeFile } from 'fs/promises';
import { basename, dirname, extname } from 'path';
import { IPC_EVENTS } from '@shared/constants';
import { formatAppError, isAppError, type AppError } from '@shared/i18n';
import type {
  MarkdownPdfJob,
  PdfMargin,
  PdfPageSize,
  ProgressData,
} from '@shared/types';
import { renderMarkdownDocument } from '../utils/markdownRender';
import { resolveUniqueOutputPath } from '../utils/outputPath';
import { removeQuietly } from '../utils/files';

/**
 * Markdown → PDF tool. Renders a Markdown file to a themed PDF using the main
 * process's Chromium (`webContents.printToPDF`) — no external binary required.
 * Sibling to AudioConverter/AudioSplitter: independent IPC, own service, own
 * events. Shared infra is limited to `resolveUniqueOutputPath` (output-conflict
 * avoidance) and the common `ProgressData`/`ConversionResult` event shapes.
 */
export class MarkdownPdfConverter {
  /** Active hidden render windows keyed by job id, so cancel can destroy them. */
  private activeWindows = new Map<string, BrowserWindow>();
  /** Job ids cancelled by the user; suppresses the spurious error a cancel raises. */
  private cancelledJobs = new Set<string>();
  /** Job ids currently inside convert(), so cancel is recorded before a window exists. */
  private inFlight = new Set<string>();

  async convert(
    job: MarkdownPdfJob,
    mainWindow: BrowserWindow,
    onProgress: (data: ProgressData) => void
  ): Promise<void> {
    // Register in-flight up front so cancel() is honoured while the file is
    // still being read/rendered, before any hidden window exists.
    this.inFlight.add(job.id);
    try {
      await this.runConvert(job, mainWindow, onProgress);
    } finally {
      this.inFlight.delete(job.id);
      this.activeWindows.delete(job.id);
      // Never leave a cancel intent behind: a retry reuses the job id, and a
      // stale entry would swallow that run's real error.
      this.cancelledJobs.delete(job.id);
    }
  }

  private async runConvert(
    job: MarkdownPdfJob,
    mainWindow: BrowserWindow,
    onProgress: (data: ProgressData) => void
  ): Promise<void> {
    const sendProgress = (progress: number) => {
      const data: ProgressData = { jobId: job.id, progress };
      onProgress(data);
      mainWindow.webContents.send(IPC_EVENTS.MD_PDF_PROGRESS, data);
    };

    try {
      sendProgress(5);

      // 1. Read + render Markdown to a themed HTML document.
      let markdown: string;
      try {
        markdown = await readFile(job.inputPath, 'utf-8');
      } catch (err) {
        const appError: AppError = {
          key: 'errors.fileReadFailed',
          detail: err instanceof Error ? err.message : String(err),
        };
        throw appError;
      }
      sendProgress(20);

      const html = renderMarkdownDocument(markdown, job.options.theme);
      sendProgress(35);

      // 2. Resolve a non-colliding output path next to the input (or in outputDir).
      const outDir = job.options.outputDir || dirname(job.inputPath);
      const baseName = basename(job.inputPath, extname(job.inputPath));
      const outputPath = resolveUniqueOutputPath(outDir, baseName, 'pdf');

      // 3. Load the HTML into a hidden Chromium window and print to PDF.
      const win = new BrowserWindow({
        show: false,
        webPreferences: { sandbox: true, contextIsolation: true },
      });
      this.activeWindows.set(job.id, win);

      // Cancelled while reading/rendering — before the window existed. Honour
      // it now rather than printing a PDF the user already asked not to make.
      if (this.cancelledJobs.has(job.id)) {
        this.destroyWindow(job.id);
        return;
      }

      const dataUrl = 'data:text/html;base64,' + Buffer.from(html, 'utf-8').toString('base64');

      await new Promise<void>((resolve, reject) => {
        win.webContents.once('did-finish-load', () => resolve());
        win.webContents.once(
          'did-fail-load',
          (_event, code, description) => {
            const appError: AppError = {
              key: 'errors.printLoadFailed',
              params: { code },
              detail: description,
            };
            reject(appError);
          }
        );
        // A cancel destroys the window, which never settles did-finish-load —
        // without this the job would hang forever.
        win.once('closed', () =>
          reject({ key: 'errors.operationFailed', detail: 'Render window closed' } satisfies AppError)
        );
        win.loadURL(dataUrl).catch(reject);
      });

      if (win.isDestroyed()) {
        // Cancelled while loading.
        return;
      }

      sendProgress(60);

      const pdf = await win.webContents.printToPDF(
        this.buildPrintOptions(job.options.pageSize, job.options.orientation, job.options.margin)
      );

      sendProgress(85);

      if (win.isDestroyed()) {
        return;
      }

      await writeFile(outputPath, pdf);

      if (this.cancelledJobs.has(job.id)) {
        // Cancelled while writing: drop the PDF instead of leaving an output
        // the user asked not to produce.
        removeQuietly(outputPath);
        return;
      }

      // Cleanup the render window.
      this.destroyWindow(job.id);

      sendProgress(100);
      mainWindow.webContents.send(IPC_EVENTS.MD_PDF_COMPLETE, {
        jobId: job.id,
        success: true,
        outputPath,
      });
    } catch (err) {
      this.destroyWindow(job.id);
      // If the user cancelled (which destroys the render window and rejects
      // printToPDF), don't surface it as an error — the renderer already marks
      // the job cancelled.
      if (this.cancelledJobs.has(job.id)) {
        this.cancelledJobs.delete(job.id);
        return;
      }
      const appError: AppError = isAppError(err)
        ? err
        : {
            key: 'errors.operationFailed',
            detail: err instanceof Error ? err.message : String(err),
          };
      console.error(`[OneTools] Markdown→PDF error: ${formatAppError('en', appError)}`);
      mainWindow.webContents.send(IPC_EVENTS.MD_PDF_ERROR, {
        jobId: job.id,
        success: false,
        error: appError,
      });
    }
  }

  cancel(jobId: string): boolean {
    if (!this.inFlight.has(jobId)) return false;
    // Record intent even when no render window exists yet — runConvert checks
    // it right after the window is created and after the PDF is written.
    this.cancelledJobs.add(jobId);
    this.destroyWindow(jobId);
    return true;
  }

  private destroyWindow(jobId: string): void {
    const win = this.activeWindows.get(jobId);
    if (win && !win.isDestroyed()) {
      win.destroy();
    }
    this.activeWindows.delete(jobId);
  }

  /** Map user-facing options to the `webContents.printToPDF` option shape. */
  private buildPrintOptions(
    pageSize: PdfPageSize,
    orientation: 'portrait' | 'landscape',
    margin: PdfMargin
  ): Electron.PrintToPDFOptions {
    const marginsByType: Record<PdfMargin, Electron.PrintToPDFOptions['margins']> = {
      normal: { marginType: 'default' },
      narrow: { marginType: 'custom', top: 0.5, bottom: 0.5, left: 0.5, right: 0.5 },
      none: { marginType: 'none' },
    };
    return {
      pageSize,
      landscape: orientation === 'landscape',
      printBackground: true,
      margins: marginsByType[margin],
    };
  }
}

export const markdownPdfConverter = new MarkdownPdfConverter();
