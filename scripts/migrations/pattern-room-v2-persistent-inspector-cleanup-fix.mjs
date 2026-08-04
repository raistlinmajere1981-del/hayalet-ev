import { readFile, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const scriptDir = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(scriptDir, "../..");
const apply = process.argv.includes("--apply");
const changedFiles = [];

async function updateFile(path, replacements) {
  const absolutePath = resolve(repoRoot, path);
  let source = await readFile(absolutePath, "utf8");

  for (const { search, replacement, label } of replacements) {
    if (source.includes(replacement)) {
      continue;
    }
    if (!source.includes(search)) {
      throw new Error(`Required cleanup recovery pattern was not found: ${label}`);
    }
    source = source.replace(search, replacement);
  }

  const current = await readFile(absolutePath, "utf8");
  const normalized = source.endsWith("\n") ? source : `${source}\n`;
  if (current === normalized) {
    return;
  }

  changedFiles.push(path);
  if (apply) {
    await writeFile(absolutePath, normalized, "utf8");
  }
}

await updateFile("scripts/tests/pattern-room-cleanup-state-regressions.test.ts", [
  {
    label: "cleanup integration path",
    search:
      '    "rooms/pattern-room/ui/panels/pattern-board-panel.ts",\n    "rooms/pattern-room/ui/panels/pattern-report-panel.ts",',
    replacement:
      '    "rooms/pattern-room/ui/panels/pattern-board-panel.ts",\n    "rooms/pattern-room/ui/panels/pattern-investigation-inspector.ts",\n    "rooms/pattern-room/ui/panels/pattern-report-panel.ts",',
  },
  {
    label: "cleanup inspector source read",
    search:
      '  const boardPanelSource = await readFile(\n    resolve("rooms/pattern-room/ui/panels/pattern-board-panel.ts"),\n    "utf8"\n  );',
    replacement:
      '  const investigationInspectorSource = await readFile(\n    resolve("rooms/pattern-room/ui/panels/pattern-investigation-inspector.ts"),\n    "utf8"\n  );',
  },
  {
    label: "cleanup inspector action assertion",
    search: '  assert.equal(boardPanelSource.includes("patternRemoveBoardItem"), true);',
    replacement:
      '  assert.equal(investigationInspectorSource.includes("patternRemoveBoardItem"), true);',
  },
]);

await updateFile("scripts/migrations/pattern-room-v2-persistent-investigation-inspector.mjs", [
  {
    label: "migration lint initialization",
    search:
      '  let current = null;\n  try {\n    current = await readRepoFile(path);\n  } catch {\n    current = null;\n  }',
    replacement:
      '  let current;\n  try {\n    current = await readRepoFile(path);\n  } catch {\n    current = null;\n  }',
  },
]);

if (changedFiles.length === 0) {
  console.log("Pattern Room persistent inspector cleanup recovery is already current.");
} else {
  console.log(`${apply ? "Applied" : "Would apply"}:`);
  changedFiles.forEach((path) => {
    console.log(`- ${path}`);
  });
}
