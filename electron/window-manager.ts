import { BrowserWindow, session, Tray, Menu, nativeImage, app, shell, screen } from "electron";
import { getLoggerCore } from "./logger/index.js";
import { LogCategory, LogLevel } from "@shared/index.js";
import { PARTITIONS } from "@slots";
import { Paths } from "./paths.ts";
import { buildPreloadAdditionalArguments, type StartupFlags } from "./startup-flags.ts";
import type { TranslationParams } from "../src/types/i18n.ts";
import { readElectronAppLanguageSync, translateElectronMessage } from "./i18n/language-service.ts";
import { resolveAcceptLanguage } from "../shared/i18n/locale.js";

interface ExtendedWebPreferences extends Electron.WebPreferences {
  navigationTheme?: string;
}

const logger = getLoggerCore();

let _tray: Tray | null = null;
let _trayIconPath: string | null = null;
let _isMinimizedToTray: boolean = false;
let _mainWindow: BrowserWindow | null = null;

async function windowT(key: string, params?: TranslationParams): Promise<string> {
  return await translateElectronMessage(`electron.window.${key}`, params);
}

function resolveCorsAllowOrigin(isDev: boolean, referrer?: string): string {
  const fallbackOrigin = isDev ? "http://localhost:5174" : "null";
  if (referrer === undefined || referrer.length === 0) return fallbackOrigin;

  try {
    const origin = new URL(referrer).origin;
    const isAllowedOrigin =
      origin === "null" ||
      origin === "https://opencode.ai" ||
      origin === "http://localhost:5174" ||
      origin === "http://127.0.0.1:5174" ||
      /^http:\/\/127\.0\.0\.1:\d+$/.test(origin);
    return isAllowedOrigin ? origin : fallbackOrigin;
  } catch {
    return fallbackOrigin;
  }
}

