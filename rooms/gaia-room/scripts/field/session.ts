import { createHash, randomUUID } from "node:crypto";
import {
  capabilityIds,
  intervalMs,
  observationPacketSchema,
  sessionOpenRequestSchema,
  timeoutMs,
  type Ack,
  type CapabilityId,
  type ObservationPacket,
  type SessionOpenResponse,
} from "../../../../gaia-protocol/v1/src/schema.ts";
import {
  duplicateCapabilities,
  missingCapabilityIds,
  samplesAfterSend,
  samplesOutsideAccepted,
  t1Accepted,
} from "../../../../gaia-protocol/v1/src/semantics.ts";
import type { PhysicalSessionContext, PhysicalSnapshotInput } from "../devices/physical.ts";
import type { World } from "../spatial/world.ts";
import type { PhysicalLiveProof } from "../storage/status-store.ts";

/**
 * B4 session state machine. It owns sequencing, ACK replay, timeout and the RAM-only
 * PhysicalLiveProof, but it never touches the filesystem or the network. B7 supplies the
 * trusted project transaction: authorization is re-read and the snapshot is published
 * inside the same project writer lock, so there is no verify-then-write window.
 */

export interface VerifiedClient {
  /** SHA-256 DER fingerprint resolved by the mTLS boundary, never from the JSON body. */
  fingerprint: string;
}

/** The narrow part of a B3 assignment that B4 pins for one session. */
export interface TrustedAssignment {
  projectId: string;
  deviceId: string;
  hardwareId: string;
  installationId: string;
  authorizationGeneration: number;
  statusEpoch: number;
  capabilities: readonly string[];
}

export interface SessionExpectation {
  projectId: string;
  deviceId: string;
  hardwareId?: string;
  installationId?: string;
  authorizationGeneration?: number;
  statusEpoch?: number;
}

export interface TrustedProjectTransaction {
  world: World;
  statusEpoch: number;
  assignment: TrustedAssignment;
  /**
   * Must call projectPhysicalSnapshot while the project writer lock is held and return the
   * resulting live proof. A rejection must not have published anything and must leave the
   * caller's previous proof and sequence untouched.
   */
  publish(
    input: PhysicalSnapshotInput,
    previousLive?: PhysicalLiveProof
  ): Promise<PhysicalLiveProof>;
}

export interface SessionAuthority {
  /**
   * Re-reads world.json and the current authorization under the project writer lock, then
   * runs work inside that lock. The adapter must throw AuthorizationError when the client
   * identity or the expected binding is no longer active, and must let the work error
   * propagate without publishing.
   */
  transact<T>(
    client: VerifiedClient,
    expected: SessionExpectation,
    work: (transaction: TrustedProjectTransaction) => Promise<T>
  ): Promise<T>;

  /**
   * Optional offline link publication after a live session is retired. The session is
   * already gone when this runs; failures must not keep it alive.
   */
  markOffline?(client: VerifiedClient, session: RetiredSession, at: number): Promise<void>;
}

export interface SessionClock {
  /** UTC Unix ms for diagnostics only; never used for ordering, age or timeout. */
  now(): number;
  /** Central monotonic milliseconds used for deadlines, waits and observation age. */
  monoMs(): number;
}

export interface SessionTimers {
  schedule(delayMs: number, callback: () => void): unknown;
  cancel(handle: unknown): void;
}

export type RetirementReason = "timeout" | "authorization" | "epoch" | "clock" | "shutdown";

export interface RetiredSession {
  sessionId: string;
  projectId: string;
  deviceId: string;
  hardwareId: string;
  installationId: string;
  authorizationGeneration: number;
  statusEpoch: number;
  runId: string;
  accepted: readonly CapabilityId[];
  lastSeq: number;
  lastAcceptedAt?: number;
  reason: RetirementReason;
}

export type SessionErrorCode =
  | "invalid_packet"
  | "not_authorized"
  | "session_busy"
  | "session_expired"
  | "sequence_conflict"
  | "unavailable";

export class SessionError extends Error {
  readonly code: SessionErrorCode;
  readonly retryAfterMs: number | undefined;

