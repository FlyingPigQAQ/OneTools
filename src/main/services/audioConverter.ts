import { spawn } from 'child_process';
import { BrowserWindow } from 'electron';
import { extname, basename, dirname } from 'path';
import { IPC_EVENTS } from '@shared/constants';
import { formatAppError, type AppError } from '@shared/i18n';
import type { ConversionJob, ProgressData } from '@shared/types';
import { ffmpegManager } from './ffmpegManager';
import { runFfmpeg, getAudioDuration } from './ffmpegRunner';
import { getFormatById } from '@shared/audioFormats';
import { resolveUniqueOutputPath } from '../utils/outputPath';
import { removeQuietly } from '../utils/files';
import { buildFfmpegArgs } from './codecArgs';

export class AudioConverter {
  private activeJobs = new Map<string, ReturnType<typeof spawn>>();
  /** Job ids the user cancelled — used to suppress the error a kill raises. */
  private cancelledJobs = new Set<string>();
  /** Job ids currently inside convert(), even before ffmpeg has spawned. */
  private inFlight = new Set<string>();

  async convert(
    job: ConversionJob,
    mainWindow: BrowserWindow,
    onProgress: (data: ProgressData) => void,
    onComplete: (jobId: string, success: boolean, error?: AppError) => void
  ): Promise<void> {
    // Ensure ffmpeg binary path is resolved before converting
    await ffmpegManager.resolveBinary();

    // Register in-flight from the first await so cancel() is honoured even
    // while the duration probe runs, before ffmpeg has spawned.
    this.inFlight.add(job.id);
    try {
      await this.runConvert(job, mainWindow, onProgress, onComplete);
    } finally {
      this.inFlight.delete(job.id);
      this.activeJobs.delete(job.id);
    }
  }

  private async runConvert(
    job: ConversionJob,
    mainWindow: BrowserWindow,
    onProgress: (data: ProgressData) => void,
    onComplete: (jobId: string, success: boolean, error?: AppError) => void
  ): Promise<void> {
    const format = getFormatById(job.options.format);
    if (!format) {
      onComplete(job.id, false, {
        key: 'errors.operationFailed',
        detail: `Unknown format: ${job.options.format}`,
      });
      return;
    }

    const ext = format.extension;
    const baseName = basename(job.inputPath, extname(job.inputPath));
    const outDir = job.options.outputDir || dirname(job.inputPath);

    // We need the total duration up front to drive progress.
    let totalDuration = job.duration;
    if (!totalDuration) {
      totalDuration = await getAudioDuration(job.inputPath);
    }

    let outFile: string | undefined;
    try {
      // Avoid clobbering an existing file: append " (N)" if needed.
      outFile = resolveUniqueOutputPath(outDir, baseName, ext);
      const args = buildFfmpegArgs(job.inputPath, outFile, job.options);
      console.log(`[OneTools] Converting: ${args.join(' ')}`);
      const res = await runFfmpeg(
        job.id,
        mainWindow,
        onProgress,
        args,
        (outTimeMs) => {
          return totalDuration ? (outTimeMs / (totalDuration * 1000)) * 100 : 0;
        },
        IPC_EVENTS.CONVERSION_PROGRESS,
        (proc) => {
          this.activeJobs.set(job.id, proc);
          // Cancel arrived before spawn: honour it immediately.
          if (this.cancelledJobs.has(job.id)) proc.kill('SIGTERM');
        }
      );

      if (this.cancelledJobs.delete(job.id)) {
        // Cancelled: the truncated output is unusable.
        removeQuietly(outFile);
        return;
      }

      if (res.success) {
        onComplete(job.id, true);
        mainWindow.webContents.send(IPC_EVENTS.CONVERSION_COMPLETE, { jobId: job.id });
      } else {
        if (res.error) console.error(`[OneTools] ${formatAppError('en', res.error)}`);
        onComplete(job.id, false, res.error);
        mainWindow.webContents.send(IPC_EVENTS.CONVERSION_ERROR, { jobId: job.id, error: res.error });
      }
    } catch (err) {
      if (this.cancelledJobs.delete(job.id)) {
        removeQuietly(outFile);
        return;
      }
      const appError: AppError =
        err instanceof Error
          ? { key: 'errors.operationFailed', detail: err.message }
          : { key: 'errors.operationFailed' };
      console.error(`[OneTools] Conversion error: ${formatAppError('en', appError)}`);
      onComplete(job.id, false, appError);
      mainWindow.webContents.send(IPC_EVENTS.CONVERSION_ERROR, {
        jobId: job.id,
        error: appError,
      });
    }
  }

  cancel(jobId: string): boolean {
    if (!this.inFlight.has(jobId)) return false;
    // Record intent even if ffmpeg has not spawned yet; convert() checks this.
    this.cancelledJobs.add(jobId);
    const proc = this.activeJobs.get(jobId);
    if (proc) {
      proc.kill('SIGTERM');
      this.activeJobs.delete(jobId);
    }
    return true;
  }
}

export const audioConverter = new AudioConverter();
