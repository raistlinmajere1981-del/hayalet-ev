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
  let current = null;
  try {
    current = await readRepoFile(path);
  } catch {
    current = null;
  }
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
    throw new Error(`Required persistent-inspector migration pattern was not found: ${label}`);
  }
  return content.replace(search, replacement);
}

const investigationInspectorSource = `import type {
  PatternBoardPin,
  PatternConnectionOption,
  PatternPanelActions,
  PatternRoomWorkspaceModel,
} from "../../shared/types/pattern-room.js";
import {
  createPatternWorkspaceTranslator,
  type PatternWorkspaceTranslator,
} from "../pattern-room-workspace-i18n.js";
import { createConnectionAuthoringForm } from "./pattern-connection-composer.js";
import type { PatternInvestigationCanvasMode } from "./pattern-investigation-panel.js";
import { createActionButton, createElement } from "./pattern-panel-utils.js";

type AuthoredBoardNodeType = "claim" | "inspiration" | "uncertainty";
const REMOVE_BOARD_ITEM_CONFIRM_MESSAGE =
  "Bu yerel pano öğesi odadan kaldırılacak. Bağlı yerel bağlantılar da temizlenir. Devam edilsin mi?";

function createTextInput(name: string, placeholder: string): HTMLInputElement {
  const input = createElement("input", "pattern-room-inline-input");
  input.name = name;
  input.placeholder = placeholder;
  return input;
}

function createTextArea(name: string, placeholder: string): HTMLTextAreaElement {
  const textarea = createElement("textarea", "pattern-room-inline-input");
  textarea.name = name;
  textarea.placeholder = placeholder;
  return textarea;
}

function createSubmitButton(label: string): HTMLButtonElement {
  const button = createElement("button", "pattern-room-action-button", label);
  button.type = "submit";
  return button;
}

function createAuthoringDisclosure(label: string, form: HTMLFormElement): HTMLElement {
  const disclosure = createElement("details", "pattern-room-inline-disclosure");
  disclosure.dataset["patternAuthoringDisclosure"] = label;
  disclosure.append(createElement("summary", "pattern-room-inline-summary", label), form);
  return disclosure;
}

function createNodeTypeOption(value: AuthoredBoardNodeType, label: string): HTMLOptionElement {
  const option = createElement("option", undefined, label);
  option.value = value;
  return option;
}

function createBoardAuthoringPanel(
  actions: PatternPanelActions,
  connectionOptions: readonly PatternConnectionOption[]
): HTMLElement {
  const authoring = createElement("section", "pattern-room-inline-authoring");
  const nodeForm = createElement("form", "pattern-room-inline-form");
  nodeForm.dataset["patternAuthorNodeForm"] = "true";

  const nodeType = createElement("select", "pattern-room-inline-input");
  nodeType.name = "nodeType";
  nodeType.dataset["patternAuthorNodeType"] = "true";
  nodeType.append(
    createNodeTypeOption("claim", "İddia"),
    createNodeTypeOption("inspiration", "İlham"),
    createNodeTypeOption("uncertainty", "Belirsizlik")
  );

  const nodeLabel = createTextInput("label", "Başlık");
  nodeLabel.dataset["patternAuthorNodeLabel"] = "true";
  const nodeContent = createTextArea("content", "İçerik");
  nodeContent.dataset["patternAuthorNodeContent"] = "true";

  nodeForm.addEventListener("submit", (event) => {
    event.preventDefault();
    const label = nodeLabel.value;
    const content = nodeContent.value;
    if (label.trim() === "" || content.trim() === "") {
      return;
    }

    switch (nodeType.value as AuthoredBoardNodeType) {
      case "claim":
        actions.addAuthoredClaim(label, content);
        break;
      case "inspiration":
        actions.addAuthoredInspiration(label, content);
        break;
      case "uncertainty":
        actions.addAuthoredUncertainty(label, content);
        break;
    }
    nodeForm.reset();
    nodeType.value = "claim";
  });

  nodeForm.append(nodeType, nodeLabel, nodeContent, createSubmitButton("Ekle"));

  const evidenceForm = createElement("form", "pattern-room-inline-form");
  evidenceForm.dataset["patternAuthorEvidenceForm"] = "true";
  const evidenceLabel = createTextInput("label", "Başlık");
  evidenceLabel.dataset["patternAuthorEvidenceLabel"] = "true";
  const excerpt = createTextArea("excerpt", "Alıntı");
  excerpt.dataset["patternAuthorEvidenceExcerpt"] = "true";
  const interpretation = createTextArea("interpretation", "Yorum");
  interpretation.dataset["patternAuthorEvidenceInterpretation"] = "true";

  evidenceForm.addEventListener("submit", (event) => {
    event.preventDefault();
    if (evidenceLabel.value.trim() === "" || excerpt.value.trim() === "") {
      return;
    }

    actions.addAuthoredEvidence(evidenceLabel.value, excerpt.value, interpretation.value);
    evidenceForm.reset();
  });

  evidenceForm.append(evidenceLabel, excerpt, interpretation, createSubmitButton("Ekle"));

  authoring.append(
    createAuthoringDisclosure("Yeni Öğe Ekle", nodeForm),
    createAuthoringDisclosure("Kanıt Notu Ekle", evidenceForm),
    createAuthoringDisclosure(
      "Bağlantı Kur",
      createConnectionAuthoringForm(actions, connectionOptions)
    )
  );
  return authoring;
}

function findBoardPin(
  data: PatternRoomWorkspaceModel,
  pinId: string | null
): PatternBoardPin | null {
  if (pinId === null) {
    return null;
  }

  for (const category of data.boardCategories) {
    const match = category.pins.find((pin) => pin.id === pinId);
    if (match !== undefined) {
      return match;
    }
  }
  return null;
}

function createDetailMetric(label: string, value: string): HTMLElement {
  const metric = createElement("div", "pattern-room-detail-metric");
  metric.append(createElement("span", undefined, label), createElement("strong", undefined, value));
  return metric;
}

function createSelectedPinDetail(
  data: PatternRoomWorkspaceModel,
  actions: PatternPanelActions,
  pinId: string | null
): HTMLElement {
  const detail = createElement("section", "pattern-room-board-detail");
  detail.dataset["patternBoardDetail"] = "true";
  detail.ariaLive = "polite";
  const selectedPin = findBoardPin(data, pinId);
  if (selectedPin === null) {
    detail.append(
      createElement("span", "pattern-room-kicker", "Tuval detayı"),
      createElement("h2", undefined, "Bir öğe seç"),
      createElement(
        "p",
        undefined,
        "Seçilen kaynak, kanıt veya düğümün katman, güven ve köken bilgisi burada görünür."
      )
    );
    return detail;
  }

  const metrics = createElement("div", "pattern-room-detail-metrics");
  metrics.append(
    createDetailMetric("Katman", selectedPin.layerLabel),
    createDetailMetric("Güven", selectedPin.confidenceLabel),
    createDetailMetric("Kaynak", selectedPin.sourceLabel)
  );

  const actionsRow = createElement("div", "pattern-room-action-row");
  if (selectedPin.kind === "node") {
    if (!selectedPin.isLocal) {
      const deskButton = createActionButton("Masaya Gönder", () => {
        actions.sendNodeToDesk(selectedPin.id);
      });
      deskButton.dataset["patternSendToDesk"] = selectedPin.id;
      actionsRow.append(deskButton);
    }

    const debateButton = createActionButton("10. Adam’a Ekle", () => {
      actions.addNodeToDebate(selectedPin.id);
    });
    debateButton.dataset["patternAddNodeDebate"] = selectedPin.id;
    actionsRow.append(debateButton);
  }

  if (selectedPin.kind === "source" && selectedPin.sourceId !== null) {
    const sourceId = selectedPin.sourceId;
    const debateButton = createActionButton("10. Adam’a Ekle", () => {
      actions.addSourceToDebate(sourceId);
    });
    debateButton.dataset["patternAddSourceDebate"] = sourceId;
    actionsRow.append(debateButton);
  }

  if (selectedPin.kind === "evidence") {
    const debateButton = createActionButton("10. Adam’a Ekle", () => {
      actions.addNodeToDebate(selectedPin.id);
    });
    debateButton.dataset["patternAddEvidenceDebate"] = selectedPin.id;
    actionsRow.append(debateButton);
  }

  if (selectedPin.isLocal && (selectedPin.kind === "node" || selectedPin.kind === "evidence")) {
    const removeButton = createActionButton("Öğeyi kaldır", () => {
      if (!window.confirm(REMOVE_BOARD_ITEM_CONFIRM_MESSAGE)) {
        return;
      }
      actions.selectNode(null);
      if (selectedPin.kind === "node") {
        actions.removeLocalNode(selectedPin.id);
        return;
      }
      actions.removeLocalEvidence(selectedPin.id);
    });
    removeButton.dataset["patternRemoveBoardItem"] = selectedPin.id;
    removeButton.dataset["patternRemoveBoardItemKind"] = selectedPin.kind;
    actionsRow.append(removeButton);
  }

  detail.append(
    createElement("span", "pattern-room-kicker", "Tuval detayı"),
    createElement("h2", undefined, selectedPin.label),
    metrics,
    createElement("p", undefined, selectedPin.content),
    createElement(
      "small",
      undefined,
      selectedPin.origin === null ? "Kaynak origin bilgisi yok." : selectedPin.origin
    ),
    actionsRow
  );
  return detail;
}

function createConnectionEntity(option: PatternConnectionOption): HTMLElement {
  const kindLabel =
    option.kind === "evidence" ? "Kanıt" : option.kind === "source" ? "Kaynak" : "Öğe";
  const card = createElement("article", "pattern-room-connection-entity");
  card.dataset["patternConnectionEntity"] = option.id;
  card.append(
    createElement("span", "pattern-room-list-eyebrow", kindLabel),
    createElement("strong", undefined, option.label),
    createElement(
      "small",
      `pattern-room-connection-scope ${option.isLocal ? "local" : "domain"}`,
      option.isLocal ? "Yerel" : "Domain"
    )
  );
  return card;
}

function createBoardInspectorContent(
  data: PatternRoomWorkspaceModel,
  actions: PatternPanelActions,
  selectedPinId: string | null,
  text: PatternWorkspaceTranslator
): HTMLElement {
  const content = createElement("div", "pattern-room-investigation-inspector-content");
  content.dataset["patternInvestigationInspectorMode"] = "board";
  content.append(createSelectedPinDetail(data, actions, selectedPinId));

  const tools = createElement(
    "section",
    "pattern-room-investigation-inspector-section pattern-room-board-inspector-tools"
  );
  tools.append(
    createElement("span", "pattern-room-context-inspector-label", text("board.toolsLabel")),
    createBoardAuthoringPanel(actions, data.connectionOptions)
  );
  content.append(tools);
  return content;
}

function createGraphInspectorContent(
  data: PatternRoomWorkspaceModel,
  actions: PatternPanelActions,
  text: PatternWorkspaceTranslator
): HTMLElement {
  const content = createElement("div", "pattern-room-investigation-inspector-content");
  content.dataset["patternInvestigationInspectorMode"] = "graph";

  const entitySection = createElement(
    "section",
    "pattern-room-investigation-inspector-section pattern-room-connection-entities"
  );
  entitySection.append(
    createElement("span", "pattern-room-context-inspector-label", text("connections.entitiesLabel"))
  );
  const entityList = createElement("div", "pattern-room-connection-entity-list");
  entityList.append(...data.connectionOptions.map(createConnectionEntity));
  entitySection.append(entityList);

  const composer = createElement(
    "section",
    "pattern-room-investigation-inspector-section pattern-room-connection-composer"
  );
  composer.append(
    createElement(
      "span",
      "pattern-room-context-inspector-label",
      text("connections.composerLabel")
    ),
    createConnectionAuthoringForm(actions, data.connectionOptions)
  );

  content.append(entitySection, composer);
  return content;
}

export function createInvestigationInspectorContent(
  mode: PatternInvestigationCanvasMode,
  data: PatternRoomWorkspaceModel,
  actions: PatternPanelActions,
  selectedPinId: string | null,
  text: PatternWorkspaceTranslator = createPatternWorkspaceTranslator("tr", null)
): HTMLElement {
  return mode === "graph"
    ? createGraphInspectorContent(data, actions, text)
    : createBoardInspectorContent(data, actions, selectedPinId, text);
}
`;

