import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import {
  capabilityDefinitions,
  intervalMs,
  timeoutMs,
  type CapabilityId,
} from "../../../../gaia-protocol/v1/src/schema.ts";
import type { PhysicalSnapshotInput } from "../devices/physical.ts";
import type { DeviceStatus } from "../devices/status.ts";
import { measuredFreshness } from "../devices/status.ts";
import {
  AuthorizationError,
  SessionError,
  SessionManager,
  type RetiredSession,
  type SessionAuthority,
  type SessionClock,
  type SessionErrorCode,
  type SessionExpectation,
  type SessionTimers,
  type TrustedAssignment,
  type TrustedProjectTransaction,
  type VerifiedClient,
} from "../field/session.ts";
import { createSiteFixture } from "../spatial/fixture.ts";
import type { World } from "../spatial/world.ts";
import {
  deviceStatusIdentity,
  projectPhysicalSnapshot,
  projectStatuses,
  type PhysicalLiveProof,
} from "../storage/status-store.ts";

const fieldId = "field-1";
const hardwareId = "hw-1";
const fingerprint = "a".repeat(64);
const twoCapabilities = ["battery.level.v1", "battery.voltage.v1"] as const;
const units = Object.fromEntries(
  Object.entries(capabilityDefinitions).map(([id, definition]) => [id, definition.unit])
) as Record<CapabilityId, string>;

class FakeClock implements SessionClock {
  wall = 1_700_000_000_000;
  mono = 10_000;

  now(): number {
    return this.wall;
  }

  monoMs(): number {
    return this.mono;
  }

  advance(ms: number): void {
    this.wall += ms;
    this.mono += ms;
  }
}

interface FakeTimerHandle {
  id: number;
  at: number;
  callback: () => void;
}

class FakeTimers implements SessionTimers {
  private nextId = 1;
  private readonly tasks = new Map<number, FakeTimerHandle>();

  constructor(private readonly clock: FakeClock) {}

  schedule(delayMs: number, callback: () => void): FakeTimerHandle {
    const handle = {
      id: this.nextId++,
      at: this.clock.mono + Math.max(0, delayMs),
      callback,
    };
    this.tasks.set(handle.id, handle);
    return handle;
  }

  cancel(handle: unknown): void {
    if (typeof handle === "object" && handle !== null && "id" in handle)
      this.tasks.delete((handle as FakeTimerHandle).id);
  }

  get size(): number {
    return this.tasks.size;
  }

  first(): FakeTimerHandle | undefined {
    return [...this.tasks.values()][0];
  }

  runDue(): void {
    for (const task of [...this.tasks.values()]) {
      if (task.at <= this.clock.mono) {
        this.tasks.delete(task.id);
        task.callback();
      }
    }
  }
}

class FakeAuthority implements SessionAuthority {
  active = true;
  ignoreExpectation = false;
  transactions = 0;
  publishes = 0;
  offline: RetiredSession[] = [];
  offlineFails = false;
  publishError: Error | undefined;
  publishGate: Promise<void> | undefined;
  transactionGate: Promise<void> | undefined;
  lastPublish: { input: PhysicalSnapshotInput; previousLive?: PhysicalLiveProof } | undefined;
  readonly published: PhysicalLiveProof[] = [];
  writer:
    | ((
        input: PhysicalSnapshotInput,
        previousLive?: PhysicalLiveProof
      ) => Promise<PhysicalLiveProof>)
    | undefined;

  constructor(
    readonly world: World,
    public assignment: TrustedAssignment,
    readonly expectedFingerprint: string
  ) {}

  async transact<T>(
    client: VerifiedClient,
    expected: SessionExpectation,
    work: (transaction: TrustedProjectTransaction) => Promise<T>
  ): Promise<T> {
    this.transactions++;
    if (client.fingerprint !== this.expectedFingerprint)
      throw new AuthorizationError("Wrong Gaia client identity");
    if (!this.active) throw new AuthorizationError("Gaia authorization is revoked");
    if (!this.ignoreExpectation) {
      if (
        expected.projectId !== this.assignment.projectId ||
        expected.deviceId !== this.assignment.deviceId
      )
        throw new AuthorizationError("Gaia project or device mismatch");
      if (expected.hardwareId !== undefined && expected.hardwareId !== this.assignment.hardwareId)
        throw new AuthorizationError("Gaia hardware mismatch");
      if (
        expected.installationId !== undefined &&
        expected.installationId !== this.assignment.installationId
      )
        throw new AuthorizationError("Gaia installation mismatch");
      if (
        expected.authorizationGeneration !== undefined &&
        expected.authorizationGeneration !== this.assignment.authorizationGeneration
      )
        throw new AuthorizationError("Gaia authorization generation mismatch");
      if (
        expected.statusEpoch !== undefined &&
        expected.statusEpoch !== this.assignment.statusEpoch
      )
        throw new AuthorizationError("Gaia status epoch mismatch");
    }
    if (this.transactionGate !== undefined) await this.transactionGate;
    const transaction: TrustedProjectTransaction = {
      world: this.world,
      statusEpoch: this.assignment.statusEpoch,
      assignment: this.assignment,
      publish: async (input, previousLive) => {
        this.publishes++;
        this.lastPublish = previousLive === undefined ? { input } : { input, previousLive };
        if (this.publishGate !== undefined) await this.publishGate;
        if (this.publishError !== undefined) {
          const error = this.publishError;
          this.publishError = undefined;
          throw error;
        }
        const proof = this.writer
          ? await this.writer(input, previousLive)
          : this.defaultProof(input);
        this.published.push(proof);
        return proof;
      },
    };
    return await work(transaction);
  }

