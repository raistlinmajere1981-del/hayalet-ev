import { PATTERN_ROOM_DOMAIN_MOCK } from "../shared/data/pattern-room-domain.mock.js";
import { migratePatternRoomSnapshot } from "../shared/state/pattern-room-snapshot-migration.js";
import { parsePatternRoomSessionSnapshot } from "../shared/state/pattern-room-snapshot.js";
import {
  PATTERN_ROOM_LOAD_COMMAND,
  PATTERN_ROOM_LOADED_EVENT,
  PATTERN_ROOM_SAVE_COMMAND,
  PATTERN_ROOM_SAVED_EVENT,
  PATTERN_ROOM_SAVE_FAILED_EVENT,
  type PatternRoomLoadedEventPayload,
  type PatternRoomSavedEventPayload,
  type PatternRoomSaveFailedEventPayload,
} from "../shared/types/pattern-room-persistence.js";
import type {
  PatternRoomSnapshotMeta,
  PatternRoomStorageAdapter,
} from "../shared/types/pattern-room-storage.js";
import type { PatternRoomSessionSnapshot } from "../shared/types/pattern-room-snapshot.js";

const PATTERN_ROOM_ID = "pattern-room";
const STORAGE_PATH_STATE_KEYS = ["storageDir", "runtimePaths", "paths"] as const;
const DEFAULT_FAILURE_MESSAGE = "Pattern Room persistence failed.";
const SNAPSHOT_FILE_SUFFIX = ".snapshot.json";
const SAFE_TOPIC_ID_PATTERN = /^[A-Za-z0-9_-]+$/;

type PatternRoomCommandExposure = "public" | "internal";

type PatternRoomCommandScope = "room-ui" | "ai-slots" | "assistant" | "us1" | "system";

type PatternRoomCommandResult =
  | { success: true }
  | {
      error: string;
      success: false;
    };

type PatternRoomCommandHandler = (payload?: unknown) => Promise<PatternRoomCommandResult>;

type PatternRoomElectronApi = {
  fmWriteFileAtomic?: (payload: {
    data: string;
    encoding?: string;
    path: string;
  }) => Promise<Record<string, unknown>>;
  readDirectoryFiles?: (
    dirPath: string
  ) => Promise<Array<{ isDirectory?: unknown; name?: unknown; path?: unknown }>>;
  readFile?: (path: string) => Promise<string | null>;
  roomToolsCall?: (
    request:
      | {
          operation: "resolve-paths";
          roomId: string;
        }
      | {
          operation: "delete-path";
          recursive?: boolean;
          roomId: string;
          targetPath: string;
        }
  ) => Promise<Record<string, unknown>>;
};

export type PatternRoomHostApi = {
  getState?: (key: string) => unknown;
  log?: (level: string, message: string) => void;
  notifyRoom?: (type: string, payload?: Record<string, unknown>) => void;
  registerCommand?: (
    commandName: string,
    handler: PatternRoomCommandHandler,
    options?: {
      description?: string;
      exposure?: PatternRoomCommandExposure;
      scope?: PatternRoomCommandScope;
    }
  ) => void;
};

export type PatternRoomHostActivation = {
  commands: Record<
    typeof PATTERN_ROOM_SAVE_COMMAND | typeof PATTERN_ROOM_LOAD_COMMAND,
    PatternRoomCommandHandler
  >;
  dispose: () => Promise<void>;
  onRoomEvent: (event: unknown) => void;
  onRoomReady: () => Promise<void>;
};

export type PatternRoomHostRuntime = {
  activate: (api: PatternRoomHostApi) => PatternRoomHostActivation;
};

export type PatternRoomStorageFactoryContext = {
  api: PatternRoomHostApi;
  storageDir: string;
};

export type PatternRoomHostRuntimeOptions = {
  createStorageAdapter?: (
    context: PatternRoomStorageFactoryContext
  ) => PatternRoomStorageAdapter | Promise<PatternRoomStorageAdapter>;
  storageAdapter?: PatternRoomStorageAdapter;
  storageDir?: string;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && Array.isArray(value) === false;
}

