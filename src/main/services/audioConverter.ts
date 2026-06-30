import { spawn } from 'child_process';
import { BrowserWindow } from 'electron';
import { extname, basename, dirname } from 'path';
import { IPC_EVENTS } from '@shared/constants';
import type { ConversionJob, ProgressData } from '@shared/types';
import { ffmpegManager } from './ffmpegManager';
import { runFfmpeg, getAudioDuration } from './ffmpegRunner';
import { getFormatById } from '@shared/audioFormats';
import { resolveUniqueOutputPath } from '../utils/outputPath';
import { buildFfmpegArgs } from './codecArgs';

export class AudioConverter {
  private activeJobs = new Map<string, ReturnType<typeof spawn>>();

  async convert(
    job: ConversionJob,
    mainWindow: BrowserWindow,
    onProgress: (data: ProgressData) => void,
    onComplete: (jobId: string, success: boolean, error?: string) => void
  ): Promise<void> {
    // Ensure ffmpeg binary path is resolved before converting
    await ffmpegManager.resolveBinary();

    const format = getFormatById(job.options.format);
    if (!format) {
      onComplete(job.id, false, `Unknown format: ${job.options.format}`);
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

    try {
      // Avoid clobbering an existing file: append " (N)" if needed.
      const outFile = resolveUniqueOutputPath(outDir, baseName, ext);
      const args = buildFfmpegArgs(job.inputPath, outFile, job.options);
      console.log(`[OneTools] Converting: ${args.join(' ')}`);
      const res = await runFfmpeg(job.id, mainWindow, onProgress, args, (outTimeMs) => {
        return totalDuration ? (outTimeMs / (totalDuration * 1000)) * 100 : 0;
      });

      if (res.success) {
        onComplete(job.id, true);
        mainWindow.webContents.send(IPC_EVENTS.CONVERSION_COMPLETE, { jobId: job.id });
      } else {
        if (res.error) console.error(`[OneTools] ${res.error}`);
        onComplete(job.id, false, res.error);
        mainWindow.webContents.send(IPC_EVENTS.CONVERSION_ERROR, { jobId: job.id, error: res.error });
      }
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : 'Failed to start conversion';
      console.error(`[OneTools] Conversion error: ${errorMsg}`);
      onComplete(job.id, false, errorMsg);
      mainWindow.webContents.send(IPC_EVENTS.CONVERSION_ERROR, {
        jobId: job.id,
        error: errorMsg,
      });
    }
  }

  cancel(jobId: string): boolean {
    const proc = this.activeJobs.get(jobId);
    if (proc) {
      proc.kill('SIGTERM');
      this.activeJobs.delete(jobId);
      return true;
    }
    return false;
  }
}

export const audioConverter = new AudioConverter();
