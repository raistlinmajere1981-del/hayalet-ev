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

async function addEvidenceCandidateTypes() {
  const path = "rooms/pattern-room/shared/types/pattern-room-evidence-candidate.ts";
  const content = `import type { PatternLayer } from "./pattern-room-domain.js";

export type PatternRoomEvidenceCandidate = {
  readonly id: string;
  readonly suggestionId: string;
  readonly text: string;
  readonly reviewSessionId: string | null;
  readonly origin: "ai-case-review";
  readonly sourceSection: "evidence";
  readonly status: "candidate";
  readonly createdAt: string;
};

export type PatternRoomEvidenceCandidatePromotionInput = {
  readonly candidateId: string;
  readonly sourceId: string;
  readonly excerpt: string;
  readonly label?: string;
  readonly interpretation?: string;
  readonly layer?: PatternLayer;
};

export type PatternRoomEvidenceCandidatePromotionResult = {
  readonly candidateId: string;
  readonly promoted: boolean;
  readonly evidenceId: string | null;
  readonly warnings: readonly string[];
};
`;
  await writeRepoFile(path, content);
}

async function updateLocalState() {
  const path = "rooms/pattern-room/shared/state/pattern-room-local-state.ts";
  let source = await readRepoFile(path);

  source = replaceRequired(
    source,
    `} from "../types/pattern-room-domain.js";\nimport type {`,
    `} from "../types/pattern-room-domain.js";\nimport type {\n  PatternRoomEvidenceCandidate,\n  PatternRoomEvidenceCandidatePromotionInput,\n  PatternRoomEvidenceCandidatePromotionResult,\n} from "../types/pattern-room-evidence-candidate.js";\nimport type {`,
    "local state candidate type imports"
  );

  source = replaceRequired(
    source,
    `  localAuthoredEvidence: readonly LocalAuthoredEvidence[];\n  localAuthoredEdges: readonly LocalAuthoredEdge[];`,
    `  localAuthoredEvidence: readonly LocalAuthoredEvidence[];\n  localEvidenceCandidates?: readonly PatternRoomEvidenceCandidate[];\n  localAuthoredEdges: readonly LocalAuthoredEdge[];`,
    "local overlay candidate collection"
  );

  source = replaceRequired(
    source,
    `  addAuthoredEdge: (\n    edgeType: PatternEdgeType,`,
    `  addEvidenceCandidate: (\n    suggestionId: string,\n    text: string,\n    reviewSessionId?: string | null\n  ) => boolean;\n  promoteEvidenceCandidate: (\n    input: PatternRoomEvidenceCandidatePromotionInput\n  ) => PatternRoomEvidenceCandidatePromotionResult;\n  removeEvidenceCandidate: (candidateId: string) => boolean;\n  addAuthoredEdge: (\n    edgeType: PatternEdgeType,`,
    "local state candidate commands"
  );

  source = replaceRequired(
    source,
    `function cloneAuthoredEdges(edges: readonly LocalAuthoredEdge[]): LocalAuthoredEdge[] {`,
    `function cloneEvidenceCandidates(\n  candidates: readonly PatternRoomEvidenceCandidate[]\n): PatternRoomEvidenceCandidate[] {\n  return candidates.map((candidate) => {\n    return { ...candidate };\n  });\n}\n\nfunction cloneAuthoredEdges(edges: readonly LocalAuthoredEdge[]): LocalAuthoredEdge[] {`,
    "candidate clone helper"
  );

  source = replaceRequired(
    source,
    `  const localAuthoredEvidence: LocalAuthoredEvidence[] = [];\n  const localAuthoredEdges: LocalAuthoredEdge[] = [];`,
    `  const localAuthoredEvidence: LocalAuthoredEvidence[] = [];\n  const localEvidenceCandidates: PatternRoomEvidenceCandidate[] = [];\n  const localAuthoredEdges: LocalAuthoredEdge[] = [];`,
    "candidate local array"
  );

  source = replaceRequired(
    source,
    `  let authoredEvidenceIndex = 0;\n  let authoredEdgeIndex = 0;`,
    `  let authoredEvidenceIndex = 0;\n  let evidenceCandidateIndex = 0;\n  let authoredEdgeIndex = 0;`,
    "candidate local index"
  );

  source = replaceRequired(
    source,
    `  function hasLocalAuthoredEvidence(evidenceId: string): boolean {\n    return localAuthoredEvidence.some((evidence) => evidence.id === evidenceId);\n  }`,
    `  function hasLocalAuthoredEvidence(evidenceId: string): boolean {\n    return localAuthoredEvidence.some((evidence) => evidence.id === evidenceId);\n  }\n\n  function hasSourceEntity(sourceId: string): boolean {\n    return hasSource(sourceId) || hasLocalAuthoredSource(sourceId);\n  }\n\n  function resolveSourceLabel(sourceId: string): string | null {\n    const domainSource = domainRef.sources.find((source) => source.id === sourceId);\n    if (domainSource !== undefined) {\n      return domainSource.label;\n    }\n    return localAuthoredSources.find((source) => source.id === sourceId)?.label ?? null;\n  }`,
    "candidate source resolution"
  );

  source = replaceRequired(
    source,
    `  function addAuthoredEdgeRecord(\n    edgeType: PatternEdgeType,`,
    `  function addEvidenceCandidateRecord(\n    suggestionId: string,\n    text: string,\n    reviewSessionId?: string | null,\n    createdAt = new Date().toISOString()\n  ): string | null {\n    const trimmedSuggestionId = suggestionId.trim();\n    const trimmedText = text.trim();\n    const normalizedSessionId = reviewSessionId?.trim() ?? "";\n    if (trimmedSuggestionId === "" || trimmedText === "") {\n      return null;\n    }\n\n    const duplicate = localEvidenceCandidates.some((candidate) => {\n      return (\n        candidate.suggestionId === trimmedSuggestionId &&\n        (candidate.reviewSessionId ?? "") === normalizedSessionId\n      );\n    });\n    if (duplicate) {\n      return null;\n    }\n\n    evidenceCandidateIndex += 1;\n    const id = createLocalId("local-evidence-candidate", evidenceCandidateIndex);\n    localEvidenceCandidates.push({\n      id,\n      suggestionId: trimmedSuggestionId,\n      text: trimmedText,\n      reviewSessionId: normalizedSessionId === "" ? null : normalizedSessionId,\n      origin: "ai-case-review",\n      sourceSection: "evidence",\n      status: "candidate",\n      createdAt,\n    });\n    return id;\n  }\n\n  function createPromotionFailure(\n    candidateId: string,\n    warning: string\n  ): PatternRoomEvidenceCandidatePromotionResult {\n    return {\n      candidateId,\n      promoted: false,\n      evidenceId: null,\n      warnings: [warning],\n    };\n  }\n\n  function promoteEvidenceCandidate(\n    input: PatternRoomEvidenceCandidatePromotionInput\n  ): PatternRoomEvidenceCandidatePromotionResult {\n    const candidateId = input.candidateId.trim();\n    const sourceId = input.sourceId.trim();\n    const excerpt = input.excerpt.trim();\n    const candidateIndex = localEvidenceCandidates.findIndex((candidate) => {\n      return candidate.id === candidateId;\n    });\n    const candidate = localEvidenceCandidates[candidateIndex];\n    if (candidateIndex < 0 || candidate === undefined) {\n      return createPromotionFailure(candidateId, "Evidence candidate was not found.");\n    }\n    if (!hasSourceEntity(sourceId)) {\n      return createPromotionFailure(\n        candidateId,\n        "Evidence promotion requires an existing source id."\n      );\n    }\n    if (excerpt === "") {\n      return createPromotionFailure(\n        candidateId,\n        "Evidence promotion requires a non-empty selected source excerpt."\n      );\n    }\n\n    const sourceLabel = resolveSourceLabel(sourceId);\n    if (sourceLabel === null) {\n      return createPromotionFailure(candidateId, "Evidence source label could not be resolved.");\n    }\n\n    const label = input.label?.trim() || \`AI Evidence Candidate \${candidate.id}\`;\n    const interpretation = input.interpretation?.trim() || candidate.text;\n    const evidenceId = addAuthoredEvidenceRecord(\n      label,\n      excerpt,\n      interpretation,\n      input.layer ?? "evidence",\n      new Date().toISOString(),\n      undefined,\n      { sourceId, sourceLabel }\n    );\n    if (evidenceId === null) {\n      return createPromotionFailure(candidateId, "Evidence promotion could not create evidence.");\n    }\n\n    localEvidenceCandidates.splice(candidateIndex, 1);\n    notify();\n    return {\n      candidateId,\n      promoted: true,\n      evidenceId,\n      warnings: [],\n    };\n  }\n\n  function removeEvidenceCandidate(candidateId: string): boolean {\n    const trimmedCandidateId = candidateId.trim();\n    const candidateIndex = localEvidenceCandidates.findIndex((candidate) => {\n      return candidate.id === trimmedCandidateId;\n    });\n    if (candidateIndex < 0) {\n      return false;\n    }\n    localEvidenceCandidates.splice(candidateIndex, 1);\n    notify();\n    return true;\n  }\n\n  function addAuthoredEdgeRecord(\n    edgeType: PatternEdgeType,`,
    "candidate persistence and promotion implementation"
  );

  source = replaceRequired(
    source,
    `    localAuthoredEvidence.length = 0;\n    localAuthoredEdges.length = 0;`,
    `    localAuthoredEvidence.length = 0;\n    localEvidenceCandidates.length = 0;\n    localAuthoredEdges.length = 0;`,
    "candidate reset"
  );

  source = replaceRequired(
    source,
    `    authoredEvidenceIndex = 0;\n    authoredEdgeIndex = 0;`,
    `    authoredEvidenceIndex = 0;\n    evidenceCandidateIndex = 0;\n    authoredEdgeIndex = 0;`,
    "candidate reset index"
  );

  source = replaceRequired(
    source,
    `    addAuthoredEdge(\n      edgeType: PatternEdgeType,`,
    `    addEvidenceCandidate(\n      suggestionId: string,\n      text: string,\n      reviewSessionId?: string | null\n    ): boolean {\n      if (addEvidenceCandidateRecord(suggestionId, text, reviewSessionId)) {\n        notify();\n        return true;\n      }\n      return false;\n    },\n    promoteEvidenceCandidate(\n      input: PatternRoomEvidenceCandidatePromotionInput\n    ): PatternRoomEvidenceCandidatePromotionResult {\n      return promoteEvidenceCandidate(input);\n    },\n    removeEvidenceCandidate(candidateId: string): boolean {\n      return removeEvidenceCandidate(candidateId);\n    },\n    addAuthoredEdge(\n      edgeType: PatternEdgeType,`,
    "candidate public state methods"
  );

  source = replaceRequired(
    source,
    `        localAuthoredEvidence: cloneAuthoredEvidence(localAuthoredEvidence),\n        localAuthoredEdges: cloneAuthoredEdges(localAuthoredEdges),`,
    `        localAuthoredEvidence: cloneAuthoredEvidence(localAuthoredEvidence),\n        localEvidenceCandidates: cloneEvidenceCandidates(localEvidenceCandidates),\n        localAuthoredEdges: cloneAuthoredEdges(localAuthoredEdges),`,
    "candidate overlay snapshot"
  );

  source = replaceRequired(
    source,
    `      localAuthoredEdges.splice(\n        0,\n        localAuthoredEdges.length,\n        ...cloneAuthoredEdges(overlay.localAuthoredEdges)\n      );`,
    `      localEvidenceCandidates.splice(\n        0,\n        localEvidenceCandidates.length,\n        ...cloneEvidenceCandidates(overlay.localEvidenceCandidates ?? [])\n      );\n      localAuthoredEdges.splice(\n        0,\n        localAuthoredEdges.length,\n        ...cloneAuthoredEdges(overlay.localAuthoredEdges)\n      );`,
    "candidate overlay restore"
  );

  source = replaceRequired(
    source,
    `      authoredEvidenceIndex = getMaxLocalIdIndex(localAuthoredEvidence, "local-evidence");\n      authoredEdgeIndex = getMaxLocalIdIndex(localAuthoredEdges, "local-edge");`,
    `      authoredEvidenceIndex = getMaxLocalIdIndex(localAuthoredEvidence, "local-evidence");\n      evidenceCandidateIndex = getMaxLocalIdIndex(\n        localEvidenceCandidates,\n        "local-evidence-candidate"\n      );\n      authoredEdgeIndex = getMaxLocalIdIndex(localAuthoredEdges, "local-edge");`,
    "candidate restore index"
  );

  await writeRepoFile(path, source);
}

