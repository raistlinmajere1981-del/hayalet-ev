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

function replaceRequired(source, search, replacement, label) {
  if (source.includes(replacement)) {
    return source;
  }
  if (!source.includes(search)) {
    throw new Error(`Required connection viewport pattern was not found: ${label}`);
  }
  return source.replace(search, replacement);
}

await updateFile("rooms/pattern-room/ui/workspace.css", (source) => {
  let next = replaceRequired(
    source,
    `.pattern-room-connection-map {\n  position: relative;\n  min-height: var(--pattern-px-388);\n}\n\n.pattern-room-connection-map .pattern-room-claim-objects {\n  position: relative;\n  z-index: 2;\n  grid-template-columns: repeat(2, minmax(0, 1fr));\n  align-items: center;\n  height: 100%;\n}`,
    `.pattern-room-connection-map {\n  display: grid;\n  min-height: 0;\n  gap: var(--pattern-px-14);\n  align-content: start;\n}\n\n.pattern-room-connection-map .pattern-room-claim-objects {\n  position: relative;\n  z-index: 2;\n  grid-template-columns: repeat(2, minmax(0, 1fr));\n  align-items: stretch;\n  height: auto;\n}`,
    "connection map flow"
  );

  next = replaceRequired(
    next,
    `.pattern-room-connection-card {\n  display: grid;`,
    `.pattern-room-connection-card {\n  position: relative;\n  display: grid;`,
    "connection card index anchor"
  );

  return next;
});

await updateFile(".rovo/pattern-room-v2-progress.md", (source) => {
  if (source.includes("Completed: graph connection list viewport correction")) {
    return source;
  }

  const section = `## Completed: graph connection list viewport correction\n\n- The graph claim area no longer reserves the full connection-map height before selectable edges.\n- Selectable domain and local connection cards now remain in normal document flow directly below the claim cards.\n- Connection-card index badges are anchored to their own cards instead of the graph surface.\n\n`;
  const marker = "## Next implementation steps";
  return source.includes(marker)
    ? source.replace(marker, `${section}${marker}`)
    : `${source.trimEnd()}\n\n${section}`;
});

if (changedFiles.length === 0) {
  console.log("Pattern Room connection list viewport is already current.");
} else {
  console.log(`${apply ? "Applied" : "Would apply"}:`);
  changedFiles.forEach((path) => console.log(`- ${path}`));
}
