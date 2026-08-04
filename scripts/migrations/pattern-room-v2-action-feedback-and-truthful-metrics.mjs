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
    throw new Error(`Required action-feedback migration pattern was not found: ${label}`);
  }
  return content.replace(search, replacement);
}

async function updateWorkspaceShell() {
  const path = "rooms/pattern-room/ui/panels/pattern-workspace-shell.ts";
  let source = await readRepoFile(path);

  if (!source.includes("export type PatternWorkspaceFeedbackTone")) {
    source = replaceRequired(
      source,
      `export type PatternWorkspaceSummary = {\n  readonly subject: string;\n  readonly pinCount: number;\n  readonly sourceCount: number;\n  readonly reviewCount: number;\n};\n\nexport type PatternWorkspaceShell = {`,
      `export type PatternWorkspaceSummary = {\n  readonly subject: string;\n  readonly sourceCount: number;\n  readonly evidenceCount: number;\n  readonly boardNoteCount: number;\n  readonly connectionCount: number;\n  readonly reviewCount: number;\n};\n\nexport type PatternWorkspaceFeedbackTone = "success" | "info" | "warning" | "error";\n\nexport type PatternWorkspaceFeedback = {\n  readonly tone: PatternWorkspaceFeedbackTone;\n  readonly message: string;\n};\n\nexport type PatternWorkspaceShell = {`,
      "workspace summary and feedback types"
    );

    source = replaceRequired(
      source,
      `  setInspectorContent: (content: HTMLElement | null) => void;\n  updateActiveView: (viewId: PatternViewId, section: PatternWorkspaceSection) => void;`,
      `  setInspectorContent: (content: HTMLElement | null) => void;\n  showActionFeedback: (feedback: PatternWorkspaceFeedback | null) => void;\n  updateActiveView: (viewId: PatternViewId, section: PatternWorkspaceSection) => void;`,
      "workspace shell feedback method"
    );
  }

  if (!source.includes('const evidenceMetric = createElement("span");')) {
    source = replaceRequired(
      source,
      `  const sourceMetric = createElement("span");\n  const pinMetric = createElement("span");\n  const reviewMetric = createElement("span");\n  metrics.append(sourceMetric, pinMetric, reviewMetric);`,
      `  const sourceMetric = createElement("span");\n  const evidenceMetric = createElement("span");\n  const boardNoteMetric = createElement("span");\n  const connectionMetric = createElement("span");\n  const reviewMetric = createElement("span");\n  metrics.append(\n    sourceMetric,\n    evidenceMetric,\n    boardNoteMetric,\n    connectionMetric,\n    reviewMetric\n  );`,
      "left case metrics"
    );

    source = replaceRequired(
      source,
      `  const inspectorSourceMetric = createElement("span");\n  const inspectorPinMetric = createElement("span");\n  const inspectorReviewMetric = createElement("span");\n  inspectorMetrics.append(inspectorSourceMetric, inspectorPinMetric, inspectorReviewMetric);`,
      `  const inspectorSourceMetric = createElement("span");\n  const inspectorEvidenceMetric = createElement("span");\n  const inspectorBoardNoteMetric = createElement("span");\n  const inspectorConnectionMetric = createElement("span");\n  const inspectorReviewMetric = createElement("span");\n  inspectorMetrics.append(\n    inspectorSourceMetric,\n    inspectorEvidenceMetric,\n    inspectorBoardNoteMetric,\n    inspectorConnectionMetric,\n    inspectorReviewMetric\n  );`,
      "inspector case metrics"
    );
  }

  if (!source.includes('feedbackSlot.dataset["patternWorkspaceFeedbackSlot"]')) {
    source = replaceRequired(
      source,
      `  inspector.append(inspectorHeader, inspectorCase, inspectorContent);\n\n  shell.append(rail, workspace, inspector);`,
      `  inspector.append(inspectorHeader, inspectorCase, inspectorContent);\n\n  const feedbackSlot = createElement("div", "pattern-room-workspace-feedback-slot");\n  feedbackSlot.dataset["patternWorkspaceFeedbackSlot"] = "true";\n  feedbackSlot.ariaLive = "polite";\n\n  shell.append(rail, workspace, inspector, feedbackSlot);`,
      "global feedback slot"
    );
  }

  if (!source.includes('const evidenceText = text("shell.evidenceMetric"')) {
    source = replaceRequired(
      source,
      `    const pinText = text("shell.pinMetric", {\n      count: String(summary.pinCount),\n    });\n    const reviewText = text("shell.reviewMetric", {\n      count: String(summary.reviewCount),\n    });\n    sourceMetric.textContent = sourceText;\n    pinMetric.textContent = pinText;\n    reviewMetric.textContent = reviewText;\n    inspectorSourceMetric.textContent = sourceText;\n    inspectorPinMetric.textContent = pinText;\n    inspectorReviewMetric.textContent = reviewText;`,
      `    const evidenceText = text("shell.evidenceMetric", {\n      count: String(summary.evidenceCount),\n    });\n    const boardNoteText = text("shell.boardNoteMetric", {\n      count: String(summary.boardNoteCount),\n    });\n    const connectionText = text("shell.connectionMetric", {\n      count: String(summary.connectionCount),\n    });\n    const reviewText = text("shell.reviewMetric", {\n      count: String(summary.reviewCount),\n    });\n    sourceMetric.textContent = sourceText;\n    evidenceMetric.textContent = evidenceText;\n    boardNoteMetric.textContent = boardNoteText;\n    connectionMetric.textContent = connectionText;\n    reviewMetric.textContent = reviewText;\n    inspectorSourceMetric.textContent = sourceText;\n    inspectorEvidenceMetric.textContent = evidenceText;\n    inspectorBoardNoteMetric.textContent = boardNoteText;\n    inspectorConnectionMetric.textContent = connectionText;\n    inspectorReviewMetric.textContent = reviewText;`,
      "truthful summary text"
    );
  }

  if (!source.includes("showActionFeedback(feedback): void")) {
    source = replaceRequired(
      source,
      `    setInspectorContent(content): void {\n      inspectorContent.replaceChildren();\n      if (content !== null) {\n        inspectorContent.append(content);\n      }\n    },\n    updateActiveView(viewId, section): void {`,
      `    setInspectorContent(content): void {\n      inspectorContent.replaceChildren();\n      if (content !== null) {\n        inspectorContent.append(content);\n      }\n    },\n    showActionFeedback(feedback): void {\n      feedbackSlot.replaceChildren();\n      if (feedback === null) {\n        return;\n      }\n\n      const item = createElement(\n        "section",\n        \`pattern-room-workspace-feedback \${feedback.tone}\`\n      );\n      item.dataset["patternWorkspaceFeedback"] = "true";\n      item.dataset["patternWorkspaceFeedbackTone"] = feedback.tone;\n      item.role = feedback.tone === "error" ? "alert" : "status";\n\n      const icon = createElement(\n        "span",\n        "pattern-room-workspace-feedback-icon",\n        feedback.tone === "success"\n          ? "✓"\n          : feedback.tone === "error"\n            ? "!"\n            : feedback.tone === "warning"\n              ? "△"\n              : "i"\n      );\n      icon.ariaHidden = "true";\n      const message = createElement(\n        "p",\n        "pattern-room-workspace-feedback-message",\n        feedback.message\n      );\n      const dismiss = createElement(\n        "button",\n        "pattern-room-workspace-feedback-dismiss",\n        "×"\n      );\n      dismiss.type = "button";\n      dismiss.dataset["patternWorkspaceFeedbackDismiss"] = "true";\n      dismiss.ariaLabel = text("feedback.dismiss");\n      dismiss.title = text("feedback.dismiss");\n      dismiss.addEventListener("click", () => {\n        feedbackSlot.replaceChildren();\n      });\n      item.append(icon, message, dismiss);\n      feedbackSlot.append(item);\n    },\n    updateActiveView(viewId, section): void {`,
      "workspace feedback renderer"
    );
  }

  await writeRepoFile(path, source);
}