async function updateSnapshotState() {
  const path = "rooms/pattern-room/shared/state/pattern-room-snapshot.ts";
  let source = await readRepoFile(path);

  source = replaceRequired(
    source,
    `  LocalNote,\n  PatternRoomLocalDomainReference,`,
    `  LocalNote,\n  PatternRoomLocalDomainReference,`,
    "snapshot local state import anchor"
  );
  source = replaceRequired(
    source,
    `} from "./pattern-room-local-state.js";`,
    `} from "./pattern-room-local-state.js";\nimport type { PatternRoomEvidenceCandidate } from "../types/pattern-room-evidence-candidate.js";`,
    "snapshot candidate type import"
  );

  source = replaceRequired(
    source,
    `function parseLocalAuthoredEdges(value: unknown): LocalAuthoredEdge[] {`,
    `function parseLocalEvidenceCandidates(value: unknown): PatternRoomEvidenceCandidate[] {\n  if (!Array.isArray(value)) {\n    return [];\n  }\n\n  const candidates: PatternRoomEvidenceCandidate[] = [];\n  for (const candidate of value) {\n    const reviewSessionId = isRecord(candidate) ? candidate["reviewSessionId"] : undefined;\n    if (\n      !isRecord(candidate) ||\n      !hasLocalIdFormat(candidate["id"], "local-evidence-candidate") ||\n      typeof candidate["suggestionId"] !== "string" ||\n      typeof candidate["text"] !== "string" ||\n      (reviewSessionId !== null && typeof reviewSessionId !== "string") ||\n      candidate["origin"] !== "ai-case-review" ||\n      candidate["sourceSection"] !== "evidence" ||\n      candidate["status"] !== "candidate" ||\n      typeof candidate["createdAt"] !== "string" ||\n      candidate["suggestionId"].trim() === "" ||\n      candidate["text"].trim() === ""\n    ) {\n      continue;\n    }\n\n    candidates.push({\n      id: candidate["id"],\n      suggestionId: candidate["suggestionId"].trim(),\n      text: candidate["text"].trim(),\n      reviewSessionId:\n        typeof reviewSessionId === "string" && reviewSessionId.trim() !== ""\n          ? reviewSessionId.trim()\n          : null,\n      origin: "ai-case-review",\n      sourceSection: "evidence",\n      status: "candidate",\n      createdAt: candidate["createdAt"],\n    });\n  }\n  return candidates;\n}\n\nfunction parseLocalAuthoredEdges(value: unknown): LocalAuthoredEdge[] {`,
    "snapshot candidate parser"
  );

  source = replaceRequired(
    source,
    `  const localAuthoredEvidence = parseLocalAuthoredEvidence(value["localAuthoredEvidence"]);\n  const localAuthoredEdges = parseLocalAuthoredEdges(value["localAuthoredEdges"]);`,
    `  const localAuthoredEvidence = parseLocalAuthoredEvidence(value["localAuthoredEvidence"]);\n  const localEvidenceCandidates = parseLocalEvidenceCandidates(value["localEvidenceCandidates"]);\n  const localAuthoredEdges = parseLocalAuthoredEdges(value["localAuthoredEdges"]);`,
    "snapshot candidate parse invocation"
  );

  source = replaceRequired(
    source,
    `    localAuthoredEvidence,\n    localAuthoredEdges,`,
    `    localAuthoredEvidence,\n    localEvidenceCandidates,\n    localAuthoredEdges,`,
    "snapshot parsed overlay candidates"
  );

  source = replaceRequired(
    source,
    `  const localAuthoredEvidence = filterUniqueRecordsById(snapshotOverlay.localAuthoredEvidence);\n  const localNodeIds = new Set(`,
    `  const localAuthoredEvidence = filterUniqueRecordsById(snapshotOverlay.localAuthoredEvidence);\n  const localEvidenceCandidates = filterUniqueRecordsById(\n    snapshotOverlay.localEvidenceCandidates ?? []\n  );\n  const localNodeIds = new Set(`,
    "snapshot candidate restore collection"
  );

  source = replaceRequired(
    source,
    `    localAuthoredEvidence,\n    localAuthoredEdges,\n  };\n}`,
    `    localAuthoredEvidence,\n    localEvidenceCandidates,\n    localAuthoredEdges,\n  };\n}`,
    "snapshot restored overlay candidates"
  );

  await writeRepoFile(path, source);
}

