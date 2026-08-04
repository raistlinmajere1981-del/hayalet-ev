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
  const current = await readRepoFile(path).catch(() => "");
  if (current === normalized) {
    return;
  }
  changedFiles.push(path);
  if (apply) {
    await writeFile(resolve(repoRoot, path), normalized, "utf8");
  }
}

function replaceRequired(source, search, replacement, label) {
  if (source.includes(replacement)) {
    return source;
  }
  if (!source.includes(search)) {
    throw new Error(`Required case-identity migration pattern was not found: ${label}`);
  }
  return source.replace(search, replacement);
}

async function updateLocalState() {
  const path = "rooms/pattern-room/shared/state/pattern-room-local-state.ts";
  let source = await readRepoFile(path);

  source = replaceRequired(
    source,
    `export type PatternRoomLocalOverlay = {\n  deskNodeIds: readonly string[];`,
    `export type PatternRoomLocalOverlay = {\n  caseLabel?: string;\n  researchQuestion?: string;\n  deskNodeIds: readonly string[];`,
    "local overlay case identity fields"
  );

  source = replaceRequired(
    source,
    `export type PatternRoomLocalState = {\n  getTopicId: () => string;`,
    `export type PatternRoomLocalState = {\n  getTopicId: () => string;\n  updateCaseIdentity: (caseLabel: string, researchQuestion: string) => boolean;`,
    "local state case identity command"
  );

  source = replaceRequired(
    source,
    `  const domainRef = domainMock;\n  const deskNodeIds: string[] = [];`,
    `  const domainRef = domainMock;\n  let caseLabel = domainRef.topic.label;\n  let researchQuestion = domainRef.topic.description;\n  const deskNodeIds: string[] = [];`,
    "local state case identity values"
  );

  source = replaceRequired(
    source,
    `    getTopicId(): string {\n      return domainRef.topic.id;\n    },\n    sendToDesk(nodeId: string): void {`,
    `    getTopicId(): string {\n      return domainRef.topic.id;\n    },\n    updateCaseIdentity(nextCaseLabel: string, nextResearchQuestion: string): boolean {\n      const normalizedLabel = nextCaseLabel.trim();\n      const normalizedQuestion = nextResearchQuestion.trim();\n      if (normalizedLabel === \"\") {\n        return false;\n      }\n      if (caseLabel === normalizedLabel && researchQuestion === normalizedQuestion) {\n        return false;\n      }\n      caseLabel = normalizedLabel;\n      researchQuestion = normalizedQuestion;\n      notify();\n      return true;\n    },\n    sendToDesk(nodeId: string): void {`,
    "local state case identity implementation"
  );

  source = replaceRequired(
    source,
    `    getOverlay(): PatternRoomLocalOverlay {\n      return {\n        deskNodeIds: [...deskNodeIds],`,
    `    getOverlay(): PatternRoomLocalOverlay {\n      return {\n        ...(caseLabel === domainRef.topic.label ? {} : { caseLabel }),\n        ...(researchQuestion === domainRef.topic.description ? {} : { researchQuestion }),\n        deskNodeIds: [...deskNodeIds],`,
    "local overlay case identity projection"
  );

  source = replaceRequired(
    source,
    `    restoreOverlay(overlay: PatternRoomLocalOverlay, guards: PatternRoomLocalGuards): void {\n      deskNodeIds.splice(0, deskNodeIds.length, ...overlay.deskNodeIds);`,
    `    restoreOverlay(overlay: PatternRoomLocalOverlay, guards: PatternRoomLocalGuards): void {\n      caseLabel = overlay.caseLabel?.trim() || domainRef.topic.label;\n      researchQuestion =\n        overlay.researchQuestion === undefined\n          ? domainRef.topic.description\n          : overlay.researchQuestion.trim();\n      deskNodeIds.splice(0, deskNodeIds.length, ...overlay.deskNodeIds);`,
    "local state case identity restore"
  );

  await writeRepoFile(path, source);
}

