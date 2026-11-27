import assert from "node:assert/strict";
import test from "node:test";
import en from "../../i18n/en.json" with { type: "json" };
import tr from "../../i18n/tr.json" with { type: "json" };
import { FieldStatusReader } from "../editor/field-client.ts";
import { markCalibrationPoint } from "../editor/site/calibration.ts";
import { deviceBadgeHealth } from "../editor/site/device-view.ts";
import { commitDraft } from "../editor/site/draft.ts";
import { describeError } from "../editor/site/errors.ts";
import {
  deviceAssignments,
  fieldErrorText,
  isFieldReply,
  latestEstimatedMeasurement,
  nextPhysicalExpiryDelay,
  parseHttpsOrigin,
  physicalConnection,
  physicalHealth,
  validateFieldEndpoint,
} from "../editor/site/field.ts";
import { revealSelection } from "../editor/site/framing.ts";
import { StatusSession, nextFreshnessDeadline } from "../editor/site/status-session.ts";
import type { GaiaStatusReply, PhysicalView } from "../devices/field-view.ts";
import { freshForMs, type DeviceStatuses, type StatusSnapshot } from "../devices/status.ts";
import { createSiteFixture } from "../spatial/fixture.ts";
import type { SiteEdit } from "../spatial/site-edits.ts";
import type { Device } from "../spatial/world.ts";

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((done, fail) => {
    resolve = done;
    reject = fail;
  });
  return { promise, reject, resolve };
}

test("draft commits keep history until the draft returns to the saved inventory", () => {
  const base = createSiteFixture();
  const edit: SiteEdit = {
    op: "add",
    id: "temporary-mount",
    node: {
      kind: "mount",
      name: "Temporary mount",
      parent: "plot",
      p: [1, 2, 0],
      yaw: 0,
      geometry: { kind: "point" },
    },
  };
  const added = commitDraft(base, base, [], [edit]);
  assert.notEqual(added.world, base);
  assert.equal(added.edits.length, 1);
  assert.ok(added.world.nodes["temporary-mount"]);

  const removed = commitDraft(base, added.world, added.edits, [
    { op: "remove", ids: ["temporary-mount"], detach: [] },
  ]);
  assert.equal(removed.world, base);
  assert.deepEqual(removed.edits, []);

  const noop = commitDraft(base, base, [], []);
  assert.equal(noop.world, base);
  assert.deepEqual(noop.edits, []);
  assert.throws(() =>
    commitDraft(base, base, [], [{ op: "remove", ids: ["missing"], detach: [] }])
  );
});

test("status session applies only the latest request and clears snapshots on failure", async () => {
  const first = deferred<{ statuses: DeviceStatuses; revision: number }>();
  const second = deferred<{ statuses: DeviceStatuses; revision: number }>();
  const pending = [first, second];
  let snapshot: StatusSnapshot | undefined;
  let busy = false;
  let unreadable = false;
  let observed = 0;
  const session = new StatusSession({
    read: () => pending.shift()!.promise,
    active: () => true,
    busy: (value) => (busy = value),
    error: (value) => (unreadable = value),
    observed: (value) => (observed = value),
    now: () => 1234,
    snapshot: (value) => (snapshot = value),
  });

  const older = session.load("plot", "one");
  const newer = session.load("plot", "two");
  second.resolve({ statuses: {}, revision: 8 });
  assert.equal(await newer, true);
  assert.deepEqual(snapshot, { project: "plot", revision: 8, statuses: {} });
  assert.equal(busy, false);
  assert.equal(observed, 1234);
  first.resolve({ statuses: {}, revision: 3 });
  assert.equal(await older, false);
  assert.equal(snapshot?.revision, 8);

  const failed = deferred<{ statuses: DeviceStatuses; revision: number }>();
  pending.push(failed);
  const failure = session.load("plot", "three");
  failed.reject(new Error("offline"));
  assert.equal(await failure, false);
  assert.equal(snapshot, undefined);
  assert.equal(unreadable, true);
  assert.equal(busy, false);
});

test("cancelling a status session drops the in-flight result", async () => {
  const request = deferred<{ statuses: DeviceStatuses; revision: number }>();
  let snapshot: StatusSnapshot | undefined = { project: "plot", revision: 1, statuses: {} };
  let busy = true;
  const session = new StatusSession({
    read: () => request.promise,
    active: () => true,
    busy: (value) => (busy = value),
    error: () => {},
    observed: () => {},
    now: () => 1,
    snapshot: (value) => (snapshot = value),
  });
  const loading = session.load("plot", "one");
  session.cancel();
  assert.equal(busy, false);
  request.resolve({ statuses: {}, revision: 2 });
  assert.equal(await loading, false);
  assert.equal(snapshot?.revision, 1);
});

