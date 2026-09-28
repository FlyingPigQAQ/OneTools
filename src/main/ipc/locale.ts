import { ipcMain } from 'electron';
import { IPC } from '@shared/constants';
import { getLocale, setLocale } from '../services/locale';

let registered = false;

export function registerLocaleIpc(): void {
  if (registered) return;
  registered = true;

  ipcMain.on(IPC.GET_LOCALE, (event) => {
    event.returnValue = getLocale();
  });
  ipcMain.handle(IPC.SET_LOCALE, (_event, locale: string) => setLocale(locale));
}
