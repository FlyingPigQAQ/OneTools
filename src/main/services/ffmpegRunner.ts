import { spawn } from 'child_process';
import { join } from 'path';
import { BrowserWindow } from 'electron';
import { statSync } from 'fs';
import { IPC_EVENTS } from '@shared/constants';
import type { ProgressData } from '@shared/types';
import { ffmpegManager } from './ffmpegManager';

/**
 * Spawn ffmpeg once and resolve when it exits. `computePercent` maps the
 * current output time (ms) to an overall 0–100 progress value, so callers
 * can scale per-segment or single-file progress into whole-job progress.
 * `progressEvent` selects which IPC event progress is sent on, so the
 * converter and splitter tools can have independent progress channels.
 */
export function runFfmpeg(
  jobId: string,
  mainWindow: BrowserWindow,
  onProgress: (data: ProgressData) => void,
  args: string[],
  computePercent: (outTimeMs: number) => number,
  progressEvent: string = IPC_EVENTS.CONVERSION_PROGRESS
): Promise<{ success: boolean; error?: string }> {
  return new Promise((resolve) => {
    const proc = ffmpegManager.spawn(args);

    let outputBuffer = '';
    let currentOutTimeMs = 0;
    let currentSpeed = '';
    let stderrBuffer = '';
    let lastProgressTime = 0;
    let settled = false;

    proc.stdout?.on('data', (data: Buffer) => {
      outputBuffer += data.toString();
      const lines = outputBuffer.split('\n');
      outputBuffer = lines.pop() || '';

      let shouldReport = false;
      for (const line of lines) {
        const trimmed = line.trim();
        if (trimmed.startsWith('out_time_ms=')) {
          // FFmpeg's out_time_ms is actually microseconds; convert to ms.
          currentOutTimeMs = parseInt(trimmed.split('=')[1], 10) / 1000;
          shouldReport = true;
        } else if (trimmed.startsWith('speed=')) {
          currentSpeed = trimmed.split('=')[1];
        } else if (trimmed === 'progress=end') {
          shouldReport = true;
        }
      }

      if (shouldReport) {
        const now = Date.now();
        if (now - lastProgressTime > 200) { // throttle to ~5fps
          lastProgressTime = now;
          const percent = Math.min(100, Math.max(0, Math.round(computePercent(currentOutTimeMs))));
          const progressData: ProgressData = {
            jobId,
            progress: percent,
            speed: currentSpeed || undefined,
          };
          onProgress(progressData);
          mainWindow.webContents.send(progressEvent, progressData);
        }
      }
    });

    proc.stderr?.on('data', (data: Buffer) => {
      stderrBuffer += data.toString();
    });

    proc.on('close', (code) => {
      if (settled) return;
      settled = true;
      if (code === 0) {
        resolve({ success: true });
      } else {
        const tail = stderrBuffer.trim().split('\n').slice(-5).join('\n');
        resolve({
          success: false,
          error: `FFmpeg exited with code ${code}${tail ? ':\n' + tail : ''}`,
        });
      }
    });

    proc.on('error', (error) => {
      if (settled) return;
      settled = true;
      resolve({ success: false, error: error.message });
    });
  });
}

/**
 * Get the duration of an audio file in seconds. Tries ffprobe first; falls
 * back to parsing `ffmpeg -i ... -f null -` stderr when ffprobe is absent.
 */
export async function getAudioDuration(filePath: string): Promise<number | undefined> {
  return new Promise((resolve) => {
    const ffmpegPath = ffmpegManager.getPath();
    if (!ffmpegPath) {
      resolve(undefined);
      return;
    }

    const ffprobeBinary = ffmpegPath === 'ffmpeg' ? 'ffprobe' : join(ffmpegPath.replace(/ffmpeg$/, ''), 'ffprobe');
    const probe = spawn(ffprobeBinary, [
      '-v', 'error',
      '-show_entries', 'format=duration',
      '-of', 'default=noprint_wrappers=1:nokey=1',
      filePath,
    ]);

    let output = '';
    let probeError = false;

    probe.stdout.on('data', (data) => { output += data.toString(); });
    probe.on('error', () => { probeError = true; });
    probe.on('close', (code) => {
      if (!probeError && code === 0) {
        const duration = parseFloat(output.trim());
        if (!isNaN(duration)) {
          resolve(duration);
          return;
        }
      }

      // Fallback: use ffmpeg itself to get duration from stderr
      const fallback = spawn(ffmpegPath, ['-i', filePath, '-f', 'null', '-']);
      let errOutput = '';
      fallback.stderr.on('data', (data) => { errOutput += data.toString(); });
      fallback.on('close', () => {
        const match = errOutput.match(/Duration:\s+(\d+):(\d+):(\d+\.\d+)/);
        if (match) {
          const hours = parseFloat(match[1]);
          const minutes = parseFloat(match[2]);
          const seconds = parseFloat(match[3]);
          resolve(hours * 3600 + minutes * 60 + seconds);
        } else {
          resolve(undefined);
        }
      });
    });
  });
}

/**
 * Estimate a file's average bytes-per-second from its on-disk size and
 * duration. Used to convert a target split size into a segment duration.
 */
export async function getBytesPerSec(filePath: string, duration?: number): Promise<number> {
  if (!duration || duration <= 0) {
    duration = await getAudioDuration(filePath);
  }
  if (!duration || duration <= 0) return 0;
  try {
    return statSync(filePath).size / duration;
  } catch {
    return 0;
  }
}
