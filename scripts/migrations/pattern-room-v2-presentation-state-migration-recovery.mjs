import { readFile, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const scriptDir = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(scriptDir, "../..");
const apply = process.argv.includes("--apply");
const path = "scripts/migrations/pattern-room-v2-presentation-state-persistence.mjs";
const absolutePath = resolve(repoRoot, path);
const current = await readFile(absolutePath, "utf8");

function replaceMigrationStep(source, label, replacement) {
  const labelToken = `    "${label}"`;
  const labelIndex = source.indexOf(labelToken);
  if (labelIndex < 0) {
    throw new Error(`Migration step label was not found: ${label}`);
  }

  const startIndex = source.lastIndexOf("  next = replaceRequired(", labelIndex);
  if (startIndex < 0) {
    throw new Error(`Migration step start was not found: ${label}`);
  }

  const endMarker = "\n  );";
  const endIndex = source.indexOf(endMarker, labelIndex);
  if (endIndex < 0) {
    throw new Error(`Migration step end was not found: ${label}`);
  }

  return `${source.slice(0, startIndex)}${replacement}${source.slice(endIndex + endMarker.length)}`;
}

const staleSelectionStep = `  next = insertBeforeRequired(
    next,
    [
      "    if (",
      "      selectedConnectionId !== null &&",
      "      !viewModels.connections.some((connection) => connection.id === selectedConnectionId)",
      "    ) {",
      "      selectedConnectionId = null;",
      "    }",
    ].join("\\n"),
    [
      "    if (",
      "      selectedNodeId !== null &&",
      "      !viewModels.boardCategories.some((category) =>",
      "        category.pins.some((pin) => pin.id === selectedNodeId)",
      "      )",
      "    ) {",
      "      selectedNodeId = null;",
      "    }",
    ].join("\\n"),
    "stale presentation selection cleanup"
  );`;

const restorePresentationStep = `  next = replaceRequired(
    next,
    [
      "      activeView = restoredState.activeView;",
      '      investigationCanvasMode = activeView === "desk" ? "graph" : "board";',
      '      activeWorkspaceSection = "default";',
      "      selectedArchiveSourceId = null;",
    ].join("\\n"),
    [
      "      activeView = restoredState.activeView;",
      "      investigationCanvasMode =",
      "        restoredState.presentation?.canvasMode ??",
      '        (activeView === "desk" ? "graph" : "board");',
      '      if (activeView === "board" || activeView === "desk") {',
      '        activeView = investigationCanvasMode === "graph" ? "desk" : "board";',
      "      }",
      '      activeWorkspaceSection = "default";',
      "      selectedNodeId = restoredState.presentation?.selectedBoardItemId ?? null;",
      "      selectedConnectionId = restoredState.presentation?.selectedConnectionId ?? null;",
      "      selectedArchiveSourceId = null;",
    ].join("\\n"),
    "restore presentation state"
  );`;

let next = replaceMigrationStep(
  current,
  "stale presentation selection cleanup",
  staleSelectionStep
);
next = replaceMigrationStep(next, "restore presentation state", restorePresentationStep);

if (next === current) {
  console.log(`Already current: ${path}`);
} else if (apply) {
  await writeFile(absolutePath, next.endsWith("\n") ? next : `${next}\n`, "utf8");
  console.log(`Applied: ${path}`);
} else {
  console.log(`Would apply: ${path}`);
}
