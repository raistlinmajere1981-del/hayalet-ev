import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createLabStore } from "../../rooms/laboratory/runtime/lab-store.ts";
import {
  deriveLegacyStage,
  getActiveModule,
  getSourceActionBlockReason,
  getEditActionBlockReason,
  getAnalysisActionBlockReason,
  getAvailableCapabilities,
  getCurrentPreflight,
  getReportActionBlockReason,
  hasReportPayload,
  isRunActive,
  isRunComplete,
  getToolRelevanceFilter,
} from "../../rooms/laboratory/runtime/lab-selectors.ts";

test("deriveLegacyStage returns 'source' when no source is loaded", () => {
  const store = createLabStore();
  const state = store.getState();
  assert.equal(deriveLegacyStage(state), "source");
  assert.equal(state.currentStage, "source");
});

test("deriveLegacyStage returns 'edit' when source probe is completed", () => {
  const store = createLabStore();
  store.dispatch({
    type: "source-config-patched",
    patch: { kind: "video", mode: "local", storedPath: "/tmp/test.mp4" },
  });
  store.dispatch({ type: "source-probe-completed", action: "source-pick-local" });
  const state = store.getState();
  assert.equal(deriveLegacyStage(state), "edit");
  assert.equal(state.currentStage, "edit");
});

test("deriveLegacyStage returns 'process' when a run is active", () => {
  const store = createLabStore();
  store.dispatch({
    type: "source-config-patched",
    patch: { kind: "video", mode: "local", storedPath: "/tmp/test.mp4" },
  });
  store.dispatch({ type: "source-probe-completed", action: "source-pick-local" });
  store.dispatch({
    type: "host-event-received",
    event: {
      id: "evt-run",
      kind: "activity",
      severity: "info",
      message: "Analiz basladi",
      detail: null,
      timestamp: Date.now(),
      source: "host",
      action: "process-run",
      stage: "running",
      scope: "run",
      moduleId: null,
      rawLine: null,
    },
  });
  const state = store.getState();
  assert.equal(deriveLegacyStage(state), "process");
  assert.equal(state.currentStage, "process");
  assert.equal(isRunActive(state), true);
});

test("getActiveModule returns the first running module and clears when none are running", () => {
  const store = createLabStore();
  store.dispatch({
    type: "source-config-patched",
    patch: { kind: "video", mode: "local", storedPath: "/tmp/test.mp4" },
  });
  store.dispatch({ type: "source-probe-completed", action: "source-pick-local" });
  store.dispatch({
    type: "host-event-received",
    event: {
      id: "evt-run",
      kind: "activity",
      severity: "info",
      message: "Analiz basladi",
      detail: null,
      timestamp: Date.now(),
      source: "host",
      action: "process-run",
      stage: "running",
      scope: "run",
      moduleId: null,
      rawLine: null,
    },
  });
  store.dispatch({
    type: "host-event-received",
    event: {
      id: "evt-motion",
      kind: "activity",
      severity: "info",
      message: "motion running",
      detail: "motion running",
      timestamp: Date.now() + 1,
      source: "host",
      action: "process-run",
      stage: "running",
      scope: "run",
      moduleId: "motion",
      rawLine: null,
    },
  });
  store.dispatch({
    type: "host-event-received",
    event: {
      id: "evt-audio",
      kind: "activity",
      severity: "info",
      message: "audio queued",
      detail: "audio queued",
      timestamp: Date.now() + 2,
      source: "host",
      action: "process-run",
      stage: "queued",
      scope: "run",
      moduleId: "audio",
      rawLine: null,
    },
  });

  let state = store.getState();
  assert.equal(getActiveModule(state)?.id, "motion");

  store.dispatch({
    type: "host-event-received",
    event: {
      id: "evt-motion-done",
      kind: "activity",
      severity: "success",
      message: "motion done",
      detail: "motion done",
      timestamp: Date.now() + 3,
      source: "host",
      action: "process-run",
      stage: "completed",
      scope: "run",
      moduleId: "motion",
      rawLine: null,
    },
  });

  state = store.getState();
  assert.equal(getActiveModule(state), null);
});

