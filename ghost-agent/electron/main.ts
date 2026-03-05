import { app, BrowserWindow, dialog, ipcMain } from "electron";
import { mkdir, readFile, writeFile } from "fs/promises";
import { existsSync } from "fs";
import { dirname, join } from "path";
import { fileURLToPath } from "url";
import {
  buildRuntimePatchForGhostExit,
  isGhostExitAction,
  shouldStopSystemActiveServersOnGhostExit,
} from "./ghost-exit-actions.ts";
import { opencodeServerManager } from "./opencode-server-manager.ts";
import { initGhostLogger, logGhost, shutdownGhostLogger } from "./logger.ts";

const GHOST_EXIT_WAIT_MS = 500;

type GhostProvider = "opencode";

const GHOST_PROVIDERS: GhostProvider[] = ["opencode"];

type GhostLaunchTarget = {
  provider: GhostProvider;
  targetUrl: string;
  details: string;
};

type GhostServerConnectRequest = {
  provider: GhostProvider;
  autoStart?: boolean;
};

type GhostProviderServerState = {
  provider: GhostProvider;
  running: boolean;
  port?: number;
  url?: string;
  alreadyRunning?: boolean;
  source?: "existing" | "started";
};

type JsonRecord = Record<string, unknown>;

type AssistantRuntimeControl = {
  workflowSessionId: string;
  desiredMode: "terminal" | "soft" | "ghost-agent";
  phase: "idle" | "preparing-handoff" | "in-ghost" | "returning";
  updatedAt: string;
};

const OPENCODE_DEFAULT_URL = process.env["OPENCODE_DEFAULT_URL"] ?? "https://opencode.ai";
const moduleFilename = fileURLToPath(import.meta.url);
const moduleDirname = dirname(moduleFilename);

const GHOST_DEV_SERVER_URL = process.env["GHOST_DEV_SERVER_URL"];

const CDP_PORT = process.env["CDP_PORT"] ?? 9222;
app.commandLine.appendSwitch("remote-debugging-port", CDP_PORT.toString());

let mainWindow: BrowserWindow | null = null;

function getProjectRoot(): string {
  return process.cwd();
}

function getSettingsPath(): string {
  return join(getProjectRoot(), "config", "settings.json");
}

function getAssistantRuntimePath(): string {
  return join(getProjectRoot(), "data", "assistant-runtime.json");
}

function getRendererPath(fileName: string): string {
  return join(getProjectRoot(), "dist", "ghost-agent", "renderer", fileName);
}

function isRecord(value: unknown): value is JsonRecord {
  return typeof value === "object" && value !== null;
}

function asString(value: unknown, fallback = ""): string {
  return typeof value === "string" ? value : fallback;
}

function normalizeGhostProvider(
  _value: unknown,
  fallback: GhostProvider = "opencode"
): GhostProvider {
  return fallback;
}

function getDefaultProviderServerUrl(port?: number): string {
  return `http://127.0.0.1:${String(port ?? 4096)}`;
}

function normalizeAssistantRuntimeControl(
  raw: unknown,
  now: string = new Date().toISOString()
): AssistantRuntimeControl {
  const fallback: AssistantRuntimeControl = {
    workflowSessionId: "",
    desiredMode: "soft",
    phase: "idle",
    updatedAt: now,
  };

  const value = isRecord(raw) ? raw : {};
  const desiredModeRaw = asString(value["desiredMode"], fallback.desiredMode);
  const desiredMode: AssistantRuntimeControl["desiredMode"] =
    desiredModeRaw === "terminal" || desiredModeRaw === "soft" || desiredModeRaw === "ghost-agent"
      ? desiredModeRaw
      : fallback.desiredMode;

  const phaseRaw = asString(value["phase"], fallback.phase);
  const phase: AssistantRuntimeControl["phase"] =
    phaseRaw === "idle" ||
    phaseRaw === "preparing-handoff" ||
    phaseRaw === "in-ghost" ||
    phaseRaw === "returning"
      ? phaseRaw
      : fallback.phase;

  return {
    workflowSessionId: asString(value["workflowSessionId"], fallback.workflowSessionId),
    desiredMode,
    phase,
    updatedAt: asString(value["updatedAt"], fallback.updatedAt),
  };
}

