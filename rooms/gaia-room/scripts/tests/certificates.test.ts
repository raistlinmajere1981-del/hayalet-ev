import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { once } from "node:events";
import { createPrivateKey, createPublicKey, randomUUID, X509Certificate } from "node:crypto";
import {
  chmod,
  cp,
  link,
  mkdir,
  mkdtemp,
  readFile,
  rename,
  rm,
  stat,
  symlink,
  writeFile,
} from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { connect, createServer } from "node:tls";
import { pathToFileURL } from "node:url";
import { promisify } from "node:util";
import test, { type TestContext } from "node:test";
import * as asn from "asn1js";
import * as pki from "pkijs";
import {
  derBase64,
  httpsHost,
  publicKeyFingerprint,
  sha256,
  verifyFieldCa,
  verifyFieldPeer,
} from "../field/certificates.ts";
import {
  inspectUsbRequest,
  verifyClientInstallation,
  type InstallationApproval,
} from "../field/installation.ts";
import { createSiteFixture } from "../spatial/fixture.ts";
import { openFieldAuthority } from "../storage/enrollment-service.ts";
import {
  authorizationStorePath,
  provisionAuthorizationStore,
  readAuthorizationStore,
} from "../storage/enrollment-store.ts";
import {
  issueLocalInstallation,
  provisionFieldCa,
  rotateFieldServer,
} from "../storage/field-issuer.ts";
import { readFieldServerIdentity, readFieldTrust } from "../storage/field-trust.ts";
import { publishManagedWorld, readDocument } from "../storage/project-document.ts";
import { serialized } from "../storage/files.ts";

const posix = { skip: !process.getuid };
const origin = "https://gaia.test:8443";

async function usbClient(curve = "P-256", extensions?: pki.Extension[], exportable = false) {
  const keys = await crypto.subtle.generateKey({ name: "ECDSA", namedCurve: curve }, exportable, [
    "sign",
    "verify",
  ]);
  const info = new pki.PublicKeyInfo();
  await info.importKey(keys.publicKey);
  const csr = new pki.CertificationRequest({
    version: 0,
    subjectPublicKeyInfo: info,
    subject: new pki.RelativeDistinguishedNames({
      typesAndValues: [
        new pki.AttributeTypeAndValue({
          type: "2.5.4.3",
          value: new asn.Utf8String({ value: "Untrusted USB subject" }),
        }),
      ],
    }),
    attributes: extensions
      ? [
          new pki.Attribute({
            type: "1.2.840.113549.1.9.14",
            values: [new pki.Extensions({ extensions }).toSchema()],
          }),
        ]
      : [],
  });
  await csr.sign(keys.privateKey, "SHA-256");
  const publicKey = createPublicKey({
    key: Buffer.from(info.toSchema().toBER()),
    format: "der",
    type: "spki",
  });
  return {
    keys,
    publicKey,
    usb: {
      version: 1,
      installationId: randomUUID(),
      csr: Buffer.from(csr.toSchema().toBER()).toString("base64"),
    },
  };
}

async function temp(t: TestContext) {
  const path = await mkdtemp(join(tmpdir(), "gaia-field-pki-"));
  t.after(() => rm(path, { recursive: true, force: true }));
  return path;
}

async function inventory(root: string, id = "demo") {
  const world = createSiteFixture();
  world.id = id;
  world.devices["phone"] = {
    role: "client",
    source: "physical",
    capabilities: ["signal.read.v1", "battery.level.v1"],
  };
  const dir = join(root, "projects", id);
  await mkdir(dir, { recursive: true, mode: 0o700 });
  await writeFile(
    join(dir, "world.json"),
    JSON.stringify({ world, statusEpoch: 0, lastOperation: null })
  );
  return world.revision;
}

