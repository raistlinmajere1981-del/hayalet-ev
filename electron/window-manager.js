import { BrowserWindow, session, Tray, Menu, nativeImage } from 'electron';
import { join } from 'path';

// ============================================
// Tray Management
// ============================================

// Tray değişkenleri
let _tray = null;
let _trayIconPath = null;
let _isMinimizedToTray = false;

/**
 * Tray için icon path'i kaydet ve tray'i oluştur
 * @param {string} iconPath - Icon dosya yolu
 */
export function initTray(iconPath) {
  _trayIconPath = iconPath;
  // Tray'i hemen oluştur ama gizli tut
  createTrayInternal();
}

// Eski API uyumluluğu için
export function setTrayIconPath(iconPath) {
  initTray(iconPath);
}

/**
 * Pencereyi system tray'e küçült
 */
export function minimizeToTray() {
  if (!_mainWindow) {
    console.error('[WindowManager] _mainWindow yok!');
    return;
  }

  try {
    // Tray yoksa oluştur
    if (!_tray) {
      createTrayInternal();
    }
    
    _isMinimizedToTray = true;
    _mainWindow.hide();
    console.log('[WindowManager] Pencere tray\'e küçültüldü');
  } catch (err) {
    console.error('[WindowManager] minimizeToTray hatası:', err);
  }
}

/**
 * Internal: Tray oluştur (bir kez, uygulama boyunca kalır)
 */
function createTrayInternal() {
  if (_tray) {
    return;
  }
  
  if (!_trayIconPath) {
    console.error('[WindowManager] Tray icon path yok!');
    return;
  }

  try {
    const icon = nativeImage.createFromPath(_trayIconPath);
    _tray = new Tray(icon.resize({ width: 22, height: 22 }));
    
    updateTrayMenu();

    // Tek tıklama - pencereyi göster
    _tray.on('click', () => {
      console.log('[WindowManager] Tray click');
      restoreFromTray();
    });

    // Çift tıklama - maximize
    _tray.on('double-click', () => {
      console.log('[WindowManager] Tray double-click');
      restoreFromTray();
      _mainWindow?.maximize();
    });

    console.log('[WindowManager] Tray oluşturuldu');
  } catch (err) {
    console.error('[WindowManager] Tray oluşturma hatası:', err);
  }
}

/**
 * Tray menüsünü güncelle
 */
function updateTrayMenu() {
  if (!_tray) return;
  
  const contextMenu = Menu.buildFromTemplate([
    {
      label: 'Göster',
      click: () => restoreFromTray()
    },
    {
      label: 'Tam Ekran',
      click: () => {
        restoreFromTray();
        _mainWindow?.setFullScreen(!_mainWindow?.isFullScreen());
      }
    },
    { type: 'separator' },
    {
      label: 'Çıkış',
      click: () => {
        _mainWindow?.destroy();
        require('electron').app.quit();
      }
    }
  ]);

  _tray.setToolTip('Hayalet-ev');
  _tray.setContextMenu(contextMenu);
}

/**
 * Tray'den pencereyi geri getir
 */
function restoreFromTray() {
  if (!_isMinimizedToTray) return;
  
  _isMinimizedToTray = false;
  
  if (_mainWindow) {
    _mainWindow.show();
    _mainWindow.focus();
    console.log('[WindowManager] Pencere geri açıldı');
  }
}

/**
 * Tray'i temizle (uygulama kapanırken)
 */
export function destroyTray() {
  if (_tray) {
    try {
      _tray.destroy();
    } catch (err) {
      // Sessizce geç
    }
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
