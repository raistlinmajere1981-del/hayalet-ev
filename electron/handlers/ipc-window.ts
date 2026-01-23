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

export function setupWindowHandlers(): void {
  ipcMain.on("window-minimize", windowMinimize);
  ipcMain.on("window-close", windowClose);
  ipcMain.on("window-toggle-fullscreen", windowToggleFullscreen);
  ipcMain.on("window-minimize-to-tray", minimizeToTray);

  registerHandler("app-restart", appRestart);

  // Show Open Dialog - Folder selection
  registerHandler("show-open-dialog", async (_event, options?: Electron.OpenDialogOptions) => {
    // Get focused window or first window
    const focusedWindow = BrowserWindow.getFocusedWindow() || BrowserWindow.getAllWindows()[0];
    
    // Merge options with defaults
    const dialogOptions: Electron.OpenDialogOptions = {
      properties: options?.properties || ["openDirectory"],
      title: options?.title || "Klasör Seçin",
      buttonLabel: options?.buttonLabel || "Seç",
      defaultPath: options?.defaultPath,
    };
    
    console.log("[IPC] show-open-dialog options:", dialogOptions);
    
    const result = focusedWindow 
      ? await dialog.showOpenDialog(focusedWindow, dialogOptions)
      : await dialog.showOpenDialog(dialogOptions);
    
    console.log("[IPC] show-open-dialog result:", result);
    return result;
  });

  // Open terminal in specified directory
  registerHandler("open-terminal", async (_event, targetPath: string) => {
    const os = platform();
    let command: string;
    let args: string[];

    if (os === "darwin") {
      // macOS
      command = "open";
      args = ["-a", "Terminal", targetPath];
    } else if (os === "win32") {
      // Windows
      command = "cmd";
      args = ["/c", "start", "cmd", "/K", `cd /d "${targetPath}"`];
    } else {
      // Linux - use gnome-terminal or fallback
      command = "gnome-terminal";
      args = ["--working-directory=" + targetPath];
    }

    return new Promise((resolve, reject) => {
      const proc = spawn(command, args, {
        detached: true,
        stdio: "ignore",
        shell: os === "win32",
      });
      proc.unref();
      proc.on("error", reject);
      setTimeout(() => resolve({ success: true }), 100);
    });
  });

  // Open path in file manager
  registerHandler("shell-open-path", async (_event, path: string) => {
    return shell.openPath(path);
  });
}
