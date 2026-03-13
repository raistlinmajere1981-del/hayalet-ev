import electron from "electron";
import { dirname, join } from "path";

const { app } = electron;

function isPackagedMode(): boolean {
  return app.isPackaged === true;
}

export function resolveProjectRoot(): string {
  if (isPackagedMode()) {
    return dirname(app.getPath("exe"));
  }

  // eslint-disable-next-line no-restricted-syntax
  return process.cwd();
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
