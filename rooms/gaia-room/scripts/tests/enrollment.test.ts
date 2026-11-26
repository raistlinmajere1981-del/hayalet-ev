import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { chmod, mkdtemp, open, readFile, rename, rm, symlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test, { type TestContext } from "node:test";
import type { Opened, Saved } from "../editor/client.ts";
import {
  activateAuthorization,
  authorizationCapabilities,
  beginAuthorization,
  completeAuthorization,
  emptyAuthorizationStore,
  parseAuthorizationStore,
  resolveActiveAssignmentFromStore,
  revokeAuthorization,
  serializeAuthorizationStore,
  verifyActiveAssignment,
  type AuthorizationAssignment,
} from "../field/enrollment.ts";
import { createSiteFixture } from "../spatial/fixture.ts";
import type { World } from "../spatial/world.ts";
import {
  authorizationStorePath,
  provisionAuthorizationStore,
  readAuthorizationStore,
  resolveActiveAssignment,
  resolveVerifiedAssignment,
} from "../storage/enrollment-store.ts";
import { projectCommand } from "../storage/provider.ts";
import { openFieldAuthority } from "../storage/enrollment-service.ts";
import { deviceStatusIdentity } from "../storage/status-store.ts";

const fieldCapabilities = [
  "battery.level.v1",
  "battery.voltage.v1",
  "battery.pack-temperature.v1",
  "signal.read.v1",
] as const;

function fingerprint(value: number): string {
  return value.toString(16).padStart(64, "0");
}

function fieldWorld(
  project = "demo",
  deviceId = "field-1",
  hardwareId = "hw-1",
  capabilities: string[] = [...fieldCapabilities]
): World {
  const world = createSiteFixture();
  world.id = project;
  world.devices[deviceId] = {
    role: "sensor",
    roles: ["sensor"],
    name: "Field client",
    source: "physical",
    hardwareId,
    capabilities,
  };
  return world;
}

function assignmentInput(overrides: Record<string, unknown> = {}) {
  return {
    projectId: "demo",
    operationId: randomUUID(),
    deviceId: "field-1",
    hardwareId: "hw-1",
    installationId: randomUUID(),
    fingerprint: fingerprint(1),
    capabilities: ["battery.level.v1", "battery.voltage.v1"],
    now: 1_000,
    ...overrides,
  };
}

async function setupProject(t: TestContext, project = "demo", fixture = false) {
  const storageRoot = await mkdtemp(join(tmpdir(), "gaia-enrollment-"));
  t.after(async () => await rm(storageRoot, { recursive: true, force: true }));
  const context = { storageRoot, owner: {} };
  await provisionAuthorizationStore(storageRoot);
  const authority = await openFieldAuthority(storageRoot);
  t.after(() => authority.close());
  const call = (command: string, payload: unknown) => projectCommand(context, command, payload);
  const opened = (await call("GaiaCreate", {
    project,
    fixture,
    locale: "en",
    ...(fixture ? { layout: "site" } : {}),
  })) as Opened;
  return {
    storageRoot,
    context,
    authority,
    call,
    project,
    opened,
    dir: join(storageRoot, "projects", project),
  };
}

type Project = Awaited<ReturnType<typeof setupProject>>;
const enrollmentCommand = (setup: Project, request: unknown) =>
  setup.authority.enrollmentCommand(request);

async function storedDocument(setup: Project, project = setup.project) {
  return JSON.parse(
    await readFile(join(setup.storageRoot, "projects", project, "world.json"), "utf8")
  ) as { world: World; statusEpoch: number; lastOperation: unknown };
}

async function openProject(setup: Project, project = setup.project): Promise<Opened> {
  return (await setup.call("GaiaOpen", { project })) as Opened;
}

async function createProject(setup: Project, project: string, fixture = false): Promise<Opened> {
  return (await setup.call("GaiaCreate", {
    project,
    fixture,
    locale: "en",
    ...(fixture ? { layout: "site" } : {}),
  })) as Opened;
}

async function saveSite(setup: Project, edits: unknown[], project = setup.project): Promise<World> {
  const opened = await openProject(setup, project);
  const saved = (await setup.call("GaiaSave", {
    batch: {
      scope: "site",
      project,
      session: opened.session,
      baseRevision: opened.world.revision,
      operationId: randomUUID(),
      edits,
    },
    retry: false,
  })) as Saved;
  assert.ok(saved.world);
  return saved.world;
}

async function createPhysicalDevice(
  setup: Project,
  capabilities: string[] = [...fieldCapabilities],
  project = setup.project,
  deviceId = randomUUID()
) {
  const world = await saveSite(
    setup,
    [
      {
        op: "createDevice",
        id: deviceId,
        source: "physical",
        details: { name: "Field client", roles: ["sensor"], capabilities },
      },
    ],
    project
  );
  return { deviceId, world, revision: world.revision, capabilities };
}

type Device = Awaited<ReturnType<typeof createPhysicalDevice>>;

interface EnrollmentResult {
  assignment: AuthorizationAssignment;
  revision: number;
  statusEpoch: number;
}

async function beginDevice(
  setup: Project,
  device: Device,
  options: {
    hardwareId?: string;
    installationId?: string;
    fingerprint?: string;
    capabilities?: string[];
    project?: string;
    operationId?: string;
    renews?: string;
    expectedRevision?: number;
  } = {}
): Promise<EnrollmentResult> {
  return (await enrollmentCommand(setup, {
    action: "begin",
    operationId: options.operationId ?? randomUUID(),
    project: options.project ?? setup.project,
    deviceId: device.deviceId,
    hardwareId: options.hardwareId ?? "hw-1",
    installationId: options.installationId ?? randomUUID(),
    fingerprint: options.fingerprint ?? fingerprint(1),
    capabilities: options.capabilities ?? [...fieldCapabilities],
    expectedRevision: options.expectedRevision ?? device.revision,
    ...(options.renews === undefined ? {} : { renews: options.renews }),
  })) as EnrollmentResult;
}

async function completeDevice(
  setup: Project,
  assignmentId: string,
  operationId = randomUUID()
): Promise<EnrollmentResult> {
  return (await enrollmentCommand(setup, {
    action: "complete",
    operationId,
    assignmentId,
  })) as EnrollmentResult;
}

async function bindDevice(
  setup: Project,
  device: Device,
  options: Parameters<typeof beginDevice>[2] = {}
) {
  const begin = await beginDevice(setup, device, options);
  const complete = await completeDevice(setup, begin.assignment.id);
  return {
    begin,
    complete,
    assignment: complete.assignment,
    hardwareId: options.hardwareId ?? "hw-1",
    installationId: begin.assignment.installationId,
    fingerprint: options.fingerprint ?? fingerprint(1),
    capabilities: begin.assignment.capabilities,
  };
}

test("a pending assignment becomes active only after completion and resolves by fingerprint", () => {
  const world = fieldWorld();
  let store = emptyAuthorizationStore();
  const begun = beginAuthorization(store, world, 7, assignmentInput());
  store = begun.store;

  assert.equal(begun.assignment.state, "pending");
  assert.equal(resolveActiveAssignmentFromStore(store, fingerprint(1)), undefined);
  assert.throws(
    () => verifyActiveAssignment(world, 7, begun.assignment),
    /not active|authorization/
  );

  const completed = completeAuthorization(store, world, 7, {
    assignmentId: begun.assignment.id,
    operationId: randomUUID(),
    now: 2_000,
  });
  store = completed.store;

  assert.equal(completed.assignment.state, "active");
  assert.equal(resolveActiveAssignmentFromStore(store, fingerprint(1))?.id, begun.assignment.id);
  verifyActiveAssignment(world, 7, completed.assignment, { authorizationGeneration: 1 });
  assert.deepEqual(authorizationCapabilities(world, completed.assignment), [
    "battery.level.v1",
    "battery.voltage.v1",
  ]);
  assert.equal(
    parseAuthorizationStore(JSON.parse(serializeAuthorizationStore(store))).assignments.length,
    1
  );
});

test("an active assignment is bound to one project, device, hardware and generation", () => {
  const world = fieldWorld();
  const begun = beginAuthorization(emptyAuthorizationStore(), world, 7, assignmentInput());
  const completed = completeAuthorization(begun.store, world, 7, {
    assignmentId: begun.assignment.id,
    operationId: randomUUID(),
    now: 2_000,
  });
  const active = completed.assignment;
  const other = fieldWorld("other", "field-2", "hw-2");

  assert.throws(() => verifyActiveAssignment(world, 7, active, { statusEpoch: 6 }), /epoch/);
  assert.throws(() => verifyActiveAssignment(other, 7, active), /project|device/);
  assert.throws(() => verifyActiveAssignment(world, 8, active), /stale|epoch|generation/);
  assert.throws(
    () =>
      verifyActiveAssignment(world, 7, active, {
        authorizationGeneration: active.authorizationGeneration - 1,
      }),
    /generation/
  );

  world.devices["field-1"]!.hardwareId = "hw-9";
  assert.throws(() => verifyActiveAssignment(world, 7, active), /hardware/);
});

test("duplicate installation, hardware, fingerprint and device bindings are rejected", () => {
  const world = fieldWorld();
  const installationId = randomUUID();
  const begun = beginAuthorization(
    emptyAuthorizationStore(),
    world,
    7,
    assignmentInput({ installationId })
  );
  const completed = completeAuthorization(begun.store, world, 7, {
    assignmentId: begun.assignment.id,
    operationId: randomUUID(),
    now: 2_000,
  });
  const store = completed.store;

  const otherWorld = fieldWorld("other", "field-2", "hw-2");
  assert.throws(
    () =>
      beginAuthorization(store, otherWorld, 7, {
        ...assignmentInput({ projectId: "other", deviceId: "field-2", hardwareId: "hw-2" }),
        installationId,
      }),
    /installation/
  );
  assert.throws(
    () =>
      beginAuthorization(store, otherWorld, 7, {
        ...assignmentInput({ projectId: "other", deviceId: "field-2", hardwareId: "hw-1" }),
        installationId: randomUUID(),
      }),
    /hardware/
  );
  assert.throws(
    () =>
      beginAuthorization(store, world, 7, {
        ...assignmentInput({ hardwareId: "hw-1" }),
        installationId: randomUUID(),
        fingerprint: fingerprint(1),
      }),
    /fingerprint|hardware|device/
  );
});

test("revoked permissions and stale generations cannot authorize a session", () => {
  const world = fieldWorld();
  const begun = beginAuthorization(emptyAuthorizationStore(), world, 7, assignmentInput());
  const completed = completeAuthorization(begun.store, world, 7, {
    assignmentId: begun.assignment.id,
    operationId: randomUUID(),
    now: 2_000,
  });
  const revoked = revokeAuthorization(completed.store, {
    assignmentId: completed.assignment.id,
    operationId: randomUUID(),
    now: 3_000,
  });

  assert.equal(resolveActiveAssignmentFromStore(revoked.store, fingerprint(1)), undefined);
  assert.throws(
    () => verifyActiveAssignment(world, 7, revoked.assignment),
    /not active|revoked|authorization/
  );
  assert.throws(
    () =>
      completeAuthorization(revoked.store, world, 7, {
        assignmentId: completed.assignment.id,
        operationId: randomUUID(),
        now: 4_000,
      }),
    /pending/
  );
});

test("certificate renewal advances the generation and closes the old fingerprint", () => {
  const world = fieldWorld();
  const installationId = randomUUID();
  const begun = beginAuthorization(
    emptyAuthorizationStore(),
    world,
    7,
    assignmentInput({ installationId })
  );
  const first = completeAuthorization(begun.store, world, 7, {
    assignmentId: begun.assignment.id,
    operationId: randomUUID(),
    now: 2_000,
  });
  const renewal = beginAuthorization(first.store, world, 7, {
    ...assignmentInput({ installationId, fingerprint: fingerprint(2) }),
    renews: first.assignment.id,
  });

  assert.equal(renewal.assignment.state, "pending");
  assert.equal(renewal.assignment.authorizationGeneration, 2);
  assert.equal(resolveActiveAssignmentFromStore(renewal.store, fingerprint(2)), undefined);

  const second = completeAuthorization(renewal.store, world, 7, {
    assignmentId: renewal.assignment.id,
    operationId: randomUUID(),
    now: 3_000,
  });
  assert.equal(second.assignment.state, "active");
  assert.throws(
    () =>
      parseAuthorizationStore({
        ...second.store,
        assignments: second.store.assignments.filter((a) => a.id !== second.assignment.id),
      }),
    /invalid|missing/i
  );
  assert.equal(second.assignment.authorizationGeneration, 2);
  assert.equal(resolveActiveAssignmentFromStore(second.store, fingerprint(1)), undefined);
  assert.equal(
    resolveActiveAssignmentFromStore(second.store, fingerprint(2))?.id,
    renewal.assignment.id
  );
  assert.equal(
    second.store.assignments.find((entry) => entry.id === first.assignment.id)?.state,
    "revoked"
  );
});

test("provider binds one physical device and rejects another project or device", async (t) => {
  const setup = await setupProject(t);
  const device = await createPhysicalDevice(setup);
  const bound = await bindDevice(setup, device, {
    hardwareId: "hw-1",
    fingerprint: fingerprint(1),
    capabilities: ["battery.level.v1", "battery.voltage.v1"],
  });
  const document = await storedDocument(setup);

  assert.equal(bound.assignment.state, "active");
  assert.equal(bound.assignment.authorizationGeneration, 1);
  assert.equal(bound.assignment.statusEpoch, document.statusEpoch);
  verifyActiveAssignment(document.world, document.statusEpoch, bound.assignment);
  assert.equal(
    (await resolveActiveAssignment(setup.storageRoot, fingerprint(1)))?.id,
    bound.assignment.id
  );
  assert.deepEqual(authorizationCapabilities(document.world, bound.assignment), [
    "battery.level.v1",
    "battery.voltage.v1",
  ]);

  const other = await createProject(setup, "other");
  assert.equal(other.world.id, "other");
  const otherDevice = await createPhysicalDevice(setup, [...fieldCapabilities], "other");
  const otherDocument = await storedDocument(setup, "other");
  assert.throws(
    () => verifyActiveAssignment(otherDocument.world, otherDocument.statusEpoch, bound.assignment),
    /project/
  );
  await assert.rejects(
    beginDevice(setup, otherDevice, {
      project: "other",
      hardwareId: "hw-1",
      installationId: bound.installationId,
      fingerprint: fingerprint(9),
    }),
    /installation|hardware/
  );
});

test("trusted resolution re-verifies world, epoch, generation and hardware", async (t) => {
  const setup = await setupProject(t);
  const device = await createPhysicalDevice(setup);
  const bound = await bindDevice(setup, device, {
    hardwareId: "hw-1",
    fingerprint: fingerprint(1),
    capabilities: ["battery.level.v1"],
  });
  const document = await storedDocument(setup);
  const generation = bound.assignment.authorizationGeneration;

  assert.equal(
    (
      await resolveVerifiedAssignment(
        setup.storageRoot,
        document.world,
        document.statusEpoch,
        fingerprint(1),
        { authorizationGeneration: generation }
      )
    )?.id,
    bound.assignment.id
  );
  assert.equal(
    await resolveVerifiedAssignment(
      setup.storageRoot,
      document.world,
      document.statusEpoch,
      fingerprint(2)
    ),
    undefined
  );
  await assert.rejects(
    resolveVerifiedAssignment(
      setup.storageRoot,
      document.world,
      document.statusEpoch + 1,
      fingerprint(1)
    ),
    /stale/
  );
  await createProject(setup, "other");
  const otherDocument = await storedDocument(setup, "other");
  await assert.rejects(
    resolveVerifiedAssignment(
      setup.storageRoot,
      otherDocument.world,
      otherDocument.statusEpoch,
      fingerprint(1)
    ),
    /project/
  );
  await assert.rejects(
    resolveVerifiedAssignment(
      setup.storageRoot,
      document.world,
      document.statusEpoch,
      fingerprint(1),
      { authorizationGeneration: generation + 1 }
    ),
    /generation/
  );
  const swapped = structuredClone(document.world);
  const stored = swapped.devices[device.deviceId];
  assert.ok(stored);
  stored.hardwareId = "hw-2";
  await assert.rejects(
    resolveVerifiedAssignment(setup.storageRoot, swapped, document.statusEpoch, fingerprint(1)),
    /hardware/
  );
});

test("hardware rebind closes the old permission first and carries unaffected devices", async (t) => {
  const setup = await setupProject(t);
  const firstDevice = await createPhysicalDevice(setup);
  const first = await bindDevice(setup, firstDevice, { hardwareId: "hw-1" });
  const secondDevice = await createPhysicalDevice(setup);
  const second = await bindDevice(setup, secondDevice, {
    hardwareId: "hw-2",
    installationId: randomUUID(),
    fingerprint: fingerprint(2),
    capabilities: ["battery.level.v1"],
  });
  const before = await storedDocument(setup);

  const rebound = (await enrollmentCommand(setup, {
    action: "rebindHardware",
    operationId: randomUUID(),
    assignmentId: first.assignment.id,
    hardwareId: "hw-3",
    fingerprint: fingerprint(3),
    expectedRevision: before.world.revision,
  })) as EnrollmentResult;
  const after = await storedDocument(setup);

  assert.equal(rebound.assignment.state, "active");
  assert.equal(rebound.assignment.authorizationGeneration, 2);
  assert.equal(rebound.assignment.hardwareId, "hw-3");
  assert.equal(rebound.assignment.statusEpoch, after.statusEpoch);
  assert.equal(after.world.devices[firstDevice.deviceId]?.hardwareId, "hw-3");
  assert.equal(await resolveActiveAssignment(setup.storageRoot, fingerprint(1)), undefined);
  assert.equal(
    (await resolveActiveAssignment(setup.storageRoot, fingerprint(3)))?.id,
    rebound.assignment.id
  );

  const store = await readAuthorizationStore(setup.storageRoot);
  assert.equal(
    store.assignments.find((entry) => entry.id === first.assignment.id)?.state,
    "revoked"
  );
  const carried = store.assignments.find((entry) => entry.id === second.assignment.id)!;
  assert.equal(carried.state, "active");
  assert.equal(carried.statusEpoch, after.statusEpoch);
  verifyActiveAssignment(after.world, after.statusEpoch, carried);
  const publish = (statusEpoch: number) =>
    setup.authority.withVerifiedAssignment(
      setup.project,
      second.fingerprint,
      { authorizationGeneration: carried.authorizationGeneration, statusEpoch },
      async (_world, epoch) => epoch
    );
  await assert.rejects(publish(before.statusEpoch), /epoch/);
  assert.equal(await publish(after.statusEpoch), after.statusEpoch);
});

test("device deletion and recreation with the same id do not revive the old permission", async (t) => {
  const setup = await setupProject(t);
  const device = await createPhysicalDevice(setup);
  const bound = await bindDevice(setup, device, { hardwareId: "hw-1" });
  const before = await storedDocument(setup);

  await saveSite(setup, [
    {
      op: "deleteDevice",
      id: device.deviceId,
      mount: null,
      hardwareId: "hw-1",
    },
  ]);
  assert.equal(await resolveActiveAssignment(setup.storageRoot, fingerprint(1)), undefined);
  const deleted = await readAuthorizationStore(setup.storageRoot);
  assert.equal(
    deleted.assignments.find((entry) => entry.id === bound.assignment.id)?.state,
    "revoked"
  );

  await createPhysicalDevice(setup, [...fieldCapabilities], setup.project, device.deviceId);
  assert.equal(await resolveActiveAssignment(setup.storageRoot, fingerprint(1)), undefined);
  const recreated = await readAuthorizationStore(setup.storageRoot);
  assert.equal(
    recreated.assignments.find((entry) => entry.id === bound.assignment.id)?.state,
    "revoked"
  );
  assert.equal(recreated.assignments.filter((entry) => entry.state === "active").length, 0);
  assert.ok(before.world.revision < (await storedDocument(setup)).world.revision);
});

test("capability removal shrinks the permission and re-adding it does not expand it", async (t) => {
  const setup = await setupProject(t);
  const device = await createPhysicalDevice(setup);
  const bound = await bindDevice(setup, device, {
    hardwareId: "hw-1",
    capabilities: ["battery.level.v1", "battery.voltage.v1", "signal.read.v1"],
  });

  await saveSite(setup, [
    {
      op: "updateDevice",
      id: device.deviceId,
      details: {
        name: "Field client",
        roles: ["sensor"],
        capabilities: ["battery.level.v1", "signal.read.v1"],
      },
    },
  ]);
  const removed = await storedDocument(setup);
  let store = await readAuthorizationStore(setup.storageRoot);
  let active = store.assignments.find((entry) => entry.id === bound.assignment.id)!;
  assert.equal(active.state, "active");
  assert.deepEqual(active.capabilities, ["battery.level.v1", "signal.read.v1"]);
  assert.equal(active.statusEpoch, removed.statusEpoch);
  verifyActiveAssignment(removed.world, removed.statusEpoch, active);

  await saveSite(setup, [
    {
      op: "updateDevice",
      id: device.deviceId,
      details: {
        name: "Field client",
        roles: ["sensor"],
        capabilities: [...fieldCapabilities],
      },
    },
  ]);
  const restored = await storedDocument(setup);
  store = await readAuthorizationStore(setup.storageRoot);
  active = store.assignments.find((entry) => entry.id === bound.assignment.id)!;
  assert.equal(active.state, "active");
  assert.deepEqual(active.capabilities, ["battery.level.v1", "signal.read.v1"]);
  assert.equal(active.statusEpoch, restored.statusEpoch);
  verifyActiveAssignment(restored.world, restored.statusEpoch, active);
  assert.equal(
    restored.world.devices[device.deviceId]?.capabilities.includes("battery.voltage.v1"),
    true
  );
});

test("name and mount changes keep the permission and inventory epoch stable", async (t) => {
  const setup = await setupProject(t, "demo", true);
  const device = await createPhysicalDevice(setup);
  const bound = await bindDevice(setup, device, { hardwareId: "hw-1" });
  const before = await storedDocument(setup);

  await saveSite(setup, [
    {
      op: "updateDevice",
      id: device.deviceId,
      details: {
        name: "Renamed client",
        roles: ["sensor"],
        capabilities: [...fieldCapabilities],
      },
    },
    { op: "mountDevice", id: device.deviceId, mount: "mc1" },
  ]);
  const renamed = await storedDocument(setup);
  let store = await readAuthorizationStore(setup.storageRoot);
  let active = store.assignments.find((entry) => entry.id === bound.assignment.id)!;
  assert.equal(active.state, "active");
  assert.equal(active.authorizationGeneration, 1);
  assert.equal(active.statusEpoch, before.statusEpoch);
  assert.equal(renamed.statusEpoch, before.statusEpoch);
  assert.equal(renamed.world.devices[device.deviceId]?.mount, "mc1");

  await saveSite(setup, [{ op: "mountDevice", id: device.deviceId, mount: "mc2" }]);
  const moved = await storedDocument(setup);
  store = await readAuthorizationStore(setup.storageRoot);
  active = store.assignments.find((entry) => entry.id === bound.assignment.id)!;
  assert.equal(active.state, "active");
  assert.equal(active.authorizationGeneration, 1);
  assert.equal(active.statusEpoch, before.statusEpoch);
  assert.equal(moved.statusEpoch, before.statusEpoch);
  assert.equal(moved.world.devices[device.deviceId]?.mount, "mc2");
});

test("A to B to A hardware changes never revive the original permission", async (t) => {
  const setup = await setupProject(t);
  const device = await createPhysicalDevice(setup);
  const first = await bindDevice(setup, device, {
    hardwareId: "hw-1",
    fingerprint: fingerprint(1),
  });

  let document = await storedDocument(setup);
  const second = (await enrollmentCommand(setup, {
    action: "rebindHardware",
    operationId: randomUUID(),
    assignmentId: first.assignment.id,
    hardwareId: "hw-2",
    fingerprint: fingerprint(2),
    expectedRevision: document.world.revision,
  })) as EnrollmentResult;

  document = await storedDocument(setup);
  const third = (await enrollmentCommand(setup, {
    action: "rebindHardware",
    operationId: randomUUID(),
    assignmentId: second.assignment.id,
    hardwareId: "hw-1",
    fingerprint: fingerprint(3),
    expectedRevision: document.world.revision,
  })) as EnrollmentResult;

  document = await storedDocument(setup);
  const store = await readAuthorizationStore(setup.storageRoot);
  assert.equal(
    store.assignments.find((entry) => entry.id === first.assignment.id)?.state,
    "revoked"
  );
  assert.equal(
    store.assignments.find((entry) => entry.id === second.assignment.id)?.state,
    "revoked"
  );
  assert.equal(
    store.assignments.find((entry) => entry.id === third.assignment.id)?.state,
    "active"
  );
  assert.equal(third.assignment.authorizationGeneration, 3);
  assert.equal(document.world.devices[device.deviceId]?.hardwareId, "hw-1");
  assert.equal(await resolveActiveAssignment(setup.storageRoot, fingerprint(1)), undefined);
  assert.equal(await resolveActiveAssignment(setup.storageRoot, fingerprint(2)), undefined);
  assert.equal(
    (await resolveActiveAssignment(setup.storageRoot, fingerprint(3)))?.id,
    third.assignment.id
  );
});

test("begin and complete retries are idempotent and conflicting content is rejected", async (t) => {
  const setup = await setupProject(t);
  const device = await createPhysicalDevice(setup);
  const operationId = randomUUID();
  const installationId = randomUUID();
  const first = await beginDevice(setup, device, {
    operationId,
    installationId,
    fingerprint: fingerprint(1),
    capabilities: ["battery.level.v1"],
  });
  const retry = await beginDevice(setup, device, {
    operationId,
    installationId,
    fingerprint: fingerprint(1),
    capabilities: ["battery.level.v1"],
    expectedRevision: first.revision,
  });
  assert.equal(retry.assignment.id, first.assignment.id);
  assert.equal((await readAuthorizationStore(setup.storageRoot)).assignments.length, 1);

  await assert.rejects(
    beginDevice(setup, device, {
      operationId,
      installationId,
      fingerprint: fingerprint(2),
      capabilities: ["battery.level.v1"],
    }),
    /different content/
  );

  const completeOperation = randomUUID();
  const completed = await completeDevice(setup, first.assignment.id, completeOperation);
  const completeRetry = await completeDevice(setup, first.assignment.id, completeOperation);
  assert.equal(completeRetry.assignment.id, completed.assignment.id);
  assert.equal(completeRetry.assignment.state, "active");

  const revokeOperation = randomUUID();
  const revoked = (await enrollmentCommand(setup, {
    action: "revoke",
    operationId: revokeOperation,
    assignmentId: completed.assignment.id,
  })) as { assignment: AuthorizationAssignment };
  const revokeRetry = (await enrollmentCommand(setup, {
    action: "revoke",
    operationId: revokeOperation,
    assignmentId: completed.assignment.id,
  })) as { assignment: AuthorizationAssignment };
  assert.equal(revoked.assignment.state, "revoked");
  assert.equal(revokeRetry.assignment.state, "revoked");
  await assert.rejects(completeDevice(setup, completed.assignment.id), /pending/);
});

test("a failed begin publication leaves at most an unauthorized inventory binding", async (t) => {
  const setup = await setupProject(t);
  const device = await createPhysicalDevice(setup);
  const fd = await open(join(setup.dir, "world.json"));
  const proto = Object.getPrototypeOf(fd) as {
    writeFile: (this: unknown, data: unknown, ...args: unknown[]) => Promise<void>;
  };
  await fd.close();
  const original = proto.writeFile;
  let fail = true;
  t.mock.method(
    proto,
    "writeFile",
    async function (this: unknown, data: unknown, ...args: unknown[]) {
      const text = Buffer.isBuffer(data) ? data.toString("utf8") : String(data);
      if (fail && text.includes('"state":"pending"')) {
        fail = false;
        throw Object.assign(new Error("Injected authorization failure"), { code: "ENOSPC" });
      }
      return original.call(this, data, ...args);
    }
  );

  const operationId = randomUUID();
  const installationId = randomUUID();
  await assert.rejects(
    beginDevice(setup, device, {
      operationId,
      installationId,
      hardwareId: "hw-1",
      fingerprint: fingerprint(1),
    }),
    /Injected authorization failure/
  );
  const half = await storedDocument(setup);
  assert.equal(half.world.devices[device.deviceId]?.hardwareId, "hw-1");
  assert.equal((await readAuthorizationStore(setup.storageRoot)).assignments.length, 0);
  assert.equal(await resolveActiveAssignment(setup.storageRoot, fingerprint(1)), undefined);

  await createProject(setup, "other");
  const other = await createPhysicalDevice(setup, [...fieldCapabilities], "other");
  await assert.rejects(
    beginDevice(setup, other, {
      project: "other",
      operationId,
      hardwareId: "hw-2",
      fingerprint: fingerprint(2),
    }),
    /operation|content/i
  );
  assert.equal(
    (await storedDocument(setup, "other")).world.devices[other.deviceId]?.hardwareId,
    undefined
  );

  const retry = await beginDevice(setup, device, {
    operationId,
    installationId,
    hardwareId: "hw-1",
    fingerprint: fingerprint(1),
    expectedRevision: half.world.revision,
  });
  assert.equal(retry.assignment.state, "pending");
  const completed = await completeDevice(setup, retry.assignment.id);
  assert.equal(completed.assignment.state, "active");
});

test("hardware rebind failures at every publication boundary stay fail-closed and retry", async (t) => {
  for (const boundary of ["revoke", "world", "status", "activate"] as const) {
    await t.test(boundary, async (t) => {
      const setup = await setupProject(t, `demo-${boundary}`);
      const device = await createPhysicalDevice(setup);
      const bound = await bindDevice(setup, device, {
        hardwareId: "hw-1",
        fingerprint: fingerprint(1),
      });
      const before = await storedDocument(setup);
      if (boundary === "status")
        await writeFile(
          join(setup.dir, "device-status.json"),
          JSON.stringify({
            schemaVersion: 3,
            identity: deviceStatusIdentity(before.world, before.statusEpoch),
            devices: {},
          })
        );
      const fd = await open(join(setup.dir, "world.json"));
      const proto = Object.getPrototypeOf(fd) as {
        writeFile: (this: unknown, data: unknown, ...args: unknown[]) => Promise<void>;
      };
      await fd.close();
      const original = proto.writeFile;
      let fail = true;
      let authWrites = 0;
      t.mock.method(
        proto,
        "writeFile",
        async function (this: unknown, data: unknown, ...args: unknown[]) {
          const text = Buffer.isBuffer(data) ? data.toString("utf8") : String(data);
          const auth = text.includes('"assignments"');
          const world = text.includes('"lastOperation"');
          const status = text.includes('"schemaVersion":3');
          if (fail) {
            if (boundary === "revoke" && auth) {
              fail = false;
              throw Object.assign(new Error("Injected revoke failure"), { code: "ENOSPC" });
            }
            if (boundary === "world" && world) {
              fail = false;
              throw Object.assign(new Error("Injected world failure"), { code: "ENOSPC" });
            }
            if (boundary === "status" && status) {
              fail = false;
              throw Object.assign(new Error("Injected status failure"), { code: "ENOSPC" });
            }
            if (boundary === "activate" && auth && ++authWrites === 2) {
              fail = false;
              throw Object.assign(new Error("Injected activate failure"), { code: "ENOSPC" });
            }
          }
          return original.call(this, data, ...args);
        }
      );

      const operationId = randomUUID();
      const request = {
        action: "rebindHardware",
        operationId,
        assignmentId: bound.assignment.id,
        hardwareId: "hw-2",
        fingerprint: fingerprint(2),
        expectedRevision: before.world.revision,
      };

      if (boundary === "status") {
        const result = (await enrollmentCommand(setup, request)) as EnrollmentResult;
        assert.equal(result.assignment.state, "active");
      } else {
        await assert.rejects(
          enrollmentCommand(setup, request),
          new RegExp(`Injected ${boundary} failure`)
        );
      }

      const store = await readAuthorizationStore(setup.storageRoot);
      assert.equal(fail, false, `publication fault not reached: ${boundary}`);
      const old = store.assignments.find((entry) => entry.id === bound.assignment.id)!;
      const document = await storedDocument(setup);
      if (boundary === "revoke") {
        assert.equal(old.state, "active");
        assert.equal(document.world.devices[device.deviceId]?.hardwareId, "hw-1");
      } else {
        assert.equal(old.state, "revoked");
      }
      if (boundary === "world") {
        assert.equal(document.world.devices[device.deviceId]?.hardwareId, "hw-1");
        assert.equal(store.assignments.filter((entry) => entry.state === "active").length, 0);
      }
      if (boundary === "activate") {
        assert.equal(document.world.devices[device.deviceId]?.hardwareId, "hw-2");
        assert.equal(store.assignments.filter((entry) => entry.state === "active").length, 0);
        const path = join(setup.dir, "world.json"),
          saved = await readFile(path, "utf8");
        const doc = JSON.parse(saved) as { lastOperation: { digest: string } };
        doc.lastOperation.digest = fingerprint(42);
        await writeFile(path, JSON.stringify(doc));
        await assert.rejects(enrollmentCommand(setup, request), /conflict|content/i);
        assert.equal(await resolveActiveAssignment(setup.storageRoot, fingerprint(2)), undefined);
        await writeFile(path, saved);
      }
      if (boundary === "status") {
        assert.equal(document.world.devices[device.deviceId]?.hardwareId, "hw-2");
        assert.equal(store.assignments.filter((entry) => entry.state === "active").length, 1);
      }

      const retry = (await enrollmentCommand(setup, request)) as EnrollmentResult;
      assert.equal(retry.assignment.state, "active");
      assert.equal(retry.assignment.hardwareId, "hw-2");
      assert.equal(
        (await storedDocument(setup)).world.devices[device.deviceId]?.hardwareId,
        "hw-2"
      );
    });
  }
});

test("a corrupt or unsafe authorization store closes physical authorization only", async (t) => {
  const setup = await setupProject(t);
  const device = await createPhysicalDevice(setup);
  const bound = await bindDevice(setup, device, { hardwareId: "hw-1" });
  const path = authorizationStorePath(setup.storageRoot);
  const corrupt = "{not-json";
  await writeFile(path, corrupt);

  await assert.rejects(resolveActiveAssignment(setup.storageRoot, fingerprint(1)), /unreadable/);
  await assert.rejects(
    enrollmentCommand(setup, {
      action: "revoke",
      operationId: randomUUID(),
      assignmentId: bound.assignment.id,
    }),
    /unreadable/
  );
  assert.equal((await openProject(setup)).world.id, setup.project);
  await saveSite(setup, [
    {
      op: "updateDevice",
      id: device.deviceId,
      details: {
        name: "Still editable",
        roles: ["sensor"],
        capabilities: [...fieldCapabilities],
      },
    },
  ]);
  assert.equal(await readFile(path, "utf8"), corrupt);

  await rm(path);
  const other = join(setup.storageRoot, "field", "other.json");
  await writeFile(other, serializeAuthorizationStore(emptyAuthorizationStore()));
  await symlink(other, path);
  await assert.rejects(
    resolveActiveAssignment(setup.storageRoot, fingerprint(1)),
    /unreadable|Unsafe/
  );
  assert.equal((await openProject(setup)).world.id, setup.project);
});

test("revocation does not need a readable world and survives a restart", async (t) => {
  const setup = await setupProject(t);
  const device = await createPhysicalDevice(setup);
  const bound = await bindDevice(setup, device, { hardwareId: "hw-1" });
  await writeFile(join(setup.dir, "world.json"), "{broken-world");
  await writeFile(join(setup.dir, "device-status.json"), "{broken-status");

  const revoked = (await enrollmentCommand(setup, {
    action: "revoke",
    operationId: randomUUID(),
    assignmentId: bound.assignment.id,
  })) as { assignment: AuthorizationAssignment };
  assert.equal(revoked.assignment.state, "revoked");
  assert.equal(await resolveActiveAssignment(setup.storageRoot, fingerprint(1)), undefined);

  const restarted = await readAuthorizationStore(setup.storageRoot);
  const persisted = restarted.assignments.find((entry) => entry.id === bound.assignment.id)!;
  assert.equal(persisted.state, "revoked");
  assert.ok(persisted.revokedAt !== undefined);
});

test("fingerprint resolution does not take the project lock and concurrent completion is single-winner", async (t) => {
  const setup = await setupProject(t);
  const device = await createPhysicalDevice(setup);
  const bound = await bindDevice(setup, device, { hardwareId: "hw-1" });
  const fd = await open(join(setup.dir, "world.json"));
  const proto = Object.getPrototypeOf(fd) as {
    writeFile: (this: unknown, data: unknown, ...args: unknown[]) => Promise<void>;
  };
  await fd.close();
  const original = proto.writeFile;
  let release!: () => void;
  const gate = new Promise<void>((resolve) => {
    release = resolve;
  });
  let entered!: () => void;
  const started = new Promise<void>((resolve) => {
    entered = resolve;
  });
  t.mock.method(
    proto,
    "writeFile",
    async function (this: unknown, data: unknown, ...args: unknown[]) {
      const text = Buffer.isBuffer(data) ? data.toString("utf8") : String(data);
      if (text.includes('"lastOperation"')) {
        entered();
        await gate;
      }
      return original.call(this, data, ...args);
    }
  );

  const saving = saveSite(setup, [
    {
      op: "updateDevice",
      id: device.deviceId,
      details: {
        name: "Slow rename",
        roles: ["sensor"],
        capabilities: [...fieldCapabilities],
      },
    },
  ]);
  await started;
  const resolved = await Promise.race([
    resolveActiveAssignment(setup.storageRoot, fingerprint(1)),
    new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error("resolution blocked")), 500)
    ),
  ]);
  assert.equal(resolved?.id, bound.assignment.id);
  release();
  await saving;
  const current = await storedDocument(setup);

  const pending = await beginDevice(setup, device, {
    hardwareId: "hw-1",
    installationId: bound.installationId,
    fingerprint: fingerprint(2),
    capabilities: ["battery.level.v1"],
    renews: bound.assignment.id,
    expectedRevision: current.world.revision,
  });
  assert.equal(pending.assignment.state, "pending");
  const results = await Promise.allSettled([
    completeDevice(setup, pending.assignment.id, randomUUID()),
    completeDevice(setup, pending.assignment.id, randomUUID()),
  ]);
  assert.equal(results.filter((result) => result.status === "fulfilled").length, 1);
  const store = await readAuthorizationStore(setup.storageRoot);
  assert.equal(
    store.assignments.filter(
      (entry) => entry.state === "active" && entry.lineageId === pending.assignment.lineageId
    ).length,
    1
  );
});

