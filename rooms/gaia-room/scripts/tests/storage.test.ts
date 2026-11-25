import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { spawnSync } from "node:child_process";
import { mkdtemp, open, readFile, rm, symlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test, type TestContext } from "node:test";
import type { Opened, Saved } from "../editor/client.ts";
import type { EditBatch } from "../editor/session.ts";
import { projectCommand } from "../storage/provider.ts";

async function setup(t: TestContext) {
  const storageRoot = await mkdtemp(join(tmpdir(), "gaia-store-"));
  t.after(async () => await rm(storageRoot, { recursive: true, force: true }));
  const context = { storageRoot, owner: {} };
  const call = (command: string, payload: unknown) => projectCommand(context, command, payload);
  const fresh = (await call("GaiaCreate", {
    project: "demo",
    fixture: true,
    locale: "en",
  })) as Opened;
  assert.ok(fresh.building);
  const batch: EditBatch = {
    project: "demo",
    building: fresh.building,
    session: fresh.session,
    baseRevision: 7,
    operationId: randomUUID(),
    edits: [{ op: "pose", id: "bench", p: [3, 2, 0], yaw: 90 }],
  };
  const save = (input = batch, retry = false) => call("GaiaSave", { batch: input, retry });
  const reopen = () => call("GaiaOpen", { project: "demo" }) as Promise<Opened>;
  const dir = join(storageRoot, "projects", "demo");
  return {
    storageRoot,
    dir,
    path: join(dir, "world.json"),
    fresh,
    call,
    reopen,
    batch,
    save,
    context,
  };
}

test("concurrent base revisions, lost receipt, replay collision and superseded receipt", async (t) => {
  const { fresh, batch: firstRequest, save, reopen, path } = await setup(t);
  const requests: [EditBatch, EditBatch] = [
    firstRequest,
    {
      ...firstRequest,
      operationId: randomUUID(),
      edits: [{ op: "pose", id: "bench", p: [4, 1, 0], yaw: 0 }],
    },
  ];
  const results = await Promise.all(requests.map((request) => save(request)));
  const winner = "world" in results[0]! ? 0 : 1;
  const batch = requests[winner];
  const first = results[winner] as Saved;
  assert.equal(first.world.revision, 8);
  const pose = batch.edits[0];
  assert.ok(pose?.op === "pose");
  assert.deepEqual(first.world.nodes["bench"]?.p, pose.p);
  assert.deepEqual(results[1 - winner], { error: "conflict", revision: 8 });
  const original = await readFile(path);
  assert.deepEqual(await save(batch, true), first);
  await assert.rejects(save({ ...batch, edits: [] }, true), /different content/);
  assert.deepEqual(await readFile(path), original);
  const next = {
    ...batch,
    operationId: randomUUID(),
    baseRevision: 8,
    edits: [{ op: "remove", id: "partition" }],
  } satisfies EditBatch;
  assert.equal(((await save(next)) as Saved).world.revision, 9);
  assert.deepEqual(await save(batch, true), { error: "unknown", revision: 9 });
  const reopened = await reopen();
  assert.equal(reopened.world.nodes["partition"], undefined);
  assert.deepEqual(reopened.world.devices, fresh.world.devices);
  assert.deepEqual(reopened.world.nodes["bench"]?.zoneIds, ["bed"]);
});

test("a second workshop cannot claim the current revision without reopening", async (t) => {
  const { context, batch, save } = await setup(t);
  const other = { ...context, owner: {} };
  const opened = (await projectCommand(other, "GaiaOpen", { project: "demo" })) as Opened;
  await save();
  const stale = await projectCommand(other, "GaiaSave", {
    batch: { ...batch, session: opened.session, baseRevision: 8, operationId: randomUUID() },
    retry: false,
  });
  assert.deepEqual(stale, { error: "conflict", revision: 8 });
});

test("trusted session, floor, editor profile and exact edit fields constrain the writer", async (t) => {
  const { batch, call, path, context } = await setup(t);
  const before = await readFile(path);
  for (const input of [
    { ...batch, session: randomUUID() },
    { ...batch, building: "plot" },
    { ...batch, edits: [{ op: "remove", id: "mc2" }] },
    { ...batch, edits: [{ op: "remove", id: "bench" }] },
    { ...batch, edits: [{ op: "pose", id: "bench", p: [2, 0, 0], yaw: 90, zoneIds: [] }] },
    { ...batch, edits: [{ op: "pose", id: "partition", p: [0, 0, 1], yaw: 90 }] },
    {
      ...batch,
      edits: [
        {
          op: "geometry",
          id: "bench",
          geometry: { kind: "wall", length: 1, height: 2, thickness: 0.1 },
        },
      ],
    },
    {
      ...batch,
      edits: [
        {
          op: "create",
          id: randomUUID(),
          floor: "glass",
          p: [0, 0, 0],
          yaw: 0,
          geometry: { kind: "box", size: [1, 1, 1] },
        },
      ],
    },
    { ...batch, edits: [{ op: "other", id: "partition" }] },
  ])
    await assert.rejects(call("GaiaSave", { batch: input, retry: false }));
  await assert.rejects(
    projectCommand({ ...context, owner: {} }, "GaiaSave", { batch, retry: false }),
    /session/
  );
  assert.deepEqual(await readFile(path), before);
});

