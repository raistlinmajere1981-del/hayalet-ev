import assert from "node:assert/strict";
import { once } from "node:events";
import { createPrivateKey, randomUUID, X509Certificate } from "node:crypto";
import { mkdtemp, readFile, rm, stat, writeFile } from "node:fs/promises";
import { request } from "node:https";
import { connect as tcp } from "node:net";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test, { type TestContext } from "node:test";
import { connect, type ConnectionOptions } from "node:tls";
import {
  capabilityIds,
  type SessionOpenResponse,
  type ObservationPacket,
  type ErrorResponse,
  type Ack,
} from "../protocol/schema.ts";
import { projectCommand } from "../storage/provider.ts";
import type { Opened } from "../editor/client.ts";
import type { GaiaStatusReply } from "../devices/field-view.ts";
import { FieldStatusReader } from "../editor/field-client.ts";
import { listenField, validateEndpoint } from "../field/receiver.ts";
import { decodeFieldBody } from "../field/request.ts";
import { FieldReceiverControl } from "../field/lifecycle.ts";
import { openFieldAuthority } from "../storage/enrollment-service.ts";
import { publicKeyFingerprint } from "../field/certificates.ts";
import { issueLocalInstallation, rotateFieldServer } from "../storage/field-issuer.ts";
import { serialized } from "../storage/files.ts";
import { publishManagedWorld, readDocument } from "../storage/project-document.ts";
import { projectPhysicalOffline } from "../storage/status-store.ts";
import { syntheticFieldCenter } from "./support/field-center.ts";
import { usbClient } from "./support/usb-client.ts";

const fixtures = new URL("../../../../gaia-protocol/v1/fixtures/", import.meta.url);
const packetFixture = async () =>
  JSON.parse(
    await readFile(new URL("valid/observation-t2-zeros.json", fixtures), "utf8")
  ) as ObservationPacket;

async function fixture(
  t: TestContext,
  inventory: readonly string[] = capabilityIds,
  allowed?: readonly string[]
) {
  const tmp = await mkdtemp(join(tmpdir(), "gaia-b7-"));
  const media = await mkdtemp(join(tmpdir(), "gaia-b7-media-"));
  const { keys, usb } = await usbClient("P-256", undefined, true);
  t.after(async () => {
    await rm(tmp, { recursive: true, force: true });
    await rm(media, { recursive: true, force: true });
  });
  const center = await syntheticFieldCenter(tmp, media, usb, inventory, allowed);
  const { endpoint, pkg, dir } = center;
  const credentials = {
    key: createPrivateKey({
      key: Buffer.from(await crypto.subtle.exportKey("pkcs8", keys.privateKey)),
      type: "pkcs8",
      format: "der",
    }).export({ format: "pem", type: "pkcs8" }),
    cert: new X509Certificate(Buffer.from(pkg.clientCertificate, "base64")).toString(),
    ca: new X509Certificate(Buffer.from(pkg.caCertificate, "base64")).toString(),
  };
  let now = Date.now(),
    mono = 0;
  let tick: (() => void) | undefined;
  const clock = { now: () => now, monoMs: () => mono };
  const timers = {
    schedule: (_ms: number, cb: () => void) => (tick = cb),
    cancel: () => {
      tick = undefined;
    },
  };
  const advance = (ms = 5000) => {
    mono += ms;
    now += ms;
  };
  const start = () => listenField(tmp, endpoint, clock, timers);
  const listener = await start();
  t.after(() => listener.close());
  function post<T = Ack & ErrorResponse>(
    path: string,
    data: unknown,
    opts: ConnectionOptions = {},
    headers: Record<string, string> = {}
  ) {
    const body = Buffer.isBuffer(data)
      ? data
      : Buffer.from(typeof data === "string" ? data : JSON.stringify(data));
    return new Promise<{ status: number; data: T; retry: string | undefined }>(
      (resolve, reject) => {
        const req = request(
          endpoint.origin + "/gaia/v1/" + path,
          {
            method: "POST",
            agent: false,
            ...credentials,
            ...opts,
            headers: {
              "content-type": "application/json",
              "content-length": String(body.length),
              ...headers,
            },
          },
          async (res) => {
            try {
              const chunks: Buffer[] = [];
              for await (const chunk of res) chunks.push(chunk as Buffer);
              const text = Buffer.concat(chunks).toString();
              resolve({
                status: res.statusCode!,
                data: text ? (JSON.parse(text) as T) : (undefined as T),
                retry: res.headers["retry-after"],
              });
            } catch (error) {
              reject(error);
            }
          }
        );
        req.on("error", reject);
        req.end(body);
      }
    );
  }
  const opening = {
    v: 1,
    projectId: "demo",
    deviceId: "phone",
    installationId: usb.installationId,
    runId: randomUUID(),
    offered: [...capabilityIds, "future.v1"],
  };
  async function open() {
    const res = await post<SessionOpenResponse>("sessions", opening);
    assert.equal(res.status, 201, JSON.stringify(res.data));
    return res.data;
  }
  const file = join(dir, "device-status.json");
  return {
    ...center,
    root: tmp,
    credentials,
    listener,
    start,
    open,
    post,
    opening,
    advance,
    jump: (ms: number) => {
      now += ms;
    },
    file,
    tick: () => tick?.(),
    disk: async () => JSON.parse(await readFile(file, "utf8")),
    read: () => readFile(file, "utf8"),
  };
}

