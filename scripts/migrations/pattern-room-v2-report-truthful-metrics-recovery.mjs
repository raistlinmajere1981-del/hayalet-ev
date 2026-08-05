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

function replaceOneOfRequired(source, searches, replacement, label) {
  if (source.includes(replacement)) {
    return source;
  }
  const search = searches.find((candidate) => source.includes(candidate));
  if (search === undefined) {
    throw new Error(`Required truthful-report recovery pattern was not found: ${label}`);
  }
  return source.replace(search, replacement);
}

await updateFile(
  "rooms/pattern-room/shared/adapters/pattern-room-view-adapters.ts",
  (source) => {
    return replaceOneOfRequired(
      source,
      [
        "  const debateReferenceCount = overlay?.debateReferenceIds.length ?? 0;",
        "  const debateReferenceCount = adaptTenthManViewModel(domain, overlay).tenthManSession.references.length;",
      ],
      "  const debateReferenceCount = adaptTenthManViewModel(\n    domain,\n    overlay\n  ).tenthManSession.references.length;",
      "resolved Tenth Man reference count"
    );
  }
);

await updateFile("scripts/tests/pattern-room-view-adapters-regressions.test.ts", (source) => {
  let next = source;
  const malformedCandidates = [
    'sourceSection.items.map((item) => item.label).join(" \\"),',
    'sourceSection.items.map((item) => item.label).join(" \\"),',
    'sourceSection.items.map((item) => item.label).join(" \\"),',
  ];

  const validLine = 'sourceSection.items.map((item) => item.label).join(" "),';
  if (!next.includes(validLine)) {
    const malformed = malformedCandidates.find((candidate) => next.includes(candidate));
    if (malformed !== undefined) {
      next = next.replace(malformed, validLine);
    } else {
      const start = next.indexOf("sourceSection.items.map((item) => item.label).join(");
      const end = next.indexOf("\n", start);
      if (start < 0 || end < 0) {
        throw new Error("The truthful source-label assertion was not found.");
      }
      next = `${next.slice(0, start)}${validLine}${next.slice(end)}`;
    }
  }
  return next;
});

if (changedFiles.length === 0) {
  console.log("Pattern Room truthful report recovery is already current.");
} else {
  console.log(`${apply ? "Applied" : "Would apply"}:`);
  changedFiles.forEach((path) => console.log(`- ${path}`));
}