async function updateCaseReviewApply() {
  const path = "rooms/pattern-room/shared/adapters/pattern-room-case-review-apply.ts";
  let source = await readRepoFile(path);

  source = replaceRequired(
    source,
    `  readonly addAuthoredEdge: (`,
    `  readonly addEvidenceCandidate: (\n    suggestionId: string,\n    text: string,\n    reviewSessionId?: string | null\n  ) => boolean;\n  readonly addAuthoredEdge: (`,
    "apply target candidate method"
  );

  source = replaceRequired(
    source,
    `  readonly mode: PatternRoomCaseReviewApplyMode;\n  readonly copy?: PatternRoomCaseReviewApplyCopy;`,
    `  readonly mode: PatternRoomCaseReviewApplyMode;\n  readonly sessionId?: string | null;\n  readonly copy?: PatternRoomCaseReviewApplyCopy;`,
    "apply candidate session provenance"
  );

  source = replaceRequired(
    source,
    `  evidenceAdded: number;\n  openQuestionsAdded: number;`,
    `  evidenceAdded: number;\n  evidenceCandidatesAdded: number;\n  openQuestionsAdded: number;`,
    "mutable candidate summary"
  );

  source = replaceRequired(
    source,
    `    evidenceAdded: 0,\n    openQuestionsAdded: 0,`,
    `    evidenceAdded: 0,\n    evidenceCandidatesAdded: 0,\n    openQuestionsAdded: 0,`,
    "candidate summary initialization"
  );

  source = replaceRequired(
    source,
    `function retainEvidenceCandidates(\n  result: PatternRoomCaseReviewResult,\n  summary: MutableApplySummary\n): void {\n  const candidateCount = result.suggestions.filter((suggestion) => {\n    return suggestion.kind === "evidence_candidate";\n  }).length;\n  if (candidateCount === 0) {\n    return;\n  }\n\n  summary.skipped += candidateCount;\n  summary.warnings.push(\n    "Evidence suggestions were retained as candidates and were not added as evidence. Link each candidate to a real source and excerpt before promotion."\n  );\n}`,
    `function retainEvidenceCandidates(\n  result: PatternRoomCaseReviewResult,\n  target: PatternRoomCaseReviewApplyTarget,\n  summary: MutableApplySummary,\n  reviewSessionId?: string | null\n): void {\n  result.suggestions\n    .filter((suggestion) => suggestion.kind === "evidence_candidate")\n    .forEach((suggestion) => {\n      if (target.addEvidenceCandidate(suggestion.id, suggestion.text, reviewSessionId)) {\n        summary.evidenceCandidatesAdded += 1;\n        return;\n      }\n      summary.skipped += 1;\n      summary.warnings.push(\n        \`Evidence candidate was not stored because it was empty or already existed: \${suggestion.id}.\`\n      );\n    });\n}`,
    "persist evidence candidates during apply"
  );

  source = source.replace(
    "    retainEvidenceCandidates(result, summary);",
    "    retainEvidenceCandidates(result, target, summary, options.sessionId);"
  );
  source = source.replace(
    "  retainEvidenceCandidates(result, summary);",
    "  retainEvidenceCandidates(result, target, summary, options.sessionId);"
  );

  source = replaceRequired(
    source,
    `      addAuthoredEvidence: () => undefined,\n      addAuthoredEdge: () => undefined,`,
    `      addAuthoredEvidence: () => undefined,\n      addEvidenceCandidate: () => true,\n      addAuthoredEdge: () => undefined,`,
    "apply preview candidate target"
  );

  await writeRepoFile(path, source);
}