test("enrollment is not a room command and rejects identity claims outside the contract", async (t) => {
  const setup = await setupProject(t);
  await assert.rejects(projectCommand(setup.context, "GaiaEnrollment", {}), /Unknown Gaia command/);
  const projects = (await projectCommand(setup.context, "GaiaProjects", {})) as {
    projects: string[];
  };
  assert.deepEqual(projects.projects, [setup.project]);
  assert.equal(
    authorizationStorePath(setup.storageRoot).startsWith(join(setup.storageRoot, "projects")),
    false
  );

  const device = await createPhysicalDevice(setup);
  await assert.rejects(
    enrollmentCommand(setup, {
      action: "begin",
      operationId: randomUUID(),
      project: setup.project,
      deviceId: device.deviceId,
      hardwareId: "hw-1",
      installationId: randomUUID(),
      fingerprint: fingerprint(1),
      capabilities: ["battery.level.v1"],
      expectedRevision: device.revision,
      ip: "192.0.2.1",
      mac: "00:00:5e:00:53:01",
      adbSerial: "serial",
    }),
    /Unexpected Gaia enrollment fields/
  );
});

test("reassigning a device to another project closes the source permission first", async (t) => {
  const source = await setupProject(t, "source");
  const sourceDevice = await createPhysicalDevice(source);
  const bound = await bindDevice(source, sourceDevice, {
    hardwareId: "hw-1",
    fingerprint: fingerprint(1),
  });
  const target = await createProject(source, "target");
  assert.equal(target.world.id, "target");
  const targetDevice = await createPhysicalDevice(source, [...fieldCapabilities], "target");
  const sourceDocument = await storedDocument(source);
  const targetDocument = await storedDocument(source, "target");

  const reassigned = (await enrollmentCommand(source, {
    action: "reassign",
    operationId: randomUUID(),
    assignmentId: bound.assignment.id,
    targetProject: "target",
    targetDeviceId: targetDevice.deviceId,
    expectedSourceRevision: sourceDocument.world.revision,
    expectedTargetRevision: targetDocument.world.revision,
    hardwareId: "hw-1",
    fingerprint: fingerprint(2),
    capabilities: ["battery.level.v1"],
  })) as EnrollmentResult;
  const targetAfter = await storedDocument(source, "target");
  const sourceStore = await readAuthorizationStore(source.storageRoot);
  assert.throws(
    () =>
      parseAuthorizationStore({
        ...sourceStore,
        assignments: sourceStore.assignments.filter((a) => a.id !== reassigned.assignment.id),
      }),
    /invalid|missing/i
  );

  assert.equal(reassigned.assignment.state, "active");
  assert.equal(reassigned.assignment.projectId, "target");
  assert.equal(reassigned.assignment.deviceId, targetDevice.deviceId);
  assert.equal(reassigned.assignment.authorizationGeneration, 2);
  assert.equal(
    sourceStore.assignments.find((entry) => entry.id === bound.assignment.id)?.state,
    "revoked"
  );
  assert.equal(await resolveActiveAssignment(source.storageRoot, fingerprint(1)), undefined);
  assert.equal(
    (await resolveActiveAssignment(source.storageRoot, fingerprint(2)))?.id,
    reassigned.assignment.id
  );
  assert.equal(targetAfter.world.devices[targetDevice.deviceId]?.hardwareId, "hw-1");
  verifyActiveAssignment(targetAfter.world, targetAfter.statusEpoch, reassigned.assignment);
  await enrollmentCommand(source, {
    action: "revoke",
    assignmentId: bound.assignment.id,
    operationId: randomUUID(),
  });
  assert.equal(await resolveActiveAssignment(source.storageRoot, fingerprint(2)), undefined);
});

