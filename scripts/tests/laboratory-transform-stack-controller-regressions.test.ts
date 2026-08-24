import test from "node:test";
import assert from "node:assert/strict";

import {
  buildLaboratoryTransformStackProvenance,
  buildLaboratoryTransformStageRecipePatch,
  getLaboratoryTransformRecipeSection,
} from "../../rooms/laboratory/runtime/controller/lab-transform-stack-controller.ts";

function createEditConfig() {
  return {
    recipe: {
      video: {
        transformStages: [
          { id: "brightness-1", kind: "brightness", enabled: true, params: { value: 0.2 } },
          { id: "gamma-1", kind: "gamma", enabled: true, params: { value: 1.6 } },
        ],
      },
      image: {
        transformStages: [
          { id: "blur-1", kind: "blur", enabled: true, params: { radius: 2 } },
        ],
      },
      audio: {
        transformStages: [
          { id: "band-pass-1", kind: "band-pass", enabled: true, params: { lowHz: 120, highHz: 3200 } },
        ],
      },
    },
  };
}

void test("visual recipe section follows the actual source kind", () => {
  assert.equal(getLaboratoryTransformRecipeSection("video", "visual"), "video");
  assert.equal(getLaboratoryTransformRecipeSection("image", "visual"), "image");
  assert.equal(getLaboratoryTransformRecipeSection("video", "audio"), "audio");
});

void test("move patch replaces only the ordered transformStages array", () => {
  const patch = buildLaboratoryTransformStageRecipePatch({
    editConfig: createEditConfig(),
    sourceKind: "video",
    scope: "visual",
    mutation: { type: "move", stageId: "gamma-1", direction: "up" },
  });

  assert.deepEqual(
    (patch?.["video"] as { transformStages: Array<{ id: string }> }).transformStages.map(
      (stage) => stage.id
    ),
    ["gamma-1", "brightness-1"]
  );
  assert.equal(patch?.["audio"], undefined);
});

void test("image visual mutation never writes into the video recipe", () => {
  const patch = buildLaboratoryTransformStageRecipePatch({
    editConfig: createEditConfig(),
    sourceKind: "image",
    scope: "visual",
    mutation: { type: "enabled", stageId: "blur-1", enabled: false },
  });

  assert.equal(patch?.["video"], undefined);
  assert.equal(
    (patch?.["image"] as { transformStages: Array<{ enabled: boolean }> }).transformStages[0]
      ?.enabled,
    false
  );
});

void test("invalid cross-scope stage additions are rejected", () => {
  assert.equal(
    buildLaboratoryTransformStageRecipePatch({
      editConfig: createEditConfig(),
      sourceKind: "video",
      scope: "visual",
      mutation: { type: "add", kind: "gain" },
    }),
    null
  );
});

void test("provenance records explicit order for visual and audio stacks", () => {
  const provenance = buildLaboratoryTransformStackProvenance(createEditConfig(), "video");

  assert.deepEqual(
    provenance.visual.map((stage) => [stage.id, stage.order]),
    [
      ["brightness-1", 0],
      ["gamma-1", 1],
    ]
  );
  assert.deepEqual(provenance.audio.map((stage) => [stage.id, stage.order]), [
    ["band-pass-1", 0],
  ]);
});