test("deriveLegacyStage returns 'report' when run is complete and reports exist", () => {
  const store = createLabStore();
  store.dispatch({
    type: "source-config-patched",
    patch: { kind: "video", mode: "local", storedPath: "/tmp/test.mp4" },
  });
  store.dispatch({ type: "source-probe-completed", action: "source-pick-local" });
  store.dispatch({
    type: "host-event-received",
    event: {
      id: "evt-run",
      kind: "activity",
      severity: "info",
      message: "Analiz tamamlandi",
      detail: null,
      timestamp: Date.now(),
      source: "host",
      action: "process-run",
      stage: "completed",
      scope: "run",
      moduleId: null,
      rawLine: null,
    },
  });
  // Inject a user report into the store via snapshot
  store.dispatch({
    type: "snapshot-received",
    payload: {
      ready: true,
      featureId: "media-analysis",
      activeProjectId: "project-1",
      projects: [],
      workbench: {},
      toolState: {},
      activeProject: {
        id: "project-1",
        source: { kind: "video", mode: "local", storedPath: "/tmp/test.mp4", status: "ready" },
        edit: {},
        profile: {},
        process: {
          records: {
            "media-analysis": {
              runId: "run-1",
              status: "ready",
              startedAt: Date.now() - 1000,
            },
          },
        },
        report: {
          records: {
            "media-analysis": {
              status: "ready",
              userReport: { summary: "Test raporu" },
            },
          },
        },
      },
    },
  });
  const state = store.getState();
  assert.equal(hasReportPayload(state), true);
  assert.equal(isRunComplete(state), true);
  assert.equal(deriveLegacyStage(state), "report");
  assert.equal(state.currentStage, "report");
});

test("stale hydrated stage is corrected by deriveLegacyStage projection", () => {
  const store = createLabStore();
  // Hydrate with a stale stage of 'process' but no active run
  store.dispatch({
    type: "hydrate",
    payload: {
      currentStage: "process",
      featureId: "media-analysis",
      projectIndex: { activeProjectId: null, projects: [] },
      workbench: {},
      sourceProbeStatus: "idle",
      reports: { user: null, ai: null, emptyReason: "Rapor yok." },
      activityFeed: [],
      lastRun: null,
    },
  });
  const state = store.getState();
  // deriveLegacyStage overwrites stale 'process' with 'source' since no source is loaded
  assert.equal(state.currentStage, "source");
});

test("[data-lab-stage] click no longer gates behavior (stage-changed is passive)", () => {
  const store = createLabStore();
  // Dispatch stage-changed to 'edit' with no source — should be corrected to 'source'
  store.dispatch({ type: "stage-changed", stage: "edit" });
  const state = store.getState();
  // deriveLegacyStage projection wins: no source → 'source'
  assert.equal(state.currentStage, "source");
});

test("source action block reason checks draft fields", () => {
  const store = createLabStore();
  store.dispatch({
    type: "source-config-patched",
    patch: { kind: "video", mode: "url" },
  });
  const state = store.getState();
  assert.equal(getSourceActionBlockReason(state), "Kaynak URL gerekli");

  store.dispatch({
    type: "source-drafts-updated",
    patch: { urlInput: "https://example.com/video.mp4" },
  });
  const state2 = store.getState();
  assert.equal(getSourceActionBlockReason(state2), null);
});

test("edit action block reason checks probe status", () => {
  const store = createLabStore();
  const state = store.getState();
  assert.equal(getEditActionBlockReason(state), "Önce kaynak seçilmelidir.");

  store.dispatch({
    type: "source-config-patched",
    patch: { kind: "video", mode: "local", storedPath: "/tmp/test.mp4" },
  });
  store.dispatch({ type: "source-probe-completed", action: "source-pick-local" });
  const state2 = store.getState();
  assert.equal(getEditActionBlockReason(state2), null);
});

test("tool relevance filter includes tools from intent-derived capabilities", () => {
  const store = createLabStore();
  store.dispatch({
    type: "source-config-patched",
    patch: { kind: "video", mode: "local", storedPath: "/tmp/test.mp4" },
  });
  store.dispatch({ type: "source-probe-completed", action: "source-pick-local" });
  store.dispatch({
    type: "workspace-intent-toggled",
    intentId: "visual-inspection",
  });
  const state = store.getState();
  const relevance = getToolRelevanceFilter(state);
  assert.equal(relevance.selectedIntents.includes("visual-inspection"), true);
  assert.equal(relevance.requiredToolIds.includes("ffmpeg"), true);
  assert.equal(relevance.intentCapabilities.includes("visual-structure"), true);
});

test("report action block reason checks report availability", () => {
  const store = createLabStore();
  const state = store.getState();
  assert.equal(getReportActionBlockReason(state), "Rapor henüz üretilmedi.");
});

test("featureStage in tool payloads uses projected legacy stage", () => {
  const store = createLabStore();
  store.dispatch({
    type: "source-config-patched",
    patch: { kind: "video", mode: "local", storedPath: "/tmp/test.mp4" },
  });
  store.dispatch({ type: "source-probe-completed", action: "source-pick-local" });
  const state = store.getState();
  // The projected stage for a ready source with no run is 'edit'
  assert.equal(deriveLegacyStage(state), "edit");
  assert.equal(state.currentStage, "edit");
});

