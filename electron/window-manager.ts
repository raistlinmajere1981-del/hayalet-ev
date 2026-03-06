import { BrowserWindow, session, Tray, Menu, nativeImage, app, shell, screen } from "electron";
import { getLoggerCore } from "./logger/index.js";
import { LogCategory, LogLevel } from "@shared/index.js";
import { Paths } from "./paths.ts";
import { buildPreloadAdditionalArguments, type StartupFlags } from "./startup-flags.ts";

// Extend Electron types for runtime-supported features
interface ExtendedWebPreferences extends Electron.WebPreferences {
  navigationTheme?: string;
}

const logger = getLoggerCore();

let _tray: Tray | null = null;
let _trayIconPath: string | null = null;
let _isMinimizedToTray: boolean = false;
let _mainWindow: BrowserWindow | null = null;

function resolveCorsAllowOrigin(isDev: boolean, referrer?: string): string {
  const fallbackOrigin = isDev ? "http://localhost:5173" : "null";
  if (referrer === undefined || referrer.length === 0) return fallbackOrigin;

  try {
    const origin = new URL(referrer).origin;
    const isAllowedOrigin =
      origin === "null" ||
      origin === "https://opencode.ai" ||
      origin === "http://localhost:5173" ||
      origin === "http://127.0.0.1:5173" ||
      /^http:\/\/127\.0\.0\.1:\d+$/.test(origin);
    return isAllowedOrigin ? origin : fallbackOrigin;
  } catch {
    return fallbackOrigin;
  }
}

export function initTray(iconPath: string): void {
  _trayIconPath = iconPath;
  createTrayInternal();
}

export function setTrayIconPath(iconPath: string): void {
  initTray(iconPath);
}

export async function minimizeToTray(): Promise<void> {
  if (_mainWindow === null) {
    await logger.logInternal(LogCategory.MAIN, LogLevel.ERROR, "_mainWindow is not available", {});
    return;
  }

  try {
    if (_tray === null) {
      createTrayInternal();
    }

    _isMinimizedToTray = true;
    _mainWindow.hide();
    await logger.logInternal(LogCategory.MAIN, LogLevel.INFO, "Window minimized to tray", {});
  } catch (err) {
    await logger.logInternal(
      LogCategory.MAIN,
      LogLevel.ERROR,
      `minimizeToTray error: ${(err as Error).message}`,
      {
        error: {
          name: (err as Error).name,
          message: (err as Error).message,
          stack: (err as Error).stack,
        },
      }
    );
  }
}

function createTrayInternal(): void {
  if (_tray !== null) {
    return;
  }

  if (_trayIconPath === null || _trayIconPath.length === 0) {
    void logger.logInternal(LogCategory.MAIN, LogLevel.ERROR, "Tray icon path is not set", {});
    return;
  }

  try {
    const icon = nativeImage.createFromPath(_trayIconPath);

    // Log tray icon path for debugging
    void logger.logInternal(LogCategory.MAIN, LogLevel.DEBUG, "Creating tray icon", {
      iconPath: _trayIconPath,
      iconSize: icon.getSize(),
    });

    _tray = new Tray(icon.resize({ width: 22, height: 22 }));

    updateTrayMenu();

    _tray.on("click", () => {
      void logger.logInternal(LogCategory.MAIN, LogLevel.DEBUG, "Tray clicked", {});
      restoreFromTray();
    });

    _tray.on("double-click", () => {
      void logger.logInternal(LogCategory.MAIN, LogLevel.DEBUG, "Tray double-clicked", {});
      restoreFromTray();
      _mainWindow?.maximize();
    });

    void logger.logInternal(LogCategory.MAIN, LogLevel.INFO, "Tray created", {
      iconPath: _trayIconPath,
    });
  } catch (err) {
    void logger.logInternal(
      LogCategory.MAIN,
      LogLevel.ERROR,
      `Tray creation error: ${(err as Error).message}`,
      {
        error: {
          name: (err as Error).name,
          message: (err as Error).message,
          stack: (err as Error).stack,
        },
      }
    );
  }
}

