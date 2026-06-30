import { ipcMain, dialog } from 'electron';
import { IPC } from '@shared/constants';

export function registerFileDialogIpc(): void {
  ipcMain.handle(IPC.SELECT_INPUT_FILES, async () => {
    const result = await dialog.showOpenDialog({
      properties: ['openFile', 'multiSelections'],
      filters: [
        {
          name: 'Audio Files',
          extensions: ['mp3', 'aac', 'flac', 'wav', 'ogg', 'opus', 'm4a', 'wma', 'aiff'],
        },
        { name: 'All Files', extensions: ['*'] },
      ],
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