  constructor(
    code: SessionErrorCode,
    message: string,
    retryAfterMs?: number,
    options?: ErrorOptions
  ) {
    super(message, options);
    this.name = "SessionError";
    this.code = code;
    this.retryAfterMs = retryAfterMs;
  }
}

/** B7 throws this for a missing, revoked, rebound or stale authorization. */
export class AuthorizationError extends Error {
  constructor(message = "Gaia client authorization is not valid") {
    super(message);
    this.name = "AuthorizationError";
  }
}

export interface SessionInspection {
  sessionId: string;
  projectId: string;
  deviceId: string;
  hardwareId: string;
  installationId: string;
  runId: string;
  authorizationGeneration: number;
  statusEpoch: number;
  accepted: CapabilityId[];
  state: "awaiting-first" | "online";
  openedMonoMs: number;
  lastAcceptMonoMs: number;
  deadlineMonoMs: number;
  lastSeq: number;
  hasProof: boolean;
  proofIdentity?: string;
}

export interface SessionManagerOptions {
  authority: SessionAuthority;
  clock: SessionClock;
  timers: SessionTimers;
  maxSessions?: number;
}

export const systemClock: SessionClock = {
  now: () => Date.now(),
  monoMs: () => Math.floor(performance.now()),
};

export const systemTimers: SessionTimers = {
  schedule(delayMs, callback) {
    const handle = setTimeout(callback, delayMs);
    if (typeof handle === "object" && handle !== null && "unref" in handle)
      (handle as { unref: () => void }).unref();
    return handle;
  },
  cancel(handle) {
    clearTimeout(handle as ReturnType<typeof setTimeout>);
  },
};

class SerialQueue {
  private tail: Promise<void> = Promise.resolve();

  run<T>(work: () => Promise<T>): Promise<T> {
    const result = this.tail.then(work, work);
    this.tail = result.then(
      () => undefined,
      () => undefined
    );
    return result;
  }
}

interface Session {
  sessionId: string;
  clientFingerprint: string;
  projectId: string;
  deviceId: string;
  hardwareId: string;
  installationId: string;
  authorizationGeneration: number;
  statusEpoch: number;
  runId: string;
  accepted: CapabilityId[];
  state: "awaiting-first" | "online";
  openedMonoMs: number;
  lastAcceptMonoMs: number;
  deadlineMonoMs: number;
  previousResponseMonoMs: number;
  lastSeq: number;
  lastBodyHash: string | undefined;
  lastAck: Ack | undefined;
  lastSentMonoMs: number | undefined;
  lastAcceptedAt: number | undefined;
  proof: PhysicalLiveProof | undefined;
  timer: unknown;
  timerToken: number;
  inFlight: boolean;
  expiryPending: boolean;
  queue: SerialQueue;
}

const fingerprintPattern = /^[a-f0-9]{64}$/;

function assertFingerprint(client: VerifiedClient): void {
  if (typeof client.fingerprint !== "string" || !fingerprintPattern.test(client.fingerprint))
    throw new SessionError("not_authorized", "Invalid Gaia client identity");
}

function deviceKey(projectId: string, deviceId: string): string {
  return `${projectId}\0${deviceId}`;
}

function expectationOf(session: Session): SessionExpectation {
  return {
    projectId: session.projectId,
    deviceId: session.deviceId,
    hardwareId: session.hardwareId,
    installationId: session.installationId,
    authorizationGeneration: session.authorizationGeneration,
    statusEpoch: session.statusEpoch,
  };
}

function clientOf(session: Session): VerifiedClient {
  return { fingerprint: session.clientFingerprint };
}

export class SessionManager {
  private readonly sessions = new Map<string, Session>();
  private readonly byDevice = new Map<string, Session>();
  private readonly openQueue = new SerialQueue();
  private readonly pending = new Set<Promise<unknown>>();
  private readonly retirements = new Set<Promise<void>>();
  private readonly authority: SessionAuthority;
  private readonly clock: SessionClock;
  private readonly timers: SessionTimers;
  private readonly maxSessions: number;
  private lastMonoMs: number | undefined;
  private closed = false;
  private closing: Promise<void> | undefined;

