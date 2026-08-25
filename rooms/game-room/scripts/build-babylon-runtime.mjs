import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { build } from "esbuild";

const scriptsDirectory = dirname(fileURLToPath(import.meta.url));
const gameRoomDirectory = resolve(scriptsDirectory, "..");
const projectRoot = resolve(gameRoomDirectory, "../..");
const vendorDirectory = resolve(gameRoomDirectory, "main-functions/yahtzee/vendor");

async function copyNormalizedTextFile(sourcePath, targetPath) {
  const content = (await readFile(sourcePath, "utf8")).replace(/\r\n?/g, "\n");
  const existingContent = await readFile(targetPath, "utf8").catch(() => null);
  if (existingContent === content) return;
  await writeFile(targetPath, content, "utf8");
}

await mkdir(vendorDirectory, { recursive: true });

await build({
  entryPoints: [resolve(vendorDirectory, "babylon-runtime-entry.js")],
  outfile: resolve(vendorDirectory, "babylon.min.js"),
  bundle: true,
  format: "iife",
  platform: "browser",
  target: ["es2020"],
  minify: true,
  sourcemap: false,
  treeShaking: true,
  legalComments: "none",
  banner: {
    js: "/*! Babylon.js room runtime | Apache-2.0 | see LICENSE.babylonjs.md and NOTICE.babylonjs.md */",
  },
});

await Promise.all([
  copyNormalizedTextFile(
    resolve(projectRoot, "node_modules/@babylonjs/core/license.md"),
    resolve(vendorDirectory, "LICENSE.babylonjs.md")
  ),
  copyNormalizedTextFile(
    resolve(projectRoot, "node_modules/@babylonjs/core/NOTICE.md"),
    resolve(vendorDirectory, "NOTICE.babylonjs.md")
  ),
]);
