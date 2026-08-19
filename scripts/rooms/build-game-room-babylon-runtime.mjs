import { copyFile, mkdir } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { build } from "esbuild";

const scriptsDirectory = dirname(fileURLToPath(import.meta.url));
const projectRoot = resolve(scriptsDirectory, "../..");
const vendorDirectory = resolve(projectRoot, "rooms/game-room/main-functions/yahtzee/vendor");

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
  copyFile(
    resolve(projectRoot, "node_modules/@babylonjs/core/license.md"),
    resolve(vendorDirectory, "LICENSE.babylonjs.md")
  ),
  copyFile(
    resolve(projectRoot, "node_modules/@babylonjs/core/NOTICE.md"),
    resolve(vendorDirectory, "NOTICE.babylonjs.md")
  ),
]);