  constructor(options: SessionManagerOptions) {
    this.authority = options.authority;
    this.clock = options.clock;
    this.timers = options.timers;
    this.maxSessions = options.maxSessions ?? 256;
    if (!Number.isSafeInteger(this.maxSessions) || this.maxSessions < 1)
      throw new Error("Invalid Gaia session limit");
  }

  async open(client: VerifiedClient, request: unknown): Promise<SessionOpenResponse> {
    this.assertOpen();
    assertFingerprint(client);
    const parsed = sessionOpenRequestSchema.safeParse(request);
    if (!parsed.success)
      throw new SessionError("invalid_packet", "Invalid Gaia session open request");
    const input = parsed.data;

    return await this.track(
      this.openQueue.run(async () => {
        this.assertOpen();
        const initialMono = this.readMono();
        this.reapExpired(initialMono);
        const key = deviceKey(input.projectId, input.deviceId);
        let resolved: { assignment: TrustedAssignment; accepted: CapabilityId[] };
        try {
          resolved = await this.authority.transact(
            client,
            { projectId: input.projectId, deviceId: input.deviceId },
            async (transaction) => {
              const { world, assignment } = transaction;
              if (
                world.id !== input.projectId ||
                assignment.projectId !== input.projectId ||
                assignment.deviceId !== input.deviceId ||
                assignment.installationId !== input.installationId
              )
                throw new AuthorizationError("Gaia session identity mismatch");
              const device = Object.hasOwn(world.devices, assignment.deviceId)
                ? world.devices[assignment.deviceId]
                : undefined;
              if (
                !device ||
                device.source !== "physical" ||
                device.hardwareId !== assignment.hardwareId
              )
                throw new AuthorizationError("Gaia session hardware mismatch");
              if (transaction.statusEpoch !== assignment.statusEpoch)
                throw new AuthorizationError("Gaia session epoch mismatch");
              if (
                !Number.isSafeInteger(assignment.authorizationGeneration) ||
                assignment.authorizationGeneration < 1 ||
                !Number.isSafeInteger(assignment.statusEpoch) ||
                assignment.statusEpoch < 0
              )
                throw new AuthorizationError("Gaia session authorization record is invalid");
              const accepted = t1Accepted(
                input.offered,
                device.capabilities,
                assignment.capabilities,
                capabilityIds
              ) as CapabilityId[];
              return { assignment, accepted };
            }
          );
        } catch (error) {
          throw this.authorityError(error);
        }

        this.assertOpen();
        const openedMono = this.readMono();
        const current = this.byDevice.get(key);
        if (current) {
          if (
            current.clientFingerprint !== client.fingerprint ||
            current.authorizationGeneration !== resolved.assignment.authorizationGeneration ||
            current.statusEpoch !== resolved.assignment.statusEpoch
          )
            this.expire(current, "authorization");
          else if (!current.inFlight && openedMono >= current.deadlineMonoMs)
            this.expire(current, "timeout");
          else
            throw new SessionError(
              "session_busy",
              "Gaia session is busy",
              Math.max(1, current.deadlineMonoMs - openedMono)
            );
        }
        if (this.sessions.size >= this.maxSessions)
          throw new SessionError("unavailable", "Gaia session capacity is exhausted");

        const session = this.createSession(
          client,
          input.runId,
          resolved.assignment,
          resolved.accepted,
          openedMono
        );
        return {
          v: 1 as const,
          sessionId: session.sessionId,
          accepted: [...session.accepted],
          intervalMs,
          timeoutMs,
        };
      })
    );
  }

  async observe(client: VerifiedClient, body: string, packetInput: unknown): Promise<Ack> {
    this.assertOpen();
    assertFingerprint(client);
    if (typeof body !== "string")
      throw new SessionError("invalid_packet", "Invalid Gaia observation body");
    const parsed = observationPacketSchema.safeParse(packetInput);
    if (!parsed.success)
      throw new SessionError("invalid_packet", "Invalid Gaia observation packet");
    const packet = parsed.data;
    const session = this.sessions.get(packet.sessionId);
    if (!session) throw new SessionError("session_expired", "Gaia session is not active");
    if (session.clientFingerprint !== client.fingerprint)
      throw new SessionError("not_authorized", "Gaia session belongs to another client");
    const hash = createHash("sha256").update(body, "utf8").digest("hex");
    return await this.track(
      session.queue.run(async () => await this.observeSerial(session, client, hash, packet))
    );
  }

