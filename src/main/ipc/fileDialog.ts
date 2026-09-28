import { ipcMain, dialog } from 'electron';
import { IPC } from '@shared/constants';
import { t } from '@shared/i18n';
import { MARKDOWN_EXTENSIONS } from '@shared/markdown';
import { IMAGE_INPUT_EXTENSIONS } from '@shared/imageFormats';
import { getLocale } from '../services/locale';

let registered = false;

export function registerFileDialogIpc(): void {
  if (registered) return;
  registered = true;

  // `kind` selects the filter set shown in the open dialog. Defaults to audio
  // so the existing audio tools, which call this with no argument, are
  // unaffected. Markdown → PDF passes 'markdown', the image tool passes 'image'.
  ipcMain.handle(IPC.SELECT_INPUT_FILES, async (_event, kind?: 'audio' | 'markdown' | 'image') => {
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
    const imageFilters = [
      { name: t(getLocale(), 'dialogs.imageFiles'), extensions: IMAGE_INPUT_EXTENSIONS },
      { name: t(getLocale(), 'dialogs.allFiles'), extensions: ['*'] },
    ];
    const filters =
      kind === 'markdown' ? markdownFilters : kind === 'image' ? imageFilters : audioFilters;
    const result = await dialog.showOpenDialog({
      properties: ['openFile', 'multiSelections'],
      filters,
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
