import { BrowserWindow, session, Tray, Menu, nativeImage } from 'electron';
import { join } from 'path';

// ============================================
// Tray Management
// ============================================

let _tray = null;

/**
 * System tray oluştur
 * @param {Object} options - { iconPath, mainWindow }
 */
export function createTray(options = {}) {
  const { iconPath, mainWindow } = options;
  
  if (_tray) {
    return _tray;
  }

  try {
    // Icon oluştur
    const icon = nativeImage.createFromPath(iconPath);
    _tray = new Tray(icon.resize({ width: 22, height: 22 }));
    
    // Context menu
    const contextMenu = Menu.buildFromTemplate([
      {
        label: 'Göster',
        click: () => {
          if (mainWindow) {
            mainWindow.show();
            mainWindow.focus();
          }
        }
      },
      {
        label: 'Tam Ekran',
        click: () => {
          if (mainWindow) {
            mainWindow.show();
            mainWindow.setFullScreen(!mainWindow.isFullScreen());
          }
        }
      },
      { type: 'separator' },
      {
        label: 'Çıkış',
        click: () => {
          if (mainWindow) {
            mainWindow.destroy();
          }
          require('electron').app.quit();
        }
      }
    ]);

    _tray.setToolTip('Hayalet-ev');
    _tray.setContextMenu(contextMenu);

    // Çift tıklama - pencereyi göster ve tam ekran yap
    _tray.on('double-click', () => {
      if (mainWindow) {
        mainWindow.show();
        mainWindow.maximize();
        mainWindow.focus();
      }
    });

    // Tek tıklama - pencereyi göster
    _tray.on('click', () => {
      if (mainWindow) {
        if (mainWindow.isVisible()) {
          mainWindow.focus();
        } else {
          mainWindow.show();
          mainWindow.focus();
        }
      }
    });

    return _tray;
  } catch (err) {
    console.error('[WindowManager] Tray oluşturma hatası:', err);
    return null;
  }
}

/**
 * Pencereyi system tray'e küçült
 */
export function minimizeToTray() {
  try {
    if (_mainWindow) {
      _mainWindow.hide();
    }
  } catch (err) {
    console.error('[WindowManager] minimizeToTray hatası:', err);
  }
}

/**
 * Tray'i temizle
 */
export function destroyTray() {
  if (_tray) {
    _tray.destroy();
    _tray = null;
  }
}

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
      "img-src 'self' data: https:",
      "connect-src 'self' http://localhost:* ws://localhost:*",
    ].join('; ');

    const cspProd = [
      "default-src 'self' 'unsafe-inline'",
      "img-src 'self' data: https:",
      "connect-src 'self'",
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