const boardPanelSource = `import type {
  PatternPanelActions,
  PatternRoomWorkspaceModel,
} from "../../shared/types/pattern-room.js";
import {
  createPatternWorkspaceTranslator,
  type PatternWorkspaceTranslator,
} from "../pattern-room-workspace-i18n.js";
import { createElement, createPanelShell } from "./pattern-panel-utils.js";

export function createBoardPanel(
  data: PatternRoomWorkspaceModel,
  actions: PatternPanelActions,
  onBack: () => void,
  text: PatternWorkspaceTranslator = createPatternWorkspaceTranslator("tr", null)
): HTMLElement {
  const shell = createPanelShell("board", text("nav.board.label"), onBack);
  const workspace = createElement(
    "div",
    "pattern-room-board-workspace pattern-room-board-workspace-canvas-only"
  );
  const canvas = createElement("section", "pattern-room-board-canvas");
  canvas.ariaLabel = text("board.canvasLabel");
  const canvasHeader = createElement("header", "pattern-room-workspace-section-header");
  const pinCount = data.boardCategories.reduce((count, category) => {
    return count + category.pins.length;
  }, 0);
  canvasHeader.append(
    createElement("span", "pattern-room-kicker", text("board.canvasLabel")),
    createElement("strong", undefined, `${String(pinCount)} · ${data.subject}`)
  );
  const boardScene = createElement("div", "pattern-room-board-scene");
  const grid = createElement("div", "pattern-room-board-grid");
  const pinButtons: HTMLButtonElement[] = [];

  function markSelectedPin(pinId: string | null): void {
    pinButtons.forEach((button) => {
      const isSelected = button.dataset["patternBoardPin"] === pinId;
      button.dataset["patternBoardPinSelected"] = isSelected ? "true" : "false";
      button.ariaPressed = isSelected ? "true" : "false";
      if (isSelected) {
        button.classList.add("selected");
      } else {
        button.classList.remove("selected");
      }
    });
  }

  data.boardCategories.forEach((category) => {
    const lane = createElement("article", `pattern-room-board-lane ${category.tone}`);
    const laneHeader = createElement("header", "pattern-room-board-lane-header");
    laneHeader.append(
      createElement("span", "pattern-room-board-lane-label", "Pano kategorisi"),
      createElement("span", "pattern-room-board-lane-count", String(category.pins.length)),
      createElement("h2", undefined, category.label),
      createElement("p", undefined, category.summary)
    );

    const pinList = createElement("div", "pattern-room-board-pins");
    category.pins.forEach((pinItem) => {
      const pin = createElement("button", `pattern-room-board-node ${category.tone}`);
      pin.type = "button";
      pin.append(
        createElement("span", "pattern-room-board-node-copy", pinItem.label),
        createElement(
          "small",
          "pattern-room-board-node-meta",
          `${pinItem.layerLabel} · ${pinItem.confidenceLabel}`
        )
      );
      pin.dataset["patternBoardPin"] = pinItem.id;
      pin.dataset["patternBoardPinKind"] = pinItem.kind;
      pin.addEventListener("click", () => {
        actions.selectNode(pinItem.id);
        markSelectedPin(pinItem.id);
      });
      pinButtons.push(pin);
      pinList.append(pin);
    });

    lane.append(laneHeader, pinList);
    grid.append(lane);
  });

  markSelectedPin(actions.getSelectedNodeId());
  boardScene.append(grid);
  canvas.append(canvasHeader, boardScene);
  workspace.append(canvas);
  shell.append(workspace);
  return shell;
}
`;

