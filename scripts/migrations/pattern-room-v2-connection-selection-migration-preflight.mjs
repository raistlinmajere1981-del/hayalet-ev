import { readFile, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const scriptDir = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(scriptDir, "../..");
const apply = process.argv.includes("--apply");
const path = "scripts/migrations/pattern-room-v2-connection-selection-and-editing.mjs";
const absolutePath = resolve(repoRoot, path);
const current = await readFile(absolutePath, "utf8");

let next = current
  .split("\n")
  .map((line) => {
    if (line.includes('"  edgeType.name =') && line.includes("edgeType")) {
      return `      '  edgeType.name = "edgeType";',`;
    }
    if (
      line.includes(
        '"  text: PatternWorkspaceTranslator = createPatternWorkspaceTranslator('
      )
    ) {
      return `      '  text: PatternWorkspaceTranslator = createPatternWorkspaceTranslator("tr", null)',`;
    }
    if (line.includes('"  return mode ===') && line.includes("graph")) {
      return `      '  return mode === "graph"',`;
    }
    return line;
  })
  .join("\n");

const optionalOverlayRepair = [
  "  next = next",
  "    .replaceAll(",
  '      "  const localNode = overlay.localAuthoredNodes.find((node) => node.id === entityId);",',
  '      "  const localNode = overlay?.localAuthoredNodes.find((node) => node.id === entityId);"',
  "    )",
  "    .replaceAll(",
  '      "  const localSource = overlay.localAuthoredSources.find((source) => source.id === entityId);",',
  '      "  const localSource = overlay?.localAuthoredSources.find((source) => source.id === entityId);"',
  "    )",
  "    .replaceAll(",
  '      "  const localEvidence = overlay.localAuthoredEvidence.find((evidence) => evidence.id === entityId);",',
  '      "  const localEvidence = overlay?.localAuthoredEvidence.find((evidence) => evidence.id === entityId);"',
  "    );",
].join("\n");

if (!next.includes(optionalOverlayRepair)) {
  const marker = [
    "  next = insertBeforeRequired(",
    "    next,",
    '    "function adaptLocalConnectionBullet(",',
  ].join("\n");
  if (!next.includes(marker)) {
    throw new Error("Connection projection insertion marker was not found.");
  }
  next = next.replace(marker, `${optionalOverlayRepair}\n\n${marker}`);
}

const normalized = next.endsWith("\n") ? next : `${next}\n`;
if (normalized === current) {
  console.log(`Already current: ${path}`);
} else if (apply) {
  await writeFile(absolutePath, normalized, "utf8");
  console.log(`Applied: ${path}`);
} else {
  console.log(`Would apply: ${path}`);
}
