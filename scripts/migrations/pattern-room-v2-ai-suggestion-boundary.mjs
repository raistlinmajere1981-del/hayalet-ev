import { access, readFile, writeFile } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const scriptDir = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(scriptDir, "../..");
const apply = process.argv.includes("--apply");
const changedFiles = [];

async function fileExists(path) {
  try {
    await access(join(repoRoot, path));
    return true;
  } catch {
    return false;
  }
}

async function readRepoFile(path) {
  return await readFile(join(repoRoot, path), "utf8");
}

async function writeRepoFile(path, content) {
  const normalized = content.endsWith("\n") ? content : `${content}\n`;
  const current = (await fileExists(path)) ? await readRepoFile(path) : null;
  if (current === normalized) {
    return;
  }
  changedFiles.push(path);
  if (apply) {
    await writeFile(join(repoRoot, path), normalized, "utf8");
  }
}

function replaceRequired(content, search, replacement, label) {
  if (!content.includes(search)) {
    throw new Error(`Required migration pattern was not found: ${label}`);
  }
  return content.replace(search, replacement);
}

async function addSuggestionResultTypes() {
  const path = "rooms/pattern-room/shared/types/pattern-room-case-review-result.ts";
  let source = await readRepoFile(path);

  source = replaceRequired(
    source,
    `export type PatternRoomCaseReviewResultItem = {\n  readonly id: string;\n  readonly section: PatternRoomCaseReviewSectionKey;\n  readonly text: string;\n};`,
    `export type PatternRoomCaseReviewSuggestionKind =\n  | "review_observation"\n  | "review_analysis"\n  | "review_counter_argument"\n  | "evidence_candidate"\n  | "connection_candidate"\n  | "open_question"\n  | "uncertainty_note";\n\nexport type PatternRoomCaseReviewResultItem = {\n  readonly id: string;\n  readonly section: PatternRoomCaseReviewSectionKey;\n  readonly text: string;\n};`,
    "Case Review suggestion kind type"
  );

  source = replaceRequired(
    source,
    `export type PatternRoomCaseReviewConnectionSuggestion = {\n  readonly sourceId: string;\n  readonly edgeType: PatternEdgeType;\n  readonly targetId: string;\n  readonly note: string | null;\n  readonly rawText: string;\n};`,
    `export type PatternRoomCaseReviewConnectionSuggestion = {\n  readonly sourceId: string;\n  readonly edgeType: PatternEdgeType;\n  readonly targetId: string;\n  readonly note: string | null;\n  readonly rawText: string;\n};\n\nexport type PatternRoomCaseReviewSuggestion = {\n  readonly id: string;\n  readonly kind: PatternRoomCaseReviewSuggestionKind;\n  readonly text: string;\n  readonly section: PatternRoomCaseReviewSectionKey;\n  readonly sourceItemId: string | null;\n  readonly connection: PatternRoomCaseReviewConnectionSuggestion | null;\n};`,
    "Case Review suggestion record type"
  );

  source = replaceRequired(
    source,
    `  readonly items: readonly PatternRoomCaseReviewResultItem[];\n  readonly warnings: readonly PatternRoomCaseReviewWarning[];`,
    `  readonly items: readonly PatternRoomCaseReviewResultItem[];\n  readonly suggestions: readonly PatternRoomCaseReviewSuggestion[];\n  readonly warnings: readonly PatternRoomCaseReviewWarning[];`,
    "Case Review result suggestions collection"
  );

  await writeRepoFile(path, source);
}