  async markOffline(_client: VerifiedClient, session: RetiredSession): Promise<void> {
    this.offline.push(session);
    if (this.offlineFails) throw new Error("Offline publication failed");
  }

  private defaultProof(input: PhysicalSnapshotInput): PhysicalLiveProof {
    const packet = input.packet as {
      seq: number;
      sentMonoMs: number;
      deviceWallMs: number;
    };
    const status: DeviceStatus = {
      source: "measured",
      hardwareId: input.context.hardwareId,
      link: { state: "online", at: input.context.acceptedAt },
      lastContactAt: input.context.acceptedAt,
      measured: {
        installationId: input.context.installationId,
        authorizationGeneration: input.context.authorizationGeneration,
        runId: input.context.runId,
        sessionId: input.context.sessionId,
        seq: packet.seq,
        sentMonoMs: packet.sentMonoMs,
        deviceWallMs: packet.deviceWallMs,
        acceptedAt: input.context.acceptedAt,
        acceptedMonoMs: input.context.acceptedMonoMs,
      },
      observations: {},
    };
    return {
      identity: `identity-${this.assignment.statusEpoch}`,
      status,
    };
  }
}

interface Setup {
  world: World;
  assignment: TrustedAssignment;
  authority: FakeAuthority;
  clock: FakeClock;
  timers: FakeTimers;
  manager: SessionManager;
}

function fieldWorld(capabilities: string[] = [...twoCapabilities]): World {
  const world = createSiteFixture();
  world.id = "demo";
  world.devices[fieldId] = {
    role: "sensor",
    roles: ["sensor"],
    name: "Field client",
    source: "physical",
    hardwareId,
    capabilities,
  };
  return world;
}

function assignment(overrides: Partial<TrustedAssignment> = {}): TrustedAssignment {
  return {
    projectId: "demo",
    deviceId: fieldId,
    hardwareId,
    installationId: randomUUID(),
    authorizationGeneration: 1,
    statusEpoch: 0,
    capabilities: [...twoCapabilities],
    ...overrides,
  };
}

function setup(
  options: {
    capabilities?: string[];
    assignmentCapabilities?: string[];
    maxSessions?: number;
  } = {}
): Setup {
  const world = fieldWorld(options.capabilities ?? [...twoCapabilities]);
  const bound = assignment({
    capabilities: options.assignmentCapabilities ?? [...twoCapabilities],
  });
  const authority = new FakeAuthority(world, bound, fingerprint);
  const clock = new FakeClock();
  const timers = new FakeTimers(clock);
  const manager = new SessionManager({
    authority,
    clock,
    timers,
    ...(options.maxSessions === undefined ? {} : { maxSessions: options.maxSessions }),
  });
  return { world, assignment: bound, authority, clock, timers, manager };
}

function client(): VerifiedClient {
  return { fingerprint };
}

function openRequest(
  bound: TrustedAssignment,
  overrides: Record<string, unknown> = {}
): Record<string, unknown> {
  return {
    v: 1,
    projectId: bound.projectId,
    deviceId: bound.deviceId,
    installationId: bound.installationId,
    runId: randomUUID(),
    offered: [...twoCapabilities],
    ...overrides,
  };
}

function sample(id: CapabilityId, value: unknown, mono = 1_000) {
  return { id, quality: "valid", sampleMonoMs: mono, unit: units[id], value };
}

function missing(id: CapabilityId) {
  return { id, quality: "missing", unit: units[id], value: null };
}

function twoSamples(level = 50, voltage = 4_312, mono = 1_000) {
  return [sample("battery.level.v1", level, mono), sample("battery.voltage.v1", voltage, mono)];
}

function packet(
  sessionId: string,
  seq: number,
  samples: unknown[],
  overrides: Record<string, unknown> = {}
): Record<string, unknown> {
  return {
    v: 1,
    sessionId,
    seq,
    sentMonoMs: 1_500,
    deviceWallMs: 1_700_000_000_000,
    samples,
    ...overrides,
  };
}

function raw(value: unknown): string {
  return JSON.stringify(value);
}

async function open(setupValue: Setup, overrides: Record<string, unknown> = {}) {
  return await setupValue.manager.open(client(), openRequest(setupValue.assignment, overrides));
}

