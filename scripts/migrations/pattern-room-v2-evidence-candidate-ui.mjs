import { access, readFile, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const scriptDir = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(scriptDir, "../..");
const apply = process.argv.includes("--apply");
const changedFiles = [];

async function fileExists(path) {
  try {
    await access(resolve(repoRoot, path));
    return true;
  } catch {
    return false;
  }
}

async function readRepoFile(path) {
  return await readFile(resolve(repoRoot, path), "utf8");
}

async function writeRepoFile(path, content) {
  const normalized = content.endsWith("\n") ? content : `${content}\n`;
  const current = (await fileExists(path)) ? await readRepoFile(path) : null;
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
    throw new Error(`Required candidate UI migration pattern was not found: ${label}`);
  }
  return content.replace(search, replacement);
}

async function updateRuntimeView() {
  const path = "rooms/pattern-room/ui/panels/pattern-case-review-runtime-view.ts";
  let source = await readRepoFile(path);
  if (source.includes("function createEvidenceCandidateWorkspace(")) {
    return;
  }

  source = replaceRequired(
    source,
    `} from "../../shared/types/pattern-room-case-review-session.js";\nimport type {`,
    `} from "../../shared/types/pattern-room-case-review-session.js";\nimport type {\n  PatternRoomEvidenceCandidate,\n  PatternRoomEvidenceCandidatePromotionInput,\n} from "../../shared/types/pattern-room-evidence-candidate.js";\nimport type {`,
    "candidate runtime view imports"
  );

  source = replaceRequired(
    source,
    `export type PatternCaseReviewApplyFeedback = {\n  readonly tone: "success" | "error";\n  readonly message: string;\n};\n\nexport type PatternCaseReviewRuntimePanelState = {`,
    `export type PatternCaseReviewApplyFeedback = {\n  readonly tone: "success" | "error";\n  readonly message: string;\n};\n\nexport type PatternCaseReviewEvidenceSourceOption = {\n  readonly id: string;\n  readonly label: string;\n};\n\nexport type PatternCaseReviewRuntimePanelState = {`,
    "candidate source option type"
  );

  source = replaceRequired(
    source,
    `  readonly applyFeedback: PatternCaseReviewApplyFeedback | null;\n  readonly applyDisabled: boolean;\n  readonly text: PatternCaseReviewTranslator;`,
    `  readonly applyFeedback: PatternCaseReviewApplyFeedback | null;\n  readonly applyDisabled: boolean;\n  readonly evidenceCandidates: readonly PatternRoomEvidenceCandidate[];\n  readonly evidenceCandidateSources: readonly PatternCaseReviewEvidenceSourceOption[];\n  readonly evidenceCandidateFeedback: PatternCaseReviewApplyFeedback | null;\n  readonly text: PatternCaseReviewTranslator;`,
    "candidate panel state collections"
  );

  source = replaceRequired(
    source,
    `  readonly onApply: (mode: PatternRoomCaseReviewApplyMode) => void;\n};`,
    `  readonly onApply: (mode: PatternRoomCaseReviewApplyMode) => void;\n  readonly onPromoteEvidenceCandidate: (\n    input: PatternRoomEvidenceCandidatePromotionInput\n  ) => void;\n  readonly onRemoveEvidenceCandidate: (candidateId: string) => void;\n};`,
    "candidate panel actions"
  );

  const candidateWorkspace = `function createEvidenceCandidateWorkspace(\n  state: PatternCaseReviewRuntimePanelState\n): HTMLElement {\n  const workspace = createElement(\n    "section",\n    "pattern-room-case-review-workspace-card pattern-room-evidence-candidate-workspace"\n  );\n  workspace.dataset["patternEvidenceCandidateWorkspace"] = "true";\n  workspace.append(\n    createElement(\n      "span",\n      "pattern-room-context-inspector-label",\n      state.text("candidates.title")\n    ),\n    createElement("p", undefined, state.text("candidates.intro"))\n  );\n\n  if (state.evidenceCandidates.length === 0) {\n    workspace.append(\n      createElement("p", "pattern-room-empty-state", state.text("candidates.empty"))\n    );\n  } else {\n    const list = createElement("div", "pattern-room-evidence-candidate-list");\n    state.evidenceCandidates.forEach((candidate) => {\n      const card = createElement("article", "pattern-room-evidence-candidate-card");\n      card.dataset["patternEvidenceCandidate"] = candidate.id;\n      card.append(\n        createElement("span", "pattern-room-list-eyebrow", state.text("candidates.badge")),\n        createElement("p", "pattern-room-evidence-candidate-text", candidate.text),\n        createElement(\n          "code",\n          "pattern-room-evidence-candidate-provenance",\n          state.text("candidates.provenance", {\n            session: candidate.reviewSessionId ?? "—",\n            suggestion: candidate.suggestionId,\n          })\n        )\n      );\n\n      const sourceField = createElement("label", "pattern-room-evidence-candidate-field");\n      sourceField.append(createElement("span", undefined, state.text("candidates.sourceLabel")));\n      const sourceSelect = createElement("select");\n      sourceSelect.dataset["patternEvidenceCandidateSource"] = candidate.id;\n      const placeholder = createElement(\n        "option",\n        undefined,\n        state.text("candidates.sourcePlaceholder")\n      );\n      placeholder.value = "";\n      sourceSelect.append(placeholder);\n      state.evidenceCandidateSources.forEach((sourceOption) => {\n        const option = createElement("option", undefined, sourceOption.label);\n        option.value = sourceOption.id;\n        sourceSelect.append(option);\n      });\n      sourceField.append(sourceSelect);\n\n      const excerptField = createElement("label", "pattern-room-evidence-candidate-field");\n      excerptField.append(createElement("span", undefined, state.text("candidates.excerptLabel")));\n      const excerpt = createElement("textarea");\n      excerpt.dataset["patternEvidenceCandidateExcerpt"] = candidate.id;\n      excerpt.rows = 4;\n      excerpt.placeholder = state.text("candidates.excerptPlaceholder");\n      excerptField.append(excerpt);\n\n      const actions = createElement("div", "pattern-room-evidence-candidate-actions");\n      const promote = createActionButton(state.text("candidates.promote"), () => {\n        state.onPromoteEvidenceCandidate({\n          candidateId: candidate.id,\n          sourceId: sourceSelect.value,\n          excerpt: excerpt.value,\n        });\n      });\n      promote.dataset["patternEvidenceCandidatePromote"] = candidate.id;\n      const updatePromoteState = (): void => {\n        promote.disabled = sourceSelect.value.trim() === "" || excerpt.value.trim() === "";\n      };\n      sourceSelect.addEventListener("change", updatePromoteState);\n      excerpt.addEventListener("input", updatePromoteState);\n      updatePromoteState();\n\n      const discard = createActionButton(state.text("candidates.discard"), () => {\n        state.onRemoveEvidenceCandidate(candidate.id);\n      });\n      discard.dataset["patternEvidenceCandidateDiscard"] = candidate.id;\n      actions.append(promote, discard);\n      card.append(sourceField, excerptField, actions);\n      list.append(card);\n    });\n    workspace.append(list);\n  }\n\n  if (state.evidenceCandidateFeedback !== null) {\n    const feedback = createElement(\n      "p",\n      \`pattern-room-case-review-apply-feedback \${state.evidenceCandidateFeedback.tone}\`,\n      state.evidenceCandidateFeedback.message\n    );\n    feedback.dataset["patternEvidenceCandidateFeedback"] = state.evidenceCandidateFeedback.tone;\n    workspace.append(feedback);\n  }\n\n  return workspace;\n}\n\n`;

  source = replaceRequired(
    source,
    `function createApplyWorkspace(state: PatternCaseReviewRuntimePanelState): HTMLElement {`,
    `${candidateWorkspace}function createApplyWorkspace(state: PatternCaseReviewRuntimePanelState): HTMLElement {`,
    "candidate workspace renderer"
  );

  source = replaceRequired(
    source,
    `      createReviewMetric(state.text("sections.evidence"), summary.evidenceAdded),\n      createReviewMetric(state.text("result.openQuestions"), summary.openQuestionsAdded),`,
    `      createReviewMetric(state.text("sections.evidence"), summary.evidenceAdded),\n      createReviewMetric(\n        state.text("workspace.evidenceCandidates"),\n        summary.evidenceCandidatesAdded\n      ),\n      createReviewMetric(state.text("result.openQuestions"), summary.openQuestionsAdded),`,
    "candidate apply summary metric"
  );

  source = replaceRequired(
    source,
    `  workspace.append(parsed, createApplyWorkspace(state));`,
    `  workspace.append(\n    parsed,\n    createApplyWorkspace(state),\n    createEvidenceCandidateWorkspace(state)\n  );`,
    "candidate workspace placement"
  );

  await writeRepoFile(path, source);
}

