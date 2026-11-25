import assert from "node:assert/strict";
import { test } from "node:test";
import { openSession } from "../editor/session.ts";
import { createFixture } from "../spatial/fixture.ts";
import { fromParent, worldPose } from "../spatial/world.ts";

const unchanged = (raw: unknown) => raw;

test("applies only the edited coordinates and dimensions to existing Gaia IDs", () => {
  const world = createFixture();
  const session = openSession(world, "glass");
  const draft = structuredClone(session.plan);
  const floor = draft.floors[0]!;
  floor.walls[0]!.end.x = 0;
  const table = floor.furniture[0]!;
  table.position.x = 300;
  table.rotation = 270;
  table.scale.x = 1.25;
  session.authorize(session.plan, draft);

  const { candidate, batch, next } = session.prepareSave(draft, world, unchanged);
  assert.equal(candidate.revision, 8);
  assert.deepEqual(
    batch.edits.map(({ id, op }) => [id, op]),
    [
      ["partition", "geometry"],
      ["bench", "pose"],
      ["bench", "geometry"],
    ]
  );
  assert.deepEqual(candidate.nodes["partition"], {
    ...world.nodes["partition"],
    geometry: { kind: "wall", thickness: 0.12, height: 2.4, length: 4 },
  });
  assert.deepEqual(candidate.nodes["bench"], {
    ...world.nodes["bench"],
    p: [3, 1, 0],
    yaw: 90,
    geometry: { kind: "box", size: [1.5, 0.6, 0.8] },
  });
  assert.deepEqual(worldPose(candidate, "bench"), { p: [11, 17, 0], yaw: 180 });
  assert.deepEqual(candidate.devices, world.devices);
  assert.deepEqual(candidate.nodes["mc2"], world.nodes["mc2"]);
  assert.deepEqual(candidate["survey"], world["survey"]);
  assert.equal(next.prepareSave(next.plan, candidate, unchanged).candidate, candidate);
});

test("composes and inverts an offset rotated floor with negative elevation, without drift", () => {
  let world = createFixture();
  const floor = world.nodes["ground"]!;
  floor.p = [0.5, -1, -3];
  floor.yaw = 90;
  const bench = world.nodes["bench"]!;
  bench.p = [2, 1, 0.4];
  const floorWorld = worldPose(world, "ground");
  const position = worldPose(world, "bench");
  assert.deepEqual(position, { p: [11, 13.5, -2.6], yaw: 210 });
  const inverse = fromParent(floorWorld, position.p);
  for (const [i, coordinate] of inverse.entries())
    assert.ok(Math.abs(coordinate - bench.p[i]!) < 1e-6);
  const baseline = structuredClone(world);
  for (let i = 0; i < 100; i++) {
    const session = openSession(world, "glass");
    const projected = session.plan.floors[0]!;
    assert.equal(projected.elevation, -300);
    assert.equal(projected.furniture[0]!.elevation, 40);
    world = session.prepareSave(session.plan, world, unchanged).candidate;
  }
  assert.deepEqual(world, baseline);
});

test("rejects hidden or lossy raw changes before normalization and leaves the valid batch atomic", () => {
  const world = createFixture();
  const session = openSession(world, "glass");
  for (const target of [
    "scale",
    "curvePoint",
    "height",
    "doors",
    "backgroundImage",
    "material",
    "duplicate editor ID",
  ]) {
    const draft = structuredClone(session.plan);
    const floor = draft.floors[0]!;
    const bench = floor.furniture[0]!;
    bench.position.x += 25;
    switch (target) {
      case "scale":
        bench.scale.x = -1;
        break;
      case "curvePoint":
        Object.assign(floor.walls[0]!, { curvePoint: { x: 0, y: 10 } });
        break;
      case "height":
        floor.walls[0]!.endHeight += 20;
        break;
      case "doors":
        Object.assign(floor, { doors: [{ id: "door" }] });
        break;
      case "backgroundImage":
        Object.assign(floor, { backgroundImage: { locked: true } });
        break;
      case "material":
        Object.assign(bench, { material: "oak" });
        break;
      case "duplicate editor ID":
        bench.id = floor.walls[0]!.id;
        break;
    }
    assert.throws(
      () =>
        session.prepareSave(draft, world, () => {
          assert.fail("The raw snapshot must be checked before normalization");
        }),
      (error: Error) => error.message.includes(target)
    );
    assert.deepEqual(world, createFixture());
  }
  const draft = structuredClone(session.plan);
  draft.floors[0]!.furniture = [];
  assert.throws(() => session.prepareSave(draft, world, unchanged), /membership/);
  session.authorize(session.plan, draft, { kind: "remove", ids: ["e-bench"] });
  assert.throws(() => session.prepareSave(draft, world, unchanged), /bench.*bed/);
  assert.deepEqual(world, createFixture());
  assert.throws(
    () => session.prepareSave(draft, { ...world, revision: 8 }, unchanged),
    /revision changed/
  );
});

test("checks full scope across floors and keeps IDs across history replay", () => {
  const world = createFixture();
  world.nodes["upper"] = { ...world.nodes["ground"]!, name: "Upper", level: 1, p: [0, 0, 3] };
  const session = openSession(world, "glass");
  const draft = structuredClone(session.plan);
  draft.activeFloorId = "f-upper";
  session.authorize(session.plan, draft);
  assert.equal(session.prepareSave(draft, world, unchanged).candidate, world);
  const [ground, upper] = draft.floors;
  assert.ok(ground && upper);
  upper.furniture = ground.furniture;
  ground.furniture = [];
  assert.throws(() => session.authorize(session.plan, draft), /explicit Gaia intent/);
  upper.furniture = [];
  draft.floors = [ground];
  assert.throws(() => session.prepareSave(draft, world, unchanged), /complete building snapshot/);

  const copy = structuredClone(session.plan);
  const rows = copy.floors[0]!.furniture;
  rows.push({ ...rows[0]!, id: "copy-1", position: { x: 250, y: -100 } });
  assert.throws(() => session.authorize(session.plan, copy), /explicit Gaia intent/);
  session.authorize(session.plan, copy, { kind: "create", ids: ["copy-1"] });
  const first = session.prepareSave(copy, world, unchanged);
  const firstId = first.batch.edits[0]!.id;
  assert.equal(first.candidate.nodes[firstId]?.zoneIds, undefined);
  assert.equal(first.candidate.nodes[firstId]?.["inventory"], undefined);
  session.authorize(copy, session.plan, { kind: "history" });
  session.authorize(session.plan, copy, { kind: "history" });
  assert.equal(session.prepareSave(copy, world, unchanged).batch.edits[0]!.id, firstId);
  session.authorize(copy, session.plan, { kind: "history" });
  const branch = structuredClone(copy);
  branch.floors[0]!.furniture[1]!.id = "copy-2";
  session.authorize(session.plan, branch, { kind: "create", ids: ["copy-2"] });
  assert.notEqual(session.prepareSave(branch, world, unchanged).batch.edits[0]!.id, firstId);
});