  bindingFor(fingerprint: string, sessionId: string): SessionExpectation | undefined {
    const session = this.sessions.get(sessionId);
    return session?.clientFingerprint === fingerprint ? expectationOf(session) : undefined;
  }

  hasDevice(projectId: string, deviceId: string): boolean {
    return this.byDevice.has(deviceKey(projectId, deviceId));
  }

  retireClient(fingerprint: string): void {
    for (const session of this.sessions.values()) {
      if (session.clientFingerprint === fingerprint) this.expire(session, "authorization");
    }
  }

  inspect(sessionId: string): SessionInspection | undefined {
    const session = this.sessions.get(sessionId);
    if (!session) return undefined;
    return {
      sessionId: session.sessionId,
      projectId: session.projectId,
      deviceId: session.deviceId,
      hardwareId: session.hardwareId,
      installationId: session.installationId,
      runId: session.runId,
      authorizationGeneration: session.authorizationGeneration,
      statusEpoch: session.statusEpoch,
      accepted: [...session.accepted],
      state: session.state,
      openedMonoMs: session.openedMonoMs,
      lastAcceptMonoMs: session.lastAcceptMonoMs,
      deadlineMonoMs: session.deadlineMonoMs,
      lastSeq: session.lastSeq,
      hasProof: session.proof !== undefined,
      ...(session.proof === undefined ? {} : { proofIdentity: session.proof.identity }),
    };
  }

  activeCount(): number {
    return this.sessions.size;
  }

  async sweep(): Promise<void> {
    this.assertOpen();
    for (const session of [...this.sessions.values()]) {
      if (!session.inFlight) this.expireIfDue(session);
    }
    await this.settled();
  }

  async retireProject(
    projectId: string,
    reason: RetirementReason = "authorization"
  ): Promise<void> {
    for (const session of [...this.sessions.values()]) {
      if (session.projectId === projectId) this.expire(session, reason);
    }
    await this.settled();
  }

  async retireDevice(
    projectId: string,
    deviceId: string,
    reason: RetirementReason = "authorization"
  ): Promise<void> {
    for (const session of [...this.sessions.values()]) {
      if (session.projectId === projectId && session.deviceId === deviceId)
        this.expire(session, reason);
    }
    await this.settled();
  }

  async handleClockDiscontinuity(): Promise<void> {
    this.retireAll("clock");
    this.lastMonoMs = undefined;
    await this.settled();
  }

  async settled(): Promise<void> {
    while (this.retirements.size > 0) await Promise.allSettled([...this.retirements]);
  }

  closeAll(): Promise<void> {
    if (this.closing) return this.closing;
    this.closed = true;
    for (const session of [...this.sessions.values()]) {
      this.sessions.delete(session.sessionId);
      const key = deviceKey(session.projectId, session.deviceId);
      if (this.byDevice.get(key) === session) this.byDevice.delete(key);
      this.cancelTimer(session);
      session.proof = undefined;
      session.lastAck = undefined;
      session.lastBodyHash = undefined;
    }
    this.lastMonoMs = undefined;
    this.closing = Promise.allSettled([...this.pending]).then(() => this.settled());
    return this.closing;
  }

  private createSession(
    client: VerifiedClient,
    runId: string,
    assignment: TrustedAssignment,
    accepted: CapabilityId[],
    openedMono: number
  ): Session {
    const session: Session = {
      sessionId: randomUUID(),
      clientFingerprint: client.fingerprint,
      projectId: assignment.projectId,
      deviceId: assignment.deviceId,
      hardwareId: assignment.hardwareId,
      installationId: assignment.installationId,
      authorizationGeneration: assignment.authorizationGeneration,
      statusEpoch: assignment.statusEpoch,
      runId,
      accepted: [...accepted],
      state: "awaiting-first",
      openedMonoMs: openedMono,
      lastAcceptMonoMs: openedMono,
      deadlineMonoMs: openedMono + timeoutMs,
      previousResponseMonoMs: openedMono,
      lastSeq: 0,
      lastBodyHash: undefined,
      lastAck: undefined,
      lastSentMonoMs: undefined,
      lastAcceptedAt: undefined,
      proof: undefined,
      timer: undefined,
      timerToken: 0,
      inFlight: false,
      expiryPending: false,
      queue: new SerialQueue(),
    };
    this.sessions.set(session.sessionId, session);
    this.byDevice.set(deviceKey(session.projectId, session.deviceId), session);
    this.schedule(session, openedMono);
    return session;
  }

