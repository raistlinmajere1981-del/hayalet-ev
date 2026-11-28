import assert from "node:assert/strict";
import test, { type TestContext } from "node:test";
import { randomUUID } from "node:crypto";
import { chmod, mkdtemp, rm, stat, symlink, writeFile, readFile, mkdir } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { FieldReceiverControl } from "../field/lifecycle.ts";
import { FieldManagement, type FieldDialogs } from "../storage/field-management.ts";
import { serialized } from "../storage/files.ts";
import { gaiaStorage } from "../storage/provider.ts";
import {
  authorizationStorePath,
  initializeAuthorizationStore,
  provisionAuthorizationStore,
} from "../storage/enrollment-store.ts";
import { openFieldAuthority } from "../storage/enrollment-service.ts";
import { readFieldServerIdentity, readFieldTrust } from "../storage/field-trust.ts";
import { syntheticFieldCenter, temporaryEndpoint } from "./support/field-center.ts";
import { usbClient } from "./support/usb-client.ts";
import type { FieldOperation, FieldReply } from "../field/management-contract.ts";
import type { Opened } from "../editor/client.ts";
import { readUsbJson, exportInstallation } from "../storage/field-media.ts";

async function temporary(t: TestContext) {
  const dir = await mkdtemp(join(tmpdir(), "gaia-b8-"));
  t.after(() => rm(dir, { recursive: true, force: true }));
  return dir;
}

async function setup(t: TestContext) {
  const [root, media, usbDir] = await Promise.all([temporary(t), temporary(t), temporary(t)]);
  const { usb } = await usbClient();
  const center = await syntheticFieldCenter(root, media, usb);
  const control = new FieldReceiverControl(() => root);
  t.after(() => control.shutdown());
  const inputPath = join(usbDir, "request.json");
  const next = await usbClient();
  await writeFile(inputPath, JSON.stringify({ ...next.usb, installationId: usb.installationId }));
  let packagePath = "";
  const confirmations: string[] = [];
  const dialogs: FieldDialogs = {
    choose: async (kind) =>
      ({ csr: inputPath, media, destination: usbDir, package: packagePath })[kind],
    password: async () => Buffer.from(center.media.passphrase),
    confirm: async (_action, detail) => {
      confirmations.push(detail);
      return true;
    },
  };
  const field = new FieldManagement(control, () => dialogs);
  const storage = gaiaStorage(() => {
    throw new Error("Unexpected raster");
  }, field);
  let closed = false;
  const ctx = { owner: {}, storageRoot: root, assertCurrent: () => assert.ok(!closed) };
  const open = async (project = "demo") =>
    (await storage.execute(ctx, "GaiaOpen", { project })) as Opened;
  const opened = await open();
  const scope = { project: "demo", session: opened.session };
  const raw = async (operation: unknown, caller = ctx, binding = scope) =>
    (await storage.execute(caller, "GaiaField", { ...binding, operation })) as FieldReply<
      FieldOperation["action"]
    >;
  const run = async <T extends FieldOperation>(operation: T) => {
    const reply = (await raw(operation)) as FieldReply<T["action"]>;
    assert.ok(reply.ok, JSON.stringify(reply));
    return reply.data;
  };
  const renew = {
    action: "inspect",
    deviceId: "phone",
    hardwareId: center.pkg.approval.hardwareId,
    capabilities: center.pkg.approval.capabilities,
    revision: opened.world.revision,
    origin: center.endpoint.origin,
    change: { kind: "renew", assignmentId: center.assignmentId },
  } as const;
  return {
    root,
    usbDir,
    media,
    ctx,
    center,
    control,
    dialogs,
    scope,
    raw,
    run,
    renew,
    open,
    storage,
    confirmations,
    setPackage: (filename: string) => {
      packagePath = join(usbDir, filename);
    },
    close: () => {
      closed = true;
    },
  };
}

