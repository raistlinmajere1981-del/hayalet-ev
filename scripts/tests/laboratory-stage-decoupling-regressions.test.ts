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
