import { mkdir, readFile, readdir, stat, writeFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const ROOM_SCHEMA_VERSION = 1;

function isRecord(value) {
  return value !== null && typeof value === "object" && Array.isArray(value) === false;
}

function normalizeRelativePath(value) {
  if (typeof value !== "string") {
    return null;
  }

  const normalized = value.replace(/\\/g, "/").trim();
  if (
    normalized === "" ||
    normalized.startsWith("/") ||
    normalized.startsWith("../") ||
    normalized.includes("/../")
  ) {
    return null;
  }

  const parts = normalized.split("/");
  if (parts.some((part) => part === "" || part === "." || part === "..")) {
    return null;
  }

  return parts.join("/");
}

function validateManifest(candidate) {
  const errors = [];

  if (!isRecord(candidate)) {
    return { valid: false, errors: ["manifest must be an object"], manifest: null };
  }

  if (candidate.schemaVersion !== ROOM_SCHEMA_VERSION) {
    errors.push("schemaVersion must be 1");
  }
  if (typeof candidate.id !== "string" || candidate.id.trim() === "") {
    errors.push("id is required");
  }
  if (typeof candidate.name !== "string" || candidate.name.trim() === "") {
    errors.push("name is required");
  }
  if (typeof candidate.version !== "string" || candidate.version.trim() === "") {
    errors.push("version is required");
  }
  if (!isRecord(candidate.menu) || typeof candidate.menu.label !== "string" || candidate.menu.label.trim() === "") {
    errors.push("menu.label is required");
  }

  const uiEntry = normalizeRelativePath(candidate.uiEntry);
  const hostEntry = normalizeRelativePath(candidate.hostEntry);
  if (uiEntry === null) {
    errors.push("uiEntry must be a safe relative path");
  }
  if (hostEntry === null) {
    errors.push("hostEntry must be a safe relative path");
  }

  return {
    valid: errors.length === 0,
    errors,
    manifest:
      errors.length === 0
        ? {
            ...candidate,
            uiEntry,
            hostEntry,
          }
        : null,
  };
}

async function collectFiles(baseDir, currentDir = baseDir) {
  const entries = await readdir(currentDir, { withFileTypes: true });
  const files = [];

  for (const entry of entries) {
    if (entry.name === "dist" || entry.name === "node_modules") {
      continue;
    }

    const absolutePath = join(currentDir, entry.name);
    if (entry.isDirectory()) {
      files.push(...(await collectFiles(baseDir, absolutePath)));
      continue;
    }

    files.push({
      absolutePath,
      relativePath: absolutePath.slice(baseDir.length + 1).replace(/\\/g, "/"),
    });
  }

  return files.sort((left, right) => left.relativePath.localeCompare(right.relativePath));
}

export async function buildRoomBundle(roomId, options = {}) {
  const normalizedRoomId = typeof roomId === "string" ? roomId.trim() : "";
  if (normalizedRoomId === "") {
    throw new Error("roomId is required");
  }

  const scriptDir = dirname(fileURLToPath(import.meta.url));
  const projectRoot = resolve(scriptDir, "..", "..");
  const workspaceRoot = resolve(options.workspaceRoot ?? join(projectRoot, "rooms"));
  const roomDir = resolve(workspaceRoot, normalizedRoomId);
  const manifestPath = join(roomDir, "manifest.json");

  if (existsSync(manifestPath) !== true) {
    throw new Error(`manifest.json missing: ${manifestPath}`);
  }

  const rawManifest = JSON.parse(await readFile(manifestPath, "utf8"));
  const validation = validateManifest(rawManifest);
  if (validation.valid !== true || validation.manifest === null) {
    throw new Error(validation.errors.join("; "));
  }

  const runtimePath = join(roomDir, validation.manifest.uiEntry);
  const hostPath = join(roomDir, validation.manifest.hostEntry);
  const runtimeStat = await stat(runtimePath).catch(function () {
    return null;
  });
  const hostStat = await stat(hostPath).catch(function () {
    return null;
  });

  if (runtimeStat?.isFile() !== true) {
    throw new Error(`uiEntry missing: ${validation.manifest.uiEntry}`);
  }
  if (hostStat?.isFile() !== true) {
    throw new Error(`hostEntry missing: ${validation.manifest.hostEntry}`);
  }

  const files = await collectFiles(roomDir);
  const bundleFiles = {};

  for (const file of files) {
    const content = await readFile(file.absolutePath);
    bundleFiles[file.relativePath] = {
      encoding: "base64",
      content: content.toString("base64"),
    };
  }

  const bundle = {
    schemaVersion: ROOM_SCHEMA_VERSION,
    manifest: validation.manifest,
    files: bundleFiles,
    exportedAt: new Date().toISOString(),
  };

  const outputFile = resolve(
    options.outputFile ?? join(roomDir, "dist", `${validation.manifest.id}.hevroom.json`)
  );
  await mkdir(dirname(outputFile), { recursive: true });
  await writeFile(outputFile, JSON.stringify(bundle, null, 2), "utf8");

  return {
    outputFile,
    roomDir,
    manifest: validation.manifest,
    bundle,
  };
}

function parseArgs(argv) {
  const options = {};
  const positionals = [];

  for (let index = 0; index < argv.length; index += 1) {
    const value = argv[index];
    if (value === "--output") {
      options.outputFile = argv[index + 1];
      index += 1;
      continue;
    }
    if (value === "--workspace-root") {
      options.workspaceRoot = argv[index + 1];
      index += 1;
      continue;
    }
    positionals.push(value);
  }

  return {
    roomId: positionals[0] ?? "",
    options,
  };
}

async function runCli() {
  const { roomId, options } = parseArgs(process.argv.slice(2));
  if (roomId === "") {
    console.error("Usage: node scripts/rooms/build-room-bundle.mjs <roomId> [--output <file>] [--workspace-root <dir>]");
    process.exitCode = 1;
    return;
  }

  const result = await buildRoomBundle(roomId, options);
  console.log(result.outputFile);
}

const invokedPath = process.argv[1] ? resolve(process.argv[1]) : "";
const currentPath = fileURLToPath(import.meta.url);

if (invokedPath === currentPath) {
  runCli().catch((error) => {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  });
}
