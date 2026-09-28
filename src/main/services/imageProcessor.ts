import { spawn, type ChildProcess } from 'child_process';
import { BrowserWindow, app } from 'electron';
import { existsSync, statSync, unlinkSync, writeFileSync } from 'fs';
import { basename, dirname, extname, join } from 'path';
import { IPC_EVENTS } from '@shared/constants';
import { formatAppError, isAppError, type AppError } from '@shared/i18n';
import { resolveImageFormat } from '@shared/imageFormats';
import type { ImageJob, ImageResult, ProgressData } from '@shared/types';
import { ffmpegManager } from './ffmpegManager';
import { runFfmpeg } from './ffmpegRunner';
import { buildImageArgs, type ImageArgsContext } from '../utils/imageArgs';
import { resolveFontFile } from '../utils/fonts';
import { removeQuietly } from '../utils/files';
import { resolveUniqueOutputPath } from '../utils/outputPath';

/**
 * Image processing tool: shrink (resize + quality) and stamp a watermark in a
 * single ffmpeg run. Sibling to AudioConverter/MarkdownPdf — independent IPC,
 * own service, own events. Shares `runFfmpeg`, `resolveUniqueOutputPath` and
 * the common `ProgressData`/`ConversionResult` event shapes.
 *
 * Two details worth knowing:
 * - Watermark text never goes through the filtergraph parser: it is written to
 *   a temp file and passed as `textfile=`, so user text needs no escaping.
 * - Image jobs are effectively instantaneous, so progress is reported as a
 *   flat 100% while the job runs and the real signal is the completion event.
 */
export class ImageProcessor {
  private activeJobs = new Map<string, ChildProcess>();
  /** Jobs the user cancelled; suppresses the spurious error a kill raises. */
  private cancelledJobs = new Set<string>();
  /** Job ids currently inside process(), even before ffmpeg has spawned. */
  private inFlight = new Set<string>();

  async process(
    job: ImageJob,
    mainWindow: BrowserWindow,
    onProgress: (data: ProgressData) => void
  ): Promise<void> {
    await ffmpegManager.resolveBinary();

    // Register in-flight from the first await so cancel() is honoured even
    // while the logo-width probe runs, before ffmpeg has spawned.
    this.inFlight.add(job.id);
    try {
      await this.runProcess(job, mainWindow, onProgress);
    } finally {
      this.inFlight.delete(job.id);
      this.activeJobs.delete(job.id);
    }
  }

  private async runProcess(
    job: ImageJob,
    mainWindow: BrowserWindow,
    onProgress: (data: ProgressData) => void
  ): Promise<void> {
    const outDir = job.options.outputDir || dirname(job.inputPath);
    const ext = resolveImageFormat(job.inputPath, job.options.format);
    const baseName = basename(job.inputPath, extname(job.inputPath));
    const outputPath = resolveUniqueOutputPath(outDir, baseName, ext);

    let textFile: string | undefined;

    try {
      const watermark = job.options.watermark;
      const ctx: ImageArgsContext = {};

      if (watermark.mode === 'text' && watermark.text.trim()) {
        const fontFile = resolveFontFile();
        if (!fontFile) {
          const missingFont: AppError = { key: 'errors.fontNotFound' };
          throw missingFont;
        }
        // macOS temp paths contain no filtergraph-special characters (',;:[]\#),
        // which is what lets the text bypass escaping entirely.
        textFile = join(app.getPath('temp'), `onetools-wm-${job.id}.txt`);
        writeFileSync(textFile, watermark.text, 'utf8');
        ctx.fontFile = fontFile;
        ctx.textFile = textFile;
      } else if (watermark.mode === 'image') {
        if (!watermark.imagePath || !existsSync(watermark.imagePath)) {
          const missingLogo: AppError = { key: 'errors.watermarkImageMissing' };
          throw missingLogo;
        }
        ctx.logoPath = watermark.imagePath;
        // Size the logo against the *input* image so the watermark keeps a
        // constant relative size across a batch of differently sized photos.
        const inputWidth = await getImageWidth(job.inputPath);
        if (inputWidth) {
          ctx.logoWidth = Math.max(8, Math.round(inputWidth * watermark.scale));
        }
      }

      const args = buildImageArgs(job.inputPath, outputPath, job.options, ctx);
      const res = await runFfmpeg(
        job.id,
        mainWindow,
        onProgress,
        args,
        () => 100,
        IPC_EVENTS.IMAGE_PROGRESS,
        (proc) => {
          this.activeJobs.set(job.id, proc);
          // Cancel arrived before spawn: honour it immediately.
          if (this.cancelledJobs.has(job.id)) proc.kill('SIGTERM');
        }
      );

      if (res.success) {
        const result: ImageResult = {
          jobId: job.id,
          success: true,
          outputPath,
          inputSize: sizeOf(job.inputPath),
          outputSize: sizeOf(outputPath),
        };
        mainWindow.webContents.send(IPC_EVENTS.IMAGE_COMPLETE, result);
      } else {
        if (this.cancelledJobs.delete(job.id)) {
          removeQuietly(outputPath);
          return;
        }
        if (res.error) console.error(`[OneTools] Image error: ${formatAppError('en', res.error)}`);
        mainWindow.webContents.send(IPC_EVENTS.IMAGE_ERROR, {
          jobId: job.id,
          success: false,
          error: res.error,
        });
      }
    } catch (err) {
      if (this.cancelledJobs.delete(job.id)) {
        removeQuietly(outputPath);
        return;
      }
      const appError: AppError = isAppError(err)
        ? err
        : {
            key: 'errors.operationFailed',
            detail: err instanceof Error ? err.message : String(err),
          };
      console.error(`[OneTools] Image processing error: ${formatAppError('en', appError)}`);
      mainWindow.webContents.send(IPC_EVENTS.IMAGE_ERROR, {
        jobId: job.id,
        success: false,
        error: appError,
      });
    } finally {
      this.activeJobs.delete(job.id);
      if (textFile) {
        try {
          unlinkSync(textFile);
        } catch {
          /* temp cleanup is best-effort */
        }
      }
    }
  }