const deskPanelSource = `import type {
  PatternPanelActions,
  PatternRoomWorkspaceModel,
} from "../../shared/types/pattern-room.js";
import {
  createPatternWorkspaceTranslator,
  type PatternWorkspaceTranslator,
} from "../pattern-room-workspace-i18n.js";
import { createElement, createPanelShell } from "./pattern-panel-utils.js";

export function createDeskPanel(
  data: PatternRoomWorkspaceModel,
  _actions: PatternPanelActions,
  onBack: () => void,
  text: PatternWorkspaceTranslator = createPatternWorkspaceTranslator("tr", null)
): HTMLElement {
  const shell = createPanelShell("desk", text("connections.title"), onBack);
  const layout = createElement(
    "div",
    "pattern-room-desk-layout pattern-room-connections-workspace pattern-room-connections-canvas-only"
  );

  const workSurface = createElement("section", "pattern-room-desk-surface");
  workSurface.ariaLabel = text("connections.title");
  const surfaceHeader = createElement("header", "pattern-room-desk-header");
  surfaceHeader.append(
    createElement("span", "pattern-room-kicker", text("connections.kicker")),
    createElement("h2", undefined, data.subject),
    createElement("p", undefined, text("connections.intro"))
  );

  const connectionMap = createElement("div", "pattern-room-connection-map");
  connectionMap.dataset["patternConnectionMap"] = "true";
  const claimObjects = createElement("div", "pattern-room-claim-objects");
  data.claims.forEach((claim, index) => {
    const eyebrow = claim.stance === "primary" ? "Ana iz" : "Karşı iz";
    const claimCard = createElement("article", `pattern-room-claim-object ${claim.stance}`);
    claimCard.dataset["patternConnectionClaim"] = claim.id;
    claimCard.append(
      createElement("span", "pattern-room-list-eyebrow", eyebrow),
      createElement("span", "pattern-room-connection-node-index", String(index + 1)),
      createElement("h3", undefined, claim.label),
      createElement("p", undefined, claim.summary),
      createElement("small", undefined, "Yerel masa nesnesi")
    );
    claimObjects.append(claimCard);
  });
  const relationship = createElement("div", "pattern-room-connection-axis");
  relationship.ariaHidden = "true";
  connectionMap.append(claimObjects, relationship);
  workSurface.append(surfaceHeader, connectionMap);
  layout.append(workSurface);
  shell.append(layout);
  return shell;
}
`;

