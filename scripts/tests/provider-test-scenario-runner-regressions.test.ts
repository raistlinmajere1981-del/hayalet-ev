import assert from "node:assert/strict";
import test from "node:test";

import {
  PROVIDER_TEST_PROMPT,
  runProviderTestScenario,
  runScenario,
} from "../../electron/provider-tester/scenario-runner.ts";

test("provider test scenario emits ordered progress events and keeps soft failures non-fatal", async () => {
  const progress: string[] = [];
  const scenarioIds = new Set<string>();
  const executed: string[] = [];

  const result = await runProviderTestScenario({
    runId: "run-soft-pass",
    slot: "ai1",
    providerId: "chatgpt",
    emitProgress: (event) => {
      scenarioIds.add(event.scenarioId);
      progress.push(`${event.type}:${event.stepId ?? "suite"}:${event.status ?? "na"}`);
    },
    steps: [
      {
        id: "reset-default-page",
        name: "Reset Default Page",
        severity: "core",
        run: async () => {
          executed.push("reset-default-page");
          return { status: "pass", message: "default page loaded" };
        },
      },
      {
        id: "attach-file",
        name: "Attach File",
        severity: "soft",
        run: async () => {
          executed.push("attach-file");
          return { status: "warning", message: "attach unsupported" };
        },
      },
      {
        id: "final-bubbles",
        name: "Final Bubbles",
        severity: "core",
        run: async () => {
          executed.push("final-bubbles");
          return { status: "pass", message: "bubbles present" };
        },
      },
    ],
  });

  assert.deepEqual(executed, ["reset-default-page", "attach-file", "final-bubbles"]);
  assert.equal(result.aborted, false);
  assert.equal(result.failed, 0);
  assert.equal(result.warnings, 1);
  assert.equal(result.scenarioId, "webview-test");
  assert.deepEqual([...scenarioIds], ["webview-test"]);
  assert.deepEqual(
    result.steps.map((step) => [step.id, step.status]),
    [
      ["reset-default-page", "pass"],
      ["attach-file", "warning"],
      ["final-bubbles", "pass"],
    ]
  );
  assert.deepEqual(progress, [
    "started:suite:na",
    "step-start:reset-default-page:running",
    "step-complete:reset-default-page:pass",
    "step-start:attach-file:running",
    "step-complete:attach-file:warning",
    "step-start:final-bubbles:running",
    "step-complete:final-bubbles:pass",
    "completed:suite:na",
  ]);
});

test("generic scenario runner emits scenario metadata for non-test scenarios", async () => {
  const progress: string[] = [];

  const result = await runScenario({
    runId: "run-webview-sync",
    scenarioId: "webview-sync",
    slot: "ai2",
    providerId: "grok",
    emitProgress: (event) => {
      progress.push(`${event.scenarioId}:${event.type}:${event.stepId ?? "suite"}`);
    },
    steps: [
      {
        id: "collect-urls",
        name: "Collect Urls",
        severity: "core",
        run: async () => ({ status: "pass", message: "collected" }),
      },
    ],
  });

  assert.equal(result.scenarioId, "webview-sync");
  assert.equal(result.aborted, false);
  assert.deepEqual(progress, [
    "webview-sync:started:suite",
    "webview-sync:step-start:collect-urls",
    "webview-sync:step-complete:collect-urls",
    "webview-sync:completed:suite",
  ]);
});

test("provider test scenario aborts remaining steps after core failure", async () => {
  const executed: string[] = [];

  const result = await runProviderTestScenario({
    runId: "run-core-fail",
    slot: "ai0",
    providerId: "opencode-ui",
    emitProgress: () => {},
    steps: [
      {
        id: "disabled-send",
        name: "Disabled Send",
        severity: "core",
        run: async () => {
          executed.push("disabled-send");
          return { status: "fail", message: "send should be disabled" };
        },
      },
      {
        id: "final-bubbles",
        name: "Final Bubbles",
        severity: "core",
        run: async () => {
          executed.push("final-bubbles");
          return { status: "pass", message: "should not run" };
        },
      },
    ],
  });

  assert.deepEqual(executed, ["disabled-send"]);
  assert.equal(result.aborted, true);
  assert.equal(result.abortReason, "send should be disabled");
  assert.deepEqual(
    result.steps.map((step) => [step.id, step.status]),
    [["disabled-send", "fail"]]
  );
});

test("provider test prompt stays deterministic for scroll and scrape assertions", () => {
  assert.equal(
    PROVIDER_TEST_PROMPT,
    "Sadece 1'den 20'ye kadar numaralari, her satirda bir tane olacak sekilde yaz. Baska hicbir sey ekleme."
  );
});

test("provider test scenario waits between steps when delays are configured", async () => {
  const startedAt: number[] = [];

  await runProviderTestScenario({
    runId: "run-delays",
    slot: "ai2",
    providerId: "grok",
    steps: [
      {
        id: "first",
        name: "First",
        severity: "core",
        delayAfterMs: 35,
        run: async () => {
          startedAt.push(Date.now());
          return { status: "pass", message: "first ok" };
        },
      },
      {
        id: "second",
        name: "Second",
        severity: "core",
        run: async () => {
          startedAt.push(Date.now());
          return { status: "pass", message: "second ok" };
        },
      },
    ],
  });

  assert.equal(startedAt.length, 2);
  assert.ok(
    startedAt[1] - startedAt[0] >= 30,
    `Expected at least 30ms delay between steps, got ${startedAt[1] - startedAt[0]}ms`
  );
});
