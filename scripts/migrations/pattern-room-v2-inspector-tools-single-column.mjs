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

  if (current === normalized) {
    return;
  }

  changedFiles.push(path);
  if (apply) {
    await writeFile(absolutePath, normalized, "utf8");
  }
}

function replaceRequired(source, search, replacement, label) {
  if (source.includes(replacement)) {
    return source;
  }
  if (!source.includes(search)) {
    throw new Error(`Required inspector layout pattern was not found: ${label}`);
  }
  return source.replace(search, replacement);
}

await updateFile("rooms/pattern-room/ui/workspace.css", (source) => {
  let next = replaceRequired(
    source,
    `.pattern-room-board-inspector .pattern-room-inline-authoring {\n  grid-template-columns: 1fr;\n}`,
    `.pattern-room-board-inspector-tools .pattern-room-inline-authoring {\n  grid-template-columns: minmax(0, 1fr);\n  align-items: start;\n}\n\n.pattern-room-board-inspector-tools .pattern-room-inline-disclosure,\n.pattern-room-board-inspector-tools .pattern-room-inline-form {\n  min-width: 0;\n  width: 100%;\n}\n\n.pattern-room-board-inspector-tools .pattern-room-inline-summary {\n  min-height: var(--pattern-px-42);\n  padding-inline: var(--pattern-px-10);\n}\n\n.pattern-room-board-inspector-tools .pattern-room-inline-form {\n  grid-template-columns: minmax(0, 1fr);\n  padding: var(--pattern-px-10);\n}`,
    "obsolete board inspector authoring selector"
  );

  if (!next.includes("INSPECTOR QUICK TOOLS — single-column authoring")) {
    next = next.replace(
      `.pattern-room-board-inspector-tools {\n  display: grid;`,
      `/* ─────────────────────────────────────────\n   INSPECTOR QUICK TOOLS — single-column authoring\n───────────────────────────────────────── */\n.pattern-room-board-inspector-tools {\n  display: grid;`
    );
  }

  return next;
});

await updateFile(".rovo/pattern-room-v2-progress.md", (source) => {
  if (source.includes("Completed: persistent inspector quick-tool density")) {
    return source;
  }

  const marker = "## Next implementation steps";
  const section = `## Completed: persistent inspector quick-tool density\n\n- Board authoring disclosures now stack in a single full-width column inside the persistent right inspector.\n- Node, evidence and connection forms no longer inherit the three-column desktop authoring grid.\n- Inspector form controls keep full available width without horizontal compression.\n\n`;

  if (!source.includes(marker)) {
    return `${source.trimEnd()}\n\n${section}`;
  }
  return source.replace(marker, `${section}${marker}`);
});

if (changedFiles.length === 0) {
  console.log("Pattern Room inspector quick tools are already single-column.");
} else {
  console.log(`${apply ? "Applied" : "Would apply"}:`);
  changedFiles.forEach((path) => console.log(`- ${path}`));
}