async function readAssistantRuntimeControl(): Promise<AssistantRuntimeControl> {
  try {
    const raw = await readFile(getAssistantRuntimePath(), "utf-8");
    return normalizeAssistantRuntimeControl(JSON.parse(raw));
  } catch {
    return normalizeAssistantRuntimeControl({});
  }
}

async function writeAssistantRuntimeControl(
  control: AssistantRuntimeControl
): Promise<AssistantRuntimeControl> {
  const runtimePath = getAssistantRuntimePath();
  await mkdir(dirname(runtimePath), { recursive: true });
  const normalized = normalizeAssistantRuntimeControl(control);
  await writeFile(runtimePath, `${JSON.stringify(normalized, null, 2)}\n`, "utf-8");
  return normalized;
}

async function loadSettingsSnapshot(): Promise<JsonRecord> {
  const settingsPath = getSettingsPath();
  if (!existsSync(settingsPath)) {
    return {};
  }

  try {
    const raw = await readFile(settingsPath, "utf-8");
    const parsed: unknown = JSON.parse(raw);
    return isRecord(parsed) ? parsed : {};
  } catch {
    return {};
  }
}

async function saveSettingsSnapshot(settings: JsonRecord): Promise<void> {
  const settingsPath = getSettingsPath();
  await mkdir(dirname(settingsPath), { recursive: true });
  await writeFile(settingsPath, `${JSON.stringify(settings, null, 2)}\n`, "utf-8");
}

async function persistPreferredProvider(provider: GhostProvider): Promise<void> {
  const settings = await loadSettingsSnapshot();
  const assistantsRaw = settings["assistants"];
  const assistants: JsonRecord = isRecord(assistantsRaw) ? { ...assistantsRaw } : {};
  assistants["preferred"] = provider;
  await saveSettingsSnapshot({ ...settings, assistants });
}

async function detectProviderServer(provider: GhostProvider): Promise<GhostProviderServerState> {
  const running = await opencodeServerManager.findRunningServer(4096, 4110);
  const url =
    typeof running.url === "string" && running.url !== ""
      ? running.url
      : typeof running.port === "number"
        ? getDefaultProviderServerUrl(running.port)
        : undefined;

  return {
    provider,
    running: running.running === true,
    ...(typeof running.port === "number" ? { port: running.port } : {}),
    ...(url !== undefined ? { url } : {}),
    ...(running.running === true ? { alreadyRunning: true, source: "existing" as const } : {}),
  };
}

async function startProviderServer(provider: GhostProvider): Promise<GhostProviderServerState> {
  const started = await opencodeServerManager.start({
    cors: ["http://localhost:5173"],
  });
  const source = started.alreadyRunning === true ? "existing" : "started";
  const url =
    typeof started.url === "string" && started.url !== ""
      ? started.url
      : getDefaultProviderServerUrl(started.port);

  return {
    provider,
    running: started.running === true,
    ...(typeof started.port === "number" ? { port: started.port } : {}),
    ...(url !== "" ? { url } : {}),
    ...(started.alreadyRunning === true ? { alreadyRunning: true } : {}),
    source,
  };
}

async function stopProviderServer(_provider: GhostProvider): Promise<void> {
  await opencodeServerManager.stop();
}

async function stopSystemActiveProviderServers(): Promise<void> {
  const stopTasks = GHOST_PROVIDERS.map(async (provider) => {
    const server = await detectProviderServer(provider);
    if (server.running !== true) {
      return;
    }

    try {
      await stopProviderServer(provider);
      await logGhost("info", "Ghost exit stopped active provider server", {
        provider,
        port: server.port,
      });
    } catch (error) {
      await logGhost("warn", "Ghost exit provider stop failed", {
        provider,
        error: (error as Error).message,
      });
    }
  });

  await Promise.all(stopTasks);
}