test("B7 strict bytes match B1 raw fixtures, preserve spelling and reject escaped duplicate keys", async () => {
  for (const name of [
    "depth-too-deep",
    "invalid-utf8",
    "body-limit-plus-one",
    "non-finite",
    "duplicate-key",
    "prototype-keys",
    "unsafe-integer-literal",
  ]) {
    const bytes = await readFile(
      new URL("raw/observation-" + name + (name === "invalid-utf8" ? ".bin" : ".json"), fixtures)
    );
    assert.throws(() => decodeFieldBody(bytes), name);
  }
  const bytes = await readFile(new URL("raw/observation-body-limit-exact.json", fixtures));
  assert.equal(decodeFieldBody(bytes).body, bytes.toString());
  for (const raw of [
    '{"v":1,"\\u0076":2}',
    '{"v":1.00000000000000001}',
    "\ufeff{}",
    '{"x": [1,]}',
    '{"x": 1e-999}',
  ])
    assert.throws(() => decodeFieldBody(Buffer.from(raw)));
});

test("B7 T1 validates identity, intersects capabilities and rejects partial packets over TLS 1.2", async (t) => {
  const f = await fixture(
    t,
    capabilityIds.filter((x) => x !== "battery.voltage.v1"),
    capabilityIds.filter((x) => x !== "battery.voltage.v1" && x !== "proximity.state.v1")
  );
  for (const mismatch of [
    { projectId: "another" },
    { deviceId: "another" },
    { installationId: randomUUID() },
  ]) {
    assert.equal((await f.post("sessions", { ...f.opening, ...mismatch })).status, 403);
    f.advance();
  }
  const opened = await f.post<SessionOpenResponse>("sessions", f.opening, {
    maxVersion: "TLSv1.2",
    ciphers: "ECDHE-ECDSA-AES128-GCM-SHA256",
  });
  assert.equal(opened.status, 201);
  assert.deepEqual(
    [...opened.data.accepted].sort(),
    capabilityIds.filter((x) => x !== "battery.voltage.v1" && x !== "proximity.state.v1").sort()
  );
  const packet = { ...(await packetFixture()), sessionId: opened.data.sessionId, seq: 1 };
  for (const samples of [[], packet.samples]) {
    f.advance();
    assert.equal((await f.post("observations", { ...packet, samples })).status, 400);
    await assert.rejects(stat(f.file), { code: "ENOENT" });
  }
});