test("storage failures and interruption before rename preserve the last published world", async (t) => {
  const { path, batch, save, context, dir } = await setup(t);
  const before = await readFile(path);
  const fd = await open(path);
  const proto: object = Object.getPrototypeOf(fd) as object;
  await fd.close();
  const mock = t.mock.method(proto as { writeFile: () => Promise<void> }, "writeFile", async () => {
    throw Object.assign(new Error("Disk full"), { code: "ENOSPC" });
  });
  await assert.rejects(save(), /Disk full/);
  mock.mock.restore();
  assert.deepEqual(await readFile(path), before);
  const child = spawnSync(
    process.execPath,
    [
      "--import",
      "tsx",
      "--input-type=module",
      "-e",
      `
   import fs from 'node:fs';
   import {syncBuiltinESMExports} from 'node:module';
   fs.promises.rename=()=>process.exit(72);
   syncBuiltinESMExports();
   const {projectCommand}=await import(process.argv[1]);
   const ctx={storageRoot:process.argv[2],owner:{}};
   const {session}=await projectCommand(ctx,"GaiaOpen",{project:"demo"});
   const batch=JSON.parse(process.argv[3]);batch.session=session;
   await projectCommand(ctx,"GaiaSave",{batch,retry:false});
 `,
      new URL("../storage/provider.ts", import.meta.url).href,
      context.storageRoot,
      JSON.stringify(batch),
    ],
    { encoding: "utf8" }
  );
  assert.equal(child.status, 72, child.stderr);
  assert.deepEqual(await readFile(path), before);
  assert.equal(((await save(batch, true)) as Saved).world.revision, 8);
  assert.ok((await readFile(join(dir, "assets/sample-pixel"))).length);
});

test("missing references remain attached and damaged worlds cannot be recreated", async (t) => {
  const { dir, path, call, fresh, reopen, save } = await setup(t);
  await rm(join(dir, "assets/sample-pixel"));
  const result = await reopen();
  assert.deepEqual(result.world, fresh.world);
  assert.deepEqual(result.missing, ["sample-pixel"]);
  await writeFile(path, "{broken");
  await assert.rejects(reopen());
  await assert.rejects(save());
  await assert.rejects(call("GaiaCreate", { project: "demo", fixture: false, locale: "en" }));
  assert.equal(await readFile(path, "utf8"), "{broken");
});

test("project identifiers and symlinks cannot redirect project or asset operations", async (t) => {
  const { storageRoot, dir, path, call, reopen } = await setup(t);
  for (const project of ["..", "x/y", "x\\y", "/tmp", "CON", "a.b"])
    await assert.rejects(call("GaiaOpen", { project }));
  const outside = await mkdtemp(join(tmpdir(), "gaia-outside-"));
  t.after(async () => await rm(outside, { recursive: true, force: true }));
  await symlink(outside, join(storageRoot, "projects", "linked"), "junction");
  await assert.rejects(
    call("GaiaCreate", { project: "linked", fixture: false, locale: "en" }),
    /Unsafe/
  );
  await rm(join(dir, "assets"), { recursive: true });
  await symlink(outside, join(dir, "assets"), "junction");
  await assert.rejects(reopen(), /Unsafe/);
  const target = join(outside, "world");
  await writeFile(target, "sentinel");
  await rm(path);
  await symlink(target, path);
  await assert.rejects(reopen(), /Unsafe/);
  assert.equal(await readFile(target, "utf8"), "sentinel");
});

test("a standard project starts on an empty floor and survives a fresh session", async (t) => {
  const { call } = await setup(t);
  const fresh = (await call("GaiaCreate", {
    project: "home",
    fixture: false,
    locale: "en",
  })) as Opened;
  assert.equal(fresh.world.revision, 0);
  assert.deepEqual(fresh.world.assets, {});
  assert.ok(!Object.values(fresh.world.nodes).some((n) => n.kind === "object"));
  const opened = (await call("GaiaOpen", { project: "home" })) as Opened;
  assert.deepEqual(opened.world, fresh.world);
  assert.notEqual(opened.session, fresh.session);
});

test("interrupted first publication leaves reusable immutable media and no listed project", async (t) => {
  const { storageRoot, call } = await setup(t);
  const child = spawnSync(
    process.execPath,
    [
      "--import",
      "tsx",
      "--input-type=module",
      "-e",
      `
    import fs from "node:fs";
    import {syncBuiltinESMExports} from "node:module";
    const rename=fs.promises.rename;
    fs.promises.rename=async (from,to)=>{
      if(to.endsWith("world.json")) process.exit(73);
      return await rename(from,to);
    };
    syncBuiltinESMExports();
    const {projectCommand}=await import(process.argv[1]);
    await projectCommand({storageRoot:process.argv[2],owner:{}}, "GaiaCreate",{project:"interrupted",locale:"tr",fixture:true});
  `,
      new URL("../storage/provider.ts", import.meta.url).href,
      storageRoot,
    ],
    { encoding: "utf8" }
  );
  assert.equal(child.status, 73, child.stderr);
  const asset = join(storageRoot, "projects", "interrupted", "assets", "sample-pixel");
  const bytes = await readFile(asset);
  assert.deepEqual(await call("GaiaProjects", {}), { projects: ["demo"] });
  await assert.rejects(call("GaiaOpen", { project: "interrupted" }));
  const result = (await call("GaiaCreate", {
    project: "interrupted",
    locale: "tr",
    fixture: true,
  })) as Opened;
  assert.deepEqual(result.missing, []);
  assert.deepEqual(await readFile(asset), bytes);
});
