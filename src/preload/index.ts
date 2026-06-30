import { contextBridge, ipcRenderer, webUtils } from 'electron';
import { IPC, IPC_EVENTS } from '@shared/constants';
import type {
  ConversionJob,
  SplitJob,
  ProgressData,
  ConversionResult,
  ElectronAPI,
} from '@shared/types';

export type { ElectronAPI };

const api: ElectronAPI = {
  selectInputFiles: () => ipcRenderer.invoke(IPC.SELECT_INPUT_FILES),
  selectOutputDir: () => ipcRenderer.invoke(IPC.SELECT_OUTPUT_DIR),

  // Electron deprecated File.path; webUtils.getPathForFile is the replacement.
  getPathForFile: (file: File) => webUtils.getPathForFile(file),

  startConversion: (job: ConversionJob) => ipcRenderer.invoke(IPC.START_CONVERSION, job),
  cancelConversion: (jobId: string) => ipcRenderer.invoke(IPC.CANCEL_CONVERSION, jobId),

  startSplit: (job: SplitJob) => ipcRenderer.invoke(IPC.START_SPLIT, job),
  cancelSplit: (jobId: string) => ipcRenderer.invoke(IPC.CANCEL_SPLIT, jobId),

  onConversionProgress: (callback) => {
    const handler = (_event: Electron.IpcRendererEvent, data: ProgressData) => callback(data);
    ipcRenderer.on(IPC_EVENTS.CONVERSION_PROGRESS, handler);
    return () => ipcRenderer.removeListener(IPC_EVENTS.CONVERSION_PROGRESS, handler);
  },

  onConversionComplete: (callback) => {
    const handler = (_event: Electron.IpcRendererEvent, data: ConversionResult) => callback(data);
    ipcRenderer.on(IPC_EVENTS.CONVERSION_COMPLETE, handler);
    return () => ipcRenderer.removeListener(IPC_EVENTS.CONVERSION_COMPLETE, handler);
  },

  onConversionError: (callback) => {
    const handler = (_event: Electron.IpcRendererEvent, data: ConversionResult) => callback(data);
    ipcRenderer.on(IPC_EVENTS.CONVERSION_ERROR, handler);
    return () => ipcRenderer.removeListener(IPC_EVENTS.CONVERSION_ERROR, handler);
  },

  onSplitComplete: (callback) => {
    const handler = (_event: Electron.IpcRendererEvent, data: ConversionResult) => callback(data);
    ipcRenderer.on(IPC_EVENTS.SPLIT_COMPLETE, handler);
    return () => ipcRenderer.removeListener(IPC_EVENTS.SPLIT_COMPLETE, handler);
  },

  onSplitError: (callback) => {
    const handler = (_event: Electron.IpcRendererEvent, data: ConversionResult) => callback(data);
    ipcRenderer.on(IPC_EVENTS.SPLIT_ERROR, handler);
    return () => ipcRenderer.removeListener(IPC_EVENTS.SPLIT_ERROR, handler);
  },

  getAppVersion: () => ipcRenderer.invoke(IPC.GET_APP_VERSION),
  getPlatformInfo: () => ipcRenderer.invoke(IPC.GET_PLATFORM_INFO),
  checkFFmpeg: () => ipcRenderer.invoke(IPC.CHECK_FFMPEG),
  getFfmpegVersion: () => ipcRenderer.invoke(IPC.GET_FFMPEG_VERSION),

  showItemInFolder: (fullPath: string) => ipcRenderer.invoke(IPC.SHOW_ITEM_IN_FOLDER, fullPath),
  revealInFinder: (folderPath: string) => ipcRenderer.invoke(IPC.REVEAL_IN_FINDER, folderPath),
  fileExists: (fullPath: string) => ipcRenderer.invoke(IPC.FILE_EXISTS, fullPath),

  onMenu: (channel: string, callback: () => void) => {
    const handler = () => callback();
    ipcRenderer.on(channel, handler);
  },
  offMenu: (channel: string, _callback: () => void) => {
    // Remove all listeners on this channel. onMenu wraps each callback in a
    // fresh closure so we can't match by reference; for this app's usage (a
    // few menu channels, single subscriber per render) clearing the channel
    // is sufficient and correct.
    ipcRenderer.removeAllListeners(channel);
  },
};

contextBridge.exposeInMainWorld('electronAPI', api);