function updateTrayMenu(): void {
  if (_tray === null) return;

  const contextMenu = Menu.buildFromTemplate([
    {
      label: "Göster",
      click: (): void => {
        restoreFromTray();
      },
    },
    {
      label: "Tam Ekran",
      click: (): void => {
        restoreFromTray();
        if (_mainWindow !== null) {
          _mainWindow.setFullScreen(!_mainWindow.isFullScreen());
        }
      },
    },
    { type: "separator" },
    {
      label: "Çıkış",
      click: (): void => {
        _mainWindow?.destroy();
        app.quit();
      },
    },
  ]);

  _tray.setToolTip("Hayalet-ev");
  _tray.setContextMenu(contextMenu);
}

function restoreFromTray(): void {
  if (!_isMinimizedToTray) return;

  _isMinimizedToTray = false;

  if (_mainWindow !== null) {
    _mainWindow.show();
    _mainWindow.focus();
    void logger.logInternal(LogCategory.MAIN, LogLevel.INFO, "Window restored from tray", {});
  }
}

interface CreateWindowOptions {
  isDev?: boolean;
  startupFlags?: StartupFlags;
}

export function createWindow(options: CreateWindowOptions = {}): BrowserWindow {
  const { isDev = !Paths.isPackaged(), startupFlags } = options;
  const additionalArguments =
    startupFlags === undefined ? [] : buildPreloadAdditionalArguments(startupFlags);
  const { workArea } = screen.getPrimaryDisplay();

  if (isDev) {
    process.env["ELECTRON_DISABLE_SECURITY_WARNINGS"] = "true";
  }

  // Icon path for debugging
  const iconPath = Paths.getIconPath();

  const win = new BrowserWindow({
    x: workArea.x,
    y: workArea.y,
    width: workArea.width,
    height: workArea.height,
    frame: false,
    resizable: false,
    maximizable: false,
    fullscreenable: true,
    show: false,
    icon: nativeImage.createFromPath(iconPath),
    webPreferences: {
      preload: Paths.getPreloadPath("preload.cjs"),
      additionalArguments,
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: false,
      webviewTag: true,
      spellcheck: false,
      allowRunningInsecureContent: false,
      disableBlinkFeatures: "Auxclick",
      navigationTheme: "dark",
    } as ExtendedWebPreferences,
  });

  session.defaultSession.webRequest.onHeadersReceived((details, callback) => {
    const cspDev = [
      "default-src 'self' 'unsafe-inline' 'unsafe-eval'",
      "img-src 'self' data: https:",
      "connect-src 'self' http://localhost:* ws://localhost:* http://127.0.0.1:*",
    ].join("; ");

    const cspProd = [
      "default-src 'self' 'unsafe-inline'",
      "img-src 'self' data: https:",
      "connect-src 'self' http://127.0.0.1:*",
    ].join("; ");

    const responseHeaders: Record<string, string[]> = {
      ...details.responseHeaders,
      "Content-Security-Policy": [isDev ? cspDev : cspProd],
    };

    // Local server yanıtlarına CORS header ekle
    const url = details.url;
    if (url.includes("127.0.0.1:") && /:\d{4,5}\//.test(url)) {
      const referrer = (details as { referrer?: string }).referrer;
      responseHeaders["Access-Control-Allow-Origin"] = [resolveCorsAllowOrigin(isDev, referrer)];
      responseHeaders["Access-Control-Allow-Methods"] = ["GET, POST, PUT, PATCH, DELETE, OPTIONS"];
      responseHeaders["Access-Control-Allow-Headers"] = ["Content-Type"];
    }

    callback({ responseHeaders });
  });

  // Relax CSP in Asistan webview to allow OpenCode changelog fetch + local server
  const asistanSession = session.fromPartition("persist:ai0");
  asistanSession.webRequest.onHeadersReceived((details, callback) => {
    const headers: Record<string, string[]> = { ...details.responseHeaders };
    const cspKey = Object.keys(headers).find(
      (key) => key.toLowerCase() === "content-security-policy"
    );

    if (cspKey !== undefined) {
      const rawValue = headers[cspKey];
      const cspValue = Array.isArray(rawValue) ? rawValue.join("; ") : String(rawValue);
      const updatedCsp = extendConnectSrc(cspValue, ["https://opencode.ai", "http://127.0.0.1:*"]);
      headers[cspKey] = [updatedCsp];
    }

    // Local server yanıtlarına CORS header ekle
    const reqUrl = details.url;
    if (reqUrl.includes("127.0.0.1:") && /:\d{4,5}\//.test(reqUrl)) {
      const referrer = (details as { referrer?: string }).referrer;
      headers["Access-Control-Allow-Origin"] = [resolveCorsAllowOrigin(isDev, referrer)];
      headers["Access-Control-Allow-Methods"] = ["GET, POST, PUT, PATCH, DELETE, OPTIONS"];
      headers["Access-Control-Allow-Headers"] = ["Content-Type"];
    }

    callback({ responseHeaders: headers });
  });

  const nodeEnv = process.env["NODE_ENV"];
  if (isDev || nodeEnv === undefined || nodeEnv.length === 0 || nodeEnv === "development") {
    void win.loadURL("http://localhost:5173");
  } else {
    void win.loadFile(Paths.getHtmlEntryPath());
  }

  // ── Webview Navigation Guard ──────────────────────────────
  // Provider baseUrl domain'i dışındaki linkleri sistem tarayıcısında aç
  setupWebviewNavigationGuard();

  win.once("ready-to-show", () => {
    win.show();
  });

  return win;
}