  private async observeSerial(
    session: Session,
    client: VerifiedClient,
    hash: string,
    packet: ObservationPacket
  ): Promise<Ack> {
    if (this.sessions.get(session.sessionId) !== session)
      throw new SessionError("session_expired", "Gaia session is not active");
    session.inFlight = true;
    try {
      const mono = this.readMono();
      if (mono >= session.deadlineMonoMs) {
        this.expire(session, "timeout");
        throw new SessionError("session_expired", "Gaia session timed out");
      }

      if (session.lastSeq === 0) {
        if (packet.seq !== 1)
          throw new SessionError("sequence_conflict", "Gaia first observation must use seq 1");
      } else if (packet.seq === session.lastSeq) {
        if (hash !== session.lastBodyHash)
          throw new SessionError(
            "sequence_conflict",
            "Gaia observation body changed at the same seq"
          );
        await this.verifyReplay(session, client);
        const after = this.readMono();
        if (after >= session.deadlineMonoMs) {
          this.expire(session, "timeout");
          throw new SessionError("session_expired", "Gaia session timed out");
        }
        if (!session.lastAck)
          throw new SessionError("session_expired", "Gaia ACK is not available");
        return { ...session.lastAck };
      } else if (packet.seq < session.lastSeq) {
        throw new SessionError("sequence_conflict", "Gaia observation seq is old");
      } else if (packet.seq > session.lastSeq + 1) {
        throw new SessionError("sequence_conflict", "Gaia observation seq has a gap");
      }

      this.validatePacket(session, packet);
      return await this.acceptNew(session, client, hash, packet);
    } finally {
      session.inFlight = false;
      if (session.expiryPending) {
        session.expiryPending = false;
        this.expireIfDue(session);
      }
    }
  }

  private validatePacket(session: Session, packet: ObservationPacket): void {
    if (duplicateCapabilities(packet.samples.map((sample) => sample.id)).length > 0)
      throw new SessionError(
        "invalid_packet",
        "Gaia observation packet has duplicate capabilities"
      );
    if (samplesOutsideAccepted(packet, session.accepted).length > 0)
      throw new SessionError(
        "invalid_packet",
        "Gaia observation packet has a sample outside accepted capabilities"
      );
    if (missingCapabilityIds(packet, session.accepted).length > 0)
      throw new SessionError(
        "invalid_packet",
        "Gaia observation packet does not cover accepted capabilities"
      );
    if (samplesAfterSend(packet).length > 0)
      throw new SessionError(
        "invalid_packet",
        "Gaia observation packet has a sample after send time"
      );
    if (session.lastSentMonoMs !== undefined && packet.sentMonoMs < session.lastSentMonoMs)
      throw new SessionError("invalid_packet", "Gaia observation send time regressed");
  }

