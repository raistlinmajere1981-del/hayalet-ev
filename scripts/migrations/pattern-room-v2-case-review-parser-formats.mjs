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
    throw new Error(`Required parser-format migration pattern was not found: ${label}`);
  }
  return content.replace(search, replacement);
}

async function tightenParserCollectionTypes() {
  const path = "rooms/pattern-room/shared/adapters/pattern-room-case-review-parser-v2.ts";
  let source = await readRepoFile(path);

  if (!source.includes("const sectionItems = sectionValue as string[];")) {
    source = replaceRequired(
      source,
      `    buckets[key].push(\n      ...sectionValue.map((entry) => entry.trim()).filter((entry) => entry !== "")\n    );`,
      `    const sectionItems = sectionValue as string[];\n    buckets[key].push(\n      ...sectionItems.map((entry) => entry.trim()).filter((entry) => entry !== "")\n    );`,
      "canonical section item narrowing"
    );
  }

  if (!source.includes("const connectionsToParse = (connectionValues ?? []) as unknown[];")) {
    source = replaceRequired(
      source,
      `  const connections: PatternRoomCaseReviewConnectionSuggestion[] = [];\n  (connectionValues ?? []).forEach((connectionValue) => {`,
      `  const connections: PatternRoomCaseReviewConnectionSuggestion[] = [];\n  const connectionsToParse = (connectionValues ?? []) as unknown[];\n  connectionsToParse.forEach((connectionValue) => {`,
      "canonical connection collection narrowing"
    );
  }

  await writeRepoFile(path, source);
}

async function registerParserFormatRegressions() {
  const path = "scripts/tests/pattern-room-case-review-pipeline-regressions.test.ts";
  let source = await readRepoFile(path);
  const importLine = 'import "./pattern-room-case-review-parser-formats-regressions.test.ts";';
  if (source.includes(importLine)) {
    return;
  }

  source = replaceRequired(
    source,
    `import assert from "node:assert/strict";\n`,
    `import assert from "node:assert/strict";\n\n${importLine}\n`,
    "parser-format regression registration"
  );
  await writeRepoFile(path, source);
}

async function updateProgress() {
  const path = ".rovo/pattern-room-v2-progress.md";
  let source = await readRepoFile(path);
  if (!source.includes("## Completed: canonical and bilingual Case Review parsing")) {
    const marker = "## Next implementation steps";
    source = replaceRequired(
      source,
      marker,
      `## Completed: canonical and bilingual Case Review parsing\n\n- Case Review messages request one canonical JSON envelope with seven typed section arrays.\n- The parser accepts plain or fenced canonical JSON and preserves each JSON array entry as a separate suggestion item.\n- Structured connection objects are validated against the existing edge-type allowlist.\n- English and Turkish section headings are accepted as a controlled fallback path.\n- Invalid JSON envelopes are preserved as cautious Analysis fallback content with warnings.\n- Parser-format regressions cover canonical JSON, fenced JSON, Turkish headings and the outbound response contract.\n\n${marker}`,
      "parser-format progress section"
    );
  }

  source = source.replace(
    `1. Add canonical JSON and Turkish/English heading parser paths.\n2. Begin the three-region Workspace Shell V2 after the parser boundary is green.`,
    `1. Begin the three-region Workspace Shell V2.\n2. Merge Board and Connections into the Investigation Canvas after the shell boundary is green.`
  );
  await writeRepoFile(path, source);
}

await tightenParserCollectionTypes();
await registerParserFormatRegressions();
await updateProgress();

if (changedFiles.length === 0) {
  console.log("Pattern Room parser formats are already current.");
} else {
  console.log(`${apply ? "Applied" : "Would apply"}:`);
  changedFiles.forEach((path) => {
    console.log(`- ${path}`);
  });
}