async function freshSetup(t: TestContext) {
  const [root, media, usbDir] = await Promise.all([temporary(t), temporary(t), temporary(t)]);
  const control = new FieldReceiverControl(() => root);
  t.after(() => control.shutdown());
  let passphrase = "synthetic provisioning passphrase";
  const confirmations: string[] = [];
  const dialogs: FieldDialogs = {
    choose: async (kind) => (kind === "media" ? media : usbDir),
    password: async () => Buffer.from(passphrase),
    confirm: async (_action, detail) => {
      confirmations.push(detail);
      return true;
    },
  };
  const field = new FieldManagement(control, () => dialogs);
  const storage = gaiaStorage(() => {
    throw new Error("Unexpected raster");
  }, field);
  let closed = false;
  const ctx = { owner: {}, storageRoot: root, assertCurrent: () => assert.ok(!closed) };
  const created = (await storage.execute(ctx, "GaiaCreate", {
    project: "demo",
    fixture: false,
    locale: "tr",
  })) as { world: Opened["world"] };
  const opened = (await storage.execute(ctx, "GaiaOpen", { project: "demo" })) as Opened;
  const scope = { project: "demo", session: opened.session };
  const raw = async (operation: unknown, caller = ctx, binding = scope) =>
    (await storage.execute(caller, "GaiaField", { ...binding, operation })) as FieldReply<
      FieldOperation["action"]
    >;
  const run = async <T extends FieldOperation>(operation: T) => {
    const reply = (await raw(operation)) as FieldReply<T["action"]>;
    assert.ok(reply.ok, JSON.stringify(reply));
    return reply.data;
  };
  return {
    root,
    media,
    usbDir,
    ctx,
    control,
    dialogs,
    storage,
    scope,
    raw,
    run,
    created,
    open: async () => (await storage.execute(ctx, "GaiaOpen", { project: "demo" })) as Opened,
    setPassphrase: (value: string) => {
      passphrase = value;
    },
    confirmations,
    close: () => {
      closed = true;
    },
  };
}

async function absent(path: string) {
  await assert.rejects(stat(path), { code: "ENOENT" });
}

test("B8 native review issues and enrolls a renewal while stopped, then completes and revokes while listening", async (t) => {
  const f = await setup(t);
  const state = await f.run({ action: "state" });
  assert.equal(state.ca, "ready");
  assert.equal(state.caFingerprint, f.center.pkg.approval.caFingerprint);
  assert.equal(state.assignments.length, 1);
  assert.equal(state.listening, false);
  const offlineState = await f.run({ action: "state", origin: f.center.endpoint.origin });
  assert.equal(offlineState.serverFingerprint?.length, 64);
  const inspect = await f.run(f.renew);
  assert.ok(inspect.approval.publicKeyFingerprint);
  const issued = await f.run({ action: "issue", reviewId: inspect.reviewId });
  assert.match(f.confirmations.at(-1)!, new RegExp(inspect.approval.publicKeyFingerprint));
  assert.match(f.confirmations.at(-1)!, new RegExp(inspect.approval.caFingerprint));
  assert.equal((await f.run({ action: "state" })).assignments.length, 1);
  f.setPackage(issued.filename);
  assert.deepEqual(await f.raw({ action: "enroll", deviceId: "other" }), {
    ok: false,
    code: "scope_changed",
  });
  const enrolled = await f.run({ action: "enroll", deviceId: "phone" });
  assert.equal(enrolled.state, "pending");
  assert.equal(enrolled.fingerprint, issued.fingerprint);
  assert.deepEqual(await f.run({ action: "start", endpoint: f.center.endpoint }), {
    listening: true,
  });
  const active = await f.run({ action: "complete", assignmentId: enrolled.id, deviceId: "phone" });
  assert.equal(active.state, "active");
  assert.equal(active.authorizationGeneration, 2);
  assert.equal((await f.run({ action: "state" })).serverFingerprint?.length, 64);
  await f.run({ action: "revoke", assignmentId: active.id, deviceId: "phone" });
  assert.deepEqual((await f.run({ action: "state" })).assignments, []);
  assert.deepEqual(await f.run({ action: "stop" }), { listening: false });
});

test("B8 stopped management cannot share B3 ownership or accept renderer approval or paths", async (t) => {
  const f = await setup(t);
  const revoke = { action: "revoke", assignmentId: f.center.assignmentId, deviceId: "phone" };
  const before = await readFile(authorizationStorePath(f.root));
  for (const extra of [{ approved: true }, { path: "file.json" }, { passphrase: "synthetic" }])
    assert.deepEqual(await f.raw({ ...revoke, ...extra }), { ok: false, code: "invalid_request" });
  assert.equal(f.confirmations.length, 0);
  const other = await openFieldAuthority(f.root);
  try {
    assert.deepEqual(await f.raw(revoke), { ok: false, code: "unavailable" });
  } finally {
    await other.close();
  }
  f.dialogs.confirm = async () => false;
  assert.deepEqual(await f.raw(revoke), { ok: false, code: "cancelled" });
  assert.deepEqual(await f.raw({ ...revoke, deviceId: "other" }), {
    ok: false,
    code: "scope_changed",
  });
  assert.equal((await f.run({ action: "state" })).assignments[0]?.state, "active");
  assert.deepEqual(await readFile(authorizationStorePath(f.root)), before);
});

