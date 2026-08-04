import { readFile, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const scriptDir = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(scriptDir, "../..");
const apply = process.argv.includes("--apply");
const path = "scripts/tests/pattern-room-protocol-spec-regressions.test.ts";
const absolutePath = resolve(repoRoot, path);
let source = await readFile(absolutePath, "utf8");

const oldExpectation = `  const expectedResponseHeadings = [
    "## Observation",
    "## Evidence",
    "## Analysis",
    "## Counter Argument",
    "## Missing Information",
    "## Open Questions",
    "## Confidence Notes",
  ];
  assert.deepEqual(
    markdown.split(/\\r?\\n/).filter((line) => expectedResponseHeadings.includes(line)),
    expectedResponseHeadings
  );`;

const newExpectation = `  assert.match(markdown, /"format": "pattern-room-case-review"/);
  assert.match(markdown, /"version": 1/);

  const expectedCanonicalSectionKeys = [
    "observation",
    "evidence",
    "analysis",
    "counterArgument",
    "missingInformation",
    "openQuestions",
    "confidenceNotes",
  ];
  const canonicalSectionKeys = [
    ...markdown.matchAll(
      /^\\s+"(observation|evidence|analysis|counterArgument|missingInformation|openQuestions|confidenceNotes)"\\s*:\\s*\\[\\],?$/gm
    ),
  ].map((match) => match[1]);
  assert.deepEqual(canonicalSectionKeys, expectedCanonicalSectionKeys);

  const codeTick = String.fromCharCode(96);
  const expectedFallbackHeadings = [
    "- " + codeTick + "Observation" + codeTick + " veya " + codeTick + "Gözlem" + codeTick,
    "- " + codeTick + "Evidence" + codeTick + " veya " + codeTick + "Kanıt" + codeTick,
    "- " + codeTick + "Analysis" + codeTick + " veya " + codeTick + "Analiz" + codeTick,
    "- " + codeTick + "Counter Argument" + codeTick + " veya " + codeTick + "Karşı Argüman" + codeTick,
    "- " + codeTick + "Missing Information" + codeTick + " veya " + codeTick + "Eksik Bilgi" + codeTick,
    "- " + codeTick + "Open Questions" + codeTick + " veya " + codeTick + "Açık Sorular" + codeTick,
    "- " + codeTick + "Confidence Notes" + codeTick + " veya " + codeTick + "Güven Notları" + codeTick,
  ];
  assert.deepEqual(
    markdown.split(/\\r?\\n/).filter((line) => expectedFallbackHeadings.includes(line)),
    expectedFallbackHeadings
  );`;

if (source.includes(newExpectation)) {
  console.log("Protocol-spec parser-format regression is already current.");
} else if (!source.includes(oldExpectation)) {
  throw new Error("Required legacy protocol heading expectation was not found.");
} else {
  source = source.replace(oldExpectation, newExpectation);
  if (apply) {
    await writeFile(absolutePath, source.endsWith("\n") ? source : `${source}\n`, "utf8");
    console.log(`Applied: ${path}`);
  } else {
    console.log(`Would apply: ${path}`);
  }
}