test("a missed authorization reconciliation is not repaired by a later world save", async (t) => {
  const setup = await setupProject(t);
  const device = await createPhysicalDevice(setup);
  const bound = await bindDevice(setup, device, {
    hardwareId: "hw-1",
    capabilities: ["battery.level.v1", "battery.voltage.v1"],
  });
  const fd = await open(join(setup.dir, "world.json"));
  const proto = Object.getPrototypeOf(fd) as {
    writeFile: (this: unknown, data: unknown, ...args: unknown[]) => Promise<void>;
  };
  await fd.close();
  const original = proto.writeFile;
  let fail = true;
  t.mock.method(
    proto,
    "writeFile",
    async function (this: unknown, data: unknown, ...args: unknown[]) {
      const text = Buffer.isBuffer(data) ? data.toString("utf8") : String(data);
      if (fail && text.includes('"assignments"')) {
        fail = false;
        throw Object.assign(new Error("Injected reconcile failure"), { code: "ENOSPC" });
      }
      return original.call(this, data, ...args);
    }
  );

  await saveSite(setup, [
    {
      op: "updateDevice",
      id: device.deviceId,
      details: {
        name: "Field client",
        roles: ["sensor"],
        capabilities: ["battery.level.v1"],
      },
    },
  ]);
  const changed = await storedDocument(setup);
  let store = await readAuthorizationStore(setup.storageRoot);
  let active = store.assignments.find((entry) => entry.id === bound.assignment.id)!;
  assert.equal(active.state, "active");
  assert.notEqual(active.statusEpoch, changed.statusEpoch);
  assert.throws(
    () => verifyActiveAssignment(changed.world, changed.statusEpoch, active),
    /stale|epoch/
  );

  await saveSite(setup, [
    {
      op: "updateDevice",
      id: device.deviceId,
      details: {
        name: "Renamed after missed sync",
        roles: ["sensor"],
        capabilities: ["battery.level.v1"],
      },
    },
  ]);
  store = await readAuthorizationStore(setup.storageRoot);
  active = store.assignments.find((entry) => entry.id === bound.assignment.id)!;
  assert.equal(active.state, "revoked");
  assert.equal(await resolveActiveAssignment(setup.storageRoot, fingerprint(1)), undefined);
});