  private async acceptNew(
    session: Session,
    client: VerifiedClient,
    hash: string,
    packet: ObservationPacket
  ): Promise<Ack> {
    let accepted: { acceptedAt: number; acceptedMonoMs: number; proof: PhysicalLiveProof };
    try {
      accepted = await this.authority.transact(
        client,
        expectationOf(session),
        async (transaction) => {
          if (this.sessions.get(session.sessionId) !== session)
            throw new SessionError("session_expired", "Gaia session is not active");
          this.assertTransaction(session, transaction);
          const acceptedMonoMs = this.readMono();
          const acceptedAt = this.readWall();
          if (acceptedMonoMs >= session.deadlineMonoMs) {
            this.expire(session, "timeout");
            throw new SessionError("session_expired", "Gaia session timed out");
          }
          const context: PhysicalSessionContext = {
            deviceId: session.deviceId,
            hardwareId: session.hardwareId,
            installationId: session.installationId,
            authorizationGeneration: session.authorizationGeneration,
            runId: session.runId,
            sessionId: session.sessionId,
            accepted: [...session.accepted],
            acceptedAt,
            acceptedMonoMs,
            previousResponseMonoMs: session.previousResponseMonoMs,
          };
          const proof = await transaction.publish({ context, packet }, session.proof);
          return { acceptedAt, acceptedMonoMs, proof };
        }
      );
    } catch (error) {
      if (error instanceof SessionError) throw error;
      if (error instanceof AuthorizationError) {
        this.expire(session, "authorization");
        throw new SessionError("not_authorized", "Gaia client authorization changed", undefined, {
          cause: error,
        });
      }
      throw new SessionError("unavailable", "Gaia observation publish failed", undefined, {
        cause: error,
      });
    }

    if (this.sessions.get(session.sessionId) !== session)
      throw new SessionError("session_expired", "Gaia session is not active");
    const ackMono = this.readMono();
    const ack: Ack = {
      v: 1,
      sessionId: session.sessionId,
      seq: packet.seq,
      acceptedAt: accepted.acceptedAt,
    };
    session.lastSeq = packet.seq;
    session.lastBodyHash = hash;
    session.lastAck = ack;
    session.lastSentMonoMs = packet.sentMonoMs;
    session.lastAcceptMonoMs = accepted.acceptedMonoMs;
    session.deadlineMonoMs = accepted.acceptedMonoMs + timeoutMs;
    session.previousResponseMonoMs = ackMono;
    session.lastAcceptedAt = accepted.acceptedAt;
    session.proof = accepted.proof;
    session.state = "online";
    if (ackMono >= session.deadlineMonoMs) {
      this.expire(session, "timeout");
      throw new SessionError("session_expired", "Gaia session timed out after publication");
    }
    this.schedule(session, ackMono);
    return { ...ack };
  }

  private async verifyReplay(session: Session, client: VerifiedClient): Promise<void> {
    try {
      await this.authority.transact(client, expectationOf(session), async (transaction) => {
        if (this.sessions.get(session.sessionId) !== session)
          throw new SessionError("session_expired", "Gaia session is not active");
        this.assertTransaction(session, transaction);
      });
    } catch (error) {
      if (error instanceof SessionError) throw error;
      if (error instanceof AuthorizationError) {
        this.expire(session, "authorization");
        throw new SessionError("not_authorized", "Gaia client authorization changed", undefined, {
          cause: error,
        });
      }
      throw new SessionError("unavailable", "Gaia authorization check failed", undefined, {
        cause: error,
      });
    }
  }

  private assertTransaction(session: Session, transaction: TrustedProjectTransaction): void {
    const assignment = transaction.assignment;
    if (
      transaction.world.id !== session.projectId ||
      assignment.projectId !== session.projectId ||
      assignment.deviceId !== session.deviceId ||
      assignment.hardwareId !== session.hardwareId ||
      assignment.installationId !== session.installationId ||
      assignment.authorizationGeneration !== session.authorizationGeneration ||
      assignment.statusEpoch !== session.statusEpoch ||
      transaction.statusEpoch !== session.statusEpoch
    )
      throw new AuthorizationError("Gaia session binding changed");
    const device = Object.hasOwn(transaction.world.devices, session.deviceId)
      ? transaction.world.devices[session.deviceId]
      : undefined;
    if (!device || device.source !== "physical" || device.hardwareId !== session.hardwareId)
      throw new AuthorizationError("Gaia session hardware changed");
    if (
      !session.accepted.every(
        (id) => assignment.capabilities.includes(id) && device.capabilities.includes(id)
      )
    )
      throw new AuthorizationError("Gaia session capability changed");
  }

  private authorityError(error: unknown): SessionError {
    if (error instanceof SessionError) return error;
    if (error instanceof AuthorizationError)
      return new SessionError("not_authorized", "Gaia client is not authorized", undefined, {
        cause: error,
      });
    return new SessionError("unavailable", "Gaia authorization check failed", undefined, {
      cause: error,
    });
  }