async function observe(
  setupValue: Setup,
  sessionId: string,
  seq: number,
  samples: unknown[],
  overrides: Record<string, unknown> = {}
) {
  const value = packet(sessionId, seq, samples, overrides);
  return {
    value,
    body: raw(value),
    ack: await setupValue.manager.observe(client(), raw(value), value),
  };
}

async function rejectsWithCode(promise: Promise<unknown>, code: SessionErrorCode) {
  try {
    await promise;
  } catch (error) {
    assert.ok(error instanceof SessionError, `expected SessionError, got ${String(error)}`);
    assert.equal(error.code, code);
    return error;
  }
  assert.fail(`expected ${code}`);
}

test("opens with the trusted capability intersection and requires seq 1", async () => {
  const fixture = setup({
    capabilities: ["battery.level.v1", "battery.voltage.v1", "signal.read.v1", "camera.view.v1"],
    assignmentCapabilities: ["battery.level.v1", "battery.voltage.v1", "signal.read.v1"],
  });
  const response = await fixture.manager.open(
    client(),
    openRequest(fixture.assignment, {
      offered: [
        "battery.level.v1",
        "signal.read.v1",
        "camera.view.v1",
        "proximity.state.v1",
        "battery.pack-temperature.v1",
      ],
    })
  );

  assert.equal(response.v, 1);
  assert.match(
    response.sessionId,
    /^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/
  );
  assert.deepEqual(response.accepted, ["battery.level.v1", "signal.read.v1"]);
  assert.equal(response.intervalMs, intervalMs);
  assert.equal(response.timeoutMs, timeoutMs);

  const opened = fixture.manager.inspect(response.sessionId);
  assert.ok(opened);
  assert.equal(opened.state, "awaiting-first");
  assert.equal(opened.authorizationGeneration, 1);
  assert.equal(opened.statusEpoch, 0);
  assert.equal(opened.lastSeq, 0);
  assert.equal(opened.hasProof, false);

  await rejectsWithCode(
    fixture.manager.observe(
      client(),
      raw(packet(response.sessionId, 2, twoSamples())),
      packet(response.sessionId, 2, twoSamples())
    ),
    "sequence_conflict"
  );

  const accepted = await observe(fixture, response.sessionId, 1, [
    sample("battery.level.v1", 50),
    sample("signal.read.v1", -40),
  ]);
  assert.equal(accepted.ack.v, 1);
  assert.equal(accepted.ack.sessionId, response.sessionId);
  assert.equal(accepted.ack.seq, 1);
  assert.equal(typeof accepted.ack.acceptedAt, "number");
  assert.equal(fixture.authority.transactions, 2);
  assert.equal(fixture.authority.publishes, 1);

  const online = fixture.manager.inspect(response.sessionId);
  assert.ok(online);
  assert.equal(online.state, "online");
  assert.equal(online.lastSeq, 1);
  assert.equal(online.hasProof, true);
});

test("keeps one active session per device and starts a new session at seq 1", async () => {
  const fixture = setup();
  const first = await open(fixture);

  const busy = await rejectsWithCode(open(fixture), "session_busy");
  assert.equal(busy.retryAfterMs, timeoutMs);

  fixture.clock.advance(timeoutMs - 1);
  const almost = await rejectsWithCode(open(fixture), "session_busy");
  assert.equal(almost.retryAfterMs, 1);

  const oldTimer = fixture.timers.first();
  assert.ok(oldTimer);
  fixture.clock.advance(1);
  const second = await open(fixture);
  assert.notEqual(second.sessionId, first.sessionId);

  await rejectsWithCode(
    fixture.manager.observe(
      client(),
      raw(packet(first.sessionId, 1, twoSamples())),
      packet(first.sessionId, 1, twoSamples())
    ),
    "session_expired"
  );

  oldTimer.callback();
  const stillOpen = fixture.manager.inspect(second.sessionId);
  assert.ok(stillOpen);
  assert.equal(stillOpen.lastSeq, 0);

  const accepted = await observe(fixture, second.sessionId, 1, twoSamples());
  assert.equal(accepted.ack.seq, 1);
});

test("replays the exact frozen body with the same ACK without publishing or refreshing", async () => {
  const fixture = setup();
  const opened = await open(fixture);
  const first = await observe(fixture, opened.sessionId, 1, twoSamples());
  const before = fixture.manager.inspect(opened.sessionId);
  assert.ok(before);
  assert.equal(before.hasProof, true);

  fixture.clock.advance(5_000);
  const replay = await fixture.manager.observe(client(), first.body, first.value);
  assert.deepEqual(replay, first.ack);
  assert.equal(fixture.authority.publishes, 1);
  const afterReplay = fixture.manager.inspect(opened.sessionId);
  assert.ok(afterReplay);
  assert.equal(afterReplay.lastAcceptMonoMs, before.lastAcceptMonoMs);
  assert.equal(afterReplay.deadlineMonoMs, before.deadlineMonoMs);
  assert.equal(afterReplay.hasProof, true);

  fixture.clock.advance(timeoutMs - 5_001);
  const lateReplay = await fixture.manager.observe(client(), first.body, first.value);
  assert.deepEqual(lateReplay, first.ack);
  assert.equal(fixture.authority.publishes, 1);

  fixture.clock.advance(1);
  await rejectsWithCode(
    fixture.manager.observe(client(), first.body, first.value),
    "session_expired"
  );
  assert.equal(fixture.manager.inspect(opened.sessionId), undefined);
});

