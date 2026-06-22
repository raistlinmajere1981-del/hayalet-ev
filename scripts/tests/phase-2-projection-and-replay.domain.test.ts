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

describe("Phase 2 projection and replay", () => {
  void test("repair-room Phase 2 projection restores replay state from the canonical event log", () => {
    const notifications: Array<{ type: string; payload: Record<string, unknown> | undefined }> = [];
    const runtime = createRepairRoomHostRuntime().activate({
      log: () => {},
      notifyRoom: (type, payload) => {
        notifications.push({ type, payload });
      },
    });

    assert.equal(
      runtime.handleCommand(REPAIR_UI_COMMANDS.scrubTimeline, { positionMs: 16 * 60 * 1000 })
        .success,
      true
    );

    const payload = notifications.at(-1)?.payload as
      | {
          meta?: {
            replay?: {
              visibleEvents?: Array<{ id: string }>;
              overlayEvents?: Array<{ id: string }>;
              measurementEvidence?: Array<{ reference: string; history: string[] }>;
            };
          };
          snapshot?: {
            measurement?: { evidence?: Array<{ reference: string }> };
            workbench?: { measurementEvidence?: Array<{ reference: string }> };
          };
        }
      | undefined;

    assert.ok(payload?.meta?.replay);
    assert.equal(
      payload.meta.replay.visibleEvents?.some((event) => event.id === "evt-psu-meas-1"),
      true
    );
    assert.equal(
      payload.meta.replay.overlayEvents?.some((event) => event.id === "evt-psu-anno-1"),
      true
    );
    assert.equal(
      payload.meta.replay.measurementEvidence?.some((entry) => entry.reference.includes("C101")),
      true
    );
    assert.equal(
      payload.snapshot?.measurement?.evidence?.some((entry) => entry.reference.includes("C101")),
      true
    );
    assert.equal(
      payload.snapshot.workbench?.measurementEvidence?.some((entry) =>
        entry.reference.includes("C101")
      ),
      true
    );
  });

  void test("repair-room replay projection holds forensic overlay state during freeze frames", () => {
    const runtime = createRepairRoomHostRuntime().activate({
      log: () => {},
      notifyRoom: () => {},
    });
    const state = runtime.getStateSnapshot().state;
    const session = state.sessions["psu-2025-0510"];
    assert.ok(session);

    const frozenSession = {
      ...session,
      events: [
        ...session.events,
        {
          kind: "measurement" as const,
          id: "evt-freeze-inner-meas",
          sessionId: session.id,
          occurredAt: "2026-05-10T10:31:30.000Z",
          source: "instrument" as const,
          linkedEventIds: ["evt-psu-freeze-1"],
          instrumentId: "multimeter-fnirsi-dmt99",
          channel: "COM/VΩ",
          mode: "DCV",
          range: "20 V",
          value: 4.81,
          rawDisplay: "4.81",
          unit: "V",
          pinAt: { xPx: 900, yPx: 400 },
          reference: "Freeze-window reading",
        },
      ],
    };

    const projection = createRepairReplayProjection(
      {
        ...state,
        workbench: {
          ...state.workbench,
          timeline: {
            ...state.workbench.timeline,
            playheadMs: 13 * 60 * 1000 + 30 * 1000,
            autoFollowLive: false,
          },
        },
      },
      frozenSession
    );

    assert.equal(
      projection.visibleEvents.some((event) => event.id === "evt-freeze-inner-meas"),
      true
    );
    assert.equal(
      projection.overlayEvents.some((event) => event.id === "evt-freeze-inner-meas"),
      false
    );
    assert.equal(projection.activeFreezeFrameEventId, "evt-psu-freeze-1");
  });

  void test("repair-room AI mark expiry is evaluated against replay playhead", () => {
    const runtime = createRepairRoomHostRuntime().activate({
      log: () => {},
      notifyRoom: () => {},
    });
    const state = runtime.getStateSnapshot().state;
    const session = state.sessions["psu-2025-0510"];
    assert.ok(session);

    const expiringSession = {
      ...session,
      events: [
        ...session.events,
        {
          kind: "ai-mark" as const,
          id: "evt-expiring-ai",
          sessionId: session.id,
          occurredAt: "2026-05-10T10:30:32.000Z",
          source: "ai" as const,
          linkedEventIds: [],
          severity: "suggestion" as const,
          region: { xPx: 100, yPx: 100, widthPx: 40, heightPx: 40 },
          rationale: "Short-lived replay mark.",
          protocolKey: "repair-room-tactical-observer",
          dismissed: false,
          lifecycleState: "detected" as const,
          expiresAt: "2026-05-10T10:30:40.000Z",
        },
      ],
    };

    const projection = createRepairReplayProjection(
      {
        ...state,
        workbench: {
          ...state.workbench,
          timeline: {
            ...state.workbench.timeline,
            playheadMs: 13 * 60 * 1000,
            autoFollowLive: false,
          },
        },
      },
      expiringSession
    );

    assert.equal(
      projection.visibleEvents.some((event) => event.id === "evt-expiring-ai"),
      true
    );
    assert.equal(projection.aiMarkEventIds.includes("evt-expiring-ai"), false);
  });

  void test("repair-room timeline chips seek to exact event state and replay controls stay deterministic", () => {
    const runtime = createRepairRoomHostRuntime().activate({
      log: () => {},
      notifyRoom: () => {},
    });
    const session = runtime.getStateSnapshot().state.sessions["psu-2025-0510"];
    assert.ok(session);
    const target = session.events.find((event) => event.id === "evt-psu-meas-4");
    assert.ok(target);
    const expectedOffset = Date.parse(target.occurredAt) - Date.parse(session.startedAt);

    assert.equal(
      runtime.handleCommand(REPAIR_UI_COMMANDS.jumpToEvent, { eventId: target.id }).success,
      true
    );
    assert.equal(runtime.getStateSnapshot().state.workbench.focusedEventId, target.id);
    assert.equal(runtime.getStateSnapshot().state.workbench.timeline.playheadMs, expectedOffset);
    assert.equal(runtime.getStateSnapshot().state.workbench.timeline.autoFollowLive, false);

    assert.equal(
      runtime.handleCommand(REPAIR_UI_COMMANDS.updateTimeline, { replayAction: "play" }).success,
      true
    );
    assert.equal(runtime.getStateSnapshot().state.workbench.timeline.isPlaying, true);
    assert.equal(runtime.getStateSnapshot().state.workbench.timeline.replayMode, "replay");

    assert.equal(
      runtime.handleCommand(REPAIR_UI_COMMANDS.updateTimeline, { replaySpeed: 2 }).success,
      true
    );
    assert.equal(runtime.getStateSnapshot().state.workbench.timeline.replaySpeed, 2);

    assert.equal(
      runtime.handleCommand(REPAIR_UI_COMMANDS.updateTimeline, { replayAction: "live" }).success,
      true
    );
    assert.equal(runtime.getStateSnapshot().state.workbench.timeline.autoFollowLive, true);
    assert.equal(runtime.getStateSnapshot().state.workbench.timeline.replayMode, "live");
  });

  void test("repair-room annotations and knowledge pack spatial focus are forensic records", () => {
    const runtime = createRepairRoomHostRuntime().activate({
      log: () => {},
      notifyRoom: () => {},
    });

    assert.equal(
      runtime.handleCommand(REPAIR_UI_COMMANDS.addTimelineEvent, {
        kind: "annotation",
        tool: "rect",
        xPx: 500,
        yPx: 260,
        label: "Confirmed cracked startup resistor",
        linkedMeasurementId: "evt-psu-meas-2",
        linkedEventId: "evt-psu-ai-2",
      }).success,
      true
    );

    const session = runtime.getStateSnapshot().state.sessions["psu-2025-0510"];
    const annotation = session?.events.at(-1);
    assert.equal(annotation?.kind, "annotation");
    assert.equal(annotation!.meta!.author, "operator");
    assert.equal(annotation!.meta!.tool, "rect");
    assert.deepEqual(annotation!.meta!.linkedMeasurementIds, ["evt-psu-meas-2"]);
    assert.deepEqual(annotation!.meta!.linkedEventIds, ["evt-psu-ai-2"]);

    assert.equal(
      runtime.handleCommand(REPAIR_UI_COMMANDS.updatePanelTab, {
        spatialRefId: "startup-resistor-open",
      }).success,
      true
    );
    assert.equal(
      runtime.getStateSnapshot().state.knowledgePack.focusedSpatialRefId,
      "startup-resistor-open"
    );
    assert.equal(runtime.getStateSnapshot().state.knowledgePack.previewTabId, "board-view");
  });
});
