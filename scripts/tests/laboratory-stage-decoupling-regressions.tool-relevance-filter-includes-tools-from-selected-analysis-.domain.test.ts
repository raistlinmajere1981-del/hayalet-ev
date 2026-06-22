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


describe("tool relevance filter includes tools from selected analysis capabilities", () => {
void test("tool relevance filter includes tools from selected analysis capabilities", () => {
  const store = createLabStore();
  store.dispatch({
    type: "source-config-patched",
    patch: { kind: "video", mode: "local", storedPath: "/tmp/test.mp4" },
  });
  store.dispatch({ type: "source-probe-completed", action: "source-pick-local" });
  store.dispatch({ type: "capability-set", capabilities: ["visual-structure", "visual-forensics"] });
  const state = store.getState();
  const relevance = getToolRelevanceFilter(state);
  assert.equal(relevance.selectedCapabilities.includes("visual-structure"), true);
  assert.equal(relevance.selectedCapabilities.includes("visual-forensics"), true);
  assert.equal(relevance.requiredToolIds.includes("ffmpeg"), true);
  assert.equal(relevance.optionalToolIds.includes("visual-forensics-py"), true);
  assert.equal(relevance.optionalToolIds.includes("exiftool"), true);
  assert.equal(relevance.optionalToolIds.includes("mediainfo"), true);
  assert.equal(relevance.optionalToolIds.includes("ffmpeg-libvmaf"), true);
  assert.equal(relevance.optionalToolIds.includes("raft-optical-flow"), true);
});
void test("report action block reason checks report availability", () => {
  const store = createLabStore();
  const state = store.getState();
  assert.equal(getReportActionBlockReason(state), "Rapor henüz üretilmedi.");
});
void test("featureStage in tool payloads uses projected lifecycle stage", () => {
  const store = createLabStore();
  store.dispatch({
    type: "source-config-patched",
    patch: { kind: "video", mode: "local", storedPath: "/tmp/test.mp4" },
  });
  store.dispatch({ type: "source-probe-completed", action: "source-pick-local" });
  const state = store.getState();
  assert.equal(getToolLifecycleStage(state), "edit");
});
void test("tool relevance filter with no selected capabilities produces empty requiredToolIds", () => {
  const store = createLabStore();
  const state = store.getState();
  const relevance = getToolRelevanceFilter(state);
  assert.deepEqual(relevance.requiredToolIds, []);
  assert.deepEqual(relevance.optionalToolIds, []);
  assert.deepEqual(relevance.selectedCapabilities, []);
});
});