test("rejects a changed body at the same seq, old seq and skipped seq", async () => {
  const fixture = setup();
  const opened = await open(fixture);
  const first = await observe(fixture, opened.sessionId, 1, twoSamples());
  await observe(fixture, opened.sessionId, 2, twoSamples(51));

  const conflict = packet(opened.sessionId, 2, twoSamples(52));
  await rejectsWithCode(
    fixture.manager.observe(client(), raw(conflict), conflict),
    "sequence_conflict"
  );

  const old = packet(opened.sessionId, 1, twoSamples(53));
  await rejectsWithCode(fixture.manager.observe(client(), raw(old), old), "sequence_conflict");

  const gap = packet(opened.sessionId, 4, twoSamples(54));
  await rejectsWithCode(fixture.manager.observe(client(), raw(gap), gap), "sequence_conflict");

  const state = fixture.manager.inspect(opened.sessionId);
  assert.ok(state);
  assert.equal(state.lastSeq, 2);
  assert.equal(fixture.authority.publishes, 2);
  assert.equal(
    (fixture.authority.lastPublish?.input.packet as { seq: number } | undefined)?.seq,
    2
  );

  const third = await observe(fixture, opened.sessionId, 3, twoSamples(55));
  assert.equal(third.ack.seq, 3);
  assert.equal(fixture.authority.publishes, 3);
  assert.equal(fixture.manager.inspect(opened.sessionId)?.lastSeq, 3);
  assert.equal(first.ack.seq, 1);
});

test("failed atomic publish produces no ACK and does not advance seq or proof", async () => {
  const fixture = setup();
  const opened = await open(fixture);
  await observe(fixture, opened.sessionId, 1, twoSamples());

  fixture.authority.publishError = new Error("Disk full");
  await rejectsWithCode(observe(fixture, opened.sessionId, 2, twoSamples(51)), "unavailable");
  let state = fixture.manager.inspect(opened.sessionId);
  assert.ok(state);
  assert.equal(state.lastSeq, 1);
  assert.equal(state.hasProof, true);
  assert.equal(fixture.authority.publishes, 2);

  const retry = await observe(fixture, opened.sessionId, 2, twoSamples(51));
  assert.equal(retry.ack.seq, 2);
  assert.equal(fixture.authority.publishes, 3);
  assert.equal(fixture.authority.lastPublish?.previousLive?.status.measured?.seq, 1);
  state = fixture.manager.inspect(opened.sessionId);
  assert.ok(state);
  assert.equal(state.lastSeq, 2);
  assert.equal(state.hasProof, true);
});

test("a failed first publish leaves the session without a proof and a retry works", async () => {
  const fixture = setup();
  const opened = await open(fixture);
  fixture.authority.publishError = new Error("Disk full");
  await rejectsWithCode(observe(fixture, opened.sessionId, 1, twoSamples()), "unavailable");
  let state = fixture.manager.inspect(opened.sessionId);
  assert.ok(state);
  assert.equal(state.lastSeq, 0);
  assert.equal(state.hasProof, false);

  await observe(fixture, opened.sessionId, 1, twoSamples());
  state = fixture.manager.inspect(opened.sessionId);
  assert.ok(state);
  assert.equal(state.lastSeq, 1);
  assert.equal(state.hasProof, true);
  assert.equal(fixture.authority.lastPublish?.previousLive, undefined);
});

test("authorization generation, epoch and revocation changes retire the session", async () => {
  for (const change of ["generation", "epoch", "revoked"] as const) {
    const fixture = setup();
    const opened = await open(fixture);
    await observe(fixture, opened.sessionId, 1, twoSamples());
    assert.equal(fixture.manager.inspect(opened.sessionId)?.hasProof, true);

    if (change === "generation") fixture.authority.assignment.authorizationGeneration = 2;
    if (change === "epoch") fixture.authority.assignment.statusEpoch = 1;
    if (change === "revoked") fixture.authority.active = false;

    await rejectsWithCode(observe(fixture, opened.sessionId, 2, twoSamples(51)), "not_authorized");
    assert.equal(fixture.manager.inspect(opened.sessionId), undefined);
    await fixture.manager.settled();
    assert.equal(fixture.authority.offline.length, 1);
  }
});

test("replay also requires current authorization and never returns a stale ACK", async () => {
  const fixture = setup();
  const opened = await open(fixture);
  const first = await observe(fixture, opened.sessionId, 1, twoSamples());
  fixture.authority.active = false;
  await rejectsWithCode(
    fixture.manager.observe(client(), first.body, first.value),
    "not_authorized"
  );
  assert.equal(fixture.manager.inspect(opened.sessionId), undefined);
  assert.equal(fixture.authority.publishes, 1);
});