test("a revoked certificate cannot be enrolled again as a new generation", () => {
  const world = fieldWorld();
  const initial = assignmentInput();
  const begun = beginAuthorization(emptyAuthorizationStore(), world, 7, initial);
  const active = completeAuthorization(begun.store, world, 7, {
    assignmentId: begun.assignment.id,
    operationId: randomUUID(),
    now: 2000,
  });
  const revoked = revokeAuthorization(active.store, {
    assignmentId: active.assignment.id,
    operationId: randomUUID(),
    now: 3000,
  });
  assert.throws(
    () =>
      beginAuthorization(revoked.store, world, 7, {
        ...initial,
        operationId: randomUUID(),
        now: 4000,
      }),
    /revoked|retired|fingerprint|certificate/i
  );
});

test("explicit revocation cancels a pending certificate renewal", () => {
  const world = fieldWorld();
  const initial = assignmentInput();
  const begun = beginAuthorization(emptyAuthorizationStore(), world, 7, initial);
  const active = completeAuthorization(begun.store, world, 7, {
    assignmentId: begun.assignment.id,
    operationId: randomUUID(),
    now: 2000,
  });
  const pending = beginAuthorization(active.store, world, 7, {
    ...initial,
    operationId: randomUUID(),
    fingerprint: fingerprint(2),
    renews: active.assignment.id,
    now: 3000,
  });
  const revoked = revokeAuthorization(pending.store, {
    assignmentId: active.assignment.id,
    operationId: randomUUID(),
    now: 4000,
  });
  assert.throws(
    () =>
      completeAuthorization(revoked.store, world, 7, {
        assignmentId: pending.assignment.id,
        operationId: randomUUID(),
        now: 5000,
      }),
    /revoked|pending|predecessor|authorization/i
  );
});

