import test from "node:test";
import assert from "node:assert/strict";
import { createLabStore } from "../../rooms/laboratory/runtime/lab-store.ts";
import { getToolLifecycleStage, getAnalysisActionBlockReason, getAvailableCapabilities, getCurrentPreflight, getToolRelevanceFilter } from "../../rooms/laboratory/runtime/lab-selectors.ts";
import type { LabEventFeedItem } from "../../rooms/laboratory/domain/lab-types.ts";

function createProcessRunEvent(overrides: Partial<LabEventFeedItem> = {}): LabEventFeedItem {
  return {
    id: "evt-process-run",
    kind: "activity",
    severity: "info",
    message: "Process event",
    detail: null,
    timestamp: Date.now(),
    source: "host",
    action: "process-run",
    stage: "running",
    scope: "run",
    moduleId: null,
    rawLine: null,
    ...overrides,
  };
}


describe("tool relevance filter groups by selected capabilities, not by lifecycle stage", () => {
void test("tool relevance filter groups by selected capabilities, not by lifecycle stage", () => {
  const store = createLabStore();
  store.dispatch({
    type: "source-config-patched",
    patch: { kind: "video", mode: "local", storedPath: "/tmp/test.mp4" },
  });
  store.dispatch({ type: "source-probe-completed", action: "source-pick-local" });
  store.dispatch({
    type: "capability-set",
    capabilities: ["audio-signal", "audio-recovery", "speaker-analysis"],
  });
  const state = store.getState();
  const relevance = getToolRelevanceFilter(state);
  assert.equal(relevance.requiredToolIds.includes("ffmpeg"), true);
  assert.equal(relevance.requiredToolIds.includes("pyaudioanalysis"), true);
  assert.equal(getToolLifecycleStage(state), "edit");
});
void test("switching selected capabilities changes tool relevance without stage change", () => {
  const store = createLabStore();
  store.dispatch({
    type: "source-config-patched",
    patch: { kind: "video", mode: "local", storedPath: "/tmp/test.mp4" },
  });
  store.dispatch({ type: "source-probe-completed", action: "source-pick-local" });
  store.dispatch({
    type: "capability-set",
    capabilities: ["transcription", "source-separation"],
  });
  const state = store.getState();
  const relevance = getToolRelevanceFilter(state);
  assert.equal(relevance.requiredToolIds.includes("transcript-runtime"), true);
  assert.equal(relevance.requiredToolIds.includes("demucs"), true);
  assert.equal(relevance.requiredToolIds.includes("ffmpeg"), true);
  assert.equal(getToolLifecycleStage(state), "edit");
});
void test("workspace hydration keeps selected capability state authoritative", () => {
  const store = createLabStore();
  const baseWorkspace = store.getState().ui.workspace;

  store.dispatch({
    type: "hydrate",
    payload: {
      featureId: "media-analysis",
      source: { kind: "video", mode: "local", storedPath: "/tmp/test.mp4" },
      sourceProbeStatus: "completed",
      toolState: { tools: { ffmpeg: { installed: true } } },
      selectedCapabilities: ["audio-signal"],
      workspace: baseWorkspace,
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

  assert.deepEqual(state.selectedCapabilities, ["audio-signal"]);
  assert.deepEqual(getCurrentPreflight(state).enabledModules, ["audio-signal"]);
  assert.deepEqual(selectedCapabilityIds, ["audio-signal"]);
});
void test("workspace hydration clears selected capabilities when none remain", () => {
  const store = createLabStore();
  const baseWorkspace = store.getState().ui.workspace;

  store.dispatch({
    type: "hydrate",
    payload: {
      featureId: "media-analysis",
      source: { kind: "video", mode: "local", storedPath: "/tmp/test.mp4" },
      sourceProbeStatus: "completed",
      selectedCapabilities: [],
      workspace: baseWorkspace,
    },
  });

  const state = store.getState();

  assert.deepEqual(state.selectedCapabilities, []);
  assert.equal(getAnalysisActionBlockReason(state), "En az bir analiz modülü seçilmelidir.");
});
});
