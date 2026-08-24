import assert from "node:assert/strict";
import test from "node:test";

import { createLaboratoryControlInjectionRuntime } from "../../rooms/laboratory/features/media-analysis/host/control-injection.ts";
import { createLaboratoryTemporalStressTestRuntime } from "../../rooms/laboratory/features/media-analysis/host/temporal-stress-test.ts";
import { normalizeLaboratoryControlInjectionRequest } from "../../rooms/laboratory/shared/control-injection-model.ts";

function toRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

const temporalRuntime = createLaboratoryTemporalStressTestRuntime({
  async callRoomTools() {
    return { run: { exitCode: 0, stderr: "" } };
  },
  async ensureProjectDirectories() {},
  getActiveProject() {
    return null;
  },
  getPreparedSourcePath() {
    return null;
  },
  getProjectEditOutputDir() {
    return "/out";
  },
  async patchActiveProject() {},
  roomId: "laboratory",
  toRecord,
});

const runtime = createLaboratoryControlInjectionRuntime({
  async callRoomTools() {
    return { run: { exitCode: 0, stderr: "" } };
  },
  getActiveProject() {
    return null;
  },
  getPreparedSourcePath() {
    return null;
  },
  getProjectEditOutputDir() {
    return "/out";
  },
  async patchActiveProject() {},
  roomId: "laboratory",
  temporalRuntime,
  toRecord,
});

void test("noise and low-light controls use fixed seeds for reproducible synthetic noise", () => {
  const noise = normalizeLaboratoryControlInjectionRequest({
    kind: "noise",
    temporalRequest: { startSeconds: 1, endSeconds: 2, sampleFps: 5, roi: null },
  });
  const lowLight = normalizeLaboratoryControlInjectionRequest({
    kind: "low-light",
    temporalRequest: { startSeconds: 1, endSeconds: 2, sampleFps: 5, roi: null },
  });

  assert.equal(noise?.params["seed"], 4242);
  assert.equal(lowLight?.params["noiseSeed"], 4242);
  assert.match(runtime.buildControlFilter(noise!), /all_seed=4242/);
  assert.match(runtime.buildControlFilter(lowLight!), /all_seed=4242/);
});
