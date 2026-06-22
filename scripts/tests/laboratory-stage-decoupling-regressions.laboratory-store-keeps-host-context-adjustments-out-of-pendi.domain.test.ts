import test from "node:test";
import assert from "node:assert/strict";
import { createLabStore } from "../../rooms/laboratory/runtime/lab-store.ts";
import { isRunActive } from "../../rooms/laboratory/runtime/lab-selectors.ts";
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


describe("laboratory store keeps host-context adjustments out of pending runs", () => {
void test("laboratory store keeps host-context adjustments out of pending runs", () => {
  const store = createLabStore();
  store.dispatch({
    type: "host-event-received",
    event: {
      id: "evt-host-context-adjustment",
      kind: "interactive-adjustment-applied",
      severity: "info",
      message: "Analysis controls updated",
      detail: "Module controls changed",
      timestamp: Date.now(),
      source: "host",
      action: "host-context",
      stage: "updated",
      scope: "run",
      moduleId: null,
      rawLine: null,
    },
  });

  const state = store.getState();
  assert.equal(state.run, null);
  assert.equal(isRunActive(state), false);
  assert.equal(state.activityFeed[0]?.scope, "global");
});
void test("laboratory store keeps cancel pending until the process run reaches a terminal state", () => {
  const store = createLabStore();
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
  store.dispatch({ type: "analysis-cancel-requested" });
  assert.equal(store.getState().ui.analysisCancelPending, true);

  store.dispatch({
    type: "host-event-received",
    event: {
      id: "evt-cancel-accepted",
      kind: "request-result",
      severity: "success",
      message: "Analiz iptal istegi kabul edildi",
      detail: null,
      timestamp: Date.now() + 1,
      source: "host",
      action: "process-cancel",
      stage: "completed",
      scope: "run",
      moduleId: null,
      rawLine: null,
    },
  });

  assert.equal(store.getState().ui.analysisCancelPending, true);

  store.dispatch({
    type: "host-event-received",
    event: {
      id: "evt-run-cancelled",
      kind: "activity",
      severity: "warning",
      message: "Analiz iptal edildi",
      detail: null,
      timestamp: Date.now() + 2,
      source: "host",
      action: "process-run",
      stage: "cancelled",
      scope: "run",
      moduleId: null,
      rawLine: null,
    },
  });

  assert.equal(store.getState().ui.analysisCancelPending, false);
});
void test("laboratory store ignores stale correlated run events from an older process", () => {
  const store = createLabStore();
  store.dispatch({
    type: "run-started",
    action: "process-run",
    jobId: "job-new",
    projectId: "project-1",
    requestId: "req-new",
  });

  store.dispatch({
    type: "host-event-received",
    event: createProcessRunEvent({
      id: "evt-old-terminal",
      jobId: "job-old",
      projectId: "project-1",
      requestId: "req-old",
      severity: "success",
      stage: "completed",
    }),
  });
  store.dispatch({
    type: "host-event-received",
    event: createProcessRunEvent({
      id: "evt-old-module",
      jobId: "job-old",
      kind: "module-progress",
      moduleId: "stale-module",
      projectId: "project-1",
      requestId: "req-old",
    }),
  });
  store.dispatch({
    type: "host-event-received",
    event: createProcessRunEvent({
      id: "evt-old-finding",
      finding: {
        id: "finding-old",
        title: "Old finding",
      },
      jobId: "job-old",
      kind: "live-finding",
      moduleId: "stale-module",
      projectId: "project-1",
      requestId: "req-old",
    }),
  });
  store.dispatch({
    type: "host-event-received",
    event: createProcessRunEvent({
      id: "evt-old-custom-warning",
      action: "module-custom",
      detail: "stale warning",
      jobId: "job-old",
      kind: "module-warning",
      moduleId: "stale-module",
      projectId: "project-1",
      requestId: "req-old",
    }),
  });

  const state = store.getState();
  assert.equal(state.run?.state, "running");
  assert.equal(state.run.requestId, "req-new");
  assert.equal(state.run.jobId, "job-new");
  assert.equal(state.run.modules["stale-module"], undefined);
  assert.equal(state.run.liveFindings.length, 0);
  assert.deepEqual(state.run.warnings, []);
  assert.equal(
    state.run.events.some(function (entry) {
      return (
        entry.id === "evt-old-terminal" ||
        entry.id === "evt-old-module" ||
        entry.id === "evt-old-custom-warning"
      );
    }),
    false
  );
});
void test("laboratory store clears cancel pending only for matching correlated run terminal events", () => {
  const store = createLabStore();
  store.dispatch({
    type: "run-started",
    action: "process-run",
    projectId: "project-1",
    requestId: "req-new",
  });
  store.dispatch({ type: "analysis-cancel-requested" });

  store.dispatch({
    type: "host-event-received",
    event: createProcessRunEvent({
      id: "evt-old-run-cancelled",
      projectId: "project-1",
      requestId: "req-old",
      severity: "warning",
      stage: "cancelled",
    }),
  });

  assert.equal(store.getState().run?.state, "running");
  assert.equal(store.getState().ui.analysisCancelPending, true);

  store.dispatch({
    type: "host-event-received",
    event: createProcessRunEvent({
      id: "evt-new-run-cancelled",
      projectId: "project-1",
      requestId: "req-new",
      severity: "warning",
      stage: "cancelled",
    }),
  });

  assert.equal(store.getState().run?.state, "cancelled");
  assert.equal(store.getState().ui.analysisCancelPending, false);
});
});