async function center(t: TestContext, exportable = false, storageRoot?: string) {
  const root = storageRoot ?? (await temp(t));
  const media = {
    directory: await temp(t),
    passphrase: Buffer.from("synthetic signing passphrase"),
  };
  await provisionAuthorizationStore(root);
  const caFingerprint = await provisionFieldCa(root, media);
  const expectedRevision = await inventory(root);
  const { usb, publicKey, keys } = await usbClient("P-256", undefined, exportable);
  const approval: InstallationApproval = {
    operationId: randomUUID(),
    projectId: "demo",
    deviceId: "phone",
    hardwareId: "synthetic-unit",
    capabilities: ["signal.read.v1"],
    expectedRevision,
    installationId: usb.installationId,
    publicKeyFingerprint: publicKeyFingerprint(publicKey),
    caFingerprint,
    httpsOrigin: origin,
    change: { kind: "begin" },
  };
  const local = {
    installationId: usb.installationId,
    publicKey,
    trustedCaFingerprint: caFingerprint,
  };
  return {
    root,
    media,
    approval,
    local,
    keys,
    usb,
    issue: () => issueLocalInstallation(root, media, usb, approval),
  };
}

async function owner(t: TestContext, root: string) {
  const authority = await openFieldAuthority(root);
  t.after(() => authority.close());
  return authority;
}

test("USB request verifies the signed P-256 SPKI and never needs the client's private key", async () => {
  const { keys, publicKey, usb } = await usbClient();
  assert.equal(inspectUsbRequest(usb).fingerprint, publicKeyFingerprint(publicKey));
  await assert.rejects(crypto.subtle.exportKey("pkcs8", keys.privateKey));
  const der = derBase64(usb.csr);
  der[der.length - 1] = der[der.length - 1]! ^ 1;
  assert.throws(() => inspectUsbRequest({ ...usb, csr: der.toString("base64") }), /signature/);
  assert.throws(() =>
    inspectUsbRequest({ ...usb, csr: Buffer.concat([der, Buffer.alloc(1)]).toString("base64") })
  );
  assert.throws(() => inspectUsbRequest({ ...usb, csr: usb.csr + "?" }));
  assert.throws(() => inspectUsbRequest({ ...usb, privateKey: "forbidden" }));
  assert.throws(() => inspectUsbRequest({ ...usb, version: 2 }));
  const unsupported = await usbClient("P-384");
  assert.throws(() => inspectUsbRequest(unsupported.usb), /P-256/);
});

test("validly signed requests for CA, serverAuth or DNS SAN are rejected", async () => {
  for (const [extnID, value] of [
    ["2.5.29.19", new pki.BasicConstraints({ cA: true }).toSchema()],
    ["2.5.29.37", new pki.ExtKeyUsage({ keyPurposes: ["1.3.6.1.5.5.7.3.1"] }).toSchema()],
    [
      "2.5.29.17",
      new pki.AltName({
        altNames: [new pki.GeneralName({ type: 2, value: "gaia.test" })],
      }).toSchema(),
    ],
  ] as const) {
    const request = await usbClient("P-256", [
      new pki.Extension({ extnID, critical: true, extnValue: value.toBER() }),
    ]);
    assert.throws(() => inspectUsbRequest(request.usb), /extension requests/);
  }
});