test("B8 foreign guest, changed project, replaced session and closed room invalidate local approval", async (t) => {
  const f = await setup(t);
  const revoke = { action: "revoke", assignmentId: f.center.assignmentId, deviceId: "phone" };
  const denied = { ok: false, code: "scope_changed" };
  assert.deepEqual(await f.raw(revoke, { ...f.ctx, owner: {} }), denied);
  assert.deepEqual(await f.raw(revoke, f.ctx, { ...f.scope, project: "another" }), denied);
  assert.equal(f.confirmations.length, 0);
  const inspected = await f.run(f.renew);
  f.dialogs.confirm = async () => {
    await f.open();
    return true;
  };
  assert.deepEqual(await f.raw({ action: "issue", reviewId: inspected.reviewId }), denied);
  f.scope.session = (await f.open()).session;
  assert.deepEqual(await f.raw({ action: "issue", reviewId: inspected.reviewId }), denied);
  f.dialogs.confirm = async () => {
    f.close();
    return true;
  };
  assert.deepEqual(await f.raw(revoke), denied);
});

test("B8 USB picker bounds reads and refuses symlinks, center output and existing destinations", async (t) => {
  const dir = await temporary(t);
  const center = join(dir, "center");
  await mkdir(center);
  const file = join(dir, "request.json");
  await writeFile(file, "{}");
  const alias = join(dir, "alias.json");
  await symlink(file, alias);
  await assert.rejects(readUsbJson(alias, center));
  const parent = join(dir, "redirect");
  await symlink(dir, parent);
  await assert.rejects(readUsbJson(join(parent, "request.json"), center));
  await writeFile(file, Buffer.alloc(65537));
  await assert.rejects(readUsbJson(file, center));
  const operation = randomUUID(),
    check = () => {};
  await assert.rejects(exportInstallation(center, center, operation, {}, check));
  await assert.rejects(exportInstallation(parent, center, operation, {}, check));
  const target = join(dir, "gaia-install-" + operation + ".json");
  await symlink(file, target);
  await assert.rejects(exportInstallation(dir, center, operation, {}, check));
  assert.equal((await readFile(file)).length, 65537);
});

test("B8 signed hardware replacement and project reassignment bind both ends of the approved move", async (t) => {
  const f = await setup(t);
  const replacement = await f.run({
    ...f.renew,
    hardwareId: "new-instrument",
    change: { kind: "rebindHardware", assignmentId: f.center.assignmentId },
  });
  const issued = await f.run({ action: "issue", reviewId: replacement.reviewId });
  f.setPackage(issued.filename);
  const rebound = await f.run({ action: "enroll", deviceId: "phone" });
  assert.equal(rebound.state, "active");
  assert.equal(rebound.hardwareId, "new-instrument");
  const source = await f.open();
  const targetWorld = structuredClone(source.world);
  targetWorld.id = "target";
  targetWorld.devices["other"] = {
    role: "client",
    source: "physical",
    capabilities: rebound.capabilities,
  };
  delete targetWorld.devices["phone"];
  const target = join(f.root, "projects", "target");
  await mkdir(target);
  await writeFile(
    join(target, "world.json"),
    JSON.stringify({ world: targetWorld, lastOperation: null })
  );
  f.scope.project = "target";
  f.scope.session = (await f.open("target")).session;
  const moved = await f.run({
    ...f.renew,
    deviceId: "other",
    hardwareId: rebound.hardwareId,
    revision: targetWorld.revision,
    change: {
      kind: "reassign",
      assignmentId: rebound.id,
      expectedSourceRevision: source.world.revision,
    },
  });
  const signed = await f.run({ action: "issue", reviewId: moved.reviewId });
  f.setPackage(signed.filename);
  const grant = await f.run({ action: "enroll", deviceId: "other" });
  assert.equal(grant.state, "active");
  assert.equal(grant.deviceId, "other");
  assert.deepEqual(
    (await f.run({ action: "state" })).assignments.map((a) => a.id),
    [grant.id]
  );
  assert.match(f.confirmations.at(-1)!, /"project": "demo"/);
  f.scope.project = "demo";
  f.scope.session = (await f.open()).session;
  assert.deepEqual((await f.run({ action: "state" })).assignments, []);
  assert.deepEqual(await f.raw({ action: "revoke", deviceId: "phone", assignmentId: rebound.id }), {
    ok: false,
    code: "scope_changed",
  });
});