test("B7 T2/T4/T5 publish one v3 snapshot, replay its original ACK and preserve sample age", async (t) => {
  const f = await fixture(t);
  const world = await readFile(join(f.dir, "world.json"));
  const { sessionId } = await f.open();
  const packet = { ...(await packetFixture()), sessionId, seq: 1 };
  const body = JSON.stringify(packet);
  const ack = await f.post("observations", body, { minVersion: "TLSv1.3" });
  assert.equal(ack.status, 200);
  const before = await f.read(),
    inode = (await stat(f.file)).ino;
  const row = (await f.disk()).devices.phone;
  assert.equal(row.observations["battery.level.v1"].value, 0);
  assert.deepEqual(row.observations["accelerometer.xyz.v1"].value, [0, 0, 0]);
  assert.equal(row.observations["network.state.v1"].value.validated, false);
  assert.equal(row.observations["signal.read.v1"].quality, "missing");
  assert.equal(row.observations["battery.voltage.v1"].quality, "invalid");
  f.advance();
  assert.deepEqual((await f.post("observations", body)).data, ack.data);
  assert.equal(await f.read(), before);
  assert.equal((await stat(f.file)).ino, inode);
  for (const other of [body + " ", JSON.stringify({ ...packet, seq: 3 })]) {
    f.advance();
    assert.equal((await f.post("observations", other)).data.error, "sequence_conflict");
  }
  const conflict = structuredClone(packet);
  const battery = conflict.samples.find(
    (sample) => sample.id === "battery.level.v1" && sample.quality === "valid"
  )!;
  Object.assign(battery, { value: 1 });
  f.advance();
  assert.equal((await f.post("observations", { ...conflict, seq: 2 })).status, 503);
  assert.equal(await f.read(), before);
  for (let seq = 2; seq <= 8; seq++) {
    f.advance(10000);
    assert.equal(
      (
        await f.post("observations", {
          ...packet,
          seq,
          sentMonoMs: packet.sentMonoMs + seq * 10000,
        })
      ).status,
      200
    );
  }
  assert.deepEqual(
    (await f.disk()).devices.phone.observations["accelerometer.xyz.v1"],
    row.observations["accelerometer.xyz.v1"]
  );
  assert.deepEqual(await readFile(join(f.dir, "world.json")), world);
  assert.equal((await f.post("observations", body)).data.error, "sequence_conflict");
});

test("B7 T3 wrong trust, missing certificate, wrong SAN and revocation on an established TLS socket", async (t) => {
  const f = await fixture(t, []);
  const opened = await f.open();
  const packet = {
    v: 1,
    sessionId: opened.sessionId,
    seq: 1,
    sentMonoMs: 20,
    deviceWallMs: 100,
    samples: [],
  };
  assert.equal((await f.post("observations", packet)).status, 200);
  for (const opts of [{ ca: [] }, { cert: "", key: "" }, { servername: "wrong.gaia.test" }])
    await assert.rejects(f.post("sessions", f.opening, opts));
  const socket = connect({ ...f.credentials, host: f.endpoint.address, port: f.endpoint.port });
  await once(socket, "secureConnect");
  await f.listener.revoke(f.assignmentId, randomUUID());
  const bytes = JSON.stringify(packet);
  socket.write(
    `POST /gaia/v1/observations HTTP/1.1\r\nHost: localhost\r\nContent-Type: application/json\r\nContent-Length: ${Buffer.byteLength(bytes)}\r\n\r\n${bytes}`
  );
  let response = "";
  for await (const chunk of socket) response += chunk;
  assert.match(response, /^HTTP\/1.1 403/);
  assert.equal(f.listener.status().sessions, 0);
});

test("B7 rejects pinned generation and epoch changes, including an identical ACK retry", async (t) => {
  const f = await fixture(t, []);
  for (const change of ["epoch", "generation"]) {
    f.advance();
    const { sessionId } = await f.open();
    const packet = { v: 1, sessionId, seq: 1, sentMonoMs: 1, deviceWallMs: 1, samples: [] };
    f.advance();
    assert.equal((await f.post("observations", packet)).status, 200);
    const before = await f.read();
    const doc = await readDocument(join(f.dir, "world.json"), "demo");
    if (change === "epoch") {
      await serialized(f.dir, async () => {
        const next = structuredClone(doc.world);
        next.revision++;
        next.devices["other"] = { role: "client", source: "physical", capabilities: [] };
        await publishManagedWorld(f.root, f.dir, doc, next, randomUUID(), "1".repeat(64));
      });
    } else {
      const next = await usbClient("P-256", undefined, true);
      const renewal = await issueLocalInstallation(
        f.root,
        f.media,
        { ...next.usb, installationId: f.opening.installationId },
        {
          ...f.pkg.approval,
          expectedRevision: doc.world.revision,
          operationId: randomUUID(),
          publicKeyFingerprint: publicKeyFingerprint(next.publicKey),
          change: { kind: "renew", assignmentId: f.assignmentId },
        }
      );
      const id = await f.listener.enroll(renewal);
      await f.listener.complete(id, randomUUID());
      const key = Buffer.from(await crypto.subtle.exportKey("pkcs8", next.keys.privateKey));
      const newPeer = {
        key: createPrivateKey({ key, type: "pkcs8", format: "der" }).export({
          format: "pem",
          type: "pkcs8",
        }),
        cert: new X509Certificate(Buffer.from(renewal.clientCertificate, "base64")).toString(),
      };
      assert.equal((await f.post("sessions", f.opening, newPeer)).status, 201);
    }
    f.advance();
    assert.equal((await f.post("observations", packet)).status, 403);
    if (change === "generation") assert.equal(await f.read(), before);
  }
});

