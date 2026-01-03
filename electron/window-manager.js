import { BrowserWindow } from 'electron';
import { join } from 'path';

export async function createWindow(options = {}) {
  const { __dirname = process.cwd(), isDev = (process.env.NODE_ENV === 'development' || !process.env.NODE_ENV) } = options;

  const win = new BrowserWindow({
    width: 1400,
    height: 900,
    frame: false,
    show: false,
    icon: join(__dirname, '../src/assets/icon.png'),
    webPreferences: {
      preload: join(__dirname, 'preload.cjs'),
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: false,
      webviewTag: true,
      spellcheck: false,
    },
  });

  // Load URL or file depending on dev/packaged
  if (isDev || !process.env.NODE_ENV || process.env.NODE_ENV === 'development') {
    try {
      win.loadURL('http://localhost:5173');
    } catch (e) {
      console.warn('createWindow: loadURL failed', e?.message);
    }
  } else {
    try {
      win.loadFile(join(__dirname, '../dist/index.html'));
    } catch (e) {
      console.warn('createWindow: loadFile failed', e?.message);
    }
  }

  win.once('ready-to-show', () => {
    win.show();
    win.maximize();
  });

  return win;
}

let _mainWindow = null;

export function initWindowManager(opts = {}) {
  _mainWindow = opts.mainWindow || _mainWindow;
}

export function windowMinimize() {
  try {
    _mainWindow?.minimize();
  } catch (err) {
    console.error('windowMinimize error:', err);
  }
}

export function windowClose() {
  try {
    _mainWindow?.close();
  } catch (err) {
    console.error('windowClose error:', err);
  }
}

export function windowToggleFullscreen() {
  try {
    if (!_mainWindow) return;
    const isFull = _mainWindow.isFullScreen();
    _mainWindow.setFullScreen(!isFull);
  } catch (err) {
    console.error('windowToggleFullscreen error:', err);
  }
}

import { app } from 'electron';
export async function appRestart() {
  try {
    // In development (not packaged), relaunching kills the process managed by concurrently,
    // which usually kills the Vite server too (-k flag), leading to a white screen.
    // So we just reload the window in dev mode.
    if (!app.isPackaged) {
      if (_mainWindow) {
        _mainWindow.reload();
        console.log('App is in dev mode, reloading window instead of relaunching.');
        return { success: true, message: 'Geliştirme modu: Sayfa yenilendi' };
      }
    }

    app.relaunch();
    app.quit();
    return { success: true };
  } catch (err) {
    console.error('appRestart error:', err);
    return { success: false, message: err?.message };
  }
}