test("B8 an inventory revision change during native signing approval leaves no exported package", async (t) => {
  const f = await setup(t);
  const review = await f.run(f.renew);
  f.dialogs.confirm = async () => {
    const saved = (await f.storage.execute(f.ctx, "GaiaSave", {
      retry: false,
      batch: {
        scope: "site",
        ...f.scope,
        baseRevision: review.approval.expectedRevision,
        operationId: randomUUID(),
        edits: [
          {
            op: "updateDevice",
            id: "phone",
            details: {
              name: "Renamed phone",
              roles: ["client"],
              capabilities: f.renew.capabilities,
            },
          },
        ],
      },
    })) as { world: Opened["world"] };
    assert.equal(saved.world.revision, review.approval.expectedRevision + 1);
    return true;
  };
  assert.deepEqual(await f.raw({ action: "issue", reviewId: review.reviewId }), {
    ok: false,
    code: "scope_changed",
  });
  await assert.rejects(readFile(join(f.usbDir, "gaia-install-" + review.reviewId + ".json")), {
    code: "ENOENT",
  });
});

test("B8 out-of-order IPC responses and failures cannot replace the current room snapshot", async () => {
  const { FieldStatusReader } = await import("../editor/field-client.ts");
  type Reply = import("../devices/field-view.ts").GaiaStatusReply;
  const first = Promise.withResolvers<Reply>(),
    second = Promise.withResolvers<Reply>();
  const replies = [first.promise, second.promise];
  const scope = { project: "demo", session: randomUUID() };
  const reader = new FieldStatusReader(
    () => replies.shift()!,
    () => 1
  );
  const late = reader.load(scope);
  const current = reader.load(scope);
  second.resolve({ revision: 2, statuses: {}, physical: {} });
  assert.ok(await current);
  first.resolve({ revision: 1, statuses: {}, physical: {} });
  assert.equal(await late, false);
  assert.equal(reader.current(scope, 2)?.revision, 2);
  assert.equal(reader.current({ ...scope, project: "changed" }, 2), undefined);
  replies.push(Promise.reject(new Error("unavailable")));
  await assert.rejects(reader.load(scope));
  assert.equal(reader.current(scope, 2), undefined);
});

test("B8 cancelling a pending USB renewal keeps its predecessor active", async (t) => {
  const f = await setup(t);
  const reviewed = await f.run(f.renew);
  const signed = await f.run({ action: "issue", reviewId: reviewed.reviewId });
  f.setPackage(signed.filename);
  const pending = await f.run({ action: "enroll", deviceId: "phone" });
  const cancelled = await f.run({ action: "revoke", deviceId: "phone", assignmentId: pending.id });
  assert.equal(cancelled.state, "revoked");
  assert.deepEqual(
    (await f.run({ action: "state" })).assignments.map((a) => a.id),
    [f.center.assignmentId]
  );
  assert.deepEqual(
    await f.raw({ action: "complete", deviceId: "phone", assignmentId: pending.id }),
    { ok: false, code: "scope_changed" }
  );
});