test("B7 failed publication keeps sequence retryable, timeout and single flight span writer contention", async (t) => {
  const f = await fixture(t, []);
  const { sessionId } = await f.open();
  const pkt = { v: 1, sessionId, seq: 1, sentMonoMs: 1, deviceWallMs: 1, samples: [] };
  await writeFile(f.file, "broken");
  const refusal = await f.post("observations", pkt);
  assert.equal(refusal.status, 503);
  assert.equal(refusal.retry, "1");
  assert.equal(await f.read(), "broken");
  await rm(f.file);
  assert.equal((await f.post("observations", pkt)).status, 200);
  f.advance(10000);
  const release = Promise.withResolvers<void>(),
    locked = Promise.withResolvers<void>();
  const holding = serialized(f.dir, async () => {
    locked.resolve();
    await release.promise;
  });
  await locked.promise;
  const waiting = f.post("observations", { ...pkt, seq: 2 });
  try {
    while (!f.listener.status().pending) await new Promise((resolve) => setTimeout(resolve, 2));
    assert.equal((await f.post("observations", { ...pkt, seq: 2 })).status, 503);
    f.advance(25000);
    f.tick();
  } finally {
    release.resolve();
    await holding;
  }
  assert.equal((await waiting).data.error, "session_expired");
  assert.equal((await f.disk()).devices.phone.measured.seq, 1);
});

test("B7 T6 deadline, replacement session and delayed offline compare under the project lock", async (t) => {
  const f = await fixture(t, []);
  const { sessionId } = await f.open();
  const pkt = { v: 1, sessionId, seq: 1, sentMonoMs: 1, deviceWallMs: 1, samples: [] };
  assert.equal((await f.post("observations", pkt)).status, 200);
  const old = (await f.disk()).devices.phone;
  f.advance(34999);
  f.tick();
  assert.equal(f.listener.status().sessions, 1);
  f.advance(1);
  f.tick();
  assert.equal(f.listener.status().sessions, 0);
  for (let n = 0; n < 100 && !(await f.disk()).devices.phone.lastOfflineAt; n++)
    await new Promise((resolve) => setTimeout(resolve, 5));
  assert.ok((await f.disk()).devices.phone.lastOfflineAt);
  const replacement = await f.open();
  assert.equal(
    (await f.post("observations", { ...pkt, sessionId: replacement.sessionId })).status,
    200
  );
  const before = await f.read();
  const doc = await readDocument(join(f.dir, "world.json"), "demo");
  const retired = {
    ...old.measured,
    lastSeq: 1,
    deviceId: "phone",
    hardwareId: old.hardwareId,
    statusEpoch: doc.statusEpoch!,
  };
  for (const stale of [
    retired,
    { ...retired, sessionId: replacement.sessionId, lastSeq: 0 },
    { ...retired, sessionId: replacement.sessionId, statusEpoch: 0 },
    { ...retired, sessionId: replacement.sessionId, authorizationGeneration: 0 },
  ])
    await serialized(f.dir, () =>
      projectPhysicalOffline(f.dir, doc.world, doc.statusEpoch!, stale, Date.now())
    );
  assert.equal(await f.read(), before);
});

