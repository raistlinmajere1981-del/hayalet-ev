import type {
  InstalledRoomRecord,
  RoomWorkspaceEntry,
  StartupRoomProtocolSnapshot,
  StartupRoomsSnapshot,
} from "@shared/index.js";
import { Logger, LogCategory } from "../logger/index.js";
import { RoomCommandRegistry } from "./room-command-registry.js";
import { RoomProtocolRegistry } from "./room-protocol-registry.js";
import { RoomHostRuntime } from "./room-host-runtime.js";

type RoomRegistryListener = (rooms: InstalledRoomRecord[]) => void;
const LIST_INSTALLED_TIMEOUT_MS = 5000;
const PROTOCOL_SYNC_TIMEOUT_MS = 5000;

function cloneRooms(rooms: InstalledRoomRecord[]): InstalledRoomRecord[] {
  return rooms.map((room) => ({
    ...room,
    ...(Array.isArray(room.commandSpecs)
      ? { commandSpecs: room.commandSpecs.map((spec) => ({ ...spec })) }
      : {}),
    ...(Array.isArray(room.protocolSpecs)
      ? { protocolSpecs: room.protocolSpecs.map((spec) => ({ ...spec })) }
      : {}),
  }));
}

function filterManagedInstalledRooms(rooms: InstalledRoomRecord[]): InstalledRoomRecord[] {
  return rooms.filter((room) => room.isWorkspaceFallback !== true);
}

async function delay(ms: number): Promise<void> {
  await new Promise((resolve) => setTimeout(resolve, ms));
}

async function withTimeout<T>(label: string, ms: number, task: () => Promise<T>): Promise<T> {
  const startedAt = performance.now();
  Logger.info(LogCategory.SYSTEM, `[startup] ${label}:start timeoutMs=${ms}`);
  const result = await Promise.race([
    task(),
    delay(ms).then(() => {
      throw new Error(`${label} timed out after ${ms}ms`);
    }),
  ]);
  Logger.info(
    LogCategory.SYSTEM,
    `[startup] ${label}:complete durationMs=${Math.round(performance.now() - startedAt)}`
  );
  return result;
}

class RoomRegistryClass {
  private installedRooms: InstalledRoomRecord[] = [];
  private listeners = new Set<RoomRegistryListener>();

  getInstalledRooms(): InstalledRoomRecord[] {
    return cloneRooms(this.installedRooms);
  }

  subscribe(listener: RoomRegistryListener): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  private emit(): void {
    const snapshot = this.getInstalledRooms();
    this.listeners.forEach((listener) => {
      try {
        listener(snapshot);
      } catch (error) {
        Logger.warnT(
          LogCategory.SYSTEM,
          "app.logs.roomRegistry.listenerFailed",
          { message: error instanceof Error ? error.message : String(error) },
          {
            error: error instanceof Error ? error.message : String(error),
          }
        );
      }
    });
  }

  async loadInstalledRooms(
    startupSnapshot: StartupRoomsSnapshot | null = null
  ): Promise<InstalledRoomRecord[]> {
    if (startupSnapshot !== null && Array.isArray(startupSnapshot.rooms)) {
      try {
        Logger.info(
          LogCategory.SYSTEM,
          `[startup] room-registry.startup-snapshot:using count=${startupSnapshot.rooms.length}`
        );
        return await this.applyInstalledRooms(startupSnapshot.rooms, {
          startupProtocols: startupSnapshot.protocols,
        });
      } catch (error) {
        Logger.warnT(
          LogCategory.SYSTEM,
          "app.logs.roomRegistry.refreshFailed",
          { message: error instanceof Error ? error.message : String(error) },
          {
            error: error instanceof Error ? error.message : String(error),
          }
        );
      }
    }

    const rooms = await this.fetchInstalledRooms();
    return await this.applyInstalledRooms(rooms);
  }

  private async fetchInstalledRooms(): Promise<InstalledRoomRecord[]> {
    const api = window.electronAPI;
    if (api === undefined || typeof api.roomsListInstalled !== "function") {
      Logger.warnT(LogCategory.SYSTEM, "app.logs.roomRegistry.installedRoomsUnavailable");
      return [];
    }

    try {
      const result = await withTimeout(
        "room-registry.list-installed",
        LIST_INSTALLED_TIMEOUT_MS,
        async () => await api.roomsListInstalled()
      );
      return result.success === true && Array.isArray(result.rooms)
        ? filterManagedInstalledRooms(result.rooms)
        : [];
    } catch (error) {
      Logger.warnT(
        LogCategory.SYSTEM,
        "app.logs.roomRegistry.refreshFailed",
        { message: error instanceof Error ? error.message : String(error) },
        {
          error: error instanceof Error ? error.message : String(error),
        }
      );
      return [];
    }
  }