async function updateUiRuntime() {
  const path = "rooms/pattern-room/ui/pattern-room-ui-runtime.ts";
  let source = await readRepoFile(path);
  if (source.includes("function promoteEvidenceCandidateFromReview(")) {
    return;
  }

  source = replaceRequired(
    source,
    `import type { PatternRoomSessionSnapshot } from "../shared/types/pattern-room-snapshot.js";`,
    `import type { PatternRoomSessionSnapshot } from "../shared/types/pattern-room-snapshot.js";\nimport type { PatternRoomEvidenceCandidatePromotionInput } from "../shared/types/pattern-room-evidence-candidate.js";`,
    "candidate promotion input import"
  );

  source = replaceRequired(
    source,
    `  let caseReviewApplyFeedback: PatternCaseReviewApplyFeedback | null = null;\n  let caseReviewLocale = "tr";`,
    `  let caseReviewApplyFeedback: PatternCaseReviewApplyFeedback | null = null;\n  let evidenceCandidateFeedback: PatternCaseReviewApplyFeedback | null = null;\n  let caseReviewLocale = "tr";`,
    "candidate feedback state"
  );

  const runtimeActions = `\n  function promoteEvidenceCandidateFromReview(\n    input: PatternRoomEvidenceCandidatePromotionInput\n  ): void {\n    const result = localState.promoteEvidenceCandidate(input);\n    evidenceCandidateFeedback = result.promoted\n      ? { tone: "success", message: getCaseReviewText()("candidates.promoted") }\n      : {\n          tone: "error",\n          message:\n            result.warnings.join(" ") || getCaseReviewText()("candidates.promotionFailed"),\n        };\n    render();\n  }\n\n  function removeEvidenceCandidateFromReview(candidateId: string): void {\n    const removed = localState.removeEvidenceCandidate(candidateId);\n    evidenceCandidateFeedback = removed\n      ? { tone: "success", message: getCaseReviewText()("candidates.discarded") }\n      : { tone: "error", message: getCaseReviewText()("candidates.discardFailed") };\n    render();\n  }\n`;

  source = replaceRequired(
    source,
    `\n  const actions: PatternPanelActions = {`,
    `${runtimeActions}\n  const actions: PatternPanelActions = {`,
    "candidate runtime actions"
  );

  source = replaceRequired(
    source,
    `            applyFeedback: caseReviewApplyFeedback,\n            dispatchStatus: caseReviewDispatchStatus,`,
    `            applyFeedback: caseReviewApplyFeedback,\n            evidenceCandidateFeedback,\n            evidenceCandidates: localState.getOverlay().localEvidenceCandidates ?? [],\n            evidenceCandidateSources: viewModels.sources.map((source) => {\n              return { id: source.id, label: source.label };\n            }),\n            dispatchStatus: caseReviewDispatchStatus,`,
    "candidate panel state values"
  );

  source = replaceRequired(
    source,
    `            onPrepare: prepareCaseReviewPreview,\n            onResend: resendCaseReview,`,
    `            onPrepare: prepareCaseReviewPreview,\n            onPromoteEvidenceCandidate: promoteEvidenceCandidateFromReview,\n            onRemoveEvidenceCandidate: removeEvidenceCandidateFromReview,\n            onResend: resendCaseReview,`,
    "candidate panel callbacks"
  );

  source = replaceRequired(
    source,
    `      archiveEvidenceCaptureStatus = null;\n      localState.restoreOverlay(restoredState.overlay, restoredState.guards);`,
    `      archiveEvidenceCaptureStatus = null;\n      evidenceCandidateFeedback = null;\n      localState.restoreOverlay(restoredState.overlay, restoredState.guards);`,
    "candidate feedback restore reset"
  );

  await writeRepoFile(path, source);
}

