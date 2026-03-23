import { mkdir, readFile, readdir, rm, stat, writeFile } from "fs/promises";
import { existsSync } from "fs";
import { dirname, join, relative, resolve } from "path";
import { formatErrorWithDetail } from "../shared/i18n/error-detail.ts";
import { Paths } from "./paths.ts";
import type {
  InstalledRoomFeatureRecord,
  InstalledRoomFeatureSceneRecord,
  InstalledRoomRecord,
  InstalledRoomSceneRecord,
  RoomBundle,
  RoomBundleFile,
  RoomCommandSpec,
  RoomManifest,
  RoomProtocolSpec,
  RoomSceneChromeConfig,
  RoomSceneCharacterConfig,
  RoomRegistryState,
  RoomSceneHotspotConfig,
  RoomSceneTextConfig,
  RoomSceneTransparentWindowConfig,
  RoomWorkspaceEntry,
} from "@shared/index.js";
import {
  ROOM_SCHEMA_VERSION,
  collectRoomManifestRequiredFilePaths,
  flattenRoomCommandSpecs,
  flattenRoomProtocolSpecs,
  normalizeRoomRelativePath,
  validateRoomManifest,
} from "@shared/index.js";
import { translateElectronMessage } from "./i18n/language-service.ts";

interface RoomManagerOptions {
  workspaceRoot?: string;
  bundledWorkspaceRoot?: string;
  installedRoot?: string;
  registryPath?: string;
}

interface RoomOperationResult {
  success: boolean;
  error?: string;
  room?: InstalledRoomRecord;
  path?: string;
  restartRequired?: boolean;
}

interface RoomBundleValidationResult {
  valid: boolean;
  errors: string[];
  bundle?: RoomBundle;
}

const INSTALLED_ROOM_FILE_SNAPSHOT = ".room-install-files.json";

interface RoomWorkspaceRoot {
  root: string;
  sourceKind: "workspace" | "bundle";
  readOnly: boolean;
}

async function roomPackageT(
  key: string,
  params?: Record<string, string | number | boolean>
): Promise<string> {
  return await translateElectronMessage(`electron.roomPackage.${key}`, params);
}

async function roomPackageError(
  key: string,
  detail?: unknown,
  params?: Record<string, string | number | boolean>
): Promise<string> {
  return formatErrorWithDetail(await roomPackageT(key, params), detail);
}

function cloneCommandSpecs(
  commandSpecs: RoomCommandSpec[] | undefined
): RoomCommandSpec[] | undefined {
  return commandSpecs?.map((item) => ({ ...item }));
}

function cloneProtocolSpecs(
  protocolSpecs: RoomProtocolSpec[] | undefined
): RoomProtocolSpec[] | undefined {
  return protocolSpecs?.map((item) => ({ ...item }));
}

function cloneSceneText(value: RoomSceneTextConfig): RoomSceneTextConfig {
  return { ...value };
}

function cloneSceneHotspot(hotspot: RoomSceneHotspotConfig): RoomSceneHotspotConfig {
  return {
    id: hotspot.id,
    rect: { ...hotspot.rect },
    ...(hotspot.label !== undefined ? { label: cloneSceneText(hotspot.label) } : {}),
  };
}

function cloneSceneCharacter(value: RoomSceneCharacterConfig): RoomSceneCharacterConfig {
  return { ...value };
}

function cloneSceneCharacters(value: RoomSceneCharacterConfig[]): RoomSceneCharacterConfig[] {
  return value.map((character) => cloneSceneCharacter(character));
}

function cloneSceneChrome(value: RoomSceneChromeConfig): RoomSceneChromeConfig {
  return { ...value };
}

function cloneTransparentWindow(
  value: RoomSceneTransparentWindowConfig
): RoomSceneTransparentWindowConfig {
  return { ...value };
}

function buildInstalledFeatureRecord(
  feature: InstalledRoomFeatureRecord
): InstalledRoomFeatureRecord {
  return {
    id: feature.id,
    name: feature.name,
    ...(feature.description !== undefined ? { description: feature.description } : {}),
    ...(feature.icon !== undefined ? { icon: feature.icon } : {}),
    ...optionalCommandSpecs(feature.commandSpecs),
    ...optionalProtocolSpecs(feature.protocolSpecs),
    ...optionalInstalledFeatureScene(feature.scene),
  };
}

function cloneInstalledFeatureScene(
  value: InstalledRoomFeatureSceneRecord | undefined
): InstalledRoomFeatureSceneRecord | undefined {
  if (value === undefined) {
    return undefined;
  }

  return {
    hotspot: cloneSceneHotspot(value.hotspot),
    view: {
      id: value.view.id,
      backgroundPath: value.view.backgroundPath,
      ...(value.view.panelArtPath !== undefined ? { panelArtPath: value.view.panelArtPath } : {}),
      ...(value.view.transparentWindow !== undefined
        ? { transparentWindow: cloneTransparentWindow(value.view.transparentWindow) }
        : {}),
    },
  };
}

