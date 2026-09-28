import { ipcMain, BrowserWindow } from 'electron';
import { IPC } from '@shared/constants';
import { markdownPdfConverter } from '../services/markdownPdf';
import type { MarkdownPdfJob } from '@shared/types';

let currentWindow: BrowserWindow | null = null;
let registered = false;

function requireCurrentWindow(): BrowserWindow {
  if (!currentWindow || currentWindow.isDestroyed()) {
    throw new Error('Main window is unavailable');
  }
  return currentWindow;
}

export function registerMarkdownPdfIpc(mainWindow: BrowserWindow): void {
  currentWindow = mainWindow;
  if (registered) return;
  registered = true;

  ipcMain.handle(IPC.START_MD_PDF, async (_event, job: MarkdownPdfJob) => {
    // Progress and completion are emitted via IPC events from the service.
    await markdownPdfConverter.convert(job, requireCurrentWindow(), () => {});
    return job.id;
  });

  ipcMain.handle(IPC.CANCEL_MD_PDF, async (_event, jobId: string) => {
    return markdownPdfConverter.cancel(jobId);
  });
}
