import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { createPrivateKey, randomUUID, webcrypto, X509Certificate } from "node:crypto";
import { once } from "node:events";
import { cp, mkdir, mkdtemp, readFile, rm, stat, symlink, writeFile } from "node:fs/promises";
import { request } from "node:https";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { createInterface } from "node:readline";
import { connect } from "node:tls";
import electron from "electron";
import { syntheticFieldCenter } from "../../rooms/gaia-room/scripts/tests/support/field-center.ts";
import { usbClient } from "../../rooms/gaia-room/scripts/tests/support/usb-client.ts";

const io = process.argv[2];
const temp = await mkdtemp(join(tmpdir(), "gaia-b7-electron-"));
const root = join(temp, "data", "room-storage", "gaia-room"),
  media = join(temp, "media");
let child, exited;
async function stop() {
  if (!child) return;
  if (child.exitCode === null && child.signalCode === null) child.stdin.end("quit\n");
  let timer;
  try {
    const [code] = await Promise.race([
      exited,
      new Promise((_, reject) => {
        timer = setTimeout(() => reject(new Error("Electron did not drain")), 15000);
      }),
    ]);
    assert.equal(code, 0);
  } finally {
    clearTimeout(timer);
    if (child.exitCode === null) child.kill("SIGKILL");
    await exited;
    child = undefined;
  }
}

