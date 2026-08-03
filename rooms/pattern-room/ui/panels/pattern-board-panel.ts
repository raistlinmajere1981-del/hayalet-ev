import type {
  PatternBoardPin,
  PatternConnectionOption,
  PatternPanelActions,
  PatternRoomMockData,
} from "../../shared/types/pattern-room.js";
import {
  createPatternWorkspaceTranslator,
  type PatternWorkspaceTranslator,
} from "../pattern-room-workspace-i18n.js";
import { createConnectionAuthoringForm } from "./pattern-connection-composer.js";
import { createActionButton, createElement, createPanelShell } from "./pattern-panel-utils.js";

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

function findBoardPin(data: PatternRoomMockData, pinId: string | null): PatternBoardPin | null {
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

function renderSelectedPinDetail(
  detail: HTMLElement,
  data: PatternRoomMockData,
  actions: PatternPanelActions,
  pinId: string | null
): void {
  const selectedPin = findBoardPin(data, pinId);
  if (selectedPin === null) {
    detail.replaceChildren(
      createElement("span", "pattern-room-kicker", "Pano detayı"),
      createElement("h2", undefined, "Bir pano pini seç"),
      createElement("p", undefined, "Seçilen pinin katman, güven ve kaynak bilgisi burada görünür.")
    );
    return;
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

  const originCopy =
    selectedPin.origin === null ? "Kaynak origin bilgisi yok." : selectedPin.origin;
  detail.replaceChildren(
    createElement("span", "pattern-room-kicker", "Pano detayı"),
    createElement("h2", undefined, selectedPin.label),
    metrics,
    createElement("p", undefined, selectedPin.content),
    createElement("small", undefined, originCopy),
    actionsRow
  );
}

export function createBoardPanel(
  data: PatternRoomMockData,
  actions: PatternPanelActions,
  onBack: () => void,
  text: PatternWorkspaceTranslator = createPatternWorkspaceTranslator("tr", null)
): HTMLElement {
  const shell = createPanelShell("board", text("nav.board.label"), onBack);
  const workspace = createElement("div", "pattern-room-board-workspace");
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
  const inspector = createElement(
    "aside",
    "pattern-room-context-inspector pattern-room-board-inspector"
  );
  inspector.ariaLabel = text("board.inspectorLabel");
  const inspectorHeader = createElement(
    "span",
    "pattern-room-context-inspector-label",
    text("board.inspectorLabel")
  );
  const detail = createElement("section", "pattern-room-board-detail");
  detail.ariaLive = "polite";
  const pinButtons: HTMLButtonElement[] = [];

  function markSelectedPin(pinId: string | null): void {
    pinButtons.forEach((button) => {
      const isSelected = button.dataset["patternBoardPin"] === pinId;
      button.dataset["patternBoardPinSelected"] = isSelected ? "true" : "false";
      button.ariaPressed = isSelected ? "true" : "false";
      if (isSelected) {
        button.classList.add("selected");
        return;
      }
      button.classList.remove("selected");
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
        renderSelectedPinDetail(detail, data, actions, pinItem.id);
      });
      pinButtons.push(pin);
      pinList.append(pin);
    });

    lane.append(laneHeader, pinList);
    grid.append(lane);
  });

  const selectedPinId = actions.getSelectedNodeId();
  markSelectedPin(selectedPinId);
  renderSelectedPinDetail(detail, data, actions, selectedPinId);
  boardScene.append(grid);
  canvas.append(canvasHeader, boardScene);

  const tools = createElement("section", "pattern-room-board-inspector-tools");
  tools.append(
    createElement("span", "pattern-room-context-inspector-label", text("board.toolsLabel")),
    createBoardAuthoringPanel(actions, data.connectionOptions)
  );
  inspector.append(inspectorHeader, detail, tools);
  workspace.append(canvas, inspector);
  shell.append(workspace);
  return shell;
}
