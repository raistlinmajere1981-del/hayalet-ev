import assert from "node:assert/strict";
import test from "node:test";

import {
  normalizeControl,
  shouldStartGhost,
  toGhostRunningControl,
  toGhostOnlyStartControl,
  toPostGhostControl,
  shouldReopenMainAfterGhost,
  formatWrapperEvent,
  buildMainAppLaunchArgs,
  toMainRunningControl,
} from "../lib/ghost-wrapper-runtime.mjs";

test("normalizeControl fills defaults and validates enum fields", () => {
  const control = normalizeControl(
    {
      workflowSessionId: 42,
      desiredMode: "invalid",
      phase: "unknown",
      updatedAt: 123,
    },
    "2026-03-01T10:00:00.000Z"
  );

  assert.equal(control.workflowSessionId, "");
  assert.equal(control.desiredMode, "soft");
  assert.equal(control.phase, "idle");
  assert.equal(control.updatedAt, "2026-03-01T10:00:00.000Z");
});

test("shouldStartGhost only returns true for ghost handoff phases", () => {
  assert.equal(
    shouldStartGhost({
      workflowSessionId: "wf-1",
      desiredMode: "ghost-agent",
      phase: "preparing-handoff",
      updatedAt: "2026-03-01T10:00:00.000Z",
    }),
    true
  );

  assert.equal(
    shouldStartGhost({
      workflowSessionId: "wf-1",
      desiredMode: "ghost-agent",
      phase: "in-ghost",
      updatedAt: "2026-03-01T10:00:00.000Z",
    }),
    true
  );

  assert.equal(
    shouldStartGhost({
      workflowSessionId: "wf-1",
      desiredMode: "soft",
      phase: "preparing-handoff",
      updatedAt: "2026-03-01T10:00:00.000Z",
    }),
    false
  );
});

test("toGhostRunningControl updates phase only", () => {
  const result = toGhostRunningControl(
    {
      workflowSessionId: "wf-2",
      desiredMode: "ghost-agent",
      phase: "preparing-handoff",
      updatedAt: "old",
    },
    "2026-03-01T10:01:00.000Z"
  );

  assert.equal(result.workflowSessionId, "wf-2");
  assert.equal(result.desiredMode, "ghost-agent");
  assert.equal(result.phase, "in-ghost");
  assert.equal(result.updatedAt, "2026-03-01T10:01:00.000Z");
});

test("toPostGhostControl resets ghost mode to soft idle", () => {
  const result = toPostGhostControl(
    {
      workflowSessionId: "wf-3",
      desiredMode: "ghost-agent",
      phase: "in-ghost",
      updatedAt: "old",
    },
    "2026-03-01T10:02:00.000Z"
  );

  assert.equal(result.desiredMode, "soft");
  assert.equal(result.phase, "idle");
  assert.equal(result.updatedAt, "2026-03-01T10:02:00.000Z");
});

test("shouldReopenMainAfterGhost stops wrapper cycle for terminal mode", () => {
  assert.equal(
    shouldReopenMainAfterGhost({
      workflowSessionId: "wf-stop",
      desiredMode: "terminal",
      phase: "idle",
      updatedAt: "2026-03-01T10:02:00.000Z",
    }),
    false
  );

  assert.equal(
    shouldReopenMainAfterGhost({
      workflowSessionId: "wf-return",
      desiredMode: "soft",
      phase: "idle",
      updatedAt: "2026-03-01T10:02:00.000Z",
    }),
    true
  );
});

test("formatWrapperEvent creates timestamped log line", () => {
  const line = formatWrapperEvent(
    "wrapper.start",
    {
      desiredMode: "ghost-agent",
      phase: "preparing-handoff",
    },
    "2026-03-01T10:03:00.000Z"
  );

  assert.match(line, /^\[2026-03-01T10:03:00.000Z\] wrapper\.start /);
  assert.match(line, /desiredMode=ghost-agent/);
  assert.match(line, /phase=preparing-handoff/);
});

test("toGhostOnlyStartControl sets ghost-agent mode and in-ghost phase", () => {
  const result = toGhostOnlyStartControl(
    {
      workflowSessionId: "wf-go",
      desiredMode: "soft",
      phase: "idle",
      updatedAt: "old",
    },
    "2026-03-02T10:00:00.000Z"
  );

  assert.equal(result.workflowSessionId, "wf-go");
  assert.equal(result.desiredMode, "ghost-agent");
  assert.equal(result.phase, "in-ghost");
  assert.equal(result.updatedAt, "2026-03-02T10:00:00.000Z");
});

test("toPostGhostControl after ghost-only: close button sets terminal idle (wrapper stops)", () => {
  // Ghost-only: ghost kapandıktan sonra ghost exit action 'close' → terminal+idle yazıldı
  const result = toPostGhostControl(
    {
      workflowSessionId: "wf-go",
      desiredMode: "terminal",
      phase: "idle",
      updatedAt: "old",
    },
    "2026-03-02T10:01:00.000Z"
  );

  assert.equal(result.desiredMode, "terminal");
  assert.equal(result.phase, "idle");
  assert.equal(shouldReopenMainAfterGhost(result), false);
});

test("toPostGhostControl after ghost-only: return-main button sets soft idle (hayalet-ev reopens)", () => {
  // Ghost-only: ghost exit action 'return-main' → soft+idle yazıldı
  const result = toPostGhostControl(
    {
      workflowSessionId: "wf-go",
      desiredMode: "soft",
      phase: "idle",
      updatedAt: "old",
    },
    "2026-03-02T10:02:00.000Z"
  );

  assert.equal(result.desiredMode, "soft");
  assert.equal(result.phase, "idle");
  assert.equal(shouldReopenMainAfterGhost(result), true);
});

test("toPostGhostControl after ghost-only crash: ghost-agent mode resets to soft (hayalet-ev reopens)", () => {
  // Ghost beklenmedik kapanırsa in-ghost+ghost-agent durumu soft'a döner
  const result = toPostGhostControl(
    {
      workflowSessionId: "wf-go",
      desiredMode: "ghost-agent",
      phase: "in-ghost",
      updatedAt: "old",
    },
    "2026-03-02T10:03:00.000Z"
  );

  assert.equal(result.desiredMode, "soft");
  assert.equal(result.phase, "idle");
  assert.equal(shouldReopenMainAfterGhost(result), true);
});

test("buildMainAppLaunchArgs keeps default launch arguments on normal cycle", () => {
  const args = buildMainAppLaunchArgs("/tmp/main.js", false);

  assert.deepEqual(args, ["/tmp/main.js", "--no-sandbox"]);
});

test("buildMainAppLaunchArgs enables assistant startup flags after ghost return", () => {
  const args = buildMainAppLaunchArgs("/tmp/main.js", true);

  assert.deepEqual(args, [
    "/tmp/main.js",
    "--no-sandbox",
    "--start-page=assistant",
    "--auto-connect",
  ]);
});

test("toMainRunningControl forces soft idle for active main app", () => {
  const result = toMainRunningControl(
    {
      workflowSessionId: "wf-main",
      desiredMode: "terminal",
      phase: "idle",
      updatedAt: "old",
    },
    "2026-03-04T10:40:00.000Z"
  );

  assert.equal(result.workflowSessionId, "wf-main");
  assert.equal(result.desiredMode, "soft");
  assert.equal(result.phase, "idle");
  assert.equal(result.updatedAt, "2026-03-04T10:40:00.000Z");
});