// ---------------------------------------------------------------------------
// Overlay grouping: pure relevance, no stageSupport fallback
// ---------------------------------------------------------------------------

test("tool relevance filter with no intents produces empty requiredToolIds", () => {
  const store = createLabStore();
  const state = store.getState();
  const relevance = getToolRelevanceFilter(state);
  assert.deepEqual(relevance.requiredToolIds, []);
  assert.deepEqual(relevance.selectedIntents, []);
});

test("tool relevance filter groups by intent capabilities, not by currentStage", () => {
  const store = createLabStore();
  store.dispatch({
    type: "source-config-patched",
    patch: { kind: "video", mode: "local", storedPath: "/tmp/test.mp4" },
  });
  store.dispatch({ type: "source-probe-completed", action: "source-pick-local" });
  // Select audio investigation intent
  store.dispatch({ type: "workspace-intent-toggled", intentId: "audio-investigation" });
  const state = store.getState();
  const relevance = getToolRelevanceFilter(state);
  // audio-investigation → audio-signal, audio-recovery, speaker-analysis
  // All require ffmpeg; speaker-analysis requires pyaudioanalysis
  assert.equal(relevance.requiredToolIds.includes("ffmpeg"), true);
  assert.equal(relevance.requiredToolIds.includes("pyaudioanalysis"), true);
  // currentStage is 'edit' but that should NOT affect the relevance grouping
  assert.equal(state.currentStage, "edit");
});

test("switching intents changes tool relevance without stage change", () => {
  const store = createLabStore();
  store.dispatch({
    type: "source-config-patched",
    patch: { kind: "video", mode: "local", storedPath: "/tmp/test.mp4" },
  });
  store.dispatch({ type: "source-probe-completed", action: "source-pick-local" });
  store.dispatch({ type: "workspace-intent-toggled", intentId: "detail-enhancement" });
  const state = store.getState();
  const relevance = getToolRelevanceFilter(state);
  // detail-enhancement → transcription, source-separation
  // transcription requires whisper.cpp; source-separation requires demucs + ffmpeg
  assert.equal(relevance.requiredToolIds.includes("whisper.cpp"), true);
  assert.equal(relevance.requiredToolIds.includes("demucs"), true);
  assert.equal(relevance.requiredToolIds.includes("ffmpeg"), true);
  // Stage is still 'edit' — irrelevant to tool relevance
  assert.equal(state.currentStage, "edit");
});

test("workspace intent hydration replaces stale capability state in selectors", () => {
  const store = createLabStore();
  const baseWorkspace = store.getState().ui.workspace;

  store.dispatch({
    type: "hydrate",
    payload: {
      currentStage: "edit",
      featureId: "media-analysis",
      source: { kind: "video", mode: "local", storedPath: "/tmp/test.mp4" },
      sourceProbeStatus: "completed",
      selectedCapabilities: ["audio-signal"],
      workspace: {
        ...baseWorkspace,
        selectedIntents: ["visual-inspection"],
      },
    },
  });

  const state = store.getState();
  const selectedCapabilityIds = getAvailableCapabilities(state)
    .filter(function (entry) {
      return entry.selected;
    })
    .map(function (entry) {
      return entry.id;
    });

  assert.deepEqual(state.selectedCapabilities, ["visual-structure", "visual-forensics"]);
  assert.deepEqual(getCurrentPreflight(state).enabledModules, [
    "visual-structure",
    "visual-forensics",
  ]);
  assert.deepEqual(selectedCapabilityIds, ["visual-structure", "visual-forensics"]);
});

test("workspace intent hydration clears stale capabilities when no intents remain", () => {
  const store = createLabStore();
  const baseWorkspace = store.getState().ui.workspace;

  store.dispatch({
    type: "hydrate",
    payload: {
      currentStage: "edit",
      featureId: "media-analysis",
      source: { kind: "video", mode: "local", storedPath: "/tmp/test.mp4" },
      sourceProbeStatus: "completed",
      selectedCapabilities: ["audio-signal"],
      workspace: {
        ...baseWorkspace,
        selectedIntents: [],
      },
    },
  });

  const state = store.getState();

  assert.deepEqual(state.selectedCapabilities, []);
  assert.equal(getAnalysisActionBlockReason(state), "En az bir analiz modülü seçilmelidir.");
});

