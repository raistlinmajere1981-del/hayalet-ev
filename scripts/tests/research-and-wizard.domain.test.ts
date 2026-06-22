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

describe("research and wizard", () => {
  void test("repair-room research uses selected AI slot for live knowledge-pack dispatch", async () => {
    const dispatchCalls: Record<string, unknown>[] = [];
    const runtime = createRepairRoomHostRuntime().activate({
      log: () => {},
      notifyRoom: () => {},
      dispatchBridge: (payload: Record<string, unknown>) => {
        dispatchCalls.push(payload);
        const page = (payload["payload"] as Record<string, unknown> | undefined)?.["page"];
        if (page === "repair-room:risk-detector") {
          return {
            success: true,
            reply: { text: JSON.stringify({ risks: [] }) },
          };
        }
        return {
          success: true,
          reply: {
            text: JSON.stringify({
              contextRefs: ["research-bn44"],
              knowledgePack: {
                id: "ai-bn44-00932a",
                modelNumber: "BN44-00932A",
                deviceLabel: "Samsung PSU",
                resources: [
                  {
                    id: "candidate-schematic",
                    label: "Candidate service manual",
                    kind: "schematic",
                    source: "AI research candidate",
                    pages: 12,
                    confidence: 0.74,
                  },
                ],
                commonFailures: [
                  {
                    id: "startup-resistor-open",
                    label: "Startup resistor open",
                    rationale: "No standby symptom matches startup bias loss.",
                    affectedPart: "R201",
                    recommendedAction: "Measure startup resistance before replacing parts.",
                    confidence: 0.81,
                  },
                ],
                testPoints: [
                  {
                    id: "tp-5v-stby-ai",
                    label: "5V_STBY",
                    rail: "Standby",
                    expectedValue: 5,
                    unit: "V",
                    tolerance: 0.25,
                  },
                ],
                notes: ["Discharge the bulk capacitor before primary-side checks."],
              },
            }),
          },
        };
      },
      getLocale: () => "en",
    });

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

    assert.equal(
      runtime.handleCommand(REPAIR_UI_COMMANDS.startKnowledgeResearch, { targetSlot: "ai0" })
        .success,
      true
    );
    assert.equal(runtime.getStateSnapshot().state.aiDispatch.research.status, "pending");

    await new Promise<void>((resolve) => {
      setImmediate(resolve);
    });

    assert.equal(dispatchCalls.length, 1);
    assert.equal(dispatchCalls[0]?.["action"], "message.sendWait");
    assert.equal(dispatchCalls[0]["toSlot"], "ai0");
    const payload = dispatchCalls[0]["payload"] as Record<string, unknown> | undefined;
    const protocol = payload?.["protocol"] as Record<string, unknown> | undefined;
    assert.equal(payload?.["page"], "repair-room:knowledge-research");
    assert.equal(protocol?.["protocolKey"], "repair-room-knowledge-research");

    const state = runtime.getStateSnapshot().state;
    assert.equal(state.aiDispatch.research.targetSlot, "ai0");
    assert.equal(state.aiDispatch.research.status, "succeeded");
    assert.equal(state.wizard.currentStep, "evidence-review");
    assert.equal(state.wizard.generatedKnowledgePackId, "ai-bn44-00932a");
    assert.equal(state.wizard.foundResources[0]?.id, "candidate-schematic");
    assert.equal(
      state.wizard.researchProgress.every((item) => item.completed),
      true
    );
    assert.deepEqual(state.wizard.draft.selectedEvidenceResourceIds, ["candidate-schematic"]);
    assert.deepEqual(state.wizard.draft.selectedFailureIds, ["startup-resistor-open"]);
    assert.deepEqual(state.wizard.draft.selectedTestPointIds, ["tp-5v-stby-ai"]);

    assert.equal(runtime.handleCommand(REPAIR_UI_COMMANDS.advanceWizard).success, true);
    assert.equal(runtime.handleCommand(REPAIR_UI_COMMANDS.createSession).success, true);
    const nextState = runtime.getStateSnapshot().state;
    const activeSession = nextState.sessions[nextState.activeSessionId ?? ""];
    assert.equal(activeSession?.knowledgePackId, "ai-bn44-00932a");
    assert.equal(activeSession.knowledgePack?.testPoints[0]?.label, "5V_STBY");

    runtime.dispose();
  });

  void test("repair-room wizard v2 gates tabs, accepts unknown fields, and skips failed research", async () => {
    const runtime = createRepairRoomHostRuntime().activate({
      log: () => {},
      notifyRoom: () => {},
    });

    assert.equal(
      runtime.handleCommand(REPAIR_UI_COMMANDS.advanceWizard, { step: "symptoms" }).success,
      false
    );
    assert.equal(runtime.handleCommand(REPAIR_UI_COMMANDS.createSession).success, false);
    assert.equal(
      runtime.handleCommand(REPAIR_UI_COMMANDS.updateSession, {
        wizardDraft: {
          boardCode: "Bilinmiyor",
          deviceType: "Bilinmiyor",
          manufacturer: "Bilinmiyor",
          model: "Bilinmiyor",
        },
      }).success,
      true
    );
    assert.equal(
      runtime.handleCommand(REPAIR_UI_COMMANDS.advanceWizard, { step: "symptoms" }).success,
      true
    );
    assert.equal(
      runtime.handleCommand(REPAIR_UI_COMMANDS.advanceWizard, { step: "ai-research" }).success,
      false
    );
    assert.equal(runtime.handleCommand(REPAIR_UI_COMMANDS.createSession).success, false);
    assert.equal(
      runtime.handleCommand(REPAIR_UI_COMMANDS.updateSession, {
        wizardDraft: {
          customSymptoms: ["Intermittent short"],
        },
      }).success,
      true
    );
    assert.equal(
      runtime.handleCommand(REPAIR_UI_COMMANDS.advanceWizard, { step: "ai-research" }).success,
      true
    );
    assert.equal(runtime.handleCommand(REPAIR_UI_COMMANDS.startKnowledgeResearch).success, true);

    await new Promise<void>((resolve) => {
      setImmediate(resolve);
    });

    const failedResearch = runtime.getStateSnapshot().state.wizard;
    assert.equal(failedResearch.draft.researchStatus, "failed");
    assert.match(failedResearch.draft.researchMessage ?? "", /bridge/i);
    assert.equal(runtime.handleCommand(REPAIR_UI_COMMANDS.createSession).success, false);
    assert.equal(runtime.handleCommand(REPAIR_UI_COMMANDS.skipKnowledgeResearch).success, true);

    const skipped = runtime.getStateSnapshot().state.wizard;
    assert.equal(skipped.currentStep, "ready");
    assert.equal(skipped.draft.researchSkipped, true);
    assert.equal(runtime.getStateSnapshot().state.phase, "wizard-active");
    assert.equal(
      runtime.handleCommand(REPAIR_UI_COMMANDS.advanceWizard, { step: "ready" }).success,
      true
    );
    assert.equal(runtime.getStateSnapshot().state.phase, "wizard-active");
    assert.equal(runtime.handleCommand(REPAIR_UI_COMMANDS.createSession).success, true);

    const nextState = runtime.getStateSnapshot().state;
    const activeSession = nextState.sessions[nextState.activeSessionId ?? ""];
    assert.equal(activeSession?.status, "in-progress");
    assert.equal(activeSession.knowledgePack, null);
    assert.equal(activeSession.deviceInfo.deviceType, "Bilinmiyor");
    assert.deepEqual(activeSession.symptoms.primarySymptoms, ["Intermittent short"]);

    runtime.dispose();
  });
});
