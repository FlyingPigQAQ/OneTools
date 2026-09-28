import { ipcMain, BrowserWindow } from 'electron';
import { IPC } from '@shared/constants';
import { imageProcessor } from '../services/imageProcessor';
import type { ImageJob } from '@shared/types';

let currentWindow: BrowserWindow | null = null;
let registered = false;

function requireCurrentWindow(): BrowserWindow {
  if (!currentWindow || currentWindow.isDestroyed()) {
    throw new Error('Main window is unavailable');
  }
  return currentWindow;
}

export function registerImageProcessorIpc(mainWindow: BrowserWindow): void {
  currentWindow = mainWindow;
  if (registered) return;
  registered = true;

  ipcMain.handle(IPC.START_IMAGE, async (_event, job: ImageJob) => {
    // Progress and completion are emitted via IPC events from the service.
    await imageProcessor.process(job, requireCurrentWindow(), () => {});
    return job.id;
  });

  ipcMain.handle(IPC.CANCEL_IMAGE, async (_event, jobId: string) => {
    return imageProcessor.cancel(jobId);
  });
}