test(
  "pinned installation authenticates every approval field and rejects swaps, extra data and broken chains",
  posix,
  async (t) => {
    const a = await center(t),
      b = await center(t);
    const pkg = await a.issue(),
      other = await b.issue();
    const verified = verifyClientInstallation(pkg, a.local);
    assert.equal(verified.certificateFingerprint, sha256(derBase64(pkg.clientCertificate)));
    assert.equal(verified.approval.installationId, a.usb.installationId);
    const damaged = derBase64(pkg.clientCertificate);
    damaged[damaged.length - 1] = damaged[damaged.length - 1]! ^ 1;
    assert.throws(() =>
      verifyClientInstallation({ ...pkg, clientCertificate: damaged.toString("base64") }, a.local)
    );
    assert.doesNotMatch(JSON.stringify(pkg), /PRIVATE KEY|Untrusted USB subject/);
    for (const patch of [
      { operationId: randomUUID() },
      { projectId: "other" },
      { deviceId: "other" },
      { hardwareId: "other" },
      { installationId: randomUUID() },
      { capabilities: [] },
      { expectedRevision: a.approval.expectedRevision + 1 },
      { httpsOrigin: "https://other.test" },
      { caFingerprint: b.approval.caFingerprint },
      { publicKeyFingerprint: b.approval.publicKeyFingerprint },
      { change: { kind: "renew", assignmentId: randomUUID() } },
    ]) {
      assert.throws(() =>
        verifyClientInstallation({ ...pkg, approval: { ...pkg.approval, ...patch } }, a.local)
      );
      if (!("operationId" in patch))
        await assert.rejects(
          issueLocalInstallation(a.root, a.media, a.usb, { ...a.approval, ...patch })
        );
    }
    for (const bad of [
      { ...pkg, clientCertificate: other.clientCertificate },
      { ...pkg, caCertificate: other.caCertificate },
      other,
      { ...pkg, version: 2 },
      { ...pkg, privateKey: "extra" },
      { ...pkg, clientCertificate: "broken" },
      { ...pkg, approval: { ...pkg.approval, secret: "extra" } },
    ])
      assert.throws(() => verifyClientInstallation(bad, a.local));
    assert.throws(
      () => verifyClientInstallation(pkg, { ...a.local, publicKey: b.local.publicKey }),
      /different client or key/
    );
    assert.throws(
      () => verifyClientInstallation(pkg, { ...a.local, installationId: b.local.installationId }),
      /different client or key/
    );
    await assert.rejects(issueLocalInstallation(a.root, a.media, b.usb, a.approval), /USB/);
    await assert.rejects(
      issueLocalInstallation(a.root, a.media, a.usb, {
        ...a.approval,
        operationId: randomUUID(),
        expectedRevision: a.approval.expectedRevision + 1,
      }),
      /revision/
    );
  }
);

test("direct chain enforces role, exact DNS or IP SAN, root and leaf dates", posix, async (t) => {
  const c = await center(t),
    pkg = await c.issue(),
    trust = await readFieldTrust(c.root);
  const der = derBase64(pkg.clientCertificate),
    cert = new X509Certificate(der);
  assert.notEqual(cert.subject, "CN=Untrusted USB subject");
  assert.equal(cert.ca, false);
  assert.equal(trust.ca.ca, true);
  assert.deepEqual(cert.keyUsage, ["1.3.6.1.5.5.7.3.2"]);
  const from = Date.parse(cert.validFrom),
    to = Date.parse(cert.validTo);
  assert.equal(to - from, 365 * 86_400_000);
  for (const time of [from, to]) verifyClientInstallation(pkg, c.local, time);
  for (const time of [from - 1, to + 1, Date.UTC(2017, 0, 1), NaN])
    assert.throws(() => verifyClientInstallation(pkg, c.local, time), /validity/);
  for (const time of [Date.parse(trust.ca.validFrom) - 1, Date.parse(trust.ca.validTo) + 1])
    assert.throws(() => verifyFieldCa(trust.caCertificate, trust.fingerprint, time), /validity/);
  for (const target of [origin, "https://127.0.0.1:8443", "https://[::1]:8443"]) {
    await rotateFieldServer(c.root, c.media, target);
    const identity = await readFieldServerIdentity(c.root, target);
    const server = new X509Certificate(identity.cert);
    assert.deepEqual(server.keyUsage, ["1.3.6.1.5.5.7.3.1"]);
    assert.notEqual(
      publicKeyFingerprint(server.publicKey),
      publicKeyFingerprint(trust.ca.publicKey)
    );
    await assert.rejects(readFieldServerIdentity(c.root, "https://other.test"), /SAN/);
    assert.throws(
      () => verifyFieldPeer(server.raw, { role: "client" }, trust.caCertificate, trust.fingerprint),
      /usage/
    );
    assert.throws(
      () =>
        verifyFieldPeer(
          der,
          { role: "server", origin: target },
          trust.caCertificate,
          trust.fingerprint
        ),
      /usage/
    );
    assert.throws(() =>
      verifyFieldPeer(trust.ca.raw, { role: "client" }, trust.caCertificate, trust.fingerprint)
    );
  }
  for (const invalid of [
    "http://gaia.test",
    "https://u:p@gaia.test",
    "https://*.gaia.test",
    "https://gaia.test/x",
    "https://gaia.test?x",
    "https://gaia.test:0",
    "https://127.1",
  ])
    assert.throws(() => httpsHost(invalid));
  const caExpiry = Date.parse(trust.ca.validTo);
  const clock = t.mock.method(Date, "now", () => caExpiry - 31 * 86_400_000);
  await rotateFieldServer(c.root, c.media, origin);
  const shortened = await readFieldServerIdentity(c.root, origin);
  assert.equal(Date.parse(new X509Certificate(shortened.cert).validTo), caExpiry);
  clock.mock.mockImplementation(() => caExpiry - 30 * 86_400_000);
  await assert.rejects(rotateFieldServer(c.root, c.media, origin), /expiring Gaia CA/);
});

