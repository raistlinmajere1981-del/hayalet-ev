import type { InstalledRoomRecord, RoomWorkspaceEntry } from "@shared/index.js";
import { Logger, LogCategory } from "../logger/index.js";
import { RoomCommandRegistry } from "./room-command-registry.js";
import { RoomProtocolRegistry } from "./room-protocol-registry.js";
import { RoomHostRuntime } from "./room-host-runtime.js";

type RoomRegistryListener = (rooms: InstalledRoomRecord[]) => void;

function cloneRooms(rooms: InstalledRoomRecord[]): InstalledRoomRecord[] {
  return rooms.map((room) => ({ ...room }));
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
        Logger.warn(LogCategory.SYSTEM, "RoomRegistry listener failed", {
          error: error instanceof Error ? error.message : String(error),
        });
      }
    });
  }

  async loadInstalledRooms(): Promise<InstalledRoomRecord[]> {
    return await this.refreshInstalledRooms();
  }

  async refreshInstalledRooms(): Promise<InstalledRoomRecord[]> {
    const api = window.electronAPI;
    if (api === undefined || typeof api.roomsListInstalled !== "function") {
      Logger.warn(
        LogCategory.SYSTEM,
        "RoomRegistry skipped: electronAPI.roomsListInstalled missing"
      );
      this.installedRooms = [];
      RoomCommandRegistry.reset();
      RoomProtocolRegistry.reset();
      RoomHostRuntime.syncInstalledRooms([]);
      this.emit();
      return [];
    }

    try {
      const result = await api.roomsListInstalled();
      if (result.success === true && Array.isArray(result.rooms)) {
        this.installedRooms = result.rooms.map((room) => ({ ...room }));
      } else {
        this.installedRooms = [];
      }

      RoomCommandRegistry.syncInstalledRooms(this.installedRooms);
      await RoomProtocolRegistry.syncInstalledRooms(this.installedRooms);
      RoomHostRuntime.syncInstalledRooms(this.installedRooms);
    } catch (error) {
      this.installedRooms = [];
      RoomCommandRegistry.reset();
      RoomProtocolRegistry.reset();
      RoomHostRuntime.syncInstalledRooms([]);
      Logger.warn(LogCategory.SYSTEM, "RoomRegistry refresh failed", {
        error: error instanceof Error ? error.message : String(error),
      });
    }

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
      Logger.warn(LogCategory.SYSTEM, "RoomRegistry workspace listing failed", {
        error: error instanceof Error ? error.message : String(error),
      });
      return [];
    }
  }

  async installFromWorkspace(roomId: string): Promise<boolean> {
    const api = window.electronAPI;
    if (api === undefined || typeof api.roomsInstallFromWorkspace !== "function") {
      return false;
    }

    const result = await api.roomsInstallFromWorkspace(roomId);
    if (result.success !== true) {
      return false;
    }

    await this.refreshInstalledRooms();
    return true;
  }

  async importBundle(bundleFile: string): Promise<{
    success: boolean;
    room?: InstalledRoomRecord;
    path?: string;
    error?: string;
  }> {
    const api = window.electronAPI;
    if (api === undefined || typeof api.roomsImportBundle !== "function") {
      return {
        success: false,
        error: "roomsImportBundle missing",
      };
    }

    const result = await api.roomsImportBundle({
      bundleFile,
      overwriteWorkspace: true,
    });

    if (result.success === true) {
      await this.refreshInstalledRooms();
    }

    return result;
  }
}

const roomRegistry = new RoomRegistryClass();

export { roomRegistry as RoomRegistry };
