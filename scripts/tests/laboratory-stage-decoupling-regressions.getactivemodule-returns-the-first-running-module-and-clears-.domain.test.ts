import test from "node:test";
import assert from "node:assert/strict";
import { createLabStore } from "../../rooms/laboratory/runtime/lab-store.ts";
import { getToolLifecycleStage, getActiveModule, getSourceActionBlockReason, getEditActionBlockReason, hasReportPayload, isRunComplete } from "../../rooms/laboratory/runtime/lab-selectors.ts";
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


describe("getActiveModule returns the first running module and clears when none are runnin", () => {
void test("getActiveModule returns the first running module and clears when none are running", () => {
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
void test("getToolLifecycleStage returns 'report' when run is complete and reports exist", () => {
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
  assert.equal(getToolLifecycleStage(state), "report");
});
void test("source action block reason checks draft fields", () => {
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
void test("edit action block reason checks probe status", () => {
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
});
