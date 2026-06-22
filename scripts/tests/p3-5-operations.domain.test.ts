import test from "node:test";
import assert from "node:assert/strict";
import createRepairRoomHostRuntimeBase from "../../rooms/repair-room/host/runtime.ts";
import { createRepairReplayProjection } from "../../rooms/repair-room/host/state/repair-replay-projection.ts";
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

describe("P3.5 operations", () => {
  void test("repair-room P3.5 keeps operations projection optional for standalone room runs", () => {
    const runtime = createRepairRoomHostRuntime().activate({
      log: () => {},
      notifyRoom: () => {},
    });
    const state = runtime.getStateSnapshot().state;
    const session = state.sessions[state.activeSessionId ?? ""];
    assert.ok(session);

    const projection = createRepairReplayProjection(state, session);
    assert.equal(projection.operationsAvailable, false);
    assert.deepEqual(projection.operations.activeCapabilities, []);
    assert.equal(projection.operations.localMicActive, false);
    assert.equal(projection.voiceReadiness.available, false);
    assert.deepEqual(projection.liveSource, {
      available: true,
      connected: false,
      sourceType: "image",
    });

    runtime.dispose();
  });

  void test("repair-room P3.5 starts operations bridge and pushes live camera status", async () => {
    const notifications: Array<{ type: string; payload: Record<string, unknown> | undefined }> = [];
    const subscribers: Array<(status: OperationsStatus) => void> = [];
    let unsubscribed = false;
    const initialStatus: OperationsStatus = {
      updatedAt: 0,
      records: [],
    };
    const liveStatus: OperationsStatus = {
      updatedAt: 1,
      records: [
        {
          capability: "android-camera",
          owner: { id: "repair-room", label: "Repair Room", roomId: "repair-room" },
          startedAt: 1,
        },
        {
          capability: "live-feed",
          owner: { id: "repair-room", label: "Repair Room", roomId: "repair-room" },
          startedAt: 2,
        },
      ],
    };

    const runtime = createRepairRoomHostRuntime().activate({
      log: () => {},
      notifyRoom: (type, payload) => {
        notifications.push({ type, payload });
      },
      operations: {
        getStatus: () => initialStatus,
        subscribe: (listener: (status: OperationsStatus) => void) => {
          subscribers.push(listener);
          return () => {
            unsubscribed = true;
          };
        },
      },
    });

    await Promise.resolve();
    assert.equal(runtime.getStateSnapshot().state.operationsStatus?.updatedAt, 0);
    assert.equal(subscribers.length, 1);

    subscribers.at(-1)?.(liveStatus);
    const snapshot = runtime.getStateSnapshot().state;
    const session = snapshot.sessions[snapshot.activeSessionId ?? ""];
    assert.ok(session);
    const projection = createRepairReplayProjection(snapshot, session);
    assert.equal(projection.operationsAvailable, true);
    assert.equal(projection.operations.cameraActive, true);
    assert.equal(projection.operations.liveFeedActive, true);
    assert.deepEqual(projection.liveSource, {
      available: true,
      connected: true,
      sourceType: "android-camera",
      preview: null,
    });
    assert.ok(notifications.some((entry) => entry.type === "repair-state"));

    runtime.dispose();
    assert.equal(unsubscribed, true);
  });

  void test("repair-room P3.5 projects central operations status without owning capabilities", () => {
    const runtime = createRepairRoomHostRuntime().activate({
      log: () => {},
      notifyRoom: () => {},
    });
    const state = runtime.getStateSnapshot().state;
    const session = state.sessions[state.activeSessionId ?? ""];
    assert.ok(session);

    const projection = createRepairReplayProjection(
      {
        ...state,
        operationsStatus: {
          updatedAt: 1,
          records: [
            {
              capability: "local-microphone",
              owner: { id: "repair-room", label: "Repair Room", roomId: "repair-room" },
              startedAt: 1,
            },
            {
              capability: "android-camera",
              owner: { id: "repair-room", label: "Repair Room", roomId: "repair-room" },
              startedAt: 2,
            },
            {
              capability: "live-feed",
              owner: { id: "repair-room", label: "Repair Room", roomId: "repair-room" },
              startedAt: 3,
            },
            {
              capability: "ambient-listening",
              owner: { id: "repair-room", label: "Repair Room", roomId: "repair-room" },
              startedAt: 4,
            },
            {
              capability: "local-tts",
              owner: { id: "repair-room", label: "Repair Room", roomId: "repair-room" },
              startedAt: 5,
            },
          ],
        },
      },
      session
    );

    assert.equal(projection.operationsAvailable, true);
    assert.equal(projection.operations.localMicActive, true);
    assert.equal(projection.operations.androidMicActive, false);
    assert.equal(projection.operations.cameraActive, true);
    assert.equal(projection.operations.liveFeedActive, true);
    assert.equal(projection.operations.ambientActive, true);
    assert.equal(projection.operations.ttsActive, true);
    assert.equal(projection.operations.activeOwner, "Repair Room");
    assert.deepEqual(projection.liveSource, {
      available: true,
      connected: true,
      sourceType: "android-camera",
      preview: null,
    });

    runtime.dispose();
  });

  void test("repair-room P3.5 projects voice readiness from operations and guidance state", () => {
    const runtime = createRepairRoomHostRuntime().activate({
      log: () => {},
      notifyRoom: () => {},
    });
    assert.equal(
      runtime.handleCommand(REPAIR_UI_COMMANDS.setVoiceGuidance, {
        ambientListeningState: "listening",
        handsBusyMode: true,
      }).success,
      true
    );

    const state = runtime.getStateSnapshot().state;
    const session = state.sessions[state.activeSessionId ?? ""];
    assert.ok(session);
    const projection = createRepairReplayProjection(
      {
        ...state,
        operationsStatus: {
          updatedAt: 2,
          records: [
            {
              capability: "android-microphone",
              owner: { id: "repair-room", label: "Repair Room" },
              startedAt: 10,
            },
            {
              capability: "ambient-listening",
              owner: { id: "repair-room", label: "Repair Room" },
              startedAt: 11,
            },
          ],
        },
      },
      session
    );

    assert.deepEqual(projection.voiceReadiness, {
      available: true,
      listening: true,
      handsBusyMode: true,
      ambientMode: true,
    });

    runtime.dispose();
  });

  void test("repair-room P3.5 keeps live source extensible for future camera providers", () => {
    const runtime = createRepairRoomHostRuntime().activate({
      log: () => {},
      notifyRoom: () => {},
    });
    const state = runtime.getStateSnapshot().state;
    const session = state.sessions[state.activeSessionId ?? ""];
    assert.ok(session);

    const projection = createRepairReplayProjection(
      {
        ...state,
        operationsStatus: {
          updatedAt: 3,
          records: [
            {
              capability: "thermal-camera",
              owner: { id: "scope", label: "Thermal scope" },
              startedAt: 20,
            },
            {
              capability: "live-feed",
              owner: { id: "scope", label: "Thermal scope" },
              startedAt: 21,
            },
          ],
        },
      },
      session
    );

    assert.equal(projection.operations.cameraActive, true);
    assert.deepEqual(projection.liveSource, {
      available: true,
      connected: true,
      sourceType: "thermal-camera",
      preview: null,
    });

    runtime.dispose();
  });

  void test("repair-room P3.5 action registry carries reusable disabled metadata", () => {
    const requiredIds = [
      "focus-measurement",
      "focus-ai-mark",
      "next-event",
      "previous-event",
      "take-snapshot",
      "start-measurement",
      "verify-region",
      "conclude-investigation",
    ];
    const ids = REPAIR_ACTION_REGISTRY.map((entry) => entry.id);
    assert.deepEqual(ids, requiredIds);
    assert.equal(new Set(ids).size, ids.length);

    const commandNames = new Set(Object.values(REPAIR_UI_COMMANDS));
    REPAIR_ACTION_REGISTRY.forEach((entry) => {
      assert.equal(entry.enabled, false, entry.id);
      assert.equal(commandNames.has(entry.commandName), true, entry.id);
      assert.ok(entry.label.length > 0, entry.id);
      assert.ok(typeof entry.category === "string" && entry.category.length > 0, entry.id);
    });

    const phraseMap = getRepairVoiceCommandPhraseMap();
    assert.deepEqual(phraseMap, {});
    const enabledPhraseMap = getRepairVoiceCommandPhraseMap([
      {
        ...REPAIR_ACTION_REGISTRY[0],
        enabled: true,
      },
      {
        ...REPAIR_ACTION_REGISTRY[5],
        enabled: true,
      },
    ]);
    assert.ok(
      enabledPhraseMap[REPAIR_UI_COMMANDS.focusOverlayEntity]?.includes("focus measurement") ===
        true
    );
    assert.ok(
      enabledPhraseMap[REPAIR_UI_COMMANDS.addMeasurement]?.includes("start measurement") === true
    );

    const runtime = createRepairRoomHostRuntime().activate({
      log: () => {},
      notifyRoom: () => {},
    }) as { voiceCommands?: Record<string, readonly string[]>; dispose: () => void };
    assert.deepEqual(runtime.voiceCommands, {});
    runtime.dispose();
  });

  void test("repair-room P3.5 projects continuity from focus, measurement, and verified regions", () => {
    const runtime = createRepairRoomHostRuntime().activate({
      log: () => {},
      notifyRoom: () => {},
    });
    assert.equal(
      runtime.handleCommand(REPAIR_UI_COMMANDS.focusKnowledgeSpatialRef, {
        spatialRefId: "startup-resistor-open",
      }).success,
      true
    );

    const state = runtime.getStateSnapshot().state;
    const session = state.sessions[state.activeSessionId ?? ""];
    assert.ok(session);
    const regionSession = {
      ...session,
      events: [
        ...session.events,
        {
          kind: "investigation-region-created" as const,
          id: "evt-continuity-region-create",
          sessionId: session.id,
          occurredAt: "2026-05-10T10:43:00.000Z",
          source: "operator" as const,
          linkedEventIds: ["evt-psu-meas-4"],
          regionId: "region-continuity",
          label: "Continuity verified region",
          region: { xPx: 440, yPx: 245, widthPx: 140, heightPx: 110 },
          status: "active" as const,
          color: "rgb(86, 200, 222)",
          sourceRef: { kind: "event" as const, id: "evt-psu-ai-2" },
          measurementEventIds: ["evt-psu-meas-4"],
        },
        {
          kind: "investigation-region-updated" as const,
          id: "evt-continuity-region-update",
          sessionId: session.id,
          occurredAt: "2026-05-10T10:44:00.000Z",
          source: "operator" as const,
          linkedEventIds: ["evt-psu-meas-4"],
          regionId: "region-continuity",
          label: "Continuity verified region",
          status: "resolved" as const,
        },
      ],
    };

    const projection = createRepairReplayProjection(state, regionSession);
    assert.deepEqual(projection.continuity.lastFocusTarget, {
      ref: { kind: "knowledge-region", id: "startup-resistor-open" },
      label: "Startup resistor open",
    });
    assert.equal(projection.continuity.lastMeasurement?.eventId, "evt-psu-meas-5");
    assert.deepEqual(projection.continuity.lastVerifiedRegion, {
      ref: { kind: "investigation-region", id: "region-continuity" },
      label: "Continuity verified region",
    });
    assert.equal(
      projection.continuity.currentInvestigationPhase,
      projection.guidance.investigationPhase
    );

    runtime.dispose();
  });
});
