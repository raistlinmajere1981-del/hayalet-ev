import { join, dirname, basename } from "path";
import {
  mkdir,
  writeFile,
  rename,
  readdir,
  readFile,
  copyFile,
  rm,
} from "fs/promises";
import { existsSync } from "fs";
import { shell } from "electron";

async function ensureDir(dirPath) {
  if (!existsSync(dirPath)) {
    await mkdir(dirPath, { recursive: true });
  }
}

export { ensureDir };

export async function ensureScope(scope = "all") {
  try {
    const paths = PATHS();
    const scopes = scope === "all" ? ["archives", "logs", "commands"] : [scope];
    const resolved = {};
    for (const key of scopes) {
      const resolver = paths[key];
      if (!resolver) continue;
      const p = resolver();
      await ensureDir(p);
      resolved[key] = p;
    }
    return { success: true, ...resolved };
  } catch (err) {
    return { success: false, message: err?.message || String(err) };
  }
}

function PATHS() {
  const base = process.cwd();
  return {
    archives: () => join(base, "archives"),
    commands: () => join(base, "commands"),
    whispers: () => join(base, "archives"),
    logs: () => join(base, "logs"),
  };
}

export async function fmTempPath(event, prefix = "tmp", ext = "tmp") {
  try {
    const cleanPrefix = (prefix || "tmp").replace(/[^\w.-]+/g, "_");
    const cleanExt = (ext || "").toString().replace(/^[.]+/, "");
    const filename = `${cleanPrefix}-${Date.now()}-${Math.random().toString(16).slice(2)}${cleanExt ? `.${cleanExt}` : ""}`;
    const baseDir = PATHS().commands();
    await ensureDir(baseDir);
    const fullPath = join(baseDir, filename);
    return { success: true, path: fullPath };
  } catch (error) {
    return { success: false, message: error.message };
  }
}

export async function fmEnsureDirs(event, scope = "all") {
  try {
    const paths = PATHS();
    const scopes = scope === "all" ? ["archives", "logs", "commands"] : [scope];
    const resolved = {};
    for (const key of scopes) {
      const resolver = paths[key];
      if (!resolver) continue;
      const p = resolver();
      await ensureDir(p);
      resolved[key] = p;
    }
    return { success: true, ...resolved };
  } catch (err) {
    return { success: false, message: err?.message || String(err) };
  }
}

export async function fmWriteFileAtomic(event, payload) {
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
  } catch (error) {
    return { success: false, message: error.message };
  }
}

export async function fmArchiveWrite(event, meta = {}, files = []) {
  try {
    const baseDir = PATHS().archives();
    await ensureDir(baseDir);
    const tag = (meta.tag || "archive").replace(/[^\w.-]+/g, "_");
    const stamp = new Date().toISOString().replace(/[:.]/g, "-");
    const folder = join(baseDir, "manual");
    await ensureDir(folder);
    const target = join(folder, `${tag}-${stamp}.json`);
    const payload = { meta, files, createdAt: Date.now() };
    await writeFile(target, JSON.stringify(payload, null, 2), "utf-8");
    return { success: true, path: target };
  } catch (error) {
    return { success: false, message: error.message };
  }
}

export async function readFileAsBase64(event, filePath) {
  try {
    if (!filePath || !existsSync(filePath)) return null;
    const buffer = await readFile(filePath);
    return buffer.toString("base64");
  } catch (err) {
    return null;
  }
}

export async function copyToAssets(
  event,
  srcPath,
  role = "",
  accountInfo = null,
) {
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
    } else if (role) {
      const safeRole =
        String(role)
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

    if (String(role).toLowerCase() === "user") {
      try {
        const entries = await readdir(assetsDir);
        for (const name of entries) {
          if (/^user\.[^./\\]+$/i.test(name)) {
            await rm(join(assetsDir, name), { force: true });
          }
        }
      } catch (e) {
      }
    }

    const destPath = join(assetsDir, candidate);
    await copyFile(srcPath, destPath);
    return { success: true, path: destPath, fileName: candidate };
  } catch (error) {
    return { success: false, message: error.message };
  }
}

export async function copyFileTo(event, srcPath, destDir) {
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
  } catch (error) {
    return { success: false, message: error.message };
  }
}

export async function removeArchive(event, folderPath) {
  try {
    if (!folderPath) throw new Error("folderPath missing");
    const target = folderPath;
    if (!existsSync(target)) {
      return { success: true, message: "Folder not found" };
    }
    await rm(target, { recursive: true, force: true });
    return { success: true };
  } catch (error) {
    return { success: false, message: error.message };
  }
}

export async function deleteAsset(event, assetPath) {
  try {
    if (!assetPath) throw new Error("assetPath missing");
    const target = assetPath;
    if (!existsSync(target)) {
      return { success: true, message: "Asset not found" };
    }
    await rm(target, { force: true });
    return { success: true };
  } catch (error) {
    return { success: false, message: error.message };
  }
}

export async function readArchivesIndex(event) {
  try {
    const indexPath = join(process.cwd(), "archives", "index.json");
    if (!existsSync(indexPath)) return [];
    const data = await readFile(indexPath, "utf-8");
    return JSON.parse(data || "[]");
  } catch (error) {
    return [];
  }
}

export async function writeArchivesIndex(event, entries) {
  try {
    const baseDir = join(process.cwd(), "archives");
    const indexPath = join(baseDir, "index.json");
    if (!existsSync(baseDir)) {
      await mkdir(baseDir, { recursive: true });
    }
    await writeFile(indexPath, JSON.stringify(entries || [], null, 2), "utf-8");
    return true;
  } catch (error) {
    return false;
  }
}

export async function generateTree(event, basePath = "", options = {}) {
  try {
    if (!basePath) basePath = process.cwd();
    const maxDepth = options.maxDepth ?? 10;
    const excludePatterns = options.exclude || [
      "node_modules",
      "dist",
      ".vite",
    ];
    const isProject = basePath === "project" || basePath === ".";
    if (isProject) basePath = process.cwd();
    if (!existsSync(basePath))
      return { success: false, message: `Path not found: ${basePath}` };
    const shouldExclude = (name) =>
      excludePatterns.some((pattern) => {
        if (pattern.includes("*")) {
          const regex = new RegExp(pattern.replace(/\*/g, ".*"));
          return regex.test(name);
        }
        return name === pattern;
      });
    const buildTree = async (dir, depth = 0, prefix = "") => {
      if (depth > maxDepth) return [];
      try {
        const entries = await readdir(dir, { withFileTypes: true });
        const lines = [];
        const filtered = entries.filter((e) => !shouldExclude(e.name));
        for (let idx = 0; idx < filtered.length; idx++) {
          const entry = filtered[idx];
          const isLast = idx === filtered.length - 1;
          const connector = isLast ? "└── " : "├── ";
          const nextPrefix = prefix + (isLast ? "    " : "│   ");
          lines.push(
            prefix + connector + entry.name + (entry.isDirectory() ? "/" : ""),
          );
          if (entry.isDirectory()) {
            const childLines = await buildTree(
              join(dir, entry.name),
              depth + 1,
              nextPrefix,
            );
            lines.push(...childLines);
          }
        }
        return lines;
      } catch (err) {
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
  } catch (error) {
    return { success: false, message: error.message };
  }
}

export async function openPath(event, targetPath) {
  try {
    if (!targetPath) throw new Error("path eksik");
    const res = await shell.openPath(targetPath);
    if (res) throw new Error(res);
    return { success: true };
  } catch (error) {
    return { success: false, message: error.message };
  }
}
