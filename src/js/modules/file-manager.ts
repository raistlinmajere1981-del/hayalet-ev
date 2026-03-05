import { Logger } from "./logger/index.js";
import { LogCategory } from "@shared/logging-core";
import { getErrorMessage } from "@shared/index.js";
import { getMimeType, getFilename, generateUniqueId } from "../constants/index.js";

interface FileEntry {
  name?: string;
  originalName?: string;
  path?: string;
  tempPath?: string;
  commandPath?: string;
}

interface ReadResult {
  name: string;
  base64: string;
  mimeType: string;
}

interface StageResult {
  staged: unknown[];
  temp: string[];
  commandDir: string;
}

class FileManagerClass {
  paths: Record<string, string>;

  constructor() {
    this.paths = {};
  }

  async ensureDirs(scope = "all"): Promise<Record<string, string>> {
    try {
      const electronApi = window.electronAPI;
      if (electronApi === undefined) {
        return {};
      }

      const res = (await electronApi.fmEnsureDirs(scope)) as
        | { success: boolean; message?: string; paths?: Record<string, string> }
        | undefined;
      if (res === undefined || res.success === false)
        throw new Error(res?.message ?? "ensureDirs failed");
      if (res.paths !== undefined && typeof res.paths === "object") {
        this.paths = { ...this.paths, ...res.paths };
      }
      return res.paths ?? {};
    } catch (err) {
      const error = err instanceof Error ? err : new Error(String(err));
      Logger.error(LogCategory.FILE_MANAGER, `ensureDirs hata: ${getErrorMessage(error)}`);
      return {};
    }
  }

  getPath(scope: string): string {
    return this.paths[scope] ?? "";
  }

  async readUploadFiles(filterNames: (FileEntry | string)[] = []): Promise<ReadResult[]> {
    const electronApi = window.electronAPI;
    if (electronApi === undefined) {
      return [];
    }

    const results = await Promise.all(
      filterNames.map(async (entry) => {
        const entryObj = typeof entry === "string" ? { path: entry } : entry;
        const base = entryObj.name ?? getFilename(entryObj.path ?? "");
        const path = entryObj.path ?? entryObj.tempPath ?? entryObj.commandPath;
        if (base === "" || path === undefined || path === "") return null;
        try {
          const data = (await electronApi.readFile(path)) as string | undefined;
          if (data === undefined || data === "") return null;
          const ext = getFilename(base).split(".").pop() ?? "";
          const mimeType = getMimeType(ext);
          return { name: base, base64: data, mimeType };
        } catch (err) {
          const error = err as Error;
          Logger.warn(LogCategory.FILE_MANAGER, `Dosya okunamadı: ${path}`, {
            error: error.message,
          });
          return null;
        }
      })
    );
    return results.filter((entry): entry is ReadResult => entry !== null);
  }

  async stageCommandFiles(jobId: string, names: (FileEntry | string)[] = []): Promise<StageResult> {
    if (jobId === "") return { staged: [], temp: [], commandDir: "" };
    const electronApi = window.electronAPI;
    if (electronApi === undefined) {
      return { staged: [], temp: [], commandDir: "" };
    }
    const payload = {
      jobId,
      files: names
        .map((n) => (typeof n === "string" ? n : (n.path ?? n.commandPath ?? n.name)))
        .filter((f): f is string => f !== undefined && f !== ""),
    };
    const stagedRes = (await electronApi.commandStageAttachments(payload)) as
      | {
          success?: boolean;
          message?: string;
          staged?: unknown[];
          temp?: string[];
          commandDir?: string;
        }
      | undefined;
    if (stagedRes?.success !== true) {
      Logger.error(
        LogCategory.FILE_MANAGER,
        `commandStageAttachments hata: ${stagedRes?.message ?? "bilinmiyor"}`,
        { jobId }
      );
      return { staged: [], temp: [], commandDir: "" };
    }
    return {
      staged: stagedRes.staged ?? [],
      temp: [],
      commandDir: stagedRes.commandDir ?? "",
    };
  }