function applyPreferredLanguageHeader(targetSession: Electron.Session): void {
  targetSession.webRequest.onBeforeSendHeaders((details, callback) => {
    const headers = details.requestHeaders;
    headers["Accept-Language"] = resolveAcceptLanguage(readElectronAppLanguageSync());
    callback({ requestHeaders: headers });
  });
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
    await logger.logInternalT(
      LogCategory.MAIN,
      LogLevel.ERROR,
      "electron.window.logs.mainWindowUnavailable"
    );
    return;
  }

  try {
    if (_tray === null) {
      createTrayInternal();
    }

    _isMinimizedToTray = true;
    _mainWindow.hide();
    await logger.logInternalT(
      LogCategory.MAIN,
      LogLevel.INFO,
      "electron.window.logs.minimizedToTray"
    );
  } catch (err) {
    await logger.logInternalT(
      LogCategory.MAIN,
      LogLevel.ERROR,
      "electron.window.logs.minimizeToTrayFailed",
      { message: (err as Error).message },
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
    void logger.logInternalT(
      LogCategory.MAIN,
      LogLevel.ERROR,
      "electron.window.logs.trayIconPathMissing"
    );
    return;
  }

  try {
    const icon = nativeImage.createFromPath(_trayIconPath);

    // NOTE: Log the resolved tray icon path because packaging issues often surface here first.
    void logger.logInternalT(
      LogCategory.MAIN,
      LogLevel.DEBUG,
      "electron.window.logs.creatingTrayIcon",
      undefined,
      {
        iconPath: _trayIconPath,
        iconSize: icon.getSize(),
      }
    );

    _tray = new Tray(icon.resize({ width: 22, height: 22 }));

    void updateTrayMenu();

    _tray.on("click", () => {
      void logger.logInternalT(
        LogCategory.MAIN,
        LogLevel.DEBUG,
        "electron.window.logs.trayClicked"
      );
      restoreFromTray();
    });

    _tray.on("double-click", () => {
      void logger.logInternalT(
        LogCategory.MAIN,
        LogLevel.DEBUG,
        "electron.window.logs.trayDoubleClicked"
      );
      restoreFromTray();
      _mainWindow?.maximize();
    });

    void logger.logInternalT(
      LogCategory.MAIN,
      LogLevel.INFO,
      "electron.window.logs.trayCreated",
      undefined,
      { iconPath: _trayIconPath }
    );
  } catch (err) {
    void logger.logInternalT(
      LogCategory.MAIN,
      LogLevel.ERROR,
      "electron.window.logs.trayCreationFailed",
      { message: (err as Error).message },
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

async function updateTrayMenu(): Promise<void> {
  if (_tray === null) return;

  const [showLabel, fullscreenLabel, quitLabel, tooltip] = await Promise.all([
    windowT("trayShow"),
    windowT("trayFullscreen"),
    windowT("trayQuit"),
    translateElectronMessage("app.documentTitle"),
  ]);

  const contextMenu = Menu.buildFromTemplate([
    {
      label: showLabel,
      click: (): void => {
        restoreFromTray();
      },
    },
    {
      label: fullscreenLabel,
      click: (): void => {
        restoreFromTray();
        if (_mainWindow !== null) {
          _mainWindow.setFullScreen(!_mainWindow.isFullScreen());
        }
      },
    },
    { type: "separator" },
    {
      label: quitLabel,
      click: (): void => {
        _mainWindow?.destroy();
        app.quit();
      },
    },
  ]);

  _tray.setToolTip(tooltip);
  _tray.setContextMenu(contextMenu);
}

function restoreFromTray(): void {
  if (!_isMinimizedToTray) return;

  _isMinimizedToTray = false;

  if (_mainWindow !== null) {
    _mainWindow.show();
    _mainWindow.focus();
    void logger.logInternalT(
      LogCategory.MAIN,
      LogLevel.INFO,
      "electron.window.logs.restoredFromTray"
    );
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

    // NOTE: Local helper services need explicit CORS headers because they are called from isolated webviews.
    const url = details.url;
    if (url.includes("127.0.0.1:") && /:\d{4,5}\//.test(url)) {
      const referrer = (details as { referrer?: string }).referrer;
      responseHeaders["Access-Control-Allow-Origin"] = [resolveCorsAllowOrigin(isDev, referrer)];
      responseHeaders["Access-Control-Allow-Methods"] = ["GET, POST, PUT, PATCH, DELETE, OPTIONS"];
      responseHeaders["Access-Control-Allow-Headers"] = ["Content-Type"];
    }

    callback({ responseHeaders });
  });

  const mainWebviewSession = session.fromPartition(PARTITIONS.MAIN);
  const assistantSession = session.fromPartition(PARTITIONS.ASSISTANT);

  applyPreferredLanguageHeader(mainWebviewSession);
  applyPreferredLanguageHeader(assistantSession);

  // NOTE: The assistant webview needs broader connect-src rules for OpenCode changelog fetches and local helper services.
  assistantSession.webRequest.onHeadersReceived((details, callback) => {
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

    // NOTE: Mirror the local-service CORS override for the assistant partition.
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
    void win.loadURL("http://localhost:5174");
  } else {
    void win.loadFile(Paths.getHtmlEntryPath());
  }

  // WARNING: Install the webview navigation guard before any provider content starts navigating.
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
    void logger.logInternalT(
      LogCategory.MAIN,
      LogLevel.WARNING,
      "electron.window.logs.minimizeFailed",
      { message: err instanceof Error ? err.message : String(err) },
      {
        error: err instanceof Error ? err.message : String(err),
      }
    );
  }
}

export function windowClose(): void {
  try {
    _mainWindow?.close();
  } catch (err) {
    void logger.logInternalT(
      LogCategory.MAIN,
      LogLevel.WARNING,
      "electron.window.logs.closeFailed",
      { message: err instanceof Error ? err.message : String(err) },
      {
        error: err instanceof Error ? err.message : String(err),
      }
    );
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
      void logger.logInternalT(
        LogCategory.MAIN,
        LogLevel.INFO,
        "electron.window.logs.exitedFullscreen",
        undefined,
        {
          bounds: _mainWindow.getBounds(),
        }
      );
      return;
    }
    _mainWindow.setResizable(true);
    _mainWindow.setFullScreen(true);
    void logger.logInternalT(
      LogCategory.MAIN,
      LogLevel.INFO,
      "electron.window.logs.enteredFullscreen",
      undefined,
      {
        bounds: _mainWindow.getBounds(),
      }
    );
  } catch (err) {
    void logger.logInternalT(
      LogCategory.MAIN,
      LogLevel.WARNING,
      "electron.window.logs.toggleFullscreenFailed",
      { message: err instanceof Error ? err.message : String(err) },
      {
        error: err instanceof Error ? err.message : String(err),
      }
    );
  }
}

interface AppRestartOptions {
  forceFullRestart?: boolean;
}

export async function appRestart(options: AppRestartOptions = {}): Promise<{
  success: boolean;
  message?: string;
}> {
  try {
    if (!app.isPackaged && options.forceFullRestart !== true) {
      if (_mainWindow !== null) {
        _mainWindow.reload();
        return {
          success: true,
          message: await windowT("devPageReloaded"),
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

const PROVIDER_ALLOWED_DOMAINS: Record<string, string[]> = {
  "chatgpt.com": ["chatgpt.com", "auth.openai.com", "auth0.openai.com", "openai.com"],
  "gemini.google.com": ["gemini.google.com", "accounts.google.com", "myaccount.google.com"],
  "grok.com": ["grok.com", "x.ai", "accounts.x.ai"],
  "127.0.0.1": ["127.0.0.1", "localhost"],
  localhost: ["127.0.0.1", "localhost"],
};

function isUrlAllowedInWebview(targetUrl: string, currentUrl: string): boolean {
  let target: URL;
  try {
    target = new URL(targetUrl);
  } catch {
    // NOTE: Ignore malformed targets instead of blocking navigation entirely.
    return true;
  }

  // NOTE: Non-http(s) schemes stay allowed so built-in Electron pages are not blocked.
  if (target.protocol !== "http:" && target.protocol !== "https:") {
    return true;
  }

  let providerHostname: string;
  try {
    providerHostname = new URL(currentUrl).hostname;
  } catch {
    // NOTE: Skip enforcement when the current provider URL is unavailable.
    return true;
  }

  const allowedDomains = findAllowedDomains(providerHostname);
  if (allowedDomains === null) {
    // NOTE: Unknown providers fall back to permissive navigation.
    return true;
  }

  const targetHostname = target.hostname;

  return allowedDomains.some((domain) => {
    return targetHostname === domain || targetHostname.endsWith(`.${domain}`);
  });
}

function findAllowedDomains(hostname: string): string[] | null {
  for (const [key, domains] of Object.entries(PROVIDER_ALLOWED_DOMAINS)) {
    if (hostname === key || hostname.endsWith(`.${key}`)) {
      return domains;
    }
  }

  if (hostname === "127.0.0.1" || hostname === "localhost") {
    return PROVIDER_ALLOWED_DOMAINS["127.0.0.1"] ?? null;
  }

  return null;
}

function setupWebviewNavigationGuard(): void {
  app.on("web-contents-created", (_event, contents) => {
    if (contents.getType() !== "webview") return;

    contents.on("will-navigate", (event, url) => {
      const currentUrl = contents.getURL();
      if (!isUrlAllowedInWebview(url, currentUrl)) {
        event.preventDefault();
        void shell.openExternal(url);
        void logger.logInternalT(
          LogCategory.WEBVIEW,
          LogLevel.INFO,
          "electron.window.logs.externalLinkOpened",
          undefined,
          { url, currentUrl }
        );
      }
    });

    contents.setWindowOpenHandler(({ url }) => {
      const currentUrl = contents.getURL();
      if (!isUrlAllowedInWebview(url, currentUrl)) {
        void shell.openExternal(url);
        void logger.logInternalT(
          LogCategory.WEBVIEW,
          LogLevel.INFO,
          "electron.window.logs.externalPopupOpened",
          undefined,
          { url, currentUrl }
        );
        return { action: "deny" };
      }
      return { action: "allow" };
    });
  });
}