test("B7 raw HTTP budgets and retry headers, closed by default and single center owner", async (t) => {
  const f = await fixture(t, []);
  await assert.rejects(openFieldAuthority(f.root, { certificatesRequired: true }));
  await assert.rejects(f.start());
  assert.throws(() => validateEndpoint({ ...f.endpoint, address: "0.0.0.0" }));
  const control = new FieldReceiverControl(() => f.root);
  assert.equal(control.status().enabled, false);
  for (const [payload, headers, code] of [
    ["{}", { "content-type": "text/plain" }, 415],
    ["{}", { "content-encoding": "gzip" }, 415],
    [Buffer.alloc(16385), {}, 413],
    ['{"v":1,"v":1}', {}, 400],
    [Buffer.from([255]), {}, 400],
    [JSON.stringify({ ...f.opening, extra: 1 }), {}, 400],
  ] as const) {
    f.advance();
    assert.equal((await f.post("sessions", payload, {}, headers)).status, code);
  }
  f.advance(15000);
  await f.open();
  for (let i = 0; i < 2; i++) assert.equal((await f.post("sessions", f.opening)).retry, "35");
  const limit = await f.post("sessions", f.opening);
  assert.equal(limit.status, 429);
  assert.equal(limit.retry, "5");
});

test("B7 bounded handshakes, slow headers and slow body expire independently", async (t) => {
  const f = await fixture(t);
  const params = { ...f.credentials, host: f.endpoint.address, port: f.endpoint.port };
  const header = connect(params),
    body = connect(params);
  await Promise.all([once(header, "secureConnect"), once(body, "secureConnect")]);
  header.write("POST /gaia/v1/sessions HTTP/1.1\r\n");
  body.write(
    "POST /gaia/v1/sessions HTTP/1.1\r\nHost: localhost\r\nContent-Type: application/json\r\nContent-Length: 90\r\n\r\n{"
  );
  const slow = [
    header,
    body,
    ...Array.from({ length: 14 }, () => tcp(f.endpoint.port, f.endpoint.address)),
  ];
  const closed = Promise.all(slow.map((s) => once(s, "close")));
  const extra = tcp(f.endpoint.port, f.endpoint.address);
  await once(extra, "close");
  assert.equal(f.listener.status().connections, 16);
  await closed;
  for (let i = 0; i < 50 && f.listener.status().connections; i++)
    await new Promise((resolve) => setTimeout(resolve, 2));
  assert.equal(f.listener.status().connections, 0);
  for (let i = 0; i < 14; i++) {
    const s = tcp(f.endpoint.port, f.endpoint.address);
    await once(s, "connect");
    s.destroy();
    await once(s, "close");
  }
  await assert.rejects(f.post("sessions", f.opening));
  f.advance(60000);
  assert.equal((await f.open()).intervalMs, 10000);
});

test("B7 rotation, clock discontinuity and restart require a fresh session and valid server identity", async (t) => {
  const f = await fixture(t, []);
  const { sessionId } = await f.open();
  const pkt = { v: 1, sessionId, seq: 1, sentMonoMs: 1, deviceWallMs: 1, samples: [] };
  assert.equal((await f.post("observations", pkt)).status, 200);
  f.jump(-365 * 86400000);
  await assert.rejects(f.listener.checkIdentity());
  await f.listener.close();
  const control = new FieldReceiverControl(() => f.root);
  t.after(() => control.shutdown());
  await control.start(f.endpoint);
  assert.equal((await f.post("observations", pkt)).data.error, "session_expired");
  await control.suspend();
  await assert.rejects(f.post("sessions", f.opening));
  await control.resume();
  await f.open();
  await rotateFieldServer(f.root, f.media, f.endpoint.origin);
  await assert.rejects(f.post("observations", pkt));
  await control.reload();
  assert.equal((await f.post("observations", pkt)).data.error, "session_expired");
  await Promise.all([control.shutdown(), control.shutdown()]);
  const other = await openFieldAuthority(f.root, { certificatesRequired: true });
  await other.close();
});

test("B7 an opening that retires its predecessor prevents the queued offline write before seq 1", async (t) => {
  const f = await fixture(t, []);
  const { sessionId } = await f.open();
  const packet = { v: 1, sessionId, seq: 1, sentMonoMs: 2, deviceWallMs: 3, samples: [] };
  assert.equal((await f.post("observations", packet)).status, 200);
  const before = await f.read();
  const inode = (await stat(f.file)).ino;
  // Let the open transaction reap the predecessor while holding the project lock.
  // The offline job must compare RAM ownership even while disk still shows the old seq.
  f.advance(35000);
  const replacement = await f.open();
  assert.notEqual(replacement.sessionId, sessionId);
  for (let i = 0; i < 200 && f.listener.status().pendingOffline; i++)
    await new Promise((resolve) => setTimeout(resolve, 5));
  assert.equal(f.listener.status().pendingOffline, 0);
  assert.equal(await f.read(), before);
  assert.equal((await stat(f.file)).ino, inode);
  assert.equal(
    (await f.post("observations", { ...packet, sessionId: replacement.sessionId })).status,
    200
  );
});

