import { ipcMain, app } from 'electron';
import { IPC } from '@shared/constants';
import { getPlatformInfo } from '../utils/platform';
import { ffmpegManager } from '../services/ffmpegManager';

export function registerAppInfoIpc(): void {
  ipcMain.handle(IPC.GET_APP_VERSION, () => {
    return app.getVersion();
  });

  ipcMain.handle(IPC.GET_PLATFORM_INFO, () => {
    return getPlatformInfo();
  });

  ipcMain.handle(IPC.CHECK_FFMPEG, async () => {
    return ffmpegManager.checkStatus();
  });

  ipcMain.handle(IPC.GET_FFMPEG_VERSION, async () => {
    return ffmpegManager.getVersion();
  });
}
