import { ipcMain, shell } from 'electron';
import { existsSync } from 'fs';
import { IPC } from '@shared/constants';

export function registerFilesystemIpc(): void {
  // Reveal a file (or folder) in Finder, highlighting the file.
  ipcMain.handle(IPC.SHOW_ITEM_IN_FOLDER, async (_event, fullPath: string) => {
    if (typeof fullPath !== 'string' || !fullPath) return false;
    return shell.showItemInFolder(fullPath);
  });

  // Open a folder in Finder.
  ipcMain.handle(IPC.REVEAL_IN_FINDER, async (_event, folderPath: string) => {
    if (typeof folderPath !== 'string' || !folderPath) return false;
    try {
      await shell.openPath(folderPath);
      return true;
    } catch {
      return false;
    }
  });

  // Check whether a path exists (used for output-conflict detection).
  ipcMain.handle(IPC.FILE_EXISTS, async (_event, fullPath: string) => {
    if (typeof fullPath !== 'string' || !fullPath) return false;
    return existsSync(fullPath);
  });
}
