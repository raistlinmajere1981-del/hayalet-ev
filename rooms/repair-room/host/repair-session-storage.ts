import { REPAIR_ROOM_ID } from "../shared/repair-constants.js";
import {
  createRepairRoomPaths,
  createRepairStoragePaths,
  readRepairRoomStorageDir,
} from "../shared/host/repair-paths.js";
import type {
  RepairChatTurn,
  RepairOperatorProfile,
  RepairSession,
  RepairSessionListItem,
} from "../shared/types/index.js";

type RepairDirectoryEntry = {
  isDirectory: boolean;
  name: string;
  path: string;
};

export type RepairSessionStorageDeps = {
  ensureRuntimeDirectory: (dirPath: string, requestId?: string | null) => Promise<void>;
  listDirectory: (dirPath: string) => Promise<RepairDirectoryEntry[]>;
  readJsonFile: (filePath: string) => Promise<unknown>;
  writeJsonFile: (filePath: string, value: unknown) => Promise<void>;
};

export interface RepairStoredSessionRecord {
  chatTurns: RepairChatTurn[];
  roomId: string;
  savedAt: string;
  schemaVersion: 1;
  session: RepairSession;
}

export interface RepairStoredOperatorProfileRecord {
  profile: RepairOperatorProfile;
  roomId: string;
  savedAt: string;
  schemaVersion: 1;
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return typeof value === "object" && value !== null && Array.isArray(value) === false
    ? (value as Record<string, unknown>)
    : null;
}

function asRepairSession(value: unknown): RepairSession | null {
  const record = asRecord(value);
  return record !== null &&
    typeof record["id"] === "string" &&
    typeof record["roomId"] === "string" &&
    Array.isArray(record["events"])
    ? (value as RepairSession)
    : null;
}

function asRepairChatTurns(value: unknown): RepairChatTurn[] {
  return Array.isArray(value)
    ? value.filter((turn): turn is RepairChatTurn => {
        const record = asRecord(turn);
        return (
          record !== null &&
          typeof record["id"] === "string" &&
          (record["role"] === "operator" || record["role"] === "ai") &&
          typeof record["text"] === "string" &&
          typeof record["occurredAt"] === "string"
        );
      })
    : [];
}

function asRepairOperatorProfile(value: unknown): RepairOperatorProfile | null {
  const record = asRecord(value);
  return record !== null &&
    typeof record["profileId"] === "string" &&
    typeof record["displayName"] === "string"
    ? (value as RepairOperatorProfile)
    : null;
}

function asStoredOperatorProfileRecord(value: unknown): RepairStoredOperatorProfileRecord | null {
  const rawProfile = asRepairOperatorProfile(value);
  if (rawProfile !== null) {
    return {
      profile: rawProfile,
      roomId: REPAIR_ROOM_ID,
      savedAt: rawProfile.updatedAt,
      schemaVersion: 1,
    };
  }

  const record = asRecord(value);
  const profile = asRepairOperatorProfile(record?.["profile"]);
  if (profile === null) return null;
  return {
    profile,
    roomId: REPAIR_ROOM_ID,
    savedAt: typeof record?.["savedAt"] === "string" ? record["savedAt"] : profile.updatedAt,
    schemaVersion: 1,
  };
}

function asStoredSessionRecord(value: unknown): RepairStoredSessionRecord | null {
  const rawSession = asRepairSession(value);
  if (rawSession !== null) {
    return {
      chatTurns: [],
      roomId: REPAIR_ROOM_ID,
      savedAt: rawSession.updatedAt,
      schemaVersion: 1,
      session: rawSession,
    };
  }

  const record = asRecord(value);
  const session = asRepairSession(record?.["session"]);
  if (session === null || session.roomId !== REPAIR_ROOM_ID) {
    return null;
  }

  return {
    chatTurns: asRepairChatTurns(record?.["chatTurns"]),
    roomId: REPAIR_ROOM_ID,
    savedAt: typeof record?.["savedAt"] === "string" ? record["savedAt"] : session.updatedAt,
    schemaVersion: 1,
    session,
  };
}

function toSessionListItem(session: RepairSession): RepairSessionListItem {
  return {
    id: session.id,
    title: session.title,
    deviceLabel: session.deviceInfo.deviceLabel,
    boardCode: session.deviceInfo.boardCode,
    serialNumber: session.deviceInfo.serialNumber,
    status: session.status,
    riskLevel: session.riskLevel,
    updatedAt: session.updatedAt,
    isArchived: session.status === "archived",
  };
}