async function updateSnapshot() {
  const path = "rooms/pattern-room/shared/state/pattern-room-snapshot.ts";
  let source = await readRepoFile(path);

  source = replaceRequired(
    source,
    `  const localEvidenceCandidates = parseLocalEvidenceCandidates(value[\"localEvidenceCandidates\"]);\n  const localAuthoredEdges = parseLocalAuthoredEdges(value[\"localAuthoredEdges\"]);`,
    `  const localEvidenceCandidates = parseLocalEvidenceCandidates(value[\"localEvidenceCandidates\"]);\n  const localAuthoredEdges = parseLocalAuthoredEdges(value[\"localAuthoredEdges\"]);\n  const caseLabel =\n    typeof value[\"caseLabel\"] === \"string\" && value[\"caseLabel\"].trim() !== \"\"\n      ? value[\"caseLabel\"].trim()\n      : undefined;\n  const researchQuestion =\n    typeof value[\"researchQuestion\"] === \"string\"\n      ? value[\"researchQuestion\"].trim()\n      : undefined;`,
    "snapshot optional case identity parsing"
  );

  source = replaceRequired(
    source,
    `  return {\n    deskNodeIds: value[\"deskNodeIds\"],`,
    `  return {\n    ...(caseLabel === undefined ? {} : { caseLabel }),\n    ...(researchQuestion === undefined ? {} : { researchQuestion }),\n    deskNodeIds: value[\"deskNodeIds\"],`,
    "snapshot parsed overlay identity"
  );

  source = replaceRequired(
    source,
    `  return {\n    deskNodeIds: filterUniqueIds(snapshotOverlay.deskNodeIds, hasNode),`,
    `  return {\n    caseLabel: snapshotOverlay.caseLabel?.trim() || domainMock.topic.label,\n    researchQuestion:\n      snapshotOverlay.researchQuestion === undefined\n        ? domainMock.topic.description\n        : snapshotOverlay.researchQuestion.trim(),\n    deskNodeIds: filterUniqueIds(snapshotOverlay.deskNodeIds, hasNode),`,
    "snapshot healed identity"
  );

  await writeRepoFile(path, source);
}

async function updateWorkspaceTypes() {
  const path = "rooms/pattern-room/shared/types/pattern-room.ts";
  let source = await readRepoFile(path);

  source = replaceRequired(
    source,
    `  subject: string;\n  boardCategories: PatternBoardCategory[];`,
    `  subject: string;\n  researchQuestion: string;\n  boardCategories: PatternBoardCategory[];`,
    "workspace research question"
  );

  source = replaceRequired(
    source,
    `export type PatternPanelActions = {\n  getSelectedNodeId: () => string | null;`,
    `export type PatternPanelActions = {\n  updateCaseIdentity: (caseLabel: string, researchQuestion: string) => void;\n  getSelectedNodeId: () => string | null;`,
    "panel case identity action"
  );

  await writeRepoFile(path, source);
}

async function updateViewAdapters() {
  const path = "rooms/pattern-room/shared/adapters/pattern-room-view-adapters.ts";
  let source = await readRepoFile(path);

  source = replaceRequired(
    source,
    `  \"roomTitle\" | \"roomLabel\" | \"roomSummary\" | \"subject\"\n>;`,
    `  \"roomTitle\" | \"roomLabel\" | \"roomSummary\" | \"subject\" | \"researchQuestion\"\n>;`,
    "overview research question type"
  );

  source = replaceRequired(
    source,
    `export function adaptOverviewViewModel(\n  domain: PatternRoomDomainViewSource\n): PatternOverviewViewModel {\n  return {\n    roomTitle: \"İz Sürme Odası\",\n    roomLabel: \"Pattern Room\",\n    roomSummary:\n      \"Near-future dedektif ofisinde kanıt panosu, holografik masa ve temkinli rapor terminali.\",\n    subject: adaptSubjectLabel(domain.topic),\n  };\n}`,
    `export function adaptOverviewViewModel(\n  domain: PatternRoomDomainViewSource,\n  overlay?: PatternRoomLocalOverlay\n): PatternOverviewViewModel {\n  const subject = overlay?.caseLabel?.trim() || adaptSubjectLabel(domain.topic);\n  const researchQuestion =\n    overlay?.researchQuestion === undefined\n      ? domain.topic.description.trim()\n      : overlay.researchQuestion.trim();\n  return {\n    roomTitle: \"İz Sürme Odası\",\n    roomLabel: \"Pattern Room\",\n    roomSummary:\n      researchQuestion === \"\" ? \"Araştırma sorusu henüz tanımlanmadı.\" : researchQuestion,\n    subject,\n    researchQuestion,\n  };\n}`,
    "overview identity adapter"
  );

  source = replaceRequired(
    source,
    `  const claims =\n    claimNodes.length > 0\n      ? claimNodes.map(adaptClaimNode)\n      : [\n          {\n            id: \`claim-\${domain.topic.id}\`,\n            label: domain.topic.label,\n            summary: domain.topic.description,\n            stance: \"primary\" as const,\n          },\n        ];`,
    `  const claims =\n    claimNodes.length > 0\n      ? claimNodes.map(adaptClaimNode)\n      : [\n          {\n            id: \`claim-\${domain.topic.id}\`,\n            label: overlay?.caseLabel?.trim() || domain.topic.label,\n            summary:\n              overlay?.researchQuestion === undefined\n                ? domain.topic.description\n                : overlay.researchQuestion.trim(),\n            stance: \"primary\" as const,\n          },\n        ];`,
    "desk identity fallback"
  );

  source = replaceRequired(
    source,
    `    ...adaptOverviewViewModel(domain),`,
    `    ...adaptOverviewViewModel(domain, overlay),`,
    "workspace overview overlay"
  );

  await writeRepoFile(path, source);
}

