import { fields, record, segment, uuid } from "./batch.ts";
import { applySiteEdits, type SiteBatch } from "../spatial/site-edits.ts";
import { validateWorld, type World } from "../spatial/world.ts";

function ids(value: unknown) {
  if (!Array.isArray(value)) throw new Error("Invalid Gaia IDs");
  for (const id of value) segment(id);
}

export function parseSiteBatch(input: unknown): SiteBatch {
  fields(input, ["scope", "project", "session", "baseRevision", "operationId", "edits"]);
  segment(input["project"]);
  uuid(input["session"]);
  uuid(input["operationId"]);
  if (
    input["scope"] !== "site" ||
    !Number.isSafeInteger(input["baseRevision"]) ||
    !Array.isArray(input["edits"])
  )
    throw new Error("Invalid site batch");
  for (const edit of input["edits"] as unknown[]) {
    if (!record(edit)) throw new Error("Invalid site edit");
    if (edit["op"] === "remove") {
      fields(edit, ["op", "ids", "detach"]);
      ids(edit["ids"]);
      ids(edit["detach"]);
      continue;
    }
    switch (edit["op"]) {
      case "add": {
        fields(edit, ["op", "id", "node"]);
        uuid(edit["id"]);
        const n = edit["node"];
        if (!record(n)) throw new Error("Invalid site node");
        const field = ["kind", "name", "parent", "p", "yaw"];
        fields(n, [...field, n["kind"] === "floor" ? "level" : "geometry"]);
        if (typeof n["name"] !== "string" || !n["name"].trim() || n["name"].length > 100)
          throw new Error("Invalid site name");
        if (n["kind"] !== "site") segment(n["parent"]);
        const geometry = n["geometry"];
        switch (n["kind"]) {
          case "site":
            fields(geometry, ["kind", "ring"]);
            if (geometry["kind"] !== "footprint") throw new Error("Invalid boundary");
            break;
          case "building":
            fields(geometry, ["kind", "size"]);
            if (geometry["kind"] !== "box") throw new Error("Invalid building");
            break;
          case "route":
            fields(geometry, ["kind", "vertices"]);
            if (geometry["kind"] !== "path") throw new Error("Invalid route");
            break;
          case "mount":
            fields(geometry, ["kind"]);
            if (geometry["kind"] !== "point") throw new Error("Invalid mount");
            break;
          case "floor":
            break;
          default:
            throw new Error("Unsupported site node");
        }
        break;
      }
      case "bindVirtual":
        fields(edit, ["op", "id", "mount"]);
        uuid(edit["id"]);
        segment(edit["mount"]);
        break;
      case "building":
        fields(edit, ["op", "id", "pose", "size"]);
        fields(edit["pose"], ["p", "yaw"]);
        break;
      case "boundary":
        fields(edit, ["op", "id", "ring"]);
        break;
      case "elevation":
        fields(edit, ["op", "id", "z"]);
        break;
      case "point":
        fields(edit, ["op", "id", "p"]);
        break;
      case "path":
        fields(edit, ["op", "id", "vertices"]);
        break;
      case "reparent":
        fields(edit, ["op", "id", "parent", "preserve"]);
        segment(edit["parent"]);
        if (edit["preserve"] !== "world" && edit["preserve"] !== "local")
          throw new Error("Specify Gaia pose preservation");
        break;
      default:
        throw new Error("Unsupported site edit");
    }
    segment(edit["id"]);
  }
  return input as unknown as SiteBatch;
}

export function applyTrustedSite(world: World, batch: SiteBatch): World {
  const candidate = applySiteEdits(world, batch.edits);
  if (candidate === world) return world;
  const revised = { ...candidate, revision: world.revision + 1 };
  validateWorld(revised);
  return revised;
}
