import { readFile, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const scriptDir = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(scriptDir, "../..");
const apply = process.argv.includes("--apply");
const path = "rooms/pattern-room/shared/state/pattern-room-snapshot.ts";
const absolutePath = resolve(repoRoot, path);
const current = await readFile(absolutePath, "utf8");

const functionStart = current.indexOf("function restoreOverlaySnapshot(");
if (functionStart < 0) {
  throw new Error("restoreOverlaySnapshot function was not found.");
}

const debatePhaseIndex = current.indexOf("  const debatePhase = healDebatePhase(", functionStart);
if (debatePhaseIndex < 0) {
  throw new Error("restoreOverlaySnapshot debate phase block was not found.");
}

const returnStart = current.indexOf("  return {\n", debatePhaseIndex);
const deskNodeIndex = current.indexOf("    deskNodeIds:", returnStart);
if (returnStart < 0 || deskNodeIndex < 0) {
  throw new Error("restoreOverlaySnapshot return block was not found.");
}

const currentPrefix = current.slice(returnStart, deskNodeIndex);
const expectedPrefix = `  return {\n    ...(snapshotOverlay.caseLabel === undefined\n      ? {}\n      : {\n          caseLabel:\n            snapshotOverlay.caseLabel.trim() ||\n            domainMock.topic.label?.trim() ||\n            "Yeni Araştırma",\n        }),\n    ...(snapshotOverlay.researchQuestion === undefined\n      ? {}\n      : { researchQuestion: snapshotOverlay.researchQuestion.trim() }),\n`;

let next = current;
if (currentPrefix === expectedPrefix) {
  console.log(`Already current: ${path}`);
} else {
  if (!currentPrefix.includes("caseLabel") || !currentPrefix.includes("researchQuestion")) {
    throw new Error("The snapshot return prefix did not contain the expected case identity fields.");
  }
  next = `${current.slice(0, returnStart)}${expectedPrefix}${current.slice(deskNodeIndex)}`;
  if (apply) {
    await writeFile(absolutePath, next.endsWith("\n") ? next : `${next}\n`, "utf8");
    console.log(`Applied: ${path}`);
  } else {
    console.log(`Would apply: ${path}`);
  }
}
