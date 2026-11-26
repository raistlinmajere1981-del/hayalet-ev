import { randomUUID } from "node:crypto";
import { join } from "node:path";
import { lstat, readdir } from "node:fs/promises";
import { nodeAt, validateWorld } from "../spatial/world.ts";
import { newProject, referencePng } from "../spatial/project.ts";
import { applyTrusted, fields, parseBatch, segment, uuid } from "./batch.ts";
import {
  publishManagedWorld,
  readDocument,
  requestDigest,
  type Document,
} from "./project-document.ts";
import { gridPng } from "./fixture-image.ts";
import { applyTrustedSite, parseSiteBatch } from "./site-batch.ts";
import { parseVirtualUpdate, projectStatuses } from "./status-store.ts";
import { directory, hasCode, publish, readRegular, serialized } from "./files.ts";
import { assetIssues, readAsset, type DecodeRaster } from "./images.ts";
import {
  parseReferenceBatch,
  prepareReference,
  publishReferenceAsset,
  retireReferenceAsset,
} from "./reference-batch.ts";
interface Context {
  storageRoot: string;
  owner: object;
}
const sessions = new WeakMap<
  object,
  { project: string; building: string | null; revision: number; id: string }
>();
const commands = [
  "GaiaProjects",
  "GaiaCreate",
  "GaiaOpen",
  "GaiaSave",
  "GaiaReference",
  "GaiaStatus",
];

export async function projectCommand(
  { storageRoot, owner }: Context,
  command: string,
  request: unknown,
  decode?: DecodeRaster
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
  if (command === "GaiaStatus") {
    const hasUpdate = !!request && typeof request === "object" && Object.hasOwn(request, "update");
    fields(request, hasUpdate ? ["project", "session", "update"] : ["project", "session"]);
    const { project, session } = request;
    segment(project);
    uuid(session);
    const update = hasUpdate ? parseVirtualUpdate(request["update"]) : undefined;
    const dir = await directory(projects, project, false);
    return serialized(dir, async () => {
      const active = sessions.get(owner);
      if (active?.id !== session || active.project !== project)
        throw new Error("Gaia status session mismatch");
      const { world, statusEpoch = 0 } = await readDocument(join(dir, "world.json"), project);
      return {
        statuses: await projectStatuses(
          dir,
          world,
          statusEpoch,
          update && { ...update, source: "simulated" }
        ),
        revision: world.revision,
      };
    });
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
      ? input.scope === "reference"
        ? parseReferenceBatch(input)
        : parseSiteBatch(input)
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
      await assetIssues(dir, world);
      await publish(path, JSON.stringify(doc));
    } else doc = await readDocument(path, project);
    const issues = await assetIssues(dir, doc.world);
    if (batch) {
      const digest = requestDigest(batch);
      if (doc.lastOperation?.id === batch.operationId) {
        if (doc.lastOperation.digest !== digest)
          throw new Error("Operation ID was reused with different content");
        return {
          world: doc.world,
          missing: issues.missing,
          ...(issues.damaged.length ? { damaged: issues.damaged } : {}),
        };
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
      const reference =
        "scope" in batch && batch.scope === "reference"
          ? prepareReference(doc.world, batch, decode)
          : undefined;
      const candidate =
        reference?.next ??
        ("scope" in batch
          ? batch.scope === "site"
            ? applyTrustedSite(doc.world, batch)
            : doc.world
          : applyTrusted(doc.world, batch));
      if (reference?.upload) await publishReferenceAsset(dir, reference.upload);
      if (candidate !== doc.world) {
        // Persist the inventory generation with the world, not the disposable sidecar.
        // A -> B -> A must not make an old sidecar or authorization valid again.
        await publishManagedWorld(storageRoot, dir, doc, candidate, batch.operationId, digest);
      }
      if (reference?.removed) await retireReferenceAsset(dir, reference.removed);
      active.revision = candidate.revision;
      const damaged = issues.damaged.filter((id) => Object.hasOwn(candidate.assets, id));
      return {
        world: candidate,
        missing: issues.missing.filter((id) => Object.hasOwn(candidate.assets, id)),
        ...(damaged.length ? { damaged } : {}),
      };
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
    return {
      world: doc.world,
      building,
      session,
      missing: issues.missing,
      ...(issues.damaged.length ? { damaged: issues.damaged } : {}),
    };
  });
}

async function referenceCommand(
  { storageRoot, owner }: Context,
  request: unknown,
  decode: DecodeRaster
) {
  fields(request, ["project", "session", "asset"]);
  const { project, session, asset } = request;
  segment(project);
  uuid(session);
  segment(asset);
  const dir = await directory(await directory(storageRoot, "projects", false), project, false);
  return await serialized(dir, async () => {
    const active = sessions.get(owner);
    if (active?.id !== session || active.project !== project)
      throw new Error("Gaia reference session mismatch");
    const { world } = await readDocument(join(dir, "world.json"), project);
    const record = Object.hasOwn(world.assets, asset) ? world.assets[asset] : undefined;
    if (!record || !Object.values(world.references).some((layer) => layer.asset === asset))
      throw new Error("Unknown Gaia reference asset");
    const { bytes, raster } = await readAsset(dir, asset, record);
    const preview = decode(bytes, raster, true);
    if (!preview) throw new Error("Gaia reference preview is unavailable");
    return preview;
  });
}

export const gaiaStorage = (decode: DecodeRaster) => ({
  roomId: "gaia-room",
  commands,
  execute: (context: Context, command: string, request: unknown) =>
    command === "GaiaReference"
      ? referenceCommand(context, request, decode)
      : projectCommand(context, command, request, decode),
});
