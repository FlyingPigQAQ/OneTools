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
  registerFileDialogIpc();
  registerAudioConverterIpc(mainWindow);
  registerAudioSplitterIpc(mainWindow);
  registerMarkdownPdfIpc(mainWindow);
  registerVoiceRecorderIpc(mainWindow);
  registerFilesystemIpc();
  registerAppInfoIpc();
  registerLocaleIpc();
}
