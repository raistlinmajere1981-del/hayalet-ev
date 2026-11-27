import { join } from "node:path";
import { FieldAuthorizationDenied } from "./enrollment.ts";
import { sha256 } from "./certificates.ts";
import {
  AuthorizationError,
  SessionManager,
  type SessionAuthority,
  type SessionClock,
  type SessionTimers,
  type TrustedProjectTransaction,
} from "./session.ts";
import type { openFieldAuthority } from "../storage/enrollment-service.ts";
import { resolveActiveAssignment, resolveVerifiedAssignment } from "../storage/enrollment-store.ts";
import { serialized } from "../storage/files.ts";
import { readDocument, projectDirectory } from "../storage/project-document.ts";
import {
  deviceStatusIdentity,
  projectPhysicalSnapshot,
  projectPhysicalOffline,
} from "../storage/status-store.ts";
import { RequestError, type decodeFieldBody } from "./request.ts";

type Owner = Awaited<ReturnType<typeof openFieldAuthority>>;
class LockedClient {
  constructor(
    readonly fingerprint: string,
    readonly transaction: TrustedProjectTransaction
  ) {}
}

export function fieldIngest(
  root: string,
  owner: Owner,
  clock: SessionClock,
  timers: SessionTimers
) {
  let offlinePending = 0;
  const authority: SessionAuthority = {
    async transact(client, expected, work) {
      if (!(client instanceof LockedClient)) throw new AuthorizationError();
      const { assignment } = client.transaction;
      if (
        assignment.projectId !== expected.projectId ||
        assignment.deviceId !== expected.deviceId ||
        (expected.statusEpoch !== undefined && assignment.statusEpoch !== expected.statusEpoch) ||
        (expected.authorizationGeneration !== undefined &&
          assignment.authorizationGeneration !== expected.authorizationGeneration)
      )
        throw new AuthorizationError();
      return work(client.transaction);
    },
    async markOffline(client, retired, at) {
      if (offlinePending >= 256) return;
      offlinePending++;
      try {
        const dir = await projectDirectory(root, retired.projectId);
        await serialized(dir, async () => {
          if (sessions.hasDevice(retired.projectId, retired.deviceId)) return;
          const { world, statusEpoch = 0 } = await readDocument(
            join(dir, "world.json"),
            retired.projectId
          );
          const active = await resolveVerifiedAssignment(
            root,
            world,
            statusEpoch,
            client.fingerprint,
            retired
          );
          if (
            active?.deviceId === retired.deviceId &&
            active.hardwareId === retired.hardwareId &&
            active.installationId === retired.installationId
          )
            await projectPhysicalOffline(dir, world, statusEpoch, retired, at);
        });
      } finally {
        offlinePending--;
      }
    },
  };
  const sessions = new SessionManager({ authority, clock, timers });
  return {
    sessions,
    pendingOffline: () => offlinePending,
    async accept(
      peerDer: Buffer,
      open: boolean,
      decoded: ReturnType<typeof decodeFieldBody>,
      checkLive: () => void,
      checkIdentity: () => Promise<void>
    ) {
      const fingerprint = sha256(peerDer);
      const route = await resolveActiveAssignment(root, fingerprint);
      const { packet, body } = decoded;
      const sessionId =
        !open &&
        packet &&
        typeof packet === "object" &&
        "sessionId" in packet &&
        typeof packet.sessionId === "string"
          ? packet.sessionId
          : "";
      const pinned = sessions.bindingFor(fingerprint, sessionId);
      try {
        if (!route) throw new FieldAuthorizationDenied();
        // Only the ledger chooses a directory. The same lock covers B4's ACK cache
        // update, even on replay, and serializes local revocation and inventory edits.
        return await owner.withVerifiedClient(
          route.projectId,
          peerDer,
          pinned ?? {},
          async (world, epoch, assignment) => {
            await checkIdentity();
            checkLive();
            const client = new LockedClient(fingerprint, {
              world,
              statusEpoch: epoch,
              assignment,
              async publish(input, previousLive) {
                checkLive();
                const dir = join(root, "projects", world.id);
                const rows = await projectPhysicalSnapshot(dir, world, epoch, input, previousLive);
                return {
                  identity: deviceStatusIdentity(world, epoch),
                  status: rows[input.context.deviceId]!,
                };
              },
            });
            return open ? sessions.open(client, packet) : sessions.observe(client, body, packet);
          }
        );
      } catch (error) {
        if (!(error instanceof FieldAuthorizationDenied)) throw error;
        sessions.retireClient(fingerprint);
        throw new RequestError("not_authorized");
      }
    },
  };
}