async function projectSuggestionsInParser() {
  const path = "rooms/pattern-room/shared/adapters/pattern-room-case-review-parser.ts";
  let source = await readRepoFile(path);

  source = replaceRequired(
    source,
    `  type PatternRoomCaseReviewResultItem,\n  type PatternRoomCaseReviewSection,\n  type PatternRoomCaseReviewSectionKey,\n  type PatternRoomCaseReviewWarning,`,
    `  type PatternRoomCaseReviewResultItem,\n  type PatternRoomCaseReviewSection,\n  type PatternRoomCaseReviewSectionKey,\n  type PatternRoomCaseReviewSuggestion,\n  type PatternRoomCaseReviewSuggestionKind,\n  type PatternRoomCaseReviewWarning,`,
    "parser suggestion type imports"
  );

  source = replaceRequired(
    source,
    `const PATTERN_EDGE_TYPES = new Set<PatternEdgeType>([`,
    `const SUGGESTION_KIND_BY_SECTION: Readonly<\n  Record<PatternRoomCaseReviewSectionKey, PatternRoomCaseReviewSuggestionKind>\n> = {\n  observation: "review_observation",\n  evidence: "evidence_candidate",\n  analysis: "review_analysis",\n  counterArgument: "review_counter_argument",\n  missingInformation: "uncertainty_note",\n  openQuestions: "open_question",\n  confidenceNotes: "uncertainty_note",\n};\n\nconst PATTERN_EDGE_TYPES = new Set<PatternEdgeType>([`,
    "parser suggestion kind mapping"
  );

  source = replaceRequired(
    source,
    `function readSummary(\n  sections: Readonly<Record<PatternRoomCaseReviewSectionKey, PatternRoomCaseReviewSection>>\n): string {`,
    `function createSuggestions(\n  sections: Readonly<Record<PatternRoomCaseReviewSectionKey, PatternRoomCaseReviewSection>>,\n  connections: readonly PatternRoomCaseReviewConnectionSuggestion[]\n): readonly PatternRoomCaseReviewSuggestion[] {\n  const sectionSuggestions = PATTERN_ROOM_CASE_REVIEW_SECTION_KEYS.flatMap((sectionKey) => {\n    return sections[sectionKey].items.map((item): PatternRoomCaseReviewSuggestion => {\n      return Object.freeze({\n        id: \`suggestion-\${item.id}\`,\n        kind: SUGGESTION_KIND_BY_SECTION[sectionKey],\n        text: item.text,\n        section: sectionKey,\n        sourceItemId: item.id,\n        connection: null,\n      });\n    });\n  });\n  const connectionSuggestions = connections.map(\n    (connection, index): PatternRoomCaseReviewSuggestion => {\n      const connectionText = \`\${connection.sourceId} -> \${connection.edgeType} -> \${connection.targetId}\`;\n      return Object.freeze({\n        id: \`suggestion-connection-\${String(index + 1).padStart(3, "0")}\`,\n        kind: "connection_candidate",\n        text: connection.note === null ? connectionText : \`\${connectionText}: \${connection.note}\`,\n        section: "analysis",\n        sourceItemId: null,\n        connection,\n      });\n    }\n  );\n  return Object.freeze([...sectionSuggestions, ...connectionSuggestions]);\n}\n\nfunction readSummary(\n  sections: Readonly<Record<PatternRoomCaseReviewSectionKey, PatternRoomCaseReviewSection>>\n): string {`,
    "parser suggestion projection helper"
  );

  source = replaceRequired(
    source,
    `  const items = Object.freeze(\n    PATTERN_ROOM_CASE_REVIEW_SECTION_KEYS.flatMap((key) => sections[key].items)\n  );\n\n  return Object.freeze({`,
    `  const items = Object.freeze(\n    PATTERN_ROOM_CASE_REVIEW_SECTION_KEYS.flatMap((key) => sections[key].items)\n  );\n  const suggestions = createSuggestions(sections, connections);\n\n  return Object.freeze({`,
    "parser suggestion projection invocation"
  );

  source = replaceRequired(
    source,
    `    sections,\n    items,\n    warnings: Object.freeze(warnings),`,
    `    sections,\n    items,\n    suggestions,\n    warnings: Object.freeze(warnings),`,
    "parser suggestion result assignment"
  );

  await writeRepoFile(path, source);
}

