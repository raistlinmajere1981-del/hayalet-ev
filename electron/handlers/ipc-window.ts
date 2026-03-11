import { ipcMain, dialog, shell, BrowserWindow } from "electron";
import {
  windowMinimize,
  windowClose,
  windowToggleFullscreen,
  minimizeToTray,
  appRestart,
} from "../window-manager.ts";
import { registerHandler } from "./ipc-helpers.ts";
import { spawn } from "child_process";
import { platform } from "os";
import { readFile, writeFile, mkdir } from "fs/promises";
import { join, dirname } from "path";
import { getLoggerCore } from "../logger/index.js";
import { LogCategory, LogLevel } from "@shared/index.js";
import { Paths } from "../paths.ts";
import { loadSettings } from "../settings-manager.ts";
import type { TranslationParams } from "../../src/types/i18n.ts";
import { DEFAULT_APP_LANGUAGE } from "../../src/types/i18n.ts";
import { loadAvailableLanguage } from "../i18n/language-service.ts";
import { translateCatalog } from "../../shared/i18n/catalog.js";
import { getBuiltInLanguagePack } from "../../shared/i18n/bundled-languages.js";
import { normalizeAppLanguage } from "../../shared/i18n/locale.js";

const logger = getLoggerCore();
const OPENCODE_INSTALL_URL = "https://opencode.ai/install";
const OPENCODE_RELEASES_API_URL = "https://api.github.com/repos/anomalyco/opencode/releases/latest";
const OPENCODE_RELEASES_PAGE_URL = "https://github.com/anomalyco/opencode/releases/latest";

async function translateElectronMessage(key: string, params?: TranslationParams): Promise<string> {
  let settings: { general?: { language?: unknown } };
  try {
    settings = ((await loadSettings()) ?? {}) as { general?: { language?: unknown } };
  } catch {
    settings = {};
  }

  const locale = normalizeAppLanguage(settings.general?.language);
  const fallbackPack = getBuiltInLanguagePack(DEFAULT_APP_LANGUAGE);
  const activePack = (await loadAvailableLanguage(locale)) ?? fallbackPack;
  const activeCatalog = activePack?.catalog ?? {};
  const fallbackCatalog = fallbackPack?.catalog;

  return translateCatalog(activeCatalog, key, params, fallbackCatalog);
}

async function ipcWindowT(key: string, params?: TranslationParams): Promise<string> {
  return await translateElectronMessage(`electron.ipcWindow.${key}`, params);
}

function normalizeVersion(version: string): string {
  return version.trim().replace(/^v/i, "");
}

function compareSemver(a: string, b: string): number {
  const aParts = normalizeVersion(a)
    .split(".")
    .map((part) => {
      const parsed = Number.parseInt(part.replace(/[^0-9].*$/, ""), 10);
      return Number.isNaN(parsed) ? 0 : parsed;
    });
  const bParts = normalizeVersion(b)
    .split(".")
    .map((part) => {
      const parsed = Number.parseInt(part.replace(/[^0-9].*$/, ""), 10);
      return Number.isNaN(parsed) ? 0 : parsed;
    });
  const maxLength = Math.max(aParts.length, bParts.length);

  for (let index = 0; index < maxLength; index += 1) {
    const aPart = aParts[index] ?? 0;
    const bPart = bParts[index] ?? 0;
    if (aPart > bPart) return 1;
    if (aPart < bPart) return -1;
  }

  return 0;
}

function getOpencodeInstallCommand(currentPlatform: string): string {
  if (currentPlatform === "win32") {
    return "npm install -g opencode-ai";
  }

  return "curl -fsSL https://opencode.ai/install | bash";
}

function escapeShellSingleQuotes(input: string): string {
  return input.replace(/'/g, "'\"'\"'");
}

