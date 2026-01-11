import { BrowserWindow, session } from 'electron';
import { join } from 'path';

export async function createWindow(options = {}) {
  const { __dirname = process.cwd(), isDev = (process.env.NODE_ENV === 'development' || !process.env.NODE_ENV) } = options;

  if (isDev) {
    process.env.ELECTRON_DISABLE_SECURITY_WARNINGS = 'true';
  }

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

  session.defaultSession.webRequest.onHeadersReceived((details, callback) => {
    const cspDev = [
      "default-src 'self' 'unsafe-inline' 'unsafe-eval'",
      "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://cdn.jsdelivr.net",
      "style-src 'self' 'unsafe-inline' https://cdn.jsdelivr.net",
      "img-src 'self' data: https:",
      "connect-src 'self' http://localhost:* ws://localhost:*",
      "font-src 'self' data: https://cdn.jsdelivr.net",
    ].join('; ');

    const cspProd = [
      "default-src 'self' 'unsafe-inline'",
      "script-src 'self' 'unsafe-inline' https://cdn.jsdelivr.net",
      "style-src 'self' 'unsafe-inline' https://cdn.jsdelivr.net",
      "img-src 'self' data: https:",
      "connect-src 'self'",
      "font-src 'self' data: https://cdn.jsdelivr.net",
    ].join('; ');

    callback({
      responseHeaders: {
        ...details.responseHeaders,
        'Content-Security-Policy': [isDev ? cspDev : cspProd]
      }
    });
  });

  if (isDev || !process.env.NODE_ENV || process.env.NODE_ENV === 'development') {
    try {
      win.loadURL('http://localhost:5173');
    } catch (e) {
    }
  } else {
    try {
      win.loadFile(join(__dirname, '../dist/index.html'));
    } catch (e) {
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
  }
}

export function windowClose() {
  try {
    _mainWindow?.close();
  } catch (err) {
  }
}

export function windowToggleFullscreen() {
  try {
    if (!_mainWindow) return;
    const isFull = _mainWindow.isFullScreen();
    _mainWindow.setFullScreen(!isFull);
  } catch (err) {
  }
}

import { app } from 'electron';
export async function appRestart() {
  try {
    if (!app.isPackaged) {
      if (_mainWindow) {
        _mainWindow.reload();
        return { success: true, message: 'Geliştirme modu: Sayfa yenilendi' };
      }
    }

    app.relaunch();
    app.quit();
    return { success: true };
  } catch (err) {
    return { success: false, message: err?.message };
  }
}