async function updateWorkspaceI18n() {
  const path = "rooms/pattern-room/ui/pattern-room-workspace-i18n.ts";
  let source = await readRepoFile(path);

  if (!source.includes('| "shell.evidenceMetric"')) {
    source = replaceRequired(
      source,
      `  | "shell.sourceMetric"\n  | "shell.pinMetric"\n  | "shell.reviewMetric"`,
      `  | "shell.sourceMetric"\n  | "shell.evidenceMetric"\n  | "shell.boardNoteMetric"\n  | "shell.connectionMetric"\n  | "shell.reviewMetric"\n  | "feedback.dismiss"\n  | "feedback.sentToDesk"\n  | "feedback.alreadyOnDesk"\n  | "feedback.addedToReview"\n  | "feedback.alreadyInReview"\n  | "feedback.sourcePinned"\n  | "feedback.noteAdded"\n  | "feedback.boardItemAdded"\n  | "feedback.sourceAdded"\n  | "feedback.sourceRemoved"\n  | "feedback.boardItemRemoved"\n  | "feedback.sessionReset"\n  | "feedback.evidenceAdded"\n  | "feedback.connectionAdded"\n  | "feedback.debateUpdated"\n  | "feedback.importSucceeded"\n  | "feedback.importFailed"`,
      "workspace feedback text keys"
    );
  }

  if (!source.includes('"feedback.sentToDesk": "Öğe çalışma masasına gönderildi."')) {
    source = replaceRequired(
      source,
      `  "shell.sourceMetric": "%count% kaynak",\n  "shell.pinMetric": "%count% iz",\n  "shell.reviewMetric": "%count% inceleme",`,
      `  "shell.sourceMetric": "%count% kaynak",\n  "shell.evidenceMetric": "%count% kanıt",\n  "shell.boardNoteMetric": "%count% pano notu",\n  "shell.connectionMetric": "%count% bağlantı",\n  "shell.reviewMetric": "%count% inceleme",\n  "feedback.dismiss": "Bildirimi kapat",\n  "feedback.sentToDesk": "Öğe çalışma masasına gönderildi.",\n  "feedback.alreadyOnDesk": "Öğe zaten çalışma masasında.",\n  "feedback.addedToReview": "Öğe 10. Adam referanslarına eklendi.",\n  "feedback.alreadyInReview": "Öğe zaten 10. Adam referanslarında.",\n  "feedback.sourcePinned": "Kaynak soruşturma tuvaline sabitlendi.",\n  "feedback.noteAdded": "Yerel not eklendi.",\n  "feedback.boardItemAdded": "Pano öğesi eklendi.",\n  "feedback.sourceAdded": "Kaynak arşive eklendi.",\n  "feedback.sourceRemoved": "Kaynak ve bağlı yerel izler kaldırıldı.",\n  "feedback.boardItemRemoved": "Yerel pano öğesi kaldırıldı.",\n  "feedback.sessionReset": "Yerel oturum temizlendi.",\n  "feedback.evidenceAdded": "Kanıt notu eklendi.",\n  "feedback.connectionAdded": "Bağlantı oluşturuldu.",\n  "feedback.debateUpdated": "10. Adam oturumu güncellendi.",\n  "feedback.importSucceeded": "Kaynak içe aktarıldı.",\n  "feedback.importFailed": "İşlem tamamlanamadı; alanları ve uyarıları kontrol edin.",`,
      "Turkish feedback copy"
    );

    source = replaceRequired(
      source,
      `  "shell.sourceMetric": "%count% sources",\n  "shell.pinMetric": "%count% leads",\n  "shell.reviewMetric": "%count% reviews",`,
      `  "shell.sourceMetric": "%count% sources",\n  "shell.evidenceMetric": "%count% evidence",\n  "shell.boardNoteMetric": "%count% board notes",\n  "shell.connectionMetric": "%count% connections",\n  "shell.reviewMetric": "%count% reviews",\n  "feedback.dismiss": "Dismiss notification",\n  "feedback.sentToDesk": "Item sent to the working desk.",\n  "feedback.alreadyOnDesk": "Item is already on the working desk.",\n  "feedback.addedToReview": "Item added to Tenth Man references.",\n  "feedback.alreadyInReview": "Item is already in Tenth Man references.",\n  "feedback.sourcePinned": "Source pinned to the investigation canvas.",\n  "feedback.noteAdded": "Local note added.",\n  "feedback.boardItemAdded": "Board item added.",\n  "feedback.sourceAdded": "Source added to the archive.",\n  "feedback.sourceRemoved": "Source and linked local traces removed.",\n  "feedback.boardItemRemoved": "Local board item removed.",\n  "feedback.sessionReset": "Local session cleared.",\n  "feedback.evidenceAdded": "Evidence note added.",\n  "feedback.connectionAdded": "Connection created.",\n  "feedback.debateUpdated": "Tenth Man session updated.",\n  "feedback.importSucceeded": "Source imported.",\n  "feedback.importFailed": "The action could not be completed; check the fields and warnings.",`,
      "English feedback copy"
    );
  }

  await writeRepoFile(path, source);
}

