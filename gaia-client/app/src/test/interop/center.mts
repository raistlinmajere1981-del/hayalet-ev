// Test-only loopback receiver. All authority, signing media and inventory live in a fresh temp tree.
import { createServer } from "node:https";
import { TLSSocket } from "node:tls";
import { createInterface } from "node:readline";
import { once } from "node:events";
import { randomUUID } from "node:crypto";
import { appendFile, mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { inspectUsbRequest } from "../../../../../rooms/gaia-room/scripts/field/installation.ts";
import { sha256 } from "../../../../../rooms/gaia-room/scripts/field/certificates.ts";
import { createSiteFixture } from "../../../../../rooms/gaia-room/scripts/spatial/fixture.ts";
import { openFieldAuthority } from "../../../../../rooms/gaia-room/scripts/storage/enrollment-service.ts";
import { provisionAuthorizationStore } from "../../../../../rooms/gaia-room/scripts/storage/enrollment-store.ts";
import {
  issueLocalInstallation,
  provisionFieldCa,
  rotateFieldServer,
} from "../../../../../rooms/gaia-room/scripts/storage/field-issuer.ts";
import { readFieldServerIdentity } from "../../../../../rooms/gaia-room/scripts/storage/field-trust.ts";

const io = process.argv[2]!;
const usb = JSON.parse(await readFile(join(io, "request.json"), "utf8"));
const client = inspectUsbRequest(usb);
const root = await mkdtemp(join(tmpdir(), "gaia-b6-center-"));
const media = {
  directory: await mkdtemp(join(tmpdir(), "gaia-b6-media-")),
  passphrase: Buffer.from(randomUUID()),
};
try {
  await provisionAuthorizationStore(root);
  const pin = await provisionFieldCa(root, media);
  const world = createSiteFixture();
  world.id = "demo";
  world.devices.phone = { role: "client", source: "physical", capabilities: ["battery.level.v1"] };
  const dir = join(root, "projects", world.id);
  await mkdir(dir, { recursive: true, mode: 0o700 });
  await writeFile(
    join(dir, "world.json"),
    JSON.stringify({ world, statusEpoch: 0, lastOperation: null })
  );
  const ip = "127.0.0.1";
  const serverOrigin = "https://" + (process.argv[3] === "wrong-san" ? "wrong.test" : ip);
  await rotateFieldServer(root, media, serverOrigin);
  const tls = await readFieldServerIdentity(root, serverOrigin);
  const authority = await openFieldAuthority(root);
  let assignmentId = "";
  let sessionId = randomUUID();
  const server = createServer(
    {
      ...tls,
      requestCert: true,
      rejectUnauthorized: true,
      minVersion: "TLSv1.2",
      maxVersion: process.argv[3] === "tls12" ? "TLSv1.2" : "TLSv1.3",
    },
    async (req, res) => {
      const chunks: Buffer[] = [];
      for await (const c of req) chunks.push(c);
      const body = Buffer.concat(chunks);
      const socket = req.socket as TLSSocket;
      await writeFile(
        join(io, "negotiated"),
        socket.getProtocol() + " " + socket.getCipher().standardName
      );
      const mode = await readFile(join(io, "mode"), "utf8");
      await appendFile(join(io, "events"), `${req.url} ${sha256(body)} ${mode}\n`);
      if (mode === "stall" || (mode === "stall-send" && req.url === "/gaia/v1/observations")) {
        res.on("close", () => void appendFile(join(io, "events"), "closed\n"));
        return;
      }
      if (mode === "eof") {
        res.destroy();
        return;
      }
      const reply = (status: number, json: unknown) => {
        res.writeHead(status, {
          "content-type": "application/json",
          "cache-control": "no-store",
          ...(mode === "busy" ? { "retry-after": "7" } : {}),
        });
        res.end(JSON.stringify(json));
      };
      if (mode === "revoke")
        await authority.enrollmentCommand({
          action: "revoke",
          operationId: randomUUID(),
          assignmentId,
        });
      try {
        await authority.withVerifiedClient(
          "demo",
          (req.socket as TLSSocket).getPeerCertificate().raw,
          {},
          async () => true
        );
      } catch {
        reply(403, { v: 1, error: "not_authorized" });
        return;
      }
      if (mode === "redirect") {
        res.writeHead(307, { location: "http://127.0.0.1/" });
        res.end();
        return;
      }
      if (mode === "expired") {
        reply(409, { v: 1, error: "session_expired" });
        return;
      }
      if (mode === "busy") {
        reply(503, { v: 1, error: "unavailable" });
        return;
      }
      if (req.url === "/gaia/v1/sessions") {
        sessionId = randomUUID();
        reply(201, { v: 1, sessionId, accepted: [], intervalMs: 10000, timeoutMs: 35000 });
      } else {
        const packet = JSON.parse(body.toString());
        reply(200, {
          v: 1,
          sessionId,
          seq: mode === "wrong-ack" ? packet.seq + 1 : packet.seq,
          acceptedAt: Date.now(),
        });
      }
    }
  );
  try {
    server.listen(0, ip);
    await once(server, "listening");
    const address = server.address();
    if (!address || typeof address === "string") throw Error("Missing loopback endpoint");
    const pkg = await issueLocalInstallation(root, media, usb, {
      operationId: randomUUID(),
      projectId: "demo",
      deviceId: "phone",
      hardwareId: 'unit "Türkçe"🛠',
      capabilities: ["battery.level.v1"],
      expectedRevision: world.revision,
      installationId: client.installationId,
      publicKeyFingerprint: client.fingerprint,
      caFingerprint: pin,
      httpsOrigin: `https://${ip}:${address.port}`,
      change: { kind: "begin" },
    });
    const initial = await authority.enrollLocalInstallation(pkg);
    assignmentId = initial.assignment.id;
    await authority.enrollmentCommand({
      action: "complete",
      operationId: randomUUID(),
      assignmentId,
    });
    await writeFile(join(io, "package.json"), JSON.stringify(pkg));
    await writeFile(join(io, "pin"), pin);
    await writeFile(join(io, "mode"), "ok");
    process.stdout.write("ready\n");
    for await (const command of createInterface({ input: process.stdin })) {
      if (command !== "renew") throw Error("Unknown fixture command");
      const renewal = JSON.parse(await readFile(join(io, "request.json"), "utf8"));
      const next = await issueLocalInstallation(root, media, renewal, {
        ...pkg.approval,
        expectedRevision: initial.revision,
        operationId: randomUUID(),
        publicKeyFingerprint: inspectUsbRequest(renewal).fingerprint,
        change: { kind: "renew", assignmentId },
      });
      assignmentId = (await authority.enrollLocalInstallation(next)).assignment.id;
      await authority.enrollmentCommand({
        action: "complete",
        operationId: randomUUID(),
        assignmentId,
      });
      await writeFile(join(io, "renewal.json"), JSON.stringify(next));
      process.stdout.write("renewed\n");
    }
  } finally {
    server.closeAllConnections();
    server.close();
    await authority.close();
  }
} finally {
  await Promise.all([
    rm(root, { recursive: true, force: true }),
    rm(media.directory, { recursive: true, force: true }),
  ]);
}