test("B8/1-R first provisioning uses native media and password and returns only fingerprints", async (t) => {
  const f = await freshSetup(t);
  const endpoint = await temporaryEndpoint();
  assert.equal((await f.run({ action: "state" })).ca, "absent");
  for (const extra of [{ passphrase: "renderer-supplied" }, { media: f.media }, { path: f.media }])
    assert.deepEqual(await f.raw({ action: "provision", origin: endpoint.origin, ...extra }), {
      ok: false,
      code: "invalid_request",
    });
  assert.equal(f.confirmations.length, 0);
  const provisioned = await f.run({ action: "provision", origin: endpoint.origin });
  assert.deepEqual(Object.keys(provisioned).sort(), ["caFingerprint", "serverFingerprint"]);
  assert.match(provisioned.caFingerprint, /^[a-f0-9]{64}$/);
  assert.match(provisioned.serverFingerprint, /^[a-f0-9]{64}$/);
  const trust = await readFieldTrust(f.root);
  assert.equal(provisioned.caFingerprint, trust.fingerprint);
  assert.equal(
    provisioned.serverFingerprint,
    (await readFieldServerIdentity(f.root, endpoint.origin)).fingerprint
  );
  assert.match(f.confirmations.at(-1)!, new RegExp(endpoint.origin));
  const state = await f.run({ action: "state", origin: endpoint.origin });
  assert.equal(state.ca, "ready");
  assert.equal(state.caFingerprint, provisioned.caFingerprint);
  assert.equal(state.serverFingerprint, provisioned.serverFingerprint);
  await f.run({ action: "start", endpoint });
  assert.equal((await f.run({ action: "state" })).listening, true);
  await f.run({ action: "stop" });
});

test("B8/1-R configured receiver blocks first provisioning until stopped", async (t) => {
  const f = await freshSetup(t);
  const endpoint = await temporaryEndpoint();
  await assert.rejects(f.control.start(endpoint));
  const confirmations = f.confirmations.length;
  assert.deepEqual(await f.raw({ action: "provision", origin: endpoint.origin }), {
    ok: false,
    code: "unavailable",
  });
  assert.equal(f.confirmations.length, confirmations);
  await absent(join(f.root, ".field-provisioned"));
  await absent(join(f.root, "field"));
  await f.run({ action: "stop" });
  const provisioned = await f.run({ action: "provision", origin: endpoint.origin });
  assert.match(provisioned.caFingerprint, /^[a-f0-9]{64}$/);
});

test("B8/1-R cancelled or invalid first provisioning leaves no field storage", async (t) => {
  await t.test("media selection cancelled", async (sub) => {
    const f = await freshSetup(sub);
    f.dialogs.choose = async () => undefined;
    assert.deepEqual(await f.raw({ action: "provision", origin: "https://127.0.0.1:8443" }), {
      ok: false,
      code: "cancelled",
    });
    await absent(join(f.root, ".field-provisioned"));
    await absent(join(f.root, "field"));
  });
  await t.test("password cancelled", async (sub) => {
    const f = await freshSetup(sub);
    f.dialogs.password = async () => undefined;
    assert.deepEqual(await f.raw({ action: "provision", origin: "https://127.0.0.1:8443" }), {
      ok: false,
      code: "cancelled",
    });
    await absent(join(f.root, ".field-provisioned"));
    await absent(join(f.root, "field"));
  });
  await t.test("native confirmation refused", async (sub) => {
    const f = await freshSetup(sub);
    f.dialogs.confirm = async () => false;
    assert.deepEqual(await f.raw({ action: "provision", origin: "https://127.0.0.1:8443" }), {
      ok: false,
      code: "cancelled",
    });
    await absent(join(f.root, ".field-provisioned"));
    await absent(join(f.root, "field"));
  });
  await t.test("signing media inside center storage", async (sub) => {
    const f = await freshSetup(sub);
    f.dialogs.choose = async (kind) => (kind === "media" ? f.root : f.usbDir);
    assert.deepEqual(await f.raw({ action: "provision", origin: "https://127.0.0.1:8443" }), {
      ok: false,
      code: "unavailable",
    });
    await absent(join(f.root, ".field-provisioned"));
    await absent(join(f.root, "field"));
  });
  await t.test("world-accessible signing media", async (sub) => {
    const f = await freshSetup(sub);
    await chmod(f.media, 0o755);
    assert.deepEqual(await f.raw({ action: "provision", origin: "https://127.0.0.1:8443" }), {
      ok: false,
      code: "unavailable",
    });
    await absent(join(f.root, ".field-provisioned"));
    await absent(join(f.root, "field"));
  });
  await t.test("too short signing passphrase", async (sub) => {
    const f = await freshSetup(sub);
    f.setPassphrase("short");
    assert.deepEqual(await f.raw({ action: "provision", origin: "https://127.0.0.1:8443" }), {
      ok: false,
      code: "unavailable",
    });
    await absent(join(f.root, ".field-provisioned"));
    await absent(join(f.root, "field"));
  });
});