async function waitForProviderReady(baseUrl: string, timeoutMs = 90000): Promise<boolean> {
  const startedAt = Date.now();
  const normalizedBase = baseUrl.replace(/\/$/, "");
  const healthUrl = `${normalizedBase}/global/health`;

  const poll = async (): Promise<boolean> => {
    if (Date.now() - startedAt >= timeoutMs) {
      return false;
    }

    const health = await opencodeServerManager.checkHealth(healthUrl);

    if (health.success) {
      return true;
    }

    await new Promise<void>((resolve) => {
      setTimeout(resolve, GHOST_EXIT_WAIT_MS);
    });

    return await poll();
  };

  return await poll();
}

function buildLaunchTargetForProvider(
  provider: GhostProvider,
  server: GhostProviderServerState
): GhostLaunchTarget {
  const serverUrl =
    typeof server.url === "string" && server.url !== ""
      ? server.url
      : getDefaultProviderServerUrl(server.port);

  return {
    provider,
    targetUrl: serverUrl.endsWith("/") ? serverUrl : `${serverUrl}/`,
    details: `port:${String(server.port ?? 4096)} source:${server.source ?? "existing"}`,
  };
}

async function connectProviderServer(request: GhostServerConnectRequest): Promise<{
  success: boolean;
  target?: GhostLaunchTarget;
  server?: GhostProviderServerState;
  error?: string;
}> {
  let server = await detectProviderServer(request.provider);

  if (!server.running && request.autoStart !== false) {
    server = await startProviderServer(request.provider);
  }

  if (!server.running) {
    return {
      success: false,
      error: `${request.provider} server is not running`,
    };
  }

  const serverUrl =
    typeof server.url === "string" && server.url !== ""
      ? server.url
      : getDefaultProviderServerUrl(server.port);

  const ready = await waitForProviderReady(serverUrl);
  if (!ready) {
    return {
      success: false,
      error: `${request.provider} server ready timeout`,
    };
  }

  const normalizedServer: GhostProviderServerState = {
    ...server,
    url: serverUrl,
  };

  const target = buildLaunchTargetForProvider(request.provider, normalizedServer);
  return { success: true, target, server: normalizedServer };
}

async function resolveTargetFromSettings(): Promise<GhostLaunchTarget> {
  const settings = await loadSettingsSnapshot();
  const assistantsRaw = settings["assistants"];
  const assistants: JsonRecord = isRecord(assistantsRaw) ? assistantsRaw : {};

  const savedUrl = asString(assistants["lastOpencodeUrl"], "").trim();
  const targetUrl = savedUrl !== "" ? savedUrl : OPENCODE_DEFAULT_URL;

  return {
    provider: "opencode",
    targetUrl,
    details: savedUrl !== "" ? "source:settings" : "source:default",
  };
}

