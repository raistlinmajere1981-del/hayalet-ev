import { readFile, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const scriptDir = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(scriptDir, "../..");
const apply = process.argv.includes("--apply");
const path = "scripts/migrations/pattern-room-v2-action-feedback-and-truthful-metrics.mjs";
const absolutePath = resolve(repoRoot, path);
let source = await readFile(absolutePath, "utf8");
const escapedQuote = `${String.fromCharCode(92)}"`;

function replaceRequired(search, replacement, expectedCount, label) {
  const count = source.split(search).length - 1;
  if (count === 0 && source.includes(replacement)) {
    return;
  }
  if (count !== expectedCount) {
    throw new Error(
      `Expected ${String(expectedCount)} occurrence(s) for ${label}, found ${String(count)}.`
    );
  }
  source = source.replaceAll(search, replacement);
}

replaceRequired(
  `export type PatternWorkspaceFeedbackTone = ${escapedQuote}success${escapedQuote} | ${escapedQuote}info${escapedQuote} | ${escapedQuote}warning${escapedQuote} | ${escapedQuote}error${escapedQuote};`,
  'export type PatternWorkspaceFeedbackTone = "success" | "info" | "warning" | "error";',
  1,
  "feedback tone type quotes"
);

replaceRequired(
  `font-family: ${escapedQuote}IBM Plex Mono${escapedQuote}, monospace;`,
  'font-family: "IBM Plex Mono", monospace;',
  2,
  "feedback font-family quotes"
);

const current = await readFile(absolutePath, "utf8");
const normalized = source.endsWith("\n") ? source : `${source}\n`;
if (current === normalized) {
  console.log(`Already current: ${path}`);
} else if (apply) {
  await writeFile(absolutePath, normalized, "utf8");
  console.log(`Applied: ${path}`);
} else {
  console.log(`Would apply: ${path}`);
}