async function updateCatalog(path, locale) {
  let source = await readRepoFile(path);
  const isTurkish = locale === "tr";
  if (!source.includes('"evidenceMetric"')) {
    source = replaceRequired(
      source,
      isTurkish
        ? `      "sourceMetric": "%count% kaynak",\n      "pinMetric": "%count% iz",\n      "reviewMetric": "%count% inceleme",`
        : `      "sourceMetric": "%count% sources",\n      "pinMetric": "%count% leads",\n      "reviewMetric": "%count% reviews",`,
      isTurkish
        ? `      "sourceMetric": "%count% kaynak",\n      "evidenceMetric": "%count% kanıt",\n      "boardNoteMetric": "%count% pano notu",\n      "connectionMetric": "%count% bağlantı",\n      "reviewMetric": "%count% inceleme",`
        : `      "sourceMetric": "%count% sources",\n      "evidenceMetric": "%count% evidence",\n      "boardNoteMetric": "%count% board notes",\n      "connectionMetric": "%count% connections",\n      "reviewMetric": "%count% reviews",`,
      `${locale} truthful metrics catalog`
    );
  }

  if (!source.includes('"feedback": {')) {
    source = replaceRequired(
      source,
      `    },\n    "nav": {`,
      isTurkish
        ? `    },\n    "feedback": {\n      "dismiss": "Bildirimi kapat",\n      "sentToDesk": "Öğe çalışma masasına gönderildi.",\n      "alreadyOnDesk": "Öğe zaten çalışma masasında.",\n      "addedToReview": "Öğe 10. Adam referanslarına eklendi.",\n      "alreadyInReview": "Öğe zaten 10. Adam referanslarında.",\n      "sourcePinned": "Kaynak soruşturma tuvaline sabitlendi.",\n      "noteAdded": "Yerel not eklendi.",\n      "boardItemAdded": "Pano öğesi eklendi.",\n      "sourceAdded": "Kaynak arşive eklendi.",\n      "sourceRemoved": "Kaynak ve bağlı yerel izler kaldırıldı.",\n      "boardItemRemoved": "Yerel pano öğesi kaldırıldı.",\n      "sessionReset": "Yerel oturum temizlendi.",\n      "evidenceAdded": "Kanıt notu eklendi.",\n      "connectionAdded": "Bağlantı oluşturuldu.",\n      "debateUpdated": "10. Adam oturumu güncellendi.",\n      "importSucceeded": "Kaynak içe aktarıldı.",\n      "importFailed": "İşlem tamamlanamadı; alanları ve uyarıları kontrol edin."\n    },\n    "nav": {`
        : `    },\n    "feedback": {\n      "dismiss": "Dismiss notification",\n      "sentToDesk": "Item sent to the working desk.",\n      "alreadyOnDesk": "Item is already on the working desk.",\n      "addedToReview": "Item added to Tenth Man references.",\n      "alreadyInReview": "Item is already in Tenth Man references.",\n      "sourcePinned": "Source pinned to the investigation canvas.",\n      "noteAdded": "Local note added.",\n      "boardItemAdded": "Board item added.",\n      "sourceAdded": "Source added to the archive.",\n      "sourceRemoved": "Source and linked local traces removed.",\n      "boardItemRemoved": "Local board item removed.",\n      "sessionReset": "Local session cleared.",\n      "evidenceAdded": "Evidence note added.",\n      "connectionAdded": "Connection created.",\n      "debateUpdated": "Tenth Man session updated.",\n      "importSucceeded": "Source imported.",\n      "importFailed": "The action could not be completed; check the fields and warnings."\n    },\n    "nav": {`,
      `${locale} feedback catalog`
    );
  }

  await writeRepoFile(path, source);
}

