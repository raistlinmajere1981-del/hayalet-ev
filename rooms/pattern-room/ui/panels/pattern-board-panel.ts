import type {
  PatternBoardPin,
  PatternPanelActions,
  PatternRoomMockData,
} from "../../shared/types/pattern-room.js";
import { createActionButton, createElement, createPanelShell } from "./pattern-panel-utils.js";

type AuthoredBoardNodeType = "claim" | "inspiration" | "uncertainty";

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

function createNodeTypeOption(value: AuthoredBoardNodeType, label: string): HTMLOptionElement {
  const option = createElement("option", undefined, label);
  option.value = value;
  return option;
}

function createBoardAuthoringPanel(actions: PatternPanelActions): HTMLElement {
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

  nodeForm.append(
    createElement("h2", undefined, "Yeni Öğe Ekle"),
    nodeType,
    nodeLabel,
    nodeContent,
    createSubmitButton("Ekle")
  );

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

  evidenceForm.append(
    createElement("h2", undefined, "Kanıt Notu Ekle"),
    evidenceLabel,
    excerpt,
    interpretation,
    createSubmitButton("Ekle")
  );

  authoring.append(nodeForm, evidenceForm);
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
  onBack: () => void
): HTMLElement {
  const shell = createPanelShell("board", "Dedektif Panosu", onBack);
  const boardScene = createElement("div", "pattern-room-board-scene");
  const grid = createElement("div", "pattern-room-board-grid");
  const detail = createElement("aside", "pattern-room-board-detail");
  const pinButtons: HTMLButtonElement[] = [];

  function markSelectedPin(pinId: string | null): void {
    pinButtons.forEach((button) => {
      const isSelected = button.dataset["patternBoardPin"] === pinId;
      button.dataset["patternBoardPinSelected"] = isSelected ? "true" : "false";
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
      createElement("h2", undefined, category.label),
      createElement("p", undefined, category.summary)
    );

    const pinList = createElement("div", "pattern-room-board-pins");
    category.pins.forEach((pinItem) => {
      const pin = createElement(
        "button",
        `pattern-room-board-node ${category.tone}`,
        pinItem.label
      );
      pin.type = "button";
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
  boardScene.append(grid, detail);
  shell.append(createBoardAuthoringPanel(actions), boardScene);
  return shell;
}