test("serializes concurrent packets and lets only one same-seq body publish", async () => {
  const fixture = setup();
  const opened = await open(fixture);
  await observe(fixture, opened.sessionId, 1, twoSamples());

  const same = packet(opened.sessionId, 2, twoSamples(51));
  const sameBody = raw(same);
  const [left, right] = await Promise.all([
    fixture.manager.observe(client(), sameBody, same),
    fixture.manager.observe(client(), sameBody, same),
  ]);
  assert.deepEqual(left, right);
  assert.equal(fixture.authority.publishes, 2);

  const firstBody = packet(opened.sessionId, 3, twoSamples(52));
  const secondBody = packet(opened.sessionId, 3, twoSamples(53));
  const results = await Promise.allSettled([
    fixture.manager.observe(client(), raw(firstBody), firstBody),
    fixture.manager.observe(client(), raw(secondBody), secondBody),
  ]);
  assert.equal(results.filter((result) => result.status === "fulfilled").length, 1);
  assert.equal(results.filter((result) => result.status === "rejected").length, 1);
  assert.equal(fixture.authority.publishes, 3);
  assert.equal(fixture.manager.inspect(opened.sessionId)?.lastSeq, 3);

  const fourth = packet(opened.sessionId, 4, twoSamples(54));
  const fifth = packet(opened.sessionId, 5, twoSamples(55));
  await Promise.all([
    fixture.manager.observe(client(), raw(fourth), fourth),
    fixture.manager.observe(client(), raw(fifth), fifth),
  ]);
  assert.equal(fixture.manager.inspect(opened.sessionId)?.lastSeq, 5);
});

test("times out at 35000 ms, retires even when offline publication fails, and clears proof", async () => {
  const fixture = setup();
  fixture.authority.offlineFails = true;
  const opened = await open(fixture);
  await observe(fixture, opened.sessionId, 1, twoSamples());

  fixture.clock.advance(timeoutMs - 1);
  await fixture.manager.sweep();
  assert.ok(fixture.manager.inspect(opened.sessionId));

  fixture.clock.advance(1);
  await fixture.manager.sweep();
  assert.equal(fixture.manager.inspect(opened.sessionId), undefined);
  assert.equal(fixture.authority.offline.length, 1);
  assert.equal(fixture.manager.activeCount(), 0);

  const waiting = await open(fixture);
  fixture.clock.advance(timeoutMs - 1);
  await fixture.manager.sweep();
  assert.ok(fixture.manager.inspect(waiting.sessionId));
  fixture.clock.advance(1);
  await fixture.manager.sweep();
  assert.equal(fixture.manager.inspect(waiting.sessionId), undefined);
  assert.equal(fixture.authority.offline.length, 1);
});

test("uses the pre-publish acceptance instant when a publish is already in flight", async () => {
  const fixture = setup();
  const opened = await open(fixture);
  await observe(fixture, opened.sessionId, 1, twoSamples());

  let release!: () => void;
  fixture.authority.publishGate = new Promise<void>((resolve) => {
    release = resolve;
  });
  fixture.clock.advance(timeoutMs - 1);
  const pending = observe(fixture, opened.sessionId, 2, twoSamples(51));
  await Promise.resolve();
  fixture.clock.advance(1);
  fixture.timers.runDue();
  await fixture.manager.sweep();
  assert.ok(fixture.manager.inspect(opened.sessionId));

  release();
  const accepted = await pending;
  assert.equal(accepted.ack.seq, 2);
  const state = fixture.manager.inspect(opened.sessionId);
  assert.ok(state);
  assert.equal(state.lastAcceptMonoMs, 10_000 + timeoutMs - 1);
  assert.equal(state.deadlineMonoMs, 10_000 + timeoutMs - 1 + timeoutMs);
});

test("expires a packet whose lock wait crosses the deadline without publishing", async () => {
  const fixture = setup();
  const opened = await open(fixture);
  await observe(fixture, opened.sessionId, 1, twoSamples());

  let release!: () => void;
  fixture.authority.transactionGate = new Promise<void>((resolve) => {
    release = resolve;
  });
  fixture.clock.advance(timeoutMs - 1);
  const pending = observe(fixture, opened.sessionId, 2, twoSamples(51));
  await Promise.resolve();
  fixture.clock.advance(1);
  fixture.timers.runDue();
  await fixture.manager.sweep();
  release();

  await rejectsWithCode(pending, "session_expired");
  assert.equal(fixture.authority.publishes, 1);
  assert.equal(fixture.manager.inspect(opened.sessionId), undefined);
});

