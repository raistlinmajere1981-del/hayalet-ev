import type { InstalledRoomRecord, RoomCommandScope } from "@shared/index.js";
import { buildRemoteEmailAccountId } from "@shared/archive.js";
import { getErrorMessage } from "@shared/index.js";
import type { RemoteUserIdentity } from "@shared/settings.js";
import type {
  Us1SendMessageParams,
  Us1SendMessageResult,
  Us1SyncMessagesParams,
  Us1SyncMessagesResult,
} from "@shared/us1-mail.js";
import { AppState } from "../app-state.js";
import { CoreEngine } from "../core-engine.js";
import { AppI18n } from "../i18n/index.js";
import { Logger, LogCategory, LogLevel } from "../logger/index.js";
import { SettingsManager } from "../settings-manager.js";
import { ServerCommands } from "../server-commands.js";
import { RoomCommandRegistry, type RoomCommandHandler } from "./room-command-registry.js";
import { RoomProtocolRegistry } from "./room-protocol-registry.js";
import { buildRoomHostModuleDataUrl, decodeRoomHostSource } from "./room-host-source.js";
import { toRoomRuntimeFileUrl } from "./room-runtime-url.js";

interface RoomBridge {
  sendToRoom: (payload: Record<string, unknown>) => void;
}

type RoomHostLifecycleHandler = (payload: unknown, api: RoomHostApi) => Promise<void> | void;
type RoomHostDisposeHandler = (api: RoomHostApi) => Promise<void> | void;

interface RoomHostHooks {
  onRoomReady: RoomHostLifecycleHandler | undefined;
  onRoomEvent: RoomHostLifecycleHandler | undefined;
  onRoomCommand: RoomHostLifecycleHandler | undefined;
  dispose: RoomHostDisposeHandler | undefined;
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
  sendUs1Message: (params: Us1SendMessageParams) => Promise<Us1SendMessageResult>;
  syncUs1Messages: (params?: Us1SyncMessagesParams) => Promise<Us1SyncMessagesResult>;
  dispatchRoomCommand: (commandName: string, payload?: Record<string, unknown>) => Promise<unknown>;
  getUs1Identity: () => RemoteUserIdentity | null;
  isUs1Connected: () => boolean;
  selectUs1RemoteUser: (remoteUserId: string | null) => Promise<boolean>;
  showToast: (payload: {
    type?: "success" | "error" | "info" | "warning";
    message: string;
  }) => void;
  getLocale: () => string;
  getState: (key: string) => unknown;
  setState: (key: string, value: unknown) => unknown;
  deleteState: (key: string) => boolean;
  log: (level: "debug" | "info" | "warn" | "error", message: string) => void;
}

interface RoomHostExports {
  onRoomReady?: RoomHostLifecycleHandler;
  onRoomEvent?: RoomHostLifecycleHandler;
  onRoomCommand?: RoomHostLifecycleHandler;
  dispose?: RoomHostDisposeHandler;
  commands?: Record<string, RoomCommandHandler>;
  protocols?: Record<string, string>;
}

