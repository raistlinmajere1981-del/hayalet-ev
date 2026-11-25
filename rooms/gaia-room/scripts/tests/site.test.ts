import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { spatialScene } from "../editor/site/scene.ts";
import { virtualReadings } from "../editor/site/virtual.ts";
import type { Opened } from "../editor/client.ts";
import { createSiteFixture } from "../spatial/fixture.ts";
import { newProject } from "../spatial/project.ts";
import { applySiteEdits, removalPlan, type SiteBatch } from "../spatial/site-edits.ts";
import { close, validateWorld, worldPose, type Pose } from "../spatial/world.ts";
import { projectCommand } from "../storage/provider.ts";

test("site projection shares rotated geometry, clips paths at the site datum, and filters frame children", () => {
  const world = createSiteFixture();
  world.nodes["plot"]!.p = [120, 220, 10];
  const before = structuredClone(world);
  const above = spatialScene(world, new Set(), false);
  const all = spatialScene(world, new Set(), true);
  const pipe = above.find(({ id }) => id === "pipe")!;
  assert.equal(pipe.shape.kind, "path");
  assert.deepEqual(pipe.shape.segments, [
    [
      [133, 236, 10],
      [133, 236, 11],
    ],
  ]);
  assert.equal(
    above.some(({ id }) => id === "tank" || id === "cellar" || id === "mc1"),
    false
  );
  assert.deepEqual(all.find(({ id }) => id === "mc1")?.pose.p, [131, 236, 8]);
  assert.ok(all.find(({ id }) => id === "coop"));
  assert.ok(all.find(({ id }) => id === "glass"));
  const hidden = spatialScene(world, new Set(["ground", "coop"]), true);
  assert.equal(
    hidden.some(({ id }) => ["bench", "mc2", "mr2"].includes(id)),
    false
  );
  assert.ok(hidden.some(({ id }) => id === "pipe"));
  assert.deepEqual(world, before);
});

test("moving a building carries frame descendants and leaves surveyed utility paths in their site frame", () => {
  const world = createSiteFixture();
  const moved = applySiteEdits(world, [
    { op: "building", id: "glass", pose: { p: [15, 20, 0], yaw: 180 }, size: [14, 8, 6] },
  ]);
  assert.deepEqual(worldPose(moved, "mc1").p, [13, 19, -2]);
  assert.deepEqual(moved.nodes["mc1"], world.nodes["mc1"]);
  assert.deepEqual(moved.nodes["pipe"], world.nodes["pipe"]);
  assert.deepEqual(moved.devices, world.devices);
  const reattached = applySiteEdits(moved, [
    { op: "reparent", id: "mc1", parent: "upper", preserve: "world" },
  ]);
  assert.ok(
    worldPose(reattached, "mc1").p.every((v, i) => close(v, worldPose(moved, "mc1").p[i]!))
  );
  const local = applySiteEdits(moved, [
    { op: "reparent", id: "mc1", parent: "upper", preserve: "local" },
  ]);
  assert.deepEqual(local.nodes["mc1"]?.p, moved.nodes["mc1"]?.p);
  assert.equal(worldPose(local, "mc1").p[2], 4);
  assert.throws(() =>
    applySiteEdits(moved, [{ op: "reparent", id: "glass", parent: "bed", preserve: "world" }])
  );
});

test("deletion requires explicit children and device detachments and rejects surviving zone references", () => {
  const world = createSiteFixture();
  assert.throws(
    () => applySiteEdits(world, [{ op: "remove", ids: ["coop"], detach: [] }]),
    /relationship/
  );
  assert.throws(
    () => applySiteEdits(world, [{ op: "remove", ids: ["mc4"], detach: [] }]),
    /detachment/
  );
  assert.throws(
    () => applySiteEdits(world, [{ op: "remove", ...removalPlan(world, "glass") }]),
    /pipe|cable/
  );
  const removed = applySiteEdits(world, [{ op: "remove", ...removalPlan(world, "coop") }]);
  assert.equal(removed.nodes["coop"], undefined);
  assert.equal(removed.nodes["mr2"], undefined);
  assert.equal(removed.devices["r2"]?.mount, undefined);
  assert.deepEqual(removed.nodes["cable"], world.nodes["cable"]);
  assert.equal(world.devices["r2"]?.mount, "mr2");
});

test("virtual state keeps only the active subscriber and does not touch the spatial snapshot", () => {
  const world = createSiteFixture();
  const before = structuredClone(world);
  const items = spatialScene(world, new Set(), false);
  const source = virtualReadings();
  let updates = 0;
  const off = source.subscribe(() => updates++);
  source.update("c2", { state: "online", value: 50, at: 100 });
  off();
  source.update("c2", { state: "offline", value: 60, at: 200 });
  assert.equal(updates, 2);
  const stopAgain = source.subscribe((readings) => assert.equal(readings.get("c2")?.value, 60));
  stopAgain();
  assert.deepEqual(world, before);
  assert.deepEqual(spatialScene(world, new Set(), false), items);
});

