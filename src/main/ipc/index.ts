import { BrowserWindow } from 'electron';
import { registerFileDialogIpc } from './fileDialog';
import { registerAudioConverterIpc } from './audioConverter';
import { registerAudioSplitterIpc } from './audioSplitter';
import { registerMarkdownPdfIpc } from './markdownPdf';
import { registerVoiceRecorderIpc } from './voiceRecorder';
import { registerAppInfoIpc } from './appInfo';
import { registerFilesystemIpc } from './filesystem';
import { registerLocaleIpc } from './locale';

export function registerIpcHandlers(mainWindow: BrowserWindow): void {
  // Each register* function is idempotent. Window-scoped handlers also replace
  // their current-window reference, so a later macOS activate can recreate the
  // window without calling ipcMain.handle twice.
  registerFileDialogIpc();
  registerAudioConverterIpc(mainWindow);
  registerAudioSplitterIpc(mainWindow);
  registerMarkdownPdfIpc(mainWindow);
  registerVoiceRecorderIpc(mainWindow);
  registerFilesystemIpc();
  registerAppInfoIpc();
  registerLocaleIpc();
}
