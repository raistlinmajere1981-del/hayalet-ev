// @ts-nocheck
import { LogManager } from "./log-manager.js";
import { FileManager } from "./file-manager.js";

class ScreenshotManagerClass {
  async captureRegion(selector, opts = {}) {
    const bounds = selector ? this.resolveRegion(selector) : null;
    const region = bounds
      ? `${Math.round(bounds.x)};${Math.round(bounds.y)}:${Math.round(bounds.width)};${Math.round(bounds.height)}`
      : "";
    const tag = opts.tag || "region";
    let res = null;
    try {
      if (window.electronAPI?.capturePage) {
        res = await window.electronAPI.capturePage("region", region);
      }
    } catch (err) {
      LogManager.addEvent(
        "screenshot",
        "warning",
        `capturePage başarısız: ${err.message}`,
      );
    }
    if (!res?.success || !res.dataUrl) {
      res = await this.captureSystem("", {
        ...opts,
        allowRegionFallback: false,
      });
    }
    return this.persist(res, tag, opts.format);
  }

  async captureWindow(windowId, opts = {}) {
    const tag = opts.tag || `window-${windowId || "main"}`;
    let res = null;
    try {
      if (window.electronAPI?.capturePage) {
        res = await window.electronAPI.capturePage("window", "");
      }
    } catch (err) {
      LogManager.addEvent(
        "screenshot",
        "warning",
        `captureWindow fallback: ${err.message}`,
      );
    }
    if (!res?.success || !res.dataUrl) {
      res = await this.captureSystem("", opts);
    }
    return this.persist(res, tag, opts.format);
  }

  async captureSystem(_screenId = "", opts = {}) {
    const tag = opts.tag || "system";
    try {
      if (window.electronAPI?.screenshotCapture) {
        const res = await window.electronAPI.screenshotCapture({
          region: "",
          hideCursor: opts.hideCursor ?? false,
          format: opts.format || "png",
        });
        return this.persist(res, tag, opts.format);
      }
    } catch (err) {
      LogManager.addEvent(
        "screenshot",
        "error",
        `captureSystem hata: ${err.message}`,
      );
    }
    try {
      const res = await window.electronAPI?.capturePage?.("full", "");
      return this.persist(res, tag, opts.format);
    } catch (err) {
      LogManager.addEvent(
        "screenshot",
        "error",
        `captureSystem fallback hata: ${err.message}`,
      );
      return "";
    }
  }

  resolveRegion(selector) {
    if (!selector) return null;
    const el = document.querySelector(selector);
    if (!el) return null;
    const rect = el.getBoundingClientRect();
    return { x: rect.x, y: rect.y, width: rect.width, height: rect.height };
  }

  async persist(result, tag = "shot", format = "png") {
    if (!result?.success || !result.dataUrl) {
      return "";
    }
    try {
      const ext = (format || "png").toLowerCase() === "jpg" ? "jpg" : "png";
      const target = await FileManager.screenshotPath(tag, ext);
      if (!target) return "";
      const base64 = (result.dataUrl.split(",")[1] || "").trim();
      await FileManager.writeFileAtomic(target, base64, "base64");
      LogManager.addEvent(
        "screenshot",
        "info",
        `Screenshot kaydedildi: ${target}`,
      );
      return target;
    } catch (err) {
      LogManager.addEvent(
        "screenshot",
        "error",
        `Screenshot yazılamadı: ${err.message}`,
      );
      return "";
    }
  }
}

export const ScreenshotManager = new ScreenshotManagerClass();