try {
  await mkdir(root, { mode: 0o700, recursive: true });
  await mkdir(media, { mode: 0o700 });
  await symlink(resolve("node_modules"), join(temp, "node_modules"), "dir");
  const entry = join(temp, "main.mjs");
  const isolatedPath = join(temp, "bin");
  await mkdir(isolatedPath);
  await mkdir(join(temp, "config"));
  await writeFile(join(temp, "AGENTS.md"), "");
  await writeFile(
    join(temp, "config/settings.json"),
    JSON.stringify({ assistants: { keepServersOnAppClose: true } })
  );
  await cp("package.json", join(temp, "package.json"));
  await cp("dist/electron", join(temp, "dist/electron"), { recursive: true });
  await cp("dist/renderer", join(temp, "dist/renderer"), { recursive: true });
  await symlink(resolve("src"), join(temp, "src"), "dir");
  await cp("scripts/tests/gaia-field-electron-host.mjs", entry);
  const client = io ? undefined : await usbClient("P-256", undefined, true);
  const usb = client?.usb ?? JSON.parse(await readFile(join(io, "request.json"), "utf8"));
  const { endpoint, pkg, dir } = await syntheticFieldCenter(root, media, usb, [
    "accelerometer.xyz.v1",
  ]);
  async function start(enabled = true) {
    child = spawn(
      electron,
      ["--no-sandbox", "--disable-gpu", "--user-data-dir=" + join(temp, "profile"), entry],
      {
        env: {
          ...process.env,
          // Only the serial-scoped probe may access ADB. The shell's ordinary
          // Capture discovery and exit cleanup must not enumerate attached phones.
          PATH: isolatedPath,
          HAYALET_ADB_PATH: "",
          ADB_PATH: "",
          NODE_ENV: "production",
          CDP_PORT: "0",
          XDG_CONFIG_HOME: join(temp, "xdg-config"),
          XDG_CACHE_HOME: join(temp, "xdg-cache"),
          HEV_GAIA_FIELD_ADDRESS: enabled ? endpoint.address : "",
          HEV_GAIA_FIELD_PORT: enabled ? String(endpoint.port) : "",
          HEV_GAIA_FIELD_ORIGIN: enabled ? endpoint.origin : "",
        },
        cwd: temp,
        stdio: ["pipe", "pipe", "inherit"],
      }
    );
    exited = once(child, "exit");
    const lines = createInterface({ input: child.stdout });
    const timeout = setTimeout(() => child.kill("SIGKILL"), 20000);
    try {
      for await (const line of lines) if (line === "listening") return;
    } finally {
      clearTimeout(timeout);
      lines.close();
    }
    throw new Error("Electron exited before listening");
  }
  await start();
  const path = join(dir, "device-status.json");
  if (io) {
    await writeFile(join(io, "package.json"), JSON.stringify(pkg));
    await writeFile(join(io, "pin"), pkg.approval.caFingerprint);
    process.stdout.write("ready\n");
    for await (const line of createInterface({ input: process.stdin })) {
      if (line !== "measure") throw new Error("Unknown measurement command");
      const row = JSON.parse(await readFile(path, "utf8")).devices.phone;
      const sample = row.observations["accelerometer.xyz.v1"];
      assert.equal(row.source, "measured");
      assert.ok(row.measured.seq >= 2);
      assert.equal(sample.quality, "valid");
      process.stdout.write(
        JSON.stringify({
          seq: row.measured.seq,
          acceptedAt: row.measured.acceptedAt,
          value: sample.value,
          unit: sample.unit,
          ageUpperMs: sample.ageUpperMs,
        }) + "\n"
      );
    }
  } else {
    const options = {
      cert: new X509Certificate(Buffer.from(pkg.clientCertificate, "base64")).toString(),
      ca: new X509Certificate(Buffer.from(pkg.caCertificate, "base64")).toString(),
      key: createPrivateKey({
        key: Buffer.from(await webcrypto.subtle.exportKey("pkcs8", client.keys.privateKey)),
        type: "pkcs8",
        format: "der",
      }).export({ format: "pem", type: "pkcs8" }),
    };
    function post(route, body) {
      return new Promise((resolve, reject) => {
        const req = request(
          endpoint.origin + "/gaia/v1/" + route,
          {
            method: "POST",
            agent: false,
            ...options,
            headers: {
              "content-type": "application/json",
              "content-length": Buffer.byteLength(body),
            },
          },
          async (res) => {
            try {
              let bytes = "";
              for await (const chunk of res) bytes += chunk;
              resolve([res.statusCode, JSON.parse(bytes)]);
            } catch (error) {
              reject(error);
            }
          }
        );
        req.on("error", reject);
        req.end(body);
      });
    }
    const opening = JSON.stringify({
      v: 1,
      projectId: "demo",
      deviceId: "phone",
      installationId: usb.installationId,
      runId: randomUUID(),
      offered: ["accelerometer.xyz.v1"],
    });
    const [code, session] = await post("sessions", opening);
    assert.equal(code, 201);
    const packet = JSON.stringify({
      v: 1,
      sessionId: session.sessionId,
      seq: 1,
      sentMonoMs: 50,
      deviceWallMs: 500,
      samples: [
        {
          id: "accelerometer.xyz.v1",
          quality: "valid",
          sampleMonoMs: 48,
          unit: "m/s²",
          value: [1, 0, 9],
        },
      ],
    });
    async function loseAck(body) {
      const socket = connect({ ...options, host: endpoint.address, port: endpoint.port });
      await once(socket, "secureConnect");
      // Discard the response before it reaches the application, as on a lost ACK.
      socket.write(
        `POST /gaia/v1/observations HTTP/1.1\r\nHost: localhost\r\nContent-Type: application/json\r\nContent-Length: ${Buffer.byteLength(body)}\r\n\r\n${body}`
      );
      await once(socket, "readable");
      socket.destroy();
    }
    await loseAck(packet);
    const inode = (await stat(path)).ino;
    const saved = JSON.parse(await readFile(path, "utf8")).devices.phone.measured;
    const [ackCode, ack] = await post("observations", packet);
    assert.equal(ackCode, 200);
    assert.equal(ack.acceptedAt, saved.acceptedAt);
    assert.equal((await stat(path)).ino, inode);
    const partial = connect({ ...options, host: endpoint.address, port: endpoint.port });
    await once(partial, "secureConnect");
    partial.write("POST /gaia/v1/observations HTTP/1.1\r\n");
    partial.on("error", (error) => assert.equal(error.code, "ECONNRESET"));
    const closed = new Promise((resolve) => partial.once("close", resolve));
    await stop();
    await closed;
    await start();
    assert.equal((await post("observations", packet))[1].error, "session_expired");
    const [, replacement] = await post("sessions", opening);
    assert.notEqual(replacement.sessionId, session.sessionId);
    const unconfirmed = JSON.stringify({ ...JSON.parse(packet), sessionId: replacement.sessionId });
    await loseAck(unconfirmed);
    assert.equal(
      JSON.parse(await readFile(path, "utf8")).devices.phone.measured.sessionId,
      replacement.sessionId
    );
    await stop();
    await start();
    assert.equal((await post("observations", unconfirmed))[1].error, "session_expired");
    assert.equal((await post("sessions", opening))[0], 201);
    for (const event of ["suspend", "resume"]) {
      const lines = createInterface({ input: child.stdout });
      const timeout = setTimeout(() => lines.close(), 15000);
      let received = false;
      try {
        child.stdin.write(event + "\n");
        for await (const line of lines)
          if (line === event) {
            received = true;
            break;
          }
        assert.ok(received);
      } finally {
        clearTimeout(timeout);
        lines.close();
      }
      if (event === "suspend") await assert.rejects(post("sessions", opening));
    }
    assert.equal((await post("sessions", opening))[0], 201);
    await stop();
    await start(false);
    await assert.rejects(post("sessions", opening), { code: "ECONNREFUSED" });
    console.info(
      "Electron mTLS publication, lost ACK, partial request shutdown and restart passed"
    );
  }
} finally {
  try {
    await stop();
  } finally {
    await rm(temp, { recursive: true, force: true });
  }
}