test("B8/1-R second center and partial authorization history are refused without reset", async (t) => {
  await t.test("already provisioned center", async (sub) => {
    const f = await freshSetup(sub);
    const endpoint = await temporaryEndpoint();
    await f.run({ action: "provision", origin: endpoint.origin });
    const before = await Promise.all([
      readFile(authorizationStorePath(f.root)),
      readFile(join(f.root, ".field-provisioned/x509/sha256")),
      readFile(join(f.root, "field/pki/server.pem")),
    ]);
    const confirmations = f.confirmations.length;
    assert.deepEqual(await f.raw({ action: "provision", origin: endpoint.origin }), {
      ok: false,
      code: "unavailable",
    });
    assert.equal(f.confirmations.length, confirmations);
    assert.deepEqual(
      await Promise.all([
        readFile(authorizationStorePath(f.root)),
        readFile(join(f.root, ".field-provisioned/x509/sha256")),
        readFile(join(f.root, "field/pki/server.pem")),
      ]),
      before
    );
  });
  await t.test("authorization store created before CA", async (sub) => {
    const f = await freshSetup(sub);
    await provisionAuthorizationStore(f.root);
    const before = await readFile(authorizationStorePath(f.root));
    assert.equal((await f.run({ action: "state" })).ca, "unavailable");
    assert.deepEqual(await f.raw({ action: "provision", origin: "https://127.0.0.1:8443" }), {
      ok: false,
      code: "unavailable",
    });
    assert.deepEqual(await f.raw({ action: "rotateServer", origin: "https://127.0.0.1:8443" }), {
      ok: false,
      code: "unavailable",
    });
    assert.deepEqual(await readFile(authorizationStorePath(f.root)), before);
    await absent(join(f.root, ".field-provisioned/x509"));
    await absent(join(f.root, "field/pki"));
  });
  await t.test("dangling first-provisioning marker", async (sub) => {
    const f = await freshSetup(sub);
    await mkdir(join(f.root, ".field-provisioned"), { mode: 0o700 });
    assert.deepEqual(await f.raw({ action: "provision", origin: "https://127.0.0.1:8443" }), {
      ok: false,
      code: "unavailable",
    });
    await absent(join(f.root, "field"));
    assert.equal((await stat(join(f.root, ".field-provisioned"))).isDirectory(), true);
  });
});

test("B8/1-R stale project session cannot provision or rotate server identity", async (t) => {
  const f = await freshSetup(t);
  const endpoint = await temporaryEndpoint();
  const old = { ...f.scope };
  f.scope.session = (await f.open()).session;
  assert.deepEqual(await f.raw({ action: "provision", origin: endpoint.origin }, f.ctx, old), {
    ok: false,
    code: "scope_changed",
  });
  assert.equal(f.confirmations.length, 0);
  await absent(join(f.root, ".field-provisioned"));
  await f.run({ action: "provision", origin: endpoint.origin });
  const first = (await readFieldServerIdentity(f.root, endpoint.origin)).fingerprint;
  f.scope.session = (await f.open()).session;
  assert.deepEqual(await f.raw({ action: "rotateServer", origin: endpoint.origin }, f.ctx, old), {
    ok: false,
    code: "scope_changed",
  });
  assert.equal((await readFieldServerIdentity(f.root, endpoint.origin)).fingerprint, first);
  await f.run({ action: "rotateServer", origin: endpoint.origin });
  assert.notEqual((await readFieldServerIdentity(f.root, endpoint.origin)).fingerprint, first);
});

