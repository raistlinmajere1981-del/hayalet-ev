import test from "node:test";
import assert from "node:assert/strict";

import { createLaboratoryPresetEditRuntime } from "../../rooms/laboratory/shared/host/preset-edit-runtime.ts";
import {
  buildLaboratoryTransformStackProvenanceFromRecipe,
  cloneLaboratoryEditRecipeSnapshot,
} from "../../rooms/laboratory/shared/transform-stress-test-provenance.ts";

function toRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function asNonEmptyString(value: unknown) {
  return typeof value === "string" && value.trim() !== "" ? value.trim() : null;
}

const presetRuntime = createLaboratoryPresetEditRuntime({
  asNonEmptyString,
  normalizeSourceMetadata(value) {
    const record = toRecord(value);
    return Object.keys(record).length > 0 ? record : null;
  },
  toRecord,
});

void test("recipe snapshot is detached from later recipe mutations", () => {
  const recipe = {
    video: {
      transformStages: [{ id: "gamma-1", kind: "gamma", enabled: true, params: { value: 1.4 } }],
    },
    audio: { transformStages: [] },
    image: { transformStages: [] },
  };

  const snapshot = cloneLaboratoryEditRecipeSnapshot(recipe);
  (recipe.video.transformStages[0] as { params: { value: number } }).params.value = 4;

  assert.equal(
    (
      (
        (snapshot["video"] as Record<string, unknown>)["transformStages"] as Array<
          Record<string, unknown>
        >
      )[0]?.["params"] as Record<string, unknown>
    )["value"],
    1.4
  );
});

void test("provenance records ordered visual/audio stages and excludes visual stages for audio-only sources", () => {
  const recipe = {
    video: {
      transformStages: [
        { id: "gamma-1", kind: "gamma", enabled: true, params: { value: 1.4 } },
        { id: "blur-1", kind: "blur", enabled: false, params: { radius: 2 } },
      ],
    },
    audio: {
      transformStages: [{ id: "gain-1", kind: "gain", enabled: true, params: { db: 6 } }],
    },
  };

  const videoProvenance = buildLaboratoryTransformStackProvenanceFromRecipe(recipe, "video");
  assert.deepEqual(
    videoProvenance.visual.map((stage) => [stage.id, stage.order, stage.enabled]),
    [
      ["gamma-1", 0, true],
      ["blur-1", 1, false],
    ]
  );
  assert.deepEqual(
    videoProvenance.audio.map((stage) => [stage.id, stage.order]),
    [["gain-1", 0]]
  );

  const audioProvenance = buildLaboratoryTransformStackProvenanceFromRecipe(recipe, "audio");
  assert.deepEqual(audioProvenance.visual, []);
  assert.deepEqual(
    audioProvenance.audio.map((stage) => stage.id),
    ["gain-1"]
  );
});

void test("edit output normalization retains recipe and transform provenance snapshots", () => {
  const output = presetRuntime.normalizeEditOutput({
    id: "edit-output-1",
    kind: "video",
    path: "/tmp/output.mp4",
    fileName: "output.mp4",
    mimeType: "video/mp4",
    createdAt: "2026-08-24T00:00:00.000Z",
    recipeSignature: "sig-1",
    recipeSnapshot: {
      video: {
        transformStages: [{ id: "gamma-1", kind: "gamma", enabled: true, params: { value: 1.4 } }],
      },
    },
    transformStackProvenance: {
      sourceKind: "video",
      visual: [{ id: "gamma-1", order: 0 }],
      audio: [],
    },
  });

  assert.equal(
    ((output.recipeSnapshot["video"] as Record<string, unknown>)["transformStages"] as unknown[])
      .length,
    1
  );
  assert.deepEqual(output.transformStackProvenance["visual"], [{ id: "gamma-1", order: 0 }]);
});

void test("preview normalization retains provenance while empty edits default safely to empty snapshots", () => {
  const normalized = presetRuntime.normalizeEditState(
    {
      preview: {
        status: "ready",
        outputId: "preview",
        path: "/tmp/preview.mp4",
        recipeSnapshot: { video: { transformStages: [] } },
        transformStackProvenance: { sourceKind: "video", visual: [], audio: [] },
      },
      recipe: {},
      outputs: [],
    },
    {},
    "video"
  );

  assert.deepEqual(normalized.preview.recipeSnapshot, { video: { transformStages: [] } });
  assert.deepEqual(normalized.preview.transformStackProvenance, {
    sourceKind: "video",
    visual: [],
    audio: [],
  });

  const emptyEdit = presetRuntime.normalizeEditState({ recipe: {}, outputs: [] }, {}, "video");
  assert.deepEqual(emptyEdit.preview.recipeSnapshot, {});
  assert.deepEqual(emptyEdit.preview.transformStackProvenance, {});
});
