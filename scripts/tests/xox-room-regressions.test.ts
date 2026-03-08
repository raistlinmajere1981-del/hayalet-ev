import test from "node:test";
import assert from "node:assert/strict";
import { cp, mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { pathToFileURL } from "node:url";
import { validateRoomManifest } from "../../src/types/rooms.ts";

const projectRoot = process.cwd();
const roomId = "xox";
const roomDir = join(projectRoot, "rooms", roomId);
const manifestPath = join(roomDir, "manifest.json");
const requiredFiles = [
  "manifest.json",
  "host/index.js",
  "protocols/xox-start.md",
  "ui/index.html",
  "ui/index.js",
  "ui/style.css",
];

test("xox room workspace contains the required files", () => {
  requiredFiles.forEach((relativePath) => {
    assert.equal(existsSync(join(roomDir, relativePath)), true, relativePath);
  });
});

test("xox room manifest validates against the room schema", async () => {
  const manifest = JSON.parse(await readFile(manifestPath, "utf8"));
  const validation = validateRoomManifest(manifest);

  assert.equal(validation.valid, true);
  assert.equal(validation.manifest?.id, "xox");
  assert.equal(validation.manifest?.uiEntry, "ui/index.html");
  assert.equal(validation.manifest?.hostEntry, "host/index.js");
});

test("build-room-bundle packs the xox room workspace and excludes dist folders", async () => {
  const tempRoot = await mkdtemp(join(tmpdir(), "xox-room-"));
  const workspaceRoot = join(tempRoot, "rooms");
  const tempRoomDir = join(workspaceRoot, roomId);
  const outputFile = join(tempRoot, "bundle", "xox.hevroom.json");

  try {
    await mkdir(workspaceRoot, { recursive: true });
    await cp(roomDir, tempRoomDir, { recursive: true });
    await mkdir(join(tempRoomDir, "dist"), { recursive: true });
    await mkdir(join(tempRoomDir, "node_modules", "ignore-me"), { recursive: true });
    await writeFile(join(tempRoomDir, "dist", "ignored.txt"), "ignored", "utf8");
    await writeFile(join(tempRoomDir, "node_modules", "ignore-me", "ignored.txt"), "ignored", "utf8");

    const scriptPath = pathToFileURL(join(projectRoot, "scripts", "rooms", "build-room-bundle.mjs"))
      .href;
    const { buildRoomBundle } = await import(scriptPath);
    const result = await buildRoomBundle(roomId, {
      workspaceRoot,
      outputFile,
    });

    assert.equal(result.outputFile, outputFile);
    assert.equal(existsSync(outputFile), true);

    const bundle = JSON.parse(await readFile(outputFile, "utf8")) as {
      manifest: { id: string };
      files: Record<string, { encoding: string; content: string }>;
    };

    assert.equal(bundle.manifest.id, "xox");
    requiredFiles.forEach((relativePath) => {
      assert.equal(typeof bundle.files[relativePath]?.content, "string", relativePath);
      assert.equal(bundle.files[relativePath]?.encoding, "base64", relativePath);
    });
    assert.equal("dist/ignored.txt" in bundle.files, false);
    assert.equal("node_modules/ignore-me/ignored.txt" in bundle.files, false);
  } finally {
    await rm(tempRoot, { recursive: true, force: true });
  }
});
