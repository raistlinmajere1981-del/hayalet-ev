import { dialog, BrowserWindow } from "electron";
import { fmTempPath, fmEnsureDirs, openPath } from "../file-manager.ts";
import { registerHandler } from "./ipc-helpers.ts";

export function setupFsHandlers(mainWindow: BrowserWindow | null): void {
  registerHandler("fm-temp-path", (event, prefix, ext) => fmTempPath(event, prefix as string, ext as string));
  registerHandler("fm-ensure-dirs", fmEnsureDirs);
  registerHandler("open-path", async (_event, path) => openPath(path as string));

  registerHandler("show-open-dialog", async (event, options = {}) => {
    const win = mainWindow || null;
    return await dialog.showOpenDialog(win, options || {});
  });
}