async function updatePanelFiles() {
  await writeRepoFile(
    "rooms/pattern-room/ui/panels/pattern-investigation-inspector.ts",
    investigationInspectorSource
  );
  await writeRepoFile("rooms/pattern-room/ui/panels/pattern-board-panel.ts", boardPanelSource);
  await writeRepoFile("rooms/pattern-room/ui/panels/pattern-desk-panel.ts", deskPanelSource);
}

async function updateWorkspaceShell() {
  const path = "rooms/pattern-room/ui/panels/pattern-workspace-shell.ts";
  let source = await readRepoFile(path);
  if (source.includes("setInspectorContent: (content: HTMLElement | null) => void;")) {
    return;
  }

  source = replaceRequired(
    source,
    `  readonly inspector: HTMLElement;\n  updateActiveView: (viewId: PatternViewId, section: PatternWorkspaceSection) => void;`,
    `  readonly inspector: HTMLElement;\n  setInspectorContent: (content: HTMLElement | null) => void;\n  updateActiveView: (viewId: PatternViewId, section: PatternWorkspaceSection) => void;`,
    "shell inspector method type"
  );

  source = replaceRequired(
    source,
    `  inspectorCase.append(inspectorSubject, inspectorMetrics);\n  inspector.append(inspectorHeader, inspectorCase);`,
    `  inspectorCase.append(inspectorSubject, inspectorMetrics);\n  const inspectorContent = createElement("div", "pattern-room-workspace-inspector-content");\n  inspectorContent.dataset["patternWorkspaceInspectorContent"] = "true";\n  inspector.append(inspectorHeader, inspectorCase, inspectorContent);`,
    "shell inspector content mount"
  );

  source = replaceRequired(
    source,
    `    outlet,\n    inspector,\n    updateActiveView(viewId, section): void {`,
    `    outlet,\n    inspector,\n    setInspectorContent(content): void {\n      inspectorContent.replaceChildren();\n      if (content !== null) {\n        inspectorContent.append(content);\n      }\n    },\n    updateActiveView(viewId, section): void {`,
    "shell inspector content method"
  );

  await writeRepoFile(path, source);
}