type RoomHostActivationResult = RoomHostExports | undefined;
type RoomHostActivator = (
  api: RoomHostApi
) => RoomHostActivationResult | Promise<RoomHostActivationResult>;
type RoomHostFactory =
  | RoomHostActivator
  | {
      activate?: RoomHostActivator;
      default?: RoomHostActivator;
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

function roomHostT(key: string, params?: Record<string, string | number>): string {
  return AppI18n.t(`app.logs.roomHost.${key}`, params);
}

function toHostExports(result: unknown): RoomHostExports {
  if (result !== null && typeof result === "object" && Array.isArray(result) === false) {
    return result as RoomHostExports;
  }
  return {};
}

function resolveHostActivator(exported: unknown): RoomHostActivator | null {
  if (typeof exported === "function") {
    return exported as RoomHostActivator;
  }

  if (exported !== null && typeof exported === "object" && Array.isArray(exported) === false) {
    const candidate = exported as {
      activate?: unknown;
      default?: unknown;
    };

    if (typeof candidate.activate === "function") {
      return candidate.activate as RoomHostActivator;
    }

    if (candidate.default !== undefined) {
      return resolveHostActivator(candidate.default);
    }
  }

  return null;
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

    registration.loadPromise ??= this.loadRoomHost(registration);
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

  async handleRuntimeMessage(roomId: string, channel: string, payload: unknown): Promise<void> {
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
      Logger.warnT(
        LogCategory.SYSTEM,
        "app.logs.roomHost.disposeFailed",
        { roomId, message: getErrorMessage(error) },
        { context: { roomId } }
      );
    }

    RoomCommandRegistry.unregisterRoom(roomId);
    RoomProtocolRegistry.clearRuntimeProtocols(roomId);
    this.rooms.delete(roomId);
  }

  private async loadRoomHost(registration: RoomHostRegistration): Promise<boolean> {
    const readFile = window.electronAPI?.readFile;

    try {
      let exported: RoomHostFactory | null = null;

      try {
        const moduleUrl = new URL(toRoomRuntimeFileUrl(registration.room.hostEntryPath));
        moduleUrl.searchParams.set("roomHostId", registration.room.id);
        moduleUrl.searchParams.set("roomHostUpdatedAt", registration.room.updatedAt);
        exported = (await import(
          /* @vite-ignore */ moduleUrl.toString()
        )) as unknown as RoomHostFactory;
      } catch {
        if (typeof readFile !== "function") {
          return false;
        }

        try {
          const moduleUrl = await buildRoomHostModuleDataUrl(
            registration.room.hostEntryPath,
            async (filePath) => {
              const encoded = await readFile(filePath);
              return decodeRoomHostSource(typeof encoded === "string" ? encoded : "");
            }
          );
          exported = (await import(
            /* @vite-ignore */ moduleUrl
          )) as unknown as RoomHostFactory;
        } catch {
          const source = await readFile(registration.room.hostEntryPath);
          if (typeof source !== "string" || source.trim() === "") {
            Logger.warnT(
              LogCategory.SYSTEM,
              "app.logs.roomHost.entryMissing",
              { path: registration.room.hostEntryPath },
              {
                context: { roomId: registration.room.id },
              }
            );
            registration.loaded = false;
            return false;
          }

          exported = this.evaluateHostFactory(decodeRoomHostSource(source), registration.room.id);
        }
      }
      const activate = resolveHostActivator(exported);

      if (activate === null) {
        Logger.warnT(
          LogCategory.SYSTEM,
          "app.logs.roomHost.factoryMissing",
          { roomId: registration.room.id },
          {
            context: { roomId: registration.room.id },
          }
        );
        registration.loaded = false;
        return false;
      }

      const api = this.createApi(registration);
      const result = await activate(api);
      this.applyHostResult(registration, result);
      registration.loaded = true;
      return true;
    } catch (error) {
      Logger.errorT(
        LogCategory.SYSTEM,
        "app.logs.roomHost.loadFailed",
        { roomId: registration.room.id, message: getErrorMessage(error) },
        {
          context: {
            roomId: registration.room.id,
            hostEntryPath: registration.room.hostEntryPath,
          },
          error: getErrorMessage(error),
        }
      );
      registration.loaded = false;
      return false;
    } finally {
      registration.loadPromise = null;
    }
  }

  private evaluateHostFactory(source: string, roomId: string): RoomHostFactory {
    const module = { exports: {} as RoomHostFactory };
    const exports = module.exports;
    const evaluator = new Function("module", "exports", source) as (
      moduleRef: { exports: RoomHostFactory },
      exportsRef: RoomHostFactory
    ) => void;

    try {
      evaluator(module, exports);
      return module.exports;
    } catch (error) {
      throw new Error(
        roomHostT("evaluationFailed", {
          roomId,
          message: getErrorMessage(error),
        }),
        {
          cause: error,
        }
      );
    }
  }

  private applyHostResult(
    registration: RoomHostRegistration,
    result: RoomHostActivationResult
  ): void {
    const api = this.createApi(registration);
    const data = toHostExports(result);

    if (typeof data["onRoomReady"] === "function") {
      registration.hooks.onRoomReady = data["onRoomReady"];
    }
    if (typeof data["onRoomEvent"] === "function") {
      registration.hooks.onRoomEvent = data["onRoomEvent"];
    }
    if (typeof data["onRoomCommand"] === "function") {
      registration.hooks.onRoomCommand = data["onRoomCommand"];
    }
    if (typeof data["dispose"] === "function") {
      registration.hooks.dispose = data["dispose"];
    }

    Object.entries(data.commands ?? {}).forEach(([commandName, handler]) => {
      api.registerCommand(commandName, handler);
    });

    if (data.protocols !== undefined && Object.keys(data.protocols).length > 0) {
      const protocolMap: Record<string, string> = {};
      Object.entries(data.protocols).forEach(([key, value]) => {
        protocolMap[key] = value;
      });
      api.registerProtocols(protocolMap);
    }
  }

  private createApi(registration: RoomHostRegistration): RoomHostApi {
    return {
      room: { ...registration.room },
      registerCommand: (commandName, handler, options = {}): void => {
        RoomCommandRegistry.registerHandler(registration.room.id, commandName, handler, options);
      },
      registerProtocols: (protocols): void => {
        RoomProtocolRegistry.registerRuntimeProtocols(registration.room.id, protocols);
      },
      notifyRoom: (type, payload = {}): void => {
        registration.bridge?.sendToRoom({
          type,
          payload,
        });
      },
      sendProtocol: CoreEngine.sendProtocol.bind(CoreEngine),
      sendMessage: CoreEngine.sendMessage.bind(CoreEngine),
      sendToTargets: CoreEngine.sendToTargets.bind(CoreEngine),
      sendUs1Message: async (params): Promise<Us1SendMessageResult> => {
        const electronApi = window.electronAPI;
        if (electronApi === undefined || typeof electronApi.us1SendMessage !== "function") {
          return { success: false, error: "Electron API is unavailable." };
        }
        return await electronApi.us1SendMessage(params);
      },
      syncUs1Messages: async (params): Promise<Us1SyncMessagesResult> => {
        const electronApi = window.electronAPI;
        if (electronApi === undefined || typeof electronApi.us1SyncMessages !== "function") {
          return { success: false, error: "Electron API is unavailable." };
        }
        return await electronApi.us1SyncMessages(params);
      },
      dispatchRoomCommand: async (commandName, payload = {}): Promise<unknown> => {
        return await ServerCommands.run(commandName, {
          provider: "us1",
          source: "us1",
          roomId: registration.room.id,
          ...payload,
          message: `++cmd:${commandName}`,
        });
      },
      getUs1Identity: (): RemoteUserIdentity | null => AppState.getUs1Identity(),
      isUs1Connected: (): boolean => AppState.isUs1Connected(),
      selectUs1RemoteUser: async (remoteUserId): Promise<boolean> => {
        const normalizedRemoteUserId =
          typeof remoteUserId === "string" && remoteUserId.trim() !== ""
            ? remoteUserId.trim()
            : null;
        const selectedAccountId =
          normalizedRemoteUserId !== null
            ? buildRemoteEmailAccountId(normalizedRemoteUserId)
            : null;
        return await SettingsManager.patch((settings) => {
          const nextUs1Slot =
            settings["us1Slot"] !== null &&
            typeof settings["us1Slot"] === "object" &&
            Array.isArray(settings["us1Slot"]) === false
              ? (settings["us1Slot"] as Record<string, unknown>)
              : {};
          settings["us1Slot"] = {
            ...nextUs1Slot,
            selectedRemoteUserId: normalizedRemoteUserId,
            selectedAccountId,
          };
        });
      },
      showToast: ({ type = "info", message }): void => {
        const normalizedMessage = message.trim();
        if (normalizedMessage === "") {
          return;
        }

        const level =
          type === "success"
            ? LogLevel.SUCCESS
            : type === "warning"
              ? LogLevel.WARNING
              : type === "error"
                ? LogLevel.ERROR
                : LogLevel.INFO;
        Logger.toast(LogCategory.SYSTEM, level, normalizedMessage, {
          roomId: registration.room.id,
        });
      },
      getLocale: (): string => AppI18n.getLocale(),
      getState: (key): unknown => registration.state.get(key),
      setState: (key, value): unknown => {
        registration.state.set(key, value);
        return value;
      },
      deleteState: (key): boolean => registration.state.delete(key),
      log: (level, message): void => {
        if (level === "error") {
          Logger.errorT(LogCategory.SYSTEM, "app.logs.roomHost.roomMessage", {
            roomId: registration.room.id,
            message,
          });
          return;
        }
        if (level === "warn") {
          Logger.warnT(LogCategory.SYSTEM, "app.logs.roomHost.roomMessage", {
            roomId: registration.room.id,
            message,
          });
          return;
        }
        if (level === "debug") {
          Logger.debugT(LogCategory.SYSTEM, "app.logs.roomHost.roomMessage", {
            roomId: registration.room.id,
            message,
          });
          return;
        }
        Logger.infoT(LogCategory.SYSTEM, "app.logs.roomHost.roomMessage", {
          roomId: registration.room.id,
          message,
        });
      },
    };
  }
}

const roomHostRuntime = new RoomHostRuntimeClass();

export { roomHostRuntime as RoomHostRuntime };