async function updateCasePacket() {
  const typePath = "rooms/pattern-room/shared/types/pattern-room-case-packet.ts";
  let typeSource = await readRepoFile(typePath);

  typeSource = replaceRequired(
    typeSource,
    `export type PatternRoomCasePacketConnection = {\n  id: string;\n  sourceLabel: string;`,
    `export type PatternRoomCasePacketConnection = {\n  id: string;\n  sourceId?: string;\n  sourceLabel: string;`,
    "case packet connection source id"
  );
  typeSource = replaceRequired(
    typeSource,
    `  edgeTypeLabel: string;\n  targetLabel: string;`,
    `  edgeTypeLabel: string;\n  targetId?: string;\n  targetLabel: string;`,
    "case packet connection target id"
  );
  typeSource = replaceRequired(
    typeSource,
    `  topicLabel: string;\n  generatedFrom: \"local-view-model\";`,
    `  topicLabel: string;\n  researchQuestion?: string | null;\n  generatedFrom: \"local-view-model\";`,
    "case packet research question"
  );
  await writeRepoFile(typePath, typeSource);

  const projectionPath =
    "rooms/pattern-room/shared/adapters/pattern-room-case-packet-projection.ts";
  let projectionSource = await readRepoFile(projectionPath);

  projectionSource = replaceRequired(
    projectionSource,
    `  readonly topicLabel?: string;\n};`,
    `  readonly topicLabel?: string;\n  readonly researchQuestion?: string;\n};`,
    "case packet projection question input"
  );
  projectionSource = replaceRequired(
    projectionSource,
    `  return {\n    id: edge.id,\n    sourceLabel: createPreview(sourceLabel, limits.excerptMaxLength),`,
    `  return {\n    id: edge.id,\n    sourceId: edge.sourceNodeId,\n    sourceLabel: createPreview(sourceLabel, limits.excerptMaxLength),`,
    "case packet connection source id projection"
  );
  projectionSource = replaceRequired(
    projectionSource,
    `    edgeTypeLabel: EDGE_TYPE_LABELS[edge.edgeType],\n    targetLabel: createPreview(targetLabel, limits.excerptMaxLength),`,
    `    edgeTypeLabel: EDGE_TYPE_LABELS[edge.edgeType],\n    targetId: edge.targetNodeId,\n    targetLabel: createPreview(targetLabel, limits.excerptMaxLength),`,
    "case packet connection target id projection"
  );
  projectionSource = replaceRequired(
    projectionSource,
    `    topicLabel: normalizePlainText(input.topicLabel ?? input.domain.topic.label),\n    generatedFrom: \"local-view-model\",`,
    `    topicLabel: normalizePlainText(\n      input.topicLabel ?? input.overlay?.caseLabel ?? input.domain.topic.label\n    ),\n    researchQuestion:\n      normalizePlainText(\n        input.researchQuestion ??\n          input.overlay?.researchQuestion ??\n          input.domain.topic.description\n      ) || null,\n    generatedFrom: \"local-view-model\",`,
    "case packet identity projection"
  );
  await writeRepoFile(projectionPath, projectionSource);
}

async function updateRoleLabels() {
  const rolePath = "rooms/pattern-room/shared/types/pattern-room-case-review-role.ts";
  let roleSource = await readRepoFile(rolePath);
  const roleReplacements = [
    ["AI0 araştırmacı / düzenleyici", "AI0 — araştırmacı / düzenleyici"],
    ["AI1 savunucu / güçlü yorum testçisi", "AI1 — savunucu / güçlü yorum testçisi"],
    ["AI2 10. Adam / karşı argüman ve boşluk arayıcı", "AI2 — 10. Adam / karşı argüman ve boşluk arayıcı"],
    ["US1 hakem / son gözden geçiren", "US1 — hakem / son gözden geçiren"],
  ];
  for (const [before, after] of roleReplacements) {
    roleSource = replaceRequired(roleSource, before, after, `role label ${before}`);
  }
  await writeRepoFile(rolePath, roleSource);

  const messagePath =
    "rooms/pattern-room/shared/adapters/pattern-room-case-review-message-adapter.ts";
  let messageSource = await readRepoFile(messagePath);
  messageSource = replaceRequired(
    messageSource,
    `      \`role: \${roleSlot} - \${roleProfile.roleLabel}\`,`,
    `      \`role: \${roleProfile.roleLabel}\`,`,
    "case review role line"
  );
  await writeRepoFile(messagePath, messageSource);
}

