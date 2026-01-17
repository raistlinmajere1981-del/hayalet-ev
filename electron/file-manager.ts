import { join, dirname, basename, resolve } from "path";
import { mkdir, writeFile, rename, readdir, readFile, copyFile, rm } from "fs/promises";
import { existsSync } from "fs";
import { shell } from "electron";
import type { IpcMainInvokeEvent } from "electron";

interface PathResolvers {
  [key: string]: () => string;
}

interface ResultBase {
  success: boolean;
  message?: string;
  path?: string;
  [key: string]: unknown;
}

async function ensureDir(dirPath: string): Promise<void> {
  if (!existsSync(dirPath)) {
    await mkdir(dirPath, { recursive: true });
  }
}

export { ensureDir };

export async function ensureScope(scope: string = "all"): Promise<ResultBase> {
  try {
    const paths = PATHS();
    const scopes = scope === "all" ? ["data", "logs", "commands"] : [scope];
    const resolved: Record<string, string> = {};
    for (const key of scopes) {
      const resolver = paths[key];
      if (!resolver) continue;
      const p = resolver();
      await ensureDir(p);
      resolved[key] = p;
    }
    return { success: true, ...resolved };
  } catch (err: unknown) {
    return { success: false, message: (err as Error)?.message || String(err) };
  }
}

function PATHS(): PathResolvers {
  const base = process.cwd();
  return {
    data: () => join(base, "data"),
    commands: () => join(base, "commands"),
    logs: () => join(base, "logs"),
  };
}

export async function fmTempPath(
  _event: IpcMainInvokeEvent,
  prefix: string = "tmp",
  ext: string = "tmp"
): Promise<ResultBase> {
  try {
    const cleanPrefix = (prefix || "tmp").replace(/[^\w.-]+/g, "_");
    const cleanExt = (ext || "").toString().replace(/^[.]+/, "");
    const filename = `${cleanPrefix}-${Date.now()}-${Math.random().toString(16).slice(2)}${cleanExt ? `.${cleanExt}` : ""}`;
    const baseDir = PATHS().commands();
    await ensureDir(baseDir);
    const fullPath = join(baseDir, filename);
    return { success: true, path: fullPath };
  } catch (error: unknown) {
    return { success: false, message: (error as Error).message };
  }
}

export async function fmEnsureDirs(_event: IpcMainInvokeEvent, scope: string = "all"): Promise<ResultBase> {
  try {
    const paths = PATHS();
    const scopes = scope === "all" ? ["data", "logs", "commands"] : [scope];
    const resolved: Record<string, string> = {};
    for (const key of scopes) {
      const resolver = paths[key];
      if (!resolver) continue;
      const p = resolver();
      await ensureDir(p);
      resolved[key] = p;
    }
    return { success: true, ...resolved };
  } catch (err: unknown) {
    return { success: false, message: (err as Error)?.message || String(err) };
  }
}

export async function fmWriteFileAtomic(_event: IpcMainInvokeEvent, payload: { path: string; data: string; encoding?: BufferEncoding }): Promise<ResultBase> {
  try {
    const { path: targetPath, data, encoding = "utf-8" } = payload || {};
    if (!targetPath) throw new Error("path eksik");
    const dir = dirname(targetPath);
    await ensureDir(dir);
    const tmpPath = `${targetPath}.${Date.now()}.tmp`;
    const buffer =
      typeof data === "string"
        ? Buffer.from(data, encoding === "base64" ? "base64" : encoding)
        : Buffer.from(data || "");
    await writeFile(tmpPath, buffer);
    await rename(tmpPath, targetPath);
    return { success: true, path: targetPath };
  } catch (error: unknown) {
    return { success: false, message: (error as Error).message };
  }
}

export async function readFileAsBase64(_event: IpcMainInvokeEvent, filePath: string): Promise<string | null> {
  try {
    if (!filePath || !existsSync(filePath)) return null;
    const buffer = await readFile(filePath);
    return buffer.toString("base64");
  } catch (err: unknown) {
    return null;
  }
}

export async function copyToAssets(_event: IpcMainInvokeEvent, srcPath: string, _role: string = "", accountInfo: { email?: string; provider?: string } | null = null): Promise<ResultBase> {
  try {
    if (!srcPath || !existsSync(srcPath)) {
      throw new Error("Kaynak dosya bulunamadı");
    }
    const assetsDir = join(process.cwd(), "src", "assets");
    if (!existsSync(assetsDir)) {
      await mkdir(assetsDir, { recursive: true });
    }
    const baseName = basename(srcPath) || "avatar";
    const parts = baseName.split(".");
    const ext = parts.length > 1 ? "." + parts.pop() : "";
    let candidate;

    if (accountInfo && accountInfo.email && accountInfo.provider) {
      const safeEmail = String(accountInfo.email)
        .trim()
        .replace(/@/g, "at")
        .replace(/[^a-z0-9.-]/gi, "");
      const safeProvider = String(accountInfo.provider)
        .trim()
        .replace(/[^a-z0-9_-]/gi, "");
      candidate = `${safeEmail}-${safeProvider}${ext}`;
    } else if (_role) {
      const safeRole =
        String(_role)
          .toLowerCase()
          .replace(/[^a-z0-9_-]+/g, "") || "avatar";
      candidate = `${safeRole}${ext}`;
    } else {
      const stem = parts.join(".") || "avatar";
      candidate = `${stem}${ext}`;
      let counter = 1;
      while (existsSync(join(assetsDir, candidate))) {
        candidate = `${stem} (${counter})${ext}`;
        counter += 1;
      }
    }

    if (String(_role).toLowerCase() === "user") {
      try {
        const entries = await readdir(assetsDir);
        for (const name of entries) {
          if (/^user\.[^./\\]+$/i.test(name)) {
            await rm(join(assetsDir, name), { force: true });
          }
        }
      } catch (e) {}
    }

    const destPath = join(assetsDir, candidate);
    await copyFile(srcPath, destPath);
    return { success: true, path: destPath, fileName: candidate };
  } catch (error: unknown) {
    return { success: false, message: (error as Error).message };
  }
}

