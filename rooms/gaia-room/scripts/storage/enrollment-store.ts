import { join } from "node:path";
import { lstat, mkdir, realpath } from "node:fs/promises";
import {
  emptyAuthorizationStore,
  parseAuthorizationStore,
  reconcileAuthorizationAssignments,
  resolveActiveAssignmentFromStore,
  revokeAuthorization,
  revocationTarget,
  serializeAuthorizationStore,
  verifyActiveAssignment,
  type AuthorizationAssignment,
  type AuthorizationStore,
  type VerifyAuthorizationExpectation,
} from "../field/enrollment.ts";
import type { World } from "../spatial/world.ts";
import {
  acquireDirectoryLock,
  directory,
  hasCode,
  publish,
  readRegular,
  serialized,
} from "./files.ts";

export function authorizationStorePath(storageRoot: string): string {
  return join(storageRoot, "field", "authorization.json");
}

export async function privatePath(path: string, isDirectory: boolean) {
  const stat = await lstat(path);
  if (
    (isDirectory ? !stat.isDirectory() : !stat.isFile() || stat.nlink !== 1) ||
    (process.getuid && (stat.uid !== process.getuid() || (stat.mode & 0o077) !== 0))
  )
    throw new Error("Unsafe Gaia authorization path");
}

export async function trustedFieldRoot(root: string) {
  if ((await realpath(root)) !== root) throw new Error("Unsafe Gaia storage root");
  await privatePath(root, true);
}

async function fieldPathsPresent(root: string) {
  const existing = await Promise.all(
    [join(root, ".field-provisioned"), join(root, "field")].map((path) =>
      lstat(path).catch((error: unknown) => {
        if (hasCode(error, "ENOENT")) return undefined;
        throw error;
      })
    )
  );
  return existing.some(Boolean);
}

// A partial first write must stay visible as existing history, never be mistaken for a virgin center.
export async function fieldStoragePresent(root: string) {
  await trustedFieldRoot(root);
  return fieldPathsPresent(root);
}

// Hold one center owner through the complete first provisioning transaction.
// A failure after the first write leaves history present, never a resettable virgin center.
export async function initializeAuthorizationStore<T>(
  root: string,
  before: () => Promise<void>,
  after: () => Promise<T>
): Promise<T> {
  await trustedFieldRoot(root);
  if (await fieldPathsPresent(root))
    throw Object.assign(new Error("Gaia field storage already exists"), { code: "EEXIST" });
  const release = await acquireDirectoryLock(root, true);
  try {
    if (await fieldPathsPresent(root))
      throw Object.assign(new Error("Gaia field storage already exists"), { code: "EEXIST" });
    await before();
    await mkdir(join(root, ".field-provisioned"), { mode: 0o700 });
    await mkdir(join(root, "field"), { mode: 0o700 });
    await publish(
      authorizationStorePath(root),
      serializeAuthorizationStore(emptyAuthorizationStore())
    );
    return await after();
  } finally {
    await release();
  }
}

export async function provisionAuthorizationStore(root: string) {
  return initializeAuthorizationStore(
    root,
    async () => {},
    async () => {}
  );
}

export async function readAuthorizationStore(storageRoot: string): Promise<AuthorizationStore> {
  try {
    await trustedFieldRoot(storageRoot);
    await privatePath(join(storageRoot, ".field-provisioned"), true);
    await privatePath(join(storageRoot, "field"), true);
    const path = authorizationStorePath(storageRoot);
    await privatePath(path, false);
    const bytes = await readRegular(path);
    return parseAuthorizationStore(JSON.parse(bytes.toString("utf8")));
  } catch (error) {
    throw new Error("Gaia authorization store is unreadable", { cause: error });
  }
}

// The store lock is deliberately short and separate from the project writer. Callers that
// need both take the project lock first, then this lock. Revocation takes the project lock
// but reads no world or status file, so corrupt sidecars do not block it.
export async function updateAuthorizationStore<T>(
  storageRoot: string,
  work: (store: AuthorizationStore) => Promise<{ store: AuthorizationStore; result: T }>
): Promise<T> {
  const dir = await directory(storageRoot, "field", false);
  return await serialized(dir, async () => {
    const store = await readAuthorizationStore(storageRoot);
    const outcome = await work(store);
    if (outcome.store !== store)
      await publish(
        authorizationStorePath(storageRoot),
        serializeAuthorizationStore(outcome.store)
      );
    return outcome.result;
  });
}

export async function resolveActiveAssignment(
  storageRoot: string,
  fingerprint: string
): Promise<AuthorizationAssignment | undefined> {
  return resolveActiveAssignmentFromStore(await readAuthorizationStore(storageRoot), fingerprint);
}

// Trusted main-only boundary for B4/B7: resolve the active assignment for a fingerprint,
// then re-verify it against the caller's world and epoch. The returned assignment is only
// a capability decision input; callers must already hold the project lock and keep it
// until the decision is applied, because this read does not extend the store lock.
export async function resolveVerifiedAssignment(
  storageRoot: string,
  world: World,
  epoch: number,
  fingerprint: string,
  expected: VerifyAuthorizationExpectation = {}
): Promise<AuthorizationAssignment | undefined> {
  const assignment = await resolveActiveAssignment(storageRoot, fingerprint);
  if (!assignment) return undefined;
  verifyActiveAssignment(world, epoch, assignment, expected);
  return assignment;
}

export async function reconcileAuthorizationStore(
  storageRoot: string,
  previousWorld: World,
  previousEpoch: number,
  world: World,
  epoch: number,
  now: number
): Promise<void> {
  await updateAuthorizationStore(storageRoot, async (store) => {
    const next = reconcileAuthorizationAssignments(
      store,
      previousWorld,
      previousEpoch,
      world,
      epoch,
      now
    );
    return { store: next, result: undefined };
  });
}

// Revocation takes the same project lock as trusted observation publication. It reads no
// world or status file, so a corrupt sidecar cannot block it. If a concurrent reassign
// moved the row, retry against the new project lock rather than revoking under a stale one.
export async function revokeStoredAssignment(
  storageRoot: string,
  assignmentId: string,
  operationId: string,
  check?: (target: AuthorizationAssignment) => void | Promise<void>
): Promise<AuthorizationAssignment> {
  const projects = await directory(storageRoot, "projects", false);
  const attempt = async (): Promise<AuthorizationAssignment> => {
    const store = await readAuthorizationStore(storageRoot);
    const assignment = revocationTarget(store, assignmentId, operationId);
    const projectId = assignment.projectId;
    const outcome = await serialized(
      await directory(projects, projectId, false),
      async () =>
        await updateAuthorizationStore<
          { moved: true } | { moved: false; assignment: AuthorizationAssignment }
        >(storageRoot, async (current) => {
          const entry = revocationTarget(current, assignmentId, operationId);
          if (entry.projectId !== projectId) return { store: current, result: { moved: true } };
          await check?.(entry);
          const result = revokeAuthorization(current, {
            assignmentId,
            operationId,
            now: Date.now(),
          });
          return {
            store: result.store,
            result: { moved: false, assignment: result.assignment },
          };
        })
    );
    return outcome.moved ? await attempt() : outcome.assignment;
  };
  return await attempt();
}
