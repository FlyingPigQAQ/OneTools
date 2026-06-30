import { ipcMain, BrowserWindow } from 'electron';
import { IPC } from '@shared/constants';
import { audioConverter } from '../services/audioConverter';
import type { ConversionJob } from '@shared/types';

export function registerAudioConverterIpc(mainWindow: BrowserWindow): void {
  ipcMain.handle(IPC.START_CONVERSION, async (_event, job: ConversionJob) => {
    await audioConverter.convert(
      job,
      mainWindow,
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