async function updateRuntime() {
  const path = "rooms/pattern-room/ui/pattern-room-ui-runtime.ts";
  let source = await readRepoFile(path);

  if (!source.includes("type PatternWorkspaceTextKey")) {
    source = replaceRequired(
      source,
      `import { createPatternWorkspaceTranslator } from "./pattern-room-workspace-i18n.js";`,
      `import {\n  createPatternWorkspaceTranslator,\n  type PatternWorkspaceTextKey,\n} from "./pattern-room-workspace-i18n.js";`,
      "workspace text key import"
    );
  }

  if (!source.includes("type PatternWorkspaceFeedbackTone")) {
    source = replaceRequired(
      source,
      `  createPatternWorkspaceShell,\n  type PatternWorkspaceSection,\n  type PatternWorkspaceShell,`,
      `  createPatternWorkspaceShell,\n  type PatternWorkspaceFeedbackTone,\n  type PatternWorkspaceSection,\n  type PatternWorkspaceShell,`,
      "workspace feedback tone import"
    );
  }

  if (!source.includes("function showWorkspaceActionFeedback(")) {
    source = replaceRequired(
      source,
      `  function getWorkspaceText() {\n    return createPatternWorkspaceTranslator(caseReviewLocale, caseReviewTranslations);\n  }`,
      `  function getWorkspaceText() {\n    return createPatternWorkspaceTranslator(caseReviewLocale, caseReviewTranslations);\n  }\n\n  function showWorkspaceActionFeedback(\n    key: PatternWorkspaceTextKey,\n    tone: PatternWorkspaceFeedbackTone = "success"\n  ): void {\n    ensureWorkspaceShell().showActionFeedback({\n      tone,\n      message: getWorkspaceText()(key),\n    });\n  }`,
      "runtime feedback helper"
    );
  }

  if (!source.includes('showWorkspaceActionFeedback("feedback.sentToDesk")')) {
    source = replaceRequired(
      source,
      `    sendNodeToDesk(nodeId: string): void {\n      localState.sendToDesk(nodeId);\n    },`,
      `    sendNodeToDesk(nodeId: string): void {\n      const beforeCount = localState.getOverlay().deskNodeIds.length;\n      localState.sendToDesk(nodeId);\n      const added = localState.getOverlay().deskNodeIds.length > beforeCount;\n      showWorkspaceActionFeedback(\n        added ? "feedback.sentToDesk" : "feedback.alreadyOnDesk",\n        added ? "success" : "info"\n      );\n    },`,
      "desk action feedback"
    );

    source = replaceRequired(
      source,
      `    addNodeToDebate(nodeId: string): void {\n      localState.addToDebate(nodeId);\n    },`,
      `    addNodeToDebate(nodeId: string): void {\n      const beforeCount = localState.getOverlay().debateReferenceIds.length;\n      localState.addToDebate(nodeId);\n      const added = localState.getOverlay().debateReferenceIds.length > beforeCount;\n      showWorkspaceActionFeedback(\n        added ? "feedback.addedToReview" : "feedback.alreadyInReview",\n        added ? "success" : "info"\n      );\n    },`,
      "node review feedback"
    );

    source = replaceRequired(
      source,
      `    pinSourceToBoard(sourceId: string, layer): void {\n      localState.pinSource(sourceId, layer);\n    },`,
      `    pinSourceToBoard(sourceId: string, layer): void {\n      localState.pinSource(sourceId, layer);\n      showWorkspaceActionFeedback("feedback.sourcePinned");\n    },`,
      "source pin feedback"
    );

    source = replaceRequired(
      source,
      `    addSourceToDebate(sourceId: string): void {\n      localState.addToDebate(sourceId);\n    },`,
      `    addSourceToDebate(sourceId: string): void {\n      const beforeCount = localState.getOverlay().debateReferenceIds.length;\n      localState.addToDebate(sourceId);\n      const added = localState.getOverlay().debateReferenceIds.length > beforeCount;\n      showWorkspaceActionFeedback(\n        added ? "feedback.addedToReview" : "feedback.alreadyInReview",\n        added ? "success" : "info"\n      );\n    },`,
      "source review feedback"
    );

    source = replaceRequired(
      source,
      `    addLocalNote(text: string): void {\n      localState.addLocalNote(text);\n    },`,
      `    addLocalNote(text: string): void {\n      localState.addLocalNote(text);\n      showWorkspaceActionFeedback("feedback.noteAdded");\n    },`,
      "local note feedback"
    );

    for (const method of ["addAuthoredClaim", "addAuthoredInspiration", "addAuthoredUncertainty"]) {
      source = replaceRequired(
        source,
        `    ${method}(label: string, content: string): void {\n      localState.${method}(label, content);\n    },`,
        `    ${method}(label: string, content: string): void {\n      localState.${method}(label, content);\n      showWorkspaceActionFeedback("feedback.boardItemAdded");\n    },`,
        `${method} feedback`
      );
    }

    source = replaceRequired(
      source,
      `    addAuthoredSource(label: string, origin: string, note: string): void {\n      localState.addAuthoredSource(label, origin, note);\n    },`,
      `    addAuthoredSource(label: string, origin: string, note: string): void {\n      localState.addAuthoredSource(label, origin, note);\n      showWorkspaceActionFeedback("feedback.sourceAdded");\n    },`,
      "source authoring feedback"
    );

    source = replaceRequired(
      source,
      `    removeLocalSource(sourceId: string): void {\n      localState.removeLocalSource(sourceId);\n    },`,
      `    removeLocalSource(sourceId: string): void {\n      const summary = localState.removeLocalSource(sourceId);\n      showWorkspaceActionFeedback(\n        summary.sourcesRemoved > 0 ? "feedback.sourceRemoved" : "feedback.importFailed",\n        summary.sourcesRemoved > 0 ? "success" : "error"\n      );\n    },`,
      "source removal feedback"
    );

    source = replaceRequired(
      source,
      `    removeLocalNode(nodeId: string): void {\n      localState.removeLocalNode(nodeId);\n    },`,
      `    removeLocalNode(nodeId: string): void {\n      const summary = localState.removeLocalNode(nodeId);\n      showWorkspaceActionFeedback(\n        summary.nodesRemoved > 0 ? "feedback.boardItemRemoved" : "feedback.importFailed",\n        summary.nodesRemoved > 0 ? "success" : "error"\n      );\n    },`,
      "node removal feedback"
    );

    source = replaceRequired(
      source,
      `    removeLocalEvidence(evidenceId: string): void {\n      localState.removeLocalEvidence(evidenceId);\n    },`,
      `    removeLocalEvidence(evidenceId: string): void {\n      const summary = localState.removeLocalEvidence(evidenceId);\n      showWorkspaceActionFeedback(\n        summary.evidenceRemoved > 0 ? "feedback.boardItemRemoved" : "feedback.importFailed",\n        summary.evidenceRemoved > 0 ? "success" : "error"\n      );\n    },`,
      "evidence removal feedback"
    );

    source = replaceRequired(
      source,
      `    resetLocalSession(): void {\n      localState.resetOverlayToEmpty();\n    },`,
      `    resetLocalSession(): void {\n      const summary = localState.resetOverlayToEmpty();\n      showWorkspaceActionFeedback(\n        summary.resetPerformed ? "feedback.sessionReset" : "feedback.importFailed",\n        summary.resetPerformed ? "success" : "error"\n      );\n    },`,
      "session reset feedback"
    );

    source = replaceRequired(
      source,
      `    addAuthoredEvidence(label: string, excerpt: string, interpretation, layer, options): void {\n      localState.addAuthoredEvidence(label, excerpt, interpretation, layer, options);\n    },`,
      `    addAuthoredEvidence(label: string, excerpt: string, interpretation, layer, options): void {\n      localState.addAuthoredEvidence(label, excerpt, interpretation, layer, options);\n      showWorkspaceActionFeedback("feedback.evidenceAdded");\n    },`,
      "evidence authoring feedback"
    );

    source = replaceRequired(
      source,
      `    addAuthoredEdge(edgeType, sourceId: string, targetId: string, note?: string): void {\n      localState.addAuthoredEdge(edgeType, sourceId, targetId, note);\n    },`,
      `    addAuthoredEdge(edgeType, sourceId: string, targetId: string, note?: string): void {\n      const beforeCount = localState.getOverlay().localAuthoredEdges.length;\n      localState.addAuthoredEdge(edgeType, sourceId, targetId, note);\n      const added = localState.getOverlay().localAuthoredEdges.length > beforeCount;\n      showWorkspaceActionFeedback(\n        added ? "feedback.connectionAdded" : "feedback.importFailed",\n        added ? "success" : "error"\n      );\n    },`,
      "connection feedback"
    );
  }

  if (!source.includes('showWorkspaceActionFeedback("feedback.importSucceeded"')) {
    source = replaceRequired(
      source,
      `      userTextSourceImportStatus = summarizeUserTextImportResult(result);\n      render();\n      return userTextSourceImportStatus;`,
      `      userTextSourceImportStatus = summarizeUserTextImportResult(result);\n      render();\n      showWorkspaceActionFeedback(\n        userTextSourceImportStatus.success\n          ? "feedback.importSucceeded"\n          : "feedback.importFailed",\n        userTextSourceImportStatus.success ? "success" : "error"\n      );\n      return userTextSourceImportStatus;`,
      "user text import feedback"
    );

    source = replaceRequired(
      source,
      `      longTextSourceImportStatus = summarizeLongTextImportResult(result);\n      render();\n      return longTextSourceImportStatus;`,
      `      longTextSourceImportStatus = summarizeLongTextImportResult(result);\n      render();\n      showWorkspaceActionFeedback(\n        longTextSourceImportStatus.success\n          ? "feedback.importSucceeded"\n          : "feedback.importFailed",\n        longTextSourceImportStatus.success ? "success" : "error"\n      );\n      return longTextSourceImportStatus;`,
      "long text import feedback"
    );

    source = replaceRequired(
      source,
      `    importSampleSourcePackage(packageId?: string) {\n      sourceImportDemoStatus = importSampleSourcePackage(localState, packageId);\n      render();\n      return sourceImportDemoStatus;\n    },`,
      `    importSampleSourcePackage(packageId?: string) {\n      sourceImportDemoStatus = importSampleSourcePackage(localState, packageId);\n      render();\n      const importedCount =\n        sourceImportDemoStatus.sourcesAdded +\n        sourceImportDemoStatus.evidenceAdded +\n        sourceImportDemoStatus.nodesAdded +\n        sourceImportDemoStatus.edgesAdded +\n        sourceImportDemoStatus.notesAdded;\n      showWorkspaceActionFeedback(\n        importedCount > 0 ? "feedback.importSucceeded" : "feedback.importFailed",\n        importedCount > 0 ? "success" : sourceImportDemoStatus.duplicate ? "info" : "error"\n      );\n      return sourceImportDemoStatus;\n    },`,
      "sample import feedback"
    );
  }

  if (!source.includes('showWorkspaceActionFeedback("feedback.debateUpdated")')) {
    for (const method of [
      "prepareDebate",
      "assignDebateRoles",
      "startDebate",
      "advanceDebatePhase",
      "completeDebate",
      "reflectDebateToReport",
    ]) {
      source = replaceRequired(
        source,
        `    ${method}(): void {\n      localState.${method}();\n    },`,
        `    ${method}(): void {\n      localState.${method}();\n      showWorkspaceActionFeedback("feedback.debateUpdated");\n    },`,
        `${method} feedback`
      );
    }
  }

  if (!source.includes("evidenceCount:")) {
    source = replaceRequired(
      source,
      `  function createWorkspaceSummary() {\n    return {\n      subject: viewModels.subject,\n      pinCount: viewModels.boardCategories.reduce((count, category) => {\n        return count + category.pins.length;\n      }, 0),\n      sourceCount: viewModels.sources.length,\n      reviewCount: caseReviewRuntimeState.history.length,\n    };\n  }`,
      `  function createWorkspaceSummary() {\n    const overlay = localState.getOverlay();\n    const evidenceCount = viewModels.boardCategories.reduce((count, category) => {\n      if (category.id !== "evidence") {\n        return count;\n      }\n      return (\n        count +\n        category.pins.filter((pin) => {\n          return pin.kind !== "placeholder";\n        }).length\n      );\n    }, 0);\n    const boardNoteCount = viewModels.boardCategories.reduce((count, category) => {\n      if (category.id === "evidence") {\n        return count;\n      }\n      return (\n        count +\n        category.pins.filter((pin) => {\n          return pin.kind !== "placeholder";\n        }).length\n      );\n    }, 0);\n\n    return {\n      subject: viewModels.subject,\n      sourceCount: viewModels.sources.length,\n      evidenceCount,\n      boardNoteCount,\n      connectionCount: domain.edges.length + overlay.localAuthoredEdges.length,\n      reviewCount: caseReviewRuntimeState.history.length,\n    };\n  }`,
      "truthful runtime summary"
    );
  }

  await writeRepoFile(path, source);
}

