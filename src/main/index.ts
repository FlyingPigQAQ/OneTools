import { app, BrowserWindow, net, protocol } from 'electron';
import { join } from 'path';
import { fileURLToPath, pathToFileURL } from 'url';
import { createMenu } from './menu';
import { registerIpcHandlers } from './ipc';

const isDev = !app.isPackaged;

// Register a custom protocol for serving local audio files to the renderer
// (needed for HTML5 <audio> playback since the renderer has no filesystem access).
protocol.registerSchemesAsPrivileged([
  { scheme: 'local-file', privileges: { standard: true, secure: true, stream: true, supportFetchAPI: true } },
]);

function createWindow(): void {
  const mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    minWidth: 900,
    minHeight: 600,
    titleBarStyle: 'hiddenInset',
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  if (isDev) {
    mainWindow.loadURL(process.env['ELECTRON_RENDERER_URL'] || 'http://localhost:5173');
    mainWindow.webContents.openDevTools();
  } else {
    mainWindow.loadFile(join(__dirname, '../renderer/index.html'));
  }

  createMenu(mainWindow);
  registerIpcHandlers(mainWindow);
}

app.whenReady().then(() => {
  // Handle the custom protocol: maps local-file:// URLs to filesystem paths.
  // Used for HTML5 <audio> playback since the renderer has no filesystem access.
  protocol.handle('local-file', (request) => {
    const filePath = fileURLToPath(request.url.replace(/^local-file:/, 'file:'));
    return net.fetch(pathToFileURL(filePath).toString());
  });

  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});