test("keeps the request identity outside the authorization authority", async () => {
  const fixture = setup();
  await rejectsWithCode(open(fixture, { installationId: randomUUID() }), "not_authorized");
  await rejectsWithCode(open(fixture, { deviceId: "other-device" }), "not_authorized");
  await rejectsWithCode(open(fixture, { projectId: "other-project" }), "not_authorized");
  assert.equal(fixture.manager.activeCount(), 0);
});

test("rejects an unknown session and a session used by another verified client", async () => {
  const fixture = setup();
  const opened = await open(fixture);
  await observe(fixture, opened.sessionId, 1, twoSamples());

  const unknown = packet(randomUUID(), 1, twoSamples());
  await rejectsWithCode(
    fixture.manager.observe(client(), raw(unknown), unknown),
    "session_expired"
  );

  const wrongClient = packet(opened.sessionId, 2, twoSamples(51));
  await rejectsWithCode(
    fixture.manager.observe({ fingerprint: "b".repeat(64) }, raw(wrongClient), wrongClient),
    "not_authorized"
  );
  assert.ok(fixture.manager.inspect(opened.sessionId));
  assert.equal(fixture.manager.inspect(opened.sessionId)?.lastSeq, 1);
});

test("tracks monotonic age anchors and does not refresh them on replay", async () => {
  const fixture = setup();
  const opened = await open(fixture);
  const first = await observe(fixture, opened.sessionId, 1, twoSamples(50, 4_312, 1_000));
  const firstContext = fixture.authority.lastPublish?.input.context;
  assert.ok(firstContext);
  assert.equal(firstContext.previousResponseMonoMs, 10_000);
  assert.equal(firstContext.acceptedMonoMs, 10_000);
  assert.equal(firstContext.acceptedAt, fixture.clock.wall);
  assert.equal(
    Number(first.value["sentMonoMs"]) -
      (first.value["samples"] as Array<{ sampleMonoMs: number }>)[0]!.sampleMonoMs,
    500
  );

  fixture.clock.advance(10_000);
  const second = packet(opened.sessionId, 2, twoSamples(50, 4_312, 1_000));
  const secondAck = await fixture.manager.observe(client(), raw(second), second);
  const secondContext = fixture.authority.lastPublish?.input.context;
  assert.ok(secondContext);
  assert.equal(secondContext.previousResponseMonoMs, 10_000);
  assert.equal(secondContext.acceptedMonoMs, 20_000);
  assert.equal(
    secondContext.acceptedMonoMs -
      secondContext.previousResponseMonoMs +
      Number(first.value["sentMonoMs"]) -
      (first.value["samples"] as Array<{ sampleMonoMs: number }>)[0]!.sampleMonoMs,
    10_500
  );

  fixture.clock.advance(5_000);
  const replay = await fixture.manager.observe(client(), raw(second), second);
  assert.deepEqual(replay, secondAck);
  assert.equal(fixture.authority.lastPublish?.input.context.acceptedMonoMs, 20_000);
});

test("real B2 writer preserves missing ordering memory and proof continuity", async (t) => {
  const dir = await mkdtemp(join(tmpdir(), "gaia-session-"));
  t.after(async () => await rm(dir, { recursive: true, force: true }));
  const world = fieldWorld(["battery.level.v1"]);
  const bound = assignment({ capabilities: ["battery.level.v1"] });
  const authority = new FakeAuthority(world, bound, fingerprint);
  authority.writer = async (input, previousLive) => {
    const statuses = await projectPhysicalSnapshot(
      dir,
      world,
      bound.statusEpoch,
      input,
      previousLive
    );
    const status = statuses[bound.deviceId];
    if (!status) throw new Error("Missing published Gaia status");
    return { identity: deviceStatusIdentity(world, bound.statusEpoch), status };
  };
  const clock = new FakeClock();
  const timers = new FakeTimers(clock);
  const manager = new SessionManager({ authority, clock, timers });
  const opened = await manager.open(
    client(),
    openRequest(bound, { offered: ["battery.level.v1"] })
  );
  clock.advance(1_000);

  const first = packet(opened.sessionId, 1, [sample("battery.level.v1", 50, 1_000)]);
  const firstAck = await manager.observe(client(), raw(first), first);
  const firstLive = authority.published.at(-1);
  assert.ok(firstLive);
  const firstReading = firstLive.status.observations["battery.level.v1"];
  assert.ok(firstReading);
  assert.equal(firstReading.receivedAt, 1_700_000_001_000);
  assert.equal(firstReading.ageUpperMs, 1_500);
  assert.equal(firstReading.acceptedMonoMs, 11_000);
  assert.equal(measuredFreshness(firstLive.status, firstReading, 11_000), "fresh");

  const firstDisk = (await projectStatuses(dir, world, bound.statusEpoch))[bound.deviceId]
    ?.observations["battery.level.v1"];
  assert.ok(firstDisk);
  assert.equal(firstDisk.receivedAt, 1_700_000_001_000);
  assert.equal(firstDisk.ageUpperMs, 1_500);
  assert.equal(firstDisk.acceptedMonoMs, undefined);

  clock.advance(5_000);
  const replay = await manager.observe(client(), raw(first), first);
  assert.deepEqual(replay, firstAck);
  assert.equal(authority.published.length, 1);
  const replayDisk = (await projectStatuses(dir, world, bound.statusEpoch))[bound.deviceId]
    ?.observations["battery.level.v1"];
  assert.deepEqual(replayDisk, firstDisk);

  clock.advance(5_000);
  const gapPacket = packet(opened.sessionId, 2, [missing("battery.level.v1")]);
  await manager.observe(client(), raw(gapPacket), gapPacket);
  const gapLive = authority.published.at(-1);
  assert.equal(gapLive?.status.observations["battery.level.v1"]?.quality, "missing");
  const gapDisk = (await projectStatuses(dir, world, bound.statusEpoch))[bound.deviceId];
  assert.equal(gapDisk?.observations["battery.level.v1"]?.quality, "missing");

  clock.advance(5_000);
  const restore = packet(opened.sessionId, 3, [sample("battery.level.v1", 50, 1_000)]);
  await manager.observe(client(), raw(restore), restore);
  const restoredLive = authority.published.at(-1);
  assert.deepEqual(restoredLive?.status.observations["battery.level.v1"], firstReading);
  const restoredDisk = (await projectStatuses(dir, world, bound.statusEpoch))[bound.deviceId]
    ?.observations["battery.level.v1"];
  assert.deepEqual(restoredDisk, firstDisk);

  const before = await projectStatuses(dir, world, bound.statusEpoch);
  const older = packet(opened.sessionId, 4, [sample("battery.level.v1", 50, 900)]);
  await rejectsWithCode(manager.observe(client(), raw(older), older), "unavailable");
  assert.equal(manager.inspect(opened.sessionId)?.lastSeq, 3);
  assert.equal(authority.published.length, 3);
  assert.deepEqual(await projectStatuses(dir, world, bound.statusEpoch), before);
});

