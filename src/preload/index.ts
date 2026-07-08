import { contextBridge, ipcRenderer, webUtils } from 'electron';
import { IPC, IPC_EVENTS } from '@shared/constants';
import type {
  ConversionJob,
  SplitJob,
  MarkdownPdfJob,
  ProgressData,
  ConversionResult,
  RecordingOptions,
  RecordingTickData,
  RecordingResult,
  ElectronAPI,
} from '@shared/types';

export type { ElectronAPI };

const api: ElectronAPI = {
  selectInputFiles: (kind?: 'audio' | 'markdown') =>
    ipcRenderer.invoke(IPC.SELECT_INPUT_FILES, kind),
  selectOutputDir: () => ipcRenderer.invoke(IPC.SELECT_OUTPUT_DIR),

  // Electron deprecated File.path; webUtils.getPathForFile is the replacement.
  getPathForFile: (file: File) => webUtils.getPathForFile(file),

  startConversion: (job: ConversionJob) => ipcRenderer.invoke(IPC.START_CONVERSION, job),
  cancelConversion: (jobId: string) => ipcRenderer.invoke(IPC.CANCEL_CONVERSION, jobId),

  startSplit: (job: SplitJob) => ipcRenderer.invoke(IPC.START_SPLIT, job),
  cancelSplit: (jobId: string) => ipcRenderer.invoke(IPC.CANCEL_SPLIT, jobId),

  startMarkdownPdf: (job: MarkdownPdfJob) => ipcRenderer.invoke(IPC.START_MD_PDF, job),
  cancelMarkdownPdf: (jobId: string) => ipcRenderer.invoke(IPC.CANCEL_MD_PDF, jobId),

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

  onMarkdownPdfProgress: (callback) => {
    const handler = (_event: Electron.IpcRendererEvent, data: ProgressData) => callback(data);
    ipcRenderer.on(IPC_EVENTS.MD_PDF_PROGRESS, handler);
    return () => ipcRenderer.removeListener(IPC_EVENTS.MD_PDF_PROGRESS, handler);
  },

  onMarkdownPdfComplete: (callback) => {
    const handler = (_event: Electron.IpcRendererEvent, data: ConversionResult) => callback(data);
    ipcRenderer.on(IPC_EVENTS.MD_PDF_COMPLETE, handler);
    return () => ipcRenderer.removeListener(IPC_EVENTS.MD_PDF_COMPLETE, handler);
  },

  onMarkdownPdfError: (callback) => {
    const handler = (_event: Electron.IpcRendererEvent, data: ConversionResult) => callback(data);
    ipcRenderer.on(IPC_EVENTS.MD_PDF_ERROR, handler);
    return () => ipcRenderer.removeListener(IPC_EVENTS.MD_PDF_ERROR, handler);
  },

  // Voice Recorder
  startRecording: (options: RecordingOptions) => ipcRenderer.invoke(IPC.START_RECORDING, options.outputDir),
  stopRecording: () => ipcRenderer.invoke(IPC.STOP_RECORDING),
  getRecordingState: () => ipcRenderer.invoke(IPC.GET_RECORDING_STATE),
  deleteRecording: (filePath: string) => ipcRenderer.invoke(IPC.DELETE_RECORDING, filePath),
  readAudioFile: (filePath: string) => ipcRenderer.invoke(IPC.READ_AUDIO_FILE, filePath),

  onRecordingTick: (callback) => {
    const handler = (_event: Electron.IpcRendererEvent, data: RecordingTickData) => callback(data);
    ipcRenderer.on(IPC_EVENTS.RECORDING_TICK, handler);
    return () => ipcRenderer.removeListener(IPC_EVENTS.RECORDING_TICK, handler);
  },

  onRecordingStopped: (callback) => {
    const handler = (_event: Electron.IpcRendererEvent, data: RecordingResult) => callback(data);
    ipcRenderer.on(IPC_EVENTS.RECORDING_STOPPED, handler);
    return () => ipcRenderer.removeListener(IPC_EVENTS.RECORDING_STOPPED, handler);
  },

  onRecordingError: (callback) => {
    const handler = (_event: Electron.IpcRendererEvent, data: { jobId: string; error: string }) => callback(data);
    ipcRenderer.on(IPC_EVENTS.RECORDING_ERROR, handler);
    return () => ipcRenderer.removeListener(IPC_EVENTS.RECORDING_ERROR, handler);
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
