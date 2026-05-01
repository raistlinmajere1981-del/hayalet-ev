import type { InstalledRoomRecord, RoomCommandScope } from "@shared/index.js";
import { getErrorMessage } from "@shared/index.js";
import type { RemoteUserIdentity } from "@shared/settings.js";
import type {
  CaptureActionOutcome,
  CaptureDictationStatusPayload,
  CaptureMediaIngressPayload,
} from "../../../types/capture.js";
import type { TranscriptIngressPayload } from "../../../types/transcript.js";
import { AppState } from "../app-state.js";
import {
  onCaptureDictationStatus,
  onCaptureMediaIngress,
  runCaptureAction,
} from "../capture/electron-client.js";
import { AppI18n } from "../i18n/index.js";
import { Logger, LogCategory, LogLevel } from "../logger/index.js";
import { ServerCommands } from "../server-commands.js";
import { SLOT_BRIDGE_COMMAND_NAME } from "../commands/slot-bridge.js";
import { RoomCommandRegistry, type RoomCommandHandler } from "./room-command-registry.js";
import { RoomProtocolRegistry } from "./room-protocol-registry.js";
import { EXPECTED_COMMAND_CAPTURE_FAILURE_EVENT } from "./expected-command-capture-events.js";
import { buildRoomPresenceSnapshot, type RoomPresenceSnapshot } from "./room-presence.js";
import {
  buildRoomHostModuleBlobUrl,
  buildRoomHostModuleDataUrl,
  decodeRoomHostSource,
} from "./room-host-source.js";
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
  activeTranscriptRequestIds: Set<string>;
  activeMediaRequestIds: Set<string>;
  hostModuleCleanup: (() => void) | null;
  loadPromise: Promise<boolean> | null;
  loaded: boolean;
}

interface RoomHostApi {
  room: InstalledRoomRecord;
  dispatchBridge: (payload: Record<string, unknown>) => Promise<unknown>;
  registerCommand: (
    commandName: string,
    handler: RoomCommandHandler,
    options?: { description?: string; scope?: RoomCommandScope }
  ) => void;
  registerVoiceCommands: (
    commands: Record<string, readonly string[]>,
    options?: { enabled?: boolean }
  ) => void;
  setVoiceCommandsEnabled: (enabled: boolean) => void;
  capture: {
    startSession: () => Promise<CaptureActionOutcome>;
    stopSession: () => Promise<CaptureActionOutcome>;
    capturePhoto: (requestId?: string) => Promise<CaptureActionOutcome>;
    retakePhoto: (requestId?: string) => Promise<CaptureActionOutcome>;
    startDictation: (
      requestId?: string
    ) => Promise<{ requestId: string; outcome: CaptureActionOutcome }>;
    stopDictation: (requestId: string) => Promise<CaptureActionOutcome>;
  };
  registerProtocols: (protocols: Record<string, string>) => void;
  notifyRoom: (type: string, payload?: Record<string, unknown>) => void;
  dispatchRoomCommand: (commandName: string, payload?: Record<string, unknown>) => Promise<unknown>;
  getRoomPresence: () => RoomPresenceSnapshot;
  getUs1Identity: () => RemoteUserIdentity | null;
  isUs1Connected: () => boolean;
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
  voiceCommands?: Record<string, readonly string[]>;
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
    return result;
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

const EXPECTED_COMMAND_CAPTURE_STATE_KEY = "room.expectedCommandCapture";

class RoomHostRuntimeClass {
  private rooms = new Map<string, RoomHostRegistration>();

  constructor() {
    if (typeof window === "undefined") {
      return;
    }

    window.addEventListener(
      EXPECTED_COMMAND_CAPTURE_FAILURE_EVENT,
      this.handleExpectedCommandCaptureFailureEvent
    );

    const electronApi = window.electronAPI;
    if (electronApi === undefined) {
      return;
    }

    if (
      typeof electronApi.transcriptOnIngress === "function" &&
      typeof electronApi.transcriptOffIngress === "function"
    ) {
      electronApi.transcriptOnIngress(this.handleTranscriptIngress);
    }

    onCaptureMediaIngress(this.handleCaptureMediaIngress);
    onCaptureDictationStatus(this.handleCaptureDictationStatus);
  }

