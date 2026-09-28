import { ipcMain } from 'electron';
import { IPC } from '@shared/constants';
import { getLocale, setLocale } from '../services/locale';

export function registerLocaleIpc(): void {
  ipcMain.on(IPC.GET_LOCALE, (event) => {
    event.returnValue = getLocale();
  });
  ipcMain.handle(IPC.SET_LOCALE, (_event, locale: string) => setLocale(locale));
}
