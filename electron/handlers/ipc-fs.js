import { dialog } from "electron";
import { fmTempPath, fmEnsureDirs, openPath } from "../file-manager.js";
import { registerHandler } from "./ipc-helpers.js";

export function setupFsHandlers(mainWindow) {
  registerHandler("fm-temp-path", fmTempPath);
  registerHandler("fm-ensure-dirs", fmEnsureDirs);
  registerHandler("open-path", async (event, path) => openPath(path));

  registerHandler("show-open-dialog", async (event, options = {}) => {
    const win = mainWindow || null;
    return await dialog.showOpenDialog(win, options || {});
  });
}
