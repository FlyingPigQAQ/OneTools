import { ipcMain, BrowserWindow } from 'electron';
import { readFileSync } from 'fs';
import { IPC } from '@shared/constants';
import type { RecordingStartResult, RecordingStopResult } from '@shared/types';
import { voiceRecorder } from '../services/voiceRecorder';

let currentWindow: BrowserWindow | null = null;
let registered = false;

function requireCurrentWindow(): BrowserWindow {
  if (!currentWindow || currentWindow.isDestroyed()) {
    throw new Error('Main window is unavailable');
  }
  return currentWindow;
}

export function registerVoiceRecorderIpc(mainWindow: BrowserWindow): void {
  currentWindow = mainWindow;
  if (registered) return;
  registered = true;

  ipcMain.handle(IPC.START_RECORDING, async (_event, outputDir: string): Promise<RecordingStartResult> => {
    return voiceRecorder.start(outputDir, requireCurrentWindow());
  });

  ipcMain.handle(IPC.STOP_RECORDING, async (): Promise<RecordingStopResult> => {
    return voiceRecorder.stop();
  });

  ipcMain.handle(IPC.GET_RECORDING_STATE, async () => {
    return voiceRecorder.getState();
  });

  ipcMain.handle(IPC.DELETE_RECORDING, async (_event, filePath: string) => {
    return voiceRecorder.deleteRecording(filePath);
  });

  ipcMain.handle(IPC.READ_AUDIO_FILE, async (_event, filePath: string) => {
    const data = readFileSync(filePath);
    // Return a Uint8Array so the renderer can build a blob: URL for playback.
    return new Uint8Array(data);
  });
}