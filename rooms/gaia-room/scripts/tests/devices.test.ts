import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { mkdir, mkdtemp, open, readFile, rename, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test, { type TestContext } from "node:test";
import { deviceIdsFor, type DeviceDetails } from "../devices/inventory.ts";
import {
  activeStatuses,
  connection,
  deviceHealth,
  freshForMs,
  observationFreshness,
  recordStatus,
  visibleStatuses,
  type DeviceStatuses,
  type StatusSnapshot,
  type StatusUpdate,
} from "../devices/status.ts";
import { deviceStatusIdentity, reconcileDeviceStatuses } from "../storage/status-store.ts";
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

async function siteProject(t: TestContext) {
  const storageRoot = await mkdtemp(join(tmpdir(), "gaia-device-test-"));
  t.after(() => rm(storageRoot, { force: true, recursive: true }));
  const context = { storageRoot, owner: {} };
  const call = (name: string, args: unknown) => projectCommand(context, name, args);
  const project = "inventory";
  const opened = (await call("GaiaCreate", {
    project,
    layout: "site",
    locale: "en",
    fixture: true,
  })) as Opened;
  let world = opened.world;
  const save = async (edits: SiteEdit[]) => {
    const saved = (await call("GaiaSave", {
      retry: false,
      batch: {
        scope: "site",
        project,
        session: opened.session,
        baseRevision: world.revision,
        operationId: randomUUID(),
        edits,
      },
    })) as Saved;
    world = saved.world;
    return saved;
  };
  const status = (update?: object) =>
    call("GaiaStatus", {
      project,
      session: opened.session,
      ...(update ? { update } : {}),
    }) as Promise<{ statuses: DeviceStatuses; revision: number }>;
  return {
    call,
    context,
    opened,
    project,
    save,
    status,
    statusPath: join(storageRoot, "projects", project, "device-status.json"),
    worldPath: join(storageRoot, "projects", project, "world.json"),
  };
}

test("removing a capability retires its observations and re-adding it does not revive them", async (t) => {
  const { save, status } = await siteProject(t);
  const id = randomUUID();
  const withoutTemperature = {
    ...details,
    capabilities: details.capabilities.filter(
      (capability) => capability !== temperature.capability
    ),
  };
  await save([{ op: "createDevice", id, source: "virtual", details }]);
  await status({ ...temperature, deviceId: id, at: Date.now() });
  assert.equal((await status()).statuses[id]?.observations[temperature.capability]?.value, 23);
  await save([{ op: "updateDevice", id, details: withoutTemperature }]);
  assert.deepEqual((await status()).statuses[id]?.observations, {});
  await save([{ op: "updateDevice", id, details }]);
  assert.deepEqual((await status()).statuses[id]?.observations, {});
});

test("deleted devices do not transfer their status to a recreated identity", async (t) => {
  const { save, status } = await siteProject(t);
  const id = randomUUID();
  await save([{ op: "createDevice", id, source: "virtual", details }]);
  await status({ ...temperature, deviceId: id, at: Date.now() });
  await save([{ op: "deleteDevice", id, mount: null, hardwareId: null }]);
  assert.deepEqual((await status()).statuses, {});
  await save([{ op: "createDevice", id, source: "virtual", details }]);
  assert.deepEqual((await status()).statuses[id]?.observations ?? {}, {});
});

test("renaming, moving or reordering capabilities keeps valid observations", async (t) => {
  const { save, status } = await siteProject(t);
  const id = randomUUID();
  await save([{ op: "createDevice", id, source: "virtual", details }]);
  await save([{ op: "mountDevice", id, mount: "mc2" }]);
  await status({ ...temperature, deviceId: id, at: Date.now() });
  await save([{ op: "updateDevice", id, details: { ...details, name: "Renamed" } }]);
  assert.equal((await status()).statuses[id]?.observations[temperature.capability]?.value, 23);
  await save([
    {
      op: "updateDevice",
      id,
      details: { ...details, name: "Renamed", capabilities: [...details.capabilities].reverse() },
    },
  ]);
  assert.equal((await status()).statuses[id]?.observations[temperature.capability]?.value, 23);
  await save([{ op: "mountDevice", id, mount: "mc5" }]);
  assert.equal((await status()).statuses[id]?.observations[temperature.capability]?.value, 23);
});

test("hardware identity changes retire old observations and rebinding does not revive them", () => {
  const world = createSiteFixture();
  const id = randomUUID();
  world.devices[id] = {
    role: "sensor",
    roles: ["sensor"],
    source: "physical",
    capabilities: [temperature.capability],
    hardwareId: "hw-1",
  };
  const statuses = recordStatus(
    world,
    {},
    {
      deviceId: id,
      source: "measured",
      hardwareId: "hw-1",
      ...temperature,
      at: 20,
    },
    20
  );
  const firstIdentity = deviceStatusIdentity(world);
  assert.equal(
    activeStatuses(world, statuses)[id]?.observations[temperature.capability]?.value,
    23
  );
  const rebound = structuredClone(world);
  rebound.devices[id]!.hardwareId = "hw-2";
  const retired = reconcileDeviceStatuses(rebound, firstIdentity, {
    identity: firstIdentity,
    statuses,
  });
  assert.deepEqual(retired, {});
  const stored = { identity: deviceStatusIdentity(rebound), statuses: retired };
  assert.deepEqual(reconcileDeviceStatuses(world, stored.identity, stored), {});
});

test("a failed world publication leaves valid status records intact", async (t) => {
  const { save, status, statusPath, worldPath } = await siteProject(t);
  const id = randomUUID();
  await save([{ op: "createDevice", id, source: "virtual", details }]);
  await status({ ...temperature, deviceId: id, at: Date.now() });
  const statusBytes = await readFile(statusPath);
  const worldBytes = await readFile(worldPath);
  const fd = await open(worldPath);
  const proto: object = Object.getPrototypeOf(fd) as object;
  await fd.close();
  const mock = t.mock.method(proto as { writeFile: () => Promise<void> }, "writeFile", async () => {
    throw Object.assign(new Error("Disk full"), { code: "ENOSPC" });
  });
  try {
    await assert.rejects(
      save([{ op: "updateDevice", id, details: { ...details, name: "Later" } }]),
      /Disk full/
    );
  } finally {
    mock.mock.restore();
  }
  assert.deepEqual(await readFile(worldPath), worldBytes);
  assert.deepEqual(await readFile(statusPath), statusBytes);
  assert.equal((await status()).statuses[id]?.observations[temperature.capability]?.value, 23);
});

test("an inventory save that misses status reconciliation fails closed instead of reviving data", async (t) => {
  const { save, status, statusPath } = await siteProject(t);
  const id = randomUUID();
  const withoutTemperature = {
    ...details,
    capabilities: details.capabilities.filter(
      (capability) => capability !== temperature.capability
    ),
  };
  await save([{ op: "createDevice", id, source: "virtual", details }]);
  await status({ ...temperature, deviceId: id, at: Date.now() });
  const suspended = statusPath + ".suspended";
  await rename(statusPath, suspended);
  await mkdir(statusPath);
  try {
    await save([{ op: "updateDevice", id, details: withoutTemperature }]);
  } finally {
    await rm(statusPath, { recursive: true });
    await rename(suspended, statusPath);
  }
  // Re-add the capability without reading status in between. The sidecar still describes the
  // pre-removal world, so it must be treated as stale rather than trusted evidence.
  await save([{ op: "updateDevice", id, details }]);
  assert.deepEqual((await status()).statuses[id]?.observations ?? {}, {});
});

test("two missed reconciliations cannot revive a sidecar when inventory returns to the same shape", async (t) => {
  const { call, project, save, status, statusPath } = await siteProject(t);
  const id = randomUUID();
  const withoutTemperature = {
    ...details,
    capabilities: details.capabilities.filter(
      (capability) => capability !== temperature.capability
    ),
  };
  await save([{ op: "createDevice", id, source: "virtual", details }]);
  await status({ ...temperature, deviceId: id, at: Date.now() });
  const suspended = statusPath + ".suspended";
  await rename(statusPath, suspended);
  await mkdir(statusPath);
  try {
    await save([{ op: "updateDevice", id, details: withoutTemperature }]);
    await save([{ op: "updateDevice", id, details }]);
  } finally {
    await rm(statusPath, { recursive: true });
    await rename(suspended, statusPath);
  }
  const reopened = (await call("GaiaOpen", { project })) as Opened;
  const result = (await call("GaiaStatus", {
    project,
    session: reopened.session,
  })) as { statuses: DeviceStatuses };
  assert.deepEqual(result.statuses, {});
});

test("an unreadable status sidecar does not block opening or world saves and is not overwritten", async (t) => {
  const { call, project, save, statusPath } = await siteProject(t);
  const id = randomUUID();
  await save([{ op: "createDevice", id, source: "virtual", details }]);
  await writeFile(statusPath, "{broken");
  const reopened = (await call("GaiaOpen", { project })) as Opened;
  await assert.rejects(
    call("GaiaStatus", { project, session: reopened.session }),
    /status file is unreadable/
  );
  const saved = (await call("GaiaSave", {
    retry: false,
    batch: {
      scope: "site",
      project,
      session: reopened.session,
      baseRevision: reopened.world.revision,
      operationId: randomUUID(),
      edits: [
        {
          op: "updateDevice",
          id,
          details: {
            ...details,
            capabilities: details.capabilities.filter(
              (capability) => capability !== temperature.capability
            ),
          },
        },
      ],
    },
  })) as Saved;
  assert.equal(saved.world.revision, reopened.world.revision + 1);
  assert.equal(await readFile(statusPath, "utf8"), "{broken");
  const reopenedAgain = (await call("GaiaOpen", { project })) as Opened;
  assert.deepEqual(reopenedAgain.world, saved.world);
  await assert.rejects(
    call("GaiaStatus", { project, session: reopenedAgain.session }),
    /status file is unreadable/
  );
});

test("a legacy status sidecar without a device identity is not trusted as current", async (t) => {
  const { save, status, statusPath } = await siteProject(t);
  const id = randomUUID();
  await save([{ op: "createDevice", id, source: "virtual", details }]);
  await status({ ...temperature, deviceId: id, at: Date.now() });
  const parsed = JSON.parse(await readFile(statusPath, "utf8")) as { devices: unknown };
  await writeFile(statusPath, JSON.stringify({ schemaVersion: 1, devices: parsed.devices }));
  assert.deepEqual((await status()).statuses, {});
  await status({ ...temperature, deviceId: id, value: 24, at: Date.now() });
  assert.equal((await status()).statuses[id]?.observations[temperature.capability]?.value, 24);
  const upgraded = JSON.parse(await readFile(statusPath, "utf8")) as { schemaVersion: number };
  assert.equal(upgraded.schemaVersion, 3);
});

test("renderer status snapshots are bound to the reconciled world revision", () => {
  const world = createSiteFixture();
  const statuses = recordStatus(
    world,
    {},
    { deviceId: "c3", source: "simulated", ...temperature, at: 20 },
    20
  );
  const snapshot: StatusSnapshot = { project: world.id, revision: world.revision, statuses };
  assert.equal(
    visibleStatuses(world, snapshot, false)["c3"]?.observations[temperature.capability]?.value,
    23
  );
  assert.deepEqual(visibleStatuses(world, snapshot, true), {});
  assert.deepEqual(visibleStatuses(world, { ...snapshot, project: "other" }, false), {});

  const removed = structuredClone(world);
  removed.devices["c3"]!.capabilities = [];
  removed.revision += 1;
  assert.deepEqual(visibleStatuses(removed, snapshot, false), {});
  const reconciled: StatusSnapshot = {
    project: world.id,
    revision: removed.revision,
    statuses: {},
  };
  assert.deepEqual(visibleStatuses(removed, reconciled, false), {});

  const readded = structuredClone(removed);
  readded.devices["c3"]!.capabilities = [temperature.capability];
  readded.revision += 1;
  assert.deepEqual(visibleStatuses(readded, reconciled, false), {});
  // Even stale renderer memory cannot revive the retired sample after the capability returns.
  assert.deepEqual(visibleStatuses(readded, snapshot, false), {});

  const moved = structuredClone(world);
  moved.revision += 1;
  moved.devices["c3"]!.name = "Renamed";
  moved.devices["c3"]!.mount = "mc2";
  const refreshed: StatusSnapshot = { ...snapshot, revision: moved.revision };
  assert.equal(
    visibleStatuses(moved, refreshed, false)["c3"]?.observations[temperature.capability]?.value,
    23
  );
});

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
  assert.deepEqual((await status()).statuses, {});
  await assert.rejects(status({ kind: "link", deviceId: id, state: "online" }), /identity/);
});
