import assert from "node:assert/strict";
import fs from "node:fs";
import { cp, link, mkdir, mkdtemp, readFile, rm, symlink, writeFile } from "node:fs/promises";
import { syncBuiltinESMExports } from "node:module";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { pathToFileURL } from "node:url";
import test, { type TestContext } from "node:test";
import { provisionAuthorizationStore } from "../storage/enrollment-store.ts";
import { openFieldAuthority } from "../storage/enrollment-service.ts";

const base = "data/room-storage/gaia-room";
const world = base + "/projects/demo/world.json";
const status = base + "/projects/demo/device-status.json";
const asset = base + "/projects/demo/assets/plan.png";
const other = "data/room-storage/other-room/projects/demo/world.json";
const paths = [world, status, asset, other];

interface BackupApi {
  createBackup(input: object): Promise<{ bundlePath: string }>;
  previewBackupRestore(input: object): Promise<{
    fileCount: number;
    overwrittenFilesCount: number;
    skippedGaiaStateFiles: number;
    warnings: string[];
  }>;
  restoreBackup(
    input: object
  ): Promise<{ restoredFiles: number; skippedGaiaStateFiles: number; warnings: string[] }>;
  loadProtectedBackupPathFilter(): Promise<(path: string) => boolean>;
}

async function fixture(t: TestContext) {
  const dir = await mkdtemp(join(tmpdir(), "gaia-restore-"));
  t.after(() => rm(dir, { recursive: true, force: true }));
  const put = async (path: string, bytes: string) => {
    await mkdir(dirname(join(dir, path)), { recursive: true, mode: 0o700 });
    await writeFile(join(dir, path), bytes);
  };
  const get = (path: string) => readFile(join(dir, path), "utf8");
  for (const path of [
    "scripts/backup-runtime/index.mjs",
    "shared/gaia-storage-lock.mjs",
    "config/backup-scopes.json",
  ]) {
    await mkdir(dirname(join(dir, path)), { recursive: true });
    await cp(new URL("../../../../" + path, import.meta.url), join(dir, path));
  }
  for (const path of paths) await put(path, "saved");
  const api = (await import(
    pathToFileURL(join(dir, "scripts/backup-runtime/index.mjs")).href
  )) as BackupApi;
  const { bundlePath } = await api.createBackup({ scopeIds: ["data"] });
  for (const path of paths) await put(path, "current");
  const request = { filePath: bundlePath, safetyBackup: false };
  return { dir, root: join(dir, base), put, get, api, bundlePath, request };
}

test("the current destination decides both restore counts, including archives from before enrollment", async (t) => {
  const f = await fixture(t);
  const before = await f.api.previewBackupRestore(f.request);
  assert.equal(before.fileCount, 4);
  assert.equal(before.skippedGaiaStateFiles, 0);
  await provisionAuthorizationStore(f.root);
  const after = await f.api.previewBackupRestore(f.request);
  assert.equal(after.fileCount, 2);
  assert.equal(after.overwrittenFilesCount, 2);
  assert.equal(after.skippedGaiaStateFiles, 2);
  assert.match(after.warnings.join(" "), /Gaia/);
  const result = await f.api.restoreBackup(f.request);
  assert.equal(result.restoredFiles, after.fileCount);
  assert.equal(result.skippedGaiaStateFiles, after.skippedGaiaStateFiles);
  assert.match(result.warnings.join(" "), /Gaia/);
  assert.deepEqual(await Promise.all(paths.map(f.get)), ["current", "current", "saved", "saved"]);
});

test(
  "partial field setup, damaged entries and dangling markers keep both Gaia state files protected",
  { skip: !process.getuid },
  async (t) => {
    for (const name of ["field", ".field-provisioned"]) {
      for (const kind of ["directory", "file", "dangling link"]) {
        await t.test(name + " as " + kind, async (sub) => {
          const f = await fixture(sub),
            relative = base + "/" + name;
          if (kind === "directory") await f.put(relative + "/incomplete", "synthetic-private");
          else if (kind === "file") await f.put(relative, "synthetic-private");
          else await symlink(join(f.root, "absent"), join(f.root, name));
          const { bundlePath } = await f.api.createBackup({ scopeIds: ["data"] });
          const archive = JSON.parse(await readFile(bundlePath, "utf8")) as {
            files: { path: string; contentBase64: string }[];
          };
          assert.deepEqual(archive.files.map((entry) => entry.path).sort(), [...paths].sort());
          assert.equal((await f.api.previewBackupRestore(f.request)).skippedGaiaStateFiles, 2);
          assert.equal((await f.api.restoreBackup(f.request)).restoredFiles, 2);
          assert.deepEqual(await Promise.all(paths.map(f.get)), [
            "current",
            "current",
            "saved",
            "saved",
          ]);
        });
      }
    }
  }
);