async function updateReviewI18nTypes() {
  const path = "rooms/pattern-room/ui/pattern-case-review-i18n.ts";
  let source = await readRepoFile(path);
  if (source.includes('| "candidates.title"')) {
    return;
  }

  source = replaceRequired(
    source,
    `  | "apply.userAppliedSuggestion"\n  | "statuses.idle"`,
    `  | "apply.userAppliedSuggestion"\n  | "candidates.title"\n  | "candidates.intro"\n  | "candidates.empty"\n  | "candidates.badge"\n  | "candidates.provenance"\n  | "candidates.sourceLabel"\n  | "candidates.sourcePlaceholder"\n  | "candidates.excerptLabel"\n  | "candidates.excerptPlaceholder"\n  | "candidates.promote"\n  | "candidates.discard"\n  | "candidates.promoted"\n  | "candidates.promotionFailed"\n  | "candidates.discarded"\n  | "candidates.discardFailed"\n  | "statuses.idle"`,
    "candidate translator keys"
  );

  source = replaceRequired(
    source,
    `  | "workspace.boardNotes"\n  | "workspace.skipped"`,
    `  | "workspace.boardNotes"\n  | "workspace.evidenceCandidates"\n  | "workspace.skipped"`,
    "candidate metric translator key"
  );

  const trEntries = `  "candidates.title": "Kanıt adayları",\n  "candidates.intro":\n    "AI önerileri burada aday olarak kalır. Kanıta yükseltmek için gerçek bir kaynak ve kaynaktan seçilmiş alıntı gerekir.",\n  "candidates.empty": "Bekleyen kanıt adayı yok.",\n  "candidates.badge": "AI kanıt adayı",\n  "candidates.provenance": "Oturum: %session% · Öneri: %suggestion%",\n  "candidates.sourceLabel": "Gerçek kaynak",\n  "candidates.sourcePlaceholder": "Kaynak seç",\n  "candidates.excerptLabel": "Kaynaktan seçilmiş alıntı",\n  "candidates.excerptPlaceholder": "Kaynakta gerçekten bulunan bölümü buraya aktarın.",\n  "candidates.promote": "Kanıta Yükselt",\n  "candidates.discard": "Adayı Sil",\n  "candidates.promoted": "Kanıt adayı kaynak ve alıntıyla doğrulanarak kanıta yükseltildi.",\n  "candidates.promotionFailed": "Kanıt adayı yükseltilemedi.",\n  "candidates.discarded": "Kanıt adayı silindi.",\n  "candidates.discardFailed": "Kanıt adayı silinemedi.",\n`;
  source = replaceRequired(
    source,
    `  "statuses.idle": "İnceleme hazır değil",`,
    `${trEntries}  "statuses.idle": "İnceleme hazır değil",`,
    "candidate Turkish fallbacks"
  );

  const enEntries = `  "candidates.title": "Evidence candidates",\n  "candidates.intro":\n    "AI suggestions remain candidates here. Promotion requires a real source and an excerpt selected from that source.",\n  "candidates.empty": "There are no pending evidence candidates.",\n  "candidates.badge": "AI evidence candidate",\n  "candidates.provenance": "Session: %session% · Suggestion: %suggestion%",\n  "candidates.sourceLabel": "Real source",\n  "candidates.sourcePlaceholder": "Select a source",\n  "candidates.excerptLabel": "Excerpt selected from source",\n  "candidates.excerptPlaceholder": "Paste the passage that actually appears in the selected source.",\n  "candidates.promote": "Promote to Evidence",\n  "candidates.discard": "Discard Candidate",\n  "candidates.promoted": "The candidate was promoted to source-linked evidence.",\n  "candidates.promotionFailed": "The evidence candidate could not be promoted.",\n  "candidates.discarded": "The evidence candidate was discarded.",\n  "candidates.discardFailed": "The evidence candidate could not be discarded.",\n`;
  source = replaceRequired(
    source,
    `  "statuses.idle": "Review not started",`,
    `${enEntries}  "statuses.idle": "Review not started",`,
    "candidate English fallbacks"
  );

  source = replaceRequired(
    source,
    `  "workspace.boardNotes": "Pano notları",\n  "workspace.skipped": "Atlanan",`,
    `  "workspace.boardNotes": "Pano notları",\n  "workspace.evidenceCandidates": "Kanıt adayları",\n  "workspace.skipped": "Atlanan",`,
    "candidate Turkish metric fallback"
  );
  source = replaceRequired(
    source,
    `  "workspace.boardNotes": "Board notes",\n  "workspace.skipped": "Skipped",`,
    `  "workspace.boardNotes": "Board notes",\n  "workspace.evidenceCandidates": "Evidence candidates",\n  "workspace.skipped": "Skipped",`,
    "candidate English metric fallback"
  );

  await writeRepoFile(path, source);
}