async function createIdentityInspector() {
  const path = "rooms/pattern-room/ui/panels/pattern-case-identity-inspector.ts";
  const content = [
    'import type { PatternPanelActions, PatternRoomWorkspaceModel } from "../../shared/types/pattern-room.js";',
    'import {',
    '  createPatternWorkspaceTranslator,',
    '  type PatternWorkspaceTranslator,',
    '} from "../pattern-room-workspace-i18n.js";',
    'import { createElement } from "./pattern-panel-utils.js";',
    '',
    'export function createPatternCaseIdentityInspector(',
    '  data: PatternRoomWorkspaceModel,',
    '  actions: PatternPanelActions,',
    '  text: PatternWorkspaceTranslator = createPatternWorkspaceTranslator("tr", null)',
    '): HTMLElement {',
    '  const section = createElement("section", "pattern-room-case-identity-inspector");',
    '  section.dataset["patternCaseIdentityInspector"] = "true";',
    '',
    '  const form = createElement("form", "pattern-room-case-identity-form");',
    '  form.dataset["patternCaseIdentityForm"] = "true";',
    '',
    '  const caseNameLabel = createElement("label", "pattern-room-case-identity-field");',
    '  caseNameLabel.append(createElement("span", undefined, text("overview.caseNameLabel")));',
    '  const caseName = createElement("input", "pattern-room-inline-input");',
    '  caseName.name = "caseLabel";',
    '  caseName.value = data.subject;',
    '  caseName.placeholder = text("overview.caseNamePlaceholder");',
    '  caseName.dataset["patternCaseIdentityName"] = "true";',
    '  caseName.required = true;',
    '  caseNameLabel.append(caseName);',
    '',
    '  const questionLabel = createElement("label", "pattern-room-case-identity-field");',
    '  questionLabel.append(',
    '    createElement("span", undefined, text("overview.researchQuestionLabel"))',
    '  );',
    '  const question = createElement("textarea", "pattern-room-inline-input");',
    '  question.name = "researchQuestion";',
    '  question.value = data.researchQuestion;',
    '  question.placeholder = text("overview.researchQuestionPlaceholder");',
    '  question.dataset["patternCaseIdentityQuestion"] = "true";',
    '  questionLabel.append(question);',
    '',
    '  const submit = createElement(',
    '    "button",',
    '    "pattern-room-action-button pattern-room-case-identity-submit",',
    '    text("overview.saveIdentity")',
    '  );',
    '  submit.type = "submit";',
    '  submit.dataset["patternCaseIdentitySubmit"] = "true";',
    '',
    '  form.addEventListener("submit", (event) => {',
    '    event.preventDefault();',
    '    const normalizedLabel = caseName.value.trim();',
    '    if (normalizedLabel === "") {',
    '      caseName.setAttribute("aria-invalid", "true");',
    '      caseName.focus();',
    '      return;',
    '    }',
    '    caseName.removeAttribute("aria-invalid");',
    '    actions.updateCaseIdentity(normalizedLabel, question.value);',
    '  });',
    '',
    '  form.append(caseNameLabel, questionLabel, submit);',
    '  section.append(',
    '    createElement("span", "pattern-room-context-inspector-label", text("overview.identityLabel")),',
    '    createElement("h2", undefined, text("overview.identityTitle")),',
    '    createElement("p", undefined, text("overview.identityCopy")),',
    '    form',
    '  );',
    '  return section;',
    '}',
  ].join("\n");
  await writeRepoFile(path, content);
}

