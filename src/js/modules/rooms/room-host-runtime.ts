import type { InstalledRoomRecord, RoomCommandScope } from "@shared/index.js";
import { getErrorMessage } from "@shared/index.js";
import { CoreEngine } from "../core-engine.js";
import { Logger, LogCategory } from "../logger/index.js";
import { ServerCommands } from "../server-commands.js";
import { RoomCommandRegistry, type RoomCommandHandler } from "./room-command-registry.js";
import { RoomProtocolRegistry } from "./room-protocol-registry.js";
import { decodeRoomHostSource } from "./room-host-source.js";

interface RoomBridge {
  sendToRoom: (payload: Record<string, unknown>) => void;
}

interface RoomHostHooks {
  onRoomReady: ((payload: unknown, api: RoomHostApi) => Promise<void> | void) | undefined;
  onRoomEvent: ((payload: unknown, api: RoomHostApi) => Promise<void> | void) | undefined;
  onRoomCommand: ((payload: unknown, api: RoomHostApi) => Promise<void> | void) | undefined;
  dispose: ((api: RoomHostApi) => Promise<void> | void) | undefined;
}

interface RoomHostRegistration {
  room: InstalledRoomRecord;
  bridge: RoomBridge | null;
  hooks: RoomHostHooks;
  state: Map<string, unknown>;
  loadPromise: Promise<boolean> | null;
  loaded: boolean;
}

interface RoomHostApi {
  room: InstalledRoomRecord;
  registerCommand: (
    commandName: string,
    handler: RoomCommandHandler,
    options?: { description?: string; scope?: RoomCommandScope }
  ) => void;
  registerProtocols: (protocols: Record<string, string>) => void;
  notifyRoom: (type: string, payload?: Record<string, unknown>) => void;
  sendProtocol: typeof CoreEngine.sendProtocol;
  sendMessage: typeof CoreEngine.sendMessage;
  sendToTargets: typeof CoreEngine.sendToTargets;
  getState: (key: string) => unknown;
  setState: (key: string, value: unknown) => unknown;
  deleteState: (key: string) => boolean;
  log: (level: "debug" | "info" | "warn" | "error", message: string) => void;
}

type RoomHostFactory =
  | ((api: RoomHostApi) => Promise<unknown> | unknown)
  | {
      activate?: (api: RoomHostApi) => Promise<unknown> | unknown;
      default?: (api: RoomHostApi) => Promise<unknown> | unknown;
    };

function toRecord(value: unknown): Record<string, unknown> {
  if (value !== null && typeof value === "object" && Array.isArray(value) === false) {
    return value as Record<string, unknown>;
  }
  return {};
}

function isRoomCommandPayload(
  payload: unknown
): payload is { command?: string; payload?: Record<string, unknown> } {
  return payload !== null && typeof payload === "object" && Array.isArray(payload) === false;
}

class RoomHostRuntimeClass {
  private rooms = new Map<string, RoomHostRegistration>();

  async ensureRoomHost(room: InstalledRoomRecord, bridge: RoomBridge): Promise<boolean> {
    let registration = this.rooms.get(room.id);
    if (registration === undefined) {
      registration = {
        room: { ...room },
        bridge,
        hooks: {
          onRoomReady: undefined,
          onRoomEvent: undefined,
          onRoomCommand: undefined,
          dispose: undefined,
        },
        state: new Map<string, unknown>(),
        loadPromise: null,
        loaded: false,
      };
      this.rooms.set(room.id, registration);
    } else {
      registration.room = { ...room };
      registration.bridge = bridge;
    }

    if (registration.loaded === true) {
      return true;
    }

    if (registration.loadPromise === null) {
      registration.loadPromise = this.loadRoomHost(registration);
    }

    return await registration.loadPromise;
  }

  syncInstalledRooms(rooms: InstalledRoomRecord[]): void {
    const active = new Set(rooms.map((room) => room.id));

    rooms.forEach((room) => {
      const registration = this.rooms.get(room.id);
      if (registration !== undefined) {
        registration.room = { ...room };
      }
    });

    Array.from(this.rooms.keys()).forEach((roomId) => {
      if (active.has(roomId) === false) {
        void this.disposeRoom(roomId);
      }
    });
  }

  async handleRuntimeMessage(
    roomId: string,
    channel: string,
    payload: unknown
  ): Promise<void> {
    const registration = this.rooms.get(roomId);
    if (registration === undefined) {
      return;
    }

    const api = this.createApi(registration);

    if (channel === "room-ready") {
      await registration.hooks.onRoomReady?.(payload, api);
      return;
    }

    if (channel === "room-event") {
      await registration.hooks.onRoomEvent?.(payload, api);
      return;
    }

    if (channel === "room-command") {
      await registration.hooks.onRoomCommand?.(payload, api);

      if (!isRoomCommandPayload(payload) || typeof payload.command !== "string") {
        return;
      }

      const result = await ServerCommands.run(payload.command, {
        provider: "room-ui",
        source: "room-ui",
        roomId,
        roomPayload: payload.payload ?? null,
        message: `++cmd:${payload.command}`,
      });

      registration.bridge?.sendToRoom({
        type: "command-result",
        command: payload.command,
        result: toRecord(result),
      });
    }
  }