async function retainEvidenceAsCandidates() {
  const path = "rooms/pattern-room/shared/adapters/pattern-room-case-review-apply.ts";
  let source = await readRepoFile(path);

  source = replaceRequired(
    source,
    `function applyEvidenceSuggestions(\n  result: PatternRoomCaseReviewResult,\n  target: PatternRoomCaseReviewApplyTarget,\n  summary: MutableApplySummary,\n  copy: PatternRoomCaseReviewApplyCopy\n): void {\n  result.sections.evidence.items.forEach((item, index) => {\n    target.addAuthoredEvidence(\n      \`\${copy.reviewPrefix} \${copy.evidenceSuggestionLabel} \${String(index + 1)}\`,\n      item.text,\n      copy.userAppliedSuggestion,\n      "evidence"\n    );\n    summary.evidenceAdded += 1;\n  });\n}`,
    `function retainEvidenceCandidates(\n  result: PatternRoomCaseReviewResult,\n  summary: MutableApplySummary\n): void {\n  const candidateCount = result.suggestions.filter((suggestion) => {\n    return suggestion.kind === "evidence_candidate";\n  }).length;\n  if (candidateCount === 0) {\n    return;\n  }\n\n  summary.skipped += candidateCount;\n  summary.warnings.push(\n    "Evidence suggestions were retained as candidates and were not added as evidence. Link each candidate to a real source and excerpt before promotion."\n  );\n}`,
    "retain evidence candidates instead of authored evidence"
  );

  source = source.replace(
    "    applyEvidenceSuggestions(result, target, summary, copy);",
    "    retainEvidenceCandidates(result, summary);"
  );
  source = source.replace(
    "  applyEvidenceSuggestions(result, target, summary, copy);",
    "  retainEvidenceCandidates(result, summary);"
  );

  if (source.includes("applyEvidenceSuggestions(")) {
    throw new Error("Legacy evidence apply helper remains after migration.");
  }
  await writeRepoFile(path, source);
}

async function updatePipelineRegressions() {
  const path = "scripts/tests/pattern-room-case-review-pipeline-regressions.test.ts";
  let source = await readRepoFile(path);

  source = replaceRequired(
    source,
    `  assert.deepEqual(result.openQuestions, ["Ham dosyanın metadata değeri nedir?"]);`,
    `  assert.deepEqual(result.openQuestions, ["Ham dosyanın metadata değeri nedir?"]);\n  assert.equal(\n    result.suggestions.filter((suggestion) => suggestion.kind === "evidence_candidate").length,\n    1\n  );\n  assert.equal(\n    result.suggestions.filter((suggestion) => suggestion.kind === "connection_candidate").length,\n    2\n  );\n  assert.equal(Object.isFrozen(result.suggestions), true);`,
    "parser suggestion regression assertions"
  );

  source = replaceRequired(
    source,
    `  assert.equal(evidenceOnly.evidenceAdded, 1);\n  assert.equal(calls.evidence.length, 1);\n  assert.equal(calls.notes.length, 0);`,
    `  assert.equal(evidenceOnly.evidenceAdded, 0);\n  assert.equal(evidenceOnly.skipped, 1);\n  assert.equal(evidenceOnly.warnings.length, 1);\n  assert.equal(calls.evidence.length, 0);\n  assert.equal(calls.notes.length, 0);`,
    "evidence-only candidate retention regression"
  );

  source = replaceRequired(
    source,
    `  assert.equal(all.evidenceAdded, 1);\n  assert.equal(all.openQuestionsAdded, 1);\n  assert.equal(all.uncertaintyAdded, 2);\n  assert.equal(all.connectionsAdded, 1);\n  assert.equal(all.skipped, 1);\n  assert.equal(all.warnings.length, 1);`,
    `  assert.equal(all.evidenceAdded, 0);\n  assert.equal(all.openQuestionsAdded, 1);\n  assert.equal(all.uncertaintyAdded, 2);\n  assert.equal(all.connectionsAdded, 1);\n  assert.equal(all.skipped, 2);\n  assert.equal(all.warnings.length, 2);`,
    "all-mode candidate retention regression"
  );

  source = replaceRequired(
    source,
    `  assert.match(calls.evidence[0] ?? "", /^AI İncelemesi Kanıt Önerisi 1:/);\n  assert.match(calls.evidence[0] ?? "", /bağımsız olarak doğrulanmamıştır/);`,
    `  assert.equal(calls.evidence.length, 0);`,
    "localized evidence candidate regression"
  );

  await writeRepoFile(path, source);
}

