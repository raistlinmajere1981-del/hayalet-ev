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
      throw new Error(`Required action-feedback recovery pattern was not found: ${label}`);
    }
    source = source.replace(search, replacement);
  }

  const normalized = source.endsWith("\n") ? source : `${source}\n`;
  const current = await readFile(absolutePath, "utf8");
  if (current === normalized) {
    return;
  }

  changedFiles.push(path);
  if (apply) {
    await writeFile(absolutePath, normalized, "utf8");
  }
}

await updateFile("rooms/pattern-room/ui/pattern-room-ui-runtime.ts", [
  {
    label: "entity-backed workspace summary",
    search: `  function createWorkspaceSummary() {
    const overlay = localState.getOverlay();
    const evidenceCount = viewModels.boardCategories.reduce((count, category) => {
      if (category.id !== "evidence") {
        return count;
      }
      return (
        count +
        category.pins.filter((pin) => {
          return pin.kind !== "placeholder";
        }).length
      );
    }, 0);
    const boardNoteCount = viewModels.boardCategories.reduce((count, category) => {
      if (category.id === "evidence") {
        return count;
      }
      return (
        count +
        category.pins.filter((pin) => {
          return pin.kind !== "placeholder";
        }).length
      );
    }, 0);

    return {
      subject: viewModels.subject,
      sourceCount: viewModels.sources.length,
      evidenceCount,
      boardNoteCount,
      connectionCount: domain.edges.length + overlay.localAuthoredEdges.length,
      reviewCount: caseReviewRuntimeState.history.length,
    };
  }`,
    replacement: `  function createWorkspaceSummary() {
    const overlay = localState.getOverlay();
    return {
      subject: viewModels.subject,
      sourceCount: viewModels.sources.length,
      evidenceCount: domain.evidence.length + overlay.localAuthoredEvidence.length,
      boardNoteCount:
        domain.nodes.filter((node) => {
          return node.nodeType !== "source";
        }).length + overlay.localAuthoredNodes.length,
      connectionCount: domain.edges.length + overlay.localAuthoredEdges.length,
      reviewCount: caseReviewRuntimeState.history.length,
    };
  }`,
  },
]);

await updateFile("scripts/tests/pattern-room-installed-ui-smoke-regressions-part1.test.ts", [
  {
    label: "fixture evidence metric",
    search: '      "1 kanıt",',
    replacement: '      "2 kanıt",',
  },
]);

await updateFile("rooms/pattern-room/ui/workspace.css", [
  {
    label: "success feedback border token",
    search: "border-color: var(--pattern-accent-green-alpha-42);",
    replacement: "border-color: var(--pattern-success-alpha-46);",
  },
  {
    label: "error feedback border token",
    search: "border-color: var(--pattern-accent-red-alpha-48);",
    replacement: "border-color: var(--pattern-danger-alpha-50);",
  },
  {
    label: "info feedback border token",
    search: "border-color: var(--pattern-accent-cyan-alpha-38);",
    replacement: "border-color: var(--pattern-text-alpha-18);",
  },
  {
    label: "feedback shadow token",
    search: "box-shadow: 0 var(--pattern-px-12) var(--pattern-px-36) var(--pattern-black-alpha-48);",
    replacement:
      "box-shadow: 0 var(--pattern-px-12) var(--pattern-px-36) var(--pattern-black-alpha-52);",
  },
  {
    label: "success feedback icon token",
    search: "color: var(--pattern-accent-green);",
    replacement: "color: var(--pattern-success);",
  },
  {
    label: "error feedback icon token",
    search: "color: var(--pattern-accent-red);",
    replacement: "color: var(--pattern-danger-text);",
  },
  {
    label: "info feedback icon token",
    search: "color: var(--pattern-accent-cyan);",
    replacement: "color: var(--pattern-text-muted);",
  },
]);

if (changedFiles.length === 0) {
  console.log("Pattern Room action-feedback recovery is already current.");
} else {
  console.log(`${apply ? "Applied" : "Would apply"}:`);
  changedFiles.forEach((path) => {
    console.log(`- ${path}`);
  });
}