test("freshness deadline ignores stale observations and stops when none are fresh", () => {
  const now = 1_000_000;
  const statuses: DeviceStatuses = {
    c2: {
      source: "simulated",
      observations: {
        "humidity.read.v1": {
          at: now - 30_000,
          receivedAt: now - 30_000,
          value: 42,
          unit: "%",
          source: "simulated",
          quality: "valid",
        },
      },
    },
  };
  assert.equal(nextFreshnessDeadline(statuses, now), now - 30_000 + freshForMs);
  assert.equal(nextFreshnessDeadline(statuses, now + freshForMs), undefined);
  assert.equal(nextFreshnessDeadline({}, now), undefined);
});

test("revealing a selection restores its mount, kind and underground visibility", () => {
  const world = createSiteFixture();
  const device = revealSelection(world, "c2", {
    visible: false,
    hidden: new Set(["bed", "mc2"]),
    hiddenKinds: new Set(["device"]),
    underground: false,
  });
  assert.equal(device.revealed, true);
  assert.deepEqual([...device.hidden], []);
  assert.deepEqual([...device.hiddenKinds], []);
  assert.equal(device.underground, false);

  const floor = revealSelection(world, "cellar", {
    visible: false,
    hidden: new Set(["cellar", "glass"]),
    hiddenKinds: new Set(["floor"]),
    underground: false,
  });
  assert.equal(floor.revealed, true);
  assert.equal(floor.underground, true);
  assert.deepEqual([...floor.hidden], []);

  const hidden = new Set(["mc2"]);
  const already = revealSelection(world, "c2", {
    visible: true,
    hidden,
    hiddenKinds: new Set(),
    underground: false,
  });
  assert.equal(already.revealed, false);
  assert.equal(already.hidden, hidden);
});

test("calibration marks enforce image bounds and distinct points", () => {
  assert.deepEqual(markCalibrationPoint([], [400, 600], [10, 10]), {
    ok: true,
    points: [[10, 10]],
  });
  assert.deepEqual(markCalibrationPoint([[10, 10]], [400, 600], [110, 20]), {
    ok: true,
    points: [
      [10, 10],
      [110, 20],
    ],
  });
  assert.deepEqual(
    markCalibrationPoint(
      [
        [10, 10],
        [110, 20],
      ],
      [400, 600],
      [200, 20]
    ),
    {
      ok: true,
      points: [[200, 20]],
    }
  );
  assert.deepEqual(markCalibrationPoint([[10, 10]], [400, 600], [10, 10]), {
    ok: false,
    reason: "coincident",
  });
  assert.deepEqual(markCalibrationPoint([], [400, 600], [-1, 10]), {
    ok: false,
    reason: "outside",
  });
  assert.deepEqual(markCalibrationPoint([], [400, 600], [401, 10]), {
    ok: false,
    reason: "outside",
  });
  assert.deepEqual(markCalibrationPoint([], undefined, [10, 10]), {
    ok: false,
    reason: "outside",
  });
  assert.deepEqual(markCalibrationPoint([], [400, 600], [400, 600]), {
    ok: true,
    points: [[400, 600]],
  });
});

test("error descriptions keep the cause and fall back without leaking Error prefixes", () => {
  assert.equal(describeError(new Error("disk is full"), "Unknown"), "disk is full");
  assert.equal(describeError("already a message", "Unknown"), "already a message");
  assert.equal(describeError({ message: "structured" }, "Unknown"), "structured");
  assert.equal(describeError(undefined, "Unknown"), "Unknown");
  assert.equal(describeError(new Error(""), "Unknown"), "Unknown");
});

