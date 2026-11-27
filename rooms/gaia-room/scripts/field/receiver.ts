import { constants, X509Certificate } from "node:crypto";
import { createServer as createHttpsServer } from "node:https";
import { createServer as createTcpServer, isIP, type Socket } from "node:net";
import { TLSSocket } from "node:tls";
import type { IncomingMessage, ServerResponse } from "node:http";
import { httpsHost, sha256 } from "./certificates.ts";
import { openFieldAuthority } from "../storage/enrollment-service.ts";
import { readFieldServerIdentity } from "../storage/field-trust.ts";
import { fieldIngest } from "./receiver-authority.ts";
import { readFieldBody, reply, replyError, RequestError } from "./request.ts";
import { systemClock, systemTimers } from "./session.ts";

export interface FieldEndpoint {
  address: string;
  port: number;
  origin: string;
}

export function validateEndpoint({ address, port, origin }: FieldEndpoint) {
  httpsHost(origin);
  const ip = isIP(address);
  const ipv6 = ip === 6 ? new URL("http://[" + address.split("%")[0] + "]").hostname : undefined;
  if (
    !ip ||
    address === "0.0.0.0" ||
    ipv6 === "[::]" ||
    ipv6 === "[::ffff:0:0]" ||
    !Number.isInteger(port) ||
    port < 1 ||
    port > 65535 ||
    port !== Number(new URL(origin).port || 443)
  )
    throw new Error("Select an explicit Gaia field interface, port and matching HTTPS origin");
}

const maxConnections = 16;
const phaseMs = 5000;
const requestMs = 10000;
const headerBytes = 8192;
const maxRateKeys = 512;

class Rates {
  private readonly ips = new Map<string, number[]>();
  private readonly clients = new Map<string, { credit: number; at: number }>();

  allowIp(ip: string, now: number) {
    if (this.ips.size >= maxRateKeys) {
      for (const [key, times] of this.ips)
        if (times[times.length - 1]! <= now - 60000) this.ips.delete(key);
    }
    const recent = this.ips.get(ip)?.filter((at) => at > now - 60000) ?? [];
    if (recent.length >= 30 || (!recent.length && this.ips.size >= maxRateKeys)) return false;
    recent.push(now);
    this.ips.set(ip, recent);
    return true;
  }

  takeClient(id: string, now: number) {
    if (this.clients.size >= maxRateKeys) {
      for (const [key, entry] of this.clients)
        if (entry.at <= now - 15000) this.clients.delete(key);
    }
    const bucket = this.clients.get(id);
    if (!bucket && this.clients.size >= maxRateKeys) throw new RequestError("unavailable");
    const credit = bucket ? Math.min(15000, bucket.credit + Math.max(0, now - bucket.at)) : 15000;
    if (credit < 5000) throw new RequestError("rate_limited", 5000 - credit);
    this.clients.set(id, { credit: credit - 5000, at: now });
  }
}

function socketKey(socket: Socket) {
  return socket.remoteAddress + "/" + socket.remotePort;
}

function rejectHeader(socket: TLSSocket, large: boolean) {
  if (socket.writableEnded) return;
  const body = JSON.stringify({ v: 1, error: large ? "too_large" : "invalid_packet" });
  socket.end(
    `HTTP/1.1 ${large ? "413 Payload Too Large" : "400 Bad Request"}\r\nConnection: close\r\nCache-Control: no-store\r\nContent-Type: application/json\r\nContent-Length: ${body.length}\r\n\r\n${body}`
  );
}