export async function copyFileTo(_event: IpcMainInvokeEvent, srcPath: string, destDir: string): Promise<ResultBase> {
  try {
    if (!srcPath || !destDir) throw new Error("Parametre eksik");
    if (!existsSync(srcPath)) throw new Error("Kaynak dosya yok");
    await mkdir(destDir, { recursive: true });
    const base = basename(srcPath);
    let candidate = base;
    let counter = 1;
    while (existsSync(join(destDir, candidate))) {
      const parts = base.split(".");
      const ext = parts.length > 1 ? "." + parts.pop() : "";
      const stem = parts.join(".") || "file";
      candidate = `${stem} (${counter})${ext}`;
      counter += 1;
    }
    const target = join(destDir, candidate);
    await copyFile(srcPath, target);
    return { success: true, path: target, name: candidate };
  } catch (error: unknown) {
    return { success: false, message: (error as Error).message };
  }
}

export async function deleteAsset(_event: IpcMainInvokeEvent, assetPath: string): Promise<ResultBase> {
  try {
    if (!assetPath) throw new Error("assetPath missing");
    const target = assetPath;
    if (!existsSync(target)) {
      return { success: true, message: "Asset not found" };
    }
    await rm(target, { force: true });
    return { success: true };
  } catch (error: unknown) {
    return { success: false, message: (error as Error).message };
  }
}

interface GenerateTreeOptions {
  maxDepth?: number;
  exclude?: string[];
}

export async function generateTree(
  _event: IpcMainInvokeEvent,
  basePath: string = "",
  options: GenerateTreeOptions = {}
): Promise<ResultBase & { tree?: string }> {
  try {
    if (!basePath) basePath = process.cwd();
    const maxDepth = options.maxDepth ?? 10;
    const excludePatterns = options.exclude || ["node_modules", "dist", ".vite"];
    const isProject = basePath === "project" || basePath === ".";
    if (isProject) basePath = process.cwd();
    if (!existsSync(basePath)) return { success: false, message: `Path not found: ${basePath}` };
    const shouldExclude = (name: string): boolean =>
      excludePatterns.some((pattern) => {
        if (pattern.includes("*")) {
          const regex = new RegExp(pattern.replace(/\*/g, ".*"));
          return regex.test(name);
        }
        return name === pattern;
      });
    const buildTree = async (dir: string, depth: number = 0, prefix: string = ""): Promise<string[]> => {
      if (depth > maxDepth) return [];
      try {
        const entries = await readdir(dir, { withFileTypes: true });
        const lines: string[] = [];
        const filtered = entries.filter((e) => !shouldExclude(e.name));
        for (let idx = 0; idx < filtered.length; idx++) {
          const entry = filtered[idx];
          const isLast = idx === filtered.length - 1;
          const connector = isLast ? "└── " : "├── ";
          const nextPrefix = prefix + (isLast ? "    " : "│   ");
          lines.push(prefix + connector + entry.name + (entry.isDirectory() ? "/" : ""));
          if (entry.isDirectory()) {
            const childLines: string[] = await buildTree(join(dir, entry.name), depth + 1, nextPrefix);
            lines.push(...childLines);
          }
        }
        return lines;
      } catch (err: unknown) {
        return [];
      }
    };
    const lines = [basePath + "/"];
    const treeLines = await buildTree(basePath);
    lines.push(...treeLines);
    const treeContent = lines.join("\n");
    const tempDir = PATHS().commands();
    await ensureDir(tempDir);
    const timestamp = Date.now();
    const treeFile = join(tempDir, `tree-${timestamp}.txt`);
    await writeFile(treeFile, treeContent, "utf-8");
    return {
      success: true,
      path: treeFile,
      content: treeContent,
      fileName: `tree-${timestamp}.txt`,
      lines: lines.length,
    };
  } catch (error: unknown) {
    return { success: false, message: (error as Error).message };
  }
}

export async function openPath(targetPath: string): Promise<ResultBase> {
  try {
    if (!targetPath) throw new Error("path eksik");
    const absolutePath = resolve(process.cwd(), targetPath);
    const res = await shell.openPath(absolutePath);
    if (res) throw new Error(res);
    return { success: true };
  } catch (error: unknown) {
    return { success: false, message: (error as Error).message };
  }
}
