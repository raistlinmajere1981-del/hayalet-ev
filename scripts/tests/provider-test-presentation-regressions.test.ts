import assert from "node:assert/strict";
import test from "node:test";

import {
  buildScenarioProgressSummary,
  buildScenarioStatusCounts,
  filterScenarioDisplayRows,
  resolveProviderTestSurface,
} from "../../src/js/pages/shared/provider-test-presentation.ts";

test("provider test surface uses opposite slot overlay for entrance slots", () => {
  assert.deepEqual(resolveProviderTestSurface("ai1"), {
    kind: "overlay",
    hostSlot: "ai2",
    testedSlot: "ai1",
  });

  assert.deepEqual(resolveProviderTestSurface("ai2"), {
    kind: "overlay",
    hostSlot: "ai1",
    testedSlot: "ai2",
  });
});

test("provider test surface uses side panel for ai0", () => {
  assert.deepEqual(resolveProviderTestSurface("ai0"), {
    kind: "side-panel",
    hostSlot: "ai0",
    testedSlot: "ai0",
  });
});

test("progress summary counts finished steps and exposes current title", () => {
  const summary = buildScenarioProgressSummary({
    slot: "ai2",
    providerName: "Grok",
    steps: [
      { id: "reset-default-page", name: "Reset", status: "pass" },
      { id: "disabled-send", name: "Disabled Send", status: "running" },
      { id: "final-bubbles", name: "Bubbles", status: "pending" },
    ],
  });

  assert.deepEqual(summary, {
    title: "Grok testi calisiyor",
    completedSteps: 1,
    totalSteps: 3,
    activeStepId: "disabled-send",
    hasFailures: false,
  });
});

test("status counts prefer completed suite totals when available", () => {
  const counts = buildScenarioStatusCounts({
    steps: [
      { id: "reset", name: "Reset", status: "pass" },
      { id: "attach", name: "Attach", status: "warning" },
    ],
    suite: {
      providerId: "chatgpt",
      providerName: "ChatGPT",
      slot: "ai1",
      url: "https://chatgpt.com",
      timestamp: 0,
      totalTests: 20,
      passed: 16,
      failed: 1,
      skipped: 1,
      warnings: 2,
      totalDuration: 1000,
      results: [],
    },
  });

  assert.deepEqual(counts, {
    all: 20,
    pass: 16,
    fail: 1,
    warning: 2,
    skip: 1,
  });
});

test("display rows can be filtered by status from completed suite results", () => {
  const rows = filterScenarioDisplayRows({
    filter: "warning",
    steps: [
      { id: "step-pass", name: "Step Pass", status: "pass", message: "step pass" },
      { id: "step-warning", name: "Step Warning", status: "warning", message: "step warning" },
    ],
    suite: {
      providerId: "chatgpt",
      providerName: "ChatGPT",
      slot: "ai2",
      url: "https://chatgpt.com",
      timestamp: 0,
      totalTests: 3,
      passed: 1,
      failed: 1,
      skipped: 0,
      warnings: 1,
      totalDuration: 1000,
      results: [
        {
          id: "pass-1",
          name: "Default Page Navigation",
          category: "preflight",
          status: "pass",
          message: "ok",
          duration: 10,
          timestamp: 0,
        },
        {
          id: "warning-1",
          name: "Drag And Drop Surface",
          category: "dom",
          status: "warning",
          message: "partial",
          duration: 20,
          timestamp: 0,
        },
      ],
    },
  });

  assert.deepEqual(rows, [
    {
      id: "warning-1",
      name: "Drag And Drop Surface",
      status: "warning",
      message: "partial",
    },
  ]);
});