// The outer TCP listener enforces admission before OpenSSL allocates a handshake.
// Only its mutually authenticated TLS sockets reach Node's HTTP parser.
export async function listenField(
  root: string,
  endpoint: FieldEndpoint,
  clock = systemClock,
  timers = systemTimers
) {
  validateEndpoint(endpoint);
  const owner = await openFieldAuthority(root, { certificatesRequired: true });
  try {
    const identity = await readFieldServerIdentity(root, endpoint.origin);
    const validity = [new X509Certificate(identity.cert), new X509Certificate(identity.ca)];
    const from = Math.max(...validity.map((cert) => Date.parse(cert.validFrom)));
    const to = Math.min(...validity.map((cert) => Date.parse(cert.validTo)));
    const ingest = fieldIngest(root, owner, clock, timers);
    const pending = new Set<Promise<void>>();
    const flights = new Set<string>();
    const rates = new Rates();
    const sockets = new Map<
      string,
      { socket: Socket; phase: NodeJS.Timeout; deadline: number; used: boolean }
    >();
    const wallOffset = clock.now() - clock.monoMs();
    let invalidated = false;
    let closing: Promise<void> | undefined;

    function invalidate(discontinuity = false) {
      if (invalidated) return;
      invalidated = true;
      for (const { socket } of sockets.values()) socket.destroy();
      if (discontinuity) void ingest.sessions.handleClockDiscontinuity();
      void ingest.sessions.closeAll();
    }
    function checkClock() {
      const now = clock.now();
      const mono = clock.monoMs();
      if (
        !Number.isSafeInteger(now) ||
        !Number.isSafeInteger(mono) ||
        now < from ||
        now > to ||
        Math.abs(now - mono - wallOffset) > 1000
      )
        invalidate(true);
      if (closing || invalidated) throw new RequestError("unavailable");
    }
    async function checkIdentity() {
      checkClock();
      try {
        const current = await readFieldServerIdentity(root, endpoint.origin);
        if (current.fingerprint !== identity.fingerprint || current.ca !== identity.ca)
          invalidate();
      } catch (error) {
        invalidate();
        throw error;
      }
      checkClock();
    }

    async function serve(req: IncomingMessage, res: ServerResponse) {
      const socket = req.socket;
      if (!(socket instanceof TLSSocket) || !socket.authorized || socket.isSessionReused()) {
        socket.destroy();
        return;
      }
      const state = sockets.get(socketKey(socket));
      if (socket.writableEnded) return;
      if (!state || state.used || invalidated || closing) {
        socket.destroy();
        return;
      }
      const { deadline } = state;
      state.used = true;
      clearTimeout(state.phase);
      state.phase = setTimeout(() => socket.destroy(), phaseMs);
      const peer = socket.getPeerCertificate().raw;
      if (!peer?.length) throw new RequestError("not_authorized");
      const fingerprint = sha256(peer);
      rates.takeClient(fingerprint, clock.monoMs());
      const open = req.url === "/gaia/v1/sessions";
      if (!open && req.url !== "/gaia/v1/observations") {
        reply(res, 404);
        return;
      }
      if (req.method !== "POST") {
        res.setHeader("allow", "POST");
        reply(res, 405);
        return;
      }
      if (flights.has(fingerprint)) throw new RequestError("unavailable");
      flights.add(fingerprint);
      try {
        const decoded = await readFieldBody(req);
        clearTimeout(state.phase);
        function checkLive() {
          checkClock();
          if (socket.destroyed || performance.now() >= deadline)
            throw new RequestError("unavailable");
        }
        checkLive();
        const result = await ingest.accept(peer, open, decoded, checkLive, checkIdentity);
        reply(res, open ? 201 : 200, result);
      } finally {
        flights.delete(fingerprint);
      }
    }

    const https = createHttpsServer({
      key: identity.key,
      cert: identity.cert,
      ca: identity.ca,
      requestCert: true,
      rejectUnauthorized: true,
      minVersion: "TLSv1.2",
      maxVersion: "TLSv1.3",
      ciphers:
        "TLS_AES_256_GCM_SHA384:TLS_CHACHA20_POLY1305_SHA256:TLS_AES_128_GCM_SHA256:ECDHE-ECDSA-AES128-GCM-SHA256:ECDHE-ECDSA-AES256-GCM-SHA384:ECDHE-ECDSA-CHACHA20-POLY1305",
      secureOptions: constants.SSL_OP_NO_TICKET | constants.SSL_OP_NO_RENEGOTIATION,
      handshakeTimeout: phaseMs,
      maxHeaderSize: headerBytes,
      insecureHTTPParser: false,
    });
    function dispatch(req: IncomingMessage, res: ServerResponse) {
      if (pending.size >= maxConnections) {
        replyError(res, new RequestError("unavailable"));
        return;
      }
      const task = serve(req, res).catch((error) => replyError(res, error));
      pending.add(task);
      void task.finally(() => pending.delete(task));
    }
    https.maxRequestsPerSocket = 1;
    https.on("request", dispatch);
    https.on("checkContinue", dispatch);
    https.on("checkExpectation", dispatch);
    https.on("dropRequest", (_req, socket) => socket.destroy());
    https.on("clientError", (err, socket) => {
      if (socket.writableEnded) return;
      if (
        !(socket instanceof TLSSocket) ||
        !socket.authorized ||
        sockets.get(socketKey(socket))?.used ||
        !socket.writable
      ) {
        socket.destroy();
        return;
      }
      const large = "code" in err && err.code === "HPE_HEADER_OVERFLOW";
      rejectHeader(socket, large);
    });
    https.on("secureConnection", (socket: TLSSocket) => {
      const state = sockets.get(socketKey(socket));
      if (!state || !socket.authorized || socket.isSessionReused()) {
        socket.destroy();
        return;
      }
      socket.disableRenegotiation();
      clearTimeout(state.phase);
      state.phase = setTimeout(() => socket.destroy(), phaseMs);
      // llhttp's maxHeaderSize does not charge every delimiter or whitespace byte.
      let count = 0,
        tail = 0;
      function countHeader(data: Buffer) {
        for (const byte of data) {
          if (++count > headerBytes) {
            socket.off("data", countHeader);
            rejectHeader(socket, true);
            return;
          }
          tail = ((tail << 8) | byte) >>> 0;
          if (tail === 0x0d0a0d0a) {
            socket.off("data", countHeader);
            return;
          }
        }
      }
      socket.prependListener("data", countHeader);
    });
    const server = createTcpServer((socket) => {
      const ip = socket.remoteAddress;
      if (closing || invalidated || !ip || !rates.allowIp(ip, clock.monoMs())) {
        socket.destroy();
        return;
      }
      const key = socketKey(socket);
      const total = setTimeout(() => socket.destroy(), requestMs);
      const state = {
        socket,
        phase: setTimeout(() => socket.destroy(), phaseMs),
        deadline: performance.now() + requestMs,
        used: false,
      };
      sockets.set(key, state);
      socket.once("close", () => {
        clearTimeout(total);
        clearTimeout(state.phase);
        if (sockets.get(key) === state) sockets.delete(key);
      });
      https.emit("connection", socket);
    });
    server.maxConnections = maxConnections;
    await new Promise<void>((resolve, reject) => {
      server.once("error", reject);
      server.listen(
        { host: endpoint.address, port: endpoint.port, backlog: maxConnections },
        () => {
          server.off("error", reject);
          server.on("error", () => invalidate());
          resolve();
        }
      );
    });
    return {
      checkIdentity,
      status: () => ({
        listening: !invalidated && !closing,
        connections: sockets.size,
        pending: pending.size,
        pendingOffline: ingest.pendingOffline(),
        sessions: ingest.sessions.activeCount(),
      }),
      enroll: async (pkg: unknown) => (await owner.enrollLocalInstallation(pkg)).assignment.id,
      complete: async (assignmentId: string, operationId: string) => {
        await owner.enrollmentCommand({ action: "complete", assignmentId, operationId });
      },
      revoke: async (assignmentId: string, operationId: string) => {
        const { assignment } = await owner.enrollmentCommand({
          action: "revoke",
          assignmentId,
          operationId,
        });
        ingest.sessions.retireClient(assignment.fingerprint);
      },
      close() {
        if (closing) return closing;
        const stopped = new Promise<void>((resolve) => server.close(() => resolve()));
        invalidate();
        const drained = ingest.sessions.closeAll();
        closing = Promise.allSettled([stopped, drained, ...pending]).then(() => owner.close());
        return closing;
      },
    };
  } catch (error) {
    await owner.close();
    throw error;
  }
}
