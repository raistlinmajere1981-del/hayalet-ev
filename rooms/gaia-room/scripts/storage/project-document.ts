import { createHash } from "node:crypto";
import { join } from "node:path";
import { validateWorld, type World } from "../spatial/world.ts";
import { fields, segment, uuid } from "./batch.ts";
import { directory, publish, readRegular } from "./files.ts";
import { reconcileAuthorizationStore } from "./enrollment-store.ts";
import { deviceStatusIdentity, reconcileStatuses } from "./status-store.ts";

interface Receipt {
  id: string;
  digest: string;
  revision: number;
}
export interface Document {
  world: World;
  lastOperation: Receipt | null;
  statusEpoch?: number;
}
// Key order has no meaning in a room command. Array order is part of its content.
function canonical(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(canonical);
  if (value && typeof value === "object")
    return Object.fromEntries(
      Object.entries(value)
        .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
        .map(([k, v]) => [k, canonical(v)])
    );
  return value;
}

function recordHasEpoch(data: unknown): boolean {
  return !!data && typeof data === "object" && Object.hasOwn(data, "statusEpoch");
}

export async function readDocument(path: string, project: string): Promise<Document> {
  const data: unknown = JSON.parse((await readRegular(path)).toString("utf8"));
  fields(
    data,
    recordHasEpoch(data) ? ["world", "lastOperation", "statusEpoch"] : ["world", "lastOperation"]
  );
  const world = data["world"] as World;
  validateWorld(world);
  if (world.id !== project) throw new Error("Stored project identity mismatch");
  if (
    recordHasEpoch(data) &&
    (typeof data["statusEpoch"] !== "number" ||
      !Number.isSafeInteger(data["statusEpoch"]) ||
      data["statusEpoch"] < 0 ||
      data["statusEpoch"] > world.revision)
  )
    throw new Error("Invalid Gaia status epoch");
  const receipt = data["lastOperation"];
  if (receipt !== null) {
    fields(receipt, ["id", "digest", "revision"]);
    uuid(receipt["id"]);
    if (
      receipt["revision"] !== world.revision ||
      typeof receipt["digest"] !== "string" ||
      !/^[a-f0-9]{64}$/.test(receipt["digest"])
    )
      throw new Error("Invalid saved operation");
  }
  return data as unknown as Document;
}

export async function projectDirectory(storageRoot: string, project: string): Promise<string> {
  segment(project);
  return directory(await directory(storageRoot, "projects", false), project, false);
}

export function requestDigest(request: unknown): string {
  return createHash("sha256")
    .update(JSON.stringify(canonical(request)))
    .digest("hex");
}

// The canonical world is published first; sidecar and authorization reconciliation are
// independent follow-ups. A failed follow-up leaves the world openable and physical
// authorization closed rather than rolling the world back.
export async function publishManagedWorld(
  storageRoot: string,
  dir: string,
  previous: Document,
  candidate: World,
  operationId: string,
  digest: string
): Promise<{ world: World; statusEpoch: number }> {
  const previousEpoch = previous.statusEpoch ?? 0;
  const statusEpoch =
    deviceStatusIdentity(candidate) !== deviceStatusIdentity(previous.world)
      ? candidate.revision
      : previousEpoch;
  await publish(
    join(dir, "world.json"),
    JSON.stringify({
      world: candidate,
      statusEpoch,
      lastOperation: { id: operationId, digest, revision: candidate.revision },
    })
  );
  try {
    await reconcileStatuses(dir, candidate, previous.world, statusEpoch, previousEpoch);
  } catch {
    // Status reads fail closed until a later successful sidecar update.
  }
  try {
    await reconcileAuthorizationStore(
      storageRoot,
      previous.world,
      previousEpoch,
      candidate,
      statusEpoch,
      Date.now()
    );
  } catch {
    // The world remains canonical. Authorization reads and ingest fail closed.
  }
  return { world: candidate, statusEpoch };
}
