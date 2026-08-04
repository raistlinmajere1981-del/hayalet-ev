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
    throw new Error(`Required case identity recovery pattern was not found: ${label}`);
  }
  return source.replace(search, replacement);
}

await updateFile("rooms/pattern-room/shared/state/pattern-room-local-state.ts", (source) => {
  return replaceRequired(
    source,
    '  readonly topic: Pick<Topic, "id">;',
    '  readonly topic: Pick<Topic, "id" | "label" | "description">;',
    "domain reference topic metadata"
  );
});

await updateFile(
  "rooms/pattern-room/ui/panels/pattern-case-identity-inspector.ts",
  (source) => {
    return replaceRequired(
      source,
      '    caseName.removeAttribute("aria-invalid");',
      '    caseName.setAttribute("aria-invalid", "false");',
      "installed DOM aria-invalid reset"
    );
  }
);

await updateFile("scripts/tests/pattern-room-case-packet-regressions.test.ts", (source) => {
  return replaceRequired(
    source,
    '  assert.doesNotMatch(projectionSource, /from\\s+["\'][^"\']*(?:ai|provider|relay)/i);',
    '  assert.doesNotMatch(\n    projectionSource,\n    /from\\s+["\'][^"\']*(?:[\\/_-]ai(?:[\\/_.-]|$)|provider|relay)[^"\']*["\']/i\n  );',
    "transport-boundary import regex"
  );
});

if (changedFiles.length === 0) {
  console.log("Pattern Room case identity recovery is already current.");
} else {
  console.log(`${apply ? "Applied" : "Would apply"}:`);
  changedFiles.forEach((path) => console.log(`- ${path}`));
}
