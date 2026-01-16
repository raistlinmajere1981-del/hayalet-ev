import { ipcMain, app as _app } from "electron";
import {
  windowMinimize,
  windowClose,
  windowToggleFullscreen,
  minimizeToTray,
  appRestart,
} from "../window-manager.js";
import { registerHandler } from "./ipc-helpers.js";

export function setupWindowHandlers() {
  ipcMain.on("window-minimize", windowMinimize);
  ipcMain.on("window-close", windowClose);
  ipcMain.on("window-toggle-fullscreen", windowToggleFullscreen);
  ipcMain.on("window-minimize-to-tray", minimizeToTray);

  registerHandler("app-restart", appRestart);
}
