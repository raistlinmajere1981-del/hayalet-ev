import test from "node:test";
import assert from "node:assert/strict";
import createRepairRoomHostRuntime from "../../rooms/repair-room/host/runtime.ts";
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
  REPAIR_ROOM_ID,
  REPAIR_UI_COMMANDS,
} from "../../rooms/repair-room/shared/repair-constants.ts";
import {
  MOCK_REPAIR_ACTIVE_SESSION_ID,
  MOCK_REPAIR_SESSIONS,
} from "../../rooms/repair-room/shared/data/index.ts";
import {
  REPAIR_ACTION_REGISTRY,
  getRepairVoiceCommandPhraseMap,
} from "../../rooms/repair-room/shared/repair-action-registry.ts";
import { normalizeRepairHostMessage } from "../../rooms/repair-room/shared/ui/host-messages.ts";
import { createRepairDefaultGuidanceProjection } from "../../rooms/repair-room/shared/ui/state.ts";
import type {
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

function createMemoryRepairIo() {
  return {
    callRoomTools: async () => ({ success: true }),
    ensureRuntimeDirectory: async () => {},
    getElectronApi: () => null,
    listDirectory: async () => [],
    readJsonFile: async () => null,
    resolveRuntimePaths: async () => ({ storageDir: "/tmp/repair-room-test" }),
    writeJsonFile: async () => {},
  };
}

function createStoredRepairRecord(
  session: RepairSession,
  chatTurns: RepairChatTurn[] = []
): RepairStoredSessionRecord {
  return {
    chatTurns,
    roomId: REPAIR_ROOM_ID,
    savedAt: session.updatedAt,
    schemaVersion: 1,
    session,
  };
}

function createMemoryRepairStorage(initialRecords: RepairStoredSessionRecord[] = []) {
  const records = new Map<string, RepairStoredSessionRecord>();
  let operatorProfileRecord: RepairStoredOperatorProfileRecord | null = null;
  initialRecords.forEach((record) => {
    records.set(record.session.id, cloneJson(record));
  });
  const listRecords = () =>
    Array.from(records.values()).sort((left, right) =>
      right.session.updatedAt.localeCompare(left.session.updatedAt)
    );
  return {
    ensureSessionRoot: async () => "/tmp/repair-room-test/sessions",
    listSessionRecords: async () => listRecords().map((record) => cloneJson(record)),
    listSessions: async () =>
      listRecords().map((record) => toStoredSessionListItem(record.session)),
    loadOperatorProfileRecord: async () => cloneJson(operatorProfileRecord),
    loadLatestSessionRecord: async () => cloneJson(listRecords()[0] ?? null),
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
  };
}

test("repair-room host exports room-page lifecycle hooks and command registry", () => {
  const notifications: Array<{ type: string; payload?: Record<string, unknown> }> = [];
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
  assert.equal(normalized.snapshot.sessions.activeId, "psu-2025-0510");
  assert.equal(normalized.snapshot.sessions.list.length, 4);
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
  assert.equal(toggleFreeze().success, true);
  assert.equal(runtime.getStateSnapshot().state.workbench.isFrozen, true);

  runtime.dispose();
  assert.ok(logs.some((entry) => entry.includes("Repair Room host disposed.")));
});

test("repair-room runtime handles the advertised interactive Phase 1 commands", async () => {
  const notifications: Array<{ type: string; payload?: Record<string, unknown> }> = [];
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
      MOCK_REPAIR_ACTIVE_SESSION_ID
    ]?.events.find((event) => event.kind === "snapshot" && event.caption === "Android companion frame captured.");
  assert.equal(snapshotEvent?.kind, "snapshot");
  if (snapshotEvent?.kind === "snapshot") {
    assert.equal(snapshotEvent.thumbnailSrc, "/tmp/repair-frame.jpg");
  }

  assert.equal(
    runtime.handleCommand(REPAIR_UI_COMMANDS.sendChatTurn, { text: "Check standby rail" }).success,
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

test("repair-room chat uses live protocol bridge guidance", async () => {
  const dispatchCalls: Record<string, unknown>[] = [];
  const runtime = createRepairRoomHostRuntime().activate({
    log: () => {},
    notifyRoom: () => {},
    dispatchBridge: async (payload: Record<string, unknown>) => {
      dispatchCalls.push(payload);
      return {
        success: true,
        reply: {
          text: JSON.stringify({
            replyText:
              "Measure 5V_STBY first, then compare it with the knowledge-pack expected rail.",
            contextRefs: ["tp-5v-stby"],
          }),
        },
      };
    },
    getLocale: () => "en",
  });

  assert.equal(
    runtime.handleCommand(REPAIR_UI_COMMANDS.sendChatTurn, { text: "What should I check next?" })
      .success,
    true
  );
  await new Promise<void>((resolve) => {
    setImmediate(resolve);
  });

  assert.equal(dispatchCalls.length, 1);
  assert.equal(dispatchCalls[0]?.["action"], "message.sendWait");
  assert.equal(dispatchCalls[0]?.["toSlot"], "ai2");
  const payload = dispatchCalls[0]?.["payload"] as Record<string, unknown> | undefined;
  const protocol = payload?.["protocol"] as Record<string, unknown> | undefined;
  assert.equal(payload?.["page"], "repair-room:chat");
  assert.equal(protocol?.["protocolKey"], "repair-room-measurement-coach");
  assert.match(String(payload?.["text"]), /repair-room-chat-guidance/);

  const chatState = runtime.getStateSnapshot().state.chat;
  assert.equal(chatState.pendingReplyId, null);
  assert.equal(chatState.turns.at(-1)?.role, "ai");
  assert.equal(runtime.getStateSnapshot().state.aiDispatch.chat.status, "succeeded");
  assert.equal(runtime.getStateSnapshot().state.aiDispatch.chat.targetSlot, "ai2");
  assert.equal(
    chatState.turns.at(-1)?.text,
    "Measure 5V_STBY first, then compare it with the knowledge-pack expected rail."
  );
  assert.equal(chatState.turns.at(-1)?.contextRefs.includes("tp-5v-stby"), true);

  runtime.dispose();
});

test("repair-room chat can apply safe AI room commands and reject malformed commands", async () => {
  const runtime = createRepairRoomHostRuntime().activate({
    log: () => {},
    notifyRoom: () => {},
    dispatchBridge: async () => ({
      success: true,
      reply: {
        text: JSON.stringify({
          replyText: "I marked the next safe measurement point.",
          contextRefs: ["tp-ai-safe"],
          roomCommands: [
            {
              commandName: REPAIR_UI_COMMANDS.addTimelineEvent,
              payload: {
                kind: "annotation",
                tool: "rect",
                label: "AI suggested safe probe area",
                xPx: 420,
                yPx: 240,
                widthPx: 120,
                heightPx: 80,
              },
              reason: "Operator asked for the next safe visual target.",
            },
            {
              commandName: "RepairRoomDeleteSession",
              payload: {},
            },
          ],
        }),
      },
    }),
    getLocale: () => "en",
  });

  assert.equal(
    runtime.handleCommand(REPAIR_UI_COMMANDS.sendChatTurn, { text: "Mark the next safe target" })
      .success,
    true
  );
  await new Promise<void>((resolve) => {
    setImmediate(resolve);
  });

  const state = runtime.getStateSnapshot().state;
  const session = state.sessions[state.activeSessionId ?? ""];
  assert.ok(session);
  assert.equal(
    session.events.some(
      (event) => event.kind === "annotation" && event.label === "AI suggested safe probe area"
    ),
    true
  );
  assert.equal(state.aiDispatch.chat.status, "succeeded");
  assert.match(state.aiDispatch.chat.message ?? "", /1\/1 room command applied/);
  assert.match(state.aiDispatch.chat.message ?? "", /1 malformed room command ignored/);

  runtime.dispose();
});

test("repair-room sync panel rows expose AI2 dispatch status", async () => {
  const runtime = createRepairRoomHostRuntime().activate({
    log: () => {},
    notifyRoom: () => {},
    dispatchBridge: async () => ({
      success: true,
      reply: {
        text: JSON.stringify({
          replyText: "Probe 5V_STBY and compare against the known good rail.",
          contextRefs: ["tp-5v-stby"],
        }),
      },
    }),
    getLocale: () => "en",
  });

  assert.equal(
    runtime.handleCommand(REPAIR_UI_COMMANDS.sendChatTurn, { text: "Which rail next?" }).success,
    true
  );
  await new Promise<void>((resolve) => {
    setImmediate(resolve);
  });

  const runtimeState = runtime.getStateSnapshot().state;
  const state = createRepairUiSnapshot(runtimeState);
  const meta = createRepairUiSnapshotMeta(runtimeState);
  const rows = Object.fromEntries(
    getRepairRoomSyncRows(state, meta, (_path, fallback) => fallback)
  );

  assert.equal(rows["Assistant route"], "Assistant 2");
  assert.match(rows["Chat"] ?? "", /^Assistant 2 ready/);
  assert.match(rows["Chat"] ?? "", /\d+ refs/);
  assert.equal(rows["Evidence search"], "Assistant 2 idle");
  assert.equal(rows["Repair watch"], "Assistant 2 idle");

  runtime.dispose();
});

test("repair-room research uses live AI knowledge-pack dispatch", async () => {
  const dispatchCalls: Record<string, unknown>[] = [];
  const runtime = createRepairRoomHostRuntime().activate({
    log: () => {},
    notifyRoom: () => {},
    dispatchBridge: async (payload: Record<string, unknown>) => {
      dispatchCalls.push(payload);
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
    runtime.handleCommand(REPAIR_UI_COMMANDS.advanceWizard, { step: "ai-research" }).success,
    true
  );
  assert.equal(runtime.getStateSnapshot().state.aiDispatch.research.status, "pending");

  await new Promise<void>((resolve) => {
    setImmediate(resolve);
  });

  assert.equal(dispatchCalls.length, 1);
  assert.equal(dispatchCalls[0]?.["action"], "message.sendWait");
  assert.equal(dispatchCalls[0]?.["toSlot"], "ai2");
  const payload = dispatchCalls[0]?.["payload"] as Record<string, unknown> | undefined;
  const protocol = payload?.["protocol"] as Record<string, unknown> | undefined;
  assert.equal(payload?.["page"], "repair-room:knowledge-research");
  assert.equal(protocol?.["protocolKey"], "repair-room-knowledge-research");

  const state = runtime.getStateSnapshot().state;
  assert.equal(state.aiDispatch.research.status, "succeeded");
  assert.equal(state.wizard.currentStep, "ready");
  assert.equal(state.wizard.generatedKnowledgePackId, "ai-bn44-00932a");
  assert.equal(state.wizard.foundResources[0]?.id, "candidate-schematic");

  assert.equal(runtime.handleCommand(REPAIR_UI_COMMANDS.createSession).success, true);
  const nextState = runtime.getStateSnapshot().state;
  const activeSession = nextState.sessions[nextState.activeSessionId ?? ""];
  assert.equal(activeSession?.knowledgePackId, "ai-bn44-00932a");
  assert.equal(activeSession?.knowledgePack?.testPoints[0]?.label, "5V_STBY");

  runtime.dispose();
});

test("repair-room hydrates room-local stored session records when storage is available", async () => {
  const storedSession: RepairSession = {
    ...cloneJson(MOCK_REPAIR_SESSIONS[MOCK_REPAIR_ACTIVE_SESSION_ID]),
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

test("repair-room persists session event and chat updates to room-local session JSON", async () => {
  const storedSession: RepairSession = {
    ...cloneJson(MOCK_REPAIR_SESSIONS[MOCK_REPAIR_ACTIVE_SESSION_ID]),
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
    dispatchBridge: async () => ({
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
    saved?.chatTurns.some((turn) => turn.text === "Stored AI reply"),
    true
  );

  runtime.dispose();
});

test("repair-room measurements can promote AI tactical observations into canonical events", async () => {
  const dispatchCalls: Record<string, unknown>[] = [];
  const runtime = createRepairRoomHostRuntime().activate({
    log: () => {},
    notifyRoom: () => {},
    dispatchBridge: async (payload: Record<string, unknown>) => {
      dispatchCalls.push(payload);
      return {
        success: true,
        reply: {
          text: JSON.stringify({
            observations: [
              {
                kind: "risk",
                text: "Discharge the primary bulk cap before touching this region.",
                region: { xPx: 360, yPx: 180, widthPx: 180, heightPx: 140 },
                linkedMeasurementIds: [],
              },
              {
                kind: "suggestion",
                text: "Compare this probe result with the standby rail before rework.",
                linkedEventIds: [],
              },
            ],
          }),
        },
      };
    },
    getLocale: () => "en",
  });

  assert.equal(
    runtime.handleCommand(REPAIR_UI_COMMANDS.addMeasurement, {
      xPx: 712,
      yPx: 304,
      rawDisplay: "0.002",
      reference: "AI TEST U14 VCC",
    }).success,
    true
  );
  await new Promise<void>((resolve) => {
    setImmediate(resolve);
  });

  assert.equal(dispatchCalls.length, 1);
  assert.equal(dispatchCalls[0]?.["action"], "message.sendWait");
  assert.equal(dispatchCalls[0]?.["toSlot"], "ai2");
  const payload = dispatchCalls[0]?.["payload"] as Record<string, unknown> | undefined;
  const protocol = payload?.["protocol"] as Record<string, unknown> | undefined;
  assert.equal(payload?.["page"], "repair-room:tactical-observer");
  assert.equal(protocol?.["protocolKey"], "repair-room-tactical-observer");
  assert.match(String(payload?.["text"]), /repair-room-tactical-observation/);

  const state = runtime.getStateSnapshot().state;
  const session = state.sessions[state.activeSessionId ?? ""];
  assert.ok(session);
  const generatedRisk = session.events.find(
    (event) =>
      event.kind === "risk-flag" &&
      event.message === "Discharge the primary bulk cap before touching this region."
  );
  const generatedMark = session.events.find(
    (event) =>
      event.kind === "ai-mark" &&
      event.rationale === "Compare this probe result with the standby rail before rework."
  );
  const measurement = session.events.find(
    (event) => event.kind === "measurement" && event.reference === "AI TEST U14 VCC"
  );
  assert.ok(measurement);
  assert.ok(generatedRisk);
  assert.ok(generatedMark);
  if (generatedRisk?.kind === "risk-flag" && generatedMark?.kind === "ai-mark") {
    assert.equal(generatedRisk.linkedMeasurementIds?.includes(measurement.id), true);
    assert.equal(generatedMark.linkedMeasurementIds?.includes(measurement.id), true);
    assert.equal(generatedMark.protocolKey, "repair-room-tactical-observer");
  }
  assert.equal(
    state.tacticalFeed.some((item) => item.eventId === generatedRisk?.id),
    true
  );
  assert.equal(state.aiDispatch.tactical.status, "succeeded");
  assert.equal(state.aiDispatch.tactical.targetSlot, "ai2");

  runtime.dispose();
});

test("repair-room tactical bridge accepts content-backed top-level observation arrays", async () => {
  const dispatchCalls: Record<string, unknown>[] = [];
  const runtime = createRepairRoomHostRuntime().activate({
    log: () => {},
    notifyRoom: () => {},
    dispatchBridge: async (payload: Record<string, unknown>) => {
      dispatchCalls.push(payload);
      return {
        success: true,
        reply: {
          content: `Here is the tactical pass:\n\n\`\`\`json\n[\n  {\n    "severity": "warning",\n    "message": "Confirm isolation before probing primary-side rails.",\n    "linkedMeasurementIds": []\n  }\n]\n\`\`\``,
        },
      };
    },
    getLocale: () => "en",
  });

  assert.equal(
    runtime.handleCommand(REPAIR_UI_COMMANDS.addMeasurement, {
      xPx: 618,
      yPx: 286,
      rawDisplay: "380.0",
      reference: "AI ARRAY BULK_DC",
      unit: "V",
    }).success,
    true
  );
  await new Promise<void>((resolve) => {
    setImmediate(resolve);
  });

  assert.equal(dispatchCalls.length, 1);
  assert.equal(dispatchCalls[0]?.["toSlot"], "ai2");

  const state = runtime.getStateSnapshot().state;
  const session = state.sessions[state.activeSessionId ?? ""];
  assert.ok(session);
  const measurement = session.events.find(
    (event) => event.kind === "measurement" && event.reference === "AI ARRAY BULK_DC"
  );
  const generatedRisk = session.events.find(
    (event) =>
      event.kind === "risk-flag" &&
      event.message === "Confirm isolation before probing primary-side rails."
  );
  assert.ok(measurement);
  assert.ok(generatedRisk);
  if (generatedRisk?.kind === "risk-flag") {
    assert.equal(generatedRisk.linkedMeasurementIds?.includes(measurement.id), true);
  }
  assert.equal(state.aiDispatch.tactical.status, "succeeded");
  assert.match(state.aiDispatch.tactical.message ?? "", /1 observation/);

  runtime.dispose();
});

test("repair-room Phase 3 arbitrates one calm guidance surface per profile", () => {
  const runtime = createRepairRoomHostRuntime().activate({
    log: () => {},
    notifyRoom: () => {},
  });

  let state = runtime.getStateSnapshot().state;
  let session = state.sessions[state.activeSessionId ?? ""];
  assert.ok(session);
  let projection = createRepairReplayProjection(state, session);
  assert.equal(projection.guidance.operationalProfile, "novice");
  assert.equal(projection.guidance.panelVisibility.primarySurface, "measurement");
  assert.equal(projection.guidance.panelVisibility.panels.measurement, "expanded");
  assert.equal(projection.guidance.panelVisibility.panels["tactical-feed"], "compact");
  assert.equal(projection.guidance.panelVisibility.panels["session-wizard"], "hidden");
  assert.equal(projection.guidance.panelVisibility.tacticalFeedDensity, "minimal");

  assert.equal(
    runtime.handleCommand(REPAIR_UI_COMMANDS.setOperationalProfile, { profile: "advanced" })
      .success,
    true
  );
  state = runtime.getStateSnapshot().state;
  session = state.sessions[state.activeSessionId ?? ""];
  assert.ok(session);
  projection = createRepairReplayProjection(state, session);
  assert.equal(projection.guidance.operationalProfile, "advanced");
  assert.equal(projection.guidance.overlaySaturation.maxVisibleRelationships, 12);
  assert.equal(projection.guidance.overlaySaturation.labelMode, "full");
  assert.equal(projection.guidance.panelVisibility.panels.chat, "compact");

  assert.equal(
    runtime.handleCommand(REPAIR_UI_COMMANDS.advanceWizard, { step: "device-info" }).success,
    true
  );
  state = runtime.getStateSnapshot().state;
  session = state.sessions[state.activeSessionId ?? ""];
  assert.ok(session);
  projection = createRepairReplayProjection(state, session);
  assert.equal(projection.guidance.panelVisibility.primarySurface, "session-wizard");
  assert.equal(projection.guidance.panelVisibility.panels["session-wizard"], "expanded");
  assert.equal(projection.guidance.panelVisibility.panels["tactical-feed"], "compact");

  runtime.dispose();
});

test("repair-room Phase 3 projects confidence, recovery, saturation, and voice hooks", () => {
  const runtime = createRepairRoomHostRuntime().activate({
    log: () => {},
    notifyRoom: () => {},
  });

  assert.equal(
    runtime.handleCommand(REPAIR_UI_COMMANDS.setVoiceGuidance, {
      ambientListeningState: "listening",
      spokenGuidanceMode: "brief",
      handsBusyMode: true,
    }).success,
    true
  );
  assert.equal(
    runtime.handleCommand(REPAIR_UI_COMMANDS.focusKnowledgeSpatialRef, {
      spatialRefId: "startup-resistor-open",
    }).success,
    true
  );
  const state = runtime.getStateSnapshot().state;
  const session = state.sessions[state.activeSessionId ?? ""];
  assert.ok(session);
  const projection = createRepairReplayProjection(state, session);

  assert.equal(projection.guidance.aiInterruption.confidence, "high");
  assert.equal(projection.guidance.aiInterruption.urgency, "high");
  assert.equal(projection.guidance.aiInterruption.evidenceDepth, "strong");
  assert.equal(projection.guidance.recovery.currentFocus, "Startup resistor open");
  assert.match(projection.guidance.recovery.whyThisRegionMatters, /measurement evidence/);
  assert.ok(projection.guidance.overlaySaturation.clutterScore > 0);
  assert.ok(
    projection.guidance.overlaySaturation.visibleRelationshipIds.length <=
      projection.guidance.overlaySaturation.maxVisibleRelationships
  );
  assert.deepEqual(projection.guidance.voice.voiceFocusTarget, {
    kind: "knowledge-region",
    id: "startup-resistor-open",
  });
  assert.equal(projection.guidance.voice.ambientListeningState, "listening");
  assert.equal(projection.guidance.voice.handsBusyMode, true);
  assert.equal(projection.guidance.voice.spokenGuidanceMode, "step-by-step");
  assert.equal(projection.guidance.focusCorridor.active, true);
  assert.equal(projection.guidance.focusCorridor.targetRef?.kind, "knowledge-region");
  assert.equal(
    projection.guidance.overlaySaturation.visibleRegionRefs.length <=
      projection.guidance.overlaySaturation.maxVisibleRegions,
    true
  );
  assert.equal(
    projection.guidance.overlaySaturation.visibleEventIds.length <=
      projection.guidance.overlaySaturation.maxSimultaneousHighlights,
    true
  );
  assert.equal(
    projection.guidance.overlaySaturation.activeAttentionRefs.length <=
      projection.guidance.overlaySaturation.maxSimultaneousHighlights,
    true
  );
  assert.equal(
    projection.guidance.rhythm.lifecycle[projection.guidance.rhythm.currentIndex],
    "verify"
  );

  runtime.dispose();
});

test("repair-room updates room-local hands-free interaction settings", () => {
  const runtime = createRepairRoomHostRuntime().activate({
    log: () => {},
    notifyRoom: () => {},
  });

  assert.equal(
    runtime.handleCommand(REPAIR_UI_COMMANDS.setInteractionSettings, {
      androidCompanionEnabled: false,
      dictationRoute: "android",
      ttsRoute: "android",
      cameraFeedPreference: "android-feed",
      dictationSubmitMode: "send",
      autoReadAiReplies: false,
    }).success,
    true
  );
  assert.deepEqual(runtime.getStateSnapshot().state.layout.interactionSettings, {
    androidCompanionEnabled: false,
    dictationRoute: "android",
    ttsRoute: "android",
    cameraFeedPreference: "android-feed",
    dictationSubmitMode: "send",
    autoReadAiReplies: false,
  });

  const invalid = runtime.handleCommand(REPAIR_UI_COMMANDS.setInteractionSettings, {
    dictationRoute: "cloud",
  });
  assert.equal(invalid.success, false);
  assert.equal(
    runtime.getStateSnapshot().state.layout.interactionSettings.dictationRoute,
    "android"
  );

  runtime.dispose();
});

test("repair-room patches operator profile equipment, skills, preferences, and adaptation", () => {
  const runtime = createRepairRoomHostRuntime().activate({
    log: () => {},
    notifyRoom: () => {},
  });

  assert.equal(
    runtime.handleCommand(REPAIR_UI_COMMANDS.updateOperatorProfile, {
      displayName: "Mobile Bench",
      preferences: {
        aiVerbosity: "detailed",
        annotationDefaultStrokeWidth: 4,
        riskTolerance: "low",
      },
      skills: [{ id: "smps-repair", proficiency: 5 }],
      tools: [
        { id: "bench-psu", available: false },
        { id: "hot-air-quick861d", available: false },
      ],
      safety: [{ id: "fume-extractor", available: false }],
    }).success,
    true
  );

  const profile = runtime.getStateSnapshot().state.operatorProfile;
  assert.equal(profile.displayName, "Mobile Bench");
  assert.equal(profile.preferences.aiVerbosity, "detailed");
  assert.equal(profile.preferences.annotationDefaultStrokeWidth, 4);
  assert.equal(profile.preferences.riskTolerance, "low");
  assert.equal(profile.skills.find((skill) => skill.id === "smps-repair")?.proficiency, 5);
  assert.equal(profile.bench.tools.find((tool) => tool.id === "bench-psu")?.available, false);
  assert.equal(
    profile.bench.tools.find((tool) => tool.id === "hot-air-quick861d")?.available,
    false
  );
  assert.equal(profile.bench.safety.find((item) => item.id === "fume-extractor")?.available, false);
  assert.equal(runtime.getStateSnapshot().state.operatorAdaptation.hasBenchPsu, false);
  assert.equal(runtime.getStateSnapshot().state.operatorAdaptation.hasHotAirStation, false);
  assert.equal(runtime.getStateSnapshot().state.operatorAdaptation.hasMicroscope, true);

  runtime.dispose();
});

test("repair-room persists operator profile to room-local storage and hydrates it", async () => {
  const storage = createMemoryRepairStorage();
  const runtime = createRepairRoomHostRuntime({
    autoHydrateStorage: false,
    io: createMemoryRepairIo(),
    storage,
  }).activate({
    log: () => {},
    notifyRoom: () => {},
  });

  await runtime.hydrateStorage();
  assert.equal(
    runtime.handleCommand(REPAIR_UI_COMMANDS.updateOperatorProfile, {
      displayName: "Persisted Bench",
      tools: [{ id: "bench-psu", available: false }],
    }).success,
    true
  );
  await runtime.flushStorage();
  assert.equal(
    (storage.readOperatorProfileRecord() as { profile?: { displayName?: string } } | null)?.profile
      ?.displayName,
    "Persisted Bench"
  );
  runtime.dispose();

  const hydratedRuntime = createRepairRoomHostRuntime({
    autoHydrateStorage: false,
    io: createMemoryRepairIo(),
    storage,
  }).activate({
    log: () => {},
    notifyRoom: () => {},
  });
  await hydratedRuntime.hydrateStorage();

  assert.equal(
    hydratedRuntime.getStateSnapshot().state.operatorProfile.displayName,
    "Persisted Bench"
  );
  assert.equal(hydratedRuntime.getStateSnapshot().state.operatorAdaptation.hasBenchPsu, false);
  hydratedRuntime.dispose();
});

test("repair-room opens rare operator and control surfaces in a settings overlay", () => {
  const runtime = createRepairRoomHostRuntime().activate({
    log: () => {},
    notifyRoom: () => {},
  });

  assert.equal(runtime.getStateSnapshot().state.layout.settingsOverlayOpen, false);
  assert.equal(
    runtime.handleCommand(REPAIR_UI_COMMANDS.setSettingsOverlay, {
      open: true,
      tabId: "bench-operator",
    }).success,
    true
  );
  assert.equal(runtime.getStateSnapshot().state.layout.settingsOverlayOpen, true);
  assert.equal(runtime.getStateSnapshot().state.layout.settingsOverlayTabId, "bench-operator");

  assert.equal(
    runtime.handleCommand(REPAIR_UI_COMMANDS.setSettingsOverlay, {
      tabId: "repair-controls",
    }).success,
    true
  );
  assert.equal(runtime.getStateSnapshot().state.layout.settingsOverlayOpen, true);
  assert.equal(runtime.getStateSnapshot().state.layout.settingsOverlayTabId, "repair-controls");

  const invalid = runtime.handleCommand(REPAIR_UI_COMMANDS.setSettingsOverlay, {
    tabId: "timeline",
  });
  assert.equal(invalid.success, false);
  assert.equal(runtime.getStateSnapshot().state.layout.settingsOverlayTabId, "repair-controls");

  assert.equal(
    runtime.handleCommand(REPAIR_UI_COMMANDS.setSettingsOverlay, { open: false }).success,
    true
  );
  assert.equal(runtime.getStateSnapshot().state.layout.settingsOverlayOpen, false);

  runtime.dispose();
});

test("repair-room bridges hands-free capture and TTS commands through RoomHost APIs", async () => {
  const calls: string[] = [];
  const activeRequestIds: Record<string, string> = {};
  const runtime = createRepairRoomHostRuntime().activate({
    log: () => {},
    notifyRoom: () => {},
    capture: {
      startDictation: async (requestId = "") => {
        activeRequestIds["dictation"] = requestId;
        calls.push(`start-dictation:${requestId}`);
        return { requestId, outcome: { ok: true } };
      },
      stopDictation: async (requestId) => {
        calls.push(`stop-dictation:${requestId}`);
        return { ok: true };
      },
      startAmbientListener: async (requestId = "") => {
        activeRequestIds["ambient"] = requestId;
        calls.push(`start-ambient:${requestId}`);
        return { requestId, outcome: { ok: true } };
      },
      stopAmbientListener: async (requestId) => {
        calls.push(`stop-ambient:${requestId}`);
        return { ok: true };
      },
      startCameraFeed: async (requestId = "") => {
        activeRequestIds["camera"] = requestId;
        calls.push(`start-camera:${requestId}`);
        return {
          requestId,
          outcome: {
            ok: true,
            status: {
              scrcpy: {
                activeSession: {
                  previewVideo: {
                    source: "mjpeg-stream",
                    devicePath:
                      "http://127.0.0.1:4765/api/v1/live/camera/stream?target=room%3Arepair-room",
                    streamUrl:
                      "http://127.0.0.1:4765/api/v1/live/camera/stream?target=room%3Arepair-room",
                    contentType: "multipart/x-mixed-replace; boundary=hayalet-ev-live-frame",
                    label: "Hayalet Ev Companion Live Camera",
                    width: 1280,
                    height: 720,
                    fps: 10,
                  },
                },
              },
            },
          },
        };
      },
      stopCameraFeed: async (requestId = "") => {
        calls.push(`stop-camera:${requestId}`);
        return { requestId, outcome: { ok: true } };
      },
    },
    tts: {
      speak: async (text, options) => {
        activeRequestIds["tts"] = options?.requestId ?? "";
        calls.push(`speak:${options?.mode}:${options?.language}:${text}`);
        return {
          requestId: options?.requestId ?? "",
          outcome: { status: { status: "playing" } },
        };
      },
      stop: async (requestId) => {
        calls.push(`stop-tts:${requestId}`);
      },
    },
    getLocale: () => "tr",
  });

  assert.equal(runtime.handleCommand(REPAIR_UI_COMMANDS.startDictation).success, true);
  assert.equal(runtime.handleCommand(REPAIR_UI_COMMANDS.startAmbientListener).success, true);
  assert.equal(runtime.handleCommand(REPAIR_UI_COMMANDS.startCameraFeed).success, true);
  assert.equal(
    runtime.handleCommand(REPAIR_UI_COMMANDS.setInteractionSettings, { ttsRoute: "android" })
      .success,
    true
  );
  assert.equal(
    runtime.handleCommand(REPAIR_UI_COMMANDS.speakGuidance, { text: "Bir sonraki adimi oku." })
      .success,
    true
  );
  await new Promise<void>((resolve) => {
    setImmediate(resolve);
  });

  assert.match(activeRequestIds["dictation"] ?? "", /^repair-room:dictation:/);
  assert.match(activeRequestIds["ambient"] ?? "", /^repair-room:ambient:/);
  assert.match(activeRequestIds["camera"] ?? "", /^repair-room:camera:/);
  assert.equal(runtime.getStateSnapshot().state.livePreview?.source, "mjpeg-stream");
  assert.equal(
    runtime.getStateSnapshot().state.livePreview?.streamUrl,
    "http://127.0.0.1:4765/api/v1/live/camera/stream?target=room%3Arepair-room"
  );
  assert.match(activeRequestIds["tts"] ?? "", /^repair-room:tts:/);
  assert.ok(calls.some((call) => call.startsWith("speak:android:tr:Bir sonraki adimi oku.")));

  assert.equal(runtime.handleCommand(REPAIR_UI_COMMANDS.stopDictation).success, true);
  assert.equal(runtime.handleCommand(REPAIR_UI_COMMANDS.stopAmbientListener).success, true);
  assert.equal(runtime.handleCommand(REPAIR_UI_COMMANDS.stopCameraFeed).success, true);
  assert.equal(runtime.handleCommand(REPAIR_UI_COMMANDS.stopSpeech).success, true);
  await new Promise<void>((resolve) => {
    setImmediate(resolve);
  });

  assert.ok(calls.includes(`stop-dictation:${activeRequestIds["dictation"]}`));
  assert.ok(calls.includes(`stop-ambient:${activeRequestIds["ambient"]}`));
  assert.ok(calls.includes(`stop-camera:${activeRequestIds["camera"]}`));
  assert.ok(calls.includes(`stop-tts:${activeRequestIds["tts"]}`));

  const beforeDisabledCaptureCallCount = calls.length;
  assert.equal(
    runtime.handleCommand(REPAIR_UI_COMMANDS.setInteractionSettings, {
      androidCompanionEnabled: false,
    }).success,
    true
  );
  assert.equal(runtime.handleCommand(REPAIR_UI_COMMANDS.startCameraFeed).success, false);
  assert.equal(calls.length, beforeDisabledCaptureCallCount);

  runtime.dispose();
});

test("repair-room auto-reads AI chat replies when the room setting is enabled", async () => {
  const spoken: string[] = [];
  const runtime = createRepairRoomHostRuntime().activate({
    log: () => {},
    notifyRoom: () => {},
    dispatchBridge: async () => ({
      success: true,
      reply: {
        text: JSON.stringify({
          replyText: "Measure standby voltage before replacing parts.",
          contextRefs: ["tp-5v-stby"],
        }),
      },
    }),
    getLocale: () => "en",
    tts: {
      speak: async (text, options) => {
        spoken.push(`${options?.mode}:${options?.language}:${text}`);
        return {
          requestId: options?.requestId ?? "",
          outcome: { status: { status: "done" } },
        };
      },
      stop: async () => {},
    },
  });

  assert.equal(
    runtime.handleCommand(REPAIR_UI_COMMANDS.sendChatTurn, { text: "Read this answer" }).success,
    true
  );
  await new Promise<void>((resolve) => {
    setImmediate(resolve);
  });

  assert.deepEqual(spoken, ["local:en:Measure standby voltage before replacing parts."]);

  assert.equal(
    runtime.handleCommand(REPAIR_UI_COMMANDS.setInteractionSettings, {
      autoReadAiReplies: false,
    }).success,
    true
  );
  assert.equal(
    runtime.handleCommand(REPAIR_UI_COMMANDS.sendChatTurn, { text: "Do not read this one" })
      .success,
    true
  );
  await new Promise<void>((resolve) => {
    setImmediate(resolve);
  });

  assert.equal(spoken.length, 1);

  runtime.dispose();
});

test("repair-room persists dictated composer drafts before chat submission", async () => {
  const runtime = createRepairRoomHostRuntime().activate({
    log: () => {},
    notifyRoom: () => {},
    dispatchBridge: async () => ({
      success: true,
      reply: {
        text: JSON.stringify({
          replyText: "Composer draft received.",
          contextRefs: [],
        }),
      },
    }),
  });

  assert.equal(
    runtime.handleCommand(REPAIR_UI_COMMANDS.setChatComposer, {
      draft: "Measure U14 VCC",
    }).success,
    true
  );
  assert.equal(runtime.getStateSnapshot().state.chat.composerDraft, "Measure U14 VCC");

  assert.equal(
    runtime.handleCommand(REPAIR_UI_COMMANDS.sendChatTurn, { text: "Measure U14 VCC" }).success,
    true
  );
  assert.equal(runtime.getStateSnapshot().state.chat.composerDraft, "");

  await new Promise<void>((resolve) => {
    setImmediate(resolve);
  });

  runtime.dispose();
});

test("repair-room Phase 3 keeps calm defaults and applies AI attention budget", () => {
  const defaultGuidance = createRepairDefaultGuidanceProjection();
  const emptyGuidance = createEmptyRepairReplayProjection().guidance;
  assert.deepEqual(emptyGuidance, defaultGuidance);

  const runtime = createRepairRoomHostRuntime().activate({
    log: () => {},
    notifyRoom: () => {},
  });
  assert.equal(
    runtime.handleCommand(REPAIR_UI_COMMANDS.setAttentionBudget, {
      windowMs: 240000,
      maxAiInterruptions: 1,
    }).success,
    true
  );
  const state = runtime.getStateSnapshot().state;
  const session = state.sessions[state.activeSessionId ?? ""];
  assert.ok(session);
  const projection = createRepairReplayProjection(state, session);

  assert.equal(projection.guidance.aiInterruption.attentionBudget.windowMs, 240000);
  assert.equal(projection.guidance.aiInterruption.attentionBudget.maxAiInterruptions, 1);
  assert.equal(
    projection.guidance.aiInterruption.attentionBudget.usedAiInterruptions <=
      projection.guidance.aiInterruption.attentionBudget.maxAiInterruptions,
    true
  );
  assert.ok(projection.guidance.aiInterruption.attentionBudget.usedAiInterruptions >= 1);
  assert.ok(projection.guidance.aiInterruption.attentionBudget.collapsedByBudgetCount >= 1);

  runtime.dispose();
});

test("repair-room runtime turns timeline jumps and layout controls into state", () => {
  const runtime = createRepairRoomHostRuntime().activate({
    log: () => {},
    notifyRoom: () => {},
  });

  const firstEvent = runtime.getStateSnapshot().state.sessions["psu-2025-0510"]?.events[0];
  assert.ok(firstEvent);

  assert.equal(
    runtime.handleCommand(REPAIR_UI_COMMANDS.jumpToEvent, { eventId: firstEvent.id }).success,
    true
  );
  assert.equal(runtime.getStateSnapshot().state.workbench.focusedEventId, firstEvent.id);

  assert.equal(
    runtime.handleCommand(REPAIR_UI_COMMANDS.updatePanelLayout, {
      panelId: "tactical-feed",
      collapsed: true,
    }).success,
    true
  );
  assert.equal(runtime.getStateSnapshot().state.layout.collapsedPanels["tactical-feed"], true);

  assert.equal(
    runtime.handleCommand(REPAIR_UI_COMMANDS.updatePanelTab, {
      previewTabId: "board-view",
    }).success,
    true
  );
  assert.equal(runtime.getStateSnapshot().state.knowledgePack.previewTabId, "board-view");

  assert.equal(
    runtime.handleCommand(REPAIR_UI_COMMANDS.updatePanelTab, {
      operatorProfileTabId: "preferences",
    }).success,
    true
  );
  assert.equal(runtime.getStateSnapshot().state.layout.operatorProfileTabId, "preferences");

  assert.equal(
    runtime.handleCommand(REPAIR_UI_COMMANDS.updateFocus, {
      focusMode: true,
    }).success,
    true
  );
  assert.equal(runtime.getStateSnapshot().state.layout.focusMode, true);

  assert.equal(
    runtime.handleCommand(REPAIR_UI_COMMANDS.updateLayout, {
      panelId: "tactical-feed",
      collapsed: false,
    }).success,
    true
  );
  assert.equal(runtime.getStateSnapshot().state.layout.collapsedPanels["tactical-feed"], false);
});

test("repair-room runtime keeps event log canonical while feed remains a visibility projection", () => {
  const notifications: Array<{ type: string; payload?: Record<string, unknown> }> = [];
  const runtime = createRepairRoomHostRuntime().activate({
    log: () => {},
    notifyRoom: (type, payload) => {
      notifications.push({ type, payload });
    },
  });

  assert.equal(runtime.handleCommand(REPAIR_UI_COMMANDS.uiReady).success, true);
  const payload = notifications.find((entry) => entry.type === "repair-state")?.payload as
    | {
        snapshot?: { tacticalFeed?: Array<{ eventId: string }> };
        meta?: { events?: Array<{ id: string }> };
      }
    | undefined;

  const feedIds = new Set(payload?.snapshot?.tacticalFeed?.map((item) => item.eventId) ?? []);
  assert.equal(feedIds.has("evt-psu-ai-3"), false);
  assert.equal(
    payload?.meta?.events?.some((event) => event.id === "evt-psu-ai-3"),
    true
  );
});

test("repair-room runtime publishes one coherent state snapshot per logical action", () => {
  const notifications: Array<{ type: string; payload?: Record<string, unknown> }> = [];
  const runtime = createRepairRoomHostRuntime().activate({
    log: () => {},
    notifyRoom: (type, payload) => {
      notifications.push({ type, payload });
    },
  });

  notifications.length = 0;
  assert.equal(runtime.handleCommand(REPAIR_UI_COMMANDS.toggleFreezeFrame).success, true);
  assert.equal(notifications.filter((entry) => entry.type === "repair-state").length, 1);

  notifications.length = 0;
  assert.equal(
    runtime.handleCommand(REPAIR_UI_COMMANDS.addMeasurement, {
      xPx: 712,
      yPx: 304,
      rawDisplay: "0.003",
      reference: "U14 VCC",
    }).success,
    true
  );
  assert.equal(notifications.filter((entry) => entry.type === "repair-state").length, 2);

  notifications.length = 0;
  assert.equal(
    runtime.handleCommand(REPAIR_UI_COMMANDS.sendChatTurn, { text: "Next rail?" }).success,
    true
  );
  assert.equal(notifications.filter((entry) => entry.type === "repair-state").length, 1);
});

test("repair-room runtime keeps P1 wizard, viewport, timeline, and pin edits stateful", () => {
  const runtime = createRepairRoomHostRuntime().activate({
    log: () => {},
    notifyRoom: () => {},
  });

  assert.equal(
    runtime.handleCommand(REPAIR_UI_COMMANDS.updateSession, {
      wizardField: "model",
      value: "BN44-00932A",
    }).success,
    true
  );
  assert.equal(runtime.getStateSnapshot().state.wizard.draft.model, "BN44-00932A");

  assert.equal(
    runtime.handleCommand(REPAIR_UI_COMMANDS.updateSession, {
      wizardField: "primarySymptoms",
      value: ["No Power", "No 5V_STBY"],
    }).success,
    true
  );
  assert.deepEqual(runtime.getStateSnapshot().state.wizard.draft.primarySymptoms, [
    "No Power",
    "No 5V_STBY",
  ]);

  assert.equal(
    runtime.handleCommand(REPAIR_UI_COMMANDS.advanceWizard, { step: "ai-research" }).success,
    true
  );
  const researchState = runtime.getStateSnapshot().state.wizard;
  assert.equal(researchState.currentStep, "ai-research");
  assert.equal(researchState.foundResources.length, 0);
  assert.ok(researchState.researchProgress.every((item) => item.completed === false));

  assert.equal(
    runtime.handleCommand(REPAIR_UI_COMMANDS.updateViewport, {
      viewportZoom: 1.75,
      panXPx: 36,
      panYPx: -18,
    }).success,
    true
  );
  assert.deepEqual(runtime.getStateSnapshot().state.workbench.viewport, {
    zoom: 1.75,
    panXPx: 36,
    panYPx: -18,
  });
  assert.equal(
    runtime.handleCommand(REPAIR_UI_COMMANDS.updateViewport, {
      panXPx: 999999,
      panYPx: -999999,
    }).success,
    true
  );
  assert.ok(runtime.getStateSnapshot().state.workbench.viewport.panXPx < 999999);
  assert.ok(runtime.getStateSnapshot().state.workbench.viewport.panYPx > -999999);

  assert.equal(
    runtime.handleCommand(REPAIR_UI_COMMANDS.scrubTimeline, { positionMs: 42000 }).success,
    true
  );
  assert.equal(runtime.getStateSnapshot().state.workbench.timeline.playheadMs, 42000);
  assert.equal(runtime.getStateSnapshot().state.workbench.timeline.autoFollowLive, false);

  assert.equal(
    runtime.handleCommand(REPAIR_UI_COMMANDS.updateTimeline, {
      timelineZoom: 1.5,
      timelineRangeStartMs: 27000,
      timelineRangeEndMs: 57000,
    }).success,
    true
  );
  assert.deepEqual(
    {
      zoom: runtime.getStateSnapshot().state.workbench.timeline.zoom,
      rangeStartMs: runtime.getStateSnapshot().state.workbench.timeline.rangeStartMs,
      rangeEndMs: runtime.getStateSnapshot().state.workbench.timeline.rangeEndMs,
    },
    {
      zoom: 1.5,
      rangeStartMs: 27000,
      rangeEndMs: 57000,
    }
  );

  const session =
    runtime.getStateSnapshot().state.sessions[
      runtime.getStateSnapshot().state.activeSessionId ?? ""
    ];
  const measurement = session?.events.find((event) => event.kind === "measurement");
  assert.ok(measurement);
  const eventCount = session.events.length;

  assert.equal(
    runtime.handleCommand(REPAIR_UI_COMMANDS.addMeasurement, {
      eventId: measurement.id,
      xPx: 111,
      yPx: 222,
      reference: "Dragged probe",
    }).success,
    true
  );

  const updatedSession = runtime.getStateSnapshot().state.sessions[session.id];
  const updatedMeasurement = updatedSession?.events.find((event) => event.id === measurement.id);
  assert.equal(updatedSession?.events.length, eventCount);
  assert.equal(updatedMeasurement?.kind, "measurement");
  if (updatedMeasurement?.kind === "measurement") {
    assert.deepEqual(updatedMeasurement.pinAt, { xPx: 111, yPx: 222 });
  }
  assert.equal(runtime.getStateSnapshot().state.workbench.focusedEventId, measurement.id);
});

test("repair-room Phase 2 projection restores replay state from the canonical event log", () => {
  const notifications: Array<{ type: string; payload?: Record<string, unknown> }> = [];
  const runtime = createRepairRoomHostRuntime().activate({
    log: () => {},
    notifyRoom: (type, payload) => {
      notifications.push({ type, payload });
    },
  });

  assert.equal(
    runtime.handleCommand(REPAIR_UI_COMMANDS.scrubTimeline, { positionMs: 16 * 60 * 1000 }).success,
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
    payload.snapshot?.workbench?.measurementEvidence?.some((entry) =>
      entry.reference.includes("C101")
    ),
    true
  );
});

test("repair-room replay projection holds forensic overlay state during freeze frames", () => {
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

test("repair-room AI mark expiry is evaluated against replay playhead", () => {
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

test("repair-room timeline chips seek to exact event state and replay controls stay deterministic", () => {
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

test("repair-room annotations and knowledge pack spatial focus are forensic records", () => {
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
  if (annotation?.kind === "annotation") {
    assert.equal(annotation.meta?.author, "operator");
    assert.equal(annotation.meta?.tool, "rect");
    assert.deepEqual(annotation.meta?.linkedMeasurementIds, ["evt-psu-meas-2"]);
    assert.deepEqual(annotation.meta?.linkedEventIds, ["evt-psu-ai-2"]);
  }

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

test("repair-room Phase 2.8 folds investigation regions from canonical replay events", () => {
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
  assert.equal(projection.investigationRegions[0]?.createdEventId, "evt-region-create-1");
  assert.equal(projection.investigationRegions[0]?.updatedEventId, "evt-region-update-1");
  assert.equal(projection.investigationRegions[0]?.status, "resolved");
  assert.deepEqual(projection.investigationRegions[0]?.linkage.measurementEventIds, [
    "evt-psu-meas-3",
    "evt-psu-meas-4",
  ]);
});

test("repair-room Phase 2.8 keeps investigation mode explicit and entity refs commandable", () => {
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

test("repair-room Phase 2.8 focuses investigation regions, relationships, and live edge explicitly", () => {
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
      regionId: regionEvent.regionId,
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
    id: regionEvent.regionId,
  });
  assert.deepEqual(projection.activeSpatialFocus?.ref, {
    kind: "investigation-region",
    id: regionEvent.regionId,
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
      const linked = session.events.find((event) => event.id === eventId);
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

test("repair-room Phase 2.8 separates temporary knowledge focus from promoted regions", () => {
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
  if (promotedRegionEvent?.kind === "investigation-region-created") {
    assert.deepEqual(promotedRegionEvent.measurementEventIds, ["evt-psu-meas-2"]);
    assert.deepEqual(promotedRegionEvent.annotationEventIds, ["evt-psu-anno-2"]);
    assert.deepEqual(promotedRegionEvent.aiMarkEventIds, ["evt-psu-ai-1"]);
    assert.equal(promotedRegionEvent.linkedEventIds.includes("evt-psu-anno-2"), true);
  }
  assert.equal(projection.investigationRegions[0]?.knowledgeSpatialRefId, "startup-resistor-open");
});

test("repair-room Phase 2.8 keyboard nudging moves event-backed and canonical region refs", () => {
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
  if (nudgedMeasurement?.kind === "measurement") {
    assert.deepEqual(nudgedMeasurement.pinAt, {
      xPx: measurement.pinAt.xPx + 6,
      yPx: measurement.pinAt.yPx - 3,
    });
  }

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
  if (updateEvent?.kind === "investigation-region-updated") {
    assert.equal(updateEvent.regionId, region.regionId);
    assert.deepEqual(updateEvent.region, {
      ...beforeRegion,
      xPx: beforeRegion.xPx + 10,
      yPx: beforeRegion.yPx + 5,
    });
  }
  projection = createRepairReplayProjection(state, session);
  assert.deepEqual(projection.investigationRegions[0]?.region, {
    ...beforeRegion,
    xPx: beforeRegion.xPx + 10,
    yPx: beforeRegion.yPx + 5,
  });
});

test("repair-room overlay selection supports hover, multi-select, deselect, and focus jump", () => {
  const runtime = createRepairRoomHostRuntime().activate({
    log: () => {},
    notifyRoom: () => {},
  });
  const session = runtime.getStateSnapshot().state.sessions["psu-2025-0510"];
  assert.ok(session);
  const first = session.events.find((event) => event.kind === "annotation");
  const second = session.events.find((event) => event.kind === "measurement");
  assert.ok(first);
  assert.ok(second);

  assert.equal(
    runtime.handleCommand(REPAIR_UI_COMMANDS.updateFocus, { hoveredEventId: first.id }).success,
    true
  );
  assert.equal(runtime.getStateSnapshot().state.workbench.selection.hoveredEventId, first.id);

  assert.equal(
    runtime.handleCommand(REPAIR_UI_COMMANDS.updateFocus, {
      eventId: first.id,
      selectionMode: "replace",
      focusJump: true,
      jumpToEvent: true,
    }).success,
    true
  );
  assert.deepEqual(runtime.getStateSnapshot().state.workbench.selection.selectedEventIds, [
    first.id,
  ]);
  assert.equal(runtime.getStateSnapshot().state.workbench.focusedEventId, first.id);

  assert.equal(
    runtime.handleCommand(REPAIR_UI_COMMANDS.updateFocus, {
      eventId: second.id,
      selectionMode: "toggle",
      focusJump: false,
    }).success,
    true
  );
  assert.deepEqual(runtime.getStateSnapshot().state.workbench.selection.selectedEventIds, [
    first.id,
    second.id,
  ]);
  assert.equal(runtime.getStateSnapshot().state.workbench.selection.inspectorEventId, second.id);

  assert.equal(
    runtime.handleCommand(REPAIR_UI_COMMANDS.updateFocus, { clearSelection: true }).success,
    true
  );
  assert.deepEqual(runtime.getStateSnapshot().state.workbench.selection.selectedEventIds, []);
  assert.equal(runtime.getStateSnapshot().state.workbench.focusedEventId, null);
  assert.equal(runtime.getStateSnapshot().state.workbench.selection.hoveredEventId, null);
});

test("repair-room AI mark lifecycle changes append canonical replay events", () => {
  const runtime = createRepairRoomHostRuntime().activate({
    log: () => {},
    notifyRoom: () => {},
  });
  const session = runtime.getStateSnapshot().state.sessions["psu-2025-0510"];
  assert.ok(session);
  const target = session.events.find((event) => event.id === "evt-psu-ai-2");
  assert.ok(target);
  assert.equal(target.kind, "ai-mark");

  assert.equal(
    runtime.handleCommand(REPAIR_UI_COMMANDS.dismissAiMark, {
      eventId: target.id,
      state: "dismissed",
      reason: "Operator dismissed duplicate observation.",
    }).success,
    true
  );

  const nextSession = runtime.getStateSnapshot().state.sessions["psu-2025-0510"];
  const lifecycle = nextSession?.events.at(-1);
  assert.equal(lifecycle?.kind, "ai-mark-lifecycle");
  if (lifecycle?.kind === "ai-mark-lifecycle") {
    assert.equal(lifecycle.targetEventId, target.id);
    assert.equal(lifecycle.state, "dismissed");
    assert.equal(lifecycle.linkedEventIds.includes(target.id), true);
  }
  const baseTarget = nextSession?.events.find((event) => event.id === target.id);
  assert.equal(baseTarget?.kind, "ai-mark");
  if (baseTarget?.kind === "ai-mark") {
    assert.equal(baseTarget.dismissed, false);
  }

  const liveProjection = createRepairReplayProjection(
    runtime.getStateSnapshot().state,
    nextSession ?? null
  );
  assert.equal(liveProjection.aiMarkEventIds.includes(target.id), false);
  assert.equal(
    liveProjection.overlayEvents.some((event) => event.id === target.id),
    false
  );

  const targetOffset = Date.parse(target.occurredAt) - Date.parse(session.startedAt);
  assert.equal(
    runtime.handleCommand(REPAIR_UI_COMMANDS.scrubTimeline, { positionMs: targetOffset }).success,
    true
  );
  const restoredProjection = createRepairReplayProjection(
    runtime.getStateSnapshot().state,
    runtime.getStateSnapshot().state.sessions["psu-2025-0510"] ?? null
  );
  assert.equal(restoredProjection.aiMarkEventIds.includes(target.id), true);
});

test("repair-room opens the existing active session without replaying research setup", (t) => {
  t.mock.timers.enable({
    apis: ["Date", "setInterval", "setTimeout"],
    now: new Date("2026-05-11T09:00:00.000Z"),
  });
  const runtime = createRepairRoomHostRuntime().activate({
    log: () => {},
    notifyRoom: () => {},
  });

  assert.equal(runtime.getStateSnapshot().state.wizard.currentStep, "ready");
  assert.equal(runtime.getStateSnapshot().state.wizard.generatedKnowledgePackId, "bn44-00932a");
  assert.ok(
    runtime.getStateSnapshot().state.wizard.researchProgress.every((item) => item.completed)
  );

  assert.equal(runtime.handleCommand(REPAIR_UI_COMMANDS.uiReady).success, true);
  t.mock.timers.tick(4000);

  const wizard = runtime.getStateSnapshot().state.wizard;
  assert.equal(wizard.currentStep, "ready");
  assert.equal(wizard.foundResources.length, 4);
  assert.ok(wizard.researchProgress.every((item) => item.completed));

  runtime.dispose();
  t.mock.timers.reset();
});

test("repair-room live playhead advances from room activation instead of mock wall-clock age", (t) => {
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

test("repair-room runtime drifts live readings into recent instrument history", (t) => {
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

test("repair-room P3.5 keeps operations projection optional for standalone room runs", () => {
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

test("repair-room P3.5 starts operations bridge and pushes live camera status", async () => {
  const notifications: Array<{ type: string; payload?: Record<string, unknown> }> = [];
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
      getStatus: async () => initialStatus,
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

test("repair-room P3.5 projects central operations status without owning capabilities", () => {
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

test("repair-room P3.5 projects voice readiness from operations and guidance state", () => {
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

test("repair-room P3.5 keeps live source extensible for future camera providers", () => {
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

test("repair-room P3.5 action registry carries reusable disabled metadata", () => {
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
    assert.ok(entry.phrases.length > 0, entry.id);
    assert.ok(
      ["navigation", "capture", "measurement", "verification", "investigation"].includes(
        entry.category
      ),
      entry.id
    );
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
  assert.ok(enabledPhraseMap[REPAIR_UI_COMMANDS.focusOverlayEntity]?.includes("focus measurement"));
  assert.ok(enabledPhraseMap[REPAIR_UI_COMMANDS.addMeasurement]?.includes("start measurement"));

  const runtime = createRepairRoomHostRuntime().activate({
    log: () => {},
    notifyRoom: () => {},
  }) as { voiceCommands?: Record<string, readonly string[]>; dispose: () => void };
  assert.deepEqual(runtime.voiceCommands, {});
  runtime.dispose();
});

test("repair-room P3.5 projects continuity from focus, measurement, and verified regions", () => {
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
