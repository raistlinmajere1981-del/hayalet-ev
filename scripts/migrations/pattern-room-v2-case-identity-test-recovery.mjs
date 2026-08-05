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
    throw new Error(`Required case identity test recovery pattern was not found: ${label}`);
  }
  return source.replace(search, replacement);
}

await updateFile("rooms/pattern-room/ui/panels/pattern-case-identity-inspector.ts", (source) => {
  let next = replaceOneOfRequired(
    source,
    [
      '      caseName.setAttribute("aria-invalid", "true");',
      '      caseName.ariaInvalid = "true";',
    ],
    '      caseName.ariaInvalid = "true";',
    "invalid case name state"
  );

  next = replaceOneOfRequired(
    next,
    [
      '    caseName.removeAttribute("aria-invalid");',
      '    caseName.setAttribute("aria-invalid", "false");',
      '    caseName.ariaInvalid = "false";',
    ],
    '    caseName.ariaInvalid = "false";',
    "valid case name state"
  );

  return next;
});

await updateFile("scripts/tests/pattern-room-case-packet-regressions.test.ts", (source) => {
  return source.replaceAll("[\\/_-]", "[/_-]").replaceAll("[\\/_.-]", "[/_.-]");
});

if (changedFiles.length === 0) {
  console.log("Pattern Room case identity test recovery is already current.");
} else {
  console.log(`${apply ? "Applied" : "Would apply"}:`);
  changedFiles.forEach((path) => console.log(`- ${path}`));
}
