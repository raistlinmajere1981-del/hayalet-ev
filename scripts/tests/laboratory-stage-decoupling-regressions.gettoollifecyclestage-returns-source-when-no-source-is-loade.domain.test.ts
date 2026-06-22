import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createLabStore } from "../../rooms/laboratory/runtime/lab-store.ts";
import {
  getToolLifecycleStage,
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


describe("getToolLifecycleStage returns 'source' when no source is loaded", () => {
void test("getToolLifecycleStage returns 'source' when no source is loaded", () => {
  const store = createLabStore();
  const state = store.getState();
  assert.equal(getToolLifecycleStage(state), "source");
});
void test("getToolLifecycleStage returns 'edit' when source probe is completed", () => {
  const store = createLabStore();
  store.dispatch({
    type: "source-config-patched",
    patch: { kind: "video", mode: "local", storedPath: "/tmp/test.mp4" },
  });
  store.dispatch({ type: "source-probe-completed", action: "source-pick-local" });
  const state = store.getState();
  assert.equal(getToolLifecycleStage(state), "edit");
});
void test("getToolLifecycleStage returns 'process' when a run is active", () => {
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
  assert.equal(getToolLifecycleStage(state), "process");
  assert.equal(isRunActive(state), true);
});
void test("laboratory store keeps process runs active while individual modules finish", () => {
  const store = createLabStore();
  const timestamp = Date.now();

  store.dispatch({
    type: "host-event-received",
    event: {
      id: "evt-audio-run",
      kind: "activity",
      severity: "info",
      message: "Audio analysis started",
      detail: null,
      timestamp,
      source: "host",
      action: "audio-process-run",
      stage: "running",
      scope: "run",
      moduleId: null,
      rawLine: null,
    },
  });
  store.dispatch({
    type: "host-event-received",
    event: {
      id: "evt-audio-module-complete",
      kind: "module-progress",
      severity: "info",
      message: "signal-health completed",
      detail: null,
      timestamp: timestamp + 1,
      source: "host",
      action: "audio-process-run",
      stage: "completed",
      scope: "run",
      moduleId: "signal-health",
      rawLine: null,
    },
  });

  assert.equal(store.getState().run?.state, "running");
  assert.equal(store.getState().run?.modules["signal-health"]?.status, "completed");
  assert.equal(isRunActive(store.getState()), true);
  assert.equal(isRunComplete(store.getState()), false);

  store.dispatch({
    type: "host-event-received",
    event: {
      id: "evt-audio-run-complete",
      kind: "activity",
      severity: "success",
      message: "Audio analysis completed",
      detail: null,
      timestamp: timestamp + 2,
      source: "host",
      action: "audio-process-run",
      stage: "completed",
      scope: "run",
      moduleId: null,
      rawLine: null,
    },
  });

  assert.equal(isRunActive(store.getState()), false);
  assert.equal(isRunComplete(store.getState()), true);
});
});
