import { readFile, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const scriptDir = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(scriptDir, "../..");
const apply = process.argv.includes("--apply");
const path = "rooms/pattern-room/ui/panels/pattern-case-review-runtime-view.ts";
const absolutePath = resolve(repoRoot, path);
const source = await readFile(absolutePath, "utf8");
const search = "        summary.evidenceCandidatesAdded\n";
const replacement = "        summary.evidenceCandidatesAdded ?? 0\n";

if (source.includes(replacement)) {
  console.log("Evidence-candidate UI type fallback is already current.");
} else if (!source.includes(search)) {
  throw new Error("Required evidence-candidate metric pattern was not found.");
} else if (apply) {
  await writeFile(absolutePath, source.replace(search, replacement), "utf8");
  console.log(`Applied: ${path}`);
} else {
  console.log(`Would apply: ${path}`);
}