  private readMono(): number {
    const mono = this.clock.monoMs();
    if (!Number.isSafeInteger(mono) || mono < 0 || mono > Number.MAX_SAFE_INTEGER - timeoutMs) {
      this.retireAll("clock");
      throw new SessionError("unavailable", "Invalid Gaia monotonic clock");
    }
    if (this.lastMonoMs !== undefined && mono < this.lastMonoMs) {
      this.retireAll("clock");
      throw new SessionError("unavailable", "Gaia monotonic clock regressed");
    }
    this.lastMonoMs = mono;
    return mono;
  }

  private readWall(): number {
    const wall = this.clock.now();
    if (!Number.isSafeInteger(wall) || wall <= 0)
      throw new SessionError("unavailable", "Invalid Gaia wall clock");
    return wall;
  }

  private schedule(session: Session, nowMono: number): void {
    if (this.closed) return;
    this.cancelTimer(session);
    const token = session.timerToken;
    const delay = Math.max(0, session.deadlineMonoMs - nowMono);
    session.timer = this.timers.schedule(delay, () => {
      if (this.sessions.get(session.sessionId) !== session || session.timerToken !== token) return;
      if (session.inFlight) {
        session.expiryPending = true;
        return;
      }
      this.expireIfDue(session);
    });
  }

  private cancelTimer(session: Session): void {
    if (session.timer !== undefined) {
      this.timers.cancel(session.timer);
      session.timer = undefined;
    }
    session.timerToken++;
  }

  private expireIfDue(session: Session): void {
    if (this.sessions.get(session.sessionId) !== session) return;
    let mono: number;
    try {
      mono = this.readMono();
    } catch {
      this.retireAll("clock");
      return;
    }
    if (mono >= session.deadlineMonoMs) this.expire(session, "timeout");
    else this.schedule(session, mono);
  }

  private reapExpired(mono: number): void {
    for (const session of [...this.sessions.values()]) {
      if (!session.inFlight && mono >= session.deadlineMonoMs) this.expire(session, "timeout");
    }
  }

  private expire(session: Session, reason: RetirementReason): void {
    if (this.sessions.get(session.sessionId) !== session) return;
    this.sessions.delete(session.sessionId);
    const key = deviceKey(session.projectId, session.deviceId);
    if (this.byDevice.get(key) === session) this.byDevice.delete(key);
    this.cancelTimer(session);

    const retired: RetiredSession = {
      sessionId: session.sessionId,
      projectId: session.projectId,
      deviceId: session.deviceId,
      hardwareId: session.hardwareId,
      installationId: session.installationId,
      authorizationGeneration: session.authorizationGeneration,
      statusEpoch: session.statusEpoch,
      runId: session.runId,
      accepted: [...session.accepted],
      lastSeq: session.lastSeq,
      reason,
      ...(session.lastAcceptedAt === undefined ? {} : { lastAcceptedAt: session.lastAcceptedAt }),
    };
    const online = session.state === "online";
    session.proof = undefined;
    session.lastAck = undefined;
    session.lastBodyHash = undefined;

    const markOffline = this.authority.markOffline;
    if (!online || reason === "shutdown" || markOffline === undefined) return;
    let at: number;
    try {
      at = this.readWall();
    } catch {
      return;
    }
    const task: Promise<void> = Promise.resolve()
      .then(() => markOffline.call(this.authority, clientOf(session), retired, at))
      .catch(() => undefined)
      .finally(() => {
        this.retirements.delete(task);
      });
    this.retirements.add(task);
  }

  private retireAll(reason: RetirementReason): void {
    for (const session of [...this.sessions.values()]) this.expire(session, reason);
  }

  private track<T>(promise: Promise<T>): Promise<T> {
    this.pending.add(promise);
    void promise.then(
      () => {
        this.pending.delete(promise);
      },
      () => {
        this.pending.delete(promise);
      }
    );
    return promise;
  }

  private assertOpen(): void {
    if (this.closed) throw new SessionError("unavailable", "Gaia session manager is closed");
  }
}
