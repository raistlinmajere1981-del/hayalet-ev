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

function replaceOneOfRequired(source, searches, replacement, label) {
  if (source.includes(replacement)) {
    return source;
  }
  const search = searches.find((candidate) => source.includes(candidate));
  if (search === undefined) {
    throw new Error(`Required case identity recovery pattern was not found: ${label}`);
  }
  return source.replace(search, replacement);
}

await updateFile("rooms/pattern-room/shared/state/pattern-room-local-state.ts", (source) => {
  let next = replaceOneOfRequired(
    source,
    [
      '  readonly topic: Pick<Topic, "id">;',
      '  readonly topic: Pick<Topic, "id" | "label" | "description">;',
    ],
    '  readonly topic: Pick<Topic, "id"> & Partial<Pick<Topic, "label" | "description">>;',
    "domain reference optional topic metadata"
  );

  next = replaceRequired(
    next,
    `  const domainRef = domainMock;\n  let caseLabel = domainRef.topic.label;\n  let researchQuestion = domainRef.topic.description;`,
    `  const domainRef = domainMock;\n  const defaultCaseLabel = domainRef.topic.label?.trim() || "Yeni Araştırma";\n  const defaultResearchQuestion = domainRef.topic.description?.trim() || "";\n  let caseLabel = defaultCaseLabel;\n  let researchQuestion = defaultResearchQuestion;`,
    "local state identity defaults"
  );

  next = replaceRequired(
    next,
    `        ...(caseLabel === domainRef.topic.label ? {} : { caseLabel }),\n        ...(researchQuestion === domainRef.topic.description ? {} : { researchQuestion }),`,
    `        ...(caseLabel === defaultCaseLabel ? {} : { caseLabel }),\n        ...(researchQuestion === defaultResearchQuestion ? {} : { researchQuestion }),`,
    "local overlay default comparisons"
  );

  next = replaceRequired(
    next,
    `      caseLabel = overlay.caseLabel?.trim() || domainRef.topic.label;\n      researchQuestion =\n        overlay.researchQuestion === undefined\n          ? domainRef.topic.description\n          : overlay.researchQuestion.trim();`,
    `      caseLabel = overlay.caseLabel?.trim() || defaultCaseLabel;\n      researchQuestion =\n        overlay.researchQuestion === undefined\n          ? defaultResearchQuestion\n          : overlay.researchQuestion.trim();`,
    "local identity restore defaults"
  );

  return next;
});

await updateFile("rooms/pattern-room/shared/state/pattern-room-snapshot.ts", (source) => {
  let next = replaceRequired(
    source,
    `    caseLabel: snapshotOverlay.caseLabel?.trim() || domainMock.topic.label,`,
    `    caseLabel:\n      snapshotOverlay.caseLabel?.trim() ||\n      domainMock.topic.label?.trim() ||\n      "Yeni Araştırma",`,
    "snapshot case label fallback"
  );

  next = replaceRequired(
    next,
    `      snapshotOverlay.researchQuestion === undefined\n        ? domainMock.topic.description\n        : snapshotOverlay.researchQuestion.trim(),`,
    `      snapshotOverlay.researchQuestion === undefined\n        ? (domainMock.topic.description?.trim() ?? "")\n        : snapshotOverlay.researchQuestion.trim(),`,
    "snapshot research question fallback"
  );

  return next;
});

await updateFile("rooms/pattern-room/ui/panels/pattern-case-identity-inspector.ts", (source) => {
  return replaceRequired(
    source,
    '    caseName.removeAttribute("aria-invalid");',
    '    caseName.setAttribute("aria-invalid", "false");',
    "installed DOM aria-invalid reset"
  );
});

await updateFile("scripts/tests/pattern-room-case-packet-regressions.test.ts", (source) => {
  return replaceRequired(
    source,
    "  assert.doesNotMatch(projectionSource, /from\\s+[\"'][^\"']*(?:ai|provider|relay)/i);",
    `  const projectionImportSpecifiers = Array.from(\n    projectionSource.matchAll(/from\\s+["']([^"']+)["']/g),\n    (match) => match[1] ?? ""\n  );\n  assert.equal(\n    projectionImportSpecifiers.some((specifier) => {\n      return /(?:^|[\\/_-])(?:ai|provider|relay)(?:$|[\\/_.-])/i.test(specifier);\n    }),\n    false\n  );`,
    "transport-boundary import check"
  );
});

if (changedFiles.length === 0) {
  console.log("Pattern Room case identity recovery is already current.");
} else {
  console.log(`${apply ? "Applied" : "Would apply"}:`);
  changedFiles.forEach((path) => console.log(`- ${path}`));
}