async function updateReviewCatalog(path, values) {
  const catalog = JSON.parse(await readRepoFile(path));
  catalog.review.candidates = { ...values };
  catalog.review.workspace.evidenceCandidates = catalog.review.candidates.metric;
  delete catalog.review.candidates.metric;
  await writeRepoFile(path, `${JSON.stringify(catalog, null, 2)}\n`);
}

async function updateReviewCatalogs() {
  await updateReviewCatalog("rooms/pattern-room/i18n/tr.json", {
    title: "Kanıt adayları",
    intro:
      "AI önerileri burada aday olarak kalır. Kanıta yükseltmek için gerçek bir kaynak ve kaynaktan seçilmiş alıntı gerekir.",
    empty: "Bekleyen kanıt adayı yok.",
    badge: "AI kanıt adayı",
    provenance: "Oturum: %session% · Öneri: %suggestion%",
    sourceLabel: "Gerçek kaynak",
    sourcePlaceholder: "Kaynak seç",
    excerptLabel: "Kaynaktan seçilmiş alıntı",
    excerptPlaceholder: "Kaynakta gerçekten bulunan bölümü buraya aktarın.",
    promote: "Kanıta Yükselt",
    discard: "Adayı Sil",
    promoted: "Kanıt adayı kaynak ve alıntıyla doğrulanarak kanıta yükseltildi.",
    promotionFailed: "Kanıt adayı yükseltilemedi.",
    discarded: "Kanıt adayı silindi.",
    discardFailed: "Kanıt adayı silinemedi.",
    metric: "Kanıt adayları",
  });
  await updateReviewCatalog("rooms/pattern-room/i18n/en.json", {
    title: "Evidence candidates",
    intro:
      "AI suggestions remain candidates here. Promotion requires a real source and an excerpt selected from that source.",
    empty: "There are no pending evidence candidates.",
    badge: "AI evidence candidate",
    provenance: "Session: %session% · Suggestion: %suggestion%",
    sourceLabel: "Real source",
    sourcePlaceholder: "Select a source",
    excerptLabel: "Excerpt selected from source",
    excerptPlaceholder: "Paste the passage that actually appears in the selected source.",
    promote: "Promote to Evidence",
    discard: "Discard Candidate",
    promoted: "The candidate was promoted to source-linked evidence.",
    promotionFailed: "The evidence candidate could not be promoted.",
    discarded: "The evidence candidate was discarded.",
    discardFailed: "The evidence candidate could not be discarded.",
    metric: "Evidence candidates",
  });
}

