import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { deviceIdsFor, type DeviceDetails } from "../devices/inventory.ts";
import {
  connection,
  deviceHealth,
  freshForMs,
  observationFreshness,
  recordStatus,
  type DeviceStatuses,
  type StatusUpdate,
} from "../devices/status.ts";
import type { Opened, Saved } from "../editor/client.ts";
import { deviceMarkers, frame, spatialScene } from "../editor/site/scene.ts";
import { createSiteFixture } from "../spatial/fixture.ts";
import { applySiteEdits, type SiteEdit } from "../spatial/site-edits.ts";
import { worldPose } from "../spatial/world.ts";
import { projectCommand } from "../storage/provider.ts";

const details: DeviceDetails = {
  name: "Greenhouse",
  roles: ["client", "sensor"],
  capabilities: ["temperature.read.v1", "humidity.read.v1", "camera.view.v1"],
  manufacturer: "Example",
};
const temperature = {
  kind: "observation",
  capability: "temperature.read.v1",
  unit: "°C",
  quality: "valid",
  value: 23,
} as const;

test("device edits retain their own ID, roles and capabilities when moving, detaching and editing", () => {
  const world = createSiteFixture();
  const id = randomUUID();
  const created = applySiteEdits(world, [{ op: "createDevice", id, source: "virtual", details }]);
  const mounted = applySiteEdits(created, [{ op: "mountDevice", id, mount: "mc2" }]);
  assert.deepEqual(mounted.devices[id], { ...created.devices[id], mount: "mc2" });
  assert.equal(mounted.devices["c2"]?.mount, "mc2");
  assert.throws(
    () => applySiteEdits(mounted, [{ op: "mountDevice", id, mount: "glass" }]),
    /mount/
  );

  const moved = applySiteEdits(mounted, [{ op: "mountDevice", id, mount: "mc5" }]);
  assert.deepEqual(moved.devices[id], { ...created.devices[id], mount: "mc5" });
  const amended = applySiteEdits(moved, [
    {
      op: "updateDevice",
      id,
      details: {
        name: "Coop monitor",
        roles: details.roles,
        capabilities: details.capabilities,
        model: "2",
      },
    },
  ]);
  assert.equal(amended.devices[id]?.manufacturer, undefined);
  assert.equal(amended.devices[id]?.name, "Coop monitor");
  assert.equal(amended.devices[id]?.mount, "mc5");
  const detached = applySiteEdits(amended, [{ op: "mountDevice", id, mount: null }]);
  assert.equal(detached.devices[id]?.mount, undefined);

  assert.throws(
    () => applySiteEdits(amended, [{ op: "deleteDevice", id, mount: "mc2", hardwareId: null }]),
    /relationships/
  );
  const removed = applySiteEdits(amended, [
    { op: "deleteDevice", id, mount: "mc5", hardwareId: null },
  ]);
  assert.equal(removed.devices[id], undefined);
  assert.deepEqual(removed.nodes, world.nodes);
});

test("area summaries use mount ancestry and explicit zones and count each device once", () => {
  const world = createSiteFixture();
  assert.equal(deviceIdsFor(world, "plot").length, 7);
  assert.deepEqual(deviceIdsFor(world, "glass").sort(), ["c1", "c2", "c3", "r1"]);
  assert.deepEqual(deviceIdsFor(world, "coop").sort(), ["c5", "r2"]);
  assert.ok(deviceIdsFor(world, "bed").includes("c2"));
  assert.ok(deviceIdsFor(world, "yard").includes("c2"));

  const crossArea = structuredClone(world);
  crossArea.nodes["bed2"] = { ...crossArea.nodes["bed"]!, name: "Bed 2" };
  crossArea.nodes["mc4"]!.zoneIds = ["bed", "bed2"];
  assert.deepEqual(deviceIdsFor(crossArea, "glass").sort(), ["c1", "c2", "c3", "c4", "r1"]);
  assert.equal(deviceIdsFor(crossArea, "plot").length, 7);

  const id = randomUUID();
  const shared = applySiteEdits(world, [
    { op: "createDevice", id, source: "virtual", details },
    { op: "mountDevice", id, mount: "mc2" },
  ]);
  const items = spatialScene(shared, new Set(), true);
  const markers = deviceMarkers(shared, items).filter(
    ({ id: marker }) => marker === id || marker === "c2"
  );
  assert.equal(markers.length, 2);
  assert.deepEqual(
    markers.map(({ pose }) => pose.p),
    [worldPose(world, "mc2").p, worldPose(world, "mc2").p]
  );
  assert.deepEqual(
    markers.map(({ device }) => device?.index),
    [0, 1]
  );
  assert.ok(markers.every((marker) => marker.ancestors.includes("plot")));
  assert.deepEqual(frame([...items, ...markers], id), markers[0]!.bounds);
  assert.ok(
    !deviceMarkers(shared, spatialScene(shared, new Set(["glass"]), true)).some(
      (item) => item.id === id
    )
  );
});