async function updateCaseReviewSessionType() {
  const path = "rooms/pattern-room/shared/types/pattern-room-case-review-session.ts";
  let source = await readRepoFile(path);
  source = replaceRequired(
    source,
    `  readonly evidenceAdded: number;\n  readonly openQuestionsAdded: number;`,
    `  readonly evidenceAdded: number;\n  readonly evidenceCandidatesAdded?: number;\n  readonly openQuestionsAdded: number;`,
    "case review candidate summary field"
  );
  await writeRepoFile(path, source);
}

async function updateUiRuntime() {
  const path = "rooms/pattern-room/ui/pattern-room-ui-runtime.ts";
  let source = await readRepoFile(path);

  source = replaceRequired(
    source,
    `  function createCaseReviewApplyOptions(\n    mode: PatternRoomCaseReviewApplyMode\n  ): PatternRoomCaseReviewApplyOptions {`,
    `  function createCaseReviewApplyOptions(\n    mode: PatternRoomCaseReviewApplyMode,\n    sessionId: string\n  ): PatternRoomCaseReviewApplyOptions {`,
    "runtime apply options session id"
  );

  source = replaceRequired(
    source,
    `    return {\n      mode,\n      copy: {`,
    `    return {\n      mode,\n      sessionId,\n      copy: {`,
    "runtime apply session provenance"
  );

  source = replaceRequired(
    source,
    `      const applyOptions = createCaseReviewApplyOptions(mode);`,
    `      const applyOptions = createCaseReviewApplyOptions(mode, session.sessionId);`,
    "runtime apply options invocation"
  );

  await writeRepoFile(path, source);
}

