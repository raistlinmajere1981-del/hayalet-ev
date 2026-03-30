import assert from "node:assert/strict";
import test from "node:test";

import {
  buildScenarioCompletionMessage,
  buildScenarioProgressSummary,
  buildScenarioStatusCounts,
  filterScenarioDisplayRows,
  getScenarioCommandLabel,
  resolveProviderTestSurface,
  resolveScenarioSurface,
} from "../../src/js/pages/shared/provider-test-presentation.ts";

test("provider test surface uses opposite slot overlay for entrance slots", () => {
  assert.deepEqual(resolveScenarioSurface("ai1"), {
    kind: "overlay",
    hostSlot: "ai2",
    testedSlot: "ai1",
  });

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

test("progress summary counts finished commands and exposes the active command id", () => {
  const summary = buildScenarioProgressSummary({
    slot: "ai2",
    providerName: "Grok",
    scenarioTitle: "webview-sync",
    commands: [
      { id: "collect-urls", name: "Collect Urls", status: "pass" },
      { id: "navigate-session-1", name: "Navigate Session 1", status: "running" },
      { id: "sync-session-1", name: "Sync Session 1", status: "pass" },
    ],
  });

  assert.deepEqual(summary, {
    title: "Grok webview-sync çalışıyor",
    completedSteps: 2,
    totalSteps: 3,
    activeStepId: "navigate-session-1",
    hasFailures: false,
  });
});

test("progress summary honors explicit total step counts while commands stream in", () => {
  const summary = buildScenarioProgressSummary({
    slot: "ai1",
    providerName: "ChatGPT",
    scenarioTitle: "webview-test",
    totalSteps: 18,
    commands: [
      { id: "reset-default-page", name: "Reset Default Page", status: "pass" },
      { id: "sidebar-open", name: "Sidebar Open", status: "running" },
    ],
  });

  assert.deepEqual(summary, {
    title: "ChatGPT webview-test çalışıyor",
    completedSteps: 1,
    totalSteps: 18,
    activeStepId: "sidebar-open",
    hasFailures: false,
  });
});

test("status counts are derived from command reports", () => {
  const counts = buildScenarioStatusCounts({
    commands: [
      { id: "collect", name: "Collect", status: "pass" },
      { id: "soft-sync-1", name: "Soft Sync 1", status: "pass" },
      { id: "soft-sync-2", name: "Soft Sync 2", status: "warning" },
      { id: "navigate", name: "Navigate", status: "fail" },
      { id: "refresh", name: "Refresh", status: "skip" },
    ],
  });

  assert.deepEqual(counts, {
    all: 5,
    pass: 2,
    fail: 1,
    warning: 1,
    skip: 1,
  });
});

test("display rows can be filtered by status from command reports", () => {
  const rows = filterScenarioDisplayRows({
    filter: "warning",
    commands: [
      {
        id: "collect-urls",
        name: "Collect Urls",
        status: "pass",
        message: "collected",
      },
      {
        id: "attach-file",
        name: "Attach File",
        status: "warning",
        message: "partial",
      },
    ],
  });

  assert.deepEqual(rows, [
    {
      id: "attach-file",
      name: getScenarioCommandLabel("attach-file", "Attach File"),
      status: "warning",
      message: "partial",
    },
  ]);
});

test("display rows preserve structured session preview details for sync commands", () => {
  const rows = filterScenarioDisplayRows({
    filter: "all",
    commands: [
      {
        id: "collect-session-urls",
        name: "Collect Session Urls",
        status: "pass",
        message: "Collected 2 visible sessions",
        details: {
          sessionPreview: {
            total: 2,
            sessions: [
              { title: "First chat", url: "https://chatgpt.com/c/abc" },
              { title: "Second chat", url: "https://chatgpt.com/c/def" },
            ],
          },
        },
      },
    ],
  });

  assert.deepEqual(rows, [
    {
      id: "collect-session-urls",
      name: getScenarioCommandLabel("collect-session-urls", "Collect Session Urls"),
      status: "pass",
      message: "Collected 2 visible sessions",
      sessionPreview: {
        total: 2,
        sessions: [
          { title: "First chat", url: "https://chatgpt.com/c/abc" },
          { title: "Second chat", url: "https://chatgpt.com/c/def" },
        ],
      },
    },
  ]);
});

test("display rows include running commands while a scenario is active", () => {
  const rows = filterScenarioDisplayRows({
    filter: "all",
    commands: [
      {
        id: "navigate-session-1",
        name: "Navigate Session 1",
        status: "running",
        message: "Navigate Session 1",
      },
    ],
  });

  assert.deepEqual(rows, [
    {
      id: "navigate-session-1",
      name: "Navigate Session 1",
      status: "running",
      message: "Navigate Session 1",
    },
  ]);
});

test("completion message falls back to command counts when suite totals are missing", () => {
  const message = buildScenarioCompletionMessage({
    commands: [
      { status: "pass" },
      { status: "pass" },
      { status: "fail" },
    ],
  });

  assert.equal(message, "2/3 kontrol geçti");
});

test("completion message avoids undefined totals when there are no commands", () => {
  const message = buildScenarioCompletionMessage({});

  assert.equal(message, "Senaryo tamamlandı");
});
