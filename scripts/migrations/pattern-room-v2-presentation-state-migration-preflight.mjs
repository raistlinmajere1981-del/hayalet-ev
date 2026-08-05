import { readFile, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const scriptDir = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(scriptDir, "../..");
const apply = process.argv.includes("--apply");
const path = "scripts/migrations/pattern-room-v2-presentation-state-persistence.mjs";
const absolutePath = resolve(repoRoot, path);
const current = await readFile(absolutePath, "utf8");

const obsoleteSearchLine = '      "      selectedConnectionId = null;",';
const lines = current.split("\n");
let removed = false;
const next = lines
  .filter((line) => {
    if (!removed && line === obsoleteSearchLine) {
      removed = true;
      return false;
    }
    return true;
  })
  .join("\n");

if (!removed) {
  console.log(`Already current: ${path}`);
} else if (apply) {
  await writeFile(absolutePath, next.endsWith("\n") ? next : `${next}\n`, "utf8");
  console.log(`Applied: ${path}`);
} else {
  console.log(`Would apply: ${path}`);
}