async function updateInstalledUiRegressions() {
  const path = "scripts/tests/pattern-room-installed-ui-smoke-regressions-part6.test.ts";
  let source = await readRepoFile(path);

  source = replaceRequired(
    source,
    `    notes: 0,\n    evidence: 1,\n    nodes: 6,\n    edges: 1,`,
    `    notes: 0,\n    evidence: 0,\n    nodes: 6,\n    edges: 1,`,
    "all-mode installed UI evidence count"
  );
  source = replaceRequired(
    source,
    `    mode: "evidence-suggestions-only",\n    selector: "[data-pattern-case-review-apply-evidence-suggestions='true']",\n    notes: 0,\n    evidence: 1,`,
    `    mode: "evidence-suggestions-only",\n    selector: "[data-pattern-case-review-apply-evidence-suggestions='true']",\n    notes: 0,\n    evidence: 0,`,
    "evidence-only installed UI evidence count"
  );

  await writeRepoFile(path, source);
}

async function updateReviewCopy() {
  const replacements = [
    {
      path: "rooms/pattern-room/i18n/en.json",
      actionFrom: '"applyEvidenceSuggestions": "Add Evidence Suggestions Only"',
      actionTo: '"applyEvidenceSuggestions": "Retain Evidence Candidates Only"',
      messageFrom: '"applied": "The selected review items were added to the board."',
      messageTo:
        '"applied": "The selected review action was completed. Evidence suggestions remain candidates until linked to a real source and excerpt."',
    },
    {
      path: "rooms/pattern-room/i18n/tr.json",
      actionFrom: '"applyEvidenceSuggestions": "Yalnız Kanıt Önerilerini Ekle"',
      actionTo: '"applyEvidenceSuggestions": "Yalnız Kanıt Adaylarını Koru"',
      messageFrom: '"applied": "Seçilen inceleme öğeleri panoya eklendi."',
      messageTo:
        '"applied": "Seçilen inceleme işlemi tamamlandı. Kanıt önerileri gerçek bir kaynak ve alıntıyla eşleştirilene kadar aday olarak kalır."',
    },
  ];

  for (const replacement of replacements) {
    let source = await readRepoFile(replacement.path);
    source = replaceRequired(
      source,
      replacement.actionFrom,
      replacement.actionTo,
      `${replacement.path} evidence candidate action copy`
    );
    source = replaceRequired(
      source,
      replacement.messageFrom,
      replacement.messageTo,
      `${replacement.path} evidence candidate feedback copy`
    );
    await writeRepoFile(replacement.path, source);
  }
}

async function updateProgress() {
  const path = ".rovo/pattern-room-v2-progress.md";
  let source = await readRepoFile(path);
  const marker = "## Next implementation steps";
  source = replaceRequired(
    source,
    marker,
    `## Completed: AI suggestion boundary\n\n- Parsed Case Review output now exposes explicit typed suggestion records.\n- Evidence-section output is classified as \`evidence_candidate\`, not evidence.\n- Applying a review never writes AI evidence suggestions into \`localAuthoredEvidence\`.\n- Evidence candidates remain in the structured review result until a source-backed promotion workflow is completed.\n- UI copy and regression expectations distinguish candidates from evidence.\n\n${marker}`,
    "AI suggestion progress section"
  );
  source = source.replace(
    `1. Introduce explicit AI suggestion records.\n2. Stop AI \`Evidence\` section text from becoming evidence automatically.\n3. Add evidence-candidate promotion rules that require a real source and excerpt.\n4. Add canonical JSON and Turkish/English heading parser paths.\n5. Begin the three-region Workspace Shell V2 after the suggestion boundary is green.`,
    `1. Add persistent evidence-candidate records to the local overlay.\n2. Add promotion rules that require a real source and excerpt.\n3. Add canonical JSON and Turkish/English heading parser paths.\n4. Begin the three-region Workspace Shell V2 after the promotion boundary is green.`
  );
  await writeRepoFile(path, source);
}

async function main() {
  await addSuggestionResultTypes();
  await projectSuggestionsInParser();
  await retainEvidenceAsCandidates();
  await updatePipelineRegressions();
  await updateInstalledUiRegressions();
  await updateReviewCopy();
  await updateProgress();

  const mode = apply ? "Applied" : "Would change";
  console.log(`${mode} ${changedFiles.length} files:`);
  for (const path of changedFiles) {
    console.log(`- ${path}`);
  }
  if (!apply) {
    console.log("\nRun again with --apply to write the AI suggestion boundary migration.");
  }
}

await main();
