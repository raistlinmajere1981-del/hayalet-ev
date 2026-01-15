import { BrowserWindow, session, Tray, Menu, nativeImage } from 'electron';
import { join } from 'path';

// ============================================
// Tray Management
// ============================================

let _tray = null;
let _trayIconPath = null;

/**
 * Tray için icon path'i kaydet (lazy initialization için)
 * @param {string} iconPath - Icon dosya yolu
 */
export function setTrayIconPath(iconPath) {
  _trayIconPath = iconPath;
}

/**
 * System tray oluştur ve göster
 */
function showTray() {
  // Zaten varsa tekrar oluşturma
  if (_tray) {
    return _tray;
  }
  
  if (!_trayIconPath || !_mainWindow) {
    return null;
  }

  try {
    const icon = nativeImage.createFromPath(_trayIconPath);
    _tray = new Tray(icon.resize({ width: 22, height: 22 }));
    
    const contextMenu = Menu.buildFromTemplate([
      {
        label: 'Göster',
        click: () => restoreFromTray()
      },
      {
        label: 'Tam Ekran',
        click: () => {
          if (_mainWindow) {
            _mainWindow.show();
            _mainWindow.setFullScreen(!_mainWindow.isFullScreen());
            hideTray();
          }
        }
      },
      { type: 'separator' },
      {
        label: 'Çıkış',
        click: () => {
          if (_mainWindow) {
            _mainWindow.destroy();
          }
          require('electron').app.quit();
        }
      }
    ]);

    _tray.setToolTip('Hayalet-ev - Tıkla veya çift tıkla aç');
    _tray.setContextMenu(contextMenu);

    // Çift tıklama - maximize et
    _tray.on('double-click', () => {
      restoreFromTray();
      _mainWindow?.maximize();
    });

    // Tek tıklama - göster
    _tray.on('click', () => {
      restoreFromTray();
    });

    console.log('[WindowManager] Tray oluşturuldu');
    return _tray;
  } catch (err) {
    console.error('[WindowManager] Tray oluşturma hatası:', err);
    return null;
  }
}

/**
 * Tray'i gizle/kaldır
 */
function hideTray() {
  if (_tray) {
    try {
      _tray.destroy();
      console.log('[WindowManager] Tray kaldırıldı');
    } catch (err) {
      console.error('[WindowManager] Tray destroy hatası:', err);
    }
    _tray = null;
  }
}

/**
 * Tray'den pencereyi geri getir
 */
function restoreFromTray() {
  if (_mainWindow) {
    _mainWindow.show();
    _mainWindow.focus();
  }
  hideTray();
}

/**
 * Pencereyi system tray'e küçült
 */
export function minimizeToTray() {
  try {
    if (_mainWindow) {
      showTray();
      _mainWindow.hide();
    }
  } catch (err) {
    console.error('[WindowManager] minimizeToTray hatası:', err);
  }
}

/**
 * Tray'i temizle (export for cleanup)
 */
export function destroyTray() {
  hideTray();
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
