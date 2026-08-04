import { readFile, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const scriptDir = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(scriptDir, "../..");
const apply = process.argv.includes("--apply");
const path = "scripts/tests/pattern-room-installed-ui-smoke-regressions-part6.test.ts";
const absolutePath = resolve(repoRoot, path);
let source = await readFile(absolutePath, "utf8");

function replaceRequired(search, replacement, label) {
  if (!source.includes(search)) {
    throw new Error(`Required recovery pattern was not found: ${label}`);
  }
  source = source.replace(search, replacement);
}

replaceRequired(
  `    evidence: 0,\n    nodes: 6,\n    edges: 1,`,
  `    evidence: 0,\n    nodes: 6,\n    edges: 1,\n    autosaves: 1,`,
  "all-mode autosave expectation"
);

replaceRequired(
  `    evidence: 0,\n    nodes: 1,\n    edges: 0,`,
  `    evidence: 0,\n    nodes: 1,\n    edges: 0,\n    autosaves: 1,`,
  "open-questions autosave expectation"
);

replaceRequired(
  `    mode: "evidence-suggestions-only",\n    selector: "[data-pattern-case-review-apply-evidence-suggestions='true']",\n    notes: 0,\n    evidence: 0,\n    nodes: 0,\n    edges: 0,`,
  `    mode: "evidence-suggestions-only",\n    selector: "[data-pattern-case-review-apply-evidence-suggestions='true']",\n    notes: 0,\n    evidence: 0,\n    nodes: 0,\n    edges: 0,\n    autosaves: 0,`,
  "evidence-candidate autosave expectation"
);

replaceRequired(
  "only after click and autosaves additive changes",
  "only after click and autosaves only local mutations",
  "test description"
);

replaceRequired(
  `        1\n      );\n\n      const applyEvent`,
  `        applyCase.autosaves\n      );\n\n      const applyEvent`,
  "autosave count assertion"
);

if (apply) {
  await writeFile(absolutePath, source.endsWith("\n") ? source : `${source}\n`, "utf8");
}

console.log(`${apply ? "Applied" : "Would apply"}: ${path}`);