test("heartbeat and all-missing packets become online", async () => {
  const allMissing = setup();
  const opened = await open(allMissing);
  await observe(allMissing, opened.sessionId, 1, [
    missing("battery.level.v1"),
    missing("battery.voltage.v1"),
  ]);
  assert.equal(allMissing.manager.inspect(opened.sessionId)?.state, "online");

  const empty = setup({ assignmentCapabilities: [] });
  const heartbeat = await empty.manager.open(
    client(),
    openRequest(empty.assignment, { offered: [] })
  );
  assert.deepEqual(heartbeat.accepted, []);
  await observe(empty, heartbeat.sessionId, 1, []);
  assert.equal(empty.manager.inspect(heartbeat.sessionId)?.state, "online");
});

test("center restart starts without sessions or old ACKs", async () => {
  const fixture = setup();
  const opened = await open(fixture);
  const first = await observe(fixture, opened.sessionId, 1, twoSamples());

  const restarted = new SessionManager({
    authority: fixture.authority,
    clock: fixture.clock,
    timers: new FakeTimers(fixture.clock),
  });
  assert.equal(restarted.activeCount(), 0);
  await rejectsWithCode(restarted.observe(client(), first.body, first.value), "session_expired");

  const reopened = await restarted.open(client(), openRequest(fixture.assignment));
  assert.notEqual(reopened.sessionId, opened.sessionId);
  const accepted = await observe(
    { ...fixture, manager: restarted, timers: new FakeTimers(fixture.clock) },
    reopened.sessionId,
    1,
    twoSamples(51)
  );
  assert.equal(accepted.ack.seq, 1);
});

test("clock discontinuity retires sessions and does not let an old timer close a new one", async () => {
  const fixture = setup();
  const opened = await open(fixture);
  await observe(fixture, opened.sessionId, 1, twoSamples());
  const oldTimer = fixture.timers.first();
  assert.ok(oldTimer);

  await fixture.manager.handleClockDiscontinuity();
  assert.equal(fixture.manager.activeCount(), 0);
  assert.equal(fixture.timers.size, 0);

  const fresh = await open(fixture);
  oldTimer.callback();
  assert.ok(fixture.manager.inspect(fresh.sessionId));
  await observe(fixture, fresh.sessionId, 1, twoSamples(51));
  assert.equal(fixture.manager.inspect(fresh.sessionId)?.lastSeq, 1);
});

