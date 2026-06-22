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


describe("live capability selection stays authoritative after manual capability updates", () => {
void test("live capability selection stays authoritative after manual capability updates", () => {
  const store = createLabStore();
  store.dispatch({
    type: "source-config-patched",
    patch: { kind: "video", mode: "local", storedPath: "/tmp/test.mp4" },
  });
  store.getState().toolState = { tools: { ffmpeg: { installed: true } } };
  store.dispatch({ type: "source-probe-completed", action: "source-pick-local" });
  store.dispatch({ type: "capability-set", capabilities: ["visual-structure", "visual-forensics"] });

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
void test("controller startDeepAnalysis uses ready workspace analysis selection before stale capability state", () => {
  const source = readFileSync("rooms/laboratory/runtime/lab-run-controller.ts", "utf8");

  assert.match(source, /const selectedCapabilities = getReadySelectedAnalysisCapabilityIds\(state\);/);
  assert.match(
    source,
    /updateAnalysisScopeFromWorkspace\(state, scopeChoice\);/
  );
  assert.match(
    source,
    /const \{ activeFeatureId \} = deriveFeatureSelectionFromCapabilities\(selectedCapabilities\);/
  );
  assert.match(
    source,
    /const runAction = activeFeatureId === "audio-analysis" \? "audio-process-run" : "process-run";/
  );
  assert.match(source, /const runRequestId = createActionRequestId\(runAction\);/);
  assert.match(source, /type: "run-started",\s*action: runAction,/);
  assert.match(source, /requestId: runRequestId,/);
  assert.match(
    source,
    /const sentRunRequestId = sendMediaAction\(runAction, runPayload, \{ requestId: runRequestId \}\);/
  );
  assert.match(source, /const runPayload = getProcessRunWorkspacePayload/);
  assert.match(source, /preflightAutoRunEnabled !== false/);
});
void test("job-runtime getActiveProcessJobs uses action prefix not featureStage", async () => {
  const jobs: Record<string, unknown> = {};
  const collected: string[] = [];
  const jobRuntime = (
    await import("../../rooms/laboratory/shared/host/job-runtime.ts")
  ).createLaboratoryJobRuntime({
    roomId: "laboratory",
    toRecord(value: unknown) {
      return value != null && typeof value === "object" && !Array.isArray(value)
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
void test("runtime-events derives scope from action name, not featureStage", async () => {
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
  assert.equal(
    emitted[0]?.["scope"],
    "run",
    "scope should be 'run' based on action name containing 'process'"
  );

  // Emit event with tool action — should get scope "global"
  runtimeEvents.emitEvent(fakeApi, {
    action: "tool-install",
    stage: "running",
    featureStage: "process", // intentionally set to process
    message: "Tool install",
  });

  assert.equal(emitted.length, 2);
  assert.equal(
    emitted[1]?.["scope"],
    "global",
    "scope should be 'global' for non-process actions even if featureStage says process"
  );
});
});