async function updateRuntime() {
  const path = "rooms/pattern-room/ui/pattern-room-ui-runtime.ts";
  let source = await readRepoFile(path);

  if (!source.includes('from "./panels/pattern-investigation-inspector.js";')) {
    source = replaceRequired(
      source,
      `import {\n  createInvestigationPanel,\n  type PatternInvestigationCanvasMode,\n} from "./panels/pattern-investigation-panel.js";`,
      `import { createInvestigationInspectorContent } from "./panels/pattern-investigation-inspector.js";\nimport {\n  createInvestigationPanel,\n  type PatternInvestigationCanvasMode,\n} from "./panels/pattern-investigation-panel.js";`,
      "runtime inspector import"
    );
  }

  if (!source.includes("function renderWorkspaceInspector(")) {
    source = replaceRequired(
      source,
      `  function focusActiveWorkspaceSection(shell: PatternWorkspaceShell): void {`,
      `  function renderWorkspaceInspector(shell: PatternWorkspaceShell = ensureWorkspaceShell()): void {\n    if (activeView !== "board" && activeView !== "desk") {\n      shell.setInspectorContent(null);\n      return;\n    }\n\n    const mode: PatternInvestigationCanvasMode = activeView === "desk" ? "graph" : "board";\n    shell.setInspectorContent(\n      createInvestigationInspectorContent(\n        mode,\n        viewModels,\n        actions,\n        selectedNodeId,\n        getWorkspaceText()\n      )\n    );\n  }\n\n  function focusActiveWorkspaceSection(shell: PatternWorkspaceShell): void {`,
      "runtime inspector renderer"
    );
  }

  source = replaceRequired(
    source,
    `          onModeChange(mode) {\n            investigationCanvasMode = mode;\n            activeView = mode === "graph" ? "desk" : "board";\n            renderedView = activeView;\n            workspacePanelCache.clear();\n          },`,
    `          onModeChange(mode) {\n            investigationCanvasMode = mode;\n            activeView = mode === "graph" ? "desk" : "board";\n            renderedView = activeView;\n            workspacePanelCache.clear();\n            const shell = ensureWorkspaceShell();\n            shell.updateActiveView(activeView, activeWorkspaceSection);\n            renderWorkspaceInspector(shell);\n          },`,
    "mode switch inspector refresh"
  );

  source = replaceRequired(
    source,
    `    shell.updateSummary(createWorkspaceSummary());\n    shell.updateActiveView(activeView, activeWorkspaceSection);\n    focusActiveWorkspaceSection(shell);`,
    `    shell.updateSummary(createWorkspaceSummary());\n    shell.updateActiveView(activeView, activeWorkspaceSection);\n    renderWorkspaceInspector(shell);\n    focusActiveWorkspaceSection(shell);`,
    "render inspector refresh"
  );

  source = replaceRequired(
    source,
    `    selectNode(nodeId: string | null): void {\n      selectedNodeId = nodeId;\n    },`,
    `    selectNode(nodeId: string | null): void {\n      selectedNodeId = nodeId;\n      if (workspaceShell !== null && (activeView === "board" || activeView === "desk")) {\n        renderWorkspaceInspector(workspaceShell);\n      }\n    },`,
    "selection inspector refresh"
  );

  await writeRepoFile(path, source);
}

