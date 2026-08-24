import test from "node:test";
import assert from "node:assert/strict";

import {
  createLaboratoryTransformStageParams,
  mutateLaboratoryTransformStages,
  normalizeLaboratoryTransformStages,
} from "../../rooms/laboratory/shared/transform-stress-test-model.ts";

void test("normalization preserves declared order and fills default parameters", () => {
  const stages = normalizeLaboratoryTransformStages(
    [
      { id: "gamma-a", kind: "gamma", enabled: true, params: { value: 1.8 } },
      { id: "blur-a", kind: "blur", enabled: false, params: {} },
    ],
    "visual"
  );

  assert.deepEqual(
    stages.map((stage) => stage.id),
    ["gamma-a", "blur-a"]
  );
  assert.equal(stages[0]?.params["value"], 1.8);
  assert.equal(stages[1]?.params["radius"], 1);
  assert.equal(stages[1]?.enabled, false);
});

void test("scope normalization rejects audio stages from the visual stack", () => {
  assert.deepEqual(
    normalizeLaboratoryTransformStages(
      [{ id: "gain-a", kind: "gain", enabled: true, params: { db: 6 } }],
      "visual"
    ),
    []
  );
});

void test("add mutation creates deterministic unique ids and stage defaults", () => {
  const initial = [{ id: "gamma-1", kind: "gamma", enabled: true, params: { value: 1.2 } }];
  const next = mutateLaboratoryTransformStages(initial, "visual", {
    type: "add",
    kind: "gamma",
  });

  assert.deepEqual(
    next.map((stage) => stage.id),
    ["gamma-1", "gamma-2"]
  );
  assert.deepEqual(next[1]?.params, createLaboratoryTransformStageParams("gamma"));
});

void test("move mutation changes recipe order without changing stage identity", () => {
  const initial = [
    { id: "brightness-1", kind: "brightness", enabled: true, params: { value: 0.2 } },
    { id: "gamma-1", kind: "gamma", enabled: true, params: { value: 1.6 } },
    { id: "blur-1", kind: "blur", enabled: true, params: { radius: 2 } },
  ];
  const next = mutateLaboratoryTransformStages(initial, "visual", {
    type: "move",
    stageId: "blur-1",
    direction: "up",
  });

  assert.deepEqual(
    next.map((stage) => stage.id),
    ["brightness-1", "blur-1", "gamma-1"]
  );
});

void test("enable, parameter and remove mutations keep the stack non-destructive", () => {
  const initial = [
    { id: "band-1", kind: "band-pass", enabled: true, params: { lowHz: 120, highHz: 3200 } },
    { id: "gain-1", kind: "gain", enabled: true, params: { db: 3 } },
  ];

  const disabled = mutateLaboratoryTransformStages(initial, "audio", {
    type: "enabled",
    stageId: "band-1",
    enabled: false,
  });
  const adjusted = mutateLaboratoryTransformStages(disabled, "audio", {
    type: "parameter",
    stageId: "gain-1",
    parameterId: "db",
    value: 7.5,
  });
  const removed = mutateLaboratoryTransformStages(adjusted, "audio", {
    type: "remove",
    stageId: "band-1",
  });

  assert.equal(disabled[0]?.enabled, false);
  assert.equal(adjusted[1]?.params["db"], 7.5);
  assert.deepEqual(removed.map((stage) => stage.id), ["gain-1"]);
  assert.equal((initial[0] as { enabled: boolean }).enabled, true);
});