async function updatePipelineRegressions() {
  const path = "scripts/tests/pattern-room-case-review-pipeline-regressions.test.ts";
  let source = await readRepoFile(path);

  source = replaceRequired(
    source,
    `    evidence: [] as string[],\n    questions: [] as string[],`,
    `    evidence: [] as string[],\n    candidates: [] as string[],\n    questions: [] as string[],`,
    "pipeline candidate calls"
  );

  source = replaceRequired(
    source,
    `    addAuthoredEdge(\n      edgeType:`,
    `    addEvidenceCandidate(\n      suggestionId: string,\n      text: string,\n      reviewSessionId?: string | null\n    ): boolean {\n      calls.candidates.push(\n        \`\${suggestionId}:\${text}:\${reviewSessionId ?? ""}\`\n      );\n      return true;\n    },\n    addAuthoredEdge(\n      edgeType:`,
    "pipeline candidate target"
  );

  source = replaceRequired(
    source,
    `  const evidenceOnly = applyPatternRoomCaseReview(result, target, {\n    mode: "evidence-suggestions-only",\n  });\n  assert.equal(evidenceOnly.evidenceAdded, 0);\n  assert.equal(evidenceOnly.skipped, 1);\n  assert.equal(evidenceOnly.warnings.length, 1);\n  assert.equal(calls.evidence.length, 0);`,
    `  const evidenceOnly = applyPatternRoomCaseReview(result, target, {\n    mode: "evidence-suggestions-only",\n    sessionId: "session-candidate",\n  });\n  assert.equal(evidenceOnly.evidenceAdded, 0);\n  assert.equal(evidenceOnly.evidenceCandidatesAdded, 1);\n  assert.equal(evidenceOnly.skipped, 0);\n  assert.equal(evidenceOnly.warnings.length, 0);\n  assert.equal(calls.candidates.length, 1);\n  assert.match(calls.candidates[0] ?? "", /session-candidate$/);\n  assert.equal(calls.evidence.length, 0);`,
    "pipeline evidence candidate persistence assertions"
  );

  source = replaceRequired(
    source,
    `  calls.evidence.length = 0;\n  calls.questions.length = 0;\n  const preview =`,
    `  calls.evidence.length = 0;\n  calls.candidates.length = 0;\n  calls.questions.length = 0;\n  const preview =`,
    "pipeline reset candidate calls"
  );

  source = replaceRequired(
    source,
    `  assert.equal(preview.boardNotesAdded, 3);\n  assert.equal(calls.notes.length, 0);`,
    `  assert.equal(preview.boardNotesAdded, 3);\n  assert.equal(preview.evidenceCandidatesAdded, 1);\n  assert.equal(calls.notes.length, 0);`,
    "pipeline preview candidate summary"
  );

  source = replaceRequired(
    source,
    `  assert.equal(all.evidenceAdded, 0);\n  assert.equal(all.openQuestionsAdded, 1);`,
    `  assert.equal(all.evidenceAdded, 0);\n  assert.equal(all.evidenceCandidatesAdded, 1);\n  assert.equal(all.openQuestionsAdded, 1);`,
    "pipeline all candidate summary"
  );

  source = replaceRequired(
    source,
    `  assert.equal(all.skipped, 2);\n  assert.equal(all.warnings.length, 2);`,
    `  assert.equal(all.skipped, 1);\n  assert.equal(all.warnings.length, 1);`,
    "pipeline all candidate warning counts"
  );

  source = replaceRequired(
    source,
    `  assert.equal(calls.notes.length, 3);`,
    `  assert.equal(calls.notes.length, 3);\n  assert.equal(calls.candidates.length, 1);`,
    "pipeline all candidate target call"
  );

  source = replaceRequired(
    source,
    `  assert.equal(calls.evidence.length, 0);\n});`,
    `  assert.equal(calls.evidence.length, 0);\n  assert.equal(calls.candidates.length, 2);\n});`,
    "pipeline localized candidate call"
  );

  await writeRepoFile(path, source);
}

