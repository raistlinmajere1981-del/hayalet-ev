import { readFile, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const scriptDir = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(scriptDir, "../..");
const apply = process.argv.includes("--apply");
const changedFiles = [];

async function readRepoFile(path) {
  return await readFile(resolve(repoRoot, path), "utf8");
}

async function writeRepoFile(path, content) {
  const normalized = content.endsWith("\n") ? content : `${content}\n`;
  const current = await readRepoFile(path);
  if (current === normalized) {
    return;
  }
  changedFiles.push(path);
  if (apply) {
    await writeFile(resolve(repoRoot, path), normalized, "utf8");
  }
}

function replaceRequired(content, search, replacement, label) {
  if (!content.includes(search)) {
    throw new Error(`Required regression-fix pattern was not found: ${label}`);
  }
  return content.replace(search, replacement);
}

async function fixPromotionFixtureSource() {
  const path = "scripts/tests/pattern-room-evidence-candidate-regressions.test.ts";
  let source = await readRepoFile(path);
  if (!source.includes('"source-001"')) {
    return;
  }

  source = source.replaceAll('"source-001"', '"source-navigation-log"');
  await writeRepoFile(path, source);
}

async function fixCleanupOverlayExpectation() {
  const path = "scripts/tests/pattern-room-cleanup-state-regressions.test.ts";
  let source = await readRepoFile(path);
  if (source.includes("    localEvidenceCandidates: [],")) {
    return;
  }

  source = replaceRequired(
    source,
    `    localAuthoredEvidence: [],\n    localAuthoredEdges: [],`,
    `    localAuthoredEvidence: [],\n    localEvidenceCandidates: [],\n    localAuthoredEdges: [],`,
    "cleanup empty overlay candidate collection"
  );
  await writeRepoFile(path, source);
}

async function fixOverlayShapeExpectation() {
  const path = "scripts/tests/pattern-room-source-import-apply-regressions.test.ts";
  let source = await readRepoFile(path);
  if (source.includes('    "localEvidenceCandidates",')) {
    return;
  }

  source = replaceRequired(
    source,
    `    "localAuthoredSources",\n    "localNotes",`,
    `    "localAuthoredSources",\n    "localEvidenceCandidates",\n    "localNotes",`,
    "overlay shape candidate key"
  );
  await writeRepoFile(path, source);
}

await fixPromotionFixtureSource();
await fixCleanupOverlayExpectation();
await fixOverlayShapeExpectation();

if (changedFiles.length === 0) {
  console.log("Evidence-candidate regression expectations are already current.");
} else {
  console.log(`${apply ? "Applied" : "Would apply"}:`);
  changedFiles.forEach((path) => {
    console.log(`- ${path}`);
  });
}
