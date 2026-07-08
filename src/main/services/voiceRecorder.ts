import { ChildProcess } from 'child_process';
import { BrowserWindow } from 'electron';
import { join } from 'path';
import { unlinkSync } from 'fs';
import { IPC_EVENTS } from '@shared/constants';
import type { RecordingState, RecordingResult } from '@shared/types';
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
   * Returns the job ID on success.
   */
  async start(
    outputDir: string,
    mainWindow: BrowserWindow
  ): Promise<string> {
    if (this.proc) {
      throw new Error('A recording is already in progress.');
    }

    const ffmpegPath = await ffmpegManager.resolveBinary();
    if (!ffmpegPath) {
      throw new Error('FFmpeg not found. Please ensure FFmpeg is installed.');
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

    this.proc = ffmpegManager.spawn(args);

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
      mainWindow?.webContents.send(IPC_EVENTS.RECORDING_ERROR, { jobId, error: err.message });
    });

    this.proc.on('close', (code) => {
      console.log(`[OneTools] Recording process exited with code ${code}`);
      // If stop() was called, the stop handler manages the result.
      if (this.stopping) return;
      // Unexpected exit while not stopping
      if (code !== null && code !== 0) {
        const tail = stderrBuffer.trim().split('\n').slice(-5).join('\n');
        const errorMsg = `FFmpeg exited with code ${code}${tail ? ':\n' + tail : ''}`;
        const mainWindow = this.mainWindow;
        this.cleanup();
        mainWindow?.webContents.send(IPC_EVENTS.RECORDING_ERROR, { jobId: this.jobId, error: errorMsg });
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

    return this.jobId;
  }

  /**
   * Stop the active recording. Sends SIGINT to FFmpeg so it finalizes the
   * output file gracefully, then resolves with the result.
   */
  async stop(): Promise<RecordingResult> {
    if (!this.proc) {
      throw new Error('No recording is in progress.');
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

    return new Promise<RecordingResult>((resolve, reject) => {
      if (!this.proc) {
        reject(new Error('No recording process.'));
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
          resolve(result);
        } else {
          const errorMsg = `FFmpeg exited with code ${code} while stopping.`;
          mainWindow?.webContents.send(IPC_EVENTS.RECORDING_ERROR, { jobId, error: errorMsg });
          reject(new Error(errorMsg));
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