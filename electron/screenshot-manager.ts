import { dirname } from "path";
import { writeFile, mkdir } from "fs/promises";
import { existsSync } from "fs";
import type { IpcMainInvokeEvent } from "electron";
import { nativeImage, BrowserWindow } from "electron";
import screenshot from "screenshot-desktop";
import { loadSettings } from "./settings-manager.ts";
import type { TranslationParams } from "../src/types/i18n.ts";
import { DEFAULT_APP_LANGUAGE } from "../src/types/i18n.ts";
import { loadAvailableLanguage } from "./i18n/language-service.ts";
import { translateCatalog } from "../shared/i18n/catalog.js";
import { getBuiltInLanguagePack } from "../shared/i18n/bundled-languages.js";
import { normalizeAppLanguage } from "../shared/i18n/locale.js";

interface CaptureResult {
  success: boolean;
  dataUrl?: string;
  path?: string | null;
  message?: string;
}

async function translateElectronMessage(key: string, params?: TranslationParams): Promise<string> {
  let settings: { general?: { language?: unknown } } = {};
  try {
    settings = ((await loadSettings()) ?? {}) as { general?: { language?: unknown } };
  } catch {
    settings = {};
  }

  const locale = normalizeAppLanguage(settings.general?.language);
  const activePack =
    (await loadAvailableLanguage(locale)) ?? getBuiltInLanguagePack(DEFAULT_APP_LANGUAGE)!;
  const fallbackCatalog = getBuiltInLanguagePack(DEFAULT_APP_LANGUAGE)?.catalog;

  return translateCatalog(activePack.catalog, key, params, fallbackCatalog);
}

async function screenshotT(key: string, params?: TranslationParams): Promise<string> {
  return await translateElectronMessage(`electron.screenshot.${key}`, params);
}

export async function capturePageHandler(
  event: IpcMainInvokeEvent,
  _type: string = "full",
  region: string = ""
): Promise<CaptureResult> {
  try {
    const win = BrowserWindow.fromWebContents(event.sender) ?? BrowserWindow.getAllWindows()[0];
    if (win === undefined) throw new Error(await screenshotT("windowNotFound"));
    const bounds = win.getBounds();
    let rect = { x: 0, y: 0, width: bounds.width, height: bounds.height };
    if (region.length > 0) {
      const match = region.match(/(\d+)[;,](\d+)[: ](\d+)[;,](\d+)/);
      if (match !== null) {
        const nums = match.slice(1).map(Number);
        rect = { x: nums[0] ?? 0, y: nums[1] ?? 0, width: nums[2] ?? 0, height: nums[3] ?? 0 };
      }
    }
    const img = await win.capturePage(rect);
    const dataUrl = img.toDataURL();
    return { success: true, dataUrl };
  } catch (error) {
    return { success: false, message: (error as Error).message };
  }
}

interface ScreenshotOptions {
  region?: string;
  hideCursor?: boolean;
  filePath?: string;
  format?: string;
}

export async function screenshotCaptureHandler(
  _event: IpcMainInvokeEvent | null,
  options: ScreenshotOptions = {}
): Promise<CaptureResult> {
  const { region = "", hideCursor: _hideCursor = false, filePath = "", format = "png" } = options;
  try {
    const formatLower = format.toLowerCase();
    const useJpg = formatLower === "jpg" || formatLower === "jpeg";
    const buffer = await screenshot({ format: useJpg ? "jpg" : "png" } as Parameters<
      typeof screenshot
    >[0]);
    let img = nativeImage.createFromBuffer(Buffer.from(buffer));
    if (region.length > 0) {
      const match = region.match(/(\d+)[;,](\d+)[: ](\d+)[;,](\d+)/);
      if (match !== null) {
        const nums = match.slice(1).map(Number);
        img = img.crop({
          x: nums[0] ?? 0,
          y: nums[1] ?? 0,
          width: nums[2] ?? 0,
          height: nums[3] ?? 0,
        });
      }
    }
    const dataBuffer = useJpg ? img.toJPEG(90) : img.toPNG();
    const dataUrl = `data:image/${useJpg ? "jpeg" : "png"};base64,${dataBuffer.toString("base64")}`;
    const savedPath = filePath;
    if (filePath.length > 0) {
      const targetDir = dirname(filePath);
      if (!existsSync(targetDir)) {
        await mkdir(targetDir, { recursive: true });
      }
      await writeFile(filePath, dataBuffer);
    }
    return { success: true, dataUrl, path: savedPath };
  } catch (error) {
    return { success: false, message: (error as Error).message };
  }
}