test("B8/1-R server rotation requires a stopped receiver, valid media and password", async (t) => {
  const f = await freshSetup(t);
  const endpoint = await temporaryEndpoint();
  await f.run({ action: "provision", origin: endpoint.origin });
  const first = (await readFieldServerIdentity(f.root, endpoint.origin)).fingerprint;
  await f.run({ action: "start", endpoint });
  const confirmations = f.confirmations.length;
  assert.deepEqual(await f.raw({ action: "rotateServer", origin: endpoint.origin }), {
    ok: false,
    code: "unavailable",
  });
  assert.equal(f.confirmations.length, confirmations);
  assert.equal((await readFieldServerIdentity(f.root, endpoint.origin)).fingerprint, first);
  await f.run({ action: "stop" });

  f.setPassphrase("wrong synthetic passphrase");
  assert.deepEqual(await f.raw({ action: "rotateServer", origin: endpoint.origin }), {
    ok: false,
    code: "unavailable",
  });
  assert.equal((await readFieldServerIdentity(f.root, endpoint.origin)).fingerprint, first);

  f.dialogs.choose = async (kind) => (kind === "media" ? f.root : f.usbDir);
  assert.deepEqual(await f.raw({ action: "rotateServer", origin: endpoint.origin }), {
    ok: false,
    code: "unavailable",
  });
  assert.equal((await readFieldServerIdentity(f.root, endpoint.origin)).fingerprint, first);

  f.dialogs.choose = async (kind) => (kind === "media" ? f.media : f.usbDir);
  f.dialogs.confirm = async () => false;
  assert.deepEqual(await f.raw({ action: "rotateServer", origin: endpoint.origin }), {
    ok: false,
    code: "cancelled",
  });
  assert.equal((await readFieldServerIdentity(f.root, endpoint.origin)).fingerprint, first);

  f.dialogs.confirm = async () => true;
  f.setPassphrase("synthetic provisioning passphrase");
  const renewed = await f.run({ action: "rotateServer", origin: endpoint.origin });
  assert.deepEqual(Object.keys(renewed), ["serverFingerprint"]);
  assert.match(renewed.serverFingerprint, /^[a-f0-9]{64}$/);
  assert.notEqual(renewed.serverFingerprint, first);
  assert.equal(
    (await readFieldServerIdentity(f.root, endpoint.origin)).fingerprint,
    renewed.serverFingerprint
  );
  assert.equal(
    (await f.run({ action: "state", origin: endpoint.origin })).serverFingerprint,
    renewed.serverFingerprint
  );

  await f.run({ action: "start", endpoint });
  assert.equal((await f.run({ action: "state" })).listening, true);
  await f.run({ action: "stop" });
  await rm(join(f.root, "field/pki/server.pem"));
  assert.equal(
    (await f.run({ action: "state", origin: endpoint.origin })).serverFingerprint,
    undefined
  );
  const recreated = await f.run({ action: "rotateServer", origin: endpoint.origin });
  assert.equal(
    (await readFieldServerIdentity(f.root, endpoint.origin)).fingerprint,
    recreated.serverFingerprint
  );
});

test("B8/1-R start during server rotation confirmation cannot replace live identity", async (t) => {
  const f = await freshSetup(t);
  const endpoint = await temporaryEndpoint();
  await f.run({ action: "provision", origin: endpoint.origin });
  const first = (await readFieldServerIdentity(f.root, endpoint.origin)).fingerprint;
  f.dialogs.confirm = async (action) => {
    if (action === "rotateServer") await f.control.start(endpoint);
    return true;
  };
  assert.deepEqual(await f.raw({ action: "rotateServer", origin: endpoint.origin }), {
    ok: false,
    code: "unavailable",
  });
  assert.equal((await readFieldServerIdentity(f.root, endpoint.origin)).fingerprint, first);
  assert.equal((await f.run({ action: "state" })).listening, true);
  await f.run({ action: "stop" });
});

test("B8/1-R another live center owner blocks first provisioning before any write", async (t) => {
  const f = await freshSetup(t);
  const owner = await openFieldAuthority(f.root);
  try {
    assert.deepEqual(await f.raw({ action: "provision", origin: "https://127.0.0.1:8443" }), {
      ok: false,
      code: "unavailable",
    });
    await absent(join(f.root, ".field-provisioned"));
    await absent(join(f.root, "field"));
  } finally {
    await owner.close();
  }
  await f.run({ action: "provision", origin: "https://127.0.0.1:8443" });
  assert.equal((await f.run({ action: "state" })).ca, "ready");
});

test("B8 reads require the current document and project even after waiting for the project writer", async (t) => {
  const f = await setup(t);
  const read = (scope = f.scope, ctx = f.ctx) => f.storage.execute(ctx, "GaiaStatus", scope);
  await assert.rejects(read(f.scope, { ...f.ctx, owner: {} }), /session mismatch/);
  await assert.rejects(read({ ...f.scope, project: "not-open" }), /session mismatch/);
  const old = { ...f.scope };
  f.scope.session = (await f.open()).session;
  await assert.rejects(read(old), /session mismatch/);

  const entered = Promise.withResolvers<void>(),
    release = Promise.withResolvers<void>();
  const holding = serialized(f.center.dir, async () => {
    entered.resolve();
    await release.promise;
  });
  await entered.promise;
  const checked = Promise.withResolvers<void>();
  let closed = false;
  const pending = read(f.scope, {
    ...f.ctx,
    assertCurrent: () => {
      if (closed) throw new Error("closed document");
      checked.resolve();
    },
  });
  try {
    await checked.promise;
    closed = true;
  } finally {
    release.resolve();
    await holding;
  }
  await assert.rejects(pending, /closed document/);
});