async function updateInstalledUiRegressions() {
  const path = "scripts/tests/pattern-room-installed-ui-smoke-regressions-part6.test.ts";
  let source = await readRepoFile(path);

  source = replaceRequired(
    source,
    `    evidence: 0,\n    nodes: 6,`,
    `    evidence: 0,\n    candidates: 1,\n    nodes: 6,`,
    "installed all candidate count"
  );
  source = replaceRequired(
    source,
    `    evidence: 0,\n    nodes: 1,`,
    `    evidence: 0,\n    candidates: 0,\n    nodes: 1,`,
    "installed question candidate count"
  );
  source = replaceRequired(
    source,
    `    mode: "evidence-suggestions-only",\n    selector: "[data-pattern-case-review-apply-evidence-suggestions='true']",\n    notes: 0,\n    evidence: 0,\n    nodes: 0,\n    edges: 0,\n    autosaves: 0,`,
    `    mode: "evidence-suggestions-only",\n    selector: "[data-pattern-case-review-apply-evidence-suggestions='true']",\n    notes: 0,\n    evidence: 0,\n    candidates: 1,\n    nodes: 0,\n    edges: 0,\n    autosaves: 1,`,
    "installed evidence-only candidate persistence"
  );

  source = replaceRequired(
    source,
    `      assert.equal(\n        snapshotAfterApply.overlay.localAuthoredNodes.length -`,
    `      assert.equal(\n        (snapshotAfterApply.overlay.localEvidenceCandidates ?? []).length -\n          (snapshotBeforeReply.overlay.localEvidenceCandidates ?? []).length,\n        applyCase.candidates\n      );\n      assert.equal(\n        snapshotAfterApply.overlay.localAuthoredNodes.length -`,
    "installed candidate snapshot assertion"
  );

  source = replaceRequired(
    source,
    `        assert.equal(controlPayload.summary?.mode, applyCase.mode);`,
    `        assert.equal(controlPayload.summary?.mode, applyCase.mode);\n        assert.equal(\n          controlPayload.summary?.evidenceCandidatesAdded ?? 0,\n          applyCase.candidates\n        );`,
    "installed candidate control summary"
  );

  await writeRepoFile(path, source);
}