async function updateRuntime() {
  const path = "rooms/pattern-room/ui/pattern-room-ui-runtime.ts";
  let source = await readRepoFile(path);

  source = replaceRequired(
    source,
    `import { createArchivePanel } from \"./panels/pattern-archive-panel.js\";`,
    `import { createArchivePanel } from \"./panels/pattern-archive-panel.js\";\nimport { createPatternCaseIdentityInspector } from \"./panels/pattern-case-identity-inspector.js\";`,
    "identity inspector import"
  );

  source = replaceRequired(
    source,
    `        overlay: localState.getOverlay(),\n        topicLabel: viewModels.subject,`,
    `        overlay: localState.getOverlay(),\n        topicLabel: viewModels.subject,\n        researchQuestion: viewModels.researchQuestion,`,
    "preview research question"
  );

  source = replaceRequired(
    source,
    `  const actions: PatternPanelActions = {\n    getSelectedNodeId(): string | null {`,
    `  const actions: PatternPanelActions = {\n    updateCaseIdentity(caseLabel: string, researchQuestion: string): void {\n      const updated = localState.updateCaseIdentity(caseLabel, researchQuestion);\n      if (updated) {\n        caseReviewPreviewDraft = null;\n        caseReviewDispatchStatus = CASE_REVIEW_IDLE_STATUS;\n        showWorkspaceActionFeedback(\"feedback.caseIdentityUpdated\");\n        render();\n        return;\n      }\n      showWorkspaceActionFeedback(\"feedback.caseIdentityUnchanged\", \"info\");\n    },\n    getSelectedNodeId(): string | null {`,
    "runtime identity action"
  );

  source = replaceRequired(
    source,
    `  function renderWorkspaceInspector(shell: PatternWorkspaceShell = ensureWorkspaceShell()): void {\n    if (activeView !== \"board\" && activeView !== \"desk\") {\n      shell.setInspectorContent(null);\n      return;\n    }\n\n    const mode: PatternInvestigationCanvasMode = activeView === \"desk\" ? \"graph\" : \"board\";\n    shell.setInspectorContent(\n      createInvestigationInspectorContent(\n        mode,\n        viewModels,\n        actions,\n        selectedNodeId,\n        getWorkspaceText()\n      )\n    );\n  }`,
    `  function renderWorkspaceInspector(shell: PatternWorkspaceShell = ensureWorkspaceShell()): void {\n    if (activeView === \"overview\") {\n      shell.setInspectorContent(\n        createPatternCaseIdentityInspector(viewModels, actions, getWorkspaceText())\n      );\n      return;\n    }\n    if (activeView !== \"board\" && activeView !== \"desk\") {\n      shell.setInspectorContent(null);\n      return;\n    }\n\n    const mode: PatternInvestigationCanvasMode = activeView === \"desk\" ? \"graph\" : \"board\";\n    shell.setInspectorContent(\n      createInvestigationInspectorContent(\n        mode,\n        viewModels,\n        actions,\n        selectedNodeId,\n        getWorkspaceText()\n      )\n    );\n  }`,
    "overview identity inspector ownership"
  );

  await writeRepoFile(path, source);
}

async function updateWorkspaceI18n() {
  const path = "rooms/pattern-room/ui/pattern-room-workspace-i18n.ts";
  let source = await readRepoFile(path);

  source = replaceRequired(
    source,
    `  | \"feedback.importFailed\"\n  | \"shell.keyboardHint\"`,
    `  | \"feedback.importFailed\"\n  | \"feedback.caseIdentityUpdated\"\n  | \"feedback.caseIdentityUnchanged\"\n  | \"shell.keyboardHint\"`,
    "identity feedback keys"
  );
  source = replaceRequired(
    source,
    `  | \"overview.activityCopy\"\n  | \"board.canvasLabel\"`,
    `  | \"overview.activityCopy\"\n  | \"overview.identityLabel\"\n  | \"overview.identityTitle\"\n  | \"overview.identityCopy\"\n  | \"overview.caseNameLabel\"\n  | \"overview.caseNamePlaceholder\"\n  | \"overview.researchQuestionLabel\"\n  | \"overview.researchQuestionPlaceholder\"\n  | \"overview.saveIdentity\"\n  | \"board.canvasLabel\"`,
    "identity overview keys"
  );

  source = replaceRequired(
    source,
    `  \"feedback.importFailed\": \"İşlem tamamlanamadı; alanları ve uyarıları kontrol edin.\",\n  \"shell.keyboardHint\":`,
    `  \"feedback.importFailed\": \"İşlem tamamlanamadı; alanları ve uyarıları kontrol edin.\",\n  \"feedback.caseIdentityUpdated\": \"Vaka kimliği güncellendi.\",\n  \"feedback.caseIdentityUnchanged\": \"Vaka kimliğinde kaydedilecek bir değişiklik yok.\",\n  \"shell.keyboardHint\":`,
    "Turkish identity feedback"
  );
  source = replaceRequired(
    source,
    `  \"overview.activityCopy\": \"Her ana araç soldaki navigasyondan doğrudan açılır.\",\n  \"board.canvasLabel\":`,
    `  \"overview.activityCopy\": \"Her ana araç soldaki navigasyondan doğrudan açılır.\",\n  \"overview.identityLabel\": \"Vaka kimliği\",\n  \"overview.identityTitle\": \"Araştırmayı adlandır\",\n  \"overview.identityCopy\": \"Vaka adı ve ana araştırma sorusu tüm çalışma alanlarına, rapora ve Case Packet önizlemesine yansır.\",\n  \"overview.caseNameLabel\": \"Vaka adı\",\n  \"overview.caseNamePlaceholder\": \"Örn. Kuzey Koridoru Sensör Olayı\",\n  \"overview.researchQuestionLabel\": \"Ana araştırma sorusu\",\n  \"overview.researchQuestionPlaceholder\": \"Bu araştırma hangi soruya yanıt arıyor?\",\n  \"overview.saveIdentity\": \"Vaka Kimliğini Kaydet\",\n  \"board.canvasLabel\":`,
    "Turkish identity overview copy"
  );

  source = replaceRequired(
    source,
    `  \"feedback.importFailed\": \"The action could not be completed; check the fields and warnings.\",\n  \"shell.keyboardHint\":`,
    `  \"feedback.importFailed\": \"The action could not be completed; check the fields and warnings.\",\n  \"feedback.caseIdentityUpdated\": \"Case identity updated.\",\n  \"feedback.caseIdentityUnchanged\": \"There are no case identity changes to save.\",\n  \"shell.keyboardHint\":`,
    "English identity feedback"
  );
  source = replaceRequired(
    source,
    `  \"overview.activityCopy\": \"Open every major tool directly from the navigation.\",\n  \"board.canvasLabel\":`,
    `  \"overview.activityCopy\": \"Open every major tool directly from the navigation.\",\n  \"overview.identityLabel\": \"Case identity\",\n  \"overview.identityTitle\": \"Name the investigation\",\n  \"overview.identityCopy\": \"The case name and primary research question flow into every workspace, the report, and the Case Packet preview.\",\n  \"overview.caseNameLabel\": \"Case name\",\n  \"overview.caseNamePlaceholder\": \"Example: North Corridor Sensor Incident\",\n  \"overview.researchQuestionLabel\": \"Primary research question\",\n  \"overview.researchQuestionPlaceholder\": \"What question is this investigation trying to answer?\",\n  \"overview.saveIdentity\": \"Save Case Identity\",\n  \"board.canvasLabel\":`,
    "English identity overview copy"
  );

  await writeRepoFile(path, source);
}

