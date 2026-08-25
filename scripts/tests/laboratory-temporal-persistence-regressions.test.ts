import assert from "node:assert/strict";
import test from "node:test";

import { createLaboratoryPresetEditRuntime } from "../../rooms/laboratory/shared/host/preset-edit-runtime.ts";

function toRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

const runtime = createLaboratoryPresetEditRuntime({
  asNonEmptyString(value) {
    return typeof value === "string" && value.trim() !== "" ? value.trim() : null;
  },
  normalizeSourceMetadata(value) {
    return value && typeof value === "object" && !Array.isArray(value) ? toRecord(value) : null;
  },
  toRecord,
});

const editPresets = {
  defaultMode: "beginner",
  focusRegions: {
    "full-frame": {
      cropNormalized: { x: 0, y: 0, width: 1, height: 1 },
    },
  },
  resizePresets: {
    analysis: { width: 1280 },
  },
  presets: {
    video: { beginner: [] },
    audio: { beginner: [] },
    image: { beginner: [] },
  },
};

void test("default edit state starts with empty temporal stress-test history", () => {
  const edit = runtime.createDefaultEditState(editPresets, "video");
  assert.deepEqual(edit.temporalStressTests, []);
});

void test("edit normalization preserves temporal stress-test history across restart", () => {
  const defaults = runtime.createDefaultEditState(editPresets, "video");
  const normalized = runtime.normalizeEditState(
    {
      ...defaults,
      temporalStressTests: [
        {
          id: "temporal-stress-one",
          createdAt: "2026-08-24T10:00:00.000Z",
          request: { startSeconds: 4, endSeconds: 6, sampleFps: 5, roi: null },
          metrics: { summary: { edgePersistenceRatio: 0.75 } },
        },
      ],
    },
    editPresets,
    "video"
  );

  assert.equal(normalized.temporalStressTests.length, 1);
  assert.equal(normalized.temporalStressTests[0]?.["id"], "temporal-stress-one");
  assert.deepEqual(toRecord(normalized.temporalStressTests[0]?.["metrics"])["summary"], {
    edgePersistenceRatio: 0.75,
  });
});

void test("edit normalization caps temporal stress-test history at twenty entries", () => {
  const defaults = runtime.createDefaultEditState(editPresets, "video");
  const normalized = runtime.normalizeEditState(
    {
      ...defaults,
      temporalStressTests: Array.from({ length: 24 }, (_, index) => ({ id: `scan-${index}` })),
    },
    editPresets,
    "video"
  );

  assert.equal(normalized.temporalStressTests.length, 20);
  assert.equal(normalized.temporalStressTests[0]?.["id"], "scan-0");
  assert.equal(normalized.temporalStressTests[19]?.["id"], "scan-19");
});