async function updateStyle() {
  const path = "rooms/pattern-room/ui/style.css";
  let source = await readRepoFile(path);
  if (source.includes(".pattern-room-evidence-candidate-workspace")) {
    return;
  }

  source += `\n/* Evidence candidates — explicit source-backed promotion */\n.pattern-room-evidence-candidate-workspace {\n  display: grid;\n  gap: var(--pattern-px-12);\n}\n\n.pattern-room-evidence-candidate-list {\n  display: grid;\n  gap: var(--pattern-px-12);\n}\n\n.pattern-room-evidence-candidate-card {\n  display: grid;\n  gap: var(--pattern-px-10);\n  padding: var(--pattern-px-14);\n  border: var(--pattern-px-1) solid var(--pattern-accent-amber-alpha-22);\n  border-radius: var(--pattern-px-6);\n  background: var(--pattern-surface-panel-alpha-82);\n}\n\n.pattern-room-evidence-candidate-text {\n  margin: 0;\n  color: var(--pattern-text-warm);\n}\n\n.pattern-room-evidence-candidate-provenance {\n  color: var(--pattern-text-subtle);\n  overflow-wrap: anywhere;\n}\n\n.pattern-room-evidence-candidate-field {\n  display: grid;\n  gap: var(--pattern-px-6);\n  color: var(--pattern-text-muted);\n  font-family: "IBM Plex Mono", monospace;\n  font-size: var(--pattern-rem-0-76);\n}\n\n.pattern-room-evidence-candidate-field select,\n.pattern-room-evidence-candidate-field textarea {\n  width: 100%;\n  padding: var(--pattern-px-9);\n  border: var(--pattern-px-1) solid var(--pattern-text-alpha-16);\n  border-radius: var(--pattern-px-4);\n  background: var(--pattern-surface);\n  color: var(--pattern-text);\n  font: inherit;\n}\n\n.pattern-room-evidence-candidate-actions {\n  display: flex;\n  flex-wrap: wrap;\n  gap: var(--pattern-px-8);\n}\n`;
  await writeRepoFile(path, source);
}