  private handleExpectedCommandCaptureFailureEvent = (event: Event): void => {
    const detail = toRecord((event as CustomEvent<unknown>).detail);
    this.reportExpectedCommandCaptureFailure(
      typeof detail["provider"] === "string" ? detail["provider"] : "",
      {
        ...(typeof detail["webUrl"] === "string" ? { webUrl: detail["webUrl"] } : {}),
        ...(typeof detail["text"] === "string" ? { text: detail["text"] } : {}),
      }
    );
  };

  private handleTranscriptIngress = (payload: TranscriptIngressPayload): void => {
    if (typeof payload.target !== "string" || payload.target.startsWith("room:") !== true) {
      return;
    }

    const roomId = payload.target.slice("room:".length).trim();
    if (roomId === "") {
      return;
    }

    const registration = this.rooms.get(roomId);
    if (registration === undefined) {
      return;
    }

    if (
      payload.source === "android-bridge" &&
      registration.activeTranscriptRequestIds.has(payload.requestId) !== true
    ) {
      return;
    }

    registration.bridge?.sendToRoom({
      type: "transcript-ingress",
      payload,
    });

    if (payload.isFinal === true && payload.text.trim() !== "") {
      const match = RoomCommandRegistry.matchVoiceCommand(roomId, payload.text);
      if (match !== null) {
        void RoomCommandRegistry.run(match.commandName, {
          provider: "room-ui",
          source: "transcript",
          roomId,
          roomPayload: {
            transcript: payload.text,
            requestId: payload.requestId,
            matchedPhrase: match.matchedPhrase,
          },
        }).then((result) => {
          registration.bridge?.sendToRoom({
            type: "command-result",
            command: match.commandName,
            result: toRecord(result),
          });
        });
      }
    }

    if (payload.isFinal === true) {
      registration.activeTranscriptRequestIds.delete(payload.requestId);
    }
  };

  private handleCaptureMediaIngress = (payload: CaptureMediaIngressPayload): void => {
    if (payload.target.startsWith("room:") !== true) {
      return;
    }

    const roomId = payload.target.slice("room:".length).trim();
    if (roomId === "") {
      return;
    }

    const registration = this.rooms.get(roomId);
    if (registration === undefined) {
      return;
    }

    if (registration.activeMediaRequestIds.has(payload.requestId) !== true) {
      return;
    }

    registration.activeMediaRequestIds.delete(payload.requestId);
    registration.bridge?.sendToRoom({
      type: "capture-media-ingress",
      payload,
    });
  };

  private handleCaptureDictationStatus = (payload: CaptureDictationStatusPayload): void => {
    if (payload.target.startsWith("room:") !== true) {
      return;
    }

    const roomId = payload.target.slice("room:".length).trim();
    if (roomId === "") {
      return;
    }

    const registration = this.rooms.get(roomId);
    if (registration === undefined) {
      return;
    }

    if (registration.activeTranscriptRequestIds.has(payload.requestId) !== true) {
      return;
    }

    if (payload.status === "failed" || payload.status === "done") {
      registration.activeTranscriptRequestIds.delete(payload.requestId);
    }

    registration.bridge?.sendToRoom({
      type: "capture-dictation-status",
      payload,
    });
  };

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
        hostModuleCleanup: null,
        state: new Map<string, unknown>(),
        activeTranscriptRequestIds: new Set<string>(),
        activeMediaRequestIds: new Set<string>(),
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

