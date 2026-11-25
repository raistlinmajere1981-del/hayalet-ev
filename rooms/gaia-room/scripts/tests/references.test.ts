import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test, type TestContext } from "node:test";
import type { Opened, Saved } from "../editor/client.ts";
import { floorId, interiorReferences } from "../editor/projection.ts";
import { objectMeasurements } from "../spatial/measurements.ts";
import { newProject } from "../spatial/project.ts";
import { pixelInFrame, projectReference, referencePoint } from "../spatial/reference.ts";
import {
  close,
  toParent,
  validCalibration,
  worldPose,
  type Calibration,
  type V3,
} from "../spatial/world.ts";
import { gridPng } from "../storage/fixture-image.ts";
import { inspectRaster } from "../storage/images.ts";
import { gaiaStorage } from "../storage/provider.ts";
import type { ReferenceBatch, ReferenceEdit } from "../storage/reference-contract.ts";

const original = gridPng();
const calibration: Calibration = {
  pixels: [
    [20, 30],
    [120, 30],
  ],
  distanceM: 10,
  anchor: [2, 57, 0],
  bearingDeg: 90,
};

function closePoint(actual: V3, expected: V3) {
  assert.ok(
    actual.every((n, i) => close(n, expected[i]!)),
    `${actual} ≠ ${expected}`
  );
}

function bitmap() {
  const bytes = Buffer.alloc(54 + 8 * 3, 0);
  bytes.write("BM");
  bytes.writeUInt32LE(bytes.length, 2);
  bytes.writeUInt32LE(54, 10);
  bytes.writeUInt32LE(40, 14);
  bytes.writeInt32LE(2, 18);
  bytes.writeInt32LE(-3, 22);
  bytes.writeUInt16LE(1, 26);
  bytes.writeUInt16LE(24, 28);
  return bytes;
}

test("calibration maps original pixels into rotated metric frames and OpenPlan3D's building plane", () => {
  const world = newProject("demo", true, "en", true);
  const survey = world.references["survey"]!;
  const cellar = world.nodes["cellar"]!;
  cellar.p = [2, -1, -3];
  cellar.yaw = 30;
  closePoint(pixelInFrame(calibration, [20, 30]), [2, 57, 0]);
  closePoint(pixelInFrame(calibration, [120, 30]), [2, 67, 0]);
  assert.equal(validCalibration({ ...calibration, distanceM: Infinity }, [400, 600]), false);
  assert.equal(validCalibration({ ...calibration, distanceM: 0 }, [400, 600]), false);
  assert.equal(
    validCalibration(
      {
        ...calibration,
        pixels: [
          [-1, 0],
          [10, 0],
        ],
      },
      [400, 600]
    ),
    false
  );
  assert.equal(
    validCalibration(
      {
        ...calibration,
        pixels: [
          [0, 0],
          [0, 0],
        ],
      },
      [400, 600]
    ),
    false
  );
  const projected = projectReference(world, survey, "cellar")!;
  assert.equal(projected.origin[2], 3);
  closePoint(toParent(worldPose(world, "cellar"), referencePoint(projected, [20, 30])), [2, 57, 0]);
  closePoint(
    toParent(worldPose(world, "cellar"), referencePoint(projected, [120, 30])),
    [12, 57, 0]
  );

  world.references["cellar-survey"] = { ...survey, frame: "cellar", calibration };
  const [siteImage, cellarImage] = interiorReferences(world, "glass", floorId("cellar"));
  assert.ok(close(siteImage!.x, 4600) && close(siteImage!.y, -1200));
  assert.equal(siteImage!.width, 4000);
  assert.equal(siteImage!.height, 6000);
  const cellarOrigin = toParent(cellar, pixelInFrame(calibration, [0, 0]));
  assert.ok(
    close(cellarImage!.x, cellarOrigin[0] * 100) && close(cellarImage!.y, -cellarOrigin[1] * 100)
  );
  assert.equal(cellarImage!.rotation, -120);
  assert.deepEqual(
    interiorReferences(world, "glass", floorId("ground")).map(({ id }) => id),
    ["survey"]
  );
  assert.deepEqual(interiorReferences(world, "coop", floorId("cellar")), []);
});

test("measurements use canonical elevations and complete routes regardless of display clipping", () => {
  const world = newProject("demo", true, "en", true);
  world.nodes["plot"]!.p = [100, 43, 9];
  world.nodes["plot"]!.yaw = 37;
  const prior = JSON.stringify(world);
  const pipe = objectMeasurements(world, "pipe");
  assert.ok(close(pipe.route!.horizontal, 5));
  assert.ok(close(pipe.route!.direct, Math.sqrt(34)));
  assert.ok(close(pipe.route!.length, 8));
  assert.equal(objectMeasurements(world, "plot").area, 2400);
  assert.equal(objectMeasurements(world, "bed").area, 48);
  assert.equal(objectMeasurements(world, "mc1").elevation, 7);
  assert.deepEqual(objectMeasurements(world, "glass").dimensions, [12, 8, 6]);
  assert.equal(JSON.stringify(world), prior);
});

test("raster format, complete bounds and dimensions come from the bytes", () => {
  assert.deepEqual(inspectRaster(original), { mime: "image/png", pixels: [400, 600] });
  assert.deepEqual(inspectRaster(bitmap()), { mime: "image/bmp", pixels: [2, 3] });
  assert.throws(() => inspectRaster(original.subarray(0, 36)), /Invalid/);
  assert.throws(() => inspectRaster(bitmap().subarray(0, 56)), /Invalid/);
  const corrupt = Buffer.from(original);
  corrupt[50] = corrupt[50]! ^ 0xff;
  assert.throws(() => inspectRaster(corrupt), /Invalid/);
});

