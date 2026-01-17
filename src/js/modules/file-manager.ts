import { LogManager } from "./log-manager.js";
import { getErrorMessage } from "../types/index.js";
import { getExtension, getMimeType, getFilename, generateUniqueId } from "../constants/index.js";

// ============================================================================
// Types
// ============================================================================

/** Dosya girişi tipi */
interface FileEntry {
  name?: string;
  originalName?: string;
  path?: string;
  tempPath?: string;
  commandPath?: string;
}

/** Okuma sonucu */
interface ReadResult {
  name: string;
  base64: string;
  mimeType: string;
}

/** Stage sonucu */
interface StageResult {
  staged: unknown[];
  temp: string[];
  commandDir: string;
}

// ============================================================================
// FileManagerClass
// ============================================================================

class FileManagerClass {
  paths: Record<string, string>;

  constructor() {
    this.paths = {};
  }

  async ensureDirs(scope = "all"): Promise<Record<string, string>> {
    try {
      const res = await window.electronAPI?.fmEnsureDirs?.(scope) as { success: boolean; message?: string; paths?: Record<string, string> } | undefined;
      if (!res?.success) throw new Error(res?.message || "ensureDirs failed");
      if (res.paths && typeof res.paths === "object") {
        this.paths = { ...this.paths, ...res.paths };
      }
      return res.paths || {};
    } catch (err) {
      const error = /** @type {Error} */ (err);
      LogManager.addEvent("file", "error", `ensureDirs hata: ${getErrorMessage(error)}`);
      return {};
    }
  }

  getPath(scope: string): string {
    return this.paths[scope] || "";
  }

  async readUploadFiles(filterNames: (FileEntry | string)[] = []): Promise<ReadResult[]> {
    const results: ReadResult[] = [];

    if (window.electronAPI?.readFilesMulti) {
      try {
        const paths = filterNames
          .map((entry) => {
            if (typeof entry === "string") return entry;
            return entry?.path || entry?.tempPath || entry?.commandPath || null;
          })
          .filter((p): p is string => Boolean(p));

        if (paths.length) {
          const batchData = await window.electronAPI.readFilesMulti(paths);

          for (let i = 0; i < filterNames.length && i < batchData.length; i++) {
            const entry = filterNames[i];
            const item = batchData[i];
            // item could be string (base64) or object { path, data }
            const data = typeof item === "string" ? item : (item as { data?: string | null })?.data;
            if (!data) continue;

            const entryObj = typeof entry === "string" ? { path: entry } : entry;
            const base =
              entryObj?.name ||
              entryObj?.originalName ||
              getFilename(entryObj?.path || "");
            const ext = getExtension(base);
            const mimeType = getMimeType(ext);
            results.push({ name: base, base64: data, mimeType });
          }
          return results;
        }
      } catch (err) {
        const error = err as Error;
        LogManager.addEvent(
          "file",
          "warning",
          `Batch read başarısız, sequential fallback: ${getErrorMessage(error)}`,
        );
      }
    }

    for (const entry of filterNames) {
      const entryObj = typeof entry === "string" ? { path: entry } : entry;
      const base = entryObj?.name || getFilename(entryObj?.path || "");
      const path = entryObj?.path || entryObj?.tempPath || entryObj?.commandPath;
      if (!base || !path) continue;
      try {
        const data = await window.electronAPI?.readFile?.(path);
        if (!data) continue;
        const ext = getExtension(base);
        const mimeType = getMimeType(ext);
        results.push({ name: base, base64: data, mimeType });
      } catch (err) {
        const error = err as Error;
        LogManager.addEvent("file", "warning", `Dosya okunamadı: ${path}`, {
          error: error?.message,
        });
      }
    }
    return results;
  }

  async stageCommandFiles(jobId: string, names: (FileEntry | string)[] = []): Promise<StageResult> {
    if (!jobId) return { staged: [], temp: [], commandDir: "" };
    const payload = {
      jobId,
      files: names
        .map((n) =>
          typeof n === "string" ? n : n?.path || n?.commandPath || n?.name,
        )
        .filter((f): f is string => Boolean(f)),
    };
    const stagedRes = await window.electronAPI?.commandStageAttachments?.(payload) as { success?: boolean; message?: string; staged?: unknown[]; temp?: string[]; commandDir?: string } | undefined;
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
      commandDir: stagedRes.commandDir || "",
    };
  }

  async commandArchiveCopy(jobId: string, targetDir: string): Promise<{ success?: boolean; message?: string }> {
    if (!jobId || !targetDir)
      return { success: false, message: "parametre eksik" };
    const res = await window.electronAPI?.commandArchiveCopy?.({
      jobId,
      targetDir,
    }) as { success?: boolean; message?: string } | undefined;
    if (!res?.success) {
      LogManager.addEvent(
        "file",
        "warning",
        `commandArchiveCopy başarısız: ${res?.message || "bilinmiyor"}`,
        { jobId, targetDir },
      );
    }
    return res || { success: false };
  }

  async commandCleanup(jobId: string, tempEntries: { tempPath?: string }[] = []): Promise<void> {
    const tempPaths = (tempEntries || [])
      .map((t) => t.tempPath)
      .filter((p): p is string => Boolean(p));
    await window.electronAPI
      ?.commandCleanupJob?.({ jobId, tempPaths })
      .catch(() => {
        // Ignore cleanup errors
      });
  }

  async commandFail(jobId: string, tempEntries: { tempPath?: string }[] = []): Promise<{ success?: boolean; message?: string } | undefined> {
    const tempPaths = (tempEntries || [])
      .map((t) => t.tempPath)
      .filter((p): p is string => Boolean(p));
    const res = await window.electronAPI?.commandMoveFailed?.({
      jobId,
      tempPaths,
    }) as { success?: boolean; message?: string } | undefined;
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

  async writeFileAtomic(path: string, data: string | Uint8Array | unknown, encoding = "utf-8"): Promise<string> {
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
      return res.path || "";
    } catch (err) {
      const error = /** @type {Error} */ (err);
      LogManager.addEvent(
        "file",
        "error",
        `writeFileAtomic hata: ${getErrorMessage(error)}`,
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
      LogManager.addEvent("file", "error", `tempPath hata: ${getErrorMessage(error)}`);
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
    const filename = generateUniqueId(cleanTag) + "." + ext;
    return `${baseDir}/screenshots/${filename}`;
  }

}

export const FileManager = new FileManagerClass();