function asNonEmptyString(value: unknown): string | null {
  return typeof value === "string" && value.trim() !== "" ? value.trim() : null;
}

function readStorageDir(value: unknown): string | null {
  const directValue = asNonEmptyString(value);
  if (directValue !== null) {
    return directValue;
  }

  if (!isRecord(value)) {
    return null;
  }

  return asNonEmptyString(value["storageDir"]) ?? readStorageDir(value["paths"]);
}

function readCommandPayload(payload: unknown): Record<string, unknown> {
  if (!isRecord(payload)) {
    return {};
  }

  return {
    ...toRecord(payload["roomArgs"]),
    ...toRecord(payload["roomPayload"]),
    ...toRecord(payload["payload"]),
    ...payload,
  };
}

function toRecord(value: unknown): Record<string, unknown> {
  return isRecord(value) ? value : {};
}

function assertSafeTopicId(topicId: string): void {
  if (SAFE_TOPIC_ID_PATTERN.test(topicId) !== true) {
    throw new Error("Unsafe Pattern Room snapshot topicId.");
  }
}

function createSnapshotMeta(snapshot: PatternRoomSessionSnapshot): PatternRoomSnapshotMeta {
  return {
    snapshotId: snapshot.snapshotId,
    topicId: snapshot.topicId,
    schemaVersion: snapshot.schemaVersion,
    createdAt: snapshot.createdAt,
    updatedAt: snapshot.updatedAt,
  };
}

function joinStoragePath(baseDir: string, fileName: string): string {
  const trimmedBaseDir = baseDir.replace(/[\\/]+$/, "");
  const separator = trimmedBaseDir.includes("\\") && !trimmedBaseDir.includes("/") ? "\\" : "/";
  return `${trimmedBaseDir}${separator}${fileName}`;
}

function getSnapshotFileName(topicId: string): string {
  assertSafeTopicId(topicId);
  return `${topicId}${SNAPSHOT_FILE_SUFFIX}`;
}

function decodeBase64Utf8(value: string): string | null {
  try {
    const binary = atob(value);
    const bytes = new Uint8Array(binary.length);
    for (let index = 0; index < binary.length; index += 1) {
      bytes[index] = binary.charCodeAt(index);
    }
    return new TextDecoder().decode(bytes);
  } catch {
    return null;
  }
}

function readElectronApi(): PatternRoomElectronApi | null {
  if (typeof window === "undefined") {
    return null;
  }

  const electronApi = window.electronAPI as PatternRoomElectronApi | undefined;
  return typeof electronApi?.roomToolsCall === "function" ? electronApi : null;
}

async function resolveStorageDir(api: PatternRoomHostApi): Promise<string | null> {
  for (const stateKey of STORAGE_PATH_STATE_KEYS) {
    const stateValue = api.getState?.(stateKey);
    const stateStorageDir = readStorageDir(stateValue);
    if (stateStorageDir !== null) {
      return stateStorageDir;
    }
  }

  const electronApi = readElectronApi();
  if (electronApi === null) {
    return null;
  }

  const result = await electronApi.roomToolsCall?.({
    operation: "resolve-paths",
    roomId: PATTERN_ROOM_ID,
  });
  return readStorageDir(result);
}

class PatternRoomElectronStorageAdapter implements PatternRoomStorageAdapter {
  private readonly baseDir: string;
  private readonly electronApi: PatternRoomElectronApi;

  constructor(baseDir: string, electronApi: PatternRoomElectronApi) {
    this.baseDir = baseDir;
    this.electronApi = electronApi;
  }

  async save(snapshot: PatternRoomSessionSnapshot): Promise<void> {
    assertSafeTopicId(snapshot.topicId);
    const parsedSnapshot = migratePatternRoomSnapshot(snapshot);
    if (parsedSnapshot === null) {
      throw new Error("Pattern Room snapshot cannot be persisted.");
    }

    const writeResult = await this.electronApi.fmWriteFileAtomic?.({
      data: `${JSON.stringify(parsedSnapshot, null, 2)}\n`,
      encoding: "utf-8",
      path: this.getSnapshotPath(snapshot.topicId),
    });

    if (writeResult?.["success"] !== true) {
      throw new Error("Pattern Room snapshot write failed.");
    }
  }