test(
  "issuance, pending, active and revoked stay distinct across restart and retries",
  posix,
  async (t) => {
    const c = await center(t);
    const [pkg, replay] = await Promise.all([c.issue(), c.issue()]);
    assert.deepEqual(pkg, replay);
    assert.equal((await readAuthorizationStore(c.root)).assignments.length, 0);
    const authority = await owner(t, c.root);
    const der = derBase64(pkg.clientCertificate);
    const receive = (a: typeof authority, generation: number) =>
      a.withVerifiedClient(
        "demo",
        der,
        { authorizationGeneration: generation },
        async (_world, _epoch, row) => row.id
      );
    await assert.rejects(receive(authority, 1), /not active/);
    await assert.rejects(authority.enrollmentCommand({ action: "begin" }), /Signed/);
    const pending = (await authority.enrollLocalInstallation(pkg)).assignment;
    assert.equal(pending.state, "pending");
    await assert.rejects(receive(authority, 1), /not active/);
    await authority.close();
    const restarted = await owner(t, c.root);
    assert.equal((await restarted.enrollLocalInstallation(pkg)).assignment.id, pending.id);
    const complete = { action: "complete", operationId: randomUUID(), assignmentId: pending.id };
    await restarted.enrollmentCommand(complete);
    await restarted.enrollmentCommand(complete);
    assert.equal(await receive(restarted, 1), pending.id);
    await assert.rejects(
      restarted.withVerifiedAssignment("demo", pending.fingerprint, {}, async () => true),
      /certificate required/
    );
    await assert.rejects(receive(restarted, 2), /generation/);
    const caPath = join(c.root, "field", "pki", "ca.der");
    await rename(caPath, caPath + ".saved");
    await assert.rejects(receive(restarted, 1), { code: "ENOENT" });
    await restarted.enrollmentCommand({
      action: "revoke",
      operationId: randomUUID(),
      assignmentId: pending.id,
    });
    await rename(caPath + ".saved", caPath);
    await assert.rejects(receive(restarted, 1), /not active/);
    await assert.rejects(restarted.enrollLocalInstallation(pkg), /revoked/);
    await assert.rejects(c.issue(), /revoked/);
  }
);

test("an issued-only installation can be discarded before grant publication", posix, async (t) => {
  const c = await center(t),
    pkg = await c.issue();
  const a = await owner(t, c.root);
  await a.discardUnpublishedInstallation(c.approval.operationId);
  await a.discardUnpublishedInstallation(c.approval.operationId);
  await assert.rejects(a.enrollLocalInstallation(pkg), /discarded/);
  await assert.rejects(c.issue(), /discarded/);
  assert.equal((await readAuthorizationStore(c.root)).assignments.length, 0);
});