function resolveInstalledFeatureScene(
  value: InstalledRoomFeatureSceneRecord | undefined
): InstalledRoomFeatureSceneRecord | undefined {
  if (value === undefined) {
    return undefined;
  }

  return {
    hotspot: cloneSceneHotspot(value.hotspot),
    view: {
      id: value.view.id,
      backgroundPath: resolve(value.view.backgroundPath),
      ...(value.view.panelArtPath !== undefined
        ? { panelArtPath: resolve(value.view.panelArtPath) }
        : {}),
      ...(value.view.transparentWindow !== undefined
        ? { transparentWindow: cloneTransparentWindow(value.view.transparentWindow) }
        : {}),
    },
  };
}

function cloneInstalledFeatures(
  features: InstalledRoomFeatureRecord[]
): InstalledRoomFeatureRecord[] {
  return features.map((feature) => buildInstalledFeatureRecord(feature));
}

function cloneInstalledScene(
  scene: InstalledRoomSceneRecord | undefined
): InstalledRoomSceneRecord | undefined {
  if (scene === undefined) {
    return undefined;
  }

  return {
    referenceSize: { ...scene.referenceSize },
    roomBackgroundPath: scene.roomBackgroundPath,
    roomsHotspot: cloneSceneHotspot(scene.roomsHotspot),
    backHotspot: cloneSceneHotspot(scene.backHotspot),
    ...(scene.characterRosterPreset !== undefined
      ? { characterRosterPreset: scene.characterRosterPreset }
      : {}),
    ...(scene.characters !== undefined
      ? { characters: cloneSceneCharacters(scene.characters) }
      : {}),
    ...(scene.chrome !== undefined ? { chrome: cloneSceneChrome(scene.chrome) } : {}),
  };
}

function resolveInstalledScene(
  scene: InstalledRoomSceneRecord | undefined
): InstalledRoomSceneRecord | undefined {
  if (scene === undefined) {
    return undefined;
  }

  return {
    referenceSize: { ...scene.referenceSize },
    roomBackgroundPath: resolve(scene.roomBackgroundPath),
    roomsHotspot: cloneSceneHotspot(scene.roomsHotspot),
    backHotspot: cloneSceneHotspot(scene.backHotspot),
    ...(scene.characterRosterPreset !== undefined
      ? { characterRosterPreset: scene.characterRosterPreset }
      : {}),
    ...(scene.characters !== undefined
      ? { characters: cloneSceneCharacters(scene.characters) }
      : {}),
    ...(scene.chrome !== undefined ? { chrome: cloneSceneChrome(scene.chrome) } : {}),
  };
}

function normalizeRoomId(rawValue: string): string {
  return rawValue.trim();
}

async function ensureDir(dirPath: string): Promise<void> {
  await mkdir(dirPath, { recursive: true });
}

async function readJsonFile<T>(filePath: string): Promise<T> {
  const raw = await readFile(filePath, "utf-8");
  return JSON.parse(raw) as T;
}

async function copyDirectoryContents(sourceDir: string, targetDir: string): Promise<string[]> {
  const files = await collectFilesRecursive(sourceDir);
  await rm(targetDir, { recursive: true, force: true });
  await ensureDir(targetDir);

  await Promise.all(
    files.map(async (file): Promise<void> => {
      const targetPath = join(targetDir, file.relativePath);
      await ensureDir(dirname(targetPath));
      await writeFile(targetPath, await readFile(file.absolutePath));
    })
  );

  return files.map((file) => file.relativePath);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && Array.isArray(value) === false;
}

function optionalDescription(
  description: string | undefined
): { description: string } | Record<string, never> {
  return typeof description === "string" ? { description } : {};
}

function optionalCommandSpecs(
  commandSpecs: RoomCommandSpec[] | undefined
): { commandSpecs: RoomCommandSpec[] } | Record<string, never> {
  const cloned = cloneCommandSpecs(commandSpecs);
  return Array.isArray(cloned) && cloned.length > 0 ? { commandSpecs: cloned } : {};
}

function optionalProtocolSpecs(
  protocolSpecs: RoomProtocolSpec[] | undefined
): { protocolSpecs: RoomProtocolSpec[] } | Record<string, never> {
  const cloned = cloneProtocolSpecs(protocolSpecs);
  return Array.isArray(cloned) && cloned.length > 0 ? { protocolSpecs: cloned } : {};
}

function optionalScene(
  scene: InstalledRoomSceneRecord | undefined
): { scene: InstalledRoomSceneRecord } | Record<string, never> {
  const cloned = cloneInstalledScene(scene);
  return cloned === undefined ? {} : { scene: cloned };
}

function optionalInstalledFeatureScene(
  scene: InstalledRoomFeatureSceneRecord | undefined
): { scene: InstalledRoomFeatureSceneRecord } | Record<string, never> {
  const cloned = cloneInstalledFeatureScene(scene);
  return cloned === undefined ? {} : { scene: cloned };
}

function optionalI18nBaseDir(
  i18nBaseDir: string | undefined
): { i18nBaseDir: string } | Record<string, never> {
  return typeof i18nBaseDir === "string" ? { i18nBaseDir } : {};
}

