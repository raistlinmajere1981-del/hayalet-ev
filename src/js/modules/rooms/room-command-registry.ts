import type {
  InstalledRoomRecord,
  RoomCommandExposure,
  RoomCommandScope,
} from "@shared/index.js";
import { AppI18n } from "../i18n/index.js";
import { Logger, LogCategory } from "../logger/index.js";

export type RoomCommandCategory = "ai1-ai2" | "ai0" | "us1";

export interface RoomCommandMetadata {
  roomId: string;
  name: string;
  description: string;
  scope: RoomCommandScope;
  category: RoomCommandCategory;
  exposure: RoomCommandExposure;
}

export interface RoomCommandHandlerPayload extends Record<string, unknown> {
  roomId: string;
  roomCommand: string;
  roomArgs: unknown;
  rawArgs: string;
  roomPayload?: unknown;
}

export type RoomCommandHandler = (payload: RoomCommandHandlerPayload) => unknown;

interface RoomCommandEntry {
  metadata: RoomCommandMetadata;
  handler?: RoomCommandHandler;
}

function normalizeCommandName(commandName: string): string {
  return commandName.trim().toLowerCase();
}

function scopeToCategory(scope: RoomCommandScope): RoomCommandCategory {
  if (scope === "assistant") {
    return "ai0";
  }
  if (scope === "us1") {
    return "us1";
  }
  return "ai1-ai2";
}

function normalizeScope(scope: RoomCommandScope | undefined): RoomCommandScope {
  return scope ?? "system";
}

function normalizeDescription(
  description: string | undefined,
  roomId: string,
  name: string
): string {
  const trimmed = description?.trim() ?? "";
  return trimmed !== "" ? trimmed : `${roomId} room command: ${name}`;
}

function normalizeExposure(exposure: RoomCommandExposure | undefined): RoomCommandExposure {
  return exposure === "internal" ? "internal" : "public";
}

function roomCommandT(key: string, params?: Record<string, string | number>): string {
  return AppI18n.t(`app.roomPage.commandErrors.${key}`, params);
}

function toRecord(value: unknown): Record<string, unknown> {
  if (value !== null && typeof value === "object" && Array.isArray(value) === false) {
    return value as Record<string, unknown>;
  }
  return {};
}

function parseRoomArgs(args: string): unknown {
  const trimmed = args.trim();
  if (trimmed === "") {
    return null;
  }

  try {
    return JSON.parse(trimmed) as unknown;
  } catch {
    return trimmed;
  }
}

function isScopeAllowed(scope: RoomCommandScope, provider: string): boolean {
  if (provider === "room-ui") {
    return scope === "room-ui" || scope === "system";
  }

  if (provider === "ai0") {
    return scope === "assistant" || scope === "system";
  }

  if (provider === "ai1" || provider === "ai2") {
    return scope === "ai-slots" || scope === "system";
  }

  if (provider === "us1") {
    return scope === "us1" || scope === "system";
  }

  return false;
}

class RoomCommandRegistryClass {
  private entries = new Map<string, RoomCommandEntry>();

  syncInstalledRooms(rooms: InstalledRoomRecord[]): void {
    const nextEntries = new Map<string, RoomCommandEntry>();

    rooms.forEach((room) => {
      (room.commandSpecs ?? []).forEach((spec) => {
        const key = normalizeCommandName(spec.name);
        if (key === "") {
          return;
        }

        const nextExisting = nextEntries.get(key);
        const current = nextExisting ?? this.entries.get(key);
        if (current !== undefined && current.metadata.roomId !== room.id) {
          Logger.warnT(
            LogCategory.SERVER_COMMANDS,
            "app.logs.roomCommandRegistry.collisionSkipped",
            {
              commandName: spec.name,
              existingRoomId: current.metadata.roomId,
              skippedRoomId: room.id,
            },
            {
              context: {
                commandName: spec.name,
                existingRoomId: current.metadata.roomId,
                skippedRoomId: room.id,
              },
            }
          );
          nextEntries.set(key, current);
          return;
        }

        const metadata: RoomCommandMetadata = {
          roomId: room.id,
          name: spec.name,
          description: normalizeDescription(spec.description, room.id, spec.name),
          scope: normalizeScope(spec.scope),
          category: scopeToCategory(normalizeScope(spec.scope)),
          exposure: normalizeExposure(spec.exposure),
        };

        nextEntries.set(key, {
          metadata,
          ...(current?.handler !== undefined ? { handler: current.handler } : {}),
        });
      });
    });

    this.entries = nextEntries;
  }

