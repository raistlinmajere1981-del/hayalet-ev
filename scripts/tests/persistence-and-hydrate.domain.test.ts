import test from "node:test";
import assert from "node:assert/strict";
import createRepairRoomHostRuntimeBase from "../../rooms/repair-room/host/runtime.ts";
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

describe("persistence and hydrate", () => {
  void test("repair-room persists selected evidence separately from the v2 session record", async () => {
    const baseStoredSession = createTestRepairSession();
    const storedSession: RepairSession = {
      ...cloneJson(baseStoredSession),
      id: "repair-existing-active-session",
      title: "Existing active repair session",
      updatedAt: "2026-06-13T11:00:00.000Z",
    };
    const storage = createMemoryRepairStorage([createStoredRepairRecord(storedSession)]);
    const runtime = createRepairRoomHostRuntime({
      autoHydrateStorage: false,
      io: createMemoryRepairIo(),
      storage,
    }).activate({
      log: () => {},
      notifyRoom: () => {},
      dispatchBridge: () => ({
        success: true,
        reply: {
          text: JSON.stringify({
            contextRefs: ["evidence-selection"],
            knowledgePack: {
              id: "ai-selection-pack",
              modelNumber: "BN44-00932A",
              deviceLabel: "Samsung PSU",
              resources: [
                {
                  id: "res-a",
                  label: "Schematic A",
                  kind: "schematic",
                  source: "AI",
                  pages: 4,
                  confidence: 0.8,
                },
                {
                  id: "res-b",
                  label: "Thread B",
                  kind: "thread",
                  source: "AI",
                  pages: null,
                  confidence: 0.6,
                },
              ],
              commonFailures: [
                {
                  id: "fail-a",
                  label: "Startup resistor open",
                  rationale: "No standby symptom.",
                  affectedPart: "R201",
                  recommendedAction: "Measure resistance.",
                  confidence: 0.82,
                },
              ],
              testPoints: [
                {
                  id: "tp-a",
                  label: "5V_STBY",
                  rail: "Standby",
                  expectedValue: 5,
                  unit: "V",
                  tolerance: 0.25,
                },
              ],
              notes: ["Discharge primary capacitors."],
            },
          }),
        },
      }),
      getLocale: () => "en",
    });

    await runtime.hydrateStorage();
    assert.equal(runtime.getStateSnapshot().state.activeSessionId, storedSession.id);
    assert.equal(
      runtime.handleCommand(REPAIR_UI_COMMANDS.updateSession, {
        wizardDraft: {
          boardCode: "BN44-00932A",
          deviceType: "PSU / power board",
          manufacturer: "Samsung",
          model: "BN44-00932A",
          primarySymptoms: ["No Power"],
        },
      }).success,
      true
    );
    assert.equal(runtime.handleCommand(REPAIR_UI_COMMANDS.startKnowledgeResearch).success, true);
    await new Promise<void>((resolve) => {
      setImmediate(resolve);
    });

    assert.equal(
      runtime.handleCommand(REPAIR_UI_COMMANDS.updateEvidenceSelection, {
        selectedEvidenceResourceIds: ["res-a"],
        selectedFailureIds: [],
        selectedTestPointIds: ["tp-a"],
      }).success,
      true
    );
    await runtime.flushStorage();
    assert.equal(storage.readEvidenceSelectionRecord(storedSession.id), null);
    assert.equal(
      runtime.handleCommand(REPAIR_UI_COMMANDS.advanceWizard, { step: "ready" }).success,
      true
    );
    assert.equal(runtime.handleCommand(REPAIR_UI_COMMANDS.createSession).success, true);
    await runtime.flushStorage();

    const nextState = runtime.getStateSnapshot().state;
    const activeSession = nextState.sessions[nextState.activeSessionId ?? ""];
    assert.equal(activeSession?.schemaVersion, 2);
    assert.equal(activeSession.knowledgePackId, "ai-selection-pack");
    assert.equal(storage.readEvidenceSelectionRecord(storedSession.id), null);
    assert.equal(typeof activeSession, "object");
    const selection = storage.readEvidenceSelectionRecord(activeSession.id);
    assert.equal(typeof selection, "object");
    assert.deepEqual(selection!.selection.selectedEvidenceResourceIds, ["res-a"]);
    assert.deepEqual(selection!.selection.selectedFailureIds, []);
    assert.deepEqual(selection!.selection.selectedTestPointIds, ["tp-a"]);

    runtime.dispose();
  });

  void test("repair-room hydrate ignores legacy v1 room-local session records", async () => {
    const v2Session: RepairSession = {
      ...cloneJson(createTestRepairSession()),
      id: "repair-v2-session",
      title: "Persisted v2 repair session",
      updatedAt: "2026-06-13T12:00:00.000Z",
    };
    const v1Session = {
      ...cloneJson(createTestRepairSession()),
      id: "repair-v1-session",
      schemaVersion: 1,
      title: "Legacy v1 repair session",
      updatedAt: "2026-06-13T13:00:00.000Z",
    };
    delete (v1Session.deviceInfo as Partial<RepairSession["deviceInfo"]>).deviceType;

    const storage = createMemoryRepairStorage([
      createStoredRepairRecord(v1Session, [], 1),
      createStoredRepairRecord(v2Session),
    ]);
    const runtime = createRepairRoomHostRuntime({
      autoHydrateStorage: false,
      io: createMemoryRepairIo(),
      storage,
    }).activate({
      log: () => {},
      notifyRoom: () => {},
    });

    await runtime.hydrateStorage();

    const state = runtime.getStateSnapshot().state;
    assert.equal(state.storage.sessionCount, 1);
    assert.equal(state.activeSessionId, "repair-v2-session");
    assert.equal(
      state.sessionList.some((session) => session.id === "repair-v1-session"),
      false
    );

    runtime.dispose();
  });

  void test("repair-room hydrate keeps a clean fallback when storage has no v2 sessions", async () => {
    const v1Session = {
      ...cloneJson(createTestRepairSession()),
      id: "repair-v1-only-session",
      schemaVersion: 1,
      title: "Legacy v1 only session",
      updatedAt: "2026-06-13T13:00:00.000Z",
    };
    delete (v1Session.deviceInfo as Partial<RepairSession["deviceInfo"]>).deviceType;

    const storage = createMemoryRepairStorage([createStoredRepairRecord(v1Session, [], 1)]);
    const runtime = createRepairRoomHostRuntime({
      autoHydrateStorage: false,
      io: createMemoryRepairIo(),
      storage,
    }).activate({
      log: () => {},
      notifyRoom: () => {},
    });

    const before = runtime.getStateSnapshot().state;
    assert.equal(before.sessionList.length, 0);
    assert.equal(before.activeSessionId, null);

    await runtime.hydrateStorage();

    const after = runtime.getStateSnapshot().state;
    assert.equal(after.storage.status, "ready");
    assert.equal(after.storage.sessionCount, 0);
    assert.equal(after.activeSessionId, null);
    assert.equal(after.sessionList.length, before.sessionList.length);
    assert.equal(
      after.sessionList.some((session) => session.id === "repair-v1-only-session"),
      false
    );

    runtime.dispose();
  });

  void test("repair-room hydrates room-local stored session records when storage is available", async () => {
    const storedSession: RepairSession = {
      ...cloneJson(createTestRepairSession()),
      id: "repair-persisted-session",
      title: "Persisted repair session",
      updatedAt: "2026-06-13T10:00:00.000Z",
    };
    const storedChat: RepairChatTurn = {
      id: "chat-stored-1",
      role: "operator",
      text: "Stored repair context",
      occurredAt: "2026-06-13T10:00:01.000Z",
      contextRefs: [storedSession.id],
    };
    const storage = createMemoryRepairStorage([
      createStoredRepairRecord(storedSession, [storedChat]),
    ]);
    const runtime = createRepairRoomHostRuntime({
      autoHydrateStorage: false,
      io: createMemoryRepairIo(),
      storage,
    }).activate({
      log: () => {},
      notifyRoom: () => {},
    });

    await runtime.hydrateStorage();

    const runtimeState = runtime.getStateSnapshot().state;
    assert.equal(runtimeState.storage.status, "ready");
    assert.equal(runtimeState.storage.sessionCount, 1);
    assert.equal(runtimeState.activeSessionId, storedSession.id);
    assert.equal(runtimeState.chat.turns[0]?.text, "Stored repair context");

    const rows = Object.fromEntries(
      getRepairRoomSyncRows(
        createRepairUiSnapshot(runtimeState),
        createRepairUiSnapshotMeta(runtimeState),
        (_path, fallback) => fallback
      )
    );
    assert.equal(rows["Storage"], "Repair history ready, 1 session");

    runtime.dispose();
  });

  void test("repair-room persists session event and chat updates to room-local session JSON", async () => {
    const storedSession: RepairSession = {
      ...cloneJson(createTestRepairSession()),
      id: "repair-persist-session-updates",
      title: "Persist repair updates",
      updatedAt: "2026-06-13T11:00:00.000Z",
    };
    const storage = createMemoryRepairStorage([createStoredRepairRecord(storedSession)]);
    const runtime = createRepairRoomHostRuntime({
      autoHydrateStorage: false,
      io: createMemoryRepairIo(),
      storage,
    }).activate({
      log: () => {},
      notifyRoom: () => {},
      dispatchBridge: () => ({
        success: true,
        reply: {
          text: JSON.stringify({
            replyText: "Stored AI reply",
            contextRefs: ["stored-ref"],
          }),
        },
      }),
      getLocale: () => "en",
    });

    await runtime.hydrateStorage();

    assert.equal(
      runtime.handleCommand(REPAIR_UI_COMMANDS.addMeasurement, {
        xPx: 712,
        yPx: 304,
        rawDisplay: "0.421",
        reference: "Persisted TP",
      }).success,
      true
    );
    await runtime.flushStorage();

    let saved = storage.readRecord(storedSession.id);
    assert.equal(
      saved?.session.events.some(
        (event) => event.kind === "measurement" && event.reference === "Persisted TP"
      ),
      true
    );

    assert.equal(
      runtime.handleCommand(REPAIR_UI_COMMANDS.sendChatTurn, { text: "Persist this chat" }).success,
      true
    );
    await new Promise<void>((resolve) => {
      setImmediate(resolve);
    });
    await runtime.flushStorage();

    saved = storage.readRecord(storedSession.id);
    assert.equal(
      saved?.chatTurns.some((turn) => turn.text === "Persist this chat"),
      true
    );
    assert.equal(
      saved.chatTurns.some((turn) => turn.text === "Stored AI reply"),
      true
    );

    runtime.dispose();
  });
});