function validateRoomBundle(candidate: unknown): RoomBundleValidationResult {
  const errors: string[] = [];

  if (isRecord(candidate) === false) {
    return {
      valid: false,
      errors: ["bundle must be an object"],
    };
  }

  if (candidate["schemaVersion"] !== ROOM_SCHEMA_VERSION) {
    errors.push(`schemaVersion must be ${String(ROOM_SCHEMA_VERSION)}`);
  }

  const manifestValidation = validateRoomManifest(candidate["manifest"]);
  if (manifestValidation.valid !== true || manifestValidation.manifest === undefined) {
    errors.push(...manifestValidation.errors.map((error) => `manifest.${error}`));
  }

  const filesRaw = candidate["files"];
  const files: Record<string, RoomBundleFile> = {};

  if (isRecord(filesRaw) === false) {
    errors.push("files must be an object");
  } else {
    for (const [rawPath, rawValue] of Object.entries(filesRaw)) {
      const relativePath = normalizeRoomRelativePath(rawPath);
      if (relativePath === null) {
        errors.push(`files[${rawPath}] has invalid path`);
        continue;
      }

      if (isRecord(rawValue) === false) {
        errors.push(`files[${relativePath}] must be an object`);
        continue;
      }

      if (rawValue["encoding"] !== "base64") {
        errors.push(`files[${relativePath}].encoding must be base64`);
        continue;
      }

      if (typeof rawValue["content"] !== "string") {
        errors.push(`files[${relativePath}].content must be a string`);
        continue;
      }

      files[relativePath] = {
        encoding: "base64",
        content: rawValue["content"],
      };
    }
  }

  const exportedAtRaw = candidate["exportedAt"];
  const exportedAt =
    typeof exportedAtRaw === "string" && exportedAtRaw.trim() !== ""
      ? exportedAtRaw.trim()
      : new Date().toISOString();

  if (
    errors.length > 0 ||
    manifestValidation.valid !== true ||
    manifestValidation.manifest === undefined
  ) {
    return {
      valid: false,
      errors,
    };
  }

  const { manifest } = manifestValidation;
  collectRoomManifestRequiredFilePaths(manifest).forEach((requiredPath) => {
    if (files[requiredPath] === undefined) {
      errors.push(`files missing required asset: ${requiredPath}`);
    }
  });

  if (errors.length > 0) {
    return {
      valid: false,
      errors,
    };
  }

  return {
    valid: true,
    errors: [],
    bundle: {
      schemaVersion: ROOM_SCHEMA_VERSION,
      manifest,
      files,
      exportedAt,
    },
  };
}

function createEmptyRegistry(): RoomRegistryState {
  return {
    version: ROOM_SCHEMA_VERSION,
    updatedAt: new Date().toISOString(),
    rooms: [],
  };
}

export function buildInstalledRoomRecord(
  manifest: RoomManifest,
  options: {
    sourceDir: string;
    installedDir: string;
    installedAt: string;
    updatedAt: string;
  }
): InstalledRoomRecord {
  const { sourceDir, installedDir, installedAt, updatedAt } = options;
  const features: InstalledRoomFeatureRecord[] = manifest.features.map((feature) => {
    const scene =
      feature.scene === undefined
        ? undefined
        : {
            hotspot: cloneSceneHotspot(feature.scene.hotspot),
            view: {
              id: feature.scene.view.id,
              backgroundPath: join(installedDir, feature.scene.view.backgroundSrc),
              ...(feature.scene.view.panelArtSrc !== undefined
                ? { panelArtPath: join(installedDir, feature.scene.view.panelArtSrc) }
                : {}),
              ...(feature.scene.view.transparentWindow !== undefined
                ? {
                    transparentWindow: cloneTransparentWindow(feature.scene.view.transparentWindow),
                  }
                : {}),
            },
          };

    return {
      id: feature.id,
      name: feature.name,
      ...(feature.description !== undefined ? { description: feature.description } : {}),
      ...(feature.icon !== undefined ? { icon: feature.icon } : {}),
      ...optionalCommandSpecs(feature.commandSpecs),
      ...optionalProtocolSpecs(feature.protocolSpecs),
      ...optionalInstalledFeatureScene(scene),
    };
  });

  const scene: InstalledRoomSceneRecord | undefined =
    manifest.scene === undefined
      ? undefined
      : {
          referenceSize: { ...manifest.scene.referenceSize },
          roomBackgroundPath: join(installedDir, manifest.scene.roomBackgroundSrc),
          roomsHotspot: cloneSceneHotspot(manifest.scene.roomsHotspot),
          backHotspot: cloneSceneHotspot(manifest.scene.backHotspot),
          ...(manifest.scene.characterRosterPreset !== undefined
            ? { characterRosterPreset: manifest.scene.characterRosterPreset }
            : {}),
          ...(manifest.scene.characters !== undefined
            ? { characters: cloneSceneCharacters(manifest.scene.characters) }
            : {}),
          ...(manifest.scene.chrome !== undefined
            ? { chrome: cloneSceneChrome(manifest.scene.chrome) }
            : {}),
        };

  const commandSpecs = flattenRoomCommandSpecs(manifest);
  const protocolSpecs = flattenRoomProtocolSpecs(manifest);

  return {
    id: manifest.id,
    name: manifest.name,
    version: manifest.version,
    ...optionalDescription(manifest.description),
    ...(manifest.menu.icon !== undefined ? { icon: manifest.menu.icon } : {}),
    sourceDir,
    installedDir,
    manifestPath: join(installedDir, "manifest.json"),
    runtimeEntryPath: join(installedDir, manifest.runtime.uiEntry),
    hostEntryPath: join(installedDir, manifest.runtime.hostEntry),
    defaultFeatureId: manifest.defaultFeatureId,
    features: cloneInstalledFeatures(features),
    ...optionalScene(scene),
    ...optionalI18nBaseDir(
      manifest.i18n !== undefined ? join(installedDir, manifest.i18n.baseDir) : undefined
    ),
    ...optionalCommandSpecs(commandSpecs),
    ...optionalProtocolSpecs(protocolSpecs),
    installedAt,
    updatedAt,
  };
}