async function updateWorkspaceStyle() {
  const path = "rooms/pattern-room/ui/workspace.css";
  let source = await readRepoFile(path);
  if (source.includes("PERSISTENT INVESTIGATION INSPECTOR")) {
    return;
  }

  source += `

/* ─────────────────────────────────────────
   PERSISTENT INVESTIGATION INSPECTOR
───────────────────────────────────────── */
.pattern-room-workspace-inspector-content {
  display: grid;
  min-width: 0;
  gap: var(--pattern-px-16);
}

.pattern-room-workspace-inspector-content:empty {
  display: none;
}

.pattern-room-investigation-inspector-content {
  display: grid;
  min-width: 0;
  gap: var(--pattern-px-16);
}

.pattern-room-investigation-inspector-section {
  display: grid;
  min-width: 0;
  gap: var(--pattern-px-10);
  padding-top: var(--pattern-px-16);
  border-top: var(--pattern-px-1) solid var(--pattern-accent-amber-alpha-14);
}

.pattern-room-investigation-inspector-section .pattern-room-context-inspector-label {
  margin: 0;
}

.pattern-room-board-workspace-canvas-only,
.pattern-room-connections-canvas-only {
  grid-template-columns: minmax(0, 1fr);
}

.pattern-room-board-workspace-canvas-only .pattern-room-board-canvas,
.pattern-room-connections-canvas-only .pattern-room-desk-surface {
  width: 100%;
}
`;
  await writeRepoFile(path, source);
}