test("B7 wire header and body boundaries, streaming framing and route allowlist", async (t) => {
  const f = await fixture(t, []);
  async function sendRaw(headers: string, body: string) {
    f.advance();
    const socket = connect({ ...f.credentials, host: f.endpoint.address, port: f.endpoint.port });
    await once(socket, "secureConnect");
    socket.write(headers + "\r\n\r\n" + body);
    let response = "";
    for await (const chunk of socket) response += chunk;
    return Number(response.split(" ")[1]);
  }
  const base =
    "POST /gaia/v1/sessions HTTP/1.1\r\nHost: localhost\r\nContent-Type: application/json";
  const body = JSON.stringify(f.opening);
  const header = base + "\r\nContent-Length: " + body.length + "\r\nX-Pad: ";
  assert.equal(await sendRaw(header.padEnd(8192 - 4, "x"), body), 201);
  assert.equal(await sendRaw(header.padEnd(8193 - 4, "x"), body), 413);
  assert.equal((await f.post("sessions", body.padEnd(16384))).status, 409);
  assert.equal(
    await sendRaw(
      base + "\r\nTransfer-Encoding: chunked",
      "4001\r\n" + " ".repeat(16385) + "\r\n0\r\n\r\n"
    ),
    413
  );
  assert.equal(
    await sendRaw(
      base + "\r\nTransfer-Encoding: chunked",
      body.length.toString(16) + "\r\n" + body + "\r\n0\r\n\r\n"
    ),
    409
  );
  assert.equal(
    await sendRaw(base + "\r\nContent-Length: 0\r\nTransfer-Encoding: chunked", ""),
    400
  );
  assert.equal((await f.post("enrollment", {})).status, 404);
  assert.equal(await sendRaw(base.replace("POST", "GET") + "\r\nContent-Length: 0", ""), 405);
});

test("B7 peer signed by another field CA and issued but inactive certificate are denied", async (t) => {
  const f = await fixture(t, []),
    other = await fixture(t, []);
  await assert.rejects(
    f.post("sessions", f.opening, { ...other.credentials, ca: f.credentials.ca })
  );
  const next = await usbClient("P-256", undefined, true);
  const doc = await readDocument(join(f.dir, "world.json"), "demo");
  const issued = await issueLocalInstallation(
    f.root,
    f.media,
    { ...next.usb, installationId: f.opening.installationId },
    {
      ...f.pkg.approval,
      expectedRevision: doc.world.revision,
      operationId: randomUUID(),
      publicKeyFingerprint: publicKeyFingerprint(next.publicKey),
      change: { kind: "renew", assignmentId: f.assignmentId },
    }
  );
  const key = Buffer.from(await crypto.subtle.exportKey("pkcs8", next.keys.privateKey));
  const idle = {
    key: createPrivateKey({ key, type: "pkcs8", format: "der" }).export({
      format: "pem",
      type: "pkcs8",
    }),
    cert: new X509Certificate(Buffer.from(issued.clientCertificate, "base64")).toString(),
  };
  assert.equal((await f.post("sessions", f.opening, idle)).status, 403);
  assert.equal(f.listener.status().sessions, 0);
  await assert.rejects(stat(f.file), { code: "ENOENT" });
});

test(
  "B7 ten-second request budget releases the socket, keeps the pending work bounded and cancels a queued publish",
  { timeout: 20000 },
  async (t) => {
    const f = await fixture(t, []);
    const { sessionId } = await f.open();
    const packet = { v: 1, sessionId, seq: 1, sentMonoMs: 1, deviceWallMs: 1, samples: [] };
    const release = Promise.withResolvers<void>(),
      locked = Promise.withResolvers<void>();
    const holding = serialized(f.dir, async () => {
      locked.resolve();
      await release.promise;
    });
    await locked.promise;
    const started = performance.now();
    try {
      await assert.rejects(f.post("observations", packet));
      const elapsed = performance.now() - started;
      assert.ok(elapsed >= 9500 && elapsed < 14000, `elapsed ${elapsed}`);
      assert.equal(f.listener.status().pending, 1);
      assert.equal((await f.post("observations", packet)).status, 503);
    } finally {
      release.resolve();
      await holding;
    }
    for (let i = 0; i < 200 && f.listener.status().pending; i++)
      await new Promise((resolve) => setTimeout(resolve, 5));
    await assert.rejects(stat(f.file), { code: "ENOENT" });
    f.advance();
    assert.equal((await f.post("observations", packet)).status, 200);
  }
);

