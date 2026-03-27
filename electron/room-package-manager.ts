import { rm } from "fs/promises";
import { dirname, join } from "path";
import { formatErrorWithDetail } from "../shared/i18n/error-detail.ts";
import { Paths } from "./paths.ts";
import { ensureDir } from "./rooms/room-install-files.ts";
import { buildInstalledRoomRecord } from "./rooms/installed-room-builder.ts";
import type { RoomOperationResult } from "./rooms/room-package-types.ts";
import {
  importRoomBundleFile,
  packageWorkspaceRoomBundle,
} from "./rooms/room-bundle-operations.ts";
import {
  hydrateInstalledRoomRecord,
  readRoomRegistry,
  writeRoomRegistry,
} from "./rooms/room-registry.ts";
import {
  deleteWorkspaceRoomOperation,
  exportInstalledRoomToWorkspaceOperation,
  installRoomFromWorkspace,
  removeInstalledRoomOperation,
} from "./rooms/workspace-room-operations.ts";
import {
  buildRoomWorkspaceRoots,
  pickPreferredWorkspaceRoom,
  readWorkspaceRoomsFromRoot,
} from "./rooms/workspace-discovery.ts";
import type { InstalledRoomRecord, RoomRegistryState, RoomWorkspaceEntry } from "@shared/index.js";
import { translateElectronMessage } from "./i18n/language-service.ts";

interface RoomManagerOptions {
  workspaceRoot?: string;
  bundledWorkspaceRoot?: string;
  installedRoot?: string;
  registryPath?: string;
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
        buildRoomWorkspaceRoots(this.getWorkspaceRoot(), this.getBundledWorkspaceRoot()).map(
          async (rootConfig) => await readWorkspaceRoomsFromRoot(rootConfig)
        )
      )
    ).flat();

    const dedupedRooms = new Map<string, RoomWorkspaceEntry>();
    for (const room of rooms) {
      const roomKey = room.manifest?.id ?? room.dirName;
      const current = dedupedRooms.get(roomKey);
      dedupedRooms.set(
        roomKey,
        current === undefined ? room : pickPreferredWorkspaceRoom(current, room)
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
    return await installRoomFromWorkspace({
      ensureRoots: async () => {
        await this.ensureRoots();
      },
      installedRoot: this.getInstalledRoot(),
      listWorkspaceRooms: async () => await this.listWorkspaceRooms(),
      readRegistry: async () => await this.readRegistry(),
      roomId,
      roomPackageError,
      roomPackageT,
      writeRegistry: async (registry) => {
        await this.writeRegistry(registry);
      },
    });
  }

  async removeInstalledRoom(
    roomId: string,
    options: { deleteData?: boolean } = {}
  ): Promise<RoomOperationResult> {
    return await removeInstalledRoomOperation({
      deletePersistentRoomData: async (targetRoomId) => {
        await this.deletePersistentRoomData(targetRoomId);
      },
      options,
      readRegistry: async () => await this.readRegistry(),
      roomId,
      roomPackageT,
      writeRegistry: async (registry) => {
        await this.writeRegistry(registry);
      },
    });
  }

  async deleteWorkspaceRoom(
    roomId: string,
    options: { deleteData?: boolean } = {}
  ): Promise<RoomOperationResult> {
    return await deleteWorkspaceRoomOperation({
      deletePersistentRoomData: async (targetRoomId) => {
        await this.deletePersistentRoomData(targetRoomId);
      },
      installedRoot: this.getInstalledRoot(),
      listWorkspaceRooms: async () => await this.listWorkspaceRooms(),
      options,
      readRegistry: async () => await this.readRegistry(),
      roomId,
      roomPackageT,
      writeRegistry: async (registry) => {
        await this.writeRegistry(registry);
      },
    });
  }

  async exportInstalledRoomToWorkspace(
    roomId: string,
    options: { overwrite?: boolean } = {}
  ): Promise<RoomOperationResult> {
    return await exportInstalledRoomToWorkspaceOperation({
      ensureRoots: async () => {
        await this.ensureRoots();
      },
      options,
      readRegistry: async () => await this.readRegistry(),
      roomId,
      roomPackageT,
      workspaceRoot: this.getWorkspaceRoot(),
    });
  }

  async packageWorkspaceRoom(
    roomId: string,
    options: { outputFile?: string } = {}
  ): Promise<RoomOperationResult> {
    return await packageWorkspaceRoomBundle({
      getRoomStorageRoot: (targetRoomId) => this.getRoomStorageRoot(targetRoomId),
      roomId,
      roomPackageError,
      roomPackageT,
      workspaceRooms: await this.listWorkspaceRooms(),
      ...(options.outputFile !== undefined ? { outputFile: options.outputFile } : {}),
    });
  }

  async importBundleFile(
    bundleFile: string,
    options: { overwriteWorkspace?: boolean } = {}
  ): Promise<RoomOperationResult> {
    return await importRoomBundleFile({
      bundleFile,
      ensureRoots: async () => {
        await this.ensureRoots();
      },
      getWorkspaceRoot: () => this.getWorkspaceRoot(),
      installFromWorkspace: async (roomIdToInstall) =>
        await this.installFromWorkspace(roomIdToInstall),
      options,
      roomPackageError,
      roomPackageT,
    });
  }

  private async readRegistry(): Promise<RoomRegistryState> {
    return await readRoomRegistry(this.getRegistryPath(), async () => {
      await this.ensureRoots();
    });
  }

  private async writeRegistry(registry: RoomRegistryState): Promise<void> {
    await writeRoomRegistry(this.getRegistryPath(), registry, async () => {
      await this.ensureRoots();
    });
  }

  private async hydrateInstalledRoomRecord(
    record: InstalledRoomRecord
  ): Promise<InstalledRoomRecord | null> {
    return await hydrateInstalledRoomRecord(record);
  }
}

let roomPackageManagerSingleton: RoomPackageManager | null = null;

export function getRoomPackageManager(): RoomPackageManager {
  roomPackageManagerSingleton ??= new RoomPackageManager();
  return roomPackageManagerSingleton;
}