function setupIpcHandlers(): void {
  ipcMain.handle("ghost-bootstrap", async () => {
    try {
      const target = await resolveTargetFromSettings();
      await logGhost("info", "ghost-bootstrap resolved target", {
        provider: target.provider,
        details: target.details,
      });
      return { success: true, target };
    } catch (error) {
      await logGhost("error", "ghost-bootstrap failed", {
        error: (error as Error).message,
      });
      return { success: false, error: (error as Error).message };
    }
  });

  ipcMain.handle("ghost-provider-detect", async (_event, providerRaw: unknown) => {
    try {
      const provider = normalizeGhostProvider(providerRaw);
      const server = await detectProviderServer(provider);
      await logGhost("debug", "ghost-provider-detect completed", {
        provider,
        running: server.running,
        port: server.port,
      });
      return { success: true, provider, server };
    } catch (error) {
      await logGhost("error", "ghost-provider-detect failed", {
        providerRaw,
        error: (error as Error).message,
      });
      return { success: false, error: (error as Error).message };
    }
  });

  ipcMain.handle("ghost-provider-connect", async (_event, payload: unknown) => {
    try {
      const value = isRecord(payload) ? payload : {};
      const provider = normalizeGhostProvider(value["provider"]);
      const autoStart = value["autoStart"] !== false;
      const result = await connectProviderServer({ provider, autoStart });
      if (result.success) {
        await persistPreferredProvider(provider);
        await logGhost("info", "ghost-provider-connect succeeded", {
          provider,
          autoStart,
          port: result.server?.port,
          source: result.server?.source,
        });
      } else {
        await logGhost("warn", "ghost-provider-connect returned unsuccessful result", {
          provider,
          autoStart,
          error: result.error,
        });
      }
      return result;
    } catch (error) {
      await logGhost("error", "ghost-provider-connect failed", {
        payload,
        error: (error as Error).message,
      });
      return { success: false, error: (error as Error).message };
    }
  });

  ipcMain.handle("ghost-provider-stop", async (_event, providerRaw: unknown) => {
    try {
      const provider = normalizeGhostProvider(providerRaw);
      await stopProviderServer(provider);
      const server = await detectProviderServer(provider);
      await logGhost("info", "ghost-provider-stop completed", {
        provider,
        running: server.running,
      });
      return { success: true, provider, server };
    } catch (error) {
      await logGhost("error", "ghost-provider-stop failed", {
        providerRaw,
        error: (error as Error).message,
      });
      return { success: false, error: (error as Error).message };
    }
  });

  ipcMain.handle(
    "ghost-log",
    async (
      _event,
      payload: {
        level?: "debug" | "info" | "warn" | "error";
        message?: string;
        context?: Record<string, unknown>;
      }
    ) => {
      try {
        const level =
          payload.level === "debug" ||
          payload.level === "info" ||
          payload.level === "warn" ||
          payload.level === "error"
            ? payload.level
            : "info";
        const message = typeof payload.message === "string" ? payload.message : "renderer log";
        const context = isRecord(payload.context) ? payload.context : undefined;
        await logGhost(level, message, context);
        return { success: true };
      } catch (error) {
        return { success: false, error: (error as Error).message };
      }
    }
  );

  ipcMain.handle("ghost-provider-set-preferred", async (_event, providerRaw: unknown) => {
    try {
      const provider = normalizeGhostProvider(providerRaw);
      await persistPreferredProvider(provider);
      await logGhost("info", "ghost-provider-set-preferred completed", { provider });
      return { success: true, provider };
    } catch (error) {
      await logGhost("error", "ghost-provider-set-preferred failed", {
        providerRaw,
        error: (error as Error).message,
      });
      return { success: false, error: (error as Error).message };
    }
  });

  ipcMain.handle("ghost-open-target", async (_event, target: GhostLaunchTarget) => {
    if (mainWindow === null) {
      await logGhost("error", "ghost-open-target failed: main window unavailable", {
        provider: target.provider,
        targetUrl: target.targetUrl,
      });
      return { success: false, error: "Main window unavailable" };
    }

    try {
      await mainWindow.loadURL(target.targetUrl);
      await logGhost("info", "ghost-open-target loaded URL", {
        provider: target.provider,
        targetUrl: target.targetUrl,
      });
      return { success: true };
    } catch (error) {
      await logGhost("error", "ghost-open-target loadURL failed", {
        provider: target.provider,
        targetUrl: target.targetUrl,
        error: (error as Error).message,
      });
      return { success: false, error: (error as Error).message };
    }
  });

  ipcMain.handle("ghost-exit-action", async (_event, action: unknown) => {
    if (!isGhostExitAction(action)) {
      await logGhost("warn", "ghost-exit-action rejected invalid action", { action });
      return { success: false, error: "Invalid ghost exit action" };
    }

    try {
      if (shouldStopSystemActiveServersOnGhostExit(action)) {
        await stopSystemActiveProviderServers();
      }

      const runtimeState = await readAssistantRuntimeControl();
      const runtimePatch = buildRuntimePatchForGhostExit(action);
      const nextState = await writeAssistantRuntimeControl({
        ...runtimeState,
        ...runtimePatch,
        updatedAt: new Date().toISOString(),
      });

      await logGhost("info", "ghost-exit-action applied runtime patch", {
        action,
        desiredMode: nextState.desiredMode,
        phase: nextState.phase,
      });

      if (mainWindow !== null && !mainWindow.isDestroyed()) {
        mainWindow.close();
      } else {
        app.quit();
      }

      return { success: true, state: nextState };
    } catch (error) {
      await logGhost("error", "ghost-exit-action failed", {
        action,
        error: (error as Error).message,
      });
      return { success: false, error: (error as Error).message };
    }
  });

  ipcMain.handle("show-open-dialog", async (_event, options: Electron.OpenDialogOptions) => {
    if (mainWindow === null) {
      return { canceled: true, filePaths: [] };
    }
    return await dialog.showOpenDialog(mainWindow, options);
  });

  ipcMain.handle("fm-temp-path", async (_event, prefix: string = "tmp", ext: string = "tmp") => {
    try {
      const tempDir = join(getProjectRoot(), "tmp");
      await mkdir(tempDir, { recursive: true });
      const stamp = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
      const safePrefix = prefix.trim() !== "" ? prefix : "tmp";
      const safeExt = ext.trim() !== "" ? ext : "tmp";
      return { success: true, path: join(tempDir, `${safePrefix}-${stamp}.${safeExt}`) };
    } catch (error) {
      return { success: false, message: (error as Error).message };
    }
  });

  ipcMain.handle(
    "fm-write-file-atomic",
    async (
      _event,
      payload: { path: string; data: string; encoding?: BufferEncoding | "base64" }
    ) => {
      try {
        const encoding = payload.encoding === "base64" ? "base64" : "utf-8";
        await mkdir(dirname(payload.path), { recursive: true });
        await writeFile(payload.path, payload.data, { encoding });
        return { success: true };
      } catch (error) {
        return { success: false, message: (error as Error).message };
      }
    }
  );
}

