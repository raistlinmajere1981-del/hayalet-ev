import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { mkdtemp, open, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test, { type TestContext } from "node:test";
import {
  capabilityDefinitions,
  capabilityIds,
  type CapabilityId,
} from "../../../../gaia-protocol/v1/src/schema.ts";
import { physicalSnapshot, type PhysicalSessionContext } from "../devices/physical.ts";
import {
  activeStatuses,
  connection,
  measuredFreshness,
  observationFreshness,
  recordStatus,
  type DeviceStatuses,
} from "../devices/status.ts";
import { createSiteFixture } from "../spatial/fixture.ts";
import {
  deviceStatusIdentity,
  projectPhysicalSnapshot,
  projectStatuses,
  reconcileDeviceStatuses,
} from "../storage/status-store.ts";

const fieldId = "field-1";
const hardwareId = "hw-1";
const units = Object.fromEntries(
  Object.entries(capabilityDefinitions).map(([id, definition]) => [id, definition.unit])
) as Record<CapabilityId, string>;

function fieldWorld() {
  const world = createSiteFixture();
  world.devices[fieldId] = {
    role: "sensor",
    roles: ["sensor"],
    name: "Field client",
    source: "physical",
    hardwareId,
    capabilities: [...capabilityIds],
  };
  return world;
}

function session(
  overrides: Partial<PhysicalSessionContext> = {},
  withWait = true
): PhysicalSessionContext {
  const context: PhysicalSessionContext = {
    deviceId: fieldId,
    hardwareId,
    installationId: randomUUID(),
    authorizationGeneration: 1,
    runId: randomUUID(),
    sessionId: randomUUID(),
    accepted: [...capabilityIds],
    acceptedAt: 2_000,
    acceptedMonoMs: 10_000,
    previousResponseMonoMs: 9_000,
    ...overrides,
  };
  if (withWait) return context;
  const withoutWait: Partial<PhysicalSessionContext> = { ...context };
  delete withoutWait.previousResponseMonoMs;
  return withoutWait as PhysicalSessionContext;
}

function sample(id: CapabilityId, value: unknown, mono = 1_000) {
  return { id, quality: "valid", sampleMonoMs: mono, unit: units[id], value };
}

function missing(id: CapabilityId) {
  return { id, quality: "missing", unit: units[id], value: null };
}

function invalid(id: CapabilityId, mono = 1_000) {
  return { id, quality: "invalid", sampleMonoMs: mono, unit: units[id], value: null };
}

function packet(
  context: PhysicalSessionContext,
  samples: unknown[],
  overrides: Record<string, unknown> = {}
) {
  return {
    v: 1,
    sessionId: context.sessionId,
    seq: 1,
    sentMonoMs: 1_500,
    deviceWallMs: 1_483_273_812_347,
    samples,
    ...overrides,
  };
}

function allSamples() {
  return [
    sample("battery.level.v1", 0),
    sample("battery.pack-temperature.v1", 19.9),
    sample("battery.voltage.v1", 4_312),
    sample("battery.charge-state.v1", "charging"),
    sample("accelerometer.xyz.v1", [0, 0, 0]),
    sample("proximity.state.v1", "far"),
    sample("network.state.v1", {
      transport: "wifi",
      internetCapable: true,
      validated: false,
    }),
    missing("signal.read.v1"),
  ];
}

test("physical snapshots accept all eight field capabilities and preserve other devices", () => {
  const world = fieldWorld();
  const virtual = recordStatus(
    world,
    {},
    {
      deviceId: "c3",
      source: "simulated",
      kind: "observation",
      capability: "temperature.read.v1",
      at: 20,
      quality: "valid",
      value: 23,
      unit: "°C",
    },
    20
  );
  const context = session();
  const next = physicalSnapshot(world, virtual, { context, packet: packet(context, allSamples()) });
  const status = next[fieldId]!;

  assert.deepEqual(next["c3"], virtual["c3"]);
  assert.equal(status.source, "measured");
  assert.equal(status.hardwareId, hardwareId);
  assert.deepEqual(status.link, { state: "online", at: 2_000 });
  assert.equal(status.lastContactAt, 2_000);
  assert.deepEqual(status.measured, {
    installationId: context.installationId,
    authorizationGeneration: 1,
    runId: context.runId,
    sessionId: context.sessionId,
    seq: 1,
    sentMonoMs: 1_500,
    deviceWallMs: 1_483_273_812_347,
    acceptedAt: 2_000,
    acceptedMonoMs: 10_000,
    order: status.measured?.order,
  });

  const observations = status.observations;
  assert.equal(observations["battery.level.v1"]?.value, 0);
  assert.equal(observations["battery.level.v1"]?.unit, "%");
  assert.equal(observations["battery.pack-temperature.v1"]?.value, 19.9);
  assert.equal(observations["battery.voltage.v1"]?.value, 4_312);
  assert.equal(observations["battery.charge-state.v1"]?.value, "charging");
  assert.deepEqual(observations["accelerometer.xyz.v1"]?.value, [0, 0, 0]);
  assert.equal(observations["proximity.state.v1"]?.value, "far");
  assert.deepEqual(observations["network.state.v1"]?.value, {
    transport: "wifi",
    internetCapable: true,
    validated: false,
  });
  assert.equal(observations["signal.read.v1"]?.quality, "missing");
  assert.equal(observations["signal.read.v1"]?.value, null);
  assert.equal("at" in observations["signal.read.v1"]!, false);
  assert.equal("sampleMonoMs" in observations["signal.read.v1"]!, false);

  const battery = observations["battery.level.v1"]!;
  assert.equal(battery.ageUpperMs, 1_500);
  assert.equal(battery.at, 500);
  assert.equal(battery.receivedAt, 2_000);
  assert.equal(battery.acceptedMonoMs, 10_000);
  assert.equal(measuredFreshness(status, battery, 10_000), "fresh");
  assert.equal(measuredFreshness(status, battery, 10_000 + 60_000 - 1_500 - 1), "fresh");
  assert.equal(measuredFreshness(status, battery, 10_000 + 60_000 - 1_500), "stale");
  // Without a live central monotonic anchor, a measured reading is never fresh.
  assert.equal(observationFreshness(status, battery, 10_000), "stale");
});

test("valid invalid and missing samples are normal states", () => {
  const world = fieldWorld();
  const context = session({
    accepted: ["battery.level.v1", "battery.voltage.v1", "signal.read.v1"],
  });
  const next = physicalSnapshot(
    world,
    {},
    {
      context,
      packet: packet(context, [
        invalid("battery.level.v1", 1_200),
        missing("battery.voltage.v1"),
        missing("signal.read.v1"),
      ]),
    }
  );
  const status = next[fieldId]!;
  assert.equal(status.observations["battery.level.v1"]?.quality, "invalid");
  assert.equal(status.observations["battery.level.v1"]?.value, null);
  assert.equal(status.observations["battery.voltage.v1"]?.quality, "missing");
  assert.equal(status.observations["signal.read.v1"]?.quality, "missing");
  assert.equal(measuredFreshness(status, status.observations["battery.level.v1"], 10_000), "fresh");
  assert.equal(
    measuredFreshness(status, status.observations["battery.voltage.v1"], 10_000),
    "noData"
  );
});

test("one invalid wire sample rejects the entire packet without touching state", () => {
  const world = fieldWorld();
  const context = session();
  const before: DeviceStatuses = {};
  for (const samples of [
    [sample("battery.level.v1", 50), sample("battery.voltage.v1", "4312")],
    [sample("battery.level.v1", 50), { ...sample("battery.voltage.v1", 4_312), unit: "V" }],
    [sample("battery.level.v1", 50), sample("signal.read.v1", -127)],
    [sample("battery.level.v1", 50), sample("accelerometer.xyz.v1", [0, 0])],
    [sample("battery.level.v1", 50), sample("battery.pack-temperature.v1", Infinity)],
    [sample("battery.level.v1", 50), sample("battery.voltage.v1", Number.NaN)],
    [sample("battery.level.v1", 50), { ...sample("battery.voltage.v1", 4_312), extra: true }],
    [
      sample("battery.level.v1", 50),
      {
        ...sample("network.state.v1", {
          transport: "none",
          internetCapable: true,
          validated: false,
        }),
      },
    ],
  ])
    assert.throws(() =>
      physicalSnapshot(world, before, { context, packet: packet(context, samples) })
    );
  assert.deepEqual(before, {});
});

test("packet coverage, duplicates, send time and accepted membership are enforced", () => {
  const world = fieldWorld();
  const context = session({ accepted: ["battery.level.v1", "battery.voltage.v1"] });
  const run = (samples: unknown[], overrides: Record<string, unknown> = {}) =>
    physicalSnapshot(world, {}, { context, packet: packet(context, samples, overrides) });

  assert.throws(() => run([sample("battery.level.v1", 50)]), /accepted|packet/);
  assert.throws(
    () =>
      run([
        sample("battery.level.v1", 50),
        sample("battery.voltage.v1", 4_312),
        sample("signal.read.v1", -40),
      ]),
    /accepted|packet/
  );
  assert.throws(
    () =>
      run([
        sample("battery.level.v1", 50),
        sample("battery.level.v1", 51),
        sample("battery.voltage.v1", 4_312),
      ]),
    /duplicate|packet/
  );
  assert.throws(
    () =>
      run([sample("battery.level.v1", 50), sample("battery.voltage.v1", 4_312)], {
        sentMonoMs: 900,
      }),
    /send|packet/
  );
  assert.throws(
    () =>
      physicalSnapshot(
        world,
        {},
        {
          context: { ...context, sessionId: randomUUID() },
          packet: packet(context, [
            sample("battery.level.v1", 50),
            sample("battery.voltage.v1", 4_312),
          ]),
        }
      ),
    /session|packet/
  );
  assert.throws(
    () =>
      physicalSnapshot(
        world,
        {},
        {
          context: { ...context, hardwareId: "hw-2" },
          packet: packet(context, [
            sample("battery.level.v1", 50),
            sample("battery.voltage.v1", 4_312),
          ]),
        }
      ),
    /identity|hardware/
  );
  assert.throws(
    () =>
      physicalSnapshot(
        world,
        {},
        {
          context: { ...context, accepted: ["battery.level.v1", "camera.view.v1"] },
          packet: packet(context, [
            sample("battery.level.v1", 50),
            { id: "camera.view.v1", quality: "missing", unit: "1", value: null },
          ]),
        }
      ),
    /accepted|capability/
  );
});

test("an empty accepted set is a heartbeat and clears that device's observations", () => {
  const world = fieldWorld();
  const context = session({ accepted: ["battery.level.v1"] });
  const first = physicalSnapshot(
    world,
    {},
    {
      context,
      packet: packet(context, [sample("battery.level.v1", 50)]),
    }
  );
  const heartbeat = session({
    ...context,
    accepted: [],
    acceptedAt: 3_000,
    acceptedMonoMs: 12_000,
    previousResponseMonoMs: 11_000,
  });
  const next = physicalSnapshot(world, first, {
    context: heartbeat,
    packet: packet(heartbeat, [], { seq: 2, sentMonoMs: 1_600 }),
  });
  assert.deepEqual(next[fieldId]?.observations, {});
  assert.deepEqual(next[fieldId]?.link, { state: "online", at: 3_000 });
  assert.equal(next[fieldId]?.measured?.seq, 2);
});

test("same-sample resend keeps first acceptance and freshness, older samples are rejected", () => {
  const world = fieldWorld();
  const context = session({ accepted: ["battery.level.v1"] });
  const first = physicalSnapshot(
    world,
    {},
    {
      context,
      packet: packet(context, [sample("battery.level.v1", 50, 1_000)]),
    }
  );
  const firstReading = first[fieldId]!.observations["battery.level.v1"]!;
  assert.equal(firstReading.ageUpperMs, 1_500);
  assert.equal(firstReading.at, 500);
  assert.equal(firstReading.receivedAt, 2_000);
  assert.equal(firstReading.acceptedMonoMs, 10_000);

  const resend = session({
    ...context,
    acceptedAt: 3_000,
    acceptedMonoMs: 12_000,
    previousResponseMonoMs: 11_000,
  });
  const second = physicalSnapshot(world, first, {
    context: resend,
    packet: packet(resend, [sample("battery.level.v1", 50, 1_000)], {
      seq: 2,
      sentMonoMs: 1_500,
      deviceWallMs: 1,
    }),
  });
  const secondReading = second[fieldId]!.observations["battery.level.v1"]!;
  assert.deepEqual(secondReading, firstReading);
  assert.equal(second[fieldId]?.measured?.seq, 2);
  assert.equal(second[fieldId]?.measured?.acceptedAt, 3_000);
  assert.equal(second[fieldId]?.measured?.deviceWallMs, 1);
  assert.equal(measuredFreshness(second[fieldId], secondReading, 12_000), "fresh");

  const older = session({
    ...context,
    acceptedAt: 4_000,
    acceptedMonoMs: 14_000,
    previousResponseMonoMs: 13_000,
  });
  assert.throws(() =>
    physicalSnapshot(world, second, {
      context: older,
      packet: packet(older, [sample("battery.level.v1", 50, 900)], { seq: 3, sentMonoMs: 1_500 }),
    })
  );
  assert.deepEqual(second[fieldId]!.observations["battery.level.v1"], firstReading);
});

test("missing does not erase ordering memory and a same-sample resend restores the original view", () => {
  const world = fieldWorld();
  const context = session({ accepted: ["battery.level.v1"] });
  const first = physicalSnapshot(
    world,
    {},
    {
      context,
      packet: packet(context, [sample("battery.level.v1", 50, 1_000)]),
    }
  );
  const missingPacket = session({
    ...context,
    acceptedAt: 3_000,
    acceptedMonoMs: 12_000,
    previousResponseMonoMs: 11_000,
  });
  const second = physicalSnapshot(world, first, {
    context: missingPacket,
    packet: packet(missingPacket, [missing("battery.level.v1")], { seq: 2, sentMonoMs: 1_600 }),
  });
  assert.equal(second[fieldId]!.observations["battery.level.v1"]?.quality, "missing");
  assert.equal(second[fieldId]!.measured?.order?.["battery.level.v1"]?.sampleMonoMs, 1_000);

  const older = session({
    ...context,
    acceptedAt: 4_000,
    acceptedMonoMs: 14_000,
    previousResponseMonoMs: 13_000,
  });
  assert.throws(() =>
    physicalSnapshot(world, second, {
      context: older,
      packet: packet(older, [sample("battery.level.v1", 50, 900)], { seq: 3, sentMonoMs: 1_800 }),
    })
  );

  const restore = session({
    ...context,
    acceptedAt: 5_000,
    acceptedMonoMs: 16_000,
    previousResponseMonoMs: 15_000,
  });
  const third = physicalSnapshot(world, second, {
    context: restore,
    packet: packet(restore, [sample("battery.level.v1", 50, 1_000)], { seq: 3, sentMonoMs: 1_700 }),
  });
  const restored = third[fieldId]!.observations["battery.level.v1"]!;
  assert.equal(restored.quality, "valid");
  assert.equal(restored.value, 50);
  assert.equal(restored.receivedAt, 2_000);
  assert.equal(restored.ageUpperMs, 1_500);
  assert.equal(restored.acceptedMonoMs, 10_000);
});

test("device wall clock never orders or refreshes measured samples", () => {
  const world = fieldWorld();
  const context = session({ accepted: ["battery.level.v1"] });
  const first = physicalSnapshot(
    world,
    {},
    {
      context,
      packet: packet(context, [sample("battery.level.v1", 50, 1_000)], { deviceWallMs: 1 }),
    }
  );
  const second = physicalSnapshot(world, first, {
    context: {
      ...context,
      acceptedAt: 3_000,
      acceptedMonoMs: 12_000,
      previousResponseMonoMs: 11_000,
    },
    packet: packet(context, [sample("battery.level.v1", 50, 1_000)], {
      seq: 2,
      sentMonoMs: 1_500,
      deviceWallMs: 9_999_999_999_999,
    }),
  });
  assert.equal(second[fieldId]!.observations["battery.level.v1"]?.receivedAt, 2_000);
  assert.equal(second[fieldId]!.observations["battery.level.v1"]?.ageUpperMs, 1_500);
});

test("freshness requires a known central wait anchor", () => {
  const world = fieldWorld();
  const context = session({ accepted: ["battery.level.v1"] }, false);
  const statuses = physicalSnapshot(
    world,
    {},
    {
      context,
      packet: packet(context, [sample("battery.level.v1", 50)]),
    }
  );
  const status = statuses[fieldId]!;
  const reading = status.observations["battery.level.v1"]!;
  assert.equal(reading.ageUpperMs, undefined);
  assert.equal("at" in reading, false);
  assert.equal(measuredFreshness(status, reading, 10_000), "stale");
  assert.equal(observationFreshness(status, reading, 2_000), "stale");
});

test("a reconnect heartbeat cannot make a pre-offline measurement fresh", () => {
  const world = fieldWorld();
  const context = session({ accepted: ["battery.level.v1"] });
  const first = physicalSnapshot(
    world,
    {},
    {
      context,
      packet: packet(context, [sample("battery.level.v1", 50)]),
    }
  );
  const offline = recordStatus(
    world,
    first,
    {
      deviceId: fieldId,
      source: "measured",
      hardwareId,
      kind: "link",
      state: "offline",
    },
    3_000
  );
  assert.equal(offline[fieldId]?.link?.state, "offline");
  assert.equal(offline[fieldId]?.lastOfflineAt, 3_000);

  const heartbeat = session({
    ...context,
    acceptedAt: 4_000,
    acceptedMonoMs: 14_000,
    previousResponseMonoMs: 13_000,
  });
  const next = physicalSnapshot(world, offline, {
    context: heartbeat,
    packet: packet(heartbeat, [sample("battery.level.v1", 50, 1_000)], {
      seq: 2,
      sentMonoMs: 1_500,
    }),
  });
  assert.equal(next[fieldId]?.link?.state, "online");
  assert.equal(next[fieldId]?.observations["battery.level.v1"]?.receivedAt, 2_000);
  assert.equal(
    measuredFreshness(next[fieldId], next[fieldId]?.observations["battery.level.v1"], 14_000),
    "stale"
  );
});

test("a same-time sample with a conflicting value rejects the whole packet", () => {
  const world = fieldWorld();
  const context = session({ accepted: ["battery.level.v1"] });
  const first = physicalSnapshot(
    world,
    {},
    {
      context,
      packet: packet(context, [sample("battery.level.v1", 50)]),
    }
  );
  const conflict = session({
    ...context,
    acceptedAt: 3_000,
    acceptedMonoMs: 12_000,
    previousResponseMonoMs: 11_000,
  });
  assert.throws(() =>
    physicalSnapshot(world, first, {
      context: conflict,
      packet: packet(conflict, [sample("battery.level.v1", 51, 1_000)], {
        seq: 2,
        sentMonoMs: 1_500,
      }),
    })
  );
  assert.equal(first[fieldId]?.observations["battery.level.v1"]?.value, 50);
});

test("a 65 second heartbeat keeps the link online but the last sample stale", () => {
  const world = fieldWorld();
  const context = session({ accepted: ["battery.level.v1"] });
  const first = physicalSnapshot(
    world,
    {},
    {
      context,
      packet: packet(context, [sample("battery.level.v1", 50)]),
    }
  );
  const late = session({
    ...context,
    acceptedAt: 70_000,
    acceptedMonoMs: 80_000,
    previousResponseMonoMs: 79_000,
  });
  const next = physicalSnapshot(world, first, {
    context: late,
    packet: packet(late, [sample("battery.level.v1", 50, 1_000)], {
      seq: 2,
      sentMonoMs: 1_700,
    }),
  });
  assert.equal(next[fieldId]?.link?.state, "online");
  assert.equal(next[fieldId]?.observations["battery.level.v1"]?.receivedAt, 2_000);
  assert.equal(
    measuredFreshness(next[fieldId], next[fieldId]?.observations["battery.level.v1"], 80_000),
    "stale"
  );
});

test("removing and re-adding a measured capability does not revive its observation", () => {
  const world = fieldWorld();
  const context = session({ accepted: ["battery.level.v1"] });
  const statuses = physicalSnapshot(
    world,
    {},
    {
      context,
      packet: packet(context, [sample("battery.level.v1", 50)]),
    }
  );
  const identity = deviceStatusIdentity(world);
  const removed = structuredClone(world);
  removed.devices[fieldId]!.capabilities = removed.devices[fieldId]!.capabilities.filter(
    (id) => id !== "battery.level.v1"
  );
  const retired = reconcileDeviceStatuses(removed, identity, { identity, statuses });
  assert.deepEqual(retired[fieldId]?.observations ?? {}, {});
  const readded = structuredClone(world);
  readded.devices[fieldId]!.capabilities = [...capabilityIds];
  assert.deepEqual(activeStatuses(readded, retired)[fieldId]?.observations ?? {}, {});
});

test("hardware identity changes retire measured records and rebinding does not revive them", () => {
  const world = fieldWorld();
  const context = session({ accepted: ["battery.level.v1"] });
  const statuses = physicalSnapshot(
    world,
    {},
    {
      context,
      packet: packet(context, [sample("battery.level.v1", 50)]),
    }
  );
  const identity = deviceStatusIdentity(world);
  const rebound = structuredClone(world);
  rebound.devices[fieldId]!.hardwareId = "hw-2";
  const retired = reconcileDeviceStatuses(rebound, identity, { identity, statuses });
  assert.deepEqual(retired, {});
  const stored = { identity: deviceStatusIdentity(rebound), statuses: retired };
  assert.deepEqual(reconcileDeviceStatuses(world, stored.identity, stored), {});
});

async function storageRoot(t: TestContext) {
  const root = await mkdtemp(join(tmpdir(), "gaia-physical-"));
  t.after(async () => await rm(root, { recursive: true, force: true }));
  return root;
}

test("v3 sidecar stores session proof and reads measured records as last-known only", async (t) => {
  const dir = await storageRoot(t);
  const world = fieldWorld();
  const context = session({ accepted: ["battery.level.v1"] });
  const live = await projectPhysicalSnapshot(dir, world, 0, {
    context,
    packet: packet(context, [sample("battery.level.v1", 50)]),
  });
  const path = join(dir, "device-status.json");
  const stored = JSON.parse(await readFile(path, "utf8")) as Record<string, unknown>;
  assert.equal(stored["schemaVersion"], 3);
  assert.equal(stored["identity"], deviceStatusIdentity(world, 0));
  const row = (stored["devices"] as Record<string, Record<string, unknown>>)[fieldId]!;
  assert.equal(row["hardwareId"], hardwareId);
  // An online flag is RAM evidence, not durable status; only contact/offline times persist.
  assert.equal("link" in row, false);
  const measured = row["measured"] as Record<string, unknown>;
  assert.equal(measured["installationId"], context.installationId);
  assert.equal(measured["authorizationGeneration"], 1);
  assert.equal(measured["runId"], context.runId);
  assert.equal(measured["sessionId"], context.sessionId);
  assert.equal(measured["seq"], 1);
  assert.equal(measured["sentMonoMs"], 1_500);
  assert.equal(measured["deviceWallMs"], 1_483_273_812_347);
  assert.equal(measured["acceptedAt"], 2_000);
  assert.equal("acceptedMonoMs" in measured, false);
  const reading = (row["observations"] as Record<string, Record<string, unknown>>)[
    "battery.level.v1"
  ]!;
  assert.equal(reading["sampleMonoMs"], 1_000);
  assert.equal(reading["ageUpperMs"], 1_500);
  assert.equal(reading["receivedAt"], 2_000);
  assert.equal("acceptedMonoMs" in reading, false);

  assert.equal(
    measuredFreshness(live[fieldId], live[fieldId]!.observations["battery.level.v1"], 10_000),
    "fresh"
  );
  const reread = await projectStatuses(dir, world, 0);
  const rereadReading = reread[fieldId]!.observations["battery.level.v1"]!;
  assert.equal(rereadReading.value, 50);
  assert.equal(rereadReading.at, 500);
  assert.equal(rereadReading.acceptedMonoMs, undefined);
  assert.equal(reread[fieldId]?.link, undefined);
  assert.equal(connection(world.devices[fieldId]!, reread[fieldId]), "unknown");
  assert.equal(measuredFreshness(reread[fieldId], rereadReading, 10_000), "stale");
});

test("v2 virtual records survive the v3 transition and v2 measured records stay last-known", async (t) => {
  const dir = await storageRoot(t);
  const world = fieldWorld();
  const virtual = recordStatus(
    world,
    {},
    {
      deviceId: "c3",
      source: "simulated",
      kind: "observation",
      capability: "temperature.read.v1",
      at: 20,
      quality: "valid",
      value: 23,
      unit: "°C",
    },
    20
  );
  const measured: DeviceStatuses = {
    [fieldId]: {
      source: "measured",
      hardwareId,
      link: { state: "online", at: 30 },
      lastContactAt: 30,
      observations: {
        "battery.level.v1": {
          at: 30,
          receivedAt: 30,
          value: 44,
          unit: "%",
          source: "measured",
          quality: "valid",
        },
      },
    },
  };
  await writeFile(
    join(dir, "device-status.json"),
    JSON.stringify({
      schemaVersion: 2,
      identity: deviceStatusIdentity(world, 0),
      devices: { ...virtual, ...measured },
    })
  );
  const read = await projectStatuses(dir, world, 0);
  assert.equal(read["c3"]?.observations["temperature.read.v1"]?.value, 23);
  assert.equal(read[fieldId]?.observations["battery.level.v1"]?.value, 44);
  assert.equal(connection(world.devices[fieldId]!, read[fieldId]), "unknown");
  assert.equal(
    measuredFreshness(read[fieldId], read[fieldId]?.observations["battery.level.v1"], 1_000),
    "stale"
  );

  await projectStatuses(dir, world, 0, {
    deviceId: "c3",
    source: "simulated",
    kind: "link",
    state: "online",
  });
  const upgraded = JSON.parse(await readFile(join(dir, "device-status.json"), "utf8")) as {
    schemaVersion: number;
    devices: DeviceStatuses;
  };
  assert.equal(upgraded.schemaVersion, 3);
  assert.equal(upgraded.devices["c3"]?.observations["temperature.read.v1"]?.value, 23);
  assert.equal(upgraded.devices[fieldId]?.observations["battery.level.v1"]?.value, 44);
  const reread = await projectStatuses(dir, world, 0);
  assert.equal(reread["c3"]?.observations["temperature.read.v1"]?.value, 23);
  assert.equal(reread[fieldId]?.observations["battery.level.v1"]?.value, 44);
  assert.equal(
    measuredFreshness(reread[fieldId], reread[fieldId]?.observations["battery.level.v1"], 1_000),
    "stale"
  );
});

test("a trusted v3 field row with an out-of-range value is rejected and preserved", async (t) => {
  const dir = await storageRoot(t);
  const world = fieldWorld();
  const context = session({ accepted: ["battery.level.v1"] });
  await projectPhysicalSnapshot(dir, world, 0, {
    context,
    packet: packet(context, [sample("battery.level.v1", 50)]),
  });
  const path = join(dir, "device-status.json");
  const stored = JSON.parse(await readFile(path, "utf8")) as {
    devices: Record<string, { observations: Record<string, { value: unknown }> }>;
  };
  stored.devices[fieldId]!.observations["battery.level.v1"]!.value = 101;
  await writeFile(path, JSON.stringify(stored));
  await assert.rejects(projectStatuses(dir, world, 0), /unreadable/);
  const preserved = JSON.parse(await readFile(path, "utf8")) as typeof stored;
  assert.equal(preserved.devices[fieldId]?.observations["battery.level.v1"]?.value, 101);
});

test("a failed sidecar publish leaves no status file and returns no ACK", async (t) => {
  const dir = await storageRoot(t);
  const world = fieldWorld();
  const context = session({ accepted: ["battery.level.v1"] });
  const probe = await open(join(dir, "probe"), "w");
  const proto: object = Object.getPrototypeOf(probe) as object;
  await probe.close();
  const mock = t.mock.method(proto as { writeFile: () => Promise<void> }, "writeFile", async () => {
    throw Object.assign(new Error("Disk full"), { code: "ENOSPC" });
  });
  try {
    await assert.rejects(
      projectPhysicalSnapshot(dir, world, 0, {
        context,
        packet: packet(context, [sample("battery.level.v1", 50)]),
      }),
      /Disk full/
    );
  } finally {
    mock.mock.restore();
  }
  await assert.rejects(readFile(join(dir, "device-status.json")), /ENOENT/);
});

test("an unknown sidecar version is preserved and fails closed", async (t) => {
  const dir = await storageRoot(t);
  const world = fieldWorld();
  const path = join(dir, "device-status.json");
  const bytes = JSON.stringify({
    schemaVersion: 4,
    identity: "0".repeat(64),
    devices: {},
  });
  await writeFile(path, bytes);
  await assert.rejects(projectStatuses(dir, world, 0), /unreadable/);
  const context = session({ accepted: ["battery.level.v1"] });
  await assert.rejects(
    projectPhysicalSnapshot(dir, world, 0, {
      context,
      packet: packet(context, [sample("battery.level.v1", 50)]),
    }),
    /unreadable/
  );
  assert.equal(await readFile(path, "utf8"), bytes);
});

test("v1 and mismatched identities are untrusted while corrupt files are preserved", async (t) => {
  const dir = await storageRoot(t);
  const world = fieldWorld();
  const path = join(dir, "device-status.json");
  const context = session({ accepted: ["battery.level.v1"] });
  await writeFile(
    path,
    JSON.stringify({
      schemaVersion: 1,
      devices: {
        c3: {
          source: "simulated",
          observations: {
            "temperature.read.v1": {
              at: 20,
              receivedAt: 20,
              value: 23,
              unit: "°C",
              source: "simulated",
              quality: "valid",
            },
          },
        },
      },
    })
  );
  assert.deepEqual(await projectStatuses(dir, world, 0), {});
  const first = await projectPhysicalSnapshot(dir, world, 0, {
    context,
    packet: packet(context, [sample("battery.level.v1", 50)]),
  });
  assert.equal(first[fieldId]?.observations["battery.level.v1"]?.value, 50);
  assert.equal(
    (JSON.parse(await readFile(path, "utf8")) as { schemaVersion: number }).schemaVersion,
    3
  );

  await writeFile(
    path,
    JSON.stringify({ schemaVersion: 3, identity: "0".repeat(64), devices: {} })
  );
  assert.deepEqual(await projectStatuses(dir, world, 0), {});
  await projectPhysicalSnapshot(dir, world, 0, {
    context,
    packet: packet(context, [sample("battery.level.v1", 51)], { seq: 2 }),
  });
  const repaired = JSON.parse(await readFile(path, "utf8")) as {
    identity: string;
    devices: DeviceStatuses;
  };
  assert.equal(repaired.identity, deviceStatusIdentity(world, 0));
  assert.equal(repaired.devices[fieldId]?.observations["battery.level.v1"]?.value, 51);

  await writeFile(path, "{broken");
  await assert.rejects(projectStatuses(dir, world, 0), /unreadable/);
  await assert.rejects(
    projectPhysicalSnapshot(dir, world, 0, {
      context,
      packet: packet(context, [sample("battery.level.v1", 52)], { seq: 3 }),
    }),
    /unreadable/
  );
  assert.equal(await readFile(path, "utf8"), "{broken");
});

test("missed reconciliations cannot revive measured records when inventory returns to the same shape", async (t) => {
  const dir = await storageRoot(t);
  const world = fieldWorld();
  const context = session({ accepted: ["battery.level.v1"] });
  await projectPhysicalSnapshot(dir, world, 0, {
    context,
    packet: packet(context, [sample("battery.level.v1", 50)]),
  });
  const storedIdentity = deviceStatusIdentity(world, 0);
  const without = structuredClone(world);
  without.devices[fieldId]!.capabilities = without.devices[fieldId]!.capabilities.filter(
    (id) => id !== "battery.level.v1"
  );
  const readded = structuredClone(world);
  assert.notEqual(deviceStatusIdentity(without, 1), storedIdentity);
  assert.notEqual(deviceStatusIdentity(readded, 2), storedIdentity);

  // A -> B and B -> A world publications both miss their sidecar reconciliation.
  assert.deepEqual(await projectStatuses(dir, readded, 2), {});
  const heartbeat = session({
    ...context,
    accepted: [],
    acceptedAt: 5_000,
    acceptedMonoMs: 16_000,
    previousResponseMonoMs: 15_000,
  });
  const next = await projectPhysicalSnapshot(dir, readded, 2, {
    context: heartbeat,
    packet: packet(heartbeat, [], { seq: 2, sentMonoMs: 1_700 }),
  });
  assert.deepEqual(next[fieldId]?.observations, {});
  assert.deepEqual((await projectStatuses(dir, readded, 2))[fieldId]?.observations, {});
});

test("successive persisted snapshots preserve live evidence across disk reads and missing", async (t) => {
  const dir = await storageRoot(t);
  const world = fieldWorld();
  const context = session({ accepted: ["battery.level.v1"] });
  const first = await projectPhysicalSnapshot(dir, world, 0, {
    context,
    packet: packet(context, [sample("battery.level.v1", 50)]),
  });
  const proof = { identity: deviceStatusIdentity(world, 0), status: first[fieldId]! };
  const later = session({
    ...context,
    acceptedAt: 3_000,
    acceptedMonoMs: 12_000,
    previousResponseMonoMs: 11_000,
  });
  const input = {
    context: later,
    packet: packet(later, [sample("battery.level.v1", 50)], { seq: 2, sentMonoMs: 1_800 }),
  };
  const path = join(dir, "device-status.json");
  const before = await readFile(path, "utf8");
  await assert.rejects(projectPhysicalSnapshot(dir, world, 0, input), /continuity unavailable/);
  await assert.rejects(projectPhysicalSnapshot(dir, world, 1, input, proof), /continuity mismatch/);
  assert.equal(await readFile(path, "utf8"), before);
  const next = await projectPhysicalSnapshot(dir, world, 0, input, proof);
  assert.deepEqual(
    next[fieldId]?.observations["battery.level.v1"],
    first[fieldId]?.observations["battery.level.v1"]
  );
  const missingContext = session({
    ...later,
    acceptedAt: 4_000,
    acceptedMonoMs: 14_000,
    previousResponseMonoMs: 13_000,
  });
  const missingInput = {
    context: missingContext,
    packet: packet(missingContext, [missing("battery.level.v1")], { seq: 3, sentMonoMs: 2_000 }),
  };
  const nextProof = { identity: proof.identity, status: next[fieldId]! };
  await assert.rejects(
    projectPhysicalSnapshot(dir, world, 0, missingInput, proof),
    /continuity mismatch/
  );
  const gap = await projectPhysicalSnapshot(dir, world, 0, missingInput, nextProof);
  assert.equal(gap[fieldId]?.observations["battery.level.v1"]?.quality, "missing");
  const gapProof = { identity: proof.identity, status: gap[fieldId]! };
  const lastContext = session({
    ...later,
    acceptedAt: 5_000,
    acceptedMonoMs: 16_000,
    previousResponseMonoMs: 15_000,
  });
  const lastBytes = await readFile(path, "utf8");
  await assert.rejects(
    projectPhysicalSnapshot(
      dir,
      world,
      0,
      {
        context: lastContext,
        packet: packet(lastContext, [sample("battery.level.v1", 49, 900)], {
          seq: 4,
          sentMonoMs: 2_200,
        }),
      },
      gapProof
    ),
    /regressed/
  );
  assert.equal(await readFile(path, "utf8"), lastBytes);
  const restored = await projectPhysicalSnapshot(
    dir,
    world,
    0,
    {
      context: lastContext,
      packet: packet(lastContext, [sample("battery.level.v1", 50)], { seq: 4, sentMonoMs: 2_200 }),
    },
    gapProof
  );
  assert.deepEqual(
    restored[fieldId]?.observations["battery.level.v1"],
    first[fieldId]?.observations["battery.level.v1"]
  );
  const restarted = session({ accepted: ["battery.level.v1"] });
  const fresh = await projectPhysicalSnapshot(dir, world, 0, {
    context: restarted,
    packet: packet(restarted, [sample("battery.level.v1", 51)]),
  });
  assert.equal(fresh[fieldId]?.observations["battery.level.v1"]?.value, 51);
});