async function updateInstalledUiRegression() {
  const path = "scripts/tests/pattern-room-installed-ui-smoke-regressions-part1.test.ts";
  let source = await readRepoFile(path);
  if (source.includes("moves investigation details and tools into the persistent inspector")) {
    return;
  }

  source += `

void test("pattern-room installed UI moves investigation details and tools into the persistent inspector", async () => {
  const environment = createMinimalForgeUiEnvironment();
  const installedCopy = await createRoomInstalledCopy("pattern-room");

  try {
    await startPatternRoomInstalledUi(installedCopy.rootDir);

    const inspector = environment.app.querySelector(
      "[data-pattern-workspace-inspector='true']"
    );
    const canvas = environment.app.querySelector("[data-pattern-workspace-canvas='true']");
    const boardNavigation = environment.app.querySelector(
      "[data-pattern-workspace-nav='board']"
    );
    assert.ok(inspector);
    assert.ok(canvas);
    assert.ok(boardNavigation);

    fireEvent(boardNavigation, "click");
    const boardPin = environment.app.querySelector(
      "[data-pattern-board-pin='node-navigation-source']"
    );
    assert.ok(boardPin);
    fireEvent(boardPin, "click");

    assert.equal(
      environment.app.querySelector("[data-pattern-workspace-inspector='true']"),
      inspector
    );
    assert.ok(inspector.querySelector("[data-pattern-board-detail='true']"));
    assert.ok(
      inspector.querySelector("[data-pattern-send-to-desk='node-navigation-source']")
    );
    assert.ok(inspector.querySelector("[data-pattern-author-node-form='true']"));
    assert.equal(canvas.querySelector("[data-pattern-board-detail='true']"), null);
    assert.equal(canvas.querySelector("[data-pattern-author-node-form='true']"), null);

    const graphMode = environment.app.querySelector(
      "[data-pattern-investigation-mode='graph']"
    );
    assert.ok(graphMode);
    fireEvent(graphMode, "click");

    assert.equal(
      environment.app.querySelector("[data-pattern-workspace-inspector='true']"),
      inspector
    );
    assert.equal(
      inspector.querySelector("[data-pattern-investigation-inspector-mode='graph']")?.dataset[
        "patternInvestigationInspectorMode"
      ],
      "graph"
    );
    assert.ok(inspector.querySelector("[data-pattern-author-edge-form='true']"));
    assert.equal(canvas.querySelector("[data-pattern-author-edge-form='true']"), null);
    assert.deepEqual(environment.sentCommands, []);
  } finally {
    environment.restore();
    await installedCopy.cleanup();
  }
});
`;
  await writeRepoFile(path, source);
}

async function updateProgress() {
  const path = ".rovo/pattern-room-v2-progress.md";
  let source = await readRepoFile(path);
  if (!source.includes("## Completed: persistent Investigation Inspector ownership")) {
    const marker = "## Next implementation steps";
    source = replaceRequired(
      source,
      marker,
      `## Completed: persistent Investigation Inspector ownership\n\n- Board selections render source, evidence and node details in the shell-level right inspector.\n- Board authoring and graph connection tools now live in the same persistent inspector instead of panel-local sidebars.\n- Switching Board and Graph modes refreshes inspector content without remounting the workspace shell.\n- Center canvas surfaces no longer allocate a second local inspector column.\n- Installed UI regressions verify inspector identity, selection details, authoring tools and graph composer ownership.\n\n${marker}`,
      "persistent inspector progress section"
    );
  }

  source = source.replace(
    `1. Move selection-specific source, node and evidence details into the persistent right context inspector.\n2. Remove the temporary panel-local inspectors after the context inspector owns selection details.`,
    `1. Add explicit edge selection and edge-detail editing to the persistent inspector.\n2. Persist Investigation Canvas presentation state separately from case truth.`
  );
  await writeRepoFile(path, source);
}

await updatePanelFiles();
await updateWorkspaceShell();
await updateRuntime();
await updateWorkspaceStyle();
await updateInstalledUiRegression();
await updateProgress();

if (changedFiles.length === 0) {
  console.log("Pattern Room persistent Investigation Inspector is already current.");
} else {
  console.log(`${apply ? "Applied" : "Would apply"}:`);
  changedFiles.forEach((path) => {
    console.log(`- ${path}`);
  });
}
