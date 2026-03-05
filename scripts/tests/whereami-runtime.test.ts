import assert from "node:assert/strict";
import test from "node:test";

import { resolveWhereAmI } from "../lib/whereami-runtime.mjs";

test("returns hayalet-ev when main process is alive in soft idle", () => {
  const result = resolveWhereAmI({
    control: {
      workflowSessionId: "wf-1",
      desiredMode: "soft",
      phase: "idle",
      updatedAt: "2026-03-02T10:00:00.000Z",
    },
    probes: {
      mainProcess: true,
      ghostProcess: false,
      wrapperProcess: true,
    },
    nowIso: "2026-03-02T10:00:10.000Z",
  });

  assert.equal(result.mode, "hayalet-ev");
  assert.equal(result.shouldStop, false);
});

test("returns ghost-agent when ghost process is alive in in-ghost phase", () => {
  const result = resolveWhereAmI({
    control: {
      workflowSessionId: "wf-2",
      desiredMode: "ghost-agent",
      phase: "in-ghost",
      updatedAt: "2026-03-02T10:00:00.000Z",
    },
    probes: {
      mainProcess: false,
      ghostProcess: true,
      wrapperProcess: true,
    },
    nowIso: "2026-03-02T10:00:10.000Z",
  });

  assert.equal(result.mode, "ghost-agent");
  assert.equal(result.shouldStop, false);
});

test("returns terminal when no runtime signal and no app processes", () => {
  const result = resolveWhereAmI({
    control: {
      workflowSessionId: "wf-3",
      desiredMode: "terminal",
      phase: "idle",
      updatedAt: "2026-03-02T10:00:00.000Z",
    },
    probes: {
      mainProcess: false,
      ghostProcess: false,
      wrapperProcess: false,
    },
    nowIso: "2026-03-02T10:00:10.000Z",
  });

  assert.equal(result.mode, "terminal");
  assert.equal(result.shouldStop, false);
});

test("returns transitioning during preparing-handoff", () => {
  const result = resolveWhereAmI({
    control: {
      workflowSessionId: "wf-4",
      desiredMode: "ghost-agent",
      phase: "preparing-handoff",
      updatedAt: "2026-03-02T10:00:00.000Z",
    },
    probes: {
      mainProcess: true,
      ghostProcess: false,
      wrapperProcess: true,
    },
    nowIso: "2026-03-02T10:00:10.000Z",
  });

  assert.equal(result.mode, "transitioning");
  assert.equal(result.shouldStop, false);
});

test("returns conflict and stop signal when runtime and process probes disagree", () => {
  const result = resolveWhereAmI({
    control: {
      workflowSessionId: "wf-5",
      desiredMode: "soft",
      phase: "idle",
      updatedAt: "2026-03-02T10:00:00.000Z",
    },
    probes: {
      mainProcess: false,
      ghostProcess: true,
      wrapperProcess: true,
    },
    nowIso: "2026-03-02T10:00:10.000Z",
  });

  assert.equal(result.mode, "conflict");
  assert.equal(result.shouldStop, true);
  assert.match(result.reason, /runtime.*probe/i);
});
