import { BrowserWindow } from 'electron';
import { registerFileDialogIpc } from './fileDialog';
import { registerAudioConverterIpc } from './audioConverter';
import { registerAudioSplitterIpc } from './audioSplitter';
import { registerAppInfoIpc } from './appInfo';
import { registerFilesystemIpc } from './filesystem';

export function registerIpcHandlers(mainWindow: BrowserWindow): void {
  registerFileDialogIpc();
  registerAudioConverterIpc(mainWindow);
  registerAudioSplitterIpc(mainWindow);
  registerFilesystemIpc();
  registerAppInfoIpc();
}
