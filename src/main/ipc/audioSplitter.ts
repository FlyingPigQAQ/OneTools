import { ipcMain, BrowserWindow } from 'electron';
import { IPC } from '@shared/constants';
import { audioSplitter } from '../services/audioSplitter';
import type { SplitJob } from '@shared/types';

export function registerAudioSplitterIpc(mainWindow: BrowserWindow): void {
  ipcMain.handle(IPC.START_SPLIT, async (_event, job: SplitJob) => {
    await audioSplitter.split(
      job,
      mainWindow,
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