test("rebind operation replay rejects different approved content", async (t) => {
  const setup = await setupProject(t);
  const device = await createPhysicalDevice(setup);
  const bound = await bindDevice(setup, device);
  const before = await storedDocument(setup);
  const request = {
    action: "rebindHardware",
    operationId: randomUUID(),
    assignmentId: bound.assignment.id,
    hardwareId: "hw-2",
    fingerprint: fingerprint(2),
    expectedRevision: before.world.revision,
  };
  await enrollmentCommand(setup, request);
  await assert.rejects(
    enrollmentCommand(setup, {
      ...request,
      fingerprint: fingerprint(3),
    }),
    /operation|content|conflict/i
  );
});

test("authorization read rejects a symlinked field directory", async (t) => {
  const setup = await setupProject(t);
  const device = await createPhysicalDevice(setup);
  await bindDevice(setup, device);
  const field = join(setup.storageRoot, "field");
  const moved = join(setup.storageRoot, "other-field");
  await rename(field, moved);
  await symlink(moved, field, "dir");
  await assert.rejects(
    resolveActiveAssignment(setup.storageRoot, fingerprint(1)),
    /unreadable|unsafe/i
  );
  await assert.rejects(
    enrollmentCommand(setup, {
      action: "revoke",
      operationId: randomUUID(),
      assignmentId: randomUUID(),
    }),
    /unreadable|unsafe/i
  );
  assert.equal((await openProject(setup)).world.id, setup.project);
});

