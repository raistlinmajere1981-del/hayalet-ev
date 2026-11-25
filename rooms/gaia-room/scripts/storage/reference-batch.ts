import { join } from "node:path";
import { nodeAt, validateWorld, type Id, type World } from "../spatial/world.ts";
import { reframeCalibration } from "../spatial/reference.ts";
import { fields, record, segment, uuid } from "./batch.ts";
import { directory, hasCode, publish, readRegular, removeRegular } from "./files.ts";
import { imageDigest, inspectRaster, uploadBytes, type DecodeRaster } from "./images.ts";

import { maxImagePayload, type ReferenceBatch } from "./reference-contract.ts";

export function parseReferenceBatch(input: unknown): ReferenceBatch {
  fields(input, ["scope", "project", "session", "operationId", "baseRevision", "edit"]);
  segment(input["project"]);
  uuid(input["operationId"]);
  uuid(input["session"]);
  const edit = input["edit"];
  if (
    input["scope"] !== "reference" ||
    !Number.isSafeInteger(input["baseRevision"]) ||
    !record(edit)
  )
    throw new Error("Invalid Gaia reference batch");
  segment(edit["id"]);
  switch (edit["op"]) {
    case "import":
    case "replace":
      fields(edit, [
        "op",
        "id",
        "asset",
        "name",
        "image",
        ...(edit["op"] === "import" ? ["frame"] : []),
      ]);
      if (edit["op"] === "import") {
        uuid(edit["id"]);
        if (edit["frame"] !== null) segment(edit["frame"]);
      }
      uuid(edit["asset"]);
      if (
        typeof edit["name"] !== "string" ||
        typeof edit["image"] !== "string" ||
        edit["image"].length > maxImagePayload
      )
        throw new Error("Invalid Gaia image upload");
      break;
    case "appearance":
      fields(edit, ["op", "id", "frame", "visible", "locked", "opacity"]);
      if (edit["frame"] !== null) segment(edit["frame"]);
      if (typeof edit["visible"] !== "boolean" || typeof edit["locked"] !== "boolean")
        throw new Error("Invalid Gaia reference appearance");
      break;
    case "calibrate":
      fields(edit, ["op", "id", "calibration"]);
      fields(edit["calibration"], ["pixels", "distanceM", "anchor", "bearingDeg"]);
      break;
    case "remove":
      fields(edit, ["op", "id"]);
      break;
    default:
      throw new Error("Unsupported Gaia reference edit");
  }
  return input as unknown as ReferenceBatch;
}

function checkFrame(world: World, frame: Id | null) {
  if (frame !== null && !["site", "building", "floor", "zone"].includes(nodeAt(world, frame).kind))
    throw new Error("Invalid Gaia reference frame");
}

function occupied(world: World, id: Id) {
  return [world.nodes, world.assets, world.references, world.devices].some((table) =>
    Object.hasOwn(table, id)
  );
}

export function prepareReference(world: World, { edit }: ReferenceBatch, decode?: DecodeRaster) {
  const { id } = edit;
  const current = Object.hasOwn(world.references, id) ? world.references[id] : undefined;
  const assets = { ...world.assets };
  const references = { ...world.references };
  let upload: { id: string; bytes: Buffer } | undefined;
  let removed: Id | undefined;
  const existing = () => {
    if (!current) throw new Error("Invalid Gaia reference identity");
    return current;
  };
  if (edit.op === "import" && occupied(world, id))
    throw new Error("Gaia reference identity is already in use");
  if (current?.locked && (edit.op !== "appearance" || edit.frame !== current.frame))
    throw new Error("Unlock the Gaia reference before editing its placement");

  switch (edit.op) {
    case "import":
    case "replace": {
      const prior = edit.op === "import" ? undefined : existing();
      const frame = edit.op === "import" ? edit.frame : (prior?.frame ?? null);
      checkFrame(world, frame);
      if (occupied(world, edit.asset) || edit.asset === id)
        throw new Error("Gaia image asset identity is already in use");
      const bytes = uploadBytes(edit.image);
      const raster = inspectRaster(bytes);
      if (!decode) throw new Error("Gaia image decoder is unavailable");
      decode(bytes, raster, false);
      assets[edit.asset] = { ...raster, sha256: imageDigest(bytes) };
      upload = { id: edit.asset, bytes };
      const layer = { opacity: 0.65, ...prior, asset: edit.asset, name: edit.name, frame };
      delete layer.calibration;
      references[id] = layer;
      removed = prior?.asset;
      break;
    }
    case "appearance": {
      checkFrame(world, edit.frame);
      const prior = existing();
      if (
        edit.frame === prior.frame &&
        edit.visible === (prior.visible !== false) &&
        edit.locked === (prior.locked === true) &&
        edit.opacity === prior.opacity
      )
        return { next: world };
      const calibration = reframeCalibration(world, prior, edit.frame);
      references[id] = {
        ...prior,
        frame: edit.frame,
        locked: edit.locked,
        visible: edit.visible,
        opacity: edit.opacity,
        ...(calibration ? { calibration } : {}),
      };
      break;
    }
    case "calibrate":
      references[id] = { ...existing(), calibration: edit.calibration };
      break;
    case "remove":
      delete references[id];
      removed = existing().asset;
      break;
  }
  if (removed && Object.values(references).some((layer) => layer.asset === removed))
    removed = undefined;
  if (removed) delete assets[removed];
  const next = { ...world, assets, references, revision: world.revision + 1 };
  validateWorld(next);
  return { next, upload, removed };
}

export async function publishReferenceAsset(dir: string, { id, bytes }: { id: Id; bytes: Buffer }) {
  const path = join(await directory(dir, "assets", true), id);
  try {
    if ((await readRegular(path, bytes.length)).equals(bytes)) return;
    throw new Error("Immutable Gaia asset mismatch");
  } catch (error) {
    if (!hasCode(error, "ENOENT")) throw error;
    await publish(path, bytes);
  }
}

export async function retireReferenceAsset(dir: string, id: Id) {
  segment(id);
  try {
    await removeRegular(join(await directory(dir, "assets", false), id));
  } catch {
    // The new world is already durable. Leftover bytes are unreachable after publication.
  }
}
