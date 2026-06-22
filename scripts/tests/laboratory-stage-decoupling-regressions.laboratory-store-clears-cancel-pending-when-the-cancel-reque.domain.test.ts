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


describe("laboratory store clears cancel pending when the cancel request fails", () => {
void test("laboratory store clears cancel pending when the cancel request fails", () => {
  const store = createLabStore();
  store.dispatch({ type: "run-started", action: "process-run" });
  store.dispatch({ type: "analysis-cancel-requested", requestId: "cancel-new" });
  assert.equal(store.getState().ui.analysisCancelPending, true);
  assert.equal(store.getState().ui.analysisCancelRequestId, "cancel-new");

  store.dispatch({
    type: "host-event-received",
    event: {
      id: "evt-stale-cancel-failed",
      kind: "request-result",
      severity: "error",
      message: "Analiz iptal edilemedi",
      detail: "cancel failed",
      timestamp: Date.now(),
      source: "host",
      action: "process-cancel",
      requestId: "cancel-old",
      stage: "failed",
      scope: "run",
      moduleId: null,
      rawLine: null,
    },
  });

  assert.equal(store.getState().ui.analysisCancelPending, true);
  assert.equal(store.getState().ui.analysisCancelRequestId, "cancel-new");

  store.dispatch({
    type: "host-event-received",
    event: {
      id: "evt-cancel-failed",
      kind: "request-result",
      severity: "error",
      message: "Analiz iptal edilemedi",
      detail: "cancel failed",
      timestamp: Date.now() + 1,
      source: "host",
      action: "process-cancel",
      requestId: "cancel-new",
      stage: "failed",
      scope: "run",
      moduleId: null,
      rawLine: null,
    },
  });

  assert.equal(store.getState().ui.analysisCancelPending, false);
  assert.equal(store.getState().ui.analysisCancelRequestId, null);
});
void test("laboratory store keeps optimistic running state through stale terminal snapshots", () => {
  const store = createLabStore();
  store.dispatch({ type: "run-started", action: "process-run" });
  const pendingRunId = store.getState().run?.id;

  store.dispatch({
    type: "snapshot-received",
    payload: {
      ready: true,
      featureId: "media-analysis",
      activeProjectId: "project-stale-run",
      projects: [],
      workbench: {},
      activeProject: {
        id: "project-stale-run",
        source: { kind: "video", status: "ready", storedPath: "/tmp/test.mp4" },
        edit: {},
        profile: {},
        process: {
          records: {
            "media-analysis": {
              runId: "previous-run",
              status: "cancelled",
              startedAt: "2026-04-30T23:00:00.000Z",
              completedAt: "2026-04-30T23:00:01.000Z",
            },
          },
        },
        report: { records: {} },
        assets: [],
      },
    },
  });

  assert.equal(store.getState().run?.id, pendingRunId);
  assert.equal(isRunActive(store.getState()), true);
});
void test("laboratory store accepts cancelled snapshots after a cancel request", () => {
  const store = createLabStore();
  store.dispatch({ type: "run-started", action: "process-run" });
  store.dispatch({ type: "analysis-cancel-requested" });

  store.dispatch({
    type: "snapshot-received",
    payload: {
      ready: true,
      featureId: "media-analysis",
      activeProjectId: "project-cancelled-run",
      projects: [],
      workbench: {},
      activeProject: {
        id: "project-cancelled-run",
        source: { kind: "video", status: "ready", storedPath: "/tmp/test.mp4" },
        edit: {},
        profile: {},
        process: {
          records: {
            "media-analysis": {
              runId: "cancelled-run",
              status: "cancelled",
              startedAt: "2026-04-30T23:00:00.000Z",
              completedAt: "2026-04-30T23:00:01.000Z",
            },
          },
        },
        report: { records: {} },
        assets: [],
      },
    },
  });

  assert.equal(store.getState().run?.id, "cancelled-run");
  assert.equal(store.getState().run?.state, "cancelled");
  assert.equal(store.getState().ui.analysisCancelPending, false);
});
void test("laboratory store keeps cancel-pending runs through stale correlated snapshots", () => {
  const store = createLabStore();
  store.dispatch({
    type: "snapshot-received",
    payload: {
      ready: true,
      featureId: "media-analysis",
      activeProjectId: "project-snapshot-cancel",
      projects: [],
      workbench: {},
      activeProject: {
        id: "project-snapshot-cancel",
        source: { kind: "video", status: "ready", storedPath: "/tmp/test.mp4" },
        edit: {},
        profile: {},
        process: { records: {} },
        report: { records: {} },
        assets: [],
      },
    },
  });
  store.dispatch({
    type: "run-started",
    action: "process-run",
    projectId: "project-snapshot-cancel",
    requestId: "req-new",
  });
  const pendingRunId = store.getState().run?.id;
  store.dispatch({ type: "analysis-cancel-requested" });

  store.dispatch({
    type: "snapshot-received",
    payload: {
      ready: true,
      featureId: "media-analysis",
      activeProjectId: "project-snapshot-cancel",
      projects: [],
      workbench: {},
      activeProject: {
        id: "project-snapshot-cancel",
        source: { kind: "video", status: "ready", storedPath: "/tmp/test.mp4" },
        edit: {},
        profile: {},
        process: {
          records: {
            "media-analysis": {
              runId: "old-cancelled-run",
              status: "cancelled",
              requestId: "req-old",
              projectId: "project-snapshot-cancel",
              startedAt: "2026-04-30T23:00:00.000Z",
              completedAt: "2026-04-30T23:00:01.000Z",
            },
          },
        },
        report: { records: {} },
        assets: [],
      },
    },
  });

  assert.equal(store.getState().run?.id, pendingRunId);
  assert.equal(store.getState().run?.state, "running");
  assert.equal(store.getState().ui.analysisCancelPending, true);

  store.dispatch({
    type: "snapshot-received",
    payload: {
      ready: true,
      featureId: "media-analysis",
      activeProjectId: "project-snapshot-cancel",
      projects: [],
      workbench: {},
      activeProject: {
        id: "project-snapshot-cancel",
        source: { kind: "video", status: "ready", storedPath: "/tmp/test.mp4" },
        edit: {},
        profile: {},
        process: {
          records: {
            "media-analysis": {
              runId: "new-cancelled-run",
              status: "cancelled",
              requestId: "req-new",
              projectId: "project-snapshot-cancel",
              startedAt: "2026-04-30T23:00:00.000Z",
              completedAt: "2026-04-30T23:00:01.000Z",
            },
          },
        },
        report: { records: {} },
        assets: [],
      },
    },
  });

  assert.equal(store.getState().run?.id, "new-cancelled-run");
  assert.equal(store.getState().run?.state, "cancelled");
  assert.equal(store.getState().ui.analysisCancelPending, false);
});
});