  reportExpectedCommandCaptureFailure(
    provider: string,
    details: {
      webUrl?: string;
      text?: string;
    } = {}
  ): boolean {
    const normalizedProvider = provider.trim();
    if (normalizedProvider === "") {
      return false;
    }

    for (const registration of this.rooms.values()) {
      const expectation = toRecord(registration.state.get(EXPECTED_COMMAND_CAPTURE_STATE_KEY));
      if (expectation["provider"] !== normalizedProvider) {
        continue;
      }

      registration.state.delete(EXPECTED_COMMAND_CAPTURE_STATE_KEY);
      const api = this.createApi(registration);
      const message =
        typeof expectation["message"] === "string" && expectation["message"].trim() !== ""
          ? expectation["message"].trim()
          : "The latest reply did not contain a valid command.";
      const commandName =
        typeof expectation["commandName"] === "string" && expectation["commandName"].trim() !== ""
          ? expectation["commandName"].trim()
          : "RoomCommand";
      const detailParts = [
        `command=${commandName}`,
        `provider=${normalizedProvider}`,
        ...(typeof details.webUrl === "string" && details.webUrl.trim() !== ""
          ? [`webUrl=${details.webUrl.trim()}`]
          : []),
      ].join(", ");
      const replyExcerpt =
        typeof details.text === "string" && details.text.trim() !== ""
          ? details.text.trim().replace(/\s+/g, " ").slice(0, 160)
          : "";
      const logMessage = [
        `Expected room command could not be captured (${detailParts}): ${message}`,
        ...(replyExcerpt !== "" ? [`reply=${replyExcerpt}`] : []),
      ].join(" | ");

      api.notifyRoom("command-result", {
        command: commandName,
        result: {
          success: false,
          message,
        },
      });
      api.showToast({
        type: "warning",
        message,
      });
      api.log("warn", logMessage);
      return true;
    }

    return false;
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

      const result = await ServerCommands.run(SLOT_BRIDGE_COMMAND_NAME, {
        provider: "room-ui",
        source: "room-ui",
        fromSlot: "room-ui",
        action: "room.command",
        payload: {
          commandName: payload.command,
          roomId,
          ...(isRoomCommandPayload(payload.payload)
            ? payload.payload
            : payload.payload !== undefined
              ? { value: payload.payload }
              : {}),
        },
        message: `++cmd:${SLOT_BRIDGE_COMMAND_NAME}`,
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
    registration.hostModuleCleanup?.();
    registration.hostModuleCleanup = null;
    this.rooms.delete(roomId);
  }

  private async loadRoomHost(registration: RoomHostRegistration): Promise<boolean> {
    const readFile = window.electronAPI?.readFile;
    let hostModuleCleanup: (() => void) | null = null;

    try {
      let exported: unknown = null;

      try {
        const moduleUrl = new URL(toRoomRuntimeFileUrl(registration.room.hostEntryPath));
        moduleUrl.searchParams.set("roomHostId", registration.room.id);
        moduleUrl.searchParams.set("roomHostUpdatedAt", registration.room.updatedAt);
        exported = await import(/* @vite-ignore */ moduleUrl.toString());
      } catch {
        if (typeof readFile !== "function") {
          return false;
        }

        try {
          const readRoomHostModuleSource = async (filePath: string): Promise<string> => {
            const encoded = await readFile(filePath);
            return decodeRoomHostSource(typeof encoded === "string" ? encoded : "");
          };

          try {
            const blobModule = await buildRoomHostModuleBlobUrl(
              registration.room.hostEntryPath,
              readRoomHostModuleSource
            );
            hostModuleCleanup = blobModule.dispose;
            exported = await import(/* @vite-ignore */ blobModule.moduleUrl);
          } catch {
            const moduleUrl = await buildRoomHostModuleDataUrl(
              registration.room.hostEntryPath,
              readRoomHostModuleSource,
              { inlineDependencies: true }
            );
            exported = await import(/* @vite-ignore */ moduleUrl);
          }
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
      registration.hostModuleCleanup?.();
      registration.hostModuleCleanup = hostModuleCleanup;
      hostModuleCleanup = null;
      registration.loaded = true;
      return true;
    } catch (error) {
      hostModuleCleanup?.();
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

    if (data.voiceCommands !== undefined) {
      api.registerVoiceCommands(data.voiceCommands);
    }

    if (data.protocols !== undefined && Object.keys(data.protocols).length > 0) {
      const protocolMap: Record<string, string> = {};
      Object.entries(data.protocols).forEach(([key, value]) => {
        protocolMap[key] = value;
      });
      api.registerProtocols(protocolMap);
    }
  }

  private createApi(registration: RoomHostRegistration): RoomHostApi {
    const transcriptTarget = `room:${registration.room.id}` as const;
    const dispatchBridge = async (payload: Record<string, unknown> = {}): Promise<unknown> => {
      return await ServerCommands.run(SLOT_BRIDGE_COMMAND_NAME, {
        provider: "room-ui",
        source: "room-ui",
        fromSlot: "room-ui",
        ...payload,
        message: `++cmd:${SLOT_BRIDGE_COMMAND_NAME}`,
      });
    };

    return {
      room: { ...registration.room },
      dispatchBridge,
      registerCommand: (commandName, handler, options = {}): void => {
        RoomCommandRegistry.registerHandler(registration.room.id, commandName, handler, options);
      },
      registerVoiceCommands: (commands, options = {}): void => {
        RoomCommandRegistry.registerVoiceCommands(registration.room.id, commands, options);
      },
      setVoiceCommandsEnabled: (enabled): void => {
        RoomCommandRegistry.setVoiceCommandsEnabled(registration.room.id, enabled);
      },
      capture: {
        startSession: async (): Promise<CaptureActionOutcome> =>
          await runCaptureAction("start-analyze-session", { target: transcriptTarget }),
        stopSession: async (): Promise<CaptureActionOutcome> =>
          await runCaptureAction("stop-analyze-session", { target: transcriptTarget }),
        capturePhoto: async (requestId = crypto.randomUUID()): Promise<CaptureActionOutcome> => {
          registration.activeMediaRequestIds.add(requestId);
          const outcome = await runCaptureAction("capture-analyze-photo", {
            target: transcriptTarget,
            requestId,
          });
          if (outcome.ok !== true) {
            registration.activeMediaRequestIds.delete(requestId);
          }
          return outcome;
        },
        retakePhoto: async (requestId = crypto.randomUUID()): Promise<CaptureActionOutcome> => {
          registration.activeMediaRequestIds.add(requestId);
          const outcome = await runCaptureAction("retake-analyze-photo", {
            target: transcriptTarget,
            requestId,
          });
          if (outcome.ok !== true) {
            registration.activeMediaRequestIds.delete(requestId);
          }
          return outcome;
        },
        startDictation: async (
          requestId = crypto.randomUUID()
        ): Promise<{ requestId: string; outcome: CaptureActionOutcome }> => {
          registration.activeTranscriptRequestIds.add(requestId);
          const outcome = await runCaptureAction("start-analyze-dictation", {
            target: transcriptTarget,
            requestId,
          });
          if (outcome.ok !== true) {
            registration.activeTranscriptRequestIds.delete(requestId);
          }
          return { requestId, outcome };
        },
        stopDictation: async (requestId): Promise<CaptureActionOutcome> =>
          await runCaptureAction("stop-analyze-dictation", { target: transcriptTarget, requestId }),
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
      dispatchRoomCommand: async (commandName, payload = {}): Promise<unknown> => {
        const bridgePayload = { ...payload };
        delete bridgePayload["roomPayload"];
        delete bridgePayload["payload"];
        delete bridgePayload["action"];
        delete bridgePayload["fromSlot"];
        delete bridgePayload["provider"];
        delete bridgePayload["source"];
        const roomPayload =
          payload["roomPayload"] !== undefined &&
          payload["roomPayload"] !== null &&
          typeof payload["roomPayload"] === "object" &&
          Array.isArray(payload["roomPayload"]) === false
            ? (payload["roomPayload"] as Record<string, unknown>)
            : payload["roomPayload"] !== undefined
              ? { value: payload["roomPayload"] }
              : {};

        return await ServerCommands.run(SLOT_BRIDGE_COMMAND_NAME, {
          provider: "us1",
          source: "us1",
          fromSlot: "us1",
          ...bridgePayload,
          action: "room.command",
          payload: {
            commandName,
            roomId: registration.room.id,
            ...roomPayload,
          },
          message: `++cmd:${SLOT_BRIDGE_COMMAND_NAME}`,
        });
      },
      getRoomPresence: (): RoomPresenceSnapshot => buildRoomPresenceSnapshot(),
      getUs1Identity: (): RemoteUserIdentity | null => AppState.getUs1Identity(),
      isUs1Connected: (): boolean => AppState.isUs1Connected(),
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