async function updateStyles() {
  const path = "rooms/pattern-room/ui/workspace.css";
  let source = await readRepoFile(path);

  if (!source.includes("WORKSPACE ACTION FEEDBACK")) {
    source += `\n\n/* ─────────────────────────────────────────\n   WORKSPACE ACTION FEEDBACK — görünür işlem sonucu\n───────────────────────────────────────── */\n.pattern-room-workspace-feedback-slot {\n  position: fixed;\n  z-index: 90;\n  top: var(--pattern-px-104);\n  right: var(--pattern-px-18);\n  width: min(var(--pattern-px-360), calc(100vw - var(--pattern-px-32)));\n  pointer-events: none;\n}\n\n.pattern-room-workspace-feedback {\n  display: grid;\n  grid-template-columns: var(--pattern-px-30) minmax(0, 1fr) var(--pattern-px-30);\n  gap: var(--pattern-px-10);\n  align-items: center;\n  padding: var(--pattern-px-12);\n  border: var(--pattern-px-1) solid var(--pattern-accent-amber-alpha-38);\n  border-radius: var(--pattern-px-6);\n  background: var(--pattern-surface-depth-alpha-96);\n  box-shadow: 0 var(--pattern-px-12) var(--pattern-px-36) var(--pattern-black-alpha-48);\n  pointer-events: auto;\n}\n\n.pattern-room-workspace-feedback.success {\n  border-color: var(--pattern-accent-green-alpha-42);\n}\n\n.pattern-room-workspace-feedback.error {\n  border-color: var(--pattern-accent-red-alpha-48);\n}\n\n.pattern-room-workspace-feedback.warning {\n  border-color: var(--pattern-accent-amber-alpha-48);\n}\n\n.pattern-room-workspace-feedback.info {\n  border-color: var(--pattern-accent-cyan-alpha-38);\n}\n\n.pattern-room-workspace-feedback-icon {\n  display: grid;\n  width: var(--pattern-px-28);\n  height: var(--pattern-px-28);\n  place-items: center;\n  border: var(--pattern-px-1) solid currentColor;\n  border-radius: var(--pattern-px-999);\n  font-family: "IBM Plex Mono", monospace;\n  color: var(--pattern-accent-amber);\n  font-weight: 900;\n}\n\n.pattern-room-workspace-feedback.success .pattern-room-workspace-feedback-icon {\n  color: var(--pattern-accent-green);\n}\n\n.pattern-room-workspace-feedback.error .pattern-room-workspace-feedback-icon {\n  color: var(--pattern-accent-red);\n}\n\n.pattern-room-workspace-feedback.info .pattern-room-workspace-feedback-icon {\n  color: var(--pattern-accent-cyan);\n}\n\n.pattern-room-workspace-feedback-message {\n  margin: 0;\n  color: var(--pattern-text);\n  font-size: var(--pattern-rem-0-82);\n  line-height: 1.45;\n}\n\n.pattern-room-workspace-feedback-dismiss {\n  width: var(--pattern-px-28);\n  height: var(--pattern-px-28);\n  border: 0;\n  background: transparent;\n  color: var(--pattern-text-subtle);\n  font-family: "IBM Plex Mono", monospace;\n  font-size: var(--pattern-rem-1-2);\n  cursor: pointer;\n}\n\n.pattern-room-workspace-feedback-dismiss:hover,\n.pattern-room-workspace-feedback-dismiss:focus-visible {\n  color: var(--pattern-text);\n  outline: var(--pattern-px-1) solid var(--pattern-accent-amber);\n  outline-offset: var(--pattern-px-2);\n}\n\n@media (max-width: 820px) {\n  .pattern-room-workspace-feedback-slot {\n    top: var(--pattern-px-76);\n    right: var(--pattern-px-10);\n    width: calc(100vw - var(--pattern-px-20));\n  }\n}\n`;
  }

  await writeRepoFile(path, source);
}

