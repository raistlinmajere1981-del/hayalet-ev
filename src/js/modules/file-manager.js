import { LogManager } from "./log-manager.js";
import { getExtension, getMimeType } from "../constants/index.js";

class FileManagerClass {
  constructor() {
    this.paths = {};
  }

  async ensureDirs(scope = "all") {
    try {
      const res = /** @type {{ success: boolean; message?: string; paths?: Record<string, string> }} */ (
        await window.electronAPI?.fmEnsureDirs?.(scope)
      );
      if (!res?.success) throw new Error(res?.message || "ensureDirs failed");
      if (res.paths && typeof res.paths === "object") {
        this.paths = { ...this.paths, ...res.paths };
      }
      return res.paths || {};
    } catch (err) {
      const error = /** @type {Error} */ (err);
      LogManager.addEvent("file", "error", `ensureDirs hata: ${error.message}`);
      return {};
    }
  }

  getPath(scope) {
    return this.paths[scope] || "";
  }

  async readUploadFiles(filterNames = []) {
    const results = [];

    if (window.electronAPI?.readFilesMulti) {
      try {
        const paths = filterNames
          .map(
            (entry) =>
              entry?.path ||
              entry?.tempPath ||
              entry?.commandPath ||
              (typeof entry === "string" ? entry : null),
          )
          .filter(Boolean);

        if (paths.length) {
          const batchData = await window.electronAPI.readFilesMulti(paths);

          for (let i = 0; i < filterNames.length && i < batchData.length; i++) {
            const entry = filterNames[i];
            const data = batchData[i];
            if (!data) continue;

            const base =
              entry?.name ||
              entry?.originalName ||
              (entry?.path || "").split(/[/\\]/).pop();
            const ext = getExtension(base);
            const mimeType = getMimeType(ext);
            results.push({ name: base, base64: data, mimeType });
          }
          return results;
        }
      } catch (err) {
        const error = /** @type {Error} */ (err);
        LogManager.addEvent(
          "file",
          "warning",
          `Batch read başarısız, sequential fallback: ${error.message}`,
        );
      }
    }

    for (const entry of filterNames) {
      const base = entry?.name || (entry?.path || "").split(/[/\\]/).pop();
      const path = entry?.path || entry?.tempPath || entry?.commandPath;
      if (!base || !path) continue;
      try {
        const data = await window.electronAPI?.readFile?.(path);
        if (!data) continue;
        const ext = getExtension(base);
        const mimeType = getMimeType(ext);
        results.push({ name: base, base64: data, mimeType });
      } catch (err) {
        const error = /** @type {Error} */ (err);
        LogManager.addEvent("file", "warning", `Dosya okunamadı: ${path}`, {
          error: error?.message,
        });
      }
    }
    return results;
  }

  async stageCommandFiles(jobId, names = []) {
    if (!jobId) return { staged: [], temp: [], commandDir: "" };
    const payload = {
      jobId,
      files: names
        .map((n) =>
          typeof n === "string" ? n : n?.path || n?.commandPath || n?.name,
        )
        .filter(Boolean),
    };
    const stagedRes = /** @type {{ success?: boolean; message?: string; staged?: any[]; temp?: string[]; commandDir?: string }} */ (
      await window.electronAPI?.commandStageAttachments?.(payload)
    );
    if (!stagedRes?.success) {
      LogManager.addEvent(
        "file",
        "error",
        `commandStageAttachments hata: ${stagedRes?.message || "bilinmiyor"}`,
        { jobId },
      );
      return { staged: [], temp: [], commandDir: "" };
    }
    return {
      staged: stagedRes.staged || [],
      temp: [],
      commandDir: stagedRes.commandDir,
    };
  }

  async commandArchiveCopy(jobId, targetDir) {
    if (!jobId || !targetDir)
      return { success: false, message: "parametre eksik" };
    const res = /** @type {{ success?: boolean; message?: string }} */ (
      await window.electronAPI?.commandArchiveCopy?.({
        jobId,
        targetDir,
      })
    );
    if (!res?.success) {
      LogManager.addEvent(
        "file",
        "warning",
        `commandArchiveCopy başarısız: ${res?.message || "bilinmiyor"}`,
        { jobId, targetDir },
      );
    }
    return res;
  }

  async commandCleanup(jobId, tempEntries = []) {
    const tempPaths = (tempEntries || [])
      .map((t) => t.tempPath)
      .filter(Boolean);
    await window.electronAPI
      ?.commandCleanupJob?.({ jobId, tempPaths })
      .catch(() => {
      });
  }

  async commandFail(jobId, tempEntries = []) {
    const tempPaths = (tempEntries || [])
      .map((t) => t.tempPath)
      .filter(Boolean);
    const res = /** @type {{ success?: boolean; message?: string }} */ (
      await window.electronAPI?.commandMoveFailed?.({
        jobId,
        tempPaths,
      })
    );
    if (!res?.success) {
      LogManager.addEvent(
        "file",
        "warning",
        `commandMoveFailed başarısız: ${res?.message || "bilinmiyor"}`,
        { jobId },
      );
    }
    return res;
  }

  async writeFileAtomic(path, data, encoding = "utf-8") {
    try {
      let payload;
      if (typeof data === "string") {
        payload = { path, data, encoding };
      } else if (data instanceof Uint8Array) {
        const base64 = btoa(
          Array.from(data)
            .map((b) => String.fromCharCode(b))
            .join(""),
        );
        payload = { path, data: base64, encoding: "base64" };
      } else {
        const textEncoder = new TextEncoder();
        const bytes = textEncoder.encode(String(data || ""));
        const base64 = btoa(
          Array.from(bytes)
            .map((b) => String.fromCharCode(b))
            .join(""),
        );
        payload = { path, data: base64, encoding: "base64" };
      }
      const res = await window.electronAPI?.fmWriteFileAtomic?.(payload);
      if (!res?.success) {
        throw new Error(res?.message || "writeFileAtomic failed");
      }
      return res.path;
    } catch (err) {
      const error = /** @type {Error} */ (err);
      LogManager.addEvent(
        "file",
        "error",
        `writeFileAtomic hata: ${error.message}`,
      );
      return "";
    }
  }

  async tempPath(prefix = "tmp", ext = "tmp") {
    try {
      const res = /** @type {{ path: string }} */ (
        await window.electronAPI?.fmTempPath?.(prefix, ext)
      );
      return res?.path || "";
    } catch (err) {
      const error = /** @type {Error} */ (err);
      LogManager.addEvent("file", "error", `tempPath hata: ${error.message}`);
      return "";
    }
  }

  async screenshotPath(tag = "shot", ext = "png") {
    const dirs = await this.ensureDirs("commands");
    const baseDir = dirs.commands || this.getPath("commands") || "";
    if (!baseDir) {
      return "";
    }
    const cleanTag = (tag || "shot").replace(/[^\w.-]+/g, "_");
    const filename = `${cleanTag}-${Date.now()}-${Math.random().toString(16).slice(2)}.${ext}`;
    return `${baseDir}/screenshots/${filename}`;
  }

  async archiveWrite(meta = {}, files = []) {
    try {
      const res = await window.electronAPI?.fmArchiveWrite?.(meta, files);
      if (!res?.success) throw new Error(res?.message || "archiveWrite failed");
      return res.path;
    } catch (err) {
      const error = /** @type {Error} */ (err);
      LogManager.addEvent(
        "file",
        "warning",
        `archiveWrite başarısız: ${error.message}`,
      );
      return "";
    }
  }
}

export const FileManager = new FileManagerClass();
