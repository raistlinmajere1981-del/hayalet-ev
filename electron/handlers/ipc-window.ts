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

const logger = getLoggerCore();

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
        await logger.logInternal(
          LogCategory.IPC,
          LogLevel.WARNING,
          "prepareRuntimeForWindowClose failed",
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

  registerHandler("app-restart", (_event, options?: { [key: string]: unknown }) => {
    return appRestart({
      forceFullRestart: options?.["forceFullRestart"] === true,
    });
  });

  registerHandler("show-open-dialog", async (_event, options?: Electron.OpenDialogOptions) => {
    const focusedWindow = BrowserWindow.getFocusedWindow() ?? BrowserWindow.getAllWindows()[0];

    const dialogOptions: Electron.OpenDialogOptions = {
      properties: options?.properties ?? ["openDirectory"],
      title: options?.title ?? "Klasör Seçin",
      buttonLabel: options?.buttonLabel ?? "Seç",
      ...(options?.defaultPath !== undefined && options.defaultPath.length > 0
        ? { defaultPath: options.defaultPath }
        : {}),
    };

    await logger.logInternal(LogCategory.IPC, LogLevel.DEBUG, "show-open-dialog called", {
      options: dialogOptions,
    });

    const result =
      focusedWindow !== undefined
        ? await dialog.showOpenDialog(focusedWindow, dialogOptions)
        : await dialog.showOpenDialog(dialogOptions);

    await logger.logInternal(LogCategory.IPC, LogLevel.DEBUG, "show-open-dialog result", {
      canceled: result.canceled,
      filePathsCount: result.filePaths.length,
    });
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
      // Linux - use gnome-terminal or fallback
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