async function setup(t: TestContext, fixture: boolean) {
  const storageRoot = await mkdtemp(join(tmpdir(), "gaia-02b-"));
  t.after(() => rm(storageRoot, { recursive: true, force: true }));
  const owner = {};
  const storage = gaiaStorage((bytes, { mime }, preview) =>
    preview ? { mime, image: bytes.toString("base64") } : undefined
  );
  const command = (name: string, request: unknown) =>
    storage.execute({ owner, storageRoot }, name, request);
  let opened = (await command("GaiaCreate", {
    project: "yard",
    fixture,
    locale: "en",
    layout: "site",
  })) as Opened;
  const dir = join(storageRoot, "projects", "yard");
  const makeBatch = (edit: ReferenceEdit): ReferenceBatch => ({
    scope: "reference",
    project: "yard",
    baseRevision: opened.world.revision,
    session: opened.session,
    operationId: randomUUID(),
    edit,
  });
  const save = async (batch: ReferenceBatch, retry = false) => {
    const reply = await command("GaiaSave", { batch, retry });
    if ("world" in reply && reply.world) opened = { ...opened, ...reply } as Opened;
    return reply as Saved;
  };
  const reopen = async () => (opened = (await command("GaiaOpen", { project: "yard" })) as Opened);
  return {
    get opened() {
      return opened;
    },
    dir,
    command,
    makeBatch,
    save,
    reopen,
  };
}

test("reference receipts preserve original bytes, raw points and existing geometry through replacement", async (t) => {
  const s = await setup(t, true);
  const { nodes, devices } = s.opened.world;
  const id = randomUUID();
  const asset = randomUUID();
  const input = s.makeBatch({
    op: "import",
    id,
    asset,
    frame: null,
    name: "misleading.jpg",
    image: original.toString("base64"),
  });
  const first = await s.save(input);
  assert.deepEqual(await s.save(input, true), first);
  assert.equal(first.world.assets[asset]?.mime, "image/png");
  assert.deepEqual(await readFile(join(s.dir, "assets", asset)), original);
  await s.save(s.makeBatch({ op: "calibrate", id, calibration }));
  const saved = await s.reopen();
  assert.deepEqual(saved.world.references[id]?.calibration, calibration);
  assert.deepEqual(saved.world.nodes, nodes);
  assert.deepEqual(saved.world.devices, devices);
  const pose = projectReference(saved.world, saved.world.references[id]!)!;
  const appearance = s.makeBatch({
    op: "appearance",
    id,
    frame: "cellar",
    locked: true,
    visible: false,
    opacity: 0.35,
  });
  const moved = await s.save(appearance);
  closePoint(projectReference(moved.world, moved.world.references[id]!)!.origin, pose.origin);
  assert.deepEqual(moved.world.references[id]?.calibration?.pixels, calibration.pixels);
  const newAsset = randomUUID();
  const replace = {
    op: "replace",
    id,
    asset: newAsset,
    name: "map.bmp",
    image: bitmap().toString("base64"),
  } as const;
  await assert.rejects(s.save(s.makeBatch(replace)), /Unlock/);
  await s.save(
    s.makeBatch({
      op: "appearance",
      id,
      frame: "cellar",
      locked: false,
      visible: true,
      opacity: 0.35,
    })
  );
  const swapped = await s.save(s.makeBatch(replace));
  assert.equal(swapped.world.assets[asset], undefined);
  await assert.rejects(readFile(join(s.dir, "assets", asset)), { code: "ENOENT" });
  assert.deepEqual(await readFile(join(s.dir, "assets", newAsset)), bitmap());
  assert.equal(swapped.world.references[id]?.calibration, undefined);
  assert.equal(swapped.world.references[id]?.frame, "cellar");
  assert.deepEqual(swapped.world.nodes, nodes);
  assert.deepEqual(swapped.world.devices, devices);
});

test("empty projects can import imagery and still open with missing or corrupt linked files", async (t) => {
  const s = await setup(t, false);
  const id = randomUUID();
  const asset = randomUUID();
  const path = join(s.dir, "assets", asset);
  const edit = {
    op: "import",
    id,
    asset,
    frame: null,
    name: "imagery.png",
    image: original.toString("base64"),
  } as const;
  await assert.rejects(s.save(s.makeBatch({ ...edit, image: "abc" })), /Invalid/);
  assert.equal(s.opened.world.revision, 0);
  await s.save(s.makeBatch(edit));
  const read = { project: "yard", session: s.opened.session, asset };
  assert.deepEqual(await s.command("GaiaReference", read), {
    mime: "image/png",
    image: edit.image,
  });
  await assert.rejects(s.command("GaiaReference", { ...read, asset: ".." }), /identifier/);
  await assert.rejects(s.command("GaiaReference", { ...read, session: randomUUID() }), /session/);
  await rm(path);
  assert.deepEqual((await s.reopen()).missing, [asset]);
  await writeFile(path, bitmap());
  const damaged = await s.reopen();
  assert.deepEqual(damaged.damaged, [asset]);
  assert.equal(damaged.world.references[id]?.asset, asset);
  await assert.rejects(
    s.command("GaiaReference", { ...read, session: damaged.session }),
    /Invalid/
  );
  const removed = await s.save(s.makeBatch({ op: "remove", id }));
  assert.deepEqual(removed.world.references, {});
  assert.deepEqual(removed.world.assets, {});
  assert.equal(removed.damaged, undefined);
});