test(
  "one durable signed issuance survives process exit before return or authorization publication",
  posix,
  async (t) => {
    const c = await center(t);
    const child = `
    import fs from 'node:fs';
    import {syncBuiltinESMExports} from 'node:module';
    import {basename} from 'node:path';
    const [mod,root,directory,usb,approval]=process.argv.slice(1);
    const rename=fs.promises.rename;
    fs.promises.rename=async (a,b)=>{await rename(a,b); if(basename(b)==='issued.json') process.exit(74);};
    syncBuiltinESMExports();
    const {issueLocalInstallation}=await import(mod);
    await issueLocalInstallation(root,{directory,passphrase:Buffer.from('synthetic signing passphrase')},JSON.parse(usb),JSON.parse(approval));
  `;
    await assert.rejects(
      promisify(execFile)(process.execPath, [
        "--import",
        "tsx",
        "--input-type=module",
        "-e",
        child,
        new URL("../storage/field-issuer.ts", import.meta.url).href,
        c.root,
        c.media.directory,
        JSON.stringify(c.usb),
        JSON.stringify(c.approval),
      ]),
      { code: 74 }
    );
    const issued = JSON.parse(await readFile(join(c.root, "field/pki/issued.json"), "utf8")) as {
      certificates: Record<string, string>;
    };
    assert.equal((await readAuthorizationStore(c.root)).assignments.length, 0);
    await assert.rejects(
      issueLocalInstallation(c.root, c.media, c.usb, { ...c.approval, capabilities: [] })
    );
    const pkg = await c.issue();
    assert.equal(pkg.clientCertificate, issued.certificates[c.approval.operationId]);
    const a = await owner(t, c.root);
    assert.equal((await a.enrollLocalInstallation(pkg)).assignment.state, "pending");
  }
);

test(
  "signer removal and server-key loss have independent recovery boundaries",
  posix,
  async (t) => {
    const c = await center(t),
      other = await center(t);
    await rotateFieldServer(c.root, c.media, origin);
    const online = join(c.root, "field/pki/server.pem"),
      offline = join(c.media.directory, "gaia-signing/ca.key");
    assert.match(await readFile(offline, "utf8"), /BEGIN ENCRYPTED PRIVATE KEY/);
    assert.equal((await stat(offline)).mode & 0o777, 0o600);
    assert.equal((await stat(online)).mode & 0o777, 0o600);
    for (const dir of [join(c.media.directory, "gaia-signing"), join(c.root, "field/pki")])
      assert.equal((await stat(dir)).mode & 0o777, 0o700);
    const first = await readFieldServerIdentity(c.root, origin);
    await assert.rejects(rotateFieldServer(c.root, other.media, origin), /does not match/);
    await assert.rejects(
      issueLocalInstallation(
        c.root,
        { ...c.media, passphrase: Buffer.alloc(20) },
        c.usb,
        c.approval
      )
    );
    await rename(offline, offline + ".saved");
    await assert.rejects(rotateFieldServer(c.root, c.media, origin), { code: "ENOENT" });
    assert.equal((await readFieldServerIdentity(c.root, origin)).fingerprint, first.fingerprint);
    await rename(offline + ".saved", offline);
    await chmod(offline, 0o644);
    await assert.rejects(rotateFieldServer(c.root, c.media, origin), /Unsafe/);
    await chmod(offline, 0o600);
    await chmod(online, 0o644);
    await assert.rejects(readFieldServerIdentity(c.root, origin), /Unsafe/);
    await rm(online);
    await assert.rejects(readFieldServerIdentity(c.root, origin), { code: "ENOENT" });
    await rotateFieldServer(c.root, c.media, origin);
    const second = await readFieldServerIdentity(c.root, origin);
    assert.notEqual(second.fingerprint, first.fingerprint);
    await writeFile(online, second.cert + "\n" + first.key);
    await assert.rejects(readFieldServerIdentity(c.root, origin), /Wrong Gaia server key/);
    await rm(online);
    await symlink(offline, online);
    await assert.rejects(readFieldServerIdentity(c.root, origin), /Unsafe/);
    await assert.rejects(rotateFieldServer(c.root, c.media, origin), /Unsafe/);
    await rm(online);
    await link(offline, online);
    await assert.rejects(readFieldServerIdentity(c.root, origin), /Unsafe/);
    await assert.rejects(rotateFieldServer(c.root, c.media, origin), /Unsafe/);
  }
);