async function updateInstalledUiRegression() {
  const path = "scripts/tests/pattern-room-installed-ui-smoke-regressions-part6.test.ts";
  let source = await readRepoFile(path);
  if (
    source.includes(
      "promotes a retained evidence candidate only after source and excerpt selection"
    )
  ) {
    return;
  }

  const testSource = [
    "",
    'void test("pattern-room installed UI promotes a retained evidence candidate only after source and excerpt selection", async () => {',
    "  const environment = createMinimalForgeUiEnvironment();",
    '  const installedCopy = await createRoomInstalledCopy("pattern-room");',
    "",
    "  try {",
    "    const runtimeModule = (await import(",
    '      `${pathToFileURL(resolve(installedCopy.rootDir, "ui/pattern-room-ui-runtime.js")).href}?candidate-promotion-${Date.now()}`',
    "    )) as PatternRoomUiRuntimeModule;",
    "    const runtime = runtimeModule.createPatternRoomUiRuntime({",
    "      domain: PATTERN_ROOM_DOMAIN_TEST_FIXTURE,",
    "    });",
    "    runtime.start();",
    '    emitHostContext(environment, "en");',
    "    openTenthMan(environment.app);",
    "    setWindowConfirm(() => true);",
    "    const command = prepareAndSend(environment);",
    "    const snapshotBeforeReply = runtime.createSnapshot();",
    "    driveReviewReady(environment, command);",
    "",
    "    const retain = environment.app.querySelector(",
    "      \"[data-pattern-case-review-apply-evidence-suggestions='true']\"",
    "    );",
    "    assert.ok(retain);",
    '    fireEvent(retain, "click");',
    "",
    '    const candidateId = "local-evidence-candidate-001";',
    "    const candidate = environment.app.querySelector(",
    "      `[data-pattern-evidence-candidate='${candidateId}']`",
    "    );",
    "    assert.ok(candidate);",
    "    assert.equal(runtime.createSnapshot().overlay.localEvidenceCandidates?.length, 1);",
    "    assert.equal(",
    "      runtime.createSnapshot().overlay.localAuthoredEvidence.length,",
    "      snapshotBeforeReply.overlay.localAuthoredEvidence.length",
    "    );",
    "",
    "    const source = environment.app.querySelector(",
    "      `[data-pattern-evidence-candidate-source='${candidateId}']`",
    "    );",
    "    const excerpt = environment.app.querySelector(",
    "      `[data-pattern-evidence-candidate-excerpt='${candidateId}']`",
    "    );",
    "    const promote = environment.app.querySelector(",
    "      `[data-pattern-evidence-candidate-promote='${candidateId}']`",
    "    );",
    "    assert.ok(source);",
    "    assert.ok(excerpt);",
    "    assert.ok(promote);",
    "    assert.equal(promote.disabled, true);",
    "",
    '    source.value = "source-navigation-log";',
    '    fireEvent(source, "change");',
    '    excerpt.value = "Selected navigation log passage.";',
    '    fireEvent(excerpt, "input");',
    "    assert.equal(promote.disabled, false);",
    '    fireEvent(promote, "click");',
    "",
    "    const snapshotAfterPromotion = runtime.createSnapshot();",
    "    assert.equal(snapshotAfterPromotion.overlay.localEvidenceCandidates?.length, 0);",
    "    assert.equal(",
    "      snapshotAfterPromotion.overlay.localAuthoredEvidence.length -",
    "        snapshotBeforeReply.overlay.localAuthoredEvidence.length,",
    "      1",
    "    );",
    "    assert.equal(",
    "      snapshotAfterPromotion.overlay.localAuthoredEvidence.at(-1)?.sourceId,",
    '      "source-navigation-log"',
    "    );",
    "    assert.equal(",
    "      snapshotAfterPromotion.overlay.localAuthoredEvidence.at(-1)?.excerpt,",
    '      "Selected navigation log passage."',
    "    );",
    "    assert.equal(",
    "      snapshotAfterPromotion.overlay.localAuthoredEvidence.at(-1)?.interpretation,",
    '      "Recheck the original navigation log image."',
    "    );",
    "    assert.ok(",
    "      environment.app.querySelector(\"[data-pattern-evidence-candidate-feedback='success']\")",
    "    );",
    "    runtime.dispose();",
    "  } finally {",
    "    environment.restore();",
    "    await installedCopy.cleanup();",
    "  }",
    "});",
    "",
  ].join("\n");

  source += testSource;
  await writeRepoFile(path, source);
}