test("a fixture project name can match a spatial ID without renaming the fixture", async (t) => {
  const storageRoot = await mkdtemp(join(tmpdir(), "gaia-site-test-"));
  t.after(() => rm(storageRoot, { force: true, recursive: true }));
  const opened = (await projectCommand({ storageRoot, owner: {} }, "GaiaCreate", {
    project: "bench",
    fixture: true,
    locale: "en",
    layout: "site",
  })) as Opened;
  assert.equal(opened.world.id, "bench");
  assert.deepEqual(opened.world.nodes["bench"], createSiteFixture().nodes["bench"]);
  const reopened = (await projectCommand({ storageRoot, owner: {} }, "GaiaOpen", {
    project: "bench",
  })) as Opened;
  assert.deepEqual(reopened.world, opened.world);
});

test("a synthetic reference requires two distinct points within the stored image", () => {
  const world = newProject("calibration-fixture", true, "en", true);
  validateWorld(world);
  const calibration = world.references["survey"]!.calibration!;
  const original = structuredClone(calibration.pixels);
  calibration.pixels = [original[0], original[0]];
  assert.throws(() => validateWorld(world), /reference calibration.*survey/);
  calibration.pixels = [original[0], [401, 30]];
  assert.throws(() => validateWorld(world), /reference calibration.*survey/);
  calibration.pixels = original;
  validateWorld(world);
});

test("site batches share the trusted writer and round-trip an empty project, IDs, elevations and receipt", async (t) => {
  const storageRoot = await mkdtemp(join(tmpdir(), "gaia-site-test-"));
  t.after(() => rm(storageRoot, { force: true, recursive: true }));
  const owner = {};
  const call = (command: string, args: unknown) =>
    projectCommand({ storageRoot, owner }, command, args);
  const opened = (await call("GaiaCreate", {
    project: "site",
    fixture: false,
    locale: "en",
    layout: "site",
  })) as Opened;
  assert.equal(opened.building, null);
  assert.deepEqual(opened.world.nodes, {});
  const [site, building, floor, mount, device, route] = Array.from({ length: 6 }, randomUUID) as [
    string,
    string,
    string,
    string,
    string,
    string,
  ];
  const pose: Pose = { p: [0, 0, 0], yaw: 0 };
  const batch: SiteBatch = {
    scope: "site",
    project: "site",
    session: opened.session,
    baseRevision: 0,
    operationId: randomUUID(),
    edits: [
      {
        op: "add",
        id: site,
        node: {
          ...pose,
          name: "Site",
          kind: "site",
          parent: null,
          geometry: {
            kind: "footprint",
            ring: [
              [0, 0],
              [40, 0],
              [40, 60],
              [0, 60],
            ],
          },
        },
      },
      {
        op: "add",
        id: building,
        node: {
          ...pose,
          name: "Building",
          kind: "building",
          parent: site,
          geometry: { kind: "box", size: [4, 6, 3] },
        },
      },
      {
        op: "add",
        id: floor,
        node: { ...pose, name: "Floor", kind: "floor", parent: building, level: 0 },
      },
      { op: "elevation", id: floor, z: -2 },
      {
        op: "add",
        id: mount,
        node: { ...pose, name: "Point", kind: "mount", parent: floor, geometry: { kind: "point" } },
      },
      { op: "bindVirtual", id: device, mount },
      {
        op: "add",
        id: route,
        node: {
          ...pose,
          name: "Route",
          kind: "route",
          parent: site,
          geometry: {
            kind: "path",
            vertices: [
              [0, 0, -2],
              [6, 2, 1],
            ],
          },
        },
      },
    ],
  };
  const saved = await call("GaiaSave", { batch, retry: false });
  const retry = await call("GaiaSave", { batch, retry: true });
  assert.deepEqual(retry, saved);
  const after = (await call("GaiaOpen", { project: "site", building })) as Opened;
  assert.equal(after.building, building);
  assert.equal(after.world.revision, 1);
  assert.equal(after.world.nodes[floor]?.p[2], -2);
  assert.equal(after.world.devices[device]?.mount, mount);
  assert.equal(after.world.nodes[route]?.parent, site);
  assert.deepEqual(saved, { world: after.world, missing: [] });
  await assert.rejects(
    call("GaiaSave", {
      batch: {
        ...batch,
        session: after.session,
        baseRevision: 1,
        operationId: randomUUID(),
        edits: [{ op: "building", id: building, pose, size: [0, 1, 1] }],
      },
      retry: false,
    }),
    /geometry/
  );
  assert.deepEqual(((await call("GaiaOpen", { project: "site" })) as Opened).world, after.world);
});