  async commandArchiveCopy(
    jobId: string,
    targetDir: string
  ): Promise<{ success?: boolean; message?: string }> {
    if (jobId === "" || targetDir === "") return { success: false, message: "parametre eksik" };
    const electronApi = window.electronAPI;
    if (electronApi === undefined) {
      return { success: false, message: "API not available" };
    }
    const res = (await electronApi.commandArchiveCopy({
      jobId,
      targetDir,
    })) as { success?: boolean; message?: string } | undefined;
    if (res?.success !== true) {
      Logger.warn(
        LogCategory.FILE_MANAGER,
        `commandArchiveCopy başarısız: ${res?.message ?? "bilinmiyor"}`,
        { jobId, targetDir }
      );
    }
    return res ?? { success: false };
  }

  commandCleanup(jobId: string, tempEntries: { tempPath?: string }[] = []): void {
    const electronApi = window.electronAPI;
    if (electronApi === undefined) {
      return;
    }
    const tempPaths = tempEntries.map((t) => t.tempPath).filter((p): p is string => Boolean(p));
    void electronApi.commandCleanupJob({ jobId, tempPaths });
  }

  async commandFail(
    jobId: string,
    tempEntries: { tempPath?: string }[] = []
  ): Promise<{ success?: boolean; message?: string } | undefined> {
    const electronApi = window.electronAPI;
    if (electronApi === undefined) {
      return { success: false, message: "API not available" };
    }
    const tempPaths = tempEntries.map((t) => t.tempPath).filter((p): p is string => Boolean(p));
    const res = (await electronApi.commandMoveFailed({
      jobId,
      tempPaths,
    })) as { success?: boolean; message?: string } | undefined;
    if (res?.success !== true) {
      Logger.warn(
        LogCategory.FILE_MANAGER,
        `commandMoveFailed başarısız: ${res?.message ?? "bilinmiyor"}`,
        { jobId }
      );
    }
    return res;
  }

  async writeFileAtomic(
    path: string,
    data: string | Uint8Array | Record<string, unknown> | null | undefined,
    encoding = "utf-8"
  ): Promise<string> {
    try {
      const electronApi = window.electronAPI;
      if (electronApi === undefined) {
        return "";
      }

      let payload;
      if (typeof data === "string") {
        payload = { path, data, encoding };
      } else if (data instanceof Uint8Array) {
        const base64 = btoa(
          Array.from(data)
            .map((b) => String.fromCharCode(b))
            .join("")
        );
        payload = { path, data: base64, encoding: "base64" };
      } else {
        const textEncoder = new TextEncoder();
        let serialized = "";
        if (data === null || data === undefined) {
          serialized = "";
        } else {
          try {
            serialized = JSON.stringify(data);
          } catch {
            serialized = "";
          }
        }
        const bytes = textEncoder.encode(serialized);
        const base64 = btoa(
          Array.from(bytes)
            .map((b) => String.fromCharCode(b))
            .join("")
        );
        payload = { path, data: base64, encoding: "base64" };
      }
      const res = (await electronApi.fmWriteFileAtomic(payload)) as
        | { success: boolean; path?: string; message?: string }
        | undefined;
      if (res == null || res.success === false) {
        throw new Error(res?.message ?? "writeFileAtomic failed");
      }
      return res.path ?? "";
    } catch (err) {
      const error = err instanceof Error ? err : new Error(String(err));
      Logger.error(LogCategory.FILE_MANAGER, `writeFileAtomic hata: ${getErrorMessage(error)}`);
      return "";
    }
  }

  async tempPath(prefix = "tmp", ext = "tmp"): Promise<string> {
    try {
      const electronApi = window.electronAPI;
      if (electronApi === undefined) {
        return "";
      }

      const res = (await electronApi.fmTempPath(prefix, ext)) as { path: string } | undefined;
      return res != null ? res.path : "";
    } catch (err) {
      const error = err instanceof Error ? err : new Error(String(err));
      Logger.error(LogCategory.FILE_MANAGER, `tempPath hata: ${getErrorMessage(error)}`);
      return "";
    }
  }

  async screenshotPath(tag = "shot", ext = "png"): Promise<string> {
    const dirs = await this.ensureDirs("commands");
    const baseDir = dirs["commands"] ?? this.getPath("commands");
    if (baseDir === "") {
      return "";
    }
    const cleanTag = tag.replace(/[^\w.-]+/g, "_");
    const filename = generateUniqueId(cleanTag) + "." + ext;
    return `${baseDir}/screenshots/${filename}`;
  }
}

const fileManager = new FileManagerClass();
export { fileManager as FileManager };