function escapeAppleScriptString(input: string): string {
  return input.replace(/\\/g, "\\\\").replace(/"/g, '\\"');
}

async function spawnDetachedTerminal(
  command: string,
  args: string[],
  options: { shell?: boolean } = {}
): Promise<void> {
  await new Promise<void>((resolve, reject) => {
    const proc = spawn(command, args, {
      detached: true,
      stdio: "ignore",
      shell: options.shell === true,
    });

    let settled = false;
    proc.once("error", (error) => {
      if (settled) return;
      settled = true;
      reject(error);
    });
    proc.once("spawn", () => {
      if (settled) return;
      settled = true;
      proc.unref();
      resolve();
    });
  });
}

async function launchOpencodeInstallTerminal(
  currentPlatform: string,
  installCommand: string
): Promise<boolean> {
  if (currentPlatform === "darwin") {
    const script = [
      'tell application "Terminal"',
      "activate",
      `do script "${escapeAppleScriptString(installCommand)}"`,
      "end tell",
    ].join("\n");
    await spawnDetachedTerminal("osascript", ["-e", script]);
    return true;
  }

  if (currentPlatform === "win32") {
    await spawnDetachedTerminal("cmd", ["/c", "start", "cmd", "/K", installCommand], {
      shell: true,
    });
    return true;
  }

  const shellCommand = `${installCommand}; echo; exec bash`;
  const linuxLaunchers: Array<{ command: string; args: string[]; shell?: boolean }> = [
    {
      command: "gnome-terminal",
      args: ["--", "bash", "-lc", shellCommand],
    },
    {
      command: "konsole",
      args: ["-e", "bash", "-lc", shellCommand],
    },
    {
      command: "x-terminal-emulator",
      args: ["-e", "bash", "-lc", shellCommand],
    },
    {
      command: "xfce4-terminal",
      args: ["--command", `bash -lc '${escapeShellSingleQuotes(shellCommand)}'`],
    },
  ];

  const tryLauncherAt = async (index: number): Promise<boolean> => {
    const launcher = linuxLaunchers[index];
    if (launcher == null) {
      return false;
    }

    try {
      await spawnDetachedTerminal(launcher.command, launcher.args, {
        shell: launcher.shell === true,
      });
      return true;
    } catch {
      return await tryLauncherAt(index + 1);
    }
  };

  return await tryLauncherAt(0);
}

async function fetchLatestOpencodeVersion(): Promise<{
  latestVersion: string;
  releaseUrl: string;
}> {
  const response = await fetch(OPENCODE_RELEASES_API_URL, {
    headers: {
      Accept: "application/vnd.github+json",
      "User-Agent": "app-opencode-update-check",
    },
  });

  if (!response.ok) {
    throw new Error(await ipcWindowT("releaseCheckFailed", { status: String(response.status) }));
  }

  const payload = (await response.json()) as {
    html_url?: unknown;
    tag_name?: unknown;
    name?: unknown;
  };
  const tagName = typeof payload.tag_name === "string" ? payload.tag_name.trim() : "";
  const releaseName = typeof payload.name === "string" ? payload.name.trim() : "";
  const latestVersion = normalizeVersion(tagName !== "" ? tagName : releaseName);
  if (latestVersion === "") {
    throw new Error(await ipcWindowT("latestVersionParseFailed"));
  }

  return {
    latestVersion,
    releaseUrl:
      typeof payload.html_url === "string" && payload.html_url.trim() !== ""
        ? payload.html_url.trim()
        : OPENCODE_RELEASES_PAGE_URL,
  };
}

function getAssistantRuntimePath(): string {
  return join(Paths.getProjectRoot(), "data", "assistant-runtime.json");
}

function normalizeAssistantRuntime(input: unknown): {
  workflowSessionId: string;
  desiredMode: "terminal" | "soft" | "ghost-agent";
  phase: "idle" | "preparing-handoff" | "in-ghost" | "returning";
  updatedAt: string;
} {
  const fallback = {
    workflowSessionId: "",
    desiredMode: "soft" as const,
    phase: "idle" as const,
    updatedAt: new Date().toISOString(),
  };

  const data =
    typeof input === "object" && input !== null ? (input as Record<string, unknown>) : {};
  const desiredModeRaw =
    typeof data["desiredMode"] === "string" ? data["desiredMode"] : fallback.desiredMode;
  const phaseRaw = typeof data["phase"] === "string" ? data["phase"] : fallback.phase;

  const desiredMode =
    desiredModeRaw === "terminal" || desiredModeRaw === "soft" || desiredModeRaw === "ghost-agent"
      ? desiredModeRaw
      : fallback.desiredMode;

  const phase =
    phaseRaw === "idle" ||
    phaseRaw === "preparing-handoff" ||
    phaseRaw === "in-ghost" ||
    phaseRaw === "returning"
      ? phaseRaw
      : fallback.phase;

  return {
    workflowSessionId:
      typeof data["workflowSessionId"] === "string"
        ? data["workflowSessionId"]
        : fallback.workflowSessionId,
    desiredMode,
    phase,
    updatedAt: typeof data["updatedAt"] === "string" ? data["updatedAt"] : fallback.updatedAt,
  };
}

async function readAssistantRuntime(): Promise<{
  workflowSessionId: string;
  desiredMode: "terminal" | "soft" | "ghost-agent";
  phase: "idle" | "preparing-handoff" | "in-ghost" | "returning";
  updatedAt: string;
}> {
  try {
    const raw = await readFile(getAssistantRuntimePath(), "utf-8");
    const parsed = JSON.parse(raw) as unknown;
    return normalizeAssistantRuntime(parsed);
  } catch {
    return normalizeAssistantRuntime({});
  }
}

async function writeAssistantRuntime(value: unknown): Promise<{
  workflowSessionId: string;
  desiredMode: "terminal" | "soft" | "ghost-agent";
  phase: "idle" | "preparing-handoff" | "in-ghost" | "returning";
  updatedAt: string;
}> {
  const normalized = normalizeAssistantRuntime(value);
  await mkdir(dirname(getAssistantRuntimePath()), { recursive: true });
  await writeFile(getAssistantRuntimePath(), `${JSON.stringify(normalized, null, 2)}\n`, "utf-8");
  return normalized;
}

function isGhostHandoffState(state: {
  desiredMode: "terminal" | "soft" | "ghost-agent";
  phase: "idle" | "preparing-handoff" | "in-ghost" | "returning";
}): boolean {
  if (state.desiredMode !== "ghost-agent") return false;
  return state.phase === "preparing-handoff" || state.phase === "in-ghost";
}

async function prepareRuntimeForWindowClose(): Promise<void> {
  const current = await readAssistantRuntime();
  if (isGhostHandoffState(current)) {
    return;
  }

  await writeAssistantRuntime({
    ...current,
    desiredMode: "terminal",
    phase: "idle",
    updatedAt: new Date().toISOString(),
  });
}

export function setupWindowHandlers(): void {
  ipcMain.on("window-minimize", windowMinimize);
  ipcMain.on("window-close", (): void => {
    void (async (): Promise<void> => {
      try {
        await prepareRuntimeForWindowClose();
      } catch (error) {
        await logger.logInternalT(
          LogCategory.IPC,
          LogLevel.WARNING,
          "electron.ipcWindow.logs.prepareRuntimeForWindowCloseFailed",
          { message: error instanceof Error ? error.message : String(error) },
          {
            error: error instanceof Error ? error.message : String(error),
          }
        );
      } finally {
        windowClose();
      }
    })();
  });

  ipcMain.on("window-toggle-fullscreen", windowToggleFullscreen);
  ipcMain.on("window-minimize-to-tray", () => {
    void minimizeToTray();
  });

  registerHandler("app-restart", async (_event, options?: { [key: string]: unknown }) => {
    return await appRestart({
      forceFullRestart: options?.["forceFullRestart"] === true,
    });
  });

  registerHandler("show-open-dialog", async (_event, options?: Electron.OpenDialogOptions) => {
    const focusedWindow = BrowserWindow.getFocusedWindow() ?? BrowserWindow.getAllWindows()[0];
    const defaultTitle = await ipcWindowT("openDialogTitle");
    const defaultButtonLabel = await ipcWindowT("openDialogButtonLabel");

    const dialogOptions: Electron.OpenDialogOptions = {
      properties: options?.properties ?? ["openDirectory"],
      title: options?.title ?? defaultTitle,
      buttonLabel: options?.buttonLabel ?? defaultButtonLabel,
      ...(Array.isArray(options?.filters) ? { filters: options.filters } : {}),
      ...(options?.defaultPath !== undefined && options.defaultPath.length > 0
        ? { defaultPath: options.defaultPath }
        : {}),
    };

    await logger.logInternalT(
      LogCategory.IPC,
      LogLevel.DEBUG,
      "electron.ipcWindow.logs.showOpenDialogCalled",
      undefined,
      {
        options: dialogOptions,
      }
    );

    const result =
      focusedWindow !== undefined
        ? await dialog.showOpenDialog(focusedWindow, dialogOptions)
        : await dialog.showOpenDialog(dialogOptions);

    await logger.logInternalT(
      LogCategory.IPC,
      LogLevel.DEBUG,
      "electron.ipcWindow.logs.showOpenDialogResult",
      undefined,
      {
        canceled: result.canceled,
        filePathsCount: result.filePaths.length,
      }
    );
    return result;
  });

  registerHandler("open-terminal", async (_event, targetPath: string) => {
    const os = platform();
    let command: string;
    let args: string[];

    if (os === "darwin") {
      command = "open";
      args = ["-a", "Terminal", targetPath];
    } else if (os === "win32") {
      command = "cmd";
      args = ["/c", "start", "cmd", "/K", `cd /d "${targetPath}"`];
    } else {
      command = "gnome-terminal";
      args = ["--working-directory=" + targetPath];
    }

    return await new Promise((resolve, reject) => {
      const proc = spawn(command, args, {
        detached: true,
        stdio: "ignore",
        shell: os === "win32",
      });
      proc.unref();
      proc.on(LogLevel.ERROR, reject);
      setTimeout(() => {
        resolve({ success: true });
      }, 100);
    });
  });

  registerHandler("opencode-check-updates", async (_event, installedVersion: string) => {
    const normalizedInstalledVersion = normalizeVersion(installedVersion);
    if (normalizedInstalledVersion === "") {
      return {
        success: false,
        installedVersion: "",
        error: await ipcWindowT("installedOpencodeVersionMissing"),
        errorKey: "electron.ipcWindow.installedOpencodeVersionMissing",
      };
    }

    const { latestVersion, releaseUrl } = await fetchLatestOpencodeVersion();
    const updateAvailable = compareSemver(latestVersion, normalizedInstalledVersion) > 0;

    await logger.logInternalT(
      LogCategory.IPC,
      LogLevel.INFO,
      "electron.ipcWindow.logs.opencodeUpdateCheckCompleted",
      {
        installedVersion: normalizedInstalledVersion,
        latestVersion,
      },
      {
        installedVersion: normalizedInstalledVersion,
        latestVersion,
        updateAvailable,
        releaseUrl,
      }
    );

    return {
      success: true,
      installedVersion: normalizedInstalledVersion,
      latestVersion,
      updateAvailable,
      releaseUrl,
    };
  });

  registerHandler("opencode-launch-install", async () => {
    const currentPlatform = platform();
    const installCommand = getOpencodeInstallCommand(currentPlatform);
    const launched = await launchOpencodeInstallTerminal(currentPlatform, installCommand);

    if (!launched) {
      await shell.openExternal(OPENCODE_INSTALL_URL);
      await logger.logInternalT(
        LogCategory.IPC,
        LogLevel.WARNING,
        "electron.ipcWindow.logs.opencodeInstallFellBackToBrowser",
        undefined,
        {
          installUrl: OPENCODE_INSTALL_URL,
          command: installCommand,
        }
      );
      return {
        success: true,
        command: installCommand,
        installUrl: OPENCODE_INSTALL_URL,
        fallbackToBrowser: true,
      };
    }

    await logger.logInternalT(
      LogCategory.IPC,
      LogLevel.INFO,
      "electron.ipcWindow.logs.opencodeInstallTerminalLaunched",
      undefined,
      {
        installUrl: OPENCODE_INSTALL_URL,
        command: installCommand,
        platform: currentPlatform,
      }
    );

    return {
      success: true,
      command: installCommand,
      installUrl: OPENCODE_INSTALL_URL,
      fallbackToBrowser: false,
    };
  });

  registerHandler("assistant-runtime-read", async () => {
    const state = await readAssistantRuntime();
    return { success: true, state };
  });

  registerHandler("assistant-runtime-write", async (_event, payload: unknown) => {
    const current = await readAssistantRuntime();
    const next = normalizeAssistantRuntime({
      ...current,
      ...(typeof payload === "object" && payload !== null
        ? (payload as Record<string, unknown>)
        : {}),
      updatedAt: new Date().toISOString(),
    });
    const state = await writeAssistantRuntime(next);
    return { success: true, state };
  });

  registerHandler("shell-open-path", async (_event, path: string) => {
    return await shell.openPath(path);
  });
}
