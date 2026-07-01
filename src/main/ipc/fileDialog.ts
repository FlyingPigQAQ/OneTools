import { ipcMain, dialog } from 'electron';
import { IPC } from '@shared/constants';
import { MARKDOWN_DIALOG_FILTERS } from '@shared/markdown';

const AUDIO_DIALOG_FILTERS = [
  {
    name: 'Audio Files',
    extensions: ['mp3', 'aac', 'flac', 'wav', 'ogg', 'opus', 'm4a', 'wma', 'aiff'],
  },
  { name: 'All Files', extensions: ['*'] },
];

export function registerFileDialogIpc(): void {
  // `kind` selects the filter set shown in the open dialog. Defaults to audio
  // so the existing audio tools, which call this with no argument, are
  // unaffected. Markdown → PDF passes 'markdown'.
  ipcMain.handle(IPC.SELECT_INPUT_FILES, async (_event, kind?: 'audio' | 'markdown') => {
    const result = await dialog.showOpenDialog({
      properties: ['openFile', 'multiSelections'],
      filters: kind === 'markdown' ? MARKDOWN_DIALOG_FILTERS : AUDIO_DIALOG_FILTERS,
    });
    return result.canceled ? [] : result.filePaths;
  });

  ipcMain.handle(IPC.SELECT_OUTPUT_DIR, async () => {
    const result = await dialog.showOpenDialog({
      properties: ['openDirectory'],
    });
    return result.canceled ? null : result.filePaths[0];
  });
}
