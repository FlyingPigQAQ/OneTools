import { ipcMain, BrowserWindow } from 'electron';
import { IPC } from '@shared/constants';
import { audioSplitter } from '../services/audioSplitter';
import type { SplitJob } from '@shared/types';

let currentWindow: BrowserWindow | null = null;
let registered = false;

function requireCurrentWindow(): BrowserWindow {
  if (!currentWindow || currentWindow.isDestroyed()) {
    throw new Error('Main window is unavailable');
  }
  return currentWindow;
}

export function registerAudioSplitterIpc(mainWindow: BrowserWindow): void {
  currentWindow = mainWindow;
  if (registered) return;
  registered = true;

  ipcMain.handle(IPC.START_SPLIT, async (_event, job: SplitJob) => {
    await audioSplitter.split(
      job,
      requireCurrentWindow(),
      (_data) => {
        // Progress is sent via IPC events in the splitter service.
      },
      (_jobId, _success, _error) => {
        // Completion is sent via IPC events in the splitter service.
      }
    );
    return job.id;
  });

  ipcMain.handle(IPC.CANCEL_SPLIT, async (_event, jobId: string) => {
    return audioSplitter.cancel(jobId);
  });
}