  async disposeRoom(roomId: string): Promise<void> {
    const registration = this.rooms.get(roomId);
    if (registration === undefined) {
      return;
    }

    const api = this.createApi(registration);
    try {
      await registration.hooks.dispose?.(api);
    } catch (error) {
      Logger.warn(LogCategory.SYSTEM, `Room host dispose failed: ${getErrorMessage(error)}`, {
        context: { roomId },
      });
    }

    RoomCommandRegistry.unregisterRoom(roomId);
    RoomProtocolRegistry.clearRuntimeProtocols(roomId);
    this.rooms.delete(roomId);
  }

  private async loadRoomHost(registration: RoomHostRegistration): Promise<boolean> {
    const readFile = window.electronAPI?.readFile;
    if (typeof readFile !== "function") {
      return false;
    }

    try {
      const source = await readFile(registration.room.hostEntryPath);
      if (typeof source !== "string" || source.trim() === "") {
        Logger.warn(LogCategory.SYSTEM, `Room host entry missing: ${registration.room.hostEntryPath}`, {
          context: { roomId: registration.room.id },
        });
        registration.loaded = false;
        return false;
      }

      const exported = this.evaluateHostFactory(
        decodeRoomHostSource(source),
        registration.room.id
      );
      const activate =
        typeof exported === "function"
          ? exported
          : typeof exported?.activate === "function"
            ? exported.activate
            : typeof exported?.default === "function"
              ? exported.default
              : null;

      if (activate === null) {
        Logger.warn(LogCategory.SYSTEM, `Room host factory missing: ${registration.room.id}`, {
          context: { roomId: registration.room.id },
        });
        registration.loaded = false;
        return false;
      }

      const api = this.createApi(registration);
      const result = await activate(api);
      this.applyHostResult(registration, result);
      registration.loaded = true;
      return true;
    } catch (error) {
      Logger.error(LogCategory.SYSTEM, new Error(`Room host load failed: ${getErrorMessage(error)}`), {
        context: {
          roomId: registration.room.id,
          hostEntryPath: registration.room.hostEntryPath,
        },
      });
      registration.loaded = false;
      return false;
    } finally {
      registration.loadPromise = null;
    }
  }

  private evaluateHostFactory(source: string, roomId: string): RoomHostFactory {
    const module = { exports: {} as RoomHostFactory };
    const exports = module.exports;
    const evaluator = new Function("module", "exports", source);

    try {
      evaluator(module, exports);
      return module.exports;
    } catch (error) {
      throw new Error(`Room host evaluation failed (${roomId}): ${getErrorMessage(error)}`);
    }
  }

  private applyHostResult(registration: RoomHostRegistration, result: unknown): void {
    const api = this.createApi(registration);
    const data = toRecord(result);

    if (typeof data["onRoomReady"] === "function") {
      registration.hooks.onRoomReady = data["onRoomReady"] as RoomHostHooks["onRoomReady"];
    }
    if (typeof data["onRoomEvent"] === "function") {
      registration.hooks.onRoomEvent = data["onRoomEvent"] as RoomHostHooks["onRoomEvent"];
    }
    if (typeof data["onRoomCommand"] === "function") {
      registration.hooks.onRoomCommand = data["onRoomCommand"] as RoomHostHooks["onRoomCommand"];
    }
    if (typeof data["dispose"] === "function") {
      registration.hooks.dispose = data["dispose"] as RoomHostHooks["dispose"];
    }

    const commands = toRecord(data["commands"]);
    Object.entries(commands).forEach(([commandName, handler]) => {
      if (typeof handler !== "function") {
        return;
      }
      api.registerCommand(commandName, handler as RoomCommandHandler);
    });

    const protocols = toRecord(data["protocols"]);
    if (Object.keys(protocols).length > 0) {
      const protocolMap: Record<string, string> = {};
      Object.entries(protocols).forEach(([key, value]) => {
        protocolMap[key] = typeof value === "string" ? value : "";
      });
      api.registerProtocols(protocolMap);
    }
  }

  private createApi(registration: RoomHostRegistration): RoomHostApi {
    return {
      room: { ...registration.room },
      registerCommand: (commandName, handler, options = {}) => {
        RoomCommandRegistry.registerHandler(registration.room.id, commandName, handler, options);
      },
      registerProtocols: (protocols) => {
        RoomProtocolRegistry.registerRuntimeProtocols(registration.room.id, protocols);
      },
      notifyRoom: (type, payload = {}) => {
        registration.bridge?.sendToRoom({
          type,
          payload,
        });
      },
      sendProtocol: CoreEngine.sendProtocol.bind(CoreEngine),
      sendMessage: CoreEngine.sendMessage.bind(CoreEngine),
      sendToTargets: CoreEngine.sendToTargets.bind(CoreEngine),
      getState: (key) => registration.state.get(key),
      setState: (key, value) => {
        registration.state.set(key, value);
        return value;
      },
      deleteState: (key) => registration.state.delete(key),
      log: (level, message) => {
        const prefixed = `[Room:${registration.room.id}] ${message}`;
        if (level === "error") {
          Logger.error(LogCategory.SYSTEM, prefixed);
          return;
        }
        if (level === "warn") {
          Logger.warn(LogCategory.SYSTEM, prefixed);
          return;
        }
        if (level === "debug") {
          Logger.debug(LogCategory.SYSTEM, prefixed);
          return;
        }
        Logger.info(LogCategory.SYSTEM, prefixed);
      },
    };
  }
}

const roomHostRuntime = new RoomHostRuntimeClass();

export { roomHostRuntime as RoomHostRuntime };
