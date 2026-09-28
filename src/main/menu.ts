import { Menu, BrowserWindow, app } from 'electron';
import { t, type Locale } from '@shared/i18n';

export function createMenu(
  mainWindow: BrowserWindow,
  locale: Locale,
  onSelectLocale: (locale: Locale) => void,
): void {
  const template: Electron.MenuItemConstructorOptions[] = [
    {
      label: app.name,
      submenu: [
        { role: 'about' },
        { type: 'separator' },
        {
          label: t(locale, 'menu.preferences'),
          accelerator: 'CmdOrCtrl+,',
          click: () => {
            mainWindow.webContents.send('menu:preferences');
          },
        },
        { type: 'separator' },
        { role: 'hide' },
        { role: 'hideOthers' },
        { role: 'unhide' },
        { type: 'separator' },
        { role: 'quit' },
      ],
    },
    {
      label: t(locale, 'menu.file'),
      submenu: [
        {
          label: t(locale, 'menu.openFiles'),
          accelerator: 'CmdOrCtrl+O',
          click: () => {
            mainWindow.webContents.send('menu:openFiles');
          },
        },
        {
          label: t(locale, 'menu.revealOutput'),
          accelerator: 'CmdOrCtrl+Shift+R',
          click: () => {
            mainWindow.webContents.send('menu:revealOutput');
          },
        },
        { type: 'separator' },
        { role: 'close' },
      ],
    },
    {
      label: t(locale, 'menu.edit'),
      submenu: [
        { role: 'undo' },
        { role: 'redo' },
        { type: 'separator' },
        { role: 'cut' },
        { role: 'copy' },
        { role: 'paste' },
        { role: 'selectAll' },
      ],
    },
    {
      label: t(locale, 'menu.view'),
      submenu: [
        { role: 'reload' },
        { role: 'forceReload' },
        { role: 'toggleDevTools' },
        { type: 'separator' },
        { role: 'resetZoom' },
        { role: 'zoomIn' },
        { role: 'zoomOut' },
        { type: 'separator' },
        { role: 'togglefullscreen' },
        { type: 'separator' },
        {
          label: t(locale, 'menu.language'),
          submenu: [
            {
              label: '中文',
              type: 'radio',
              checked: locale === 'zh',
              click: () => onSelectLocale('zh'),
            },
            {
              label: 'English',
              type: 'radio',
              checked: locale === 'en',
              click: () => onSelectLocale('en'),
            },
          ],
        },
      ],
    },
    {
      label: t(locale, 'menu.window'),
      submenu: [
        { role: 'minimize' },
        { role: 'close' },
        { type: 'separator' },
        { role: 'front' },
      ],
    },
  ];

  const menu = Menu.buildFromTemplate(template);
  Menu.setApplicationMenu(menu);
}