test("a revoked predecessor cannot activate a new generation", () => {
  const world = fieldWorld();
  const begun = beginAuthorization(emptyAuthorizationStore(), world, 7, assignmentInput());
  const active = completeAuthorization(begun.store, world, 7, {
    assignmentId: begun.assignment.id,
    operationId: randomUUID(),
    now: 2_000,
  });
  const revoked = revokeAuthorization(active.store, {
    assignmentId: active.assignment.id,
    operationId: randomUUID(),
    now: 3_000,
  });
  const base = {
    projectId: "demo",
    deviceId: "field-1",
    hardwareId: "hw-1",
    installationId: active.assignment.installationId,
    capabilities: ["battery.level.v1"],
    lineageId: active.assignment.lineageId,
    authorizationGeneration: 2,
    predecessorId: active.assignment.id,
    operationDigest: fingerprint(42),
    now: 4_000,
  };

  assert.throws(
    () =>
      activateAuthorization(revoked.store, world, 7, {
        ...base,
        operationId: randomUUID(),
        fingerprint: fingerprint(1),
      }),
    /revoked|predecessor|fingerprint/i
  );
  assert.throws(
    () =>
      activateAuthorization(revoked.store, world, 7, {
        ...base,
        operationId: randomUUID(),
        fingerprint: fingerprint(2),
      }),
    /predecessor|released|authorization/i
  );
});

test("provider revocation cancels a pending renewal and its certificate", async (t) => {
  const setup = await setupProject(t);
  const device = await createPhysicalDevice(setup);
  const bound = await bindDevice(setup, device);
  const document = await storedDocument(setup);
  const pending = await beginDevice(setup, device, {
    hardwareId: "hw-1",
    installationId: bound.installationId,
    fingerprint: fingerprint(2),
    capabilities: bound.capabilities,
    renews: bound.assignment.id,
    expectedRevision: document.world.revision,
  });

  await enrollmentCommand(setup, {
    action: "revoke",
    operationId: randomUUID(),
    assignmentId: bound.assignment.id,
  });
  await assert.rejects(
    completeDevice(setup, pending.assignment.id),
    /revoked|pending|predecessor|authorization/i
  );
  const store = await readAuthorizationStore(setup.storageRoot);
  assert.equal(
    store.assignments.find((entry) => entry.id === pending.assignment.id)?.state,
    "revoked"
  );
  await assert.rejects(
    beginDevice(setup, device, {
      hardwareId: "hw-1",
      installationId: bound.installationId,
      fingerprint: fingerprint(2),
      capabilities: bound.capabilities,
      expectedRevision: document.world.revision,
    }),
    /revoked|fingerprint|certificate/i
  );
});

test("revoked certificate fingerprints cannot be reused by rebind or reassign", async (t) => {
  const setup = await setupProject(t);
  const device = await createPhysicalDevice(setup);
  const bound = await bindDevice(setup, device, { fingerprint: fingerprint(1) });
  const source = await storedDocument(setup);
  await createProject(setup, "target");
  const targetDevice = await createPhysicalDevice(setup, [...fieldCapabilities], "target");
  const target = await storedDocument(setup, "target");

  await assert.rejects(
    enrollmentCommand(setup, {
      action: "rebindHardware",
      operationId: randomUUID(),
      assignmentId: bound.assignment.id,
      hardwareId: "hw-2",
      fingerprint: fingerprint(1),
      expectedRevision: source.world.revision,
    }),
    /new certificate|fingerprint|revoked/i
  );
  await assert.rejects(
    enrollmentCommand(setup, {
      action: "reassign",
      operationId: randomUUID(),
      assignmentId: bound.assignment.id,
      targetProject: "target",
      targetDeviceId: targetDevice.deviceId,
      expectedSourceRevision: source.world.revision,
      expectedTargetRevision: target.world.revision,
      hardwareId: "hw-1",
      fingerprint: fingerprint(1),
    }),
    /new certificate|fingerprint|revoked/i
  );
  assert.equal(
    (await resolveActiveAssignment(setup.storageRoot, fingerprint(1)))?.id,
    bound.assignment.id
  );
  assert.equal(
    (await storedDocument(setup, "target")).world.devices[targetDevice.deviceId]?.hardwareId,
    undefined
  );
});

test("reassign operation replay rejects different approved content", async (t) => {
  const setup = await setupProject(t, "source");
  const device = await createPhysicalDevice(setup);
  const bound = await bindDevice(setup, device, {
    hardwareId: "hw-1",
    fingerprint: fingerprint(1),
  });
  await createProject(setup, "target");
  const targetDevice = await createPhysicalDevice(setup, [...fieldCapabilities], "target");
  const source = await storedDocument(setup);
  const target = await storedDocument(setup, "target");
  const request = {
    action: "reassign",
    operationId: randomUUID(),
    assignmentId: bound.assignment.id,
    targetProject: "target",
    targetDeviceId: targetDevice.deviceId,
    expectedSourceRevision: source.world.revision,
    expectedTargetRevision: target.world.revision,
    hardwareId: "hw-1",
    fingerprint: fingerprint(2),
    capabilities: ["battery.level.v1"],
  };

  const first = (await enrollmentCommand(setup, request)) as EnrollmentResult;
  const retry = (await enrollmentCommand(setup, request)) as EnrollmentResult;
  assert.equal(retry.assignment.id, first.assignment.id);
  await assert.rejects(
    enrollmentCommand(setup, { ...request, fingerprint: fingerprint(3) }),
    /operation|content|conflict/i
  );
});

test("stale reassign target revision stays closed until a new local approval", async (t) => {
  const setup = await setupProject(t, "source");
  const sourceDevice = await createPhysicalDevice(setup);
  const bound = await bindDevice(setup, sourceDevice, {
    hardwareId: "hw-1",
    fingerprint: fingerprint(1),
  });
  await createProject(setup, "target");
  const targetDevice = await createPhysicalDevice(setup, [...fieldCapabilities], "target");
  const targetDocument = await storedDocument(setup, "target");
  const targetBegin = (await enrollmentCommand(setup, {
    action: "begin",
    operationId: randomUUID(),
    project: "target",
    deviceId: targetDevice.deviceId,
    hardwareId: "hw-2",
    installationId: randomUUID(),
    fingerprint: fingerprint(2),
    capabilities: [...fieldCapabilities],
    expectedRevision: targetDocument.world.revision,
  })) as EnrollmentResult;
  const targetActive = (await enrollmentCommand(setup, {
    action: "complete",
    operationId: randomUUID(),
    assignmentId: targetBegin.assignment.id,
  })) as EnrollmentResult;
  await enrollmentCommand(setup, {
    action: "revoke",
    operationId: randomUUID(),
    assignmentId: targetActive.assignment.id,
  });

  const source = await storedDocument(setup);
  const target = await storedDocument(setup, "target");
  const request = {
    action: "reassign",
    operationId: randomUUID(),
    assignmentId: bound.assignment.id,
    targetProject: "target",
    targetDeviceId: targetDevice.deviceId,
    expectedSourceRevision: source.world.revision,
    expectedTargetRevision: target.world.revision - 1,
    hardwareId: "hw-2",
    fingerprint: fingerprint(3),
    capabilities: ["battery.level.v1"],
  };

  await assert.rejects(enrollmentCommand(setup, request), /revision|conflict/i);
  const failed = await readAuthorizationStore(setup.storageRoot);
  assert.equal(
    failed.assignments.find((entry) => entry.id === bound.assignment.id)?.state,
    "revoked"
  );
  assert.equal(
    failed.assignments.filter((entry) => entry.state === "active" && entry.projectId === "target")
      .length,
    0
  );

  await assert.rejects(
    enrollmentCommand(setup, { ...request, expectedTargetRevision: target.world.revision }),
    /operation|approval|content|conflict/i
  );
  await enrollmentCommand(setup, {
    action: "revoke",
    assignmentId: bound.assignment.id,
    operationId: randomUUID(),
  });
  const approved = await beginDevice(setup, targetDevice, {
    project: "target",
    hardwareId: "hw-2",
    fingerprint: fingerprint(4),
    capabilities: ["battery.level.v1"],
    expectedRevision: target.world.revision,
  });
  const retried = await completeDevice(setup, approved.assignment.id);
  assert.notEqual(retried.assignment.lineageId, bound.assignment.lineageId);
  const after = await storedDocument(setup, "target");
  assert.equal(retried.assignment.state, "active");
  assert.equal(retried.assignment.projectId, "target");
  verifyActiveAssignment(after.world, after.statusEpoch, retried.assignment);
});