test("bounds session state and cleans up timers and proofs on close", async () => {
  const fixture = setup({ maxSessions: 1 });
  const opened = await open(fixture);
  await observe(fixture, opened.sessionId, 1, twoSamples());
  assert.equal(fixture.timers.size, 1);

  const other = fieldWorld();
  other.devices["field-2"] = {
    role: "sensor",
    roles: ["sensor"],
    name: "Second field client",
    source: "physical",
    hardwareId: "hw-2",
    capabilities: [...twoCapabilities],
  };
  const second = assignment({
    deviceId: "field-2",
    hardwareId: "hw-2",
    installationId: randomUUID(),
  });
  const original = fixture.authority.assignment;
  fixture.world.devices["field-2"] = other.devices["field-2"]!;
  fixture.authority.assignment = second;
  try {
    await rejectsWithCode(fixture.manager.open(client(), openRequest(second)), "unavailable");
  } finally {
    fixture.authority.assignment = original;
  }

  for (let seq = 2; seq < 10; seq++) {
    const value = packet(opened.sessionId, seq, twoSamples(50 + seq));
    await fixture.manager.observe(client(), raw(value), value);
  }
  assert.equal(fixture.timers.size, 1);
  assert.equal(fixture.manager.activeCount(), 1);

  await fixture.manager.closeAll();
  assert.equal(fixture.manager.activeCount(), 0);
  assert.equal(fixture.timers.size, 0);
  assert.equal(fixture.manager.inspect(opened.sessionId), undefined);
  await rejectsWithCode(open(fixture), "unavailable");
});

test("invalid packet shape and semantic coverage are rejected without state changes", async () => {
  const fixture = setup();
  const opened = await open(fixture);

  const duplicate = packet(opened.sessionId, 1, [
    sample("battery.level.v1", 50),
    sample("battery.level.v1", 51),
    sample("battery.voltage.v1", 4_312),
  ]);
  await rejectsWithCode(
    fixture.manager.observe(client(), raw(duplicate), duplicate),
    "invalid_packet"
  );

  const missingCapability = packet(opened.sessionId, 1, [sample("battery.level.v1", 50)]);
  await rejectsWithCode(
    fixture.manager.observe(client(), raw(missingCapability), missingCapability),
    "invalid_packet"
  );

  const outside = packet(opened.sessionId, 1, [
    sample("battery.level.v1", 50),
    sample("battery.voltage.v1", 4_312),
    sample("signal.read.v1", -40),
  ]);
  await rejectsWithCode(fixture.manager.observe(client(), raw(outside), outside), "invalid_packet");

  const afterSend = packet(opened.sessionId, 1, twoSamples(50, 4_312, 1_600));
  await rejectsWithCode(
    fixture.manager.observe(client(), raw(afterSend), afterSend),
    "invalid_packet"
  );

  const invalidShape = { ...packet(opened.sessionId, 1, twoSamples()), extra: true };
  await rejectsWithCode(
    fixture.manager.observe(client(), raw(invalidShape), invalidShape),
    "invalid_packet"
  );

  assert.equal(fixture.manager.inspect(opened.sessionId)?.lastSeq, 0);
  assert.equal(fixture.authority.publishes, 0);
});

test("an occupied device does not disclose session state before current authorization", async () => {
  const f = setup();
  const opened = await open(f);
  await rejectsWithCode(
    f.manager.open({ fingerprint: "b".repeat(64) }, openRequest(f.assignment)),
    "not_authorized"
  );
  await rejectsWithCode(open(f, { installationId: randomUUID() }), "not_authorized");
  assert.ok(f.manager.inspect(opened.sessionId));
});

test("a regressed monotonic clock retires old sessions even before their timer runs", async () => {
  const f = setup();
  const opened = await open(f);
  await observe(f, opened.sessionId, 1, twoSamples());
  f.clock.mono -= 1;
  await rejectsWithCode(observe(f, opened.sessionId, 2, twoSamples()), "unavailable");
  assert.equal(f.manager.activeCount(), 0);
  assert.equal(f.timers.size, 0);
  f.clock.mono += 1;
  await rejectsWithCode(observe(f, opened.sessionId, 2, twoSamples()), "session_expired");
});

test("concurrent shutdown callers both wait for an accepted pending publication", async () => {
  const f = setup();
  const opened = await open(f);
  let release!: () => void;
  f.authority.publishGate = new Promise<void>((resolve) => {
    release = resolve;
  });
  const pending = rejectsWithCode(observe(f, opened.sessionId, 1, twoSamples()), "session_expired");
  while (!f.authority.lastPublish) await Promise.resolve();
  let secondDone = false;
  const first = f.manager.closeAll();
  const second = f.manager.closeAll().then(() => {
    secondDone = true;
  });
  try {
    await Promise.resolve();
    await Promise.resolve();
    assert.equal(secondDone, false);
  } finally {
    release();
    await Promise.all([first, second, pending]);
  }
});

test("a completed publication cannot return an ACK for a session whose renewed deadline already passed", async () => {
  const f = setup();
  const opened = await open(f);
  let release!: () => void;
  f.authority.publishGate = new Promise<void>((resolve) => {
    release = resolve;
  });
  const pending = observe(f, opened.sessionId, 1, twoSamples());
  while (!f.authority.lastPublish) await Promise.resolve();
  f.clock.advance(timeoutMs);
  f.timers.runDue();
  release();
  await rejectsWithCode(pending, "session_expired");
  await f.manager.settled();
  assert.equal(f.authority.publishes, 1);
  assert.equal(f.manager.activeCount(), 0);
  assert.equal(f.authority.offline.length, 1);
});
