import { Logger } from "./logger/index.js";
import { FileManager } from "./file-manager.js";
import { getErrorMessage } from "@shared/index.js";

interface ScreenshotOpts {
  tag?: string;
  format?: string;
  hideCursor?: boolean;
  allowRegionFallback?: boolean;
}

interface ScreenshotResult {
  success?: boolean;
  dataUrl?: string;
  data?: string;
  path?: string;
}

class ScreenshotManagerClass {
  async captureRegion(selector: string | null, opts: ScreenshotOpts = {}): Promise<string> {
    const bounds = selector !== null ? this.resolveRegion(selector) : null;
    const region =
      bounds !== null
        ? `${Math.round(bounds.x)};${Math.round(bounds.y)}:${Math.round(bounds.width)};${Math.round(bounds.height)}`
        : "";
    const tag = opts.tag ?? "region";
    let res: ScreenshotResult | null = null;
    try {
      if (window.electronAPI?.capturePage !== undefined) {
        res = (await window.electronAPI.capturePage("region", region)) as ScreenshotResult | null;
      }
    } catch (err) {
      Logger.warn("screenshot", `capturePage başarısız: ${getErrorMessage(err)}`);
    }
    if (res?.success !== true || (res.dataUrl === undefined && res.data === undefined)) {
      res = (await this.captureSystem("", {
        ...opts,
        allowRegionFallback: false,
      })) as unknown as ScreenshotResult;
    }
    return await this.persist(res, tag, opts.format);
  }

  async captureWindow(windowId: number, opts: ScreenshotOpts = {}): Promise<string> {
    const tag = opts.tag ?? `window-${windowId}`;
    let res: ScreenshotResult | null = null;
    try {
      if (window.electronAPI?.capturePage !== undefined) {
        res = (await window.electronAPI.capturePage("window", "")) as ScreenshotResult | null;
      }
    } catch (err) {
      Logger.warn("screenshot", `captureWindow fallback: ${getErrorMessage(err)}`);
    }
    if (res?.success !== true || (res.dataUrl === undefined && res.data === undefined)) {
      res = (await this.captureSystem("", opts)) as unknown as ScreenshotResult;
    }
    return await this.persist(res, tag, opts.format);
  }

  async captureSystem(_screenId = "", opts: ScreenshotOpts = {}): Promise<string> {
    const tag = opts.tag ?? "system";
    try {
      if (window.electronAPI?.screenshotCapture !== undefined) {
        const res = (await window.electronAPI.screenshotCapture({
          region: "",
          hideCursor: opts.hideCursor ?? false,
          format: opts.format ?? "png",
        })) as ScreenshotResult;
        return await this.persist(res, tag, opts.format);
      }
    } catch (err) {
      Logger.error("screenshot", `captureSystem hata: ${getErrorMessage(err)}`);
    }
    try {
      if (window.electronAPI?.capturePage !== undefined) {
        const res = (await window.electronAPI.capturePage("full", "")) as
          | ScreenshotResult
          | undefined;
        return await this.persist(res ?? null, tag, opts.format);
      }
      return "";
    } catch (err) {
      Logger.error("screenshot", `captureSystem fallback hata: ${getErrorMessage(err)}`);
      return "";
    }
  }

  resolveRegion(selector: string): { x: number; y: number; width: number; height: number } | null {
    if (selector === "") return null;
    const el = document.querySelector(selector);
    if (el === null) return null;
    const rect = el.getBoundingClientRect();
    return { x: rect.x, y: rect.y, width: rect.width, height: rect.height };
  }

  async persist(result: ScreenshotResult | null, tag = "shot", format = "png"): Promise<string> {
    const dataUrl = result?.dataUrl ?? result?.data;
    if (result?.success !== true || dataUrl === undefined || dataUrl === "") {
      return "";
    }
    try {
      const ext = format.toLowerCase() === "jpg" ? "jpg" : "png";
      const target = await FileManager.screenshotPath(tag, ext);
      if (target === "") return "";
      const base64 = (dataUrl.split(",")[1] ?? "").trim();
      await FileManager.writeFileAtomic(target, base64, "base64");
      Logger.info("screenshot", `Screenshot kaydedildi: ${target}`);
      return target;
    } catch (err) {
      Logger.error("screenshot", `Screenshot yazılamadı: ${getErrorMessage(err)}`);
      return "";
    }
  }
}

const screenshotManager = new ScreenshotManagerClass();
export { screenshotManager as ScreenshotManager };