async function addCandidateRegressions() {
  const path = "scripts/tests/pattern-room-evidence-candidate-regressions.test.ts";
  const content = `import test from "node:test";
import assert from "node:assert/strict";

import { PATTERN_ROOM_DOMAIN_TEST_FIXTURE } from "../../rooms/pattern-room/shared/data/testing/pattern-room-domain.fixture.ts";
import { createLocalState } from "../../rooms/pattern-room/shared/state/pattern-room-local-state.ts";
import {
  createSnapshot,
  restoreFromSnapshot,
} from "../../rooms/pattern-room/shared/state/pattern-room-snapshot.ts";

void test("pattern-room evidence candidates persist in snapshots without becoming evidence", () => {
  const localState = createLocalState(PATTERN_ROOM_DOMAIN_TEST_FIXTURE);

  assert.equal(
    localState.addEvidenceCandidate(
      "suggestion-item-001",
      "Saat damgası gerçek kaynaktan yeniden seçilmeli.",
      "session-001"
    ),
    true
  );
  assert.equal(
    localState.addEvidenceCandidate(
      "suggestion-item-001",
      "Saat damgası gerçek kaynaktan yeniden seçilmeli.",
      "session-001"
    ),
    false
  );

  const overlay = localState.getOverlay();
  assert.equal(overlay.localAuthoredEvidence.length, 0);
  assert.equal(overlay.localEvidenceCandidates?.length, 1);
  assert.equal(overlay.localEvidenceCandidates?.[0]?.status, "candidate");

  const snapshot = createSnapshot(localState, "tenth-man");
  const restored = restoreFromSnapshot(snapshot, PATTERN_ROOM_DOMAIN_TEST_FIXTURE);
  assert.ok(restored);
  assert.equal(restored.overlay.localAuthoredEvidence.length, 0);
  assert.equal(restored.overlay.localEvidenceCandidates?.length, 1);
  assert.equal(restored.overlay.localEvidenceCandidates?.[0]?.reviewSessionId, "session-001");

  const legacyOverlay = { ...snapshot.overlay };
  delete legacyOverlay.localEvidenceCandidates;
  const restoredLegacy = restoreFromSnapshot(
    { ...snapshot, overlay: legacyOverlay },
    PATTERN_ROOM_DOMAIN_TEST_FIXTURE
  );
  assert.ok(restoredLegacy);
  assert.deepEqual(restoredLegacy.overlay.localEvidenceCandidates, []);
});

void test("pattern-room evidence promotion requires an existing source and selected excerpt", () => {
  const localState = createLocalState(PATTERN_ROOM_DOMAIN_TEST_FIXTURE);
  localState.addEvidenceCandidate(
    "suggestion-item-001",
    "AI yorumu yalnız yorum alanına taşınmalı.",
    "session-002"
  );
  const candidateId = localState.getOverlay().localEvidenceCandidates?.[0]?.id;
  assert.ok(candidateId);

  const missingSource = localState.promoteEvidenceCandidate({
    candidateId,
    sourceId: "missing-source",
    excerpt: "Gerçek alıntı",
  });
  assert.equal(missingSource.promoted, false);
  assert.equal(localState.getOverlay().localEvidenceCandidates?.length, 1);

  const missingExcerpt = localState.promoteEvidenceCandidate({
    candidateId,
    sourceId: "source-001",
    excerpt: "   ",
  });
  assert.equal(missingExcerpt.promoted, false);
  assert.equal(localState.getOverlay().localAuthoredEvidence.length, 0);

  const promoted = localState.promoteEvidenceCandidate({
    candidateId,
    sourceId: "source-001",
    excerpt: "22:14 saat damgası",
    label: "Seçilmiş saat damgası",
  });
  assert.equal(promoted.promoted, true);
  assert.ok(promoted.evidenceId);

  const overlay = localState.getOverlay();
  assert.equal(overlay.localEvidenceCandidates?.length, 0);
  assert.equal(overlay.localAuthoredEvidence.length, 1);
  assert.equal(overlay.localAuthoredEvidence[0]?.excerpt, "22:14 saat damgası");
  assert.equal(
    overlay.localAuthoredEvidence[0]?.interpretation,
    "AI yorumu yalnız yorum alanına taşınmalı."
  );
  assert.equal(overlay.localAuthoredEvidence[0]?.sourceId, "source-001");
  assert.equal(
    overlay.localAuthoredEvidence[0]?.sourceLabel,
    localState.resolveEntityLabel("source-001")
  );
});
`;
  await writeRepoFile(path, content);
}