test(
  "missing or corrupt trust, issuance journal and authorization history stay closed",
  posix,
  async (t) => {
    const c = await center(t),
      pkg = await c.issue(),
      other = await center(t);
    const a = await owner(t, c.root);
    const caPath = join(c.root, "field/pki/ca.der");
    for (const path of [
      caPath,
      join(c.root, ".field-provisioned/x509/sha256"),
      join(c.root, "field/pki/issued.json"),
      authorizationStorePath(c.root),
    ]) {
      const original = await readFile(path);
      await rm(path);
      await assert.rejects(c.issue());
      await assert.rejects(a.enrollLocalInstallation(pkg));
      await assert.rejects(readFile(path), { code: "ENOENT" });
      await writeFile(path, "broken", { mode: 0o600 });
      await assert.rejects(c.issue());
      await assert.rejects(a.enrollLocalInstallation(pkg));
      assert.equal(await readFile(path, "utf8"), "broken");
      await writeFile(path, original);
    }
    await writeFile(caPath, (await readFieldTrust(other.root)).ca.raw);
    await assert.rejects(a.enrollLocalInstallation(pkg), /Wrong Gaia field CA/);
    await a.close();
    await assert.rejects(provisionFieldCa(c.root, c.media), { code: "EEXIST" });
    await assert.rejects(provisionAuthorizationStore(c.root), { code: "EEXIST" });
  }
);

test(
  "signed renewal, hardware replacement and reassignment use B3/1 lineage and revision checks",
  posix,
  async (t) => {
    const c = await center(t),
      a = await owner(t, c.root);
    const first = await a.enrollLocalInstallation(await c.issue());
    const original = first.assignment;
    await a.enrollmentCommand({
      action: "complete",
      assignmentId: original.id,
      operationId: randomUUID(),
    });
    const next = await usbClient();
    const usb = { ...next.usb, installationId: c.usb.installationId };
    const renewal: InstallationApproval = {
      ...c.approval,
      expectedRevision: first.revision,
      operationId: randomUUID(),
      publicKeyFingerprint: publicKeyFingerprint(next.publicKey),
      change: { kind: "renew", assignmentId: original.id },
    };
    await assert.rejects(
      issueLocalInstallation(c.root, c.media, c.usb, {
        ...renewal,
        publicKeyFingerprint: c.approval.publicKeyFingerprint,
      }),
      /new client key/
    );
    const cert = await issueLocalInstallation(c.root, c.media, usb, renewal);
    const pending = (await a.enrollLocalInstallation(cert)).assignment;
    assert.equal(pending.state, "pending");
    await a.enrollmentCommand({
      action: "complete",
      assignmentId: pending.id,
      operationId: randomUUID(),
    });
    assert.equal(
      await a.withVerifiedClient(
        "demo",
        derBase64(cert.clientCertificate),
        { authorizationGeneration: 2 },
        async () => true
      ),
      true
    );
    await assert.rejects(
      a.enrollLocalInstallation({ ...cert, approval: { ...renewal, change: { kind: "begin" } } })
    );
    const replacement = await usbClient();
    const rebind: InstallationApproval = {
      ...renewal,
      operationId: randomUUID(),
      installationId: replacement.usb.installationId,
      hardwareId: "replacement",
      publicKeyFingerprint: publicKeyFingerprint(replacement.publicKey),
      change: { kind: "rebindHardware", assignmentId: pending.id },
    };
    const rebound = await a.enrollLocalInstallation(
      await issueLocalInstallation(c.root, c.media, replacement.usb, rebind)
    );
    const row = rebound.assignment;
    assert.equal(row.authorizationGeneration, 3);
    const targetRevision = await inventory(c.root, "other");
    const reassign: InstallationApproval = {
      ...rebind,
      projectId: "other",
      expectedRevision: targetRevision,
      operationId: randomUUID(),
      change: {
        kind: "reassign",
        assignmentId: row.id,
        expectedSourceRevision: rebound.revision,
      },
    };
    const moved = await a.enrollLocalInstallation(
      await issueLocalInstallation(c.root, c.media, replacement.usb, reassign)
    );
    assert.equal(moved.assignment.authorizationGeneration, 4);
    assert.equal(moved.assignment.projectId, "other");
    await assert.rejects(
      a.withVerifiedClient("demo", derBase64(cert.clientCertificate), {}, async () => true),
      /not active/
    );
  }
);