function extendConnectSrc(csp: string, extras: string[]): string {
  const connectSrcRegex = /(^|;)\s*connect-src\s+([^;]+)/i;
  const match = csp.match(connectSrcRegex);

  if (match === null) {
    return `${csp}; connect-src 'self' ${extras.join(" ")}`.trim();
  }

  const prefix = match[1] ?? "";
  const sources = match[2] ?? "";
  const missing = extras.filter((extra) => !sources.includes(extra));
  if (missing.length === 0) {
    return csp;
  }

  const replacement = `${prefix} connect-src ${sources} ${missing.join(" ")}`;
  return csp.replace(connectSrcRegex, replacement);
}

interface WindowManagerOptions {
  mainWindow?: BrowserWindow | null;
}

export function initWindowManager(opts: WindowManagerOptions = {}): void {
  _mainWindow = opts.mainWindow ?? _mainWindow;
}

export function setMainWindow(window: BrowserWindow | null): void {
  _mainWindow = window;
}

export function windowMinimize(): void {
  try {
    _mainWindow?.minimize();
  } catch (err) {
    void logger.logInternal(LogCategory.MAIN, LogLevel.WARNING, "windowMinimize failed", {
      error: err instanceof Error ? err.message : String(err),
    });
  }
}

export function windowClose(): void {
  try {
    _mainWindow?.close();
  } catch (err) {
    void logger.logInternal(LogCategory.MAIN, LogLevel.WARNING, "windowClose failed", {
      error: err instanceof Error ? err.message : String(err),
    });
  }
}

export function windowToggleFullscreen(): void {
  try {
    if (_mainWindow === null) return;
    const isFull = _mainWindow.isFullScreen();
    if (isFull) {
      _mainWindow.setFullScreen(false);
      _mainWindow.setResizable(false);
      const { workArea } = screen.getDisplayMatching(_mainWindow.getBounds());
      _mainWindow.setBounds(workArea);
      void logger.logInternal(LogCategory.MAIN, LogLevel.INFO, "Window exited fullscreen", {
        bounds: _mainWindow.getBounds(),
      });
      return;
    }
    _mainWindow.setResizable(true);
    _mainWindow.setFullScreen(true);
    void logger.logInternal(LogCategory.MAIN, LogLevel.INFO, "Window entered fullscreen", {
      bounds: _mainWindow.getBounds(),
    });
  } catch (err) {
    void logger.logInternal(LogCategory.MAIN, LogLevel.WARNING, "windowToggleFullscreen failed", {
      error: err instanceof Error ? err.message : String(err),
    });
  }
}

interface AppRestartOptions {
  forceFullRestart?: boolean;
}

export function appRestart(options: AppRestartOptions = {}): {
  success: boolean;
  message?: string;
} {
  try {
    if (!app.isPackaged && options.forceFullRestart !== true) {
      if (_mainWindow !== null) {
        _mainWindow.reload();
        return {
          success: true,
          message: "Geliştirme modu: Sayfa yenilendi",
        };
      }
    }

    app.relaunch();
    app.quit();
    return { success: true };
  } catch (err) {
    return { success: false, message: (err as Error).message };
  }
}

