import { ipcMain } from "electron";
import {
  windowMinimize,
  windowClose,
  windowToggleFullscreen,
  minimizeToTray,
  appRestart,
} from "../window-manager.ts";
import { registerHandler } from "./ipc-helpers.ts";

export function setupWindowHandlers(): void {
  ipcMain.on("window-minimize", windowMinimize);
  ipcMain.on("window-close", windowClose);
  ipcMain.on("window-toggle-fullscreen", windowToggleFullscreen);
  ipcMain.on("window-minimize-to-tray", minimizeToTray);

  registerHandler("app-restart", appRestart);
}