async function updateProgress() {
  const path = ".rovo/pattern-room-v2-progress.md";
  let source = await readRepoFile(path);
  if (source.includes("## Completed: evidence candidate promotion UI")) {
    return;
  }
  const marker = "## Next implementation steps";
  source = replaceRequired(
    source,
    marker,
    `## Completed: evidence candidate promotion UI\n\n- Case Review displays persisted AI evidence candidates as a separate review queue.\n- Promotion controls require the user to select a real source and enter a source excerpt before activation.\n- Promotion delegates to the guarded local-state command and never treats AI text as the excerpt.\n- Successful promotion removes the candidate, creates source-linked evidence and preserves AI text as interpretation.\n- Candidates can be explicitly discarded by the user.\n- Installed UI regressions cover disabled promotion, source selection, excerpt entry and source-linked evidence output.\n\n${marker}`,
    "candidate UI progress section"
  );
  source = source.replace(
    `1. Add the candidate review and promotion controls to the Case Review inspector.\n2. Add canonical JSON and Turkish/English heading parser paths.\n3. Begin the three-region Workspace Shell V2 after the promotion UI and parser boundary are green.`,
    `1. Add canonical JSON and Turkish/English heading parser paths.\n2. Begin the three-region Workspace Shell V2 after the parser boundary is green.`
  );
  await writeRepoFile(path, source);
}

await updateRuntimeView();
await updateUiRuntime();
await updateReviewI18nTypes();
await updateReviewCatalogs();
await updateStyle();
await updateInstalledUiRegression();
await updateProgress();

if (changedFiles.length === 0) {
  console.log("Pattern Room evidence candidate promotion UI is already current.");
} else {
  console.log(`${apply ? "Applied" : "Would apply"}:`);
  changedFiles.forEach((path) => {
    console.log(`- ${path}`);
  });
}
