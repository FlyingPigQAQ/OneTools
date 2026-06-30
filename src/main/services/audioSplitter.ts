import { spawn } from 'child_process';
import { BrowserWindow } from 'electron';
import { join, extname, basename, dirname } from 'path';
import { readdirSync, unlinkSync } from 'fs';
import { IPC_EVENTS } from '@shared/constants';
import type { SplitJob, ProgressData } from '@shared/types';
import { ffmpegManager } from './ffmpegManager';
import { runFfmpeg, getAudioDuration, getBytesPerSec } from './ffmpegRunner';
import {
  sizeToSegmentDuration,
  expectedSegmentCount,
  buildSegmentArgs,
  partFileName,
} from './splitArgs';

/**
 * Audio splitting tool. Cuts one audio file into multiple parts by a target
 * size (MB) or duration (seconds), preserving the original format (stream
 * copy, no re-encode). Sibling to AudioConverter — they share ffmpegRunner
 * but are otherwise independent.
 */
export class AudioSplitter {
  private activeJobs = new Map<string, ReturnType<typeof spawn>>();

  async split(
    job: SplitJob,
    mainWindow: BrowserWindow,
    onProgress: (data: ProgressData) => void,
    onComplete: (jobId: string, success: boolean, error?: string) => void
  ): Promise<void> {
    await ffmpegManager.resolveBinary();

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
        const msg = 'Could not determine segment duration (need the audio duration).';
        onComplete(job.id, false, msg);
        mainWindow.webContents.send(IPC_EVENTS.SPLIT_ERROR, { jobId: job.id, error: msg });
        return;
      }
    }

    if (!segDur || segDur <= 0 || !totalDuration || totalDuration <= 0) {
      const msg = 'Invalid segment duration or audio duration.';
      onComplete(job.id, false, msg);
      mainWindow.webContents.send(IPC_EVENTS.SPLIT_ERROR, { jobId: job.id, error: msg });
      return;
    }

    const expected = expectedSegmentCount(totalDuration, segDur);
    this.cleanStaleSegments(outDir, baseName, ext);

    try {
      let allOk = true;
      let lastError: string | undefined;

      for (let i = 0; i < expected; i++) {
        const start = i * segDur;
        const outFile = join(outDir, partFileName(baseName, i, ext));
        const segArgs = buildSegmentArgs(job.inputPath, outFile, start, segDur);
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
          IPC_EVENTS.SPLIT_PROGRESS
        );

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
        if (lastError) console.error(`[OneTools] ${lastError}`);
        onComplete(job.id, false, lastError);
        mainWindow.webContents.send(IPC_EVENTS.SPLIT_ERROR, { jobId: job.id, error: lastError });
      }
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : 'Failed to split audio';
      console.error(`[OneTools] Split error: ${errorMsg}`);
      onComplete(job.id, false, errorMsg);
      mainWindow.webContents.send(IPC_EVENTS.SPLIT_ERROR, {
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