test("B8 first provisioning refuses an occupied signing directory before creating center history", async (t) => {
  const f = await freshSetup(t);
  const signing = join(f.media, "gaia-signing");
  await mkdir(signing, { mode: 0o700 });
  const original = Buffer.from("synthetic existing encrypted key");
  await writeFile(join(signing, "ca.key"), original, { mode: 0o600 });
  assert.deepEqual(await f.raw({ action: "provision", origin: "https://127.0.0.1:8443" }), {
    ok: false,
    code: "unavailable",
  });
  assert.deepEqual(await readFile(join(signing, "ca.key")), original);
  await absent(join(f.root, ".field-provisioned"));
  await absent(join(f.root, "field"));
  assert.equal((await f.run({ action: "state" })).ca, "absent");
});

test("B8 a partial center is unavailable rather than an invitation to provision again", async (t) => {
  const f = await freshSetup(t);
  await mkdir(join(f.root, ".field-provisioned"), { mode: 0o700 });
  assert.equal((await f.run({ action: "state" })).ca, "unavailable");
});

test("B8 maintenance prevents concurrent receiver configuration until it drains", async (t) => {
  const f = await freshSetup(t);
  const endpoint = await temporaryEndpoint();
  let release!: () => void;
  const gate = new Promise<void>((resolve) => {
    release = resolve;
  });
  const pending = f.control.maintenance(f.root, () => gate);
  try {
    await assert.rejects(async () => f.control.start(endpoint));
    assert.equal(f.control.status().enabled, false);
    assert.equal(f.control.status().listening, false);
  } finally {
    release();
    await pending;
    await f.control.stop();
  }
});

test("B8 the first provisioning owner spans preflight and subsequent writes", async (t) => {
  const f = await freshSetup(t);
  const result = await initializeAuthorizationStore(
    f.root,
    async () => {
      await assert.rejects(openFieldAuthority(f.root));
      await absent(join(f.root, ".field-provisioned"));
    },
    async () => {
      await assert.rejects(openFieldAuthority(f.root));
      assert.ok((await readFile(authorizationStorePath(f.root))).length);
      return "done";
    }
  );
  assert.equal(result, "done");
  const next = await openFieldAuthority(f.root);
  await next.close();
});

test("B83 native directory picker trailing slash works for first provisioning and rotation", async (t) => {
  const f = await freshSetup(t);
  f.dialogs.choose = async (kind) => (kind === "media" ? f.media + "/" : f.usbDir);
  const endpoint = await temporaryEndpoint();
  const provisioned = await f.run({ action: "provision", origin: endpoint.origin });
  const rotated = await f.run({ action: "rotateServer", origin: endpoint.origin });
  assert.match(provisioned.caFingerprint, /^[a-f0-9]{64}$/);
  assert.notEqual(rotated.serverFingerprint, provisioned.serverFingerprint);
});

test("B83 trailing slash on native signing media and USB destination works for issuance", async (t) => {
  const f = await setup(t);
  const choose = f.dialogs.choose;
  f.dialogs.choose = async (kind) => {
    const path = await choose(kind);
    return path && (kind === "media" || kind === "destination") ? path + "/" : path;
  };
  const reviewed = await f.run(f.renew);
  const signed = await f.run({ action: "issue", reviewId: reviewed.reviewId });
  assert.ok((await readFile(join(f.usbDir, signed.filename))).length > 0);
});

test("B83 native directory selection still rejects symlink and traversal aliases", async (t) => {
  const f = await freshSetup(t);
  const alias = join(f.usbDir, "media-alias");
  await symlink(f.media, alias);
  for (const path of [alias + "/", f.media + "/../" + f.media.split("/").at(-1) + "/"]) {
    f.dialogs.choose = async () => path;
    assert.deepEqual(await f.raw({ action: "provision", origin: "https://127.0.0.1:8443" }), {
      ok: false,
      code: "unavailable",
    });
    await absent(join(f.root, "field"));
    await absent(join(f.root, ".field-provisioned"));
  }
});