async function updateCoreTestCommand() {
  const path = "package.json";
  let source = await readRepoFile(path);
  source = replaceRequired(
    source,
    `scripts/tests/pattern-room-case-review-pipeline-regressions.test.ts scripts/tests/pattern-room-source-workbench-regressions.test.ts`,
    `scripts/tests/pattern-room-case-review-pipeline-regressions.test.ts scripts/tests/pattern-room-evidence-candidate-regressions.test.ts scripts/tests/pattern-room-source-workbench-regressions.test.ts`,
    "candidate regression in rooms:test:core"
  );
  await writeRepoFile(path, source);
}

async function updateProgress() {
  const path = ".rovo/pattern-room-v2-progress.md";
  let source = await readRepoFile(path);
  source = replaceRequired(
    source,
    `## Next implementation steps\n\n1. Add persistent evidence-candidate records to the local overlay.\n2. Add promotion rules that require a real source and excerpt.\n3. Add canonical JSON and Turkish/English heading parser paths.\n4. Begin the three-region Workspace Shell V2 after the promotion boundary is green.`,
    `## Completed: persistent evidence candidates and promotion boundary\n\n- Applied AI evidence suggestions are stored as explicit local \`candidate\` records.\n- Candidate records persist through snapshot save and restore without entering \`localAuthoredEvidence\`.\n- Candidate provenance retains the originating review session and suggestion id.\n- Promotion rejects missing candidates, unknown sources and empty selected excerpts.\n- Successful promotion creates source-linked evidence, keeps AI text in interpretation and removes the candidate.\n- Older snapshots without the optional candidate collection restore safely with an empty collection.\n\n## Next implementation steps\n\n1. Add the candidate review and promotion controls to the Case Review inspector.\n2. Add canonical JSON and Turkish/English heading parser paths.\n3. Begin the three-region Workspace Shell V2 after the promotion UI and parser boundary are green.`,
    "evidence candidate progress section"
  );
  await writeRepoFile(path, source);
}

await addEvidenceCandidateTypes();
await updateLocalState();
await updateSnapshotState();
await updateCaseReviewApply();
await updateCaseReviewSessionType();
await updateUiRuntime();
await updatePipelineRegressions();
await updateInstalledUiRegressions();
await addCandidateRegressions();
await updateCoreTestCommand();
await updateProgress();

if (changedFiles.length === 0) {
  console.log("Pattern Room evidence candidate migration is already applied.");
} else {
  console.log(`${apply ? "Applied" : "Would apply"} Pattern Room evidence candidate migration:`);
  changedFiles.forEach((path) => console.log(`- ${path}`));
}