test(
  "loopback TLS verifies both Gaia leaf profiles and proves possession of the client key",
  posix,
  async (t) => {
    const c = await center(t, true),
      pkg = await c.issue();
    await rotateFieldServer(c.root, c.media, origin);
    const identity = await readFieldServerIdentity(c.root, origin);
    const server = createServer(
      { ...identity, requestCert: true, rejectUnauthorized: true, minVersion: "TLSv1.2" },
      (socket) => {
        socket.end(socket.authorized ? sha256(socket.getPeerCertificate().raw) : "unauthorized");
      }
    );
    server.listen(0, "127.0.0.1");
    t.after(() => new Promise<void>((resolve) => server.close(() => resolve())));
    await once(server, "listening");
    const address = server.address();
    assert.ok(address && typeof address === "object");
    const syntheticKey = createPrivateKey({
      key: Buffer.from(await crypto.subtle.exportKey("pkcs8", c.keys.privateKey)),
      type: "pkcs8",
      format: "der",
    });
    const options = {
      host: "127.0.0.1",
      port: address.port,
      servername: "gaia.test",
      minVersion: "TLSv1.2" as const,
      ca: identity.ca,
      cert: new X509Certificate(derBase64(pkg.clientCertificate)).toString(),
      key: syntheticKey.export({ type: "pkcs8", format: "pem" }),
      rejectUnauthorized: true,
    };
    const socket = connect(options);
    let reply = "";
    socket.on("data", (part: Buffer) => {
      reply += part.toString();
    });
    await once(socket, "close");
    assert.equal(reply, sha256(derBase64(pkg.clientCertificate)));
    const withoutIdentity = connect({
      host: options.host,
      port: options.port,
      servername: options.servername,
      ca: identity.ca,
      maxVersion: "TLSv1.2",
      rejectUnauthorized: true,
    });
    await assert.rejects(once(withoutIdentity, "secureConnect"));
    const wrongHost = connect({ ...options, servername: "other.test" });
    await assert.rejects(once(wrongHost, "secureConnect"), {
      code: "ERR_TLS_CERT_ALTNAME_INVALID",
    });
  }
);

