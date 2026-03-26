import type {
  InstalledRoomRecord,
  RoomProtocolSpec,
  StartupRoomProtocolSnapshot,
} from "@shared/index.js";
import { decodeBase64 } from "../../constants/index.js";
import { resolveRoomProtocolFilePath } from "@shared/index.js";
import { Logger, LogCategory } from "../logger/index.js";

interface RoomProtocolEntry {
  roomId: string;
  key: string;
  room: string;
  scenario: string;
  title: string;
  editable: boolean;
  defaultBody: string;
}

function normalizeProtocolKey(key: string): string {
  return key.trim().toLowerCase();
}

function buildScenarioKey(room: string, scenario: string): string {
  return `${room.trim().toLowerCase()}::${scenario.trim().toLowerCase()}`;
}

function buildStartupProtocolKey(roomId: string, key: string): string {
  return `${roomId}::${normalizeProtocolKey(key)}`;
}

function decodeProtocolBody(content: string): string {
  const trimmed = content.trim();
  if (trimmed === "") {
    return "";
  }

  const looksLikeBase64 = trimmed.length % 4 === 0 && /^[A-Za-z0-9+/]+={0,2}$/.test(trimmed);
  if (looksLikeBase64 !== true) {
    return content;
  }

  const decoded = decodeBase64(trimmed);
  return decoded.trim() !== "" ? decoded : content;
}

class RoomProtocolRegistryClass {
  private entriesByKey = new Map<string, RoomProtocolEntry>();
  private keyByScenario = new Map<string, string>();
  private runtimeBodiesByRoom = new Map<string, Record<string, string>>();

  async syncInstalledRooms(
    rooms: InstalledRoomRecord[],
    options: { startupProtocols?: StartupRoomProtocolSnapshot[] | null } = {}
  ): Promise<void> {
    const nextEntries = new Map<string, RoomProtocolEntry>();
    const nextScenarioMap = new Map<string, string>();
    const activeRoomIds = new Set(rooms.map((room) => room.id));
    const startupProtocolBodies = new Map(
      (options.startupProtocols ?? []).map((protocol) => [
        buildStartupProtocolKey(protocol.roomId, protocol.key),
        protocol.body,
      ])
    );
    const resolvedProtocols = (
      await Promise.all(
        rooms.map(
          async (room) =>
            await Promise.all(
              (room.protocolSpecs ?? []).map(async (spec) => ({
                room,
                spec,
                defaultBody: await this.readProtocolDefaultBody(room, spec, startupProtocolBodies),
              }))
            )
        )
      )
    ).flat();

    Array.from(this.runtimeBodiesByRoom.keys()).forEach((roomId) => {
      if (activeRoomIds.has(roomId) === false) {
        this.runtimeBodiesByRoom.delete(roomId);
      }
    });

    for (const { room, spec, defaultBody } of resolvedProtocols) {
      const key = normalizeProtocolKey(spec.key);
      if (key === "") {
        continue;
      }

      const existing = nextEntries.get(key);
      if (existing !== undefined && existing.roomId !== room.id) {
        Logger.warnT(
          LogCategory.SYSTEM,
          "app.logs.roomProtocolRegistry.collisionSkipped",
          {
            protocolKey: spec.key,
            existingRoomId: existing.roomId,
            skippedRoomId: room.id,
          },
          {
            context: {
              protocolKey: spec.key,
              existingRoomId: existing.roomId,
              skippedRoomId: room.id,
            },
          }
        );
        continue;
      }

      nextEntries.set(key, {
        roomId: room.id,
        key: spec.key,
        room: spec.room,
        scenario: spec.scenario,
        title: spec.title,
        editable: spec.editable !== false,
        defaultBody,
      });
      nextScenarioMap.set(buildScenarioKey(spec.room, spec.scenario), key);
    }

    this.entriesByKey = nextEntries;
    this.keyByScenario = nextScenarioMap;
  }

  registerRuntimeProtocols(roomId: string, protocols: Record<string, string>): void {
    const next: Record<string, string> = {};
    Object.entries(protocols).forEach(([key, value]) => {
      const trimmedKey = key.trim();
      if (trimmedKey === "") {
        return;
      }
      next[trimmedKey] = typeof value === "string" ? value : "";
    });
    this.runtimeBodiesByRoom.set(roomId, next);
  }

  clearRuntimeProtocols(roomId: string): void {
    this.runtimeBodiesByRoom.delete(roomId);
  }

  resolve(room: string, scenario: string): RoomProtocolEntry | null {
    const key = this.keyByScenario.get(buildScenarioKey(room, scenario));
    if (key === undefined) {
      return null;
    }
    return this.entriesByKey.get(key) ?? null;
  }

  mergeProtocolMap(protocols: Record<string, string>): Record<string, string> {
    const merged: Record<string, string> = {};

    Array.from(this.entriesByKey.values()).forEach((entry) => {
      merged[entry.key] = entry.defaultBody;
    });

    Array.from(this.runtimeBodiesByRoom.entries()).forEach(([roomId, protocolMap]) => {
      if (
        Array.from(this.entriesByKey.values()).some((entry) => entry.roomId === roomId) === false
      ) {
        return;
      }
      Object.entries(protocolMap).forEach(([key, value]) => {
        merged[key] = value;
      });
    });

    return {
      ...merged,
      ...protocols,
    };
  }

  listKnownKeys(): string[] {
    return Array.from(this.entriesByKey.values())
      .map((entry) => entry.key)
      .sort((left, right) => left.localeCompare(right));
  }

  reset(): void {
    this.entriesByKey.clear();
    this.keyByScenario.clear();
    this.runtimeBodiesByRoom.clear();
  }

  private async readProtocolDefaultBody(
    room: InstalledRoomRecord,
    spec: RoomProtocolSpec,
    startupProtocolBodies: Map<string, string>
  ): Promise<string> {
    const startupBody = startupProtocolBodies.get(buildStartupProtocolKey(room.id, spec.key));
    if (typeof startupBody === "string") {
      return startupBody;
    }

    if (typeof window === "undefined") {
      return "";
    }

    const relativeProtocolPath = resolveRoomProtocolFilePath(spec);
    if (relativeProtocolPath === null) {
      return "";
    }

    const readFile = window.electronAPI?.readFile;
    if (typeof readFile !== "function") {
      return "";
    }

    const protocolPath = `${room.installedDir.replace(/\\/g, "/")}/${relativeProtocolPath}`;
    try {
      const content = await readFile(protocolPath);
      return typeof content === "string" ? decodeProtocolBody(content) : "";
    } catch {
      return "";
    }
  }
}

const roomProtocolRegistry = new RoomProtocolRegistryClass();

export { roomProtocolRegistry as RoomProtocolRegistry };