  async refreshInstalledRooms(): Promise<InstalledRoomRecord[]> {
    this.installedRooms = cloneRooms(await this.fetchInstalledRooms());
    this.emit();
    return this.getInstalledRooms();
  }

  private async applyInstalledRooms(
    rooms: InstalledRoomRecord[],
    options: { startupProtocols?: StartupRoomProtocolSnapshot[] | null } = {}
  ): Promise<InstalledRoomRecord[]> {
    this.installedRooms = cloneRooms(filterManagedInstalledRooms(rooms));

    Logger.info(
      LogCategory.SYSTEM,
      `[startup] room-registry.command-sync:start count=${this.installedRooms.length}`
    );
    RoomCommandRegistry.syncInstalledRooms(this.installedRooms);
    Logger.info(LogCategory.SYSTEM, "[startup] room-registry.command-sync:complete");
    const protocolOptions =
      options.startupProtocols !== undefined ? { startupProtocols: options.startupProtocols } : {};
    await withTimeout("room-registry.protocol-sync", PROTOCOL_SYNC_TIMEOUT_MS, async () => {
      await RoomProtocolRegistry.syncInstalledRooms(this.installedRooms, protocolOptions);
    });
    Logger.info(LogCategory.SYSTEM, "[startup] room-registry.host-sync:start");
    RoomHostRuntime.syncInstalledRooms(this.installedRooms);
    Logger.info(LogCategory.SYSTEM, "[startup] room-registry.host-sync:complete");

    this.emit();
    return this.getInstalledRooms();
  }

  async listWorkspaceRooms(): Promise<RoomWorkspaceEntry[]> {
    const api = window.electronAPI;
    if (api === undefined || typeof api.roomsListWorkspace !== "function") {
      return [];
    }

    try {
      const result = await api.roomsListWorkspace();
      return result.success === true && Array.isArray(result.rooms) ? result.rooms : [];
    } catch (error) {
      Logger.warnT(
        LogCategory.SYSTEM,
        "app.logs.roomRegistry.workspaceListingFailed",
        { message: error instanceof Error ? error.message : String(error) },
        {
          error: error instanceof Error ? error.message : String(error),
        }
      );
      return [];
    }
  }

  async installFromWorkspace(roomId: string): Promise<{
    success: boolean;
    room?: InstalledRoomRecord;
    error?: string;
    restartRequired?: boolean;
  }> {
    const api = window.electronAPI;
    if (api === undefined || typeof api.roomsInstallFromWorkspace !== "function") {
      return {
        success: false,
        error: "roomsInstallFromWorkspace missing",
      };
    }

    return await api.roomsInstallFromWorkspace(roomId);
  }

  async importBundle(bundleFile: string): Promise<{
    success: boolean;
    room?: InstalledRoomRecord;
    path?: string;
    error?: string;
    restartRequired?: boolean;
  }> {
    const api = window.electronAPI;
    if (api === undefined || typeof api.roomsImportBundle !== "function") {
      return {
        success: false,
        error: "roomsImportBundle missing",
      };
    }

    return await api.roomsImportBundle({
      bundleFile,
      overwriteWorkspace: true,
    });
  }

  async removeInstalled(roomId: string): Promise<{
    success: boolean;
    room?: InstalledRoomRecord;
    error?: string;
    restartRequired?: boolean;
  }> {
    return await this.removeInstalledWithOptions({ roomId });
  }

  async removeInstalledWithOptions(payload: { roomId: string; deleteData?: boolean }): Promise<{
    success: boolean;
    room?: InstalledRoomRecord;
    error?: string;
    restartRequired?: boolean;
  }> {
    const api = window.electronAPI;
    if (api === undefined || typeof api.roomsRemoveInstalled !== "function") {
      return {
        success: false,
        error: "roomsRemoveInstalled missing",
      };
    }

    return await api.roomsRemoveInstalled(payload);
  }

  async deleteWorkspace(payload: { roomId: string; deleteData?: boolean }): Promise<{
    success: boolean;
    path?: string;
    error?: string;
    restartRequired?: boolean;
  }> {
    const api = window.electronAPI;
    if (api === undefined || typeof api.roomsDeleteWorkspace !== "function") {
      return {
        success: false,
        error: "roomsDeleteWorkspace missing",
      };
    }

    return await api.roomsDeleteWorkspace(payload);
  }
}

const roomRegistry = new RoomRegistryClass();

export { roomRegistry as RoomRegistry };