test("field endpoint validation rejects wildcard binds, mismatched ports and non-canonical origins", () => {
  assert.deepEqual(parseHttpsOrigin("https://127.0.0.1:8443"), {
    ok: true,
    host: "127.0.0.1",
    port: 8443,
    origin: "https://127.0.0.1:8443",
  });
  assert.deepEqual(parseHttpsOrigin("https://gaia.local"), {
    ok: true,
    host: "gaia.local",
    port: 443,
    origin: "https://gaia.local",
  });
  assert.deepEqual(parseHttpsOrigin("https://[::1]:8443"), {
    ok: true,
    host: "::1",
    port: 8443,
    origin: "https://[::1]:8443",
  });
  assert.equal(parseHttpsOrigin("http://127.0.0.1:8443").ok, false);
  assert.equal(parseHttpsOrigin("https://127.0.0.1:8443/").ok, false);
  assert.equal(parseHttpsOrigin(" https://127.0.0.1:8443").ok, false);
  assert.equal(parseHttpsOrigin("https://127.0.0.1:0").ok, false);

  assert.deepEqual(
    validateFieldEndpoint({
      address: "127.0.0.1",
      port: "8443",
      origin: "https://127.0.0.1:8443",
    }),
    { ok: true, endpoint: { address: "127.0.0.1", port: 8443, origin: "https://127.0.0.1:8443" } }
  );
  assert.deepEqual(
    validateFieldEndpoint({
      address: "fe80::1%eth0",
      port: "443",
      origin: "https://gaia.example.test",
    }),
    {
      ok: true,
      endpoint: { address: "fe80::1%eth0", port: 443, origin: "https://gaia.example.test" },
    }
  );
  assert.equal(
    validateFieldEndpoint({ address: "0.0.0.0", port: "8443", origin: "https://127.0.0.1:8443" })
      .ok,
    false
  );
  assert.equal(
    validateFieldEndpoint({ address: "::", port: "8443", origin: "https://[::1]:8443" }).ok,
    false
  );
  assert.equal(
    validateFieldEndpoint({
      address: "::ffff:0.0.0.0",
      port: "8443",
      origin: "https://127.0.0.1:8443",
    }).ok,
    false
  );
  assert.equal(
    validateFieldEndpoint({ address: "127.0.0.1", port: "8444", origin: "https://127.0.0.1:8443" })
      .ok,
    false
  );
});

test("physical connection, health, badge delegation and zero timestamps evaluate accurately", () => {
  const unbound: Device = {
    role: "sensor",
    source: "physical",
    capabilities: ["battery.level.v1"],
  };
  const bound: Device = {
    ...unbound,
    hardwareId: "hw-1",
    capabilities: ["battery.level.v1", "accelerometer.xyz.v1"],
  };
  const cameraOnly: Device = {
    role: "client",
    source: "physical",
    hardwareId: "cam-1",
    capabilities: ["camera.view.v1"],
  };
  const onlineZeroView: PhysicalView = {
    source: "measured",
    connection: "online",
    linkRemainingMs: 12_000,
    lastContactAt: 0,
    observations: {
      "battery.level.v1": {
        quality: "valid",
        value: 0,
        unit: "%",
        receivedAt: 0,
        at: 0,
        freshness: "fresh",
        freshRemainingMs: 5_000,
      },
      "accelerometer.xyz.v1": {
        quality: "valid",
        value: [0, 0, 0],
        unit: "m/s2",
        receivedAt: 0,
        at: 0,
        freshness: "fresh",
        freshRemainingMs: 5_000,
      },
    },
  };

  assert.equal(physicalConnection(unbound, onlineZeroView), "unbound");
  assert.equal(physicalHealth(unbound, onlineZeroView), "unbound");
  assert.equal(physicalConnection(bound, undefined), "unknown");
  assert.equal(physicalHealth(bound, undefined), "unknown");
  assert.equal(physicalHealth(bound, onlineZeroView), "online");
  assert.equal(latestEstimatedMeasurement(onlineZeroView), 0);
  assert.equal(
    physicalHealth(cameraOnly, {
      source: "measured",
      connection: "online",
      linkRemainingMs: 5000,
      observations: {},
    }),
    "online"
  );
  assert.equal(
    physicalHealth(bound, {
      source: "measured",
      connection: "online",
      linkRemainingMs: 5000,
      observations: {},
    }),
    "noData"
  );
  assert.equal(
    physicalHealth(bound, {
      ...onlineZeroView,
      observations: {
        ...onlineZeroView.observations,
        "accelerometer.xyz.v1": {
          quality: "invalid",
          value: null,
          unit: "m/s2",
          receivedAt: 100,
          freshness: "fresh",
          freshRemainingMs: 5000,
        },
      },
    }),
    "invalid"
  );
  assert.equal(
    physicalHealth(bound, {
      ...onlineZeroView,
      connection: "offline",
      linkRemainingMs: 0,
    }),
    "offline"
  );

  assert.equal(
    deviceBadgeHealth("phys-1", bound, {}, { "phys-1": onlineZeroView }, 1000),
    "online"
  );
  assert.equal(
    nextPhysicalExpiryDelay({
      a: onlineZeroView,
      b: {
        source: "measured",
        connection: "offline",
        linkRemainingMs: 0,
        observations: {
          "signal.read.v1": {
            quality: "valid",
            value: -80,
            unit: "dBm",
            receivedAt: 1,
            at: 1,
            freshness: "stale",
            freshRemainingMs: 0,
          },
        },
      },
    }),
    5_000
  );
  assert.equal(nextPhysicalExpiryDelay({}), undefined);
});