async function updateCatalog(path, locale) {
  const raw = await readRepoFile(path);
  const catalog = JSON.parse(raw);
  const workspace = catalog.workspace;
  const isTr = locale === "tr";

  workspace.feedback.caseIdentityUpdated = isTr
    ? "Vaka kimliği güncellendi."
    : "Case identity updated.";
  workspace.feedback.caseIdentityUnchanged = isTr
    ? "Vaka kimliğinde kaydedilecek bir değişiklik yok."
    : "There are no case identity changes to save.";
  Object.assign(
    workspace.overview,
    isTr
      ? {
          identityLabel: "Vaka kimliği",
          identityTitle: "Araştırmayı adlandır",
          identityCopy:
            "Vaka adı ve ana araştırma sorusu tüm çalışma alanlarına, rapora ve Case Packet önizlemesine yansır.",
          caseNameLabel: "Vaka adı",
          caseNamePlaceholder: "Örn. Kuzey Koridoru Sensör Olayı",
          researchQuestionLabel: "Ana araştırma sorusu",
          researchQuestionPlaceholder: "Bu araştırma hangi soruya yanıt arıyor?",
          saveIdentity: "Vaka Kimliğini Kaydet",
        }
      : {
          identityLabel: "Case identity",
          identityTitle: "Name the investigation",
          identityCopy:
            "The case name and primary research question flow into every workspace, the report, and the Case Packet preview.",
          caseNameLabel: "Case name",
          caseNamePlaceholder: "Example: North Corridor Sensor Incident",
          researchQuestionLabel: "Primary research question",
          researchQuestionPlaceholder:
            "What question is this investigation trying to answer?",
          saveIdentity: "Save Case Identity",
        }
  );

  await writeRepoFile(path, JSON.stringify(catalog, null, 2));
}

async function updateStyles() {
  const path = "rooms/pattern-room/ui/workspace.css";
  let source = await readRepoFile(path);
  if (!source.includes("CASE IDENTITY INSPECTOR")) {
    source += `\n\n/* ─────────────────────────────────────────\n   CASE IDENTITY INSPECTOR\n───────────────────────────────────────── */\n.pattern-room-case-identity-inspector {\n  display: grid;\n  gap: var(--pattern-px-10);\n}\n\n.pattern-room-case-identity-inspector h2,\n.pattern-room-case-identity-inspector p {\n  margin: 0;\n}\n\n.pattern-room-case-identity-inspector p {\n  color: var(--pattern-text-muted);\n  font-size: var(--pattern-rem-0-82);\n  line-height: 1.55;\n}\n\n.pattern-room-case-identity-form {\n  display: grid;\n  gap: var(--pattern-px-10);\n  margin-top: var(--pattern-px-4);\n}\n\n.pattern-room-case-identity-field {\n  display: grid;\n  gap: var(--pattern-px-6);\n  min-width: 0;\n  font-family: \"IBM Plex Mono\", monospace;\n  color: var(--pattern-text-subtle);\n  font-size: var(--pattern-rem-0-72);\n  font-weight: 700;\n}\n\n.pattern-room-case-identity-field textarea {\n  min-height: var(--pattern-px-104);\n  resize: vertical;\n}\n\n.pattern-room-case-identity-submit {\n  width: 100%;\n}\n`;
  }
  await writeRepoFile(path, source);
}