async function collectFilesRecursive(
  baseDir: string,
  currentDir: string = baseDir
): Promise<Array<{ relativePath: string; absolutePath: string }>> {
  const entries = await readdir(currentDir, { withFileTypes: true });
  const nestedFiles = await Promise.all(
    entries.map(async (entry): Promise<Array<{ relativePath: string; absolutePath: string }>> => {
      if (entry.name === "dist" || entry.name === "node_modules") {
        return [];
      }
      const absolutePath = join(currentDir, entry.name);
      if (entry.isDirectory()) {
        return await collectFilesRecursive(baseDir, absolutePath);
      }
      const relativePath = absolutePath.slice(baseDir.length + 1).replace(/\\/g, "/");
      return [{ relativePath, absolutePath }];
    })
  );

  return nestedFiles
    .flat()
    .sort((left, right) => left.relativePath.localeCompare(right.relativePath));
}

function getInstalledRoomFileSnapshotPath(installedDir: string): string {
  return join(installedDir, INSTALLED_ROOM_FILE_SNAPSHOT);
}

async function writeInstalledRoomFileSnapshot(
  installedDir: string,
  relativePaths: string[]
): Promise<void> {
  const normalizedPaths = Array.from(
    new Set(relativePaths.map((path) => path.trim()).filter((path) => path !== ""))
  ).sort((left, right) => left.localeCompare(right));

  await writeFile(
    getInstalledRoomFileSnapshotPath(installedDir),
    JSON.stringify({ files: normalizedPaths }, null, 2),
    "utf8"
  );
}

async function readInstalledRoomFileSnapshot(installedDir: string): Promise<string[] | null> {
  const snapshotPath = getInstalledRoomFileSnapshotPath(installedDir);
  if (existsSync(snapshotPath) !== true) {
    return null;
  }

  try {
    const parsed = JSON.parse(await readFile(snapshotPath, "utf8")) as { files?: unknown };
    if (Array.isArray(parsed.files) !== true) {
      return null;
    }

    return parsed.files.filter(
      (value): value is string => typeof value === "string" && value.trim() !== ""
    );
  } catch {
    return null;
  }
}

function collectParentDirectories(relativePath: string): string[] {
  const directories: string[] = [];
  let current = dirname(relativePath);

  while (current !== "." && current !== "") {
    directories.push(current);
    const next = dirname(current);
    if (next === current) {
      break;
    }
    current = next;
  }

  return directories;
}

async function deleteInstalledRoomCopies(
  installedDir: string,
  relativePaths: string[]
): Promise<void> {
  const normalizedPaths = Array.from(
    new Set(
      [...relativePaths, INSTALLED_ROOM_FILE_SNAPSHOT]
        .map((path) => path.trim())
        .filter((path) => path !== "")
    )
  ).sort((left, right) => right.length - left.length);

  const parentDirectories = new Set<string>();
  // NOTE: Deletes are ordered to remove deepest paths first.
  /* eslint-disable no-await-in-loop */
  for (const relativePath of normalizedPaths) {
    await rm(join(installedDir, relativePath), { force: true });
    collectParentDirectories(relativePath).forEach((directory) => {
      parentDirectories.add(directory);
    });
  }

  for (const directory of Array.from(parentDirectories).sort(
    (left, right) => right.length - left.length
  )) {
    try {
      await rm(join(installedDir, directory), { force: true });
    } catch {
      // Ignore non-empty directories so user-created files remain in place.
    }
  }
  /* eslint-enable no-await-in-loop */

  try {
    await rm(installedDir, { force: true });
  } catch {
    // Ignore non-empty roots so user-created files remain in place.
  }
}

async function resolveInstalledRoomTrackedFiles(room: InstalledRoomRecord): Promise<string[]> {
  const snapshotFiles = await readInstalledRoomFileSnapshot(room.installedDir);
  if (snapshotFiles !== null) {
    return snapshotFiles;
  }

  if (existsSync(room.sourceDir) !== true) {
    return [];
  }

  return (await collectFilesRecursive(room.sourceDir)).map((file) => file.relativePath);
}

export class RoomPackageManager {
  private readonly workspaceRootOption: string | undefined;
  private readonly bundledWorkspaceRootOption: string | undefined;
  private readonly installedRootOption: string | undefined;
  private readonly registryPathOption: string | undefined;

