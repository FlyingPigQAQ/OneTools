import { spawn } from 'child_process';
import { BrowserWindow } from 'electron';
import { join, extname, basename, dirname } from 'path';
import { readdirSync, unlinkSync } from 'fs';
import { IPC_EVENTS } from '@shared/constants';
import { formatAppError, type AppError } from '@shared/i18n';
import type { SplitJob, ProgressData } from '@shared/types';
import { ffmpegManager } from './ffmpegManager';
import { runFfmpeg, getAudioDuration, getBytesPerSec } from './ffmpegRunner';
import {
  sizeToSegmentDuration,
  expectedSegmentCount,
  buildSegmentArgs,
  partFileName,
} from './splitArgs';
import { removeQuietly } from '../utils/files';

/**
 * Audio splitting tool. Cuts one audio file into multiple parts by a target
 * size (MB) or duration (seconds), preserving the original format (stream
 * copy, no re-encode). Sibling to AudioConverter — they share ffmpegRunner
 * but are otherwise independent.
 */
export class AudioSplitter {
  private activeJobs = new Map<string, ReturnType<typeof spawn>>();
  /** Job ids the user cancelled — used to suppress the error a kill raises. */
  private cancelledJobs = new Set<string>();
  /** Job ids currently inside split(), even before ffmpeg has spawned. */
  private inFlight = new Set<string>();

  async split(
    job: SplitJob,
    mainWindow: BrowserWindow,
    onProgress: (data: ProgressData) => void,
    onComplete: (jobId: string, success: boolean, error?: AppError) => void
  ): Promise<void> {
    await ffmpegManager.resolveBinary();

    // Register in-flight from the first await so cancel() is honoured even
    // while the duration/byte-rate probes run, before ffmpeg has spawned.
    this.inFlight.add(job.id);
    try {
      await this.runSplit(job, mainWindow, onProgress, onComplete);
    } finally {
      this.inFlight.delete(job.id);
      this.activeJobs.delete(job.id);
    }
  }

  private async runSplit(
    job: SplitJob,
    mainWindow: BrowserWindow,
    onProgress: (data: ProgressData) => void,
    onComplete: (jobId: string, success: boolean, error?: AppError) => void
  ): Promise<void> {
    const ext = extname(job.inputPath).slice(1) || 'mp3';
    const baseName = basename(job.inputPath, extname(job.inputPath));
    const outDir = job.options.outputDir || dirname(job.inputPath);

    let totalDuration = job.duration;
    if (!totalDuration) {
      totalDuration = await getAudioDuration(job.inputPath);
    }

    // Convert the user's target into a per-segment duration in seconds.
    let segDur: number;
    if (job.options.mode === 'duration') {
      segDur = job.options.durationSec || 0;
    } else {
      // Stream-copy splitting can only cut on keyframe/packet boundaries, so the
      // actual segment overshoots the requested end time. The safety margin (applied
      // inside sizeToSegmentDuration) keeps output files at or under the requested size.
      const bytesPerSec = await getBytesPerSec(job.inputPath, totalDuration);
      segDur = sizeToSegmentDuration(job.options.sizeMB || 0, bytesPerSec);
      if (!segDur) {
        const appError: AppError = {
          key: 'errors.operationFailed',
          detail: 'Could not determine segment duration (need the audio duration).',
        };
        onComplete(job.id, false, appError);
        mainWindow.webContents.send(IPC_EVENTS.SPLIT_ERROR, { jobId: job.id, error: appError });
        return;
      }
    }

    if (!segDur || segDur <= 0 || !totalDuration || totalDuration <= 0) {
      const appError: AppError = {
        key: 'errors.operationFailed',
        detail: 'Invalid segment duration or audio duration.',
      };
      onComplete(job.id, false, appError);
      mainWindow.webContents.send(IPC_EVENTS.SPLIT_ERROR, { jobId: job.id, error: appError });
      return;
    }

    const expected = expectedSegmentCount(totalDuration, segDur);
    this.cleanStaleSegments(outDir, baseName, ext);

    let currentOut: string | undefined;
    try {
      let allOk = true;
      let lastError: AppError | undefined;

      for (let i = 0; i < expected; i++) {
        const start = i * segDur;
        currentOut = join(outDir, partFileName(baseName, i, ext));
        const segArgs = buildSegmentArgs(job.inputPath, currentOut, start, segDur);
        console.log(`[OneTools] Split segment ${i + 1}/${expected}: ${segArgs.join(' ')}`);

        const segIndex = i;
        const totalDur = totalDuration;
        const res = await runFfmpeg(
          job.id,
          mainWindow,
          onProgress,
          segArgs,
          (outTimeMs) => {
            const segPos = Math.min(outTimeMs / 1000, segDur);
            return ((segIndex * segDur + segPos) / totalDur) * 100;
          },
          IPC_EVENTS.SPLIT_PROGRESS,
          (proc) => {
            this.activeJobs.set(job.id, proc);
            // Cancel arrived before spawn: honour it immediately.
            if (this.cancelledJobs.has(job.id)) proc.kill('SIGTERM');
          }
        );

        if (this.cancelledJobs.delete(job.id)) {
          // Cancelled: drop the half-written segment. Segments finished in
          // earlier iterations are complete files and stay.
          removeQuietly(currentOut);
          return;
        }

        if (!res.success) {
          allOk = false;
          lastError = res.error;
          break;
        }
      }

      if (allOk) {
        onComplete(job.id, true);
        mainWindow.webContents.send(IPC_EVENTS.SPLIT_COMPLETE, { jobId: job.id });
      } else {
        if (lastError) console.error(`[OneTools] ${formatAppError('en', lastError)}`);
        onComplete(job.id, false, lastError);
        mainWindow.webContents.send(IPC_EVENTS.SPLIT_ERROR, { jobId: job.id, error: lastError });
      }
    } catch (err) {
      if (this.cancelledJobs.delete(job.id)) {
        removeQuietly(currentOut);
        return;
      }
      const appError: AppError =
        err instanceof Error
          ? { key: 'errors.operationFailed', detail: err.message }
          : { key: 'errors.operationFailed' };
      console.error(`[OneTools] Split error: ${formatAppError('en', appError)}`);
      onComplete(job.id, false, appError);
      mainWindow.webContents.send(IPC_EVENTS.SPLIT_ERROR, {
        jobId: job.id,
        error: appError,
      });
    }
  }

  cancel(jobId: string): boolean {
    if (!this.inFlight.has(jobId)) return false;
    // Record intent even if ffmpeg has not spawned yet; runSplit checks this.
    this.cancelledJobs.add(jobId);
    const proc = this.activeJobs.get(jobId);
    if (proc) {
      proc.kill('SIGTERM');
      this.activeJobs.delete(jobId);
    }
    return true;
  }

  /** Remove leftover `${baseName}_partNNN.${ext}` files from a previous split. */
  private cleanStaleSegments(dir: string, baseName: string, ext: string): void {
    try {
      const prefix = `${baseName}_part`;
      const suffix = `.${ext}`;
      for (const f of readdirSync(dir)) {
        if (f.startsWith(prefix) && f.endsWith(suffix)) {
          try {
            unlinkSync(join(dir, f));
          } catch {
            /* ignore */
          }
        }
      }
    } catch {
      /* directory not readable; nothing to clean */
    }
  }
}

export const audioSplitter = new AudioSplitter();