// ── Webview Navigation Guard ──────────────────────────────────────
// Provider'ın izin verilen domain'leri dışındaki URL'leri
// sistem tarayıcısında açar, webview içinde kalmasını engeller.

/** Provider baseUrl'lerinden izin verilen domain'leri çıkar */
const PROVIDER_ALLOWED_DOMAINS: Record<string, string[]> = {
  // ChatGPT
  "chatgpt.com": ["chatgpt.com", "auth.openai.com", "auth0.openai.com", "openai.com"],
  // Gemini
  "gemini.google.com": ["gemini.google.com", "accounts.google.com", "myaccount.google.com"],
  // Grok
  "grok.com": ["grok.com", "x.ai", "accounts.x.ai"],
  // Localhost (opencode vb.)
  "127.0.0.1": ["127.0.0.1", "localhost"],
  localhost: ["127.0.0.1", "localhost"],
};

/**
 * Verilen URL'nin provider domain'ine ait olup olmadığını kontrol eder.
 * webview partition'ından veya mevcut URL'den provider domain'ini belirler.
 */
function isUrlAllowedInWebview(targetUrl: string, currentUrl: string): boolean {
  let target: URL;
  try {
    target = new URL(targetUrl);
  } catch {
    return true; // Parse edilemeyen URL'leri engelleme
  }

  // about:blank, data:, devtools: vb. izin ver
  if (target.protocol !== "http:" && target.protocol !== "https:") {
    return true;
  }

  // Mevcut URL'den provider domain'ini bul
  let providerHostname: string;
  try {
    providerHostname = new URL(currentUrl).hostname;
  } catch {
    return true; // Mevcut URL yoksa engelleme
  }

  // Provider'ın izin listesini bul
  const allowedDomains = findAllowedDomains(providerHostname);
  if (allowedDomains === null) {
    return true; // Bilinmeyen provider → engelleme
  }

  const targetHostname = target.hostname;

  // İzin verilen domain'lerden birine ait mi?
  return allowedDomains.some((domain) => {
    return targetHostname === domain || targetHostname.endsWith(`.${domain}`);
  });
}

/** Hostname'den izin verilen domain listesini bul */
function findAllowedDomains(hostname: string): string[] | null {
  // Direkt eşleşme
  for (const [key, domains] of Object.entries(PROVIDER_ALLOWED_DOMAINS)) {
    if (hostname === key || hostname.endsWith(`.${key}`)) {
      return domains;
    }
  }

  // Localhost/IP eşleşme
  if (hostname === "127.0.0.1" || hostname === "localhost") {
    return PROVIDER_ALLOWED_DOMAINS["127.0.0.1"] ?? null;
  }

  return null;
}

/**
 * Tüm webview'lara navigation guard ekler.
 * - will-navigate: Aynı pencerede açılan linkler
 * - setWindowOpenHandler: target="_blank" veya window.open() çağrıları
 */
function setupWebviewNavigationGuard(): void {
  app.on("web-contents-created", (_event, contents) => {
    // Sadece webview tipindeki webContents'lere uygula
    if (contents.getType() !== "webview") return;

    // will-navigate: Kullanıcı webview içinde bir linke tıkladığında
    contents.on("will-navigate", (event, url) => {
      const currentUrl = contents.getURL();
      if (!isUrlAllowedInWebview(url, currentUrl)) {
        event.preventDefault();
        void shell.openExternal(url);
        void logger.logInternal(
          LogCategory.WEBVIEW,
          LogLevel.INFO,
          "External link opened in browser",
          { url, currentUrl }
        );
      }
    });

    // setWindowOpenHandler: target="_blank" veya window.open()
    contents.setWindowOpenHandler(({ url }) => {
      const currentUrl = contents.getURL();
      if (!isUrlAllowedInWebview(url, currentUrl)) {
        void shell.openExternal(url);
        void logger.logInternal(
          LogCategory.WEBVIEW,
          LogLevel.INFO,
          "External popup opened in browser",
          { url, currentUrl }
        );
        return { action: "deny" };
      }
      // İzin verilen domain → popup olarak açılmasına izin ver
      return { action: "allow" };
    });
  });
}