function createWindow(): BrowserWindow {
  const window = new BrowserWindow({
    width: 1400,
    height: 900,
    show: false,
    backgroundColor: "#070b12",
    autoHideMenuBar: true,
    title: "Ghost Agent Handoff",
    webPreferences: {
      preload: join(moduleDirname, "preload.cjs"),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
      spellcheck: false,
      webviewTag: true,
    },
  });

  window.once("ready-to-show", () => {
    window.show();
  });

  return window;
}

const hasLock = app.requestSingleInstanceLock();
if (!hasLock) {
  app.quit();
} else {
  app.on("second-instance", () => {
    if (mainWindow !== null) {
      if (mainWindow.isMinimized()) mainWindow.restore();
      mainWindow.focus();
    }
  });

  void app.whenReady().then(async () => {
    await initGhostLogger();
    setupIpcHandlers();
    mainWindow = createWindow();

    if (GHOST_DEV_SERVER_URL !== undefined && GHOST_DEV_SERVER_URL !== "") {
      await mainWindow.loadURL(`${GHOST_DEV_SERVER_URL.replace(/\/$/, "")}/renderer/index.html`);
    } else {
      await mainWindow.loadFile(getRendererPath("index.html"));
    }
  });
}

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    void shutdownGhostLogger();
    app.quit();
  }
});

app.on("before-quit", () => {
  void shutdownGhostLogger();
});

app.on("activate", () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    mainWindow = createWindow();
  }
});