test("B8 GaiaStatus reads the live B7 proof, ages delayed IPC and separates quality, source and connection", async (t) => {
  const f = await fixture(t);
  const ctx = { storageRoot: f.root, owner: {} };
  const { session } = (await projectCommand(ctx, "GaiaOpen", { project: "demo" })) as Opened;
  const scope = { project: "demo", session };
  const { sessionId } = await f.open();
  const pkt = { ...(await packetFixture()), sessionId, seq: 1 };
  // This sample reaches its freshness boundary before the heartbeat reaches its own deadline.
  const sample = pkt.samples.find((s) => s.id === "battery.level.v1")!;
  if (sample.quality !== "missing") sample.sampleMonoMs = pkt.sentMonoMs - 59000;
  assert.equal((await f.post("observations", pkt)).status, 200);
  const read = () =>
    projectCommand(
      ctx,
      "GaiaStatus",
      scope,
      undefined,
      f.listener.liveReading
    ) as Promise<GaiaStatusReply>;
  const status = await read();
  assert.equal(status.statuses["phone"], undefined);
  const view = status.physical["phone"]!;
  assert.equal(view.connection, "online");
  assert.equal(view.linkRemainingMs, 35000);
  assert.equal(view.observations["battery.level.v1"]!.freshRemainingMs, 1000);
  assert.equal(view.observations["battery.level.v1"]!.value, 0);
  assert.equal(view.observations["battery.voltage.v1"]!.quality, "invalid");
  assert.equal(view.observations["signal.read.v1"]!.freshness, "noData");
  assert.equal(JSON.stringify(view).includes("acceptedMonoMs"), false);
  let local = 100;
  const reader = new FieldStatusReader(
    async () => {
      local += 999.25;
      return status;
    },
    () => local
  );
  await reader.load(scope);
  const current = () => reader.current(scope, status.revision);
  assert.equal(current()?.physical["phone"]!.observations["battery.level.v1"]!.freshness, "stale");
  assert.equal(current()?.physical["phone"]!.connection, "online");
  local = 35100;
  assert.equal(current()?.physical["phone"]!.connection, "offline");
  assert.equal(reader.current({ ...scope, session: randomUUID() }, status.revision), undefined);
  assert.equal(reader.current(scope, status.revision + 1), undefined);
  reader.cancel();
  assert.equal(current(), undefined);

  const before = await f.read();
  await assert.rejects(
    projectCommand(ctx, "GaiaStatus", {
      ...scope,
      update: { kind: "link", deviceId: "phone", state: "online", source: "measured" },
    })
  );
  await assert.rejects(
    projectCommand(ctx, "GaiaStatus", {
      ...scope,
      update: { kind: "link", deviceId: "phone", state: "online" },
    })
  );
  assert.equal(await f.read(), before);
  f.advance(34999);
  assert.equal((await read()).physical["phone"]!.linkRemainingMs, 1);
  f.advance(1);
  assert.equal((await read()).physical["phone"]!.connection, "offline");
  await f.listener.close();
  const cold = await f.start();
  try {
    const after = (await projectCommand(
      ctx,
      "GaiaStatus",
      scope,
      undefined,
      cold.liveReading
    )) as GaiaStatusReply;
    assert.equal(after.physical["phone"]!.connection, "unknown");
    assert.equal(after.physical["phone"]!.observations["battery.level.v1"]!.freshness, "stale");
    await cold.revoke(f.assignmentId, randomUUID());
    const revoked = (await projectCommand(
      ctx,
      "GaiaStatus",
      scope,
      undefined,
      cold.liveReading
    )) as GaiaStatusReply;
    assert.deepEqual(revoked.physical, {});
    assert.equal(revoked.statuses["phone"], undefined);
  } finally {
    await cold.close();
  }
});

