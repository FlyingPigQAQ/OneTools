import { ipcMain, BrowserWindow } from 'electron';
import { readFileSync } from 'fs';
import { IPC } from '@shared/constants';
import { voiceRecorder } from '../services/voiceRecorder';

export function registerVoiceRecorderIpc(mainWindow: BrowserWindow): void {
  ipcMain.handle(IPC.START_RECORDING, async (_event, outputDir: string) => {
    return voiceRecorder.start(outputDir, mainWindow);
  });

  ipcMain.handle(IPC.STOP_RECORDING, async () => {
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