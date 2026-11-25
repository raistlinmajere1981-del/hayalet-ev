import { createHash, randomUUID } from "node:crypto";
import { join } from "node:path";
import { lstat, readdir } from "node:fs/promises";
import { nodeAt, validateWorld, type World } from "../spatial/world.ts";
import { newProject, referencePng } from "../spatial/project.ts";
import { applyTrusted, fields, parseBatch, segment, uuid } from "./batch.ts";
import { gridPng } from "./fixture-image.ts";
import { applyTrustedSite, parseSiteBatch } from "./site-batch.ts";
import { directory, hasCode, publish, readRegular, serialized } from "./files.ts";

interface Receipt {
  id: string;
  digest: string;
  revision: number;
}
interface Document {
  world: World;
  lastOperation: Receipt | null;
}
interface Context {
  storageRoot: string;
  owner: object;
}
const sessions = new WeakMap<
  object,
  { project: string; building: string | null; revision: number; id: string }
>();
const commands = ["GaiaProjects", "GaiaCreate", "GaiaOpen", "GaiaSave"];

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

async function readDocument(path: string, project: string): Promise<Document> {
  const data: unknown = JSON.parse((await readRegular(path)).toString("utf8"));
  fields(data, ["world", "lastOperation"]);
  const world = data["world"] as World;
  validateWorld(world);
  if (world.id !== project) throw new Error("Stored project identity mismatch");
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

async function missingAssets(dir: string, world: World): Promise<string[]> {
  const missing = await Promise.all(
    Object.entries(world.assets).map(async ([id, asset]) => {
      segment(id);
      const pixels: unknown = asset.pixels;
      if (
        asset.mime !== "image/png" ||
        !Array.isArray(pixels) ||
        pixels.length !== 2 ||
        !pixels.every((n) => Number.isSafeInteger(n) && n > 0)
      )
        throw new Error("Invalid reference metadata: " + id);
      try {
        const bytes = await readRegular(join(await directory(dir, "assets", false), id));
        if (
          bytes.length < 24 ||
          bytes.subarray(0, 8).toString("hex") !== "89504e470d0a1a0a" ||
          bytes.toString("ascii", 12, 16) !== "IHDR" ||
          bytes.readUInt32BE(16) !== pixels[0] ||
          bytes.readUInt32BE(20) !== pixels[1]
        )
          throw new Error("Reference image mismatch: " + id);
        return [];
      } catch (error) {
        if (hasCode(error, "ENOENT")) return [id];
        throw error;
      }
    })
  );
  return missing.flat();
}

export async function projectCommand(
  { storageRoot, owner }: Context,
  command: string,
  request: unknown
) {
  const projects = await directory(storageRoot, "projects", true);
  if (command === "GaiaProjects") {
    fields(request, []);
    const directories = (await readdir(projects, { withFileTypes: true })).filter((entry) =>
      entry.isDirectory()
    );
    const published = await Promise.all(
      directories.map(async (entry) => {
        try {
          await lstat(join(projects, entry.name, "world.json"));
          return [entry.name];
        } catch (error) {
          if (hasCode(error, "ENOENT")) return [];
          throw error;
        }
      })
    );
    return { projects: published.flat().sort() };
  }
  const save = command === "GaiaSave",
    create = command === "GaiaCreate";
  if (!save && !create && command !== "GaiaOpen") throw new Error("Unknown Gaia command");
  const has = (key: string) =>
    !!request && typeof request === "object" && Object.hasOwn(request, key);
  fields(
    request,
    save
      ? ["batch", "retry"]
      : create
        ? ["project", "fixture", "locale", ...(has("layout") ? ["layout"] : [])]
        : ["project", ...(has("building") ? ["building"] : [])]
  );
  if (save && typeof request["retry"] !== "boolean") throw new Error("Invalid retry");
  if (has("layout") && request["layout"] !== "site") throw new Error("Invalid project layout");
  const requestedBuilding = request["building"];
  if (has("building")) segment(requestedBuilding);
  const input = request["batch"];
  const batch = save
    ? input && typeof input === "object" && "scope" in input
      ? parseSiteBatch(input)
      : parseBatch(input)
    : undefined;
  const project = batch?.project ?? request["project"];
  segment(project);
  const dir = await directory(projects, project, create);
  return await serialized(dir, async () => {
    const path = join(dir, "world.json");
    let doc: Document;
    if (create) {
      if (
        typeof request["fixture"] !== "boolean" ||
        !["tr", "en"].includes(String(request["locale"]))
      )
        throw new Error("Invalid project options");
      try {
        await readRegular(path);
        throw new Error("Project already exists");
      } catch (error) {
        if (!hasCode(error, "ENOENT")) throw error;
      }
      const world = newProject(
        project,
        request["fixture"],
        String(request["locale"]),
        request["layout"] === "site"
      );
      validateWorld(world);
      if (request["fixture"]) {
        const sitePlan = request["layout"] === "site";
        const asset = join(
          await directory(dir, "assets", true),
          sitePlan ? "grid" : "sample-pixel"
        );
        const bytes = sitePlan ? gridPng() : Buffer.from(referencePng, "base64");
        try {
          if (!(await readRegular(asset)).equals(bytes))
            throw new Error("Immutable asset mismatch");
        } catch (error) {
          if (!hasCode(error, "ENOENT")) throw error;
          await publish(asset, bytes);
        }
      }
      doc = { world, lastOperation: null };
      await missingAssets(dir, world);
      await publish(path, JSON.stringify(doc));
    } else doc = await readDocument(path, project);
    const missing = await missingAssets(dir, doc.world);
    if (batch) {
      const digest = createHash("sha256")
        .update(JSON.stringify(canonical(batch)))
        .digest("hex");
      if (doc.lastOperation?.id === batch.operationId) {
        if (doc.lastOperation.digest !== digest)
          throw new Error("Operation ID was reused with different content");
        return { world: doc.world, missing };
      }
      if (doc.world.revision !== batch.baseRevision)
        return { error: request["retry"] ? "unknown" : "conflict", revision: doc.world.revision };
      const active = sessions.get(owner);
      if (
        active?.id !== batch.session ||
        active.project !== project ||
        ("building" in batch && active.building !== batch.building)
      )
        throw new Error("Workshop session mismatch");
      if (active.revision !== batch.baseRevision)
        return { error: "conflict", revision: doc.world.revision };
      const candidate =
        "scope" in batch ? applyTrustedSite(doc.world, batch) : applyTrusted(doc.world, batch);
      if (candidate !== doc.world)
        await publish(
          path,
          JSON.stringify({
            world: candidate,
            lastOperation: { id: batch.operationId, digest, revision: candidate.revision },
          })
        );
      active.revision = candidate.revision;
      return { world: candidate, missing };
    }
    const hasFloor = (id: string) =>
      nodeAt(doc.world, id).kind === "building" &&
      Object.values(doc.world.nodes).some((n) => n.kind === "floor" && n.parent === id);
    const building =
      typeof requestedBuilding === "string"
        ? requestedBuilding
        : (Object.keys(doc.world.nodes).find(hasFloor) ?? null);
    if (building !== null && !hasFloor(building))
      throw new Error("No workshop floor in this building");
    const session = randomUUID();
    sessions.set(owner, { project, building, revision: doc.world.revision, id: session });
    return { world: doc.world, building, session, missing };
  });
}

export const gaiaStorage = { roomId: "gaia-room", commands, execute: projectCommand };
