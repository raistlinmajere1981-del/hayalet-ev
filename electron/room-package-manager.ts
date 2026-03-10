import { cp, mkdir, readFile, readdir, rm, stat, writeFile } from "fs/promises";
import { existsSync } from "fs";
import { dirname, join, resolve } from "path";
import { formatErrorWithDetail } from "../shared/i18n/error-detail.ts";
import { Paths } from "./paths.ts";
import type {
  InstalledRoomRecord,
  RoomBundle,
  RoomBundleFile,
  RoomCommandSpec,
  RoomManifest,
  RoomProtocolSpec,
  RoomRegistryState,
  RoomWorkspaceEntry,
} from "@shared/index.js";
import {
  ROOM_SCHEMA_VERSION,
  normalizeRoomRelativePath,
  validateRoomManifest,
} from "@shared/index.js";
import { translateElectronMessage } from "./i18n/language-service.ts";

interface RoomManagerOptions {
  workspaceRoot?: string;
  installedRoot?: string;
  registryPath?: string;
}

interface RoomOperationResult {
  success: boolean;
  error?: string;
  room?: InstalledRoomRecord;
  path?: string;
}

interface RoomBundleValidationResult {
  valid: boolean;
  errors: string[];
  bundle?: RoomBundle;
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

function optionalDescription(
  description: string | undefined
): { description: string } | Record<string, never> {
  return typeof description === "string" ? { description } : {};
}

function optionalCommandSpecs(
  commandSpecs: RoomCommandSpec[] | undefined
): { commandSpecs: RoomCommandSpec[] } | Record<string, never> {
  const cloned = cloneCommandSpecs(commandSpecs);
  return Array.isArray(cloned) ? { commandSpecs: cloned } : {};
}

function optionalProtocolSpecs(
  protocolSpecs: RoomProtocolSpec[] | undefined
): { protocolSpecs: RoomProtocolSpec[] } | Record<string, never> {
  const cloned = cloneProtocolSpecs(protocolSpecs);
  return Array.isArray(cloned) ? { protocolSpecs: cloned } : {};
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

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && Array.isArray(value) === false;
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
  if (files[manifest.uiEntry] === undefined) {
    errors.push(`files missing uiEntry: ${manifest.uiEntry}`);
  }
  if (files[manifest.hostEntry] === undefined) {
    errors.push(`files missing hostEntry: ${manifest.hostEntry}`);
  }

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

function withManifestMetadata(
  record: InstalledRoomRecord,
  manifest: RoomManifest | undefined
): InstalledRoomRecord {
  if (manifest === undefined) {
    return {
      ...record,
      ...optionalCommandSpecs(record.commandSpecs),
      ...optionalProtocolSpecs(record.protocolSpecs),
    };
  }

  return {
    ...record,
    ...optionalDescription(manifest.description),
    ...optionalCommandSpecs(manifest.commandSpecs),
    ...optionalProtocolSpecs(manifest.protocolSpecs),
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

export class RoomPackageManager {
  private readonly workspaceRootOption: string | undefined;
  private readonly installedRootOption: string | undefined;
  private readonly registryPathOption: string | undefined;

  constructor(options: RoomManagerOptions = {}) {
    this.workspaceRootOption = options.workspaceRoot;
    this.installedRootOption = options.installedRoot;
    this.registryPathOption = options.registryPath;
  }

  private getWorkspaceRoot(): string {
    return this.workspaceRootOption ?? join(Paths.getProjectRoot(), "rooms");
  }

  private getInstalledRoot(): string {
    return this.installedRootOption ?? Paths.getInstalledRoomsDir();
  }

  private getRegistryPath(): string {
    return this.registryPathOption ?? Paths.getRoomsRegistryPath();
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
    const workspaceRoot = this.getWorkspaceRoot();
    await this.ensureRoots();
    const entries = await readdir(workspaceRoot, { withFileTypes: true });
    const rooms = await Promise.all(
      entries.map(async (entry): Promise<RoomWorkspaceEntry | null> => {
        if (!entry.isDirectory() || entry.name.startsWith(".")) {
          return null;
        }

        const dirPath = join(workspaceRoot, entry.name);
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
              const uiEntryPath = join(dirPath, validation.manifest.uiEntry);
              const hostEntryPath = join(dirPath, validation.manifest.hostEntry);
              if (!existsSync(uiEntryPath)) {
                errors.push(`uiEntry missing: ${validation.manifest.uiEntry}`);
              }
              if (!existsSync(hostEntryPath)) {
                errors.push(`hostEntry missing: ${validation.manifest.hostEntry}`);
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
        };
      })
    );

    return rooms
      .filter((room): room is RoomWorkspaceEntry => room !== null)
      .sort((left, right) => left.dirName.localeCompare(right.dirName));
  }

  async listInstalledRooms(): Promise<InstalledRoomRecord[]> {
    const registry = await this.readRegistry();
    const hydrated = await Promise.all(
      registry.rooms.map(async (record) => await this.hydrateInstalledRoomRecord(record))
    );
    return hydrated.sort((left, right) => left.id.localeCompare(right.id));
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
    await rm(roomInstalledDir, { recursive: true, force: true });
    await cp(target.dirPath, roomInstalledDir, { recursive: true, force: true });

    const now = new Date().toISOString();
    const record: InstalledRoomRecord = {
      id: target.manifest.id,
      name: target.manifest.name,
      version: target.manifest.version,
      ...optionalDescription(target.manifest.description),
      sourceDir: target.dirPath,
      installedDir: roomInstalledDir,
      manifestPath: join(roomInstalledDir, "manifest.json"),
      runtimeEntryPath: join(roomInstalledDir, target.manifest.uiEntry),
      hostEntryPath: join(roomInstalledDir, target.manifest.hostEntry),
      ...optionalCommandSpecs(target.manifest.commandSpecs),
      ...optionalProtocolSpecs(target.manifest.protocolSpecs),
      installedAt: now,
      updatedAt: now,
    };

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
    };
  }

  async removeInstalledRoom(roomId: string): Promise<RoomOperationResult> {
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

    await rm(current.installedDir, { recursive: true, force: true });
    registry.rooms = registry.rooms.filter((item) => item.id !== normalizedRoomId);
    registry.updatedAt = new Date().toISOString();
    await this.writeRegistry(registry);

    return { success: true, room: current };
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
    await cp(current.installedDir, exportDir, { recursive: true, force: true });

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
    };
  }

  private async readRegistry(): Promise<RoomRegistryState> {
    const registryPath = this.getRegistryPath();
    await this.ensureRoots();
    if (!existsSync(registryPath)) {
      return createEmptyRegistry();
    }

    try {
      const parsed = await readJsonFile<RoomRegistryState>(registryPath);
      return {
        version: ROOM_SCHEMA_VERSION,
        updatedAt:
          typeof parsed.updatedAt === "string" && parsed.updatedAt.trim() !== ""
            ? parsed.updatedAt
            : new Date().toISOString(),
        rooms: Array.isArray(parsed.rooms) ? parsed.rooms : [],
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
        ...optionalCommandSpecs(item.commandSpecs),
        ...optionalProtocolSpecs(item.protocolSpecs),
      })),
    };
    await writeFile(registryPath, JSON.stringify(normalized, null, 2), "utf-8");
  }

  private async hydrateInstalledRoomRecord(
    record: InstalledRoomRecord
  ): Promise<InstalledRoomRecord> {
    if (existsSync(record.manifestPath) === false) {
      return {
        ...record,
        ...optionalCommandSpecs(record.commandSpecs),
        ...optionalProtocolSpecs(record.protocolSpecs),
      };
    }

    try {
      const validation = validateRoomManifest(await readJsonFile<unknown>(record.manifestPath));
      return withManifestMetadata(record, validation.valid ? validation.manifest : undefined);
    } catch {
      return {
        ...record,
        ...optionalCommandSpecs(record.commandSpecs),
        ...optionalProtocolSpecs(record.protocolSpecs),
      };
    }
  }
}

let roomPackageManagerSingleton: RoomPackageManager | null = null;

export function getRoomPackageManager(): RoomPackageManager {
  roomPackageManagerSingleton ??= new RoomPackageManager();
  return roomPackageManagerSingleton;
}
