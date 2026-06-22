import test from "node:test";
import assert from "node:assert/strict";
import createRepairRoomHostRuntimeBase from "../../rooms/repair-room/host/runtime.ts";
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
import { normalizeRepairHostMessage } from "../../rooms/repair-room/shared/ui/host-messages.ts";
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

describe("host exports and Phase 1 commands", () => {
  void test("repair-room host exports room-page lifecycle hooks and command registry", () => {
    const notifications: Array<{ type: string; payload: Record<string, unknown> | undefined }> = [];
    const logs: string[] = [];
    const runtime = createRepairRoomHostRuntime().activate({
      log: (_level, message) => {
        logs.push(message);
      },
      notifyRoom: (type, payload) => {
        notifications.push({ type, payload });
      },
    });

    assert.equal(typeof runtime.onRoomReady, "function");
    assert.equal(typeof runtime.commands[REPAIR_UI_COMMANDS.uiReady], "function");
    assert.ok(logs.some((entry) => entry.includes("Repair Room host activated.")));

    runtime.onRoomReady({ stage: "ui-ready" });

    const stateMessage = notifications.find((entry) => entry.type === "repair-state");
    const normalized = normalizeRepairHostMessage({
      type: stateMessage?.type,
      payload: stateMessage?.payload,
    });

    assert.ok(normalized);
    assert.equal(normalized.type, "repair-state");
    assert.equal(normalized.snapshot.sessions.activeId, TEST_REPAIR_ACTIVE_SESSION_ID);
    assert.equal(normalized.snapshot.sessions.list.length, 1);
    assert.ok(normalized.snapshot.sessions.detail?.pcbImage);
    assert.equal(normalized.snapshot.tacticalFeed.length, 2);
    assert.equal(normalized.snapshot.guidance.operationalProfile, "novice");
    assert.equal(normalized.snapshot.guidance.panelVisibility.primarySurface, "measurement");
    assert.equal(normalized.snapshot.guidance.panelVisibility.tacticalFeedDensity, "minimal");
    assert.equal(normalized.snapshot.guidance.panelVisibility.panels.measurement, "expanded");
    assert.equal(normalized.snapshot.guidance.panelVisibility.panels["session-wizard"], "hidden");
    assert.equal(normalized.snapshot.guidance.overlaySaturation.maxVisibleRelationships, 4);
    assert.equal(normalized.snapshot.guidance.overlaySaturation.maxVisibleRegions, 5);
    assert.equal(normalized.snapshot.guidance.overlaySaturation.labelMode, "simplified");
    assert.equal(normalized.snapshot.guidance.rhythm.lifecycle.length, 6);
    assert.equal(
      normalized.snapshot.guidance.rhythm.lifecycle.includes(
        normalized.snapshot.guidance.investigationPhase
      ),
      true
    );
    assert.equal(normalized.snapshot.guidance.focusCorridor.active, false);
    assert.equal(normalized.snapshot.guidance.aiInterruption.attentionBudget.maxAiInterruptions, 2);
    assert.equal(normalized.snapshot.guidance.voice.spokenGuidanceMode, "brief");
    assert.equal(
      normalized.meta.events.some((event) => event.id === "evt-psu-ai-3"),
      true
    );

    const toggleFreeze = runtime.commands[REPAIR_UI_COMMANDS.toggleFreezeFrame];
    assert.equal(typeof toggleFreeze, "function");
    assert.equal((toggleFreeze as (...args: unknown[]) => { success: boolean })().success, true);
    assert.equal(runtime.getStateSnapshot().state.workbench.isFrozen, true);

    runtime.dispose();
    assert.ok(logs.some((entry) => entry.includes("Repair Room host disposed.")));
  });

  void test("repair-room runtime handles the advertised interactive Phase 1 commands", async () => {
    const notifications: Array<{ type: string; payload: Record<string, unknown> | undefined }> = [];
    const runtime = createRepairRoomHostRuntime().activate({
      log: () => {},
      notifyRoom: (type, payload) => {
        notifications.push({ type, payload });
      },
    });

    assert.equal(runtime.handleCommand(REPAIR_UI_COMMANDS.uiReady).success, true);
    assert.equal(runtime.getStateSnapshot().state.tacticalFeed.length, 3);
    assert.equal(runtime.getStateSnapshot().state.sessionList[0]?.serialNumber, "R21Z14CSN100123");
    const firstStatePayload = notifications.find((entry) => entry.type === "repair-state")
      ?.payload as { meta?: { events?: Array<{ id: string }> } } | undefined;
    assert.equal(
      firstStatePayload?.meta?.events?.some((event) => event.id === "evt-psu-ai-3"),
      true
    );

    assert.equal(
      runtime.handleCommand(REPAIR_UI_COMMANDS.toggleOverlayLayer, {
        layerId: "grid",
        visible: false,
      }).success,
      true
    );
    assert.equal(runtime.getStateSnapshot().state.workbench.visibleLayers.grid, false);

    assert.equal(
      runtime.handleCommand(REPAIR_UI_COMMANDS.setActiveTool, { tool: "zoom-in" }).success,
      true
    );
    assert.equal(runtime.getStateSnapshot().state.workbench.viewport.zoom, 1.25);

    assert.equal(
      runtime.handleCommand(REPAIR_UI_COMMANDS.addMeasurement, {
        xPx: 712,
        yPx: 304,
        rawDisplay: "0.002",
        reference: "U14 VCC",
      }).success,
      true
    );
    const measurementState = runtime.getStateSnapshot().state.measurement;
    assert.equal(measurementState.current.display, "0.002");
    assert.equal(measurementState.recent[0]?.reference, "U14 VCC");

    assert.equal(
      runtime.handleCommand(REPAIR_UI_COMMANDS.addTimelineEvent, {
        kind: "snapshot",
        caption: "Android companion frame captured.",
        thumbnailSrc: "/tmp/repair-frame.jpg",
      }).success,
      true
    );
    const snapshotEvent = runtime
      .getStateSnapshot()
      .state.sessions[
        TEST_REPAIR_ACTIVE_SESSION_ID
      ]?.events.find((event) => event.kind === "snapshot" && event.caption === "Android companion frame captured.");
    assert.equal(snapshotEvent?.kind, "snapshot");
    assert.equal(snapshotEvent.thumbnailSrc, "/tmp/repair-frame.jpg");

    assert.equal(
      runtime.handleCommand(REPAIR_UI_COMMANDS.sendChatTurn, { text: "Check standby rail" })
        .success,
      true
    );
    let chatState = runtime.getStateSnapshot().state.chat;
    assert.equal(chatState.turns.at(-1)?.role, "operator");
    assert.equal(chatState.pendingReplyId, chatState.turns.at(-1)?.id);

    await new Promise<void>((resolve) => {
      setImmediate(resolve);
    });

    chatState = runtime.getStateSnapshot().state.chat;
    assert.equal(chatState.pendingReplyId, null);
    assert.equal(chatState.turns.at(-1)?.role, "operator");
    assert.equal(runtime.getStateSnapshot().state.aiDispatch.chat.status, "failed");

    assert.ok(notifications.some((entry) => entry.type === "repair-state"));
    runtime.dispose();
  });
});
