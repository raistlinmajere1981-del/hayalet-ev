import { createRequire } from "node:module";
import { dirname, join, resolve } from "path";
import { fileURLToPath } from "url";

const electronRequire = createRequire(import.meta.url);
const moduleDir = dirname(fileURLToPath(import.meta.url));
const defaultProjectRoot = resolve(moduleDir, "..");

function getElectronApp(): { isPackaged?: boolean; getPath?: (name: string) => string } | null {
  try {
    const electronModule: unknown = electronRequire("electron");
    if (electronModule === null || typeof electronModule !== "object") {
      return null;
    }

    const app = (
      electronModule as { app?: { isPackaged?: boolean; getPath?: (name: string) => string } }
    ).app;
    return app !== undefined && typeof app === "object" ? app : null;
  } catch {
    return null;
  }
}

function isPackagedMode(): boolean {
  return getElectronApp()?.isPackaged === true;
}

export function resolveProjectRoot(): string {
  const app = getElectronApp();
  if (isPackagedMode()) {
    const executablePath = app?.getPath?.("exe");
    return typeof executablePath === "string" && executablePath !== ""
      ? dirname(executablePath)
      : dirname(process.execPath);
  }

  return defaultProjectRoot;
}

export function resolveDataDir(): string {
  return join(resolveProjectRoot(), "data");
}

export function resolveConfigDir(): string {
  return join(resolveProjectRoot(), "config");
}

export function resolveAssetsDir(): string {
  return isPackagedMode()
    ? join(process.resourcesPath, "app.asar", "src", "assets")
    : join(resolveProjectRoot(), "src", "assets");
}

export function detectPackagedMode(): boolean {
  return isPackagedMode();
}