test(
  "ordinary backup and historical restore keep field keys and revocations outside project recovery",
  posix,
  async (t) => {
    const dir = await temp(t);
    const runtime = join(dir, "scripts/backup-runtime/index.mjs");
    const config = join(dir, "config/backup-scopes.json");
    const field = join(dir, "data/room-storage/gaia-room/field");
    await mkdir(join(dir, "scripts/backup-runtime"), { recursive: true });
    await mkdir(join(dir, "config"));
    await cp(new URL("../../../../scripts/backup-runtime/index.mjs", import.meta.url), runtime);
    await cp(new URL("../../../../config/backup-scopes.json", import.meta.url), config);
    await mkdir(join(field, "pki"), { recursive: true });
    await writeFile(join(field, "pki/server.pem"), "synthetic secret");
    await writeFile(join(field, "authorization.json"), "synthetic revoked history");
    await writeFile(join(dir, "data/world.json"), "synthetic world");
    const backup = (await import(pathToFileURL(runtime).href)) as {
      createBackup(options: object): Promise<{ bundlePath: string }>;
      restoreBackup(options: object): Promise<{ restoredFiles: number }>;
    };
    const result = await backup.createBackup({ scopeIds: ["data"] });
    const bundle = JSON.parse(await readFile(result.bundlePath, "utf8")) as {
      files: { path: string; contentBase64: string }[];
    };
    assert.deepEqual(
      bundle.files.map((f) => f.path),
      ["data/world.json"]
    );
    bundle.files.push({
      ...bundle.files[0]!,
      path: "data/room-storage/gaia-room/field/authorization.json",
    });
    await writeFile(result.bundlePath, JSON.stringify(bundle));
    assert.equal(
      (await backup.restoreBackup({ filePath: result.bundlePath, safetyBackup: false }))
        .restoredFiles,
      1
    );
    assert.equal(
      await readFile(join(field, "authorization.json"), "utf8"),
      "synthetic revoked history"
    );
  }
);

test(
  "restoring an old world cannot revive an assignment closed by a missed epoch reconciliation",
  posix,
  async (t) => {
    const dir = await temp(t);
    const root = join(dir, "data/room-storage/gaia-room");
    await mkdir(root, { recursive: true, mode: 0o700 });
    const c = await center(t, false, root);
    const pkg = await c.issue();
    const a = await owner(t, root);
    const pending = (await a.enrollLocalInstallation(pkg)).assignment;
    await a.enrollmentCommand({
      action: "complete",
      operationId: randomUUID(),
      assignmentId: pending.id,
    });
    const der = derBase64(pkg.clientCertificate);
    const receive = () => a.withVerifiedClient("demo", der, {}, async () => true);
    assert.equal(await receive(), true);
    const runtime = join(dir, "scripts/backup-runtime/index.mjs");
    await mkdir(join(dir, "scripts/backup-runtime"), { recursive: true });
    await mkdir(join(dir, "config"));
    await cp(new URL("../../../../scripts/backup-runtime/index.mjs", import.meta.url), runtime);
    await cp(
      new URL("../../../../config/backup-scopes.json", import.meta.url),
      join(dir, "config/backup-scopes.json")
    );
    const backup = (await import(pathToFileURL(runtime).href)) as {
      createBackup(options: object): Promise<{ bundlePath: string }>;
      restoreBackup(options: object): Promise<{ restoredFiles: number }>;
    };
    const bundle = await backup.createBackup({ scopeIds: ["data"] });
    const project = join(root, "projects", "demo");
    const field = join(root, "field");
    await serialized(project, async () => {
      const doc = await readDocument(join(project, "world.json"), "demo");
      const world = structuredClone(doc.world);
      world.revision += 1;
      world.devices["phone"]!.capabilities = ["battery.level.v1"];
      await rename(field, field + ".unavailable");
      try {
        await publishManagedWorld(root, project, doc, world, randomUUID(), "a".repeat(64));
      } finally {
        await rename(field + ".unavailable", field);
      }
    });
    await assert.rejects(receive(), /epoch|stale/);
    await a.close();
    await backup.restoreBackup({ filePath: bundle.bundlePath, safetyBackup: false });
    const restarted = await owner(t, root);
    await assert.rejects(
      restarted.withVerifiedClient("demo", der, {}, async () => true),
      /epoch|stale|authorization|not active/
    );
  }
);
