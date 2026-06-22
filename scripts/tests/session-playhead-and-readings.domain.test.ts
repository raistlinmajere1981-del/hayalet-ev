import test from "node:test";
import assert from "node:assert/strict";
import createRepairRoomHostRuntimeBase from "../../rooms/repair-room/host/runtime.ts";
import {
  createEmptyRepairReplayProjection,
  createRepairReplayProjection,
} from "../../rooms/repair-room/host/state/repair-replay-projection.ts";
import {
  createRepairUiSnapshot,
  createRepairUiSnapshotMeta,
} from "../../rooms/repair-room/host/state/repair-selectors.ts";
import { getRepairRoomSyncRows } from "../../rooms/repair-room/ui/panels/room-sync-panel.ts";
import {
  REPAIR_LOCAL_OWNER_SCOPE_ID,
  REPAIR_ROOM_ID,
  REPAIR_SESSION_SCHEMA_VERSION,
  REPAIR_UI_COMMANDS,
} from "../../rooms/repair-room/shared/repair-constants.ts";
import {
  MOCK_REPAIR_CHAT_TURNS,
  MOCK_REPAIR_EVENTS,
  MOCK_REPAIR_KNOWLEDGE_PACKS,
  MOCK_REPAIR_PCB_IMAGES,
} from "../../rooms/repair-room/shared/data/index.ts";
import {
  REPAIR_ACTION_REGISTRY,
  getRepairVoiceCommandPhraseMap,
} from "../../rooms/repair-room/shared/repair-action-registry.ts";
import { normalizeRepairHostMessage } from "../../rooms/repair-room/shared/ui/host-messages.ts";
import { createRepairDefaultGuidanceProjection } from "../../rooms/repair-room/shared/ui/state.ts";
import type {
  RepairStoredEvidenceSelectionRecord,
  RepairStoredOperatorProfileRecord,
  RepairStoredSessionRecord,
} from "../../rooms/repair-room/host/repair-session-storage.ts";
import type {
  RepairChatTurn,
  RepairSession,
  RepairSessionListItem,
} from "../../rooms/repair-room/shared/types/index.ts";
import type { OperationsStatus } from "../../src/types/operations.ts";

function cloneJson<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

