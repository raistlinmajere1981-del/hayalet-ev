import { inspectPlan, projectWorld, type PlanObject } from "../editor/projection.ts";
import { applyBatch, type EditBatch } from "../editor/session.ts";
import { nodeAt, type World } from "../spatial/world.ts";

function record(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export function fields(value: unknown, keys: string[]): asserts value is Record<string, unknown> {
  if (
    !value ||
    typeof value !== "object" ||
    Array.isArray(value) ||
    Object.keys(value).length !== keys.length ||
    !keys.every((key) => Object.hasOwn(value, key))
  )
    throw new Error("Unexpected Gaia command fields");
}

export function segment(id: unknown): asserts id is string {
  if (
    typeof id !== "string" ||
    !/^[a-z0-9][a-z0-9-]{0,63}$/.test(id) ||
    /^(con|prn|aux|nul|com[0-9]|lpt[0-9]|constructor|prototype)$/.test(id)
  )
    throw new Error("Invalid Gaia identifier");
}

export function uuid(id: unknown): asserts id is string {
  if (
    typeof id !== "string" ||
    !/^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/.test(id)
  )
    throw new Error("Invalid operation or session UUID");
}

export function parseBatch(input: unknown): EditBatch {
  fields(input, ["project", "building", "session", "operationId", "baseRevision", "edits"]);
  segment(input["project"]);
  segment(input["building"]);
  uuid(input["session"]);
  uuid(input["operationId"]);
  if (!Number.isSafeInteger(input["baseRevision"]) || !Array.isArray(input["edits"]))
    throw new Error("Invalid batch");
  const operations = new Map<string, Set<string>>();
  for (const edit of input["edits"] as unknown[]) {
    if (!record(edit)) throw new Error("Invalid edit");
    const poseKeys = ["p", "yaw"];
    const op = edit["op"];
    switch (op) {
      case "remove":
        fields(edit, ["op", "id"]);
        break;
      case "pose":
        fields(edit, ["op", "id", ...poseKeys]);
        break;
      case "geometry":
        fields(edit, ["op", "id", "geometry"]);
        break;
      case "create":
        fields(edit, ["op", "id", "floor", "geometry", ...poseKeys]);
        uuid(edit["id"]);
        segment(edit["floor"]);
        break;
      default:
        throw new Error("Unsupported Gaia edit");
    }
    segment(edit["id"]);
    const seen = operations.get(edit["id"]) ?? new Set<string>();
    if (
      seen.has(op) ||
      (seen.size &&
        (op === "create" || op === "remove" || seen.has("create") || seen.has("remove")))
    )
      throw new Error("Conflicting edits");
    seen.add(op);
    operations.set(edit["id"], seen);
    if (
      "p" in edit &&
      (!Array.isArray(edit["p"]) ||
        edit["p"].length !== 3 ||
        !edit["p"].every(Number.isFinite) ||
        typeof edit["yaw"] !== "number" ||
        !Number.isFinite(edit["yaw"]) ||
        edit["yaw"] < 0 ||
        edit["yaw"] >= 360)
    )
      throw new Error("Invalid pose");
    if ("geometry" in edit) {
      const shape = edit["geometry"];
      if (!record(shape)) throw new Error("Invalid geometry");
      if (shape["kind"] === "wall") fields(shape, ["kind", "length", "height", "thickness"]);
      else if (shape["kind"] === "box") fields(shape, ["kind", "size"]);
      else throw new Error("Unsupported geometry");
      const dimensions =
        shape["kind"] === "box"
          ? shape["size"]
          : [shape["length"], shape["height"], shape["thickness"]];
      if (
        !Array.isArray(dimensions) ||
        dimensions.length !== 3 ||
        !dimensions.every((n) => Number.isFinite(n) && n > 0)
      )
        throw new Error("Invalid dimensions");
    }
  }
  return input as unknown as EditBatch;
}

export function applyTrusted(world: World, batch: EditBatch): World {
  const projected = projectWorld(world, batch.building);
  const rows = inspectPlan(projected.plan, projected.plan, world, batch.building);
  const scope = new Map<string, Pick<PlanObject, "floor" | "geometry">>();
  for (const [key, row] of rows) {
    const id = projected.ids.get(key);
    if (id === undefined) throw new Error("Unbound workshop object");
    scope.set(id, row);
  }
  for (const edit of batch.edits) {
    if (edit.op === "create") {
      const floor = nodeAt(world, edit.floor);
      if (floor.kind !== "floor" || floor.parent !== batch.building)
        throw new Error("Floor outside workshop");
      scope.set(edit.id, edit);
    }
    if (edit.op === "create" || edit.op === "pose") {
      const kind = scope.get(edit.id)?.geometry.kind;
      if (edit.p[2] < 0 || edit.p[2] > 100 || (kind === "wall" && edit.p[2] !== 0))
        throw new Error("Unsupported elevation");
    }
  }
  const candidate = applyBatch(world, batch, scope);
  const after = projectWorld(candidate, batch.building);
  inspectPlan(after.plan, after.plan, candidate, batch.building);
  return candidate;
}