  cancel(jobId: string): boolean {
    if (!this.inFlight.has(jobId)) return false;
    // Record intent even if ffmpeg has not spawned yet; runProcess checks this.
    this.cancelledJobs.add(jobId);
    const proc = this.activeJobs.get(jobId);
    if (proc) {
      proc.kill('SIGTERM');
      this.activeJobs.delete(jobId);
    }
    return true;
  }
}

function sizeOf(filePath: string): number | undefined {
  try {
    return statSync(filePath).size;
  } catch {
    return undefined;
  }
}

/**
 * Width of an image in px, via ffprobe (bundled next to ffmpeg) with a
 * fallback to parsing the dimensions ffmpeg prints for the input stream.
 * Only used to size logo watermarks — a failure just means the logo is scaled
 * relative to itself instead.
 */
async function getImageWidth(filePath: string): Promise<number | undefined> {
  const ffmpegPath = ffmpegManager.getPath();
  if (!ffmpegPath) return undefined;

  const ffprobePath =
    ffmpegPath === 'ffmpeg' ? 'ffprobe' : join(dirname(ffmpegPath), 'ffprobe');
  const probed = await collectOutput(ffprobePath, [
    '-v',
    'error',
    '-select_streams',
    'v:0',
    '-show_entries',
    'stream=width',
    '-of',
    'csv=p=0',
    filePath,
  ]);
  const probedWidth = parseInt(probed.trim(), 10);
  if (!isNaN(probedWidth) && probedWidth > 0) return probedWidth;

  const stderr = await collectOutput(ffmpegPath, ['-i', filePath, '-f', 'null', '-'], true);
  const match = stderr.match(/Video:.*?(\d{2,5})x(\d{2,5})/);
  return match ? parseInt(match[1], 10) : undefined;
}

/** Run a binary and resolve with its stdout (or stderr) — '' on any failure. */
function collectOutput(
  command: string,
  args: string[],
  useStderr = false
): Promise<string> {
  return new Promise((resolve) => {
    let output = '';
    let settled = false;
    const done = () => {
      if (!settled) {
        settled = true;
        resolve(output);
      }
    };

    let proc: ChildProcess;
    try {
      proc = spawn(command, args);
    } catch {
      resolve('');
      return;
    }

    proc.stdout?.on('data', (chunk: Buffer) => (output += chunk.toString()));
    proc.stderr?.on('data', (chunk: Buffer) => {
      if (useStderr) output += chunk.toString();
    });
    proc.on('error', () => resolve(''));
    proc.on('close', done);
  });
}

export const imageProcessor = new ImageProcessor();
