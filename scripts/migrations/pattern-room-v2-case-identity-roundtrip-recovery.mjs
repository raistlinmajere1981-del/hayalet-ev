import { readFile, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const scriptDir = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(scriptDir, "../..");
const apply = process.argv.includes("--apply");
const changedFiles = [];

async function updateFile(path, transform) {
  const absolutePath = resolve(repoRoot, path);
  const current = await readFile(absolutePath, "utf8");
  const next = transform(current);
  const normalized = next.endsWith("\n") ? next : `${next}\n`;

  if (normalized === current) {
    return;
  }

  changedFiles.push(path);
  if (apply) {
    await writeFile(absolutePath, normalized, "utf8");
  }
}

function replaceOneOfRequired(source, searches, replacement, label) {
  if (source.includes(replacement)) {
    return source;
  }
  const search = searches.find((candidate) => source.includes(candidate));
  if (search === undefined) {
    throw new Error(`Required case identity round-trip pattern was not found: ${label}`);
  }
  return source.replace(search, replacement);
}

await updateFile("scripts/tests/pattern-room-case-review-dispatch-regressions.test.ts", (source) => {
  return replaceOneOfRequired(
    source,
    [
      "  assert.match(draft.payload.payload.text, /AI2 10\\. Adam/);",
      "  assert.match(draft.payload.payload.text, /AI2 — 10\\. Adam/);",
    ],
    "  assert.match(draft.payload.payload.text, /role: AI2 — 10\\. Adam/);",
    "AI2 dispatch role label"
  );
});

await updateFile("rooms/pattern-room/shared/state/pattern-room-snapshot.ts", (source) => {
  return replaceOneOfRequired(
    source,
    [
      `  return {\n    caseLabel:\n      snapshotOverlay.caseLabel?.trim() ||\n      domainMock.topic.label?.trim() ||\n      "Yeni Araştırma",\n    researchQuestion:\n      snapshotOverlay.researchQuestion === undefined\n        ? (domainMock.topic.description?.trim() ?? "")\n        : snapshotOverlay.researchQuestion.trim(),\n    deskNodeIds: filterUniqueIds(snapshotOverlay.deskNodeIds, hasNode),`,
      `  return {\n    caseLabel: snapshotOverlay.caseLabel?.trim() || domainMock.topic.label,\n    researchQuestion:\n      snapshotOverlay.researchQuestion === undefined\n        ? domainMock.topic.description\n        : snapshotOverlay.researchQuestion.trim(),\n    deskNodeIds: filterUniqueIds(snapshotOverlay.deskNodeIds, hasNode),`,
    ],
    `  return {\n    ...(snapshotOverlay.caseLabel === undefined\n      ? {}\n      : {\n          caseLabel:\n            snapshotOverlay.caseLabel.trim() ||\n            domainMock.topic.label?.trim() ||\n            "Yeni Araştırma",\n        }),\n    ...(snapshotOverlay.researchQuestion === undefined\n      ? {}\n      : { researchQuestion: snapshotOverlay.researchQuestion.trim() }),\n    deskNodeIds: filterUniqueIds(snapshotOverlay.deskNodeIds, hasNode),`,
    "optional case identity snapshot healing"
  );
});

if (changedFiles.length === 0) {
  console.log("Pattern Room case identity round-trip recovery is already current.");
} else {
  console.log(`${apply ? "Applied" : "Would apply"}:`);
  changedFiles.forEach((path) => console.log(`- ${path}`));
}