export function createRepairSessionStorage(deps: RepairSessionStorageDeps) {
  const { ensureRuntimeDirectory, listDirectory, readJsonFile, writeJsonFile } = deps;

  async function ensureSessionRoot(runtimePaths: unknown): Promise<string> {
    const roomStorageDir = readRepairRoomStorageDir(runtimePaths);
    if (roomStorageDir === null) {
      throw new Error("Repair room storage is unavailable.");
    }

    const sessionsDir = `${roomStorageDir}/sessions`;
    await ensureRuntimeDirectory(sessionsDir);
    return sessionsDir;
  }

  async function saveSessionRecord(
    runtimePaths: unknown,
    record: Pick<RepairStoredSessionRecord, "chatTurns" | "session">
  ): Promise<RepairStoredSessionRecord> {
    const paths = createRepairStoragePaths(runtimePaths, record.session.id);
    const nextRecord: RepairStoredSessionRecord = {
      chatTurns: record.chatTurns,
      roomId: REPAIR_ROOM_ID,
      savedAt: new Date().toISOString(),
      schemaVersion: 1,
      session: record.session,
    };
    await ensureRuntimeDirectory(paths.sessionsDir);
    await ensureRuntimeDirectory(paths.sessionDir);
    await writeJsonFile(paths.sessionFilePath, nextRecord);
    return nextRecord;
  }

  async function loadOperatorProfileRecord(
    runtimePaths: unknown
  ): Promise<RepairStoredOperatorProfileRecord | null> {
    const paths = createRepairRoomPaths(runtimePaths);
    return asStoredOperatorProfileRecord(await readJsonFile(paths.operatorProfileFilePath));
  }

  async function saveOperatorProfileRecord(
    runtimePaths: unknown,
    profile: RepairOperatorProfile
  ): Promise<RepairStoredOperatorProfileRecord> {
    const paths = createRepairRoomPaths(runtimePaths);
    const nextRecord: RepairStoredOperatorProfileRecord = {
      profile,
      roomId: REPAIR_ROOM_ID,
      savedAt: new Date().toISOString(),
      schemaVersion: 1,
    };
    await ensureRuntimeDirectory(paths.roomStorageDir);
    await writeJsonFile(paths.operatorProfileFilePath, nextRecord);
    return nextRecord;
  }

  async function loadSessionRecord(
    runtimePaths: unknown,
    sessionId: string
  ): Promise<RepairStoredSessionRecord | null> {
    const loaded = asStoredSessionRecord(
      await readJsonFile(createRepairStoragePaths(runtimePaths, sessionId).sessionFilePath)
    );
    if (loaded === null || loaded.session.roomId !== REPAIR_ROOM_ID) {
      return null;
    }
    return loaded;
  }

  async function listSessionRecords(runtimePaths: unknown): Promise<RepairStoredSessionRecord[]> {
    const sessionsDir = await ensureSessionRoot(runtimePaths);
    const entries = await listDirectory(sessionsDir);
    const records = (
      await Promise.all(
        entries
          .filter((entry) => entry.isDirectory === true)
          .map(async (entry) => {
            const loaded = asStoredSessionRecord(await readJsonFile(`${entry.path}/session.json`));
            if (loaded === null || loaded.session.roomId !== REPAIR_ROOM_ID) {
              return null;
            }
            return loaded;
          })
      )
    ).filter((entry): entry is RepairStoredSessionRecord => entry !== null);

    return records.sort((left, right) =>
      right.session.updatedAt.localeCompare(left.session.updatedAt)
    );
  }

  async function listSessions(runtimePaths: unknown): Promise<RepairSessionListItem[]> {
    return (await listSessionRecords(runtimePaths)).map((record) =>
      toSessionListItem(record.session)
    );
  }

  async function loadLatestSessionRecord(
    runtimePaths: unknown
  ): Promise<RepairStoredSessionRecord | null> {
    return (await listSessionRecords(runtimePaths))[0] ?? null;
  }

  return {
    ensureSessionRoot,
    listSessionRecords,
    listSessions,
    loadOperatorProfileRecord,
    loadLatestSessionRecord,
    loadSessionRecord,
    saveOperatorProfileRecord,
    saveSessionRecord,
  };
}

export type RepairSessionStorageRuntime = ReturnType<typeof createRepairSessionStorage>;
