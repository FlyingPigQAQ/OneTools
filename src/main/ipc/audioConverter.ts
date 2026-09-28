import { ipcMain, BrowserWindow } from 'electron';
import { IPC } from '@shared/constants';
import { audioConverter } from '../services/audioConverter';
import type { ConversionJob } from '@shared/types';

let currentWindow: BrowserWindow | null = null;
let registered = false;

function requireCurrentWindow(): BrowserWindow {
  if (!currentWindow || currentWindow.isDestroyed()) {
    throw new Error('Main window is unavailable');
  }
  return currentWindow;
}

export function registerAudioConverterIpc(mainWindow: BrowserWindow): void {
  currentWindow = mainWindow;
  if (registered) return;
  registered = true;

  ipcMain.handle(IPC.START_CONVERSION, async (_event, job: ConversionJob) => {
    await audioConverter.convert(
      job,
      requireCurrentWindow(),
      (_data) => {
        // Progress is sent via IPC events in the converter service
      },
      (_jobId, _success, _error) => {
        // Completion is sent via IPC events in the converter service
      }
    );
    return job.id;
  });

  ipcMain.handle(IPC.CANCEL_CONVERSION, async (_event, jobId: string) => {
    return audioConverter.cancel(jobId);
  });
}