test("clean Gaia restore preserves user files and excludes first-time provisioning throughout publication", async (t) => {
  const f = await fixture(t);
  await rm(f.root, { recursive: true });
  const preview = await f.api.previewBackupRestore(f.request);
  assert.equal(preview.fileCount, 4);
  await assert.rejects(readFile(join(f.root, ".field-provisioned")), { code: "ENOENT" });
  const write = fs.promises.writeFile;
  let guarded = 0;
  const hook = t.mock.method(
    fs.promises,
    "writeFile",
    async (...args: Parameters<typeof write>) => {
      if (args[0] === join(f.dir, status) || args[0] === join(f.dir, world)) {
        await assert.rejects(provisionAuthorizationStore(f.root), { code: "EADDRINUSE" });
        guarded++;
      }
      return write(...args);
    }
  );
  syncBuiltinESMExports();
  try {
    assert.equal((await f.api.restoreBackup(f.request)).restoredFiles, 4);
    assert.equal(guarded, 2);
  } finally {
    hook.mock.restore();
    syncBuiltinESMExports();
  }
  assert.deepEqual(await Promise.all(paths.map(f.get)), ["saved", "saved", "saved", "saved"]);
  await provisionAuthorizationStore(f.root);
});

test("a busy first-provisioning lock excludes only Gaia state and an interrupted restore releases the lock", async (t) => {
  const f = await fixture(t);
  const owner = await openFieldAuthority(f.root);
  try {
    assert.equal((await f.api.previewBackupRestore(f.request)).skippedGaiaStateFiles, 2);
    assert.equal((await f.api.restoreBackup(f.request)).restoredFiles, 2);
    assert.deepEqual(await Promise.all(paths.map(f.get)), ["current", "current", "saved", "saved"]);
  } finally {
    await owner.close();
  }
  const archive = JSON.parse(await readFile(f.bundlePath, "utf8")) as {
    files: { path: string; checksum: string }[];
  };
  archive.files.find((entry) => entry.path === world)!.checksum = "invalid";
  await writeFile(f.bundlePath, JSON.stringify(archive));
  await assert.rejects(f.api.restoreBackup(f.request), { code: "CHECKSUM_MISMATCH" });
  await provisionAuthorizationStore(f.root);
  assert.equal((await f.api.restoreBackup(f.request)).skippedGaiaStateFiles, 2);
});

test(
  "preview and execution reject linked restore destinations before any publication",
  { skip: !process.getuid },
  async (t) => {
    const f = await fixture(t);
    await provisionAuthorizationStore(f.root);
    const alias = join(f.dir, other);
    await rm(alias);
    for (const create of [symlink, link]) {
      await create(join(f.dir, world), alias);
      await assert.rejects(f.api.previewBackupRestore(f.request), { code: "UNSAFE_RESTORE_PATH" });
      await assert.rejects(f.api.restoreBackup(f.request), { code: "UNSAFE_RESTORE_PATH" });
      assert.equal(await f.get(asset), "current");
      assert.equal(await f.get(world), "current");
      await rm(alias);
    }
  }
);

test("Drive file selection uses the current private-path policy without contacting Drive", async (t) => {
  const f = await fixture(t);
  await f.put(base + "/field/authorization.json", "synthetic private");
  await f.put(base + "/field/pki/server.pem", "synthetic private");
  await f.put(base + "/.field-provisioned/x509/sha256", "synthetic pin");
  const { collectDriveFiles } = (await import(
    new URL("../../../../scripts/sync-to-drive.js", import.meta.url).href
  )) as {
    collectDriveFiles(root: string, isProtected: (p: string) => boolean): string[];
  };
  const selected = collectDriveFiles(f.dir, await f.api.loadProtectedBackupPathFilter());
  assert.ok(selected.includes(join(f.dir, world)));
  assert.ok(selected.includes(join(f.dir, other)));
  assert.ok(
    !selected.some(
      (p) => p.startsWith(join(f.root, "field")) || p.startsWith(join(f.root, ".field-provisioned"))
    )
  );
});
