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

describe("Phase 2.8 investigation", () => {
  void test("repair-room Phase 2.8 folds investigation regions from canonical replay events", () => {
    const runtime = createRepairRoomHostRuntime().activate({
      log: () => {},
      notifyRoom: () => {},
    });
    const state = runtime.getStateSnapshot().state;
    const session = state.sessions["psu-2025-0510"];
    assert.ok(session);

    const regionSession = {
      ...session,
      events: [
        ...session.events,
        {
          kind: "investigation-region-created" as const,
          id: "evt-region-create-1",
          sessionId: session.id,
          occurredAt: "2026-05-10T10:43:00.000Z",
          source: "operator" as const,
          linkedEventIds: ["evt-psu-meas-4"],
          regionId: "region-u14-chain",
          label: "U14 gate-driver chain",
          region: { xPx: 440, yPx: 245, widthPx: 140, heightPx: 110 },
          status: "active" as const,
          color: "rgb(86, 200, 222)",
          sourceRef: { kind: "event" as const, id: "evt-psu-ai-2" },
          measurementEventIds: ["evt-psu-meas-3", "evt-psu-meas-4"],
          annotationEventIds: ["evt-psu-anno-1"],
          aiMarkEventIds: ["evt-psu-ai-2"],
        },
        {
          kind: "investigation-region-updated" as const,
          id: "evt-region-update-1",
          sessionId: session.id,
          occurredAt: "2026-05-10T10:44:00.000Z",
          source: "operator" as const,
          linkedEventIds: ["evt-psu-meas-4"],
          regionId: "region-u14-chain",
          label: "U14 chain resolved",
          status: "resolved" as const,
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
            playheadMs: 30 * 60 * 1000,
            autoFollowLive: false,
          },
        },
      },
      regionSession
    );

    assert.equal(projection.investigationRegions.length, 1);
    assert.equal(projection.investigationRegions[0]?.regionId, "region-u14-chain");
    assert.equal(projection.investigationRegions[0].createdEventId, "evt-region-create-1");
    assert.equal(projection.investigationRegions[0].updatedEventId, "evt-region-update-1");
    assert.equal(projection.investigationRegions[0].status, "resolved");
    assert.deepEqual(projection.investigationRegions[0].linkage.measurementEventIds, [
      "evt-psu-meas-3",
      "evt-psu-meas-4",
    ]);
  });

  void test("repair-room Phase 2.8 keeps investigation mode explicit and entity refs commandable", () => {
    const runtime = createRepairRoomHostRuntime().activate({
      log: () => {},
      notifyRoom: () => {},
    });

    assert.equal(
      runtime.handleCommand(REPAIR_UI_COMMANDS.toggleInvestigationMode, { enabled: true }).success,
      true
    );
    assert.equal(runtime.getStateSnapshot().state.workbench.investigationModeEnabled, true);

    assert.equal(
      runtime.handleCommand(REPAIR_UI_COMMANDS.selectOverlayEntities, {
        refs: [
          { kind: "event", id: "evt-psu-meas-3" },
          { kind: "knowledge-region", id: "startup-resistor-open" },
        ],
        mode: "replace",
      }).success,
      true
    );
    assert.deepEqual(runtime.getStateSnapshot().state.workbench.selection.selectedEventIds, [
      "evt-psu-meas-3",
    ]);
    assert.deepEqual(runtime.getStateSnapshot().state.workbench.selection.selectedEntityRefs, [
      { kind: "event", id: "evt-psu-meas-3" },
      { kind: "knowledge-region", id: "startup-resistor-open" },
    ]);

    assert.equal(
      runtime.handleCommand(REPAIR_UI_COMMANDS.focusOverlayEntity, {
        ref: { kind: "live-edge", id: "live-edge" },
      }).success,
      true
    );
    assert.equal(
      runtime.getStateSnapshot().state.workbench.selection.inspectorEntityRef?.kind,
      "live-edge"
    );
  });

  void test("repair-room Phase 2.8 focuses investigation regions, relationships, and live edge explicitly", () => {
    const runtime = createRepairRoomHostRuntime().activate({
      log: () => {},
      notifyRoom: () => {},
    });

    assert.equal(
      runtime.handleCommand(REPAIR_UI_COMMANDS.promoteKnowledgeRegion, {
        spatialRefId: "startup-resistor-open",
      }).success,
      true
    );
    let state = runtime.getStateSnapshot().state;
    let session = state.sessions[state.activeSessionId ?? ""];
    assert.ok(session);
    const regionEvent = session.events.find(
      (event) =>
        event.kind === "investigation-region-created" &&
        event.knowledgeSpatialRefId === "startup-resistor-open"
    );
    assert.ok(regionEvent);

    assert.equal(
      runtime.handleCommand(REPAIR_UI_COMMANDS.focusInvestigationRegion, {
        regionId: (regionEvent as { regionId: string }).regionId,
      }).success,
      true
    );
    state = runtime.getStateSnapshot().state;
    session = state.sessions[state.activeSessionId ?? ""];
    assert.ok(session);
    let projection = createRepairReplayProjection(state, session);
    assert.equal(state.workbench.investigationModeEnabled, true);
    assert.deepEqual(state.workbench.selection.inspectorEntityRef, {
      kind: "investigation-region",
      id: (regionEvent as { regionId: string }).regionId,
    });
    assert.deepEqual(projection.activeSpatialFocus?.ref, {
      kind: "investigation-region",
      id: (regionEvent as { regionId: string }).regionId,
    });
    assert.deepEqual(
      [
        ...new Set(projection.measurementRelationships.map((relationship) => relationship.kind)),
      ].sort(),
      ["investigation-group", "linked-ai-mark", "linked-annotation", "previous-event", "rail"]
    );

    const relationship = projection.measurementRelationships[0];
    assert.ok(relationship);
    assert.equal(
      runtime.handleCommand(REPAIR_UI_COMMANDS.focusOverlayEntity, {
        ref: { kind: "measurement-relationship", id: relationship.id },
      }).success,
      true
    );
    state = runtime.getStateSnapshot().state;
    session = state.sessions[state.activeSessionId ?? ""];
    assert.ok(session);
    projection = createRepairReplayProjection(state, session);
    assert.deepEqual(projection.activeSpatialFocus?.ref, {
      kind: "measurement-relationship",
      id: relationship.id,
    });
    assert.ok(projection.activeSpatialFocus.region);
    assert.deepEqual(
      projection.activeSpatialFocus.relatedMeasurementIds,
      relationship.eventIds.filter((eventId) => {
        const linked = (session as RepairSession).events.find((event) => event.id === eventId);
        return linked?.kind === "measurement";
      })
    );

    assert.equal(runtime.handleCommand(REPAIR_UI_COMMANDS.focusLiveEdge).success, true);
    state = runtime.getStateSnapshot().state;
    session = state.sessions[state.activeSessionId ?? ""];
    assert.ok(session);
    projection = createRepairReplayProjection(state, session);
    assert.equal(state.workbench.timeline.replayMode, "live");
    assert.equal(state.workbench.timeline.autoFollowLive, true);
    assert.equal(state.workbench.selection.inspectorEntityRef, null);
    assert.equal(projection.activeSpatialFocus, null);
    assert.equal(projection.guidance.focusCorridor.active, false);
  });

  void test("repair-room Phase 2.8 separates temporary knowledge focus from promoted regions", () => {
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
    let state = runtime.getStateSnapshot().state;
    let session = state.sessions[state.activeSessionId ?? ""];
    assert.ok(session);
    let projection = createRepairReplayProjection(state, session);
    assert.equal(
      session.events.some((event) => event.kind === "investigation-region-created"),
      false
    );
    assert.equal(
      projection.temporarySpatialRegions[0]?.knowledgeSpatialRefId,
      "startup-resistor-open"
    );

    assert.equal(
      runtime.handleCommand(REPAIR_UI_COMMANDS.promoteKnowledgeRegion, {
        spatialRefId: "startup-resistor-open",
      }).success,
      true
    );
    state = runtime.getStateSnapshot().state;
    session = state.sessions[state.activeSessionId ?? ""];
    assert.ok(session);
    projection = createRepairReplayProjection(state, session);
    assert.equal(
      session.events.some(
        (event) =>
          event.kind === "investigation-region-created" &&
          event.knowledgeSpatialRefId === "startup-resistor-open"
      ),
      true
    );
    const promotedRegionEvent = session.events.find(
      (event) =>
        event.kind === "investigation-region-created" &&
        event.knowledgeSpatialRefId === "startup-resistor-open"
    );
    assert.equal(promotedRegionEvent?.kind, "investigation-region-created");
    assert.deepEqual(promotedRegionEvent.measurementEventIds, ["evt-psu-meas-2"]);
    assert.deepEqual(promotedRegionEvent.annotationEventIds, ["evt-psu-anno-2"]);
    assert.deepEqual(promotedRegionEvent.aiMarkEventIds, ["evt-psu-ai-1"]);
    assert.equal(promotedRegionEvent.linkedEventIds.includes("evt-psu-anno-2"), true);
    assert.equal(
      projection.investigationRegions[0]?.knowledgeSpatialRefId,
      "startup-resistor-open"
    );
  });

  void test("repair-room Phase 2.8 keyboard nudging moves event-backed and canonical region refs", () => {
    const runtime = createRepairRoomHostRuntime().activate({
      log: () => {},
      notifyRoom: () => {},
    });
    let state = runtime.getStateSnapshot().state;
    let session = state.sessions["psu-2025-0510"];
    assert.ok(session);
    const measurement = session.events.find((event) => event.kind === "measurement");
    assert.ok(measurement);
    assert.ok(measurement.pinAt);

    assert.equal(
      runtime.handleCommand(REPAIR_UI_COMMANDS.selectOverlayEntities, {
        refs: [{ kind: "event", id: measurement.id }],
        mode: "replace",
      }).success,
      true
    );
    assert.equal(
      runtime.handleCommand(REPAIR_UI_COMMANDS.updateFocus, {
        nudgeDelta: { xPx: 6, yPx: -3 },
      }).success,
      true
    );
    session = runtime.getStateSnapshot().state.sessions["psu-2025-0510"];
    const nudgedMeasurement = session?.events.find((event) => event.id === measurement.id);
    assert.equal(nudgedMeasurement?.kind, "measurement");
    assert.deepEqual(nudgedMeasurement.pinAt, {
      xPx: measurement.pinAt.xPx + 6,
      yPx: measurement.pinAt.yPx - 3,
    });

    assert.equal(
      runtime.handleCommand(REPAIR_UI_COMMANDS.promoteKnowledgeRegion, {
        spatialRefId: "startup-resistor-open",
      }).success,
      true
    );
    state = runtime.getStateSnapshot().state;
    session = state.sessions[state.activeSessionId ?? ""];
    assert.ok(session);
    let projection = createRepairReplayProjection(state, session);
    const region = projection.investigationRegions[0];
    assert.ok(region);
    const beforeRegion = region.region;

    assert.equal(
      runtime.handleCommand(REPAIR_UI_COMMANDS.selectOverlayEntities, {
        refs: [{ kind: "investigation-region", id: region.regionId }],
        mode: "replace",
      }).success,
      true
    );
    assert.equal(
      runtime.handleCommand(REPAIR_UI_COMMANDS.updateFocus, {
        nudgeDelta: { xPx: 10, yPx: 5 },
      }).success,
      true
    );
    state = runtime.getStateSnapshot().state;
    session = state.sessions[state.activeSessionId ?? ""];
    assert.ok(session);
    const updateEvent = session.events.at(-1);
    assert.equal(updateEvent?.kind, "investigation-region-updated");
    assert.equal(updateEvent.regionId, region.regionId);
    assert.deepEqual(updateEvent.region, {
      ...beforeRegion,
      xPx: beforeRegion.xPx + 10,
      yPx: beforeRegion.yPx + 5,
    });
    projection = createRepairReplayProjection(state, session);
    assert.deepEqual(projection.investigationRegions[0]?.region, {
      ...beforeRegion,
      xPx: beforeRegion.xPx + 10,
      yPx: beforeRegion.yPx + 5,
    });
  });
});