test("reassign failures at every publication boundary stay fail-closed and retry", async (t) => {
  for (const boundary of ["revoke", "world", "status", "activate"] as const) {
    await t.test(boundary, async (t) => {
      const setup = await setupProject(t, `source-${boundary}`);
      const sourceDevice = await createPhysicalDevice(setup);
      const bound = await bindDevice(setup, sourceDevice, {
        hardwareId: "hw-1",
        fingerprint: fingerprint(1),
      });
      await createProject(setup, "target");
      const targetDevice = await createPhysicalDevice(setup, [...fieldCapabilities], "target");
      const source = await storedDocument(setup);
      const target = await storedDocument(setup, "target");
      if (boundary === "status")
        await writeFile(
          join(setup.storageRoot, "projects", "target", "device-status.json"),
          JSON.stringify({
            schemaVersion: 3,
            identity: deviceStatusIdentity(target.world, target.statusEpoch),
            devices: {},
          })
        );
      const fd = await open(join(setup.dir, "world.json"));
      const proto = Object.getPrototypeOf(fd) as {
        writeFile: (this: unknown, data: unknown, ...args: unknown[]) => Promise<void>;
      };
      await fd.close();
      const original = proto.writeFile;
      let fail = true;
      let authWrites = 0;
      t.mock.method(
        proto,
        "writeFile",
        async function (this: unknown, data: unknown, ...args: unknown[]) {
          const text = Buffer.isBuffer(data) ? data.toString("utf8") : String(data);
          const auth = text.includes('"assignments"');
          const world = text.includes('"lastOperation"');
          if (fail) {
            if (boundary === "status" && text.includes('"schemaVersion":3')) {
              fail = false;
              throw new Error("Injected status failure");
            }
            if (boundary === "revoke" && auth) {
              fail = false;
              throw Object.assign(new Error("Injected revoke failure"), { code: "ENOSPC" });
            }
            if (boundary === "world" && world) {
              fail = false;
              throw Object.assign(new Error("Injected world failure"), { code: "ENOSPC" });
            }
            if (boundary === "activate" && auth && ++authWrites === 2) {
              fail = false;
              throw Object.assign(new Error("Injected activate failure"), { code: "ENOSPC" });
            }
          }
          return original.call(this, data, ...args);
        }
      );

      const request = {
        action: "reassign",
        operationId: randomUUID(),
        assignmentId: bound.assignment.id,
        targetProject: "target",
        targetDeviceId: targetDevice.deviceId,
        expectedSourceRevision: source.world.revision,
        expectedTargetRevision: target.world.revision,
        hardwareId: "hw-1",
        fingerprint: fingerprint(2),
        capabilities: ["battery.level.v1"],
      };
      if (boundary === "status") await enrollmentCommand(setup, request);
      else
        await assert.rejects(
          enrollmentCommand(setup, request),
          new RegExp(`Injected ${boundary} failure`)
        );
      assert.equal(fail, false, `publication fault not reached: ${boundary}`);

      const store = await readAuthorizationStore(setup.storageRoot);
      const old = store.assignments.find((entry) => entry.id === bound.assignment.id)!;
      const targetAfterFailure = await storedDocument(setup, "target");
      if (boundary === "revoke") {
        assert.equal(old.state, "active");
        assert.equal(
          targetAfterFailure.world.devices[targetDevice.deviceId]?.hardwareId,
          undefined
        );
      } else {
        assert.equal(old.state, "revoked");
      }
      if (boundary === "world") {
        assert.equal(
          targetAfterFailure.world.devices[targetDevice.deviceId]?.hardwareId,
          undefined
        );
      }
      if (boundary === "activate") {
        assert.equal(targetAfterFailure.world.devices[targetDevice.deviceId]?.hardwareId, "hw-1");
        assert.equal(
          store.assignments.filter(
            (entry) => entry.state === "active" && entry.projectId === "target"
          ).length,
          0
        );
      }

      const retry = (await enrollmentCommand(setup, request)) as EnrollmentResult;
      assert.equal(retry.assignment.state, "active");
      assert.equal(retry.assignment.projectId, "target");
      assert.equal(
        (await storedDocument(setup, "target")).world.devices[targetDevice.deviceId]?.hardwareId,
        "hw-1"
      );
    });
  }
});

test("revocation is serialized with trusted observation publication", async (t) => {
  const setup = await setupProject(t);
  const device = await createPhysicalDevice(setup);
  const bound = await bindDevice(setup, device, { hardwareId: "hw-1" });
  let entered!: () => void;
  const started = new Promise<void>((resolve) => {
    entered = resolve;
  });
  let release!: () => void;
  const gate = new Promise<void>((resolve) => {
    release = resolve;
  });
  const publication = setup.authority.withVerifiedAssignment(
    setup.project,
    fingerprint(1),
    { authorizationGeneration: 1 },
    async (_world, _statusEpoch, assignment) => {
      assert.equal(assignment.id, bound.assignment.id);
      entered();
      await gate;
      return "published";
    }
  );
  await started;

  let revoked = false;
  const revoking = enrollmentCommand(setup, {
    action: "revoke",
    operationId: randomUUID(),
    assignmentId: bound.assignment.id,
  }).then((result) => {
    revoked = true;
    return result;
  });
  await new Promise((resolve) => setTimeout(resolve, 100));
  assert.equal(revoked, false);

  release();
  assert.equal(await publication, "published");
  await revoking;
  assert.equal(revoked, true);
  assert.equal(await resolveActiveAssignment(setup.storageRoot, fingerprint(1)), undefined);
  await assert.rejects(
    setup.authority.withVerifiedAssignment(setup.project, fingerprint(1), {}, async () => "late"),
    /not active|authorization/i
  );
});

test("an interrupted reassignment cannot substitute a different certificate on retry", async (t) => {
  const setup = await setupProject(t, "source");
  const sourceDevice = await createPhysicalDevice(setup);
  const bound = await bindDevice(setup, sourceDevice, { fingerprint: fingerprint(1) });
  await createProject(setup, "target");
  const targetDevice = await createPhysicalDevice(setup, [...fieldCapabilities], "target");
  const source = await storedDocument(setup);
  const target = await storedDocument(setup, "target");
  const request = {
    action: "reassign",
    operationId: randomUUID(),
    assignmentId: bound.assignment.id,
    targetProject: "target",
    targetDeviceId: targetDevice.deviceId,
    expectedSourceRevision: source.world.revision,
    expectedTargetRevision: target.world.revision - 1,
    fingerprint: fingerprint(2),
    capabilities: ["battery.level.v1"],
  };
  await assert.rejects(enrollmentCommand(setup, request), /revision|conflict/i);
  await assert.rejects(
    enrollmentCommand(setup, {
      ...request,
      expectedTargetRevision: target.world.revision,
      fingerprint: fingerprint(3),
    }),
    /operation|content|conflict|approval/i
  );
  assert.equal(await resolveActiveAssignment(setup.storageRoot, fingerprint(3)), undefined);
  await assert.rejects(
    beginDevice(setup, sourceDevice, {
      expectedRevision: source.world.revision,
      fingerprint: fingerprint(2),
    }),
    /reserved|transfer|assigned/i
  );
  const cancel = { action: "revoke", assignmentId: bound.assignment.id, operationId: randomUUID() };
  await enrollmentCommand(setup, cancel);
  await enrollmentCommand(setup, cancel);
  await assert.rejects(
    beginDevice(setup, sourceDevice, {
      expectedRevision: source.world.revision,
      fingerprint: fingerprint(2),
    }),
    /revoked|retired/i
  );
});

test("cancelling just the pending renewal preserves the parent and burns its generation", () => {
  const world = fieldWorld();
  const input = assignmentInput();
  const root = beginAuthorization(emptyAuthorizationStore(), world, 7, input);
  const active = completeAuthorization(root.store, world, 7, {
    assignmentId: root.assignment.id,
    operationId: randomUUID(),
    now: 2000,
  });
  const renew = { ...input, renews: active.assignment.id, now: 3000 };
  const pending = beginAuthorization(active.store, world, 7, {
    ...renew,
    operationId: randomUUID(),
    fingerprint: fingerprint(2),
  });
  const cancelled = revokeAuthorization(pending.store, {
    assignmentId: pending.assignment.id,
    operationId: randomUUID(),
    now: 4000,
  });
  const next = beginAuthorization(cancelled.store, world, 7, {
    ...renew,
    operationId: randomUUID(),
    fingerprint: fingerprint(3),
    now: 5000,
  });
  assert.equal(next.assignment.authorizationGeneration, 3);
  const completed = completeAuthorization(next.store, world, 7, {
    assignmentId: next.assignment.id,
    operationId: randomUUID(),
    now: 6000,
  });
  assert.equal(completed.assignment.state, "active");
  assert.equal(resolveActiveAssignmentFromStore(completed.store, fingerprint(1)), undefined);
});

test("a renewal requires a predecessor verified in the current epoch", () => {
  const world = fieldWorld();
  const input = assignmentInput();
  const root = beginAuthorization(emptyAuthorizationStore(), world, 7, input);
  const active = completeAuthorization(root.store, world, 7, {
    assignmentId: root.assignment.id,
    operationId: randomUUID(),
    now: 2000,
  });
  assert.throws(
    () =>
      beginAuthorization(active.store, world, 9, {
        ...input,
        operationId: randomUUID(),
        fingerprint: fingerprint(2),
        renews: active.assignment.id,
      }),
    /stale|epoch/i
  );
});

test("the store requires activation evidence and a complete generation history", () => {
  const root = beginAuthorization(emptyAuthorizationStore(), fieldWorld(), 7, assignmentInput());
  for (const change of [
    { state: "active" },
    { authorizationGeneration: 2 },
    { revokeOperationId: randomUUID(), revokeDigest: fingerprint(4) },
  ])
    assert.throws(
      () =>
        parseAuthorizationStore({
          ...root.store,
          assignments: [{ ...root.assignment, ...change }],
        }),
      /invalid/i
    );
});

test("loss of initialized history blocks management without blocking the world", async (t) => {
  const setup = await setupProject(t);
  const device = await createPhysicalDevice(setup);
  const bound = await bindDevice(setup, device);
  await enrollmentCommand(setup, {
    action: "revoke",
    assignmentId: bound.assignment.id,
    operationId: randomUUID(),
  });
  await rm(authorizationStorePath(setup.storageRoot));
  await assert.rejects(
    beginDevice(setup, device, { expectedRevision: bound.complete.revision }),
    /unreadable|missing/i
  );
  assert.equal((await openProject(setup)).world.id, setup.project);
  await rm(join(setup.storageRoot, "field"), { recursive: true });
  await assert.rejects(provisionAuthorizationStore(setup.storageRoot), { code: "EEXIST" });
});

test("a second process cannot own the center between commands; shutdown releases ownership", async (t) => {
  const setup = await setupProject(t);
  const child = () =>
    promisify(execFile)(process.execPath, [
      "--import",
      "tsx",
      "--input-type=module",
      "-e",
      `
    import {openFieldAuthority} from ${JSON.stringify(new URL("../storage/enrollment-service.ts", import.meta.url).href)};
    try {
      const owner = await openFieldAuthority(process.argv[1]);
      await owner.close();
      console.log("acquired");
    } catch (error) { if (error.code !== "EADDRINUSE") throw error; console.log("busy"); }
  `,
      setup.storageRoot,
    ]);
  assert.equal((await child()).stdout.trim(), "busy");
  await setup.authority.close();
  assert.equal((await child()).stdout.trim(), "acquired");
  await assert.rejects(enrollmentCommand(setup, {}), /closed/i);
});

