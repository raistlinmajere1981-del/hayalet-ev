import { join } from "path";
import { readFile, writeFile, mkdir } from "fs/promises";
import { existsSync } from "fs";
import type { IpcMainInvokeEvent } from "electron";
import { Paths } from "./paths.ts";
import { getLoggerCore } from "./logger/index.js";
import type { AppSettings } from "@shared/settings.js";
import { LogCategory, LogLevel } from "@shared/index.js";
import { createDefaultSettings } from "@shared/settings-defaults.js";

const logger = getLoggerCore();

function getConfigDir(): string {
  return Paths.getConfigDir();
}

function getSettingsPath(): string {
  return join(getConfigDir(), "settings.json");
}

export async function loadSettings(): Promise<AppSettings | null> {
  try {
    await mkdir(getConfigDir(), { recursive: true });

    if (existsSync(getSettingsPath())) {
      const data = await readFile(getSettingsPath(), "utf-8");
      const parsed = JSON.parse(data) as AppSettings;
      return parsed;
    }

    const defaults = createDefaultSettings();
    const jsonString = JSON.stringify(defaults, null, 2);
    await writeFile(getSettingsPath(), jsonString, { encoding: "utf-8", mode: 0o644 });
    await logger.logInternalT(
      LogCategory.SETTINGS,
      LogLevel.INFO,
      "electron.settings.createdDefaultFile",
      undefined,
      {
        settingsPath: getSettingsPath(),
      }
    );

    return defaults;
  } catch (error) {
    await logger.logInternalT(
      LogCategory.SETTINGS,
      LogLevel.ERROR,
      "electron.settings.loadFailed",
      { message: (error as Error).message },
      {
        settingsPath: getSettingsPath(),
        error: {
          name: (error as Error).name,
          message: (error as Error).message,
          stack: (error as Error).stack,
        },
      }
    );
    return null;
  }
}

export async function saveSettings(
  eventOrSettings: IpcMainInvokeEvent | object | null,
  maybeSettings?: object | null
): Promise<boolean> {
  try {
    const settings =
      typeof maybeSettings === "undefined" || maybeSettings === null
        ? (eventOrSettings as object)
        : maybeSettings;

    await mkdir(getConfigDir(), { recursive: true });

    const jsonString = JSON.stringify(settings, null, 2);
    await writeFile(getSettingsPath(), jsonString, { encoding: "utf-8", mode: 0o644 });

    return true;
  } catch (error) {
    await logger.logInternalT(
      LogCategory.SETTINGS,
      LogLevel.ERROR,
      "electron.settings.saveFailed",
      { message: (error as Error).message },
      {
        settingsPath: getSettingsPath(),
        error: {
          name: (error as Error).name,
          message: (error as Error).message,
          stack: (error as Error).stack,
        },
      }
    );
    return false;
  }
}
