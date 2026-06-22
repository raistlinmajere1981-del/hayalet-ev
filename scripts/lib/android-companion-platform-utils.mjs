import { access, mkdir, readFile, writeFile } from "node:fs/promises";
import { constants as fsConstants } from "node:fs";
import { dirname, join } from "node:path";

export async function fileExists(targetPath) {
  try {
    await access(targetPath);
    return true;
  } catch {
    return false;
  }
}

export async function isExecutable(targetPath) {
  try {
    await access(targetPath, fsConstants.X_OK);
    return true;
  } catch {
    if (process.platform !== "win32") {
      return false;
    }
    try {
      await access(targetPath, fsConstants.F_OK);
      return true;
    } catch {
      return false;
    }
  }
}

export async function resolveExecutableOnPath(name) {
  const entries = (process.env.PATH ?? "")
    .split(process.platform === "win32" ? ";" : ":")
    .map((entry) => entry.trim())
    .filter(Boolean);
  const suffixes = process.platform === "win32" ? ["", ".exe", ".cmd", ".bat"] : [""];

  for (const entry of entries) {
    for (const suffix of suffixes) {
      const candidate = join(entry, `${name}${suffix}`);
      if (await isExecutable(candidate)) {
        return candidate;
      }
    }
  }

  return null;
}

export async function readJsonFile(filePath) {
  const content = await readFile(filePath, "utf8");
  return JSON.parse(content);
}

export async function writeJsonFile(filePath, value) {
  await mkdir(dirname(filePath), { recursive: true });
  await writeFile(filePath, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}
