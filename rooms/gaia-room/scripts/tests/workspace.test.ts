import assert from "node:assert/strict";
import test from "node:test";
import { markCalibrationPoint } from "../editor/site/calibration.ts";
import { commitDraft } from "../editor/site/draft.ts";
import { describeError } from "../editor/site/errors.ts";
import { revealSelection } from "../editor/site/framing.ts";
import { StatusSession, nextFreshnessDeadline } from "../editor/site/status-session.ts";
import { freshForMs, type DeviceStatuses, type StatusSnapshot } from "../devices/status.ts";
import { createSiteFixture } from "../spatial/fixture.ts";
import type { SiteEdit } from "../spatial/site-edits.ts";

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