  constructor(options: RoomManagerOptions = {}) {
    this.workspaceRootOption = options.workspaceRoot;
    this.bundledWorkspaceRootOption = options.bundledWorkspaceRoot;
    this.installedRootOption = options.installedRoot;
    this.registryPathOption = options.registryPath;
  }

  private getWorkspaceRoot(): string {
    return this.workspaceRootOption ?? Paths.getRoomsWorkspaceDir();
  }

  private getBundledWorkspaceRoot(): string {
    if (this.bundledWorkspaceRootOption !== undefined) {
      return this.bundledWorkspaceRootOption;
    }

    if (this.workspaceRootOption !== undefined) {
      return this.workspaceRootOption;
    }

    return Paths.getBundledRoomsDir();
  }

  private getInstalledRoot(): string {
    return this.installedRootOption ?? Paths.getInstalledRoomsDir();
  }

  private getDataRoot(): string {
    return dirname(this.getInstalledRoot());
  }

  private getRoomStorageRoot(roomId: string): string {
    return join(this.getDataRoot(), "room-storage", roomId);
  }

  private getRoomPartitionRoot(roomId: string): string {
    return join(this.getDataRoot(), "electron-user-data", "Partitions", `room-${roomId}`);
  }

  private async deletePersistentRoomData(roomId: string): Promise<void> {
    // NOTE: Full room cleanup is opt-in so reconnecting a workspace room can reuse prior state.
    await Promise.all([
      rm(this.getRoomStorageRoot(roomId), { recursive: true, force: true }),
      rm(this.getRoomPartitionRoot(roomId), { recursive: true, force: true }),
    ]);
  }

  private getRegistryPath(): string {
    return this.registryPathOption ?? Paths.getRoomsRegistryPath();
  }

  private getWorkspaceRoots(): RoomWorkspaceRoot[] {
    const writableRoot = this.getWorkspaceRoot();
    const bundledRoot = this.getBundledWorkspaceRoot();
    const dedupedRoots = new Map<string, RoomWorkspaceRoot>();

    dedupedRoots.set(resolve(writableRoot), {
      root: writableRoot,
      sourceKind: "workspace",
      readOnly: false,
    });

    const bundledKey = resolve(bundledRoot);
    if (!dedupedRoots.has(bundledKey)) {
      dedupedRoots.set(bundledKey, {
        root: bundledRoot,
        sourceKind: "bundle",
        readOnly: true,
      });
    }

    return Array.from(dedupedRoots.values());
  }

  private async readWorkspaceRoomsFromRoot(
    rootConfig: RoomWorkspaceRoot
  ): Promise<RoomWorkspaceEntry[]> {
    if (existsSync(rootConfig.root) !== true) {
      return [];
    }

    const entries = await readdir(rootConfig.root, { withFileTypes: true });
    const rooms = await Promise.all(
      entries.map(async (entry): Promise<RoomWorkspaceEntry | null> => {
        if (!entry.isDirectory() || entry.name.startsWith(".")) {
          return null;
        }

        const dirPath = join(rootConfig.root, entry.name);
        const manifestPath = join(dirPath, "manifest.json");
        const errors: string[] = [];
        let manifest: RoomManifest | undefined;

        if (!existsSync(manifestPath)) {
          errors.push("manifest.json missing");
        } else {
          try {
            const validation = validateRoomManifest(await readJsonFile<unknown>(manifestPath));
            errors.push(...validation.errors);
            manifest = validation.manifest;

            if (validation.valid && validation.manifest !== undefined) {
              collectRoomManifestRequiredFilePaths(validation.manifest).forEach((requiredPath) => {
                if (!existsSync(join(dirPath, requiredPath))) {
                  errors.push(`required asset missing: ${requiredPath}`);
                }
              });

              if (
                validation.manifest.i18n !== undefined &&
                !existsSync(join(dirPath, validation.manifest.i18n.baseDir))
              ) {
                errors.push(`i18n.baseDir missing: ${validation.manifest.i18n.baseDir}`);
              }
            }
          } catch (error) {
            errors.push(
              `manifest read failed: ${error instanceof Error ? error.message : String(error)}`
            );
          }
        }

        return {
          dirName: entry.name,
          dirPath,
          valid: errors.length === 0 && manifest !== undefined,
          errors,
          ...(manifest !== undefined ? { manifest } : {}),
          sourceKind: rootConfig.sourceKind,
          readOnly: rootConfig.readOnly,
        };
      })
    );

    return rooms.filter((room): room is RoomWorkspaceEntry => room !== null);
  }

  private pickPreferredWorkspaceRoom(
    current: RoomWorkspaceEntry,
    candidate: RoomWorkspaceEntry
  ): RoomWorkspaceEntry {
    const getPriority = (room: RoomWorkspaceEntry): number => {
      let score = room.valid === true ? 100 : 0;
      score += room.readOnly === true ? 0 : 10;
      score += room.sourceKind === "workspace" ? 1 : 0;
      return score;
    };

    return getPriority(candidate) > getPriority(current) ? candidate : current;
  }

  private isWritableWorkspaceRoomDir(dirPath: string): boolean {
    const workspaceRoot = resolve(this.getWorkspaceRoot());
    const normalizedDirPath = resolve(dirPath);
    const relativePath = relative(workspaceRoot, normalizedDirPath);

    return (
      relativePath === "" || (!relativePath.startsWith("..") && !relativePath.startsWith("../"))
    );
  }

  async ensureRoots(): Promise<void> {
    const workspaceRoot = this.getWorkspaceRoot();
    const installedRoot = this.getInstalledRoot();
    const registryPath = this.getRegistryPath();

    await Promise.all([
      ensureDir(workspaceRoot),
      ensureDir(installedRoot),
      ensureDir(dirname(registryPath)),
    ]);
  }

  async listWorkspaceRooms(): Promise<RoomWorkspaceEntry[]> {
    await this.ensureRoots();
    const rooms = (
      await Promise.all(
        this.getWorkspaceRoots().map(
          async (rootConfig) => await this.readWorkspaceRoomsFromRoot(rootConfig)
        )
      )
    ).flat();

    const dedupedRooms = new Map<string, RoomWorkspaceEntry>();
    for (const room of rooms) {
      const roomKey = room.manifest?.id ?? room.dirName;
      const current = dedupedRooms.get(roomKey);
      dedupedRooms.set(
        roomKey,
        current === undefined ? room : this.pickPreferredWorkspaceRoom(current, room)
      );
    }

    return Array.from(dedupedRooms.values()).sort((left, right) =>
      left.dirName.localeCompare(right.dirName)
    );
  }

  async listInstalledRooms(): Promise<InstalledRoomRecord[]> {
    const registry = await this.readRegistry();
    const hydrated = await Promise.all(
      registry.rooms.map(async (record) => await this.hydrateInstalledRoomRecord(record))
    );
    return hydrated
      .filter((record): record is InstalledRoomRecord => record !== null)
      .sort((left, right) => left.id.localeCompare(right.id));
  }

  async installFromWorkspace(roomId: string): Promise<RoomOperationResult> {
    const installedRoot = this.getInstalledRoot();
    const normalizedRoomId = normalizeRoomId(roomId);
    if (normalizedRoomId === "") {
      return { success: false, error: await roomPackageT("roomIdRequired") };
    }

    const workspaceRooms = await this.listWorkspaceRooms();
    const target = workspaceRooms.find(
      (entry) => entry.dirName === normalizedRoomId || entry.manifest?.id === normalizedRoomId
    );

    if (target === undefined) {
      return {
        success: false,
        error: await roomPackageT("roomNotFoundInWorkspace", { roomId: normalizedRoomId }),
      };
    }

    if (target.valid !== true || target.manifest === undefined) {
      return {
        success: false,
        error: await roomPackageError("workspaceInvalid", target.errors.join("; ")),
      };
    }

    const roomInstalledDir = join(installedRoot, target.manifest.id);
    await this.ensureRoots();
    const trackedFiles = await copyDirectoryContents(target.dirPath, roomInstalledDir);
    await writeInstalledRoomFileSnapshot(roomInstalledDir, trackedFiles);

    const now = new Date().toISOString();
    const record = buildInstalledRoomRecord(target.manifest, {
      sourceDir: target.dirPath,
      installedDir: roomInstalledDir,
      installedAt: now,
      updatedAt: now,
    });

    const runtimeStat = await stat(record.runtimeEntryPath).catch(() => null);
    const hostStat = await stat(record.hostEntryPath).catch(() => null);
    if (runtimeStat?.isFile() !== true) {
      return {
        success: false,
        error: await roomPackageT("installedRuntimeEntryMissing", {
          path: record.runtimeEntryPath,
        }),
      };
    }
    if (hostStat?.isFile() !== true) {
      return {
        success: false,
        error: await roomPackageT("installedHostEntryMissing", { path: record.hostEntryPath }),
      };
    }

    const registry = await this.readRegistry();
    registry.rooms = registry.rooms.filter((item) => item.id !== record.id);
    registry.rooms.push(record);
    registry.updatedAt = now;
    await this.writeRegistry(registry);

    return {
      success: true,
      room: record,
      restartRequired: true,
    };
  }

  async removeInstalledRoom(
    roomId: string,
    options: { deleteData?: boolean } = {}
  ): Promise<RoomOperationResult> {
    const normalizedRoomId = normalizeRoomId(roomId);
    if (normalizedRoomId === "") {
      return { success: false, error: await roomPackageT("roomIdRequired") };
    }

    const registry = await this.readRegistry();
    const current = registry.rooms.find((item) => item.id === normalizedRoomId);
    if (current === undefined) {
      return {
        success: false,
        error: await roomPackageT("installedRoomNotFound", { roomId: normalizedRoomId }),
      };
    }

    if (options.deleteData === true) {
      const deleteTasks: Promise<void>[] = [
        rm(current.installedDir, { recursive: true, force: true }),
        this.deletePersistentRoomData(current.id),
      ];

      if (this.isWritableWorkspaceRoomDir(current.sourceDir)) {
        deleteTasks.push(rm(current.sourceDir, { recursive: true, force: true }));
      }

      await Promise.all(deleteTasks);
    } else {
      const trackedFiles = await resolveInstalledRoomTrackedFiles(current);
      await deleteInstalledRoomCopies(current.installedDir, trackedFiles);
    }

    registry.rooms = registry.rooms.filter((item) => item.id !== normalizedRoomId);
    registry.updatedAt = new Date().toISOString();
    await this.writeRegistry(registry);

    return {
      success: true,
      room: current,
      restartRequired: true,
    };
  }

  async deleteWorkspaceRoom(
    roomId: string,
    options: { deleteData?: boolean } = {}
  ): Promise<RoomOperationResult> {
    const normalizedRoomId = normalizeRoomId(roomId);
    if (normalizedRoomId === "") {
      return { success: false, error: await roomPackageT("roomIdRequired") };
    }

    const workspaceRooms = await this.listWorkspaceRooms();
    const target = workspaceRooms.find(
      (entry) => entry.dirName === normalizedRoomId || entry.manifest?.id === normalizedRoomId
    );
    if (target === undefined) {
      return {
        success: false,
        error: await roomPackageT("roomNotFoundInWorkspace", { roomId: normalizedRoomId }),
      };
    }

    if (target.readOnly === true) {
      return {
        success: false,
        error: await roomPackageT("workspaceReadOnly", { path: target.dirPath }),
      };
    }

    await rm(target.dirPath, { recursive: true, force: true });

    let restartRequired = false;
    if (options.deleteData === true) {
      const installedRoomId = target.manifest?.id ?? target.dirName;
      await Promise.all([
        rm(join(this.getInstalledRoot(), installedRoomId), { recursive: true, force: true }),
        this.deletePersistentRoomData(installedRoomId),
      ]);

      const registry = await this.readRegistry();
      const nextRooms = registry.rooms.filter((item) => item.id !== installedRoomId);
      if (nextRooms.length !== registry.rooms.length) {
        registry.rooms = nextRooms;
        registry.updatedAt = new Date().toISOString();
        await this.writeRegistry(registry);
        restartRequired = true;
      }
    }

    return {
      success: true,
      path: target.dirPath,
      restartRequired,
    };
  }

  async exportInstalledRoomToWorkspace(
    roomId: string,
    options: { overwrite?: boolean } = {}
  ): Promise<RoomOperationResult> {
    const workspaceRoot = this.getWorkspaceRoot();
    const normalizedRoomId = normalizeRoomId(roomId);
    if (normalizedRoomId === "") {
      return { success: false, error: await roomPackageT("roomIdRequired") };
    }

    const registry = await this.readRegistry();
    const current = registry.rooms.find((item) => item.id === normalizedRoomId);
    if (current === undefined) {
      return {
        success: false,
        error: await roomPackageT("installedRoomNotFound", { roomId: normalizedRoomId }),
      };
    }

    const exportDir = join(workspaceRoot, current.id);
    await this.ensureRoots();
    if (existsSync(exportDir) && options.overwrite !== true) {
      return {
        success: false,
        error: await roomPackageT("workspaceRoomExists", { path: exportDir }),
      };
    }

    if (options.overwrite === true) {
      await rm(exportDir, { recursive: true, force: true });
    }
    await copyDirectoryContents(current.installedDir, exportDir);

    return { success: true, room: current, path: exportDir };
  }

  async packageWorkspaceRoom(
    roomId: string,
    options: { outputFile?: string } = {}
  ): Promise<RoomOperationResult> {
    const normalizedRoomId = normalizeRoomId(roomId);
    if (normalizedRoomId === "") {
      return { success: false, error: await roomPackageT("roomIdRequired") };
    }

    const workspaceRooms = await this.listWorkspaceRooms();
    const target = workspaceRooms.find(
      (entry) => entry.dirName === normalizedRoomId || entry.manifest?.id === normalizedRoomId
    );

    if (target?.manifest === undefined) {
      return {
        success: false,
        error: await roomPackageT("roomNotFoundInWorkspace", { roomId: normalizedRoomId }),
      };
    }

    const targetManifest = target.manifest;
    if (target.valid !== true) {
      return {
        success: false,
        error: await roomPackageError("workspaceInvalid", target.errors.join("; ")),
      };
    }

    const files = await collectFilesRecursive(target.dirPath);
    const bundleEntries = await Promise.all(
      files.map(async (file): Promise<[string, RoomBundleFile]> => {
        const content = await readFile(file.absolutePath);
        return [
          file.relativePath,
          {
            encoding: "base64",
            content: content.toString("base64"),
          },
        ];
      })
    );
    const bundleFiles: Record<string, RoomBundleFile> = {};
    bundleEntries.forEach(([relativePath, file]) => {
      bundleFiles[relativePath] = file;
    });

    const bundle: RoomBundle = {
      schemaVersion: ROOM_SCHEMA_VERSION,
      manifest: targetManifest,
      files: bundleFiles,
      exportedAt: new Date().toISOString(),
    };

    const outputFile =
      options.outputFile ?? join(target.dirPath, "dist", `${targetManifest.id}.hevroom.json`);
    await ensureDir(dirname(outputFile));
    await writeFile(outputFile, JSON.stringify(bundle, null, 2), "utf-8");

    return {
      success: true,
      path: outputFile,
    };
  }

  async importBundleFile(
    bundleFile: string,
    options: { overwriteWorkspace?: boolean } = {}
  ): Promise<RoomOperationResult> {
    const rawBundleFile = bundleFile.trim();
    if (rawBundleFile === "") {
      return { success: false, error: await roomPackageT("bundleFileRequired") };
    }
    const normalizedBundleFile = resolve(rawBundleFile);

    let candidate: unknown;
    try {
      candidate = await readJsonFile<unknown>(normalizedBundleFile);
    } catch (error) {
      return {
        success: false,
        error: await roomPackageError("bundleReadFailed", error),
      };
    }

    const validation = validateRoomBundle(candidate);
    if (validation.valid !== true || validation.bundle === undefined) {
      return {
        success: false,
        error: await roomPackageError("bundleInvalid", validation.errors.join("; ")),
      };
    }

    const { manifest, files } = validation.bundle;
    const workspaceDir = join(this.getWorkspaceRoot(), manifest.id);
    await this.ensureRoots();

    if (existsSync(workspaceDir) && options.overwriteWorkspace !== true) {
      return {
        success: false,
        error: await roomPackageT("workspaceRoomExists", { path: workspaceDir }),
      };
    }

    await rm(workspaceDir, { recursive: true, force: true });
    await ensureDir(workspaceDir);

    await Promise.all(
      Object.entries(files).map(async ([relativePath, file]): Promise<void> => {
        const targetPath = join(workspaceDir, relativePath);
        await ensureDir(dirname(targetPath));
        await writeFile(targetPath, Buffer.from(file.content, "base64"));
      })
    );

    await writeFile(
      join(workspaceDir, "manifest.json"),
      JSON.stringify(manifest, null, 2),
      "utf-8"
    );

    const installResult = await this.installFromWorkspace(manifest.id);
    if (installResult.success !== true) {
      return installResult;
    }

    return {
      success: true,
      ...(installResult.room !== undefined ? { room: installResult.room } : {}),
      path: workspaceDir,
      restartRequired: true,
    };
  }

  private async readRegistry(): Promise<RoomRegistryState> {
    const registryPath = this.getRegistryPath();
    await this.ensureRoots();
    if (!existsSync(registryPath)) {
      return createEmptyRegistry();
    }

    try {
      const parsed = await readJsonFile<Partial<RoomRegistryState>>(registryPath);
      if (parsed.version !== ROOM_SCHEMA_VERSION || !Array.isArray(parsed.rooms)) {
        return createEmptyRegistry();
      }
      return {
        version: ROOM_SCHEMA_VERSION,
        updatedAt:
          typeof parsed.updatedAt === "string" && parsed.updatedAt.trim() !== ""
            ? parsed.updatedAt
            : new Date().toISOString(),
        rooms: parsed.rooms,
      };
    } catch {
      return createEmptyRegistry();
    }
  }

  private async writeRegistry(registry: RoomRegistryState): Promise<void> {
    const registryPath = this.getRegistryPath();
    await this.ensureRoots();
    const normalized: RoomRegistryState = {
      version: ROOM_SCHEMA_VERSION,
      updatedAt: registry.updatedAt,
      rooms: registry.rooms.map((item) => ({
        ...item,
        sourceDir: resolve(item.sourceDir),
        installedDir: resolve(item.installedDir),
        manifestPath: resolve(item.manifestPath),
        runtimeEntryPath: resolve(item.runtimeEntryPath),
        hostEntryPath: resolve(item.hostEntryPath),
        features: item.features.map((feature) => ({
          ...buildInstalledFeatureRecord(feature),
          ...optionalInstalledFeatureScene(resolveInstalledFeatureScene(feature.scene)),
        })),
        ...optionalScene(resolveInstalledScene(item.scene)),
        ...optionalI18nBaseDir(
          item.i18nBaseDir !== undefined ? resolve(item.i18nBaseDir) : undefined
        ),
        ...optionalCommandSpecs(item.commandSpecs),
        ...optionalProtocolSpecs(item.protocolSpecs),
      })),
    };
    await writeFile(registryPath, JSON.stringify(normalized, null, 2), "utf-8");
  }

  private async hydrateInstalledRoomRecord(
    record: InstalledRoomRecord
  ): Promise<InstalledRoomRecord | null> {
    if (existsSync(record.manifestPath) === false) {
      return null;
    }

    try {
      const validation = validateRoomManifest(await readJsonFile<unknown>(record.manifestPath));
      if (validation.valid !== true || validation.manifest === undefined) {
        return null;
      }

      return buildInstalledRoomRecord(validation.manifest, {
        sourceDir: resolve(record.sourceDir),
        installedDir: resolve(record.installedDir),
        installedAt: record.installedAt,
        updatedAt: record.updatedAt,
      });
    } catch {
      return null;
    }
  }
}

let roomPackageManagerSingleton: RoomPackageManager | null = null;

export function getRoomPackageManager(): RoomPackageManager {
  roomPackageManagerSingleton ??= new RoomPackageManager();
  return roomPackageManagerSingleton;
}
