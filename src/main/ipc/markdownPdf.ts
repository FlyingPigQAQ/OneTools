import { ipcMain, BrowserWindow } from 'electron';
import { IPC } from '@shared/constants';
import { markdownPdfConverter } from '../services/markdownPdf';
import type { MarkdownPdfJob } from '@shared/types';

export function registerMarkdownPdfIpc(mainWindow: BrowserWindow): void {
  ipcMain.handle(IPC.START_MD_PDF, async (_event, job: MarkdownPdfJob) => {
    // Progress and completion are emitted via IPC events from the service.
    await markdownPdfConverter.convert(job, mainWindow, () => {});
    return job.id;
  });

  ipcMain.handle(IPC.CANCEL_MD_PDF, async (_event, jobId: string) => {
    return markdownPdfConverter.cancel(jobId);
  });
}
