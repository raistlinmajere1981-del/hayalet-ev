import test from "node:test";
import assert from "node:assert/strict";

import { createLaboratoryRuntimeEvents } from "../../rooms/laboratory/shared/host/runtime-events.ts";

function asNonEmptyString(value: unknown) {
  return typeof value === "string" && value.trim() !== "" ? value.trim() : null;
}

test("laboratory runtime events throttle high-frequency custom module updates", () => {
  const notifications: Array<{ type: string; payload: Record<string, unknown> }> = [];
  const runtimeEvents = createLaboratoryRuntimeEvents({
    asNonEmptyString,
    defaultFeatureId: "media-analysis",
    getFeatureIdFromContext() {
      return "media-analysis";
    },
    loadContext() {
      return {
        featureId: "media-analysis",
      };
    },
    roomSnapshotRuntime: {
      buildMediaSnapshot() {
        return {};
      },
    },
  });

  const api = {
    notifyRoom(type: string, payload: Record<string, unknown>) {
      notifications.push({ type, payload });
    },
  };

  runtimeEvents.pushJobState(api, {
    kind: "module-progress",
    moduleId: "visual-signal",
    message: "visual-signal module started",
    stage: "running",
    featureStage: "process",
    throttleWindow: "visual-signal-module-batch",
    timestamp: 1000,
  });
  runtimeEvents.pushJobState(api, {
    kind: "module-progress",
    moduleId: "visual-signal",
    message: "visual-signal module update",
    stage: "running",
    featureStage: "process",
    throttleWindow: "visual-signal-module-batch",
    timestamp: 1200,
  });
  runtimeEvents.pushJobState(api, {
    kind: "module-progress",
    moduleId: "visual-signal",
    message: "visual-signal module completed",
    stage: "completed",
    featureStage: "process",
    throttleWindow: "visual-signal-module-batch",
    timestamp: 1700,
  });

  assert.equal(notifications.length, 2);
  assert.equal(notifications[0]?.type, "lab-event");
  assert.equal(notifications[1]?.type, "lab-event");
  assert.equal(notifications[1]?.payload["batchedCount"], 2);
  assert.match(String(notifications[1]?.payload["detail"] || ""), /updates batched/);
});

test("laboratory runtime events preserve correlation metadata for export jobs and request results", () => {
  const notifications: Array<{ type: string; payload: Record<string, unknown> }> = [];
  const runtimeEvents = createLaboratoryRuntimeEvents({
    asNonEmptyString,
    defaultFeatureId: "media-analysis",
    getFeatureIdFromContext() {
      return "media-analysis";
    },
    loadContext() {
      return {
        featureId: "media-analysis",
      };
    },
    roomSnapshotRuntime: {
      buildMediaSnapshot() {
        return {};
      },
    },
  });

  const api = {
    notifyRoom(type: string, payload: Record<string, unknown>) {
      notifications.push({ type, payload });
    },
  };

  runtimeEvents.pushJobState(api, {
    action: "export-frame-grab",
    jobId: "job-export-1",
    projectId: "project-1",
    requestId: "req-export-1",
    resultAssetIds: ["asset-frame-result-1"],
    stage: "completed",
  });
  runtimeEvents.pushActionResult(api, {
    action: "export-frame-grab",
    jobId: "job-export-1",
    projectId: "project-1",
    requestId: "req-export-1",
    success: false,
    error: "frame export failed",
  });

  assert.equal(notifications.length, 2);
  assert.equal(notifications[0]?.payload["requestId"], "req-export-1");
  assert.equal(notifications[0]?.payload["jobId"], "job-export-1");
  assert.equal(notifications[0]?.payload["projectId"], "project-1");
  assert.deepEqual(notifications[0]?.payload["resultAssetIds"], ["asset-frame-result-1"]);
  assert.equal(notifications[1]?.payload["requestId"], "req-export-1");
  assert.equal(notifications[1]?.payload["jobId"], "job-export-1");
  assert.equal(notifications[1]?.payload["projectId"], "project-1");
});

test("laboratory runtime events can publish cancelled process action results", () => {
  const notifications: Array<{ type: string; payload: Record<string, unknown> }> = [];
  const runtimeEvents = createLaboratoryRuntimeEvents({
    asNonEmptyString,
    defaultFeatureId: "media-analysis",
    getFeatureIdFromContext() {
      return "media-analysis";
    },
    loadContext() {
      return {
        featureId: "media-analysis",
      };
    },
    roomSnapshotRuntime: {
      buildMediaSnapshot() {
        return {};
      },
    },
  });

  const api = {
    notifyRoom(type: string, payload: Record<string, unknown>) {
      notifications.push({ type, payload });
    },
  };

  runtimeEvents.pushActionResult(api, {
    action: "process-run",
    requestId: "req-process-run",
    success: false,
    cancelled: true,
  });

  assert.equal(notifications[0]?.payload["stage"], "cancelled");
  assert.equal(notifications[0]?.payload["severity"], "warning");
  assert.equal(notifications[0]?.payload["scope"], "run");
});