async function updateTests() {
  const snapshotPath = "scripts/tests/pattern-room-session-snapshot-regressions.test.ts";
  let snapshotSource = await readRepoFile(snapshotPath);
  snapshotSource = replaceRequired(
    snapshotSource,
    `  const localState = createLocalState(PATTERN_ROOM_DOMAIN_TEST_FIXTURE);\n\n  localState.sendToDesk`,
    `  const localState = createLocalState(PATTERN_ROOM_DOMAIN_TEST_FIXTURE);\n\n  localState.updateCaseIdentity(\n    \"Kuzey Koridoru Sensör Olayı\",\n    \"Elektrik kesintisi sırasında koridorda fiziksel hareket oldu mu?\"\n  );\n  localState.sendToDesk`,
    "snapshot case identity fixture"
  );
  snapshotSource = replaceRequired(
    snapshotSource,
    `  assert.equal(snapshot.createdAt, snapshot.updatedAt);\n  assert.deepEqual(snapshot.overlay.deskNodeIds,`,
    `  assert.equal(snapshot.createdAt, snapshot.updatedAt);\n  assert.equal(snapshot.overlay.caseLabel, \"Kuzey Koridoru Sensör Olayı\");\n  assert.equal(\n    snapshot.overlay.researchQuestion,\n    \"Elektrik kesintisi sırasında koridorda fiziksel hareket oldu mu?\"\n  );\n  assert.deepEqual(snapshot.overlay.deskNodeIds,`,
    "snapshot identity assertions"
  );
  await writeRepoFile(snapshotPath, snapshotSource);

  const packetPath = "scripts/tests/pattern-room-case-packet-regressions.test.ts";
  let packetSource = await readRepoFile(packetPath);
  packetSource = replaceRequired(
    packetSource,
    `  const localState = createLocalState(PATTERN_ROOM_DOMAIN_TEST_FIXTURE);\n\n  localState.addAuthoredSource`,
    `  const localState = createLocalState(PATTERN_ROOM_DOMAIN_TEST_FIXTURE);\n\n  localState.updateCaseIdentity(\n    \"Kuzey Koridoru Sensör Olayı\",\n    \"Elektrik kesintisi sırasında koridorda fiziksel hareket oldu mu?\"\n  );\n  localState.addAuthoredSource`,
    "case packet identity fixture"
  );
  packetSource = replaceRequired(
    packetSource,
    `  assert.equal(firstPacket.generatedFrom, \"local-view-model\");`,
    `  assert.equal(firstPacket.generatedFrom, \"local-view-model\");\n  assert.equal(firstPacket.topicLabel, \"Kuzey Koridoru Sensör Olayı\");\n  assert.equal(\n    firstPacket.researchQuestion,\n    \"Elektrik kesintisi sırasında koridorda fiziksel hareket oldu mu?\"\n  );`,
    "case packet identity assertions"
  );
  packetSource = replaceRequired(
    packetSource,
    `  assert.equal(connection.sourceLabel, \"Yerel iddia\");\n  assert.equal(connection.edgeTypeLabel, \"destekliyor\");\n  assert.equal(connection.targetLabel, \"Kaynaklı kanıt\");`,
    `  assert.equal(connection.sourceId, \"local-node-001\");\n  assert.equal(connection.sourceLabel, \"Yerel iddia\");\n  assert.equal(connection.edgeTypeLabel, \"destekliyor\");\n  assert.equal(connection.targetId, \"local-evidence-001\");\n  assert.equal(connection.targetLabel, \"Kaynaklı kanıt\");`,
    "case packet endpoint id assertions"
  );
  await writeRepoFile(packetPath, packetSource);

  const messagePath = "scripts/tests/pattern-room-case-review-message-regressions.test.ts";
  let messageSource = await readRepoFile(messagePath);
  messageSource = replaceRequired(
    messageSource,
    `    topicLabel: \"Yerel vaka\",\n    generatedFrom: \"local-view-model\",`,
    `    topicLabel: \"Yerel vaka\",\n    researchQuestion: \"Yerel vaka hangi soruya yanıt arıyor?\",\n    generatedFrom: \"local-view-model\",`,
    "message fixture research question"
  );
  messageSource = replaceRequired(
    messageSource,
    `        id: \"edge-001\",\n        sourceLabel: \"Seçili alıntı\",`,
    `        id: \"edge-001\",\n        sourceId: \"evidence-001\",\n        sourceLabel: \"Seçili alıntı\",`,
    "message fixture source id"
  );
  messageSource = replaceRequired(
    messageSource,
    `        edgeTypeLabel: \"soru doğuruyor\",\n        targetLabel: \"Belirsizlik\",`,
    `        edgeTypeLabel: \"soru doğuruyor\",\n        targetId: \"note-001\",\n        targetLabel: \"Belirsizlik\",`,
    "message fixture target id"
  );
  messageSource = replaceRequired(
    messageSource,
    `  assert.match(messages[1]?.sections.roleInstructions ?? \"\", /10\\. Adam/);`,
    `  assert.match(messages[1]?.sections.roleInstructions ?? \"\", /role: AI2 — 10\\. Adam/);\n  assert.doesNotMatch(messages[1]?.sections.roleInstructions ?? \"\", /role: AI2 - AI2/);`,
    "role label normalization assertions"
  );
  await writeRepoFile(messagePath, messageSource);

  const uiPath = "scripts/tests/pattern-room-installed-ui-smoke-regressions-part2.test.ts";
  let uiSource = await readRepoFile(uiPath);
  uiSource = replaceRequired(
    uiSource,
    `    await startPatternRoomInstalledUi(installedCopy.rootDir);\n\n    openFocusedView(environment.app, \"board\");`,
    `    await startPatternRoomInstalledUi(installedCopy.rootDir);\n\n    const identityForm = environment.app.querySelector(\n      \"[data-pattern-case-identity-form='true']\"\n    );\n    const identityName = environment.app.querySelector(\n      \"[data-pattern-case-identity-name='true']\"\n    );\n    const identityQuestion = environment.app.querySelector(\n      \"[data-pattern-case-identity-question='true']\"\n    );\n    assert.ok(identityForm);\n    assert.ok(identityName);\n    assert.ok(identityQuestion);\n    identityName.value = \"Kuzey Koridoru Sensör Olayı\";\n    identityQuestion.value =\n      \"Elektrik kesintisi sırasında koridorda fiziksel hareket oldu mu?\";\n    submitForm(identityForm);\n    assertTextIncludes(readTreeText(environment.app), [\n      \"Kuzey Koridoru Sensör Olayı\",\n      \"Elektrik kesintisi sırasında koridorda fiziksel hareket oldu mu?\",\n      \"Vaka kimliği güncellendi.\",\n    ]);\n\n    openFocusedView(environment.app, \"board\");`,
    "installed UI identity workflow"
  );
  await writeRepoFile(uiPath, uiSource);
}