  async load(topicId: string): Promise<PatternRoomSessionSnapshot | null> {
    assertSafeTopicId(topicId);
    return await this.readSnapshotFile(this.getSnapshotPath(topicId));
  }

  async list(): Promise<PatternRoomSnapshotMeta[]> {
    const entries = await this.listSnapshotFileEntries();
    const snapshots = await Promise.all(
      entries.map(async (entry) => {
        return await this.readSnapshotFile(entry.path);
      })
    );

    return snapshots
      .filter((snapshot): snapshot is PatternRoomSessionSnapshot => snapshot !== null)
      .map(createSnapshotMeta)
      .sort((left, right) => right.updatedAt.localeCompare(left.updatedAt));
  }

  async delete(snapshotId: string): Promise<void> {
    const entries = await this.listSnapshotFileEntries();
    const snapshots = await Promise.all(
      entries.map(async (entry) => {
        return {
          path: entry.path,
          snapshot: await this.readSnapshotFile(entry.path),
        };
      })
    );
    const target = snapshots.find(({ snapshot }) => snapshot?.snapshotId === snapshotId);
    if (target === undefined) {
      return;
    }

    const deleteResult = await this.electronApi.roomToolsCall?.({
      operation: "delete-path",
      recursive: false,
      roomId: PATTERN_ROOM_ID,
      targetPath: target.path,
    });

    if (deleteResult?.["success"] !== true) {
      throw new Error("Pattern Room snapshot delete failed.");
    }
  }

  private getSnapshotPath(topicId: string): string {
    return joinStoragePath(this.baseDir, getSnapshotFileName(topicId));
  }

  private async listSnapshotFileEntries(): Promise<Array<{ name: string; path: string }>> {
    const entries = (await this.electronApi.readDirectoryFiles?.(this.baseDir)) ?? [];
    return entries
      .filter((entry) => entry.isDirectory !== true)
      .map((entry) => {
        return {
          name: asNonEmptyString(entry.name),
          path: asNonEmptyString(entry.path),
        };
      })
      .filter((entry): entry is { name: string; path: string } => {
        return entry.name !== null && entry.path !== null;
      })
      .filter((entry) => entry.name.endsWith(SNAPSHOT_FILE_SUFFIX))
      .filter((entry) =>
        SAFE_TOPIC_ID_PATTERN.test(entry.name.slice(0, -SNAPSHOT_FILE_SUFFIX.length))
      );
  }

  private async readSnapshotFile(filePath: string): Promise<PatternRoomSessionSnapshot | null> {
    const encoded = await this.electronApi.readFile?.(filePath);
    if (typeof encoded !== "string" || encoded.trim() === "") {
      return null;
    }

    const decoded = decodeBase64Utf8(encoded);
    if (decoded === null) {
      return null;
    }

    try {
      return migratePatternRoomSnapshot(JSON.parse(decoded) as unknown);
    } catch {
      return null;
    }
  }
}

function getSafeErrorMessage(error: unknown): string {
  const message = error instanceof Error ? error.message : DEFAULT_FAILURE_MESSAGE;
  const normalized = message.trim().replace(/\s+/g, " ").slice(0, 160);
  if (normalized === "" || normalized.includes("/") || normalized.includes("\\")) {
    return DEFAULT_FAILURE_MESSAGE;
  }
  return normalized;
}