test("B8 T7/T8 hides mismatched grant, inventory epoch and unbound legacy rows and preserves damaged status", async (t) => {
  const f = await fixture(t);
  const ctx = { storageRoot: f.root, owner: {} };
  const { session } = (await projectCommand(ctx, "GaiaOpen", { project: "demo" })) as Opened;
  const read = () =>
    projectCommand(
      ctx,
      "GaiaStatus",
      { project: "demo", session },
      undefined,
      f.listener.liveReading
    ) as Promise<GaiaStatusReply>;
  const { sessionId } = await f.open();
  assert.equal(
    (await f.post("observations", { ...(await packetFixture()), seq: 1, sessionId })).status,
    200
  );
  const original = await f.read();
  for (const patch of [
    { assignmentId: randomUUID() },
    { authorizationGeneration: 2 },
    { installationId: randomUUID() },
  ]) {
    const copy = JSON.parse(original);
    Object.assign(copy.devices.phone.measured, patch);
    await writeFile(f.file, JSON.stringify(copy));
    assert.deepEqual((await read()).physical, {});
  }
  const legacy = JSON.parse(original);
  delete legacy.devices.phone.measured.assignmentId;
  await writeFile(f.file, JSON.stringify(legacy));
  const historic = (await read()).physical["phone"]!;
  assert.equal(historic.connection, "unknown");
  assert.equal(historic.linkRemainingMs, 0);
  legacy.identity = "a".repeat(64);
  await writeFile(f.file, JSON.stringify(legacy));
  assert.deepEqual((await read()).physical, {});
  const version2 = JSON.parse(original);
  version2.schemaVersion = 2;
  version2.devices = {
    phone: { source: "measured", hardwareId: f.pkg.approval.hardwareId, observations: {} },
  };
  await writeFile(f.file, JSON.stringify(version2));
  assert.deepEqual((await read()).physical, {});
  await writeFile(f.file, "{");
  await assert.rejects(read(), /unreadable/);
  assert.equal(await f.read(), "{");
  assert.ok(((await projectCommand(ctx, "GaiaOpen", { project: "demo" })) as Opened).session);
});

test("B8 a new generation-one lineage cannot claim a revoked B7 reading with the same installation and hardware", async (t) => {
  const f = await fixture(t);
  const ctx = { storageRoot: f.root, owner: {} };
  const opened = (await projectCommand(ctx, "GaiaOpen", { project: "demo" })) as Opened;
  const scope = { project: "demo", session: opened.session };
  const read = () =>
    projectCommand(
      ctx,
      "GaiaStatus",
      scope,
      undefined,
      f.listener.liveReading
    ) as Promise<GaiaStatusReply>;
  const { sessionId } = await f.open();
  assert.equal(
    (await f.post("observations", { ...(await packetFixture()), seq: 1, sessionId })).status,
    200
  );

  await projectCommand(ctx, "GaiaStatus", {
    ...scope,
    update: { deviceId: "c1", kind: "link", state: "online" },
  });
  const ledger = join(f.root, "field", "authorization.json");
  const bytes = await readFile(ledger);
  await writeFile(ledger, "{");
  const unavailable = await read();
  assert.equal(unavailable.physicalError, "authorization_unavailable");
  assert.deepEqual(unavailable.physical, {});
  assert.equal(unavailable.statuses["c1"]?.source, "simulated");
  await writeFile(ledger, bytes);

  await f.listener.revoke(f.assignmentId, randomUUID());
  const client = await usbClient();
  const usb = { ...client.usb, installationId: f.pkg.approval.installationId };
  const pkg = await issueLocalInstallation(f.root, f.media, usb, {
    ...f.pkg.approval,
    operationId: randomUUID(),
    expectedRevision: opened.world.revision,
    publicKeyFingerprint: publicKeyFingerprint(client.publicKey),
    change: { kind: "begin" },
  });
  const next = await f.listener.enroll(pkg);
  await f.listener.complete(next, randomUUID());
  assert.deepEqual((await read()).physical, {});
  const stored = await f.disk();
  delete stored.devices.phone.measured.assignmentId;
  await writeFile(f.file, JSON.stringify(stored));
  assert.deepEqual((await read()).physical, {});
});
