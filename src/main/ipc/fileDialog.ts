import { ipcMain, dialog } from 'electron';
import { IPC } from '@shared/constants';
import { t } from '@shared/i18n';
import { MARKDOWN_EXTENSIONS } from '@shared/markdown';
import { getLocale } from '../services/locale';

let registered = false;

export function registerFileDialogIpc(): void {
  if (registered) return;
  registered = true;

  // `kind` selects the filter set shown in the open dialog. Defaults to audio
  // so the existing audio tools, which call this with no argument, are
  // unaffected. Markdown → PDF passes 'markdown'.
  ipcMain.handle(IPC.SELECT_INPUT_FILES, async (_event, kind?: 'audio' | 'markdown') => {
    const audioFilters = [
      {
        name: t(getLocale(), 'dialogs.audioFiles'),
        extensions: ['mp3', 'aac', 'flac', 'wav', 'ogg', 'opus', 'm4a', 'wma', 'aiff'],
      },
      { name: t(getLocale(), 'dialogs.allFiles'), extensions: ['*'] },
    ];
    const markdownFilters = [
      { name: t(getLocale(), 'dialogs.markdownFiles'), extensions: MARKDOWN_EXTENSIONS },
      { name: t(getLocale(), 'dialogs.allFiles'), extensions: ['*'] },
    ];
    const result = await dialog.showOpenDialog({
      properties: ['openFile', 'multiSelections'],
      filters: kind === 'markdown' ? markdownFilters : audioFilters,
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
