import { BrowserWindow } from 'electron';
import { readFile, writeFile } from 'fs/promises';
import { basename, dirname, extname } from 'path';
import { IPC_EVENTS } from '@shared/constants';
import type {
  MarkdownPdfJob,
  PdfMargin,
  PdfPageSize,
  ProgressData,
} from '@shared/types';
import { renderMarkdownDocument } from '../utils/markdownRender';
import { resolveUniqueOutputPath } from '../utils/outputPath';

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

  async convert(
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
        throw new Error(
          `Could not read file: ${err instanceof Error ? err.message : String(err)}`
        );
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

      const dataUrl = 'data:text/html;base64,' + Buffer.from(html, 'utf-8').toString('base64');

      await new Promise<void>((resolve, reject) => {
        win.webContents.once('did-finish-load', () => resolve());
        win.webContents.once(
          'did-fail-load',
          (_event, code, description) => {
            reject(
              new Error(`Failed to load document for printing (${code}): ${description}`)
            );
          }
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
      const errorMsg = err instanceof Error ? err.message : 'Failed to convert Markdown to PDF';
      console.error(`[OneTools] Markdown→PDF error: ${errorMsg}`);
      mainWindow.webContents.send(IPC_EVENTS.MD_PDF_ERROR, {
        jobId: job.id,
        success: false,
        error: errorMsg,
      });
    }
  }

  cancel(jobId: string): boolean {
    const win = this.activeWindows.get(jobId);
    if (win) {
      this.cancelledJobs.add(jobId);
      this.destroyWindow(jobId);
      return true;
    }
    return false;
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
