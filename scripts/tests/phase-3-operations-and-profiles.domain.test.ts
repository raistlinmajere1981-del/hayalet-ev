import test from "node:test";
import assert from "node:assert/strict";
import createRepairRoomHostRuntimeBase from "../../rooms/repair-room/host/runtime.ts";
import {
  createEmptyRepairReplayProjection,
  createRepairReplayProjection,
} from "../../rooms/repair-room/host/state/repair-replay-projection.ts";
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

describe("Phase 3 operations and profiles", () => {
  void test("repair-room Phase 3 arbitrates one calm guidance surface per profile", () => {
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

  void test("repair-room Phase 3 projects confidence, recovery, saturation, and voice hooks", () => {
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

  void test("repair-room updates room-local hands-free interaction settings", () => {
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

  void test("repair-room patches operator profile equipment, skills, preferences, and adaptation", () => {
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
        skills: [{ id: "smps-repair", label: "SMPS repair", proficiency: 5 }],
        tools: [
          { id: "bench-psu", category: "power", label: "DC Bench Power Supply", available: false },
          {
            id: "hot-air-quick861d",
            category: "soldering",
            label: "Hot Air Station (Quick 861D)",
            available: false,
          },
          {
            id: "microscope-relife-rl-m3t",
            category: "vision",
            label: "Microscope (Relife RL-M3T)",
            available: true,
          },
        ],
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
    assert.equal(runtime.getStateSnapshot().state.operatorAdaptation.hasBenchPsu, false);
    assert.equal(runtime.getStateSnapshot().state.operatorAdaptation.hasHotAirStation, false);
    assert.equal(runtime.getStateSnapshot().state.operatorAdaptation.hasMicroscope, true);

    runtime.dispose();
  });

  void test("repair-room persists operator profile to room-local storage and hydrates it", async () => {
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
      (storage.readOperatorProfileRecord() as { profile?: { displayName?: string } } | null)
        ?.profile?.displayName,
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

  void test("repair-room opens rare operator and control surfaces in a settings overlay", () => {
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

  void test("repair-room bridges hands-free capture and TTS commands through RoomHost APIs", async () => {
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
          calls.push(
            `speak:${String(options?.mode ?? "")}:${String(options?.language ?? "")}:${text}`
          );
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

    assert.ok(calls.includes(`stop-dictation:${String(activeRequestIds["dictation"])}`));
    assert.ok(calls.includes(`stop-ambient:${String(activeRequestIds["ambient"])}`));
    assert.ok(calls.includes(`stop-camera:${String(activeRequestIds["camera"])}`));
    assert.ok(calls.includes(`stop-tts:${String(activeRequestIds["tts"])}`));

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

  void test("repair-room auto-reads AI chat replies when the room setting is enabled", async () => {
    const spoken: string[] = [];
    const runtime = createRepairRoomHostRuntime().activate({
      log: () => {},
      notifyRoom: () => {},
      dispatchBridge: () => ({
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
          spoken.push(`${String(options?.mode ?? "")}:${String(options?.language ?? "")}:${text}`);
          return {
            requestId: options?.requestId ?? "",
            outcome: { status: { status: "done" } },
          };
        },
        stop: async (_requestId: string) => {},
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

  void test("repair-room persists dictated composer drafts before chat submission", async () => {
    const runtime = createRepairRoomHostRuntime().activate({
      log: () => {},
      notifyRoom: () => {},
      dispatchBridge: () => ({
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

  void test("repair-room Phase 3 keeps calm defaults and applies AI attention budget", () => {
    const defaultGuidance = createRepairDefaultGuidanceProjection();
    const emptyGuidance = createEmptyRepairReplayProjection().guidance;
    assert.deepEqual(emptyGuidance, defaultGuidance);
    assert.equal(defaultGuidance.panelVisibility.panels["knowledge-pack"], "compact");

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
    const noPackProjection = createRepairReplayProjection(state, {
      ...session,
      knowledgePack: null,
      knowledgePackId: null,
    });

    assert.equal(projection.guidance.aiInterruption.attentionBudget.windowMs, 240000);
    assert.equal(projection.guidance.aiInterruption.attentionBudget.maxAiInterruptions, 1);
    assert.equal(noPackProjection.guidance.panelVisibility.panels["knowledge-pack"], "compact");
    assert.equal(
      projection.guidance.aiInterruption.attentionBudget.usedAiInterruptions <=
        projection.guidance.aiInterruption.attentionBudget.maxAiInterruptions,
      true
    );
    assert.ok(projection.guidance.aiInterruption.attentionBudget.usedAiInterruptions >= 1);
    assert.ok(projection.guidance.aiInterruption.attentionBudget.collapsedByBudgetCount >= 1);

    runtime.dispose();
  });
});