async function updateTests() {
  const part1Path = "scripts/tests/pattern-room-installed-ui-smoke-regressions-part1.test.ts";
  let part1 = await readRepoFile(part1Path);
  if (!part1.includes('"1 kanıt", "3 pano notu", "3 bağlantı"')) {
    part1 = replaceRequired(
      part1,
      `    assert.match(readTreeText(environment.app), /Pattern Room/);`,
      `    assert.match(readTreeText(environment.app), /Pattern Room/);\n    assertTextIncludes(readTreeText(environment.app), [\n      "4 kaynak",\n      "1 kanıt",\n      "3 pano notu",\n      "3 bağlantı",\n      "0 inceleme",\n    ]);\n    assert.doesNotMatch(readTreeText(environment.app), /4 iz/);`,
      "truthful workspace metric regression"
    );
  }
  await writeRepoFile(part1Path, part1);

  const part2Path = "scripts/tests/pattern-room-installed-ui-smoke-regressions-part2.test.ts";
  let part2 = await readRepoFile(part2Path);
  if (!part2.includes("Öğe çalışma masasına gönderildi.")) {
    part2 = replaceRequired(
      part2,
      `    assert.ok(sendToDesk);\n    fireEvent(sendToDesk, "click");`,
      `    assert.ok(sendToDesk);\n    fireEvent(sendToDesk, "click");\n    const deskFeedback = environment.app.querySelector(\n      "[data-pattern-workspace-feedback='true']"\n    );\n    assert.ok(deskFeedback);\n    assert.equal(deskFeedback.dataset["patternWorkspaceFeedbackTone"], "success");\n    assertTextIncludes(readTreeText(deskFeedback), ["Öğe çalışma masasına gönderildi."]);`,
      "desk feedback regression"
    );

    part2 = replaceRequired(
      part2,
      `    assert.ok(addBoardNodeToDebate);\n    fireEvent(addBoardNodeToDebate, "click");`,
      `    assert.ok(addBoardNodeToDebate);\n    fireEvent(addBoardNodeToDebate, "click");\n    const reviewFeedback = environment.app.querySelector(\n      "[data-pattern-workspace-feedback='true']"\n    );\n    assert.ok(reviewFeedback);\n    assert.equal(reviewFeedback.dataset["patternWorkspaceFeedbackTone"], "success");\n    assertTextIncludes(readTreeText(reviewFeedback), [\n      "Öğe 10. Adam referanslarına eklendi.",\n    ]);\n    const dismissFeedback = reviewFeedback.querySelector(\n      "[data-pattern-workspace-feedback-dismiss='true']"\n    );\n    assert.ok(dismissFeedback);\n    fireEvent(dismissFeedback, "click");\n    assert.equal(\n      environment.app.querySelector("[data-pattern-workspace-feedback='true']"),\n      null\n    );`,
      "review feedback and dismiss regression"
    );
  }
  await writeRepoFile(part2Path, part2);
}