  registerHandler(
    roomId: string,
    commandName: string,
    handler: RoomCommandHandler,
    options: {
      description?: string;
      scope?: RoomCommandScope;
    } = {}
  ): void {
    const key = normalizeCommandName(commandName);
    if (key === "") {
      throw new Error(roomCommandT("commandNameRequired"));
    }

    const existing = this.entries.get(key);
    if (existing !== undefined && existing.metadata.roomId !== roomId) {
      throw new Error(roomCommandT("commandCollision", { commandName }));
    }

    const scope = normalizeScope(options.scope ?? existing?.metadata.scope);
    const metadata: RoomCommandMetadata = {
      roomId,
      name: existing?.metadata.name ?? commandName,
      description: normalizeDescription(
        options.description ?? existing?.metadata.description,
        roomId,
        commandName
      ),
      scope,
      category: scopeToCategory(scope),
      exposure: existing?.metadata.exposure ?? "public",
    };

    this.entries.set(key, {
      metadata,
      handler,
    });
  }

  unregisterRoom(roomId: string): void {
    Array.from(this.entries.entries()).forEach(([key, entry]) => {
      if (entry.metadata.roomId === roomId) {
        this.entries.delete(key);
      }
    });
  }

  has(commandName: string): boolean {
    return this.entries.has(normalizeCommandName(commandName));
  }

  getMetadata(commandName: string): RoomCommandMetadata | null {
    return this.entries.get(normalizeCommandName(commandName))?.metadata ?? null;
  }

  listCommands(category?: RoomCommandCategory): string[] {
    return Array.from(this.entries.values())
      .filter((entry) => (category !== undefined ? entry.metadata.category === category : true))
      .map((entry) => entry.metadata.name)
      .sort((left, right) => left.localeCompare(right));
  }

  listPublicCommands(category?: RoomCommandCategory): string[] {
    return Array.from(this.entries.values())
      .filter((entry) => entry.metadata.exposure === "public")
      .filter((entry) => (category !== undefined ? entry.metadata.category === category : true))
      .map((entry) => entry.metadata.name)
      .sort((left, right) => left.localeCompare(right));
  }

  getCatalog(category?: RoomCommandCategory): Array<{
    name: string;
    category: RoomCommandCategory;
    isCustom: boolean;
    supportsTestMode: boolean;
  }> {
    return Array.from(this.entries.values())
      .filter((entry) => entry.metadata.exposure === "public")
      .filter((entry) => (category !== undefined ? entry.metadata.category === category : true))
      .map((entry) => ({
        name: entry.metadata.name,
        category: entry.metadata.category,
        isCustom: true,
        supportsTestMode: false,
      }))
      .sort((left, right) => left.name.localeCompare(right.name));
  }

  getDescriptionText(commandName: string): string {
    const metadata = this.getMetadata(commandName);
    if (metadata === null) {
      return "";
    }

    return `${metadata.description}\n\nRoom: ${metadata.roomId}\nScope: ${metadata.scope}`;
  }

  async run(commandName: string, payload: Record<string, unknown> = {}): Promise<unknown> {
    const entry = this.entries.get(normalizeCommandName(commandName));
    if (entry === undefined) {
      return { success: false, message: roomCommandT("undefinedCommand") };
    }

    if (entry.handler === undefined) {
      return { success: false, message: roomCommandT("hostNotReady") };
    }

    const provider = typeof payload["provider"] === "string" ? payload["provider"] : "";
    if (isScopeAllowed(entry.metadata.scope, provider) !== true) {
      return { success: false, message: roomCommandT("outOfScope") };
    }

    const rawArgs = typeof payload["args"] === "string" ? payload["args"] : "";
    const roomPayload = payload["roomPayload"];
    const roomArgs = roomPayload !== undefined ? roomPayload : parseRoomArgs(rawArgs);
    const normalizedPayload: RoomCommandHandlerPayload = {
      ...toRecord(payload),
      roomId: entry.metadata.roomId,
      roomCommand: entry.metadata.name,
      roomArgs,
      rawArgs,
      ...(roomPayload !== undefined ? { roomPayload } : {}),
    };

    return await entry.handler(normalizedPayload);
  }

  reset(): void {
    this.entries.clear();
  }
}

const roomCommandRegistry = new RoomCommandRegistryClass();

export { roomCommandRegistry as RoomCommandRegistry };