test("link, observation validity and freshness are independent and survive reconnection correctly", () => {
  const world = createSiteFixture();
  const before = structuredClone(world);
  const mesh = spatialScene(world, new Set(), true);
  const device = world.devices["c3"]!;
  const input = { deviceId: "c3", source: "simulated" } as const;
  let status: DeviceStatuses = {};
  const add = (at: number, update: StatusUpdate) =>
    (status = recordStatus(world, status, update, at));
  assert.equal(connection(device, status["c3"]), "unknown");
  assert.equal(observationFreshness(undefined, undefined, 1), "noData");
  add(10, { ...input, kind: "link", state: "online" });
  assert.equal(deviceHealth(device, status["c3"], 10), "noData");
  add(20, { ...input, ...temperature, at: 20 });
  const reading = status["c3"]!.observations[temperature.capability];
  assert.equal(observationFreshness(status["c3"], reading, 20 + freshForMs - 1), "fresh");
  assert.equal(observationFreshness(status["c3"], reading, 20 + freshForMs), "stale");
  add(30, { ...input, kind: "link", state: "offline" });
  assert.equal(connection(device, status["c3"]), "offline");
  assert.equal(status["c3"]!.lastContactAt, 20);
  assert.equal(observationFreshness(status["c3"], reading, 30), "stale");
  add(40, { ...input, kind: "link", state: "online" });
  assert.equal(connection(device, status["c3"]), "online");
  assert.equal(observationFreshness(status["c3"], reading, 40), "stale");
  add(50, { ...input, ...temperature, at: 50, quality: "invalid", value: null });
  assert.equal(deviceHealth(device, status["c3"], 50), "invalid");
  assert.equal(status["c3"]!.observations[temperature.capability]?.value, null);
  assert.throws(() => add(60, { ...input, ...temperature, at: 60, unit: "m" }), /observation/);
  assert.throws(
    () => add(60, { ...input, ...temperature, at: 60, capability: "humidity.read.v1" }),
    /observation/
  );
  assert.throws(
    () => add(60, { ...input, ...temperature, at: 60, source: "measured", hardwareId: "old" }),
    /identity/
  );
  assert.deepEqual(world, before);
  assert.deepEqual(spatialScene(world, new Set(), true), mesh);
});

test("trusted storage keeps device and latest status across reopen without touching world bytes on status update", async (t) => {
  const storageRoot = await mkdtemp(join(tmpdir(), "gaia-device-test-"));
  t.after(() => rm(storageRoot, { force: true, recursive: true }));
  const context = { storageRoot, owner: {} };
  const call = (name: string, args: unknown) => projectCommand(context, name, args);
  const project = "inventory";
  let opened = (await call("GaiaCreate", {
    project,
    layout: "site",
    locale: "en",
    fixture: false,
  })) as Opened;
  const id = randomUUID();
  const save = (edits: SiteEdit[]) =>
    call("GaiaSave", {
      retry: false,
      batch: {
        scope: "site",
        project,
        session: opened.session,
        baseRevision: opened.world.revision,
        operationId: randomUUID(),
        edits,
      },
    }) as Promise<Saved>;
  const status = (update?: object) =>
    call("GaiaStatus", {
      project,
      session: opened.session,
      ...(update ? { update } : {}),
    }) as Promise<{ statuses: DeviceStatuses }>;
  const created = await save([{ op: "createDevice", id, source: "virtual", details }]);
  assert.deepEqual(created.world.nodes, {});
  assert.equal(created.world.devices[id]?.name, details.name);
  const worldFile = join(storageRoot, "projects", project, "world.json");
  const bytes = await readFile(worldFile);
  await status({ kind: "link", deviceId: id, state: "online" });
  await status({ ...temperature, deviceId: id, at: Date.now() });
  await assert.rejects(
    status({ ...temperature, deviceId: id, at: Date.now(), source: "measured" }),
    /fields/
  );
  assert.deepEqual(await readFile(worldFile), bytes);
  const oldSession = opened.session;
  opened = (await call("GaiaOpen", { project })) as Opened;
  assert.deepEqual(opened.world, created.world);
  assert.equal((await status()).statuses[id]?.observations[temperature.capability]?.value, 23);
  await assert.rejects(call("GaiaStatus", { project, session: oldSession }), /session/);
  await save([{ op: "deleteDevice", id, mount: null, hardwareId: null }]);
  assert.deepEqual(await status(), { statuses: {} });
  await assert.rejects(status({ kind: "link", deviceId: id, state: "online" }), /identity/);
});