export default function createPatternRoomHostRuntime(
  options: PatternRoomHostRuntimeOptions = {}
): PatternRoomHostRuntime {
  return {
    activate(api: PatternRoomHostApi): PatternRoomHostActivation {
      let storageAdapter: PatternRoomStorageAdapter | null = options.storageAdapter ?? null;
      let saveQueue: Promise<void> = Promise.resolve();

      async function getStorageAdapter(): Promise<PatternRoomStorageAdapter> {
        if (storageAdapter !== null) {
          return storageAdapter;
        }

        const storageDir = asNonEmptyString(options.storageDir) ?? (await resolveStorageDir(api));
        if (storageDir === null) {
          throw new Error("Pattern Room storage path is unavailable.");
        }

        storageAdapter =
          (await options.createStorageAdapter?.({ api, storageDir })) ??
          new PatternRoomElectronStorageAdapter(storageDir, readElectronApi() ?? {});
        return storageAdapter;
      }

      function notifyLoaded(snapshot: PatternRoomSessionSnapshot | null): void {
        api.notifyRoom?.(PATTERN_ROOM_LOADED_EVENT, {
          snapshot,
        } satisfies PatternRoomLoadedEventPayload);
      }

      function notifySaved(): void {
        api.notifyRoom?.(PATTERN_ROOM_SAVED_EVENT, {
          success: true,
        } satisfies PatternRoomSavedEventPayload);
      }

      function notifySaveFailed(error: string): void {
        api.notifyRoom?.(PATTERN_ROOM_SAVE_FAILED_EVENT, {
          error,
          success: false,
        } satisfies PatternRoomSaveFailedEventPayload);
      }

      async function enqueueSave(snapshot: PatternRoomSessionSnapshot): Promise<void> {
        const saveAttempt = saveQueue.then(async () => {
          const store = await getStorageAdapter();
          await store.save(snapshot);
        });
        saveQueue = saveAttempt.catch(() => undefined);
        await saveAttempt;
      }

      async function saveSnapshot(payload: unknown): Promise<PatternRoomCommandResult> {
        const commandPayload = readCommandPayload(payload);
        const snapshot = parsePatternRoomSessionSnapshot(commandPayload["snapshot"]);
        if (snapshot === null) {
          const error = "Pattern Room snapshot payload is invalid.";
          notifySaveFailed(error);
          return {
            error,
            success: false,
          };
        }

        try {
          await enqueueSave(snapshot);
          notifySaved();
          return { success: true };
        } catch (error) {
          const message = getSafeErrorMessage(error);
          notifySaveFailed(message);
          return {
            error: message,
            success: false,
          };
        }
      }

      async function loadSnapshot(payload: unknown): Promise<PatternRoomCommandResult> {
        const commandPayload = readCommandPayload(payload);
        const topicId = asNonEmptyString(commandPayload["topicId"]);
        if (topicId === null) {
          notifyLoaded(null);
          return {
            error: "Pattern Room topic id is required.",
            success: false,
          };
        }

        try {
          const store = await getStorageAdapter();
          notifyLoaded(await store.load(topicId));
          return { success: true };
        } catch (error) {
          api.log?.("warn", getSafeErrorMessage(error));
          notifyLoaded(null);
          return {
            error: getSafeErrorMessage(error),
            success: false,
          };
        }
      }

      api.registerCommand?.(PATTERN_ROOM_SAVE_COMMAND, saveSnapshot, {
        description: "Persist the active Pattern Room snapshot from the room UI runtime.",
        exposure: "internal",
        scope: "room-ui",
      });
      api.registerCommand?.(PATTERN_ROOM_LOAD_COMMAND, loadSnapshot, {
        description: "Load a Pattern Room snapshot for the room UI runtime.",
        exposure: "internal",
        scope: "room-ui",
      });

      return {
        commands: {
          [PATTERN_ROOM_SAVE_COMMAND]: saveSnapshot,
          [PATTERN_ROOM_LOAD_COMMAND]: loadSnapshot,
        },
        async dispose(): Promise<void> {
          await saveQueue;
        },
        onRoomEvent(_event: unknown): void {
          return undefined;
        },
        async onRoomReady(): Promise<void> {
          await loadSnapshot({
            topicId: PATTERN_ROOM_DOMAIN_MOCK.topic.id,
          });
        },
      };
    },
  };
}