test("a new center can resume the exact transfer after process death at each rename", async (t) => {
  for (const action of ["rebindHardware", "reassign"])
    for (const boundary of ["release", "world", "status", "reconcile", "successor"]) {
      await t.test(`${action}: ${boundary}`, async (t) => {
        const setup = await setupProject(t);
        const from = await createPhysicalDevice(setup);
        const bound = await bindDevice(setup, from);
        const move = action === "reassign",
          project = move ? "other" : setup.project;
        if (move) await createProject(setup, project);
        const to = move ? await createPhysicalDevice(setup, [...fieldCapabilities], project) : from;
        await bindDevice(
          setup,
          await createPhysicalDevice(setup, [...fieldCapabilities], project),
          { project, hardwareId: "unaffected", fingerprint: fingerprint(99) }
        );
        const target = await storedDocument(setup, project);
        await writeFile(
          join(setup.storageRoot, "projects", project, "device-status.json"),
          JSON.stringify({
            schemaVersion: 3,
            identity: deviceStatusIdentity(target.world, target.statusEpoch),
            devices: {},
          })
        );
        const request = {
          action,
          operationId: randomUUID(),
          assignmentId: bound.assignment.id,
          hardwareId: "hw-2",
          fingerprint: fingerprint(2),
          ...(move
            ? {
                targetProject: project,
                targetDeviceId: to.deviceId,
                expectedTargetRevision: target.world.revision,
                expectedSourceRevision: bound.complete.revision,
              }
            : { expectedRevision: target.world.revision }),
        };
        await setup.authority.close();
        const crashed = promisify(execFile)(process.execPath, [
          "--import",
          "tsx",
          "--input-type=module",
          "-e",
          `
        import fs from "node:fs";
        import {basename} from "node:path";
        import {syncBuiltinESMExports} from "node:module";
        const [module,root,request,boundary] = process.argv.slice(1);
        const rename = fs.promises.rename;
        let authWrites = 0;
        fs.promises.rename = async (src,dst) => {
          await rename(src,dst);
          const step = {"authorization.json": () => ["release","reconcile","successor"][authWrites++],
            "world.json": () => "world", "device-status.json": () => "status"}[basename(dst)]?.();
          if (step === boundary) process.exit(74);
        };
        syncBuiltinESMExports();
        const {openFieldAuthority} = await import(module);
        await (await openFieldAuthority(root)).enrollmentCommand(JSON.parse(request));
      `,
          new URL("../storage/enrollment-service.ts", import.meta.url).href,
          setup.storageRoot,
          JSON.stringify(request),
          boundary,
        ]);
        await assert.rejects(crashed, { code: 74 });
        const restarted = await openFieldAuthority(setup.storageRoot);
        t.after(() => restarted.close());
        assert.equal(
          await resolveActiveAssignment(setup.storageRoot, bound.fingerprint),
          undefined
        );
        assert.equal(
          Boolean(await resolveActiveAssignment(setup.storageRoot, request.fingerprint)),
          boundary === "successor"
        );
        const result = (await restarted.enrollmentCommand(request)) as EnrollmentResult;
        assert.equal(result.assignment.projectId, project);
        assert.equal(result.assignment.authorizationGeneration, 2);
        assert.equal(
          await restarted.withVerifiedAssignment(
            project,
            request.fingerprint,
            {},
            async (_w, _e, a) => a.id
          ),
          result.assignment.id
        );
      });
    }
});

test("a completed transfer replay returns the row as read under its project lock", async (t) => {
  const setup = await setupProject(t);
  const bound = await bindDevice(setup, await createPhysicalDevice(setup));
  const request = {
    action: "rebindHardware",
    operationId: randomUUID(),
    assignmentId: bound.assignment.id,
    fingerprint: fingerprint(2),
    hardwareId: "hw-2",
    expectedRevision: bound.complete.revision,
  };
  const moved = (await enrollmentCommand(setup, request)) as EnrollmentResult;
  const fd = await open(authorizationStorePath(setup.storageRoot));
  const proto = Object.getPrototypeOf(fd) as { readFile(this: unknown): Promise<Buffer> };
  await fd.close();
  const original = proto.readFile;
  const routed = Promise.withResolvers<void>(),
    resume = Promise.withResolvers<void>();
  let first = true;
  t.mock.method(proto, "readFile", async function (this: unknown) {
    const bytes = await original.call(this);
    if (first && bytes.includes('"assignments"')) {
      first = false;
      routed.resolve();
      await resume.promise;
    }
    return bytes;
  });
  const replay = enrollmentCommand(setup, request);
  await routed.promise;
  try {
    await enrollmentCommand(setup, {
      action: "revoke",
      assignmentId: moved.assignment.id,
      operationId: randomUUID(),
    });
  } finally {
    resume.resolve();
  }
  assert.equal(((await replay) as EnrollmentResult).assignment.state, "revoked");
});

test("a backwards local clock cannot publish an unreadable authorization ledger", () => {
  const world = fieldWorld();
  const pending = beginAuthorization(
    emptyAuthorizationStore(),
    world,
    7,
    assignmentInput({ now: 3000 })
  );
  const completed = completeAuthorization(pending.store, world, 7, {
    assignmentId: pending.assignment.id,
    operationId: randomUUID(),
    now: 2000,
  });
  const store = parseAuthorizationStore(JSON.parse(serializeAuthorizationStore(completed.store)));
  assert.equal(
    resolveActiveAssignmentFromStore(store, pending.assignment.fingerprint)?.state,
    "active"
  );
});

test("a revision conflict cannot turn into an approval when the target later reaches that number", async (t) => {
  const setup = await setupProject(t);
  const source = await bindDevice(setup, await createPhysicalDevice(setup));
  await createProject(setup, "target");
  const target = await createPhysicalDevice(setup, [...fieldCapabilities], "target");
  const request = {
    action: "reassign",
    operationId: randomUUID(),
    assignmentId: source.assignment.id,
    targetProject: "target",
    targetDeviceId: target.deviceId,
    expectedSourceRevision: source.complete.revision,
    expectedTargetRevision: target.revision + 1,
    fingerprint: fingerprint(2),
  };
  await assert.rejects(enrollmentCommand(setup, request), /revision|conflict/i);
  const updated = await createPhysicalDevice(setup, [...fieldCapabilities], "target");
  assert.equal(updated.revision, request.expectedTargetRevision);
  await assert.rejects(enrollmentCommand(setup, request), /approval|conflict|cancel/i);
  assert.equal(await resolveActiveAssignment(setup.storageRoot, request.fingerprint), undefined);
});

test("an explicit revoke racing a target publication closes the entire transfer", async (t) => {
  for (const boundary of ["inventory", "successor"] as const)
    await t.test(boundary, async (t) => {
      const setup = await setupProject(t, "source");
      const bound = await bindDevice(setup, await createPhysicalDevice(setup));
      await createProject(setup, "target");
      const device = await createPhysicalDevice(setup, [...fieldCapabilities], "target");
      const request = {
        action: "reassign",
        operationId: randomUUID(),
        assignmentId: bound.assignment.id,
        targetProject: "target",
        targetDeviceId: device.deviceId,
        expectedTargetRevision: device.revision,
        expectedSourceRevision: bound.complete.revision,
        fingerprint: fingerprint(2),
      };
      const fd = await open(join(setup.dir, "world.json"));
      const proto = Object.getPrototypeOf(fd) as {
        writeFile(this: unknown, data: string): Promise<void>;
      };
      await fd.close();
      const original = proto.writeFile;
      const writing = Promise.withResolvers<void>(),
        resume = Promise.withResolvers<void>();
      t.mock.method(proto, "writeFile", async function (this: unknown, data: string) {
        if (
          (boundary === "inventory" && data.includes('"lastOperation"')) ||
          (boundary === "successor" &&
            data.includes('"assignments"') &&
            data.includes('"state":"active"'))
        ) {
          writing.resolve();
          await resume.promise;
        }
        return original.call(this, data);
      });
      const moving = enrollmentCommand(setup, request);
      await writing.promise;
      const revoke = {
        action: "revoke",
        operationId: randomUUID(),
        assignmentId: bound.assignment.id,
      };
      const revoking = enrollmentCommand(setup, revoke);
      if (boundary === "inventory") {
        try {
          await revoking;
        } finally {
          resume.resolve();
        }
        await assert.rejects(moving, /cancelled|authorization|released/i);
      } else {
        resume.resolve();
        await Promise.all([moving, revoking]);
      }
      assert.equal(await resolveActiveAssignment(setup.storageRoot, fingerprint(2)), undefined);
      assert.equal(await resolveActiveAssignment(setup.storageRoot, fingerprint(1)), undefined);
      assert.equal(
        ((await enrollmentCommand(setup, revoke)) as EnrollmentResult).assignment.state,
        "revoked"
      );
    });
});

test(
  "an insecure authorization file blocks physical decisions and is not overwritten",
  { skip: process.platform === "win32" },
  async (t) => {
    const setup = await setupProject(t);
    const bound = await bindDevice(setup, await createPhysicalDevice(setup));
    const path = authorizationStorePath(setup.storageRoot);
    const original = await readFile(path);
    await chmod(path, 0o666);
    await assert.rejects(
      setup.authority.withVerifiedAssignment(
        setup.project,
        bound.fingerprint,
        {},
        async () => true
      ),
      /unreadable|unsafe/i
    );
    await assert.rejects(
      enrollmentCommand(setup, {
        action: "revoke",
        operationId: randomUUID(),
        assignmentId: bound.assignment.id,
      }),
      /unreadable|unsafe/i
    );
    assert.deepEqual(await readFile(path), original);
  }
);