test("FieldStatusReader ages physical views on monotonic time and drops cancelled or stale-scope results", async () => {
  let monoNow = 1000;
  const requests: { scope: { project: string; session: string }; update?: unknown }[] = [];
  const pending = deferred<GaiaStatusReply>();
  const reader = new FieldStatusReader(
    (scope, update) => {
      requests.push({ scope, update });
      return pending.promise;
    },
    () => monoNow
  );

  const loadPromise = reader.load(
    { project: "p1", session: "s1" },
    { deviceId: "v1", kind: "link", state: "online" }
  );
  monoNow = 1500;
  pending.resolve({
    revision: 0,
    statuses: {},
    physical: {
      p1dev: {
        source: "measured",
        connection: "online",
        linkRemainingMs: 4000,
        lastContactAt: 5000,
        observations: {
          "battery.level.v1": {
            quality: "valid",
            value: 0,
            unit: "%",
            receivedAt: 5000,
            at: 5000,
            freshness: "fresh",
            freshRemainingMs: 8000,
          },
          "proximity.state.v1": {
            quality: "missing",
            value: null,
            unit: "state",
            receivedAt: 5000,
            freshness: "noData",
            freshRemainingMs: 0,
          },
        },
      },
    },
  });
  assert.equal(await loadPromise, true);
  assert.equal(requests.length, 1);

  const initial = reader.current({ project: "p1", session: "s1" }, 0);
  assert.equal(initial?.physical["p1dev"]?.connection, "online");
  assert.equal(initial?.physical["p1dev"]?.linkRemainingMs, 3500);
  assert.equal(initial?.physical["p1dev"]?.observations["battery.level.v1"]?.freshness, "fresh");
  assert.equal(initial?.physical["p1dev"]?.observations["proximity.state.v1"]?.freshness, "noData");
  assert.equal(reader.current({ project: "p1", session: "s1" }, 1), undefined);
  assert.equal(reader.current({ project: "p2", session: "s1" }, 0), undefined);

  monoNow = 5000;
  const aged = reader.current({ project: "p1", session: "s1" }, 0);
  assert.equal(aged?.physical["p1dev"]?.connection, "offline");
  assert.equal(aged?.physical["p1dev"]?.observations["battery.level.v1"]?.freshness, "stale");

  const delayed = deferred<GaiaStatusReply>();
  const reader2 = new FieldStatusReader(
    async () => delayed.promise,
    () => 2000
  );
  const cancelledLoad = reader2.load({ project: "p1", session: "s1" });
  reader2.cancel();
  delayed.resolve({
    revision: 0,
    statuses: {},
    physicalError: "authorization_unavailable",
    physical: {},
  });
  assert.equal(await cancelledLoad, false);
  assert.equal(reader2.current({ project: "p1", session: "s1" }, 0), undefined);
});

test("field contract helpers validate replies, assignments and localized EN/TR keys", () => {
  assert.equal(isFieldReply({ ok: true, data: { listening: true } }), true);
  assert.equal(isFieldReply({ ok: false, code: "cancelled" }), true);
  assert.equal(isFieldReply({ ok: true }), false);
  assert.equal(isFieldReply(null), false);

  const pair = deviceAssignments(
    [
      {
        id: "a1",
        deviceId: "d1",
        hardwareId: "h1",
        fingerprint: "fp1",
        installationId: "inst1",
        authorizationGeneration: 1,
        capabilities: ["battery.level.v1"],
        state: "pending",
      },
      {
        id: "a2",
        deviceId: "d1",
        hardwareId: "h1",
        fingerprint: "fp2",
        installationId: "inst1",
        authorizationGeneration: 0,
        capabilities: ["battery.level.v1"],
        state: "active",
      },
      {
        id: "a3",
        deviceId: "d2",
        hardwareId: "h2",
        fingerprint: "fp3",
        installationId: "inst2",
        authorizationGeneration: 0,
        capabilities: ["battery.level.v1"],
        state: "active",
      },
    ],
    "d1"
  );
  assert.equal(pair.active?.id, "a2");
  assert.equal(pair.pending?.id, "a1");

  assert.equal(fieldErrorText("cancelled", en.site).length > 0, true);
  assert.equal(fieldErrorText("transport", tr.site).length > 0, true);
  assert.deepEqual(Object.keys(en.site).sort(), Object.keys(tr.site).sort());
});
