import { mkdir, readFile, readdir, stat, writeFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const ROOM_SCHEMA_VERSION = 2;

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

function collectRequiredPaths(manifest) {
  const paths = new Set();
  paths.add(manifest.runtime.uiEntry);
  paths.add(manifest.runtime.hostEntry);

  if (manifest.scene?.roomBackgroundSrc) {
    paths.add(manifest.scene.roomBackgroundSrc);
  }

  for (const feature of manifest.features) {
    if (!feature.scene) {
      continue;
    }
    paths.add(feature.scene.view.backgroundSrc);
    if (feature.scene.view.panelArtSrc) {
      paths.add(feature.scene.view.panelArtSrc);
    }
  }

  return [...paths].sort((left, right) => left.localeCompare(right));
}

function validateFeature(feature, index, errors) {
  if (!isRecord(feature)) {
    errors.push(`features[${index}] must be an object`);
    return null;
  }

  if (typeof feature.id !== "string" || feature.id.trim() === "") {
    errors.push(`features[${index}].id is required`);
  }
  if (typeof feature.name !== "string" || feature.name.trim() === "") {
    errors.push(`features[${index}].name is required`);
  }

  const next = { ...feature, id: feature.id?.trim?.() ?? "", name: feature.name?.trim?.() ?? "" };
  if (isRecord(feature.scene)) {
    const backgroundSrc = normalizeRelativePath(feature.scene?.view?.backgroundSrc);
    if (backgroundSrc === null) {
      errors.push(`features[${index}].scene.view.backgroundSrc must be a safe relative path`);
    }
    const panelArtSrcRaw = feature.scene?.view?.panelArtSrc;
    const panelArtSrc =
      panelArtSrcRaw === undefined ? undefined : normalizeRelativePath(panelArtSrcRaw);
    if (panelArtSrcRaw !== undefined && panelArtSrc === null) {
      errors.push(`features[${index}].scene.view.panelArtSrc must be a safe relative path`);
    }
    next.scene = {
      ...feature.scene,
      view: {
        ...feature.scene.view,
        backgroundSrc,
        ...(panelArtSrc !== undefined ? { panelArtSrc } : {}),
      },
    };
  }

  return next;
}

function validateManifest(candidate) {
  const errors = [];

  if (!isRecord(candidate)) {
    return { valid: false, errors: ["manifest must be an object"], manifest: null };
  }

  if (candidate.schemaVersion !== ROOM_SCHEMA_VERSION) {
    errors.push(`schemaVersion must be ${ROOM_SCHEMA_VERSION}`);
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
  if (!isRecord(candidate.runtime)) {
    errors.push("runtime is required");
  }

  const uiEntry = normalizeRelativePath(candidate.runtime?.uiEntry);
  const hostEntry = normalizeRelativePath(candidate.runtime?.hostEntry);
  if (uiEntry === null) {
    errors.push("runtime.uiEntry must be a safe relative path");
  }
  if (hostEntry === null) {
    errors.push("runtime.hostEntry must be a safe relative path");
  }

  if (typeof candidate.defaultFeatureId !== "string" || candidate.defaultFeatureId.trim() === "") {
    errors.push("defaultFeatureId is required");
  }

  if (!Array.isArray(candidate.features) || candidate.features.length === 0) {
    errors.push("features must contain at least one item");
  }

  const features = Array.isArray(candidate.features)
    ? candidate.features.map((feature, index) => validateFeature(feature, index, errors)).filter(Boolean)
    : [];
  if (
    typeof candidate.defaultFeatureId === "string" &&
    features.some((feature) => feature.id === candidate.defaultFeatureId.trim()) === false
  ) {
    errors.push("defaultFeatureId must match one of the feature ids");
  }

  let scene = undefined;
  if (candidate.scene !== undefined) {
    const roomBackgroundSrc = normalizeRelativePath(candidate.scene?.roomBackgroundSrc);
    if (roomBackgroundSrc === null) {
      errors.push("scene.roomBackgroundSrc must be a safe relative path");
    }
    if (features.some((feature) => !feature.scene)) {
      errors.push("scene requires every feature to define scene metadata");
    }
    scene = {
      ...candidate.scene,
      roomBackgroundSrc,
    };
  }

  return {
    valid: errors.length === 0,
    errors,
    manifest:
      errors.length === 0
        ? {
            ...candidate,
            id: candidate.id.trim(),
            name: candidate.name.trim(),
            version: candidate.version.trim(),
            defaultFeatureId: candidate.defaultFeatureId.trim(),
            runtime: {
              uiEntry,
              hostEntry,
            },
            features,
            ...(scene !== undefined ? { scene } : {}),
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

  for (const requiredPath of collectRequiredPaths(validation.manifest)) {
    const absolutePath = join(roomDir, requiredPath);
    const fileStat = await stat(absolutePath).catch(() => null);
    if (fileStat?.isFile() !== true) {
      throw new Error(`required asset missing: ${requiredPath}`);
    }
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
    console.error(
      "Usage: node scripts/rooms/build-room-bundle.mjs <roomId> [--output <file>] [--workspace-root <dir>]"
    );
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
