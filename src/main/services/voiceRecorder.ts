import { ChildProcess } from 'child_process';
import { BrowserWindow } from 'electron';
import { join } from 'path';
import { unlinkSync } from 'fs';
import { IPC_EVENTS } from '@shared/constants';
import type { AppError } from '@shared/i18n';
import type {
  RecordingState,
  RecordingResult,
  RecordingStartResult,
  RecordingStopResult,
} from '@shared/types';
import { ffmpegManager } from './ffmpegManager';

/**
 * Voice Recorder tool. Records audio from the default microphone via FFmpeg
 * (avfoundation on macOS) and saves as MP3. The recording runs entirely in the
 * main process so it survives renderer tool switches.
 */
export class VoiceRecorder {
  private proc: ChildProcess | null = null;
  private startTime = 0;
  private outputPath = '';
  private outputFileName = '';
  private jobId = '';
  private tickInterval: ReturnType<typeof setInterval> | null = null;
  private mainWindow: BrowserWindow | null = null;
  private stopping = false;

  /**
   * Start recording from the default microphone.
   * Returns a result object so AppError fields survive IPC (Electron drops
   * custom fields on thrown errors).
   */
  async start(
    outputDir: string,
    mainWindow: BrowserWindow
  ): Promise<RecordingStartResult> {
    if (this.proc) {
      return { ok: false, error: { key: 'errors.recordingInProgress' } };
    }

    const ffmpegPath = await ffmpegManager.resolveBinary();
    if (!ffmpegPath) {
      return { ok: false, error: { key: 'errors.ffmpegNotFound' } };
    }

    // Generate a unique filename based on the current timestamp.
    const now = new Date();
    const pad = (n: number) => String(n).padStart(2, '0');
    const timestamp = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())} ${pad(now.getHours())}-${pad(now.getMinutes())}-${pad(now.getSeconds())}`;
    this.outputFileName = `Recording ${timestamp}.mp3`;
    this.outputPath = join(outputDir, this.outputFileName);
    this.jobId = `rec-${Date.now()}`;
    this.startTime = Date.now();
    this.mainWindow = mainWindow;

    // FFmpeg command: record from default microphone (avfoundation :0),
    // encode as MP3 at 192kbps.
    const args = [
      '-f', 'avfoundation',
      '-i', ':0',
      '-acodec', 'libmp3lame',
      '-b:a', '192k',
      '-y',
      this.outputPath,
    ];

    console.log(`[OneTools] Starting recording: ${args.join(' ')}`);

    try {
      this.proc = ffmpegManager.spawn(args);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      this.cleanup();
      if (message === 'FFmpeg binary not resolved') {
        return { ok: false, error: { key: 'errors.ffmpegUnresolved', detail: message } };
      }
      return { ok: false, error: { key: 'errors.operationFailed', detail: message } };
    }

    // Collect stderr for error reporting.
    let stderrBuffer = '';

    this.proc.stderr?.on('data', (data: Buffer) => {
      stderrBuffer += data.toString();
    });

    this.proc.on('error', (err) => {
      console.error(`[OneTools] Recording process error: ${err.message}`);
      const mainWindow = this.mainWindow;
      const jobId = this.jobId;
      this.cleanup();
      mainWindow?.webContents.send(IPC_EVENTS.RECORDING_ERROR, {
        jobId,
        error: { key: 'errors.operationFailed', detail: err.message },
      });
    });

    this.proc.on('close', (code) => {
      console.log(`[OneTools] Recording process exited with code ${code}`);
      // If stop() was called, the stop handler manages the result.
      if (this.stopping) return;
      // Unexpected exit while not stopping
      if (code !== null && code !== 0) {
        const tail = stderrBuffer.trim().split('\n').slice(-5).join('\n');
        const error: AppError = {
          key: 'errors.ffmpegExit',
          params: { code: code ?? -1 },
          ...(tail ? { detail: tail } : {}),
        };
        const mainWindow = this.mainWindow;
        const jobId = this.jobId;
        this.cleanup();
        mainWindow?.webContents.send(IPC_EVENTS.RECORDING_ERROR, { jobId, error });
      }
    });

    // Start sending elapsed-time ticks to the renderer.
    this.tickInterval = setInterval(() => {
      if (!this.mainWindow || !this.proc) return;
      const elapsed = Math.floor((Date.now() - this.startTime) / 1000);
      this.mainWindow.webContents.send(IPC_EVENTS.RECORDING_TICK, {
        jobId: this.jobId,
        elapsedSec: elapsed,
      });
    }, 200);

    return { ok: true, jobId: this.jobId };
  }

  /**
   * Stop the active recording. Sends SIGINT to FFmpeg so it finalizes the
   * output file gracefully, then resolves with the result.
   */
  async stop(): Promise<RecordingStopResult> {
    if (!this.proc) {
      return { ok: false, error: { key: 'errors.recordingNotInProgress' } };
    }

    this.stopping = true;

    const jobId = this.jobId;
    const filePath = this.outputPath;
    const fileName = this.outputFileName;
    const startTime = this.startTime;

    // Clear the tick interval immediately.
    if (this.tickInterval) {
      clearInterval(this.tickInterval);
      this.tickInterval = null;
    }

    return new Promise<RecordingStopResult>((resolve) => {
      if (!this.proc) {
        this.stopping = false;
        resolve({ ok: false, error: { key: 'errors.recordingNoProcess' } });
        return;
      }

      this.proc.on('close', (code) => {
        const duration = Math.floor((Date.now() - startTime) / 1000);
        const mainWindow = this.mainWindow;
        this.cleanup();

        // FFmpeg on macOS may exit with code 0, 255, or null (signal) when
        // interrupted via SIGINT. The output file is finalized regardless.
        if (code === 0 || code === 255 || code === null) {
          const result: RecordingResult = {
            jobId,
            filePath,
            fileName,
            duration,
          };
          mainWindow?.webContents.send(IPC_EVENTS.RECORDING_STOPPED, result);
          console.log(`[OneTools] Recording stopped: ${filePath} (${duration}s)`);
          resolve({ ok: true, result });
        } else {
          const error: AppError = {
            key: 'errors.ffmpegExit',
            params: { code },
          };
          mainWindow?.webContents.send(IPC_EVENTS.RECORDING_ERROR, { jobId, error });
          resolve({ ok: false, error });
        }
      });

      // Send SIGINT for graceful FFmpeg shutdown (finalizes the MP4/MP3 file).
      this.proc.kill('SIGINT');
    });
  }

  /**
   * Return the current recording state. Used by the renderer to reconnect
   * to an active recording after a tool switch.
   */
  getState(): RecordingState {
    if (this.proc) {
      return {
        isRecording: true,
        startTime: this.startTime,
        elapsedSec: Math.floor((Date.now() - this.startTime) / 1000),
        outputFileName: this.outputFileName,
        jobId: this.jobId,
      };
    }
    return { isRecording: false, elapsedSec: 0 };
  }

  /**
   * Delete a recording file from disk.
   */
  deleteRecording(filePath: string): boolean {
    try {
      unlinkSync(filePath);
      console.log(`[OneTools] Deleted recording: ${filePath}`);
      return true;
    } catch (err) {
      console.error(`[OneTools] Failed to delete recording: ${filePath}`, err);
      return false;
    }
  }

  /**
   * Clean up internal state after a recording ends.
   */
  private cleanup(): void {
    if (this.tickInterval) {
      clearInterval(this.tickInterval);
      this.tickInterval = null;
    }
    this.proc = null;
    this.startTime = 0;
    this.outputPath = '';
    this.outputFileName = '';
    this.jobId = '';
    this.mainWindow = null;
    this.stopping = false;
  }

  }

export const voiceRecorder = new VoiceRecorder();