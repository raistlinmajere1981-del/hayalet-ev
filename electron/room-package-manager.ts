import { readFile, readdir, rm, stat, writeFile } from "fs/promises";
import { existsSync } from "fs";
import { dirname, join, resolve } from "path";
import { formatErrorWithDetail } from "../shared/i18n/error-detail.ts";
import { Paths } from "./paths.ts";
import {
  copyDirectoryContents,
  collectFilesRecursive,
  deleteInstalledRoomCopies,
  ensureDir,
  INSTALLED_ROOM_FILE_SNAPSHOT,
  readJsonFile,
  resolveInstalledRoomTrackedFiles,
  writeInstalledRoomFileSnapshot,
} from "./rooms/room-install-files.ts";
import {
  validateRoomBundle,
} from "./rooms/room-bundle-validation.ts";
import {
  buildInstalledFeatureRecord,
  optionalCommandSpecs,
  optionalInstalledFeatureScene,
  optionalProtocolSpecs,
  optionalScene,
  resolveInstalledFeatureScene,
  resolveInstalledScene,
} from "./rooms/installed-room-record.ts";
import {
  buildInstalledRoomRecord,
  optionalI18nBaseDir,
} from "./rooms/installed-room-builder.ts";
import type {
  InstalledRoomRecord,
  RoomBundle,
  RoomBundleFile,
  RoomManifest,
  RoomRegistryState,
  RoomWorkspaceEntry,
} from "@shared/index.js";
import {
  ROOM_SCHEMA_VERSION,
  collectRoomManifestRequiredFilePaths,
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

interface RoomWorkspaceRoot {
  root: string;
  sourceKind: "workspace" | "bundle";
  readOnly: boolean;
}

export { buildInstalledRoomRecord };

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

function normalizeRoomId(rawValue: string): string {
  return rawValue.trim();
}

function createEmptyRegistry(): RoomRegistryState {
  return {
    version: ROOM_SCHEMA_VERSION,
    updatedAt: new Date().toISOString(),
    rooms: [],
  };
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
    await copyDirectoryContents(current.installedDir, exportDir, {
      includeRelativePath: (relativePath) =>
        relativePath !== INSTALLED_ROOM_FILE_SNAPSHOT &&
        relativePath !== "tools/runtime" &&
        relativePath.startsWith("tools/runtime/") === false &&
        relativePath !== "shared/data/tools/runtime" &&
        relativePath.startsWith("shared/data/tools/runtime/") === false,
    });

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
      options.outputFile ??
      join(this.getRoomStorageRoot(targetManifest.id), "exports", `${targetManifest.id}.hevroom.json`);
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