async function updateProgress() {
  const path = ".rovo/pattern-room-v2-progress.md";
  let source = await readRepoFile(path);
  if (!source.includes("Completed: visible action feedback and truthful workspace metrics")) {
    source += `\n\n## Completed: visible action feedback and truthful workspace metrics\n\n- Common local mutations now publish an explicit success, information or error message in a shell-level feedback surface.\n- Feedback survives panel rerenders, remains visible when the right inspector collapses and can be dismissed explicitly.\n- Duplicate desk and Tenth Man reference actions report that the item was already present instead of implying a new mutation.\n- Case summary chips now separate sources, evidence, board notes, connections and review sessions; placeholder cards are not counted as case truth.\n- Installed UI regressions cover feedback replacement, dismissal and truthful fixture metrics.\n\n## Next implementation steps\n\n1. Add editable case identity and research question metadata.\n2. Correct report outline counts and separate Tenth Man references from session turns.\n3. Add sourceId and targetId to projected Case Packet connections and normalize repeated role labels.\n`;
  }
  await writeRepoFile(path, source);
}

await updateWorkspaceShell();
await updateWorkspaceI18n();
await updateCatalog("rooms/pattern-room/i18n/tr.json", "tr");
await updateCatalog("rooms/pattern-room/i18n/en.json", "en");
await updateRuntime();
await updateStyles();
await updateTests();
await updateProgress();

if (changedFiles.length === 0) {
  console.log("Pattern Room action feedback and truthful metrics are already current.");
} else {
  console.log(`${apply ? "Applied" : "Would apply"}:`);
  changedFiles.forEach((path) => {
    console.log(`- ${path}`);
  });
}
