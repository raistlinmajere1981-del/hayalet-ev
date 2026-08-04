import { readFile, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const scriptDir = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(scriptDir, "../..");
const apply = process.argv.includes("--apply");
const path = "scripts/migrations/pattern-room-v2-case-identity-and-packet-integrity.mjs";
const absolutePath = resolve(repoRoot, path);
const current = await readFile(absolutePath, "utf8");
const escapedQuote = String.fromCharCode(92, 34);
const next = current.split(escapedQuote).join('"');

if (next === current) {
  console.log(`Already current: ${path}`);
} else if (apply) {
  await writeFile(absolutePath, next.endsWith("\n") ? next : `${next}\n`, "utf8");
  console.log(`Applied: ${path}`);
} else {
  console.log(`Would apply: ${path}`);
}