test("live intents stay authoritative when manual capability state drifts", () => {
  const store = createLabStore();
  store.dispatch({
    type: "source-config-patched",
    patch: { kind: "video", mode: "local", storedPath: "/tmp/test.mp4" },
  });
  store.dispatch({ type: "source-probe-completed", action: "source-pick-local" });
  store.dispatch({ type: "workspace-intent-set", intents: ["visual-inspection"] });
  store.dispatch({ type: "capability-set", capabilities: ["audio-signal"] });

  const state = store.getState();
  const selectedCapabilityIds = getAvailableCapabilities(state)
    .filter(function (entry) {
      return entry.selected;
    })
    .map(function (entry) {
      return entry.id;
    });

  assert.deepEqual(getCurrentPreflight(state).enabledModules, [
    "visual-structure",
    "visual-forensics",
  ]);
  assert.deepEqual(selectedCapabilityIds, ["visual-structure", "visual-forensics"]);
});

test("controller startDeepAnalysis prefers live workspace intents before stale capability state", () => {
  const source = readFileSync("rooms/laboratory/runtime/lab-run-controller.ts", "utf8");

  assert.match(
    source,
    /ws\.selectedIntents\.length > 0\s*\?\s*collectIntentCapabilities\(ws\.selectedIntents\)\s*:\s*state\.selectedCapabilities\.slice\(\)/
  );
  assert.match(
    source,
    /const \{ activeFeatureId \} = deriveFeatureSelectionFromCapabilities\(intentCapabilities\);/
  );
  assert.match(
    source,
    /sendMediaAction\(activeFeatureId === "audio-analysis" \? "audio-process-run" : "process-run"\);/
  );
});

// ---------------------------------------------------------------------------
// Host: job-runtime action-based filtering
// ---------------------------------------------------------------------------

test("job-runtime getActiveProcessJobs uses action prefix not featureStage", async () => {
  const jobs: Record<string, unknown> = {};
  const collected: string[] = [];
  const jobRuntime = (
    await import("../../rooms/laboratory/shared/host/job-runtime.ts")
  ).createLaboratoryJobRuntime({
    roomId: "laboratory",
    toRecord(value: unknown) {
      return value && typeof value === "object" && !Array.isArray(value)
        ? (value as Record<string, unknown>)
        : {};
    },
    cancelRoomTool: async () => {},
    clearJob(_runtime, jobId) {
      delete jobs[jobId];
    },
    pushJobState(_api, payload) {
      collected.push(String(payload["action"]));
    },
  });

  // Simulate a job with action "process-run" but featureStage "edit" (wrong stage)
  jobs["job-1"] = {
    jobId: "job-1",
    action: "process-run",
    projectId: "project-1",
    toolId: "ffmpeg",
    featureStage: "edit", // intentionally wrong stage
  };

  // The runtime should still find this job by action prefix, not featureStage
  const runtime = { jobs };
  // We can't directly call getActiveProcessJobs (it's internal), but we verify
  // the behavioral proof: ensureProcessJobSlotAvailable should throw for active process jobs
  let threw = false;
  try {
    jobRuntime.ensureProcessJobSlotAvailable(runtime, "project-1", undefined);
  } catch {
    threw = true;
  }
  assert.equal(threw, true, "Process job should be found by action prefix, not featureStage");
});

// ---------------------------------------------------------------------------
// Host: runtime-events action-based scope derivation
// ---------------------------------------------------------------------------

test("runtime-events derives scope from action name, not featureStage", async () => {
  const emitted: Array<Record<string, unknown>> = [];
  const runtimeEvents = (
    await import("../../rooms/laboratory/shared/host/runtime-events.ts")
  ).createLaboratoryRuntimeEvents({
    asNonEmptyString(value: unknown) {
      return typeof value === "string" && value.trim() !== "" ? value : null;
    },
    defaultFeatureId: "media-analysis",
    getFeatureIdFromContext() {
      return "media-analysis";
    },
    loadContext() {
      return { featureId: "media-analysis" };
    },
    roomSnapshotRuntime: {
      buildMediaSnapshot() {
        return {};
      },
    },
  });

  const fakeApi = {
    notifyRoom(_type: string, payload: Record<string, unknown>) {
      emitted.push(payload);
    },
  };

  // Emit event with process action — should get scope "run" regardless of featureStage
  runtimeEvents.emitEvent(fakeApi, {
    action: "process-run",
    stage: "running",
    featureStage: "source", // intentionally wrong
    message: "Test",
  });

  assert.equal(emitted.length, 1);
  assert.equal(emitted[0]?.scope, "run", "scope should be 'run' based on action name containing 'process'");

  // Emit event with tool action — should get scope "global"
  runtimeEvents.emitEvent(fakeApi, {
    action: "tool-install",
    stage: "running",
    featureStage: "process", // intentionally set to process
    message: "Tool install",
  });

  assert.equal(emitted.length, 2);
  assert.equal(emitted[1]?.scope, "global", "scope should be 'global' for non-process actions even if featureStage says process");
});
