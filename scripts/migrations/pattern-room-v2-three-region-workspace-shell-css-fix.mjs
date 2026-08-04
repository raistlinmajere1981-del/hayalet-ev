import { readFile, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const scriptDir = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(scriptDir, "../..");
const apply = process.argv.includes("--apply");
const path = "rooms/pattern-room/ui/workspace.css";
const absolutePath = resolve(repoRoot, path);
let source = await readFile(absolutePath, "utf8");

const replacements = [
  ["var(--pattern-black-alpha-20)", "var(--pattern-black-alpha-24)"],
  ["var(--pattern-px-230)", "var(--pattern-px-238)"],
  ["var(--pattern-px-220)", "var(--pattern-px-218)"],
  ["calc(var(--pattern-px-18) * -1)", "calc(0px - var(--pattern-px-18))"],
];

let changed = false;
for (const [search, replacement] of replacements) {
  if (source.includes(search)) {
    source = source.replaceAll(search, replacement);
    changed = true;
  }
}

if (!changed) {
  console.log("Three-region shell CSS tokens are already current.");
} else if (apply) {
  await writeFile(absolutePath, source.endsWith("\n") ? source : `${source}\n`, "utf8");
  console.log(`Applied: ${path}`);
} else {
  console.log(`Would apply: ${path}`);
}