function toStoredSessionListItem(session: RepairSession): RepairSessionListItem {
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

const TEST_REPAIR_ACTIVE_SESSION_ID = "psu-2025-0510";

type TestRepairSessionOverrides = Partial<Omit<RepairSession, "deviceInfo" | "symptoms">> & {
  deviceInfo?: Partial<RepairSession["deviceInfo"]>;
  symptoms?: Partial<RepairSession["symptoms"]>;
};

function createTestRepairSession(overrides: TestRepairSessionOverrides = {}): RepairSession {
  const base: RepairSession = {
    schemaVersion: REPAIR_SESSION_SCHEMA_VERSION,
    id: TEST_REPAIR_ACTIVE_SESSION_ID,
    roomId: REPAIR_ROOM_ID,
    ownerScopeId: REPAIR_LOCAL_OWNER_SCOPE_ID,
    title: "PSU-2025-0510",
    status: "in-progress",
    riskLevel: "medium",
    deviceInfo: {
      deviceType: "TV guc karti / PSU",
      deviceLabel: "ATX Power Supply",
      manufacturer: "Samsung",
      model: "BN44-00932A",
      boardCode: "BN44-00932A",
      serialNumber: "R21Z14CSN100123",
      intakeNotes: "No power. Bulk cap discharged before intake.",
    },
    symptoms: {
      primarySymptoms: ["No Power"],
      freeText: "Dead board. Confirms no 5V_STBY at output connector pin 9.",
      reportedAt: "2026-05-10T10:14:48.000Z",
    },
    pcbImage: cloneJson(MOCK_REPAIR_PCB_IMAGES[TEST_REPAIR_ACTIVE_SESSION_ID] ?? null),
    knowledgePackId: "bn44-00932a",
    knowledgePack: cloneJson(MOCK_REPAIR_KNOWLEDGE_PACKS["bn44-00932a"] ?? null),
    events: cloneJson(MOCK_REPAIR_EVENTS[TEST_REPAIR_ACTIVE_SESSION_ID] ?? []),
    sessionNotes:
      "Bulk cap reads 0 V, R201 open, U14 gate flatlined. Plan: replace R201, retest 5V_STBY, then probe gate drive.",
    startedAt: "2026-05-10T10:18:00.000Z",
    updatedAt: "2026-05-10T10:42:11.000Z",
    archivedAt: null,
  };

  return {
    ...base,
    ...overrides,
    deviceInfo: {
      ...base.deviceInfo,
      ...(overrides.deviceInfo ?? {}),
    },
    symptoms: {
      ...base.symptoms,
      ...(overrides.symptoms ?? {}),
    },
  };
}

function createTestRepairRuntimeSeed() {
  const session = createTestRepairSession();
  return {
    activeSessionId: session.id,
    chatTurns: cloneJson(MOCK_REPAIR_CHAT_TURNS),
    sessionList: [toStoredSessionListItem(session)],
    sessions: { [session.id]: session },
  };
}

type RepairRoomHostRuntimeOptions = NonNullable<
  Parameters<typeof createRepairRoomHostRuntimeBase>[0]
>;

function createRepairRoomHostRuntime(options: RepairRoomHostRuntimeOptions = {}) {
  const usesCallerState =
    options.initialSeed !== undefined || options.io !== undefined || options.storage !== undefined;
  return createRepairRoomHostRuntimeBase(
    usesCallerState
      ? options
      : { ...options, autoHydrateStorage: false, initialSeed: createTestRepairRuntimeSeed() }
  );
}

function createMemoryRepairIo() {
  return {
    callRoomTools: async (_request: Record<string, unknown>) => ({ success: true }),
    ensureRuntimeDirectory: async (_dirPath: string, _requestId?: string | null) => {},
    deleteRuntimePath: async (
      _targetPath: string,
      _options?: { recursive?: boolean; requestId?: string | null }
    ) => {},
    getElectronApi: () => null,
    listDirectory: async (_dirPath: string) => [],
    readJsonFile: async (_filePath: string) => null,
    resolveRuntimePaths: async (_requestId?: string | null) => ({
      storageDir: "/tmp/repair-room-test",
    }),
    writeJsonFile: async (_filePath: string, _value: unknown) => {},
  };
}

function createStoredRepairRecord(
  session: RepairSession,
  chatTurns: RepairChatTurn[] = [],
  schemaVersion = 2
): RepairStoredSessionRecord {
  return {
    chatTurns,
    roomId: REPAIR_ROOM_ID,
    savedAt: session.updatedAt,
    schemaVersion,
    session,
  } as RepairStoredSessionRecord;
}

function createMemoryRepairStorage(initialRecords: RepairStoredSessionRecord[] = []) {
  const records = new Map<string, RepairStoredSessionRecord>();
  const evidenceSelectionRecords = new Map<string, RepairStoredEvidenceSelectionRecord>();
  let operatorProfileRecord: RepairStoredOperatorProfileRecord | null = null;
  initialRecords.forEach((record) => {
    records.set(record.session.id, cloneJson(record));
  });
  const listRecords = () =>
    Array.from(records.values())
      .filter(
        (record) =>
          record.session.schemaVersion === 2 &&
          typeof record.session.deviceInfo.deviceType === "string"
      )
      .sort((left, right) => right.session.updatedAt.localeCompare(left.session.updatedAt));
  return {
    deleteSessionRecord: async (_runtimePaths: unknown, _sessionId: string) => {},
    ensureSessionRoot: async (_runtimePaths: unknown) => "/tmp/repair-room-test/sessions",
    listSessionRecords: async (_runtimePaths: unknown) =>
      listRecords().map((record) => cloneJson(record)),
    listSessions: async (_runtimePaths: unknown) =>
      listRecords().map((record) => toStoredSessionListItem(record.session)),
    loadOperatorProfileRecord: async (_runtimePaths: unknown) => cloneJson(operatorProfileRecord),
    loadLatestSessionRecord: async (_runtimePaths: unknown) => cloneJson(listRecords()[0] ?? null),
    loadSessionRecord: async (_runtimePaths: unknown, sessionId: string) =>
      cloneJson(records.get(sessionId) ?? null),
    saveSessionRecord: async (
      _runtimePaths: unknown,
      record: Pick<RepairStoredSessionRecord, "chatTurns" | "session">
    ) => {
      const nextRecord = createStoredRepairRecord(
        cloneJson(record.session),
        cloneJson(record.chatTurns)
      );
      records.set(nextRecord.session.id, nextRecord);
      return cloneJson(nextRecord);
    },
    loadEvidenceSelectionRecord: async (_runtimePaths: unknown, sessionId: string) =>
      cloneJson(evidenceSelectionRecords.get(sessionId) ?? null),
    saveEvidenceSelectionRecord: async (
      _runtimePaths: unknown,
      selection: RepairStoredEvidenceSelectionRecord["selection"]
    ) => {
      const nextRecord: RepairStoredEvidenceSelectionRecord = {
        roomId: REPAIR_ROOM_ID,
        savedAt: new Date().toISOString(),
        schemaVersion: 2,
        selection: cloneJson(selection),
        sessionId: selection.sessionId,
      };
      evidenceSelectionRecords.set(selection.sessionId, nextRecord);
      return cloneJson(nextRecord);
    },
    saveOperatorProfileRecord: async (
      _runtimePaths: unknown,
      profile: RepairStoredOperatorProfileRecord["profile"]
    ) => {
      operatorProfileRecord = {
        profile: cloneJson(profile),
        roomId: REPAIR_ROOM_ID,
        savedAt: new Date().toISOString(),
        schemaVersion: 1,
      };
      return cloneJson(operatorProfileRecord);
    },
    readOperatorProfileRecord(): unknown {
      return cloneJson(operatorProfileRecord);
    },
    readRecord(sessionId: string): RepairStoredSessionRecord | null {
      return cloneJson(records.get(sessionId) ?? null);
    },
    readEvidenceSelectionRecord(sessionId: string): RepairStoredEvidenceSelectionRecord | null {
      return cloneJson(evidenceSelectionRecords.get(sessionId) ?? null);
    },
  };
}

describe("session playhead and readings", () => {
  void test("repair-room opens the existing active session without replaying research setup", (t) => {
    t.mock.timers.enable({
      apis: ["Date", "setInterval", "setTimeout"],
      now: new Date("2026-05-11T09:00:00.000Z"),
    });
    const runtime = createRepairRoomHostRuntime().activate({
      log: () => {},
      notifyRoom: () => {},
    });

    assert.equal(runtime.getStateSnapshot().state.wizard.currentStep, "device-info");
    assert.equal(runtime.getStateSnapshot().state.wizard.generatedKnowledgePackId, null);
    assert.equal(runtime.getStateSnapshot().state.wizard.researchProgress.length, 0);

    assert.equal(runtime.handleCommand(REPAIR_UI_COMMANDS.uiReady).success, true);
    t.mock.timers.tick(4000);

    const wizard = runtime.getStateSnapshot().state.wizard;
    assert.equal(wizard.currentStep, "device-info");
    assert.equal(wizard.foundResources.length, 0);
    assert.equal(wizard.researchProgress.length, 0);

    runtime.dispose();
    t.mock.timers.reset();
  });

  void test("repair-room live playhead advances from room activation instead of mock wall-clock age", (t) => {
    t.mock.timers.enable({
      apis: ["Date", "setInterval", "setTimeout"],
      now: new Date("2026-05-11T09:00:00.000Z"),
    });
    const runtime = createRepairRoomHostRuntime().activate({
      log: () => {},
      notifyRoom: () => {},
    });
    const before = runtime.getStateSnapshot().state.workbench.timeline.playheadMs;

    assert.equal(runtime.handleCommand(REPAIR_UI_COMMANDS.uiReady).success, true);
    t.mock.timers.tick(1100);

    const after = runtime.getStateSnapshot().state.workbench.timeline.playheadMs;
    assert.ok(after >= before);
    assert.ok(after - before <= 1200, `playhead drifted too far: ${after - before}ms`);
    assert.ok(after < 2_000_000, `playhead should stay near mock session edge, got ${after}ms`);

    runtime.dispose();
    t.mock.timers.reset();
  });

  void test("repair-room runtime drifts live readings into recent instrument history", (t) => {
    t.mock.timers.enable({
      apis: ["Date", "setInterval", "setTimeout"],
      now: new Date("2026-05-11T09:00:00.000Z"),
    });
    const runtime = createRepairRoomHostRuntime().activate({
      log: () => {},
      notifyRoom: () => {},
    });
    const before = runtime.getStateSnapshot().state.measurement.recent.length;

    assert.equal(runtime.handleCommand(REPAIR_UI_COMMANDS.uiReady).success, true);
    t.mock.timers.tick(1100);

    const measurement = runtime.getStateSnapshot().state.measurement;
    assert.equal(measurement.recent.length, before + 1);
    assert.equal(measurement.recent[0]?.reference, "Live drift sample");
    assert.equal(measurement.current.display, "0.000");
    t.mock.timers.reset();
  });
});