async function updateProgress() {
  const path = ".rovo/pattern-room-v2-progress.md";
  let source = await readRepoFile(path);
  if (!source.includes("Completed: editable case identity")) {
    const section = `## Completed: editable case identity and packet identity\n\n- The active case name and primary research question can be edited from the Case Hub inspector.\n- Custom identity persists in the existing version-1 snapshot without changing production defaults or older snapshot compatibility.\n- Workspace summaries, overview copy, graph fallback, report context and Case Review preview use the edited identity.\n- Case Packet connections expose source and target ids alongside labels.\n- Case Review role lines no longer duplicate slot identifiers.\n- Installed UI, snapshot, Case Packet and message regressions cover the new boundary.\n\n`;
    const marker = "## Next implementation steps";
    source = source.includes(marker)
      ? source.replace(marker, `${section}${marker}`)
      : `${source.trimEnd()}\n\n${section}`;
  }
  await writeRepoFile(path, source);
}

await updateLocalState();
await updateSnapshot();
await updateWorkspaceTypes();
await updateViewAdapters();
await updateCasePacket();
await updateRoleLabels();
await createIdentityInspector();
await updateRuntime();
await updateWorkspaceI18n();
await updateCatalog("rooms/pattern-room/i18n/tr.json", "tr");
await updateCatalog("rooms/pattern-room/i18n/en.json", "en");
await updateStyles();
await updateTests();
await updateProgress();

if (changedFiles.length === 0) {
  console.log("Pattern Room case identity and packet integrity are already current.");
} else {
  console.log(`${apply ? "Applied" : "Would apply"}:`);
  changedFiles.forEach((path) => console.log(`- ${path}`));
}
