import type {
  PatternBoardPin,
  PatternConnectionOption,
  PatternPanelActions,
  PatternRoomMockData,
} from "../../shared/types/pattern-room.js";
import { createActionButton, createElement, createPanelShell } from "./pattern-panel-utils.js";

type AuthoredBoardNodeType = "claim" | "inspiration" | "uncertainty";
type AuthoredConnectionEdgeType = Parameters<PatternPanelActions["addAuthoredEdge"]>[0];

const CONNECTION_EDGE_TYPE_OPTIONS: Array<{
  value: AuthoredConnectionEdgeType;
  label: string;
}> = [
  { value: "supports", label: "destekliyor" },
  { value: "contradicts", label: "çelişiyor" },
  { value: "references", label: "referans veriyor" },
  { value: "derived_from", label: "türetildi" },
  { value: "inspired_by", label: "ilham aldı" },
  { value: "questions", label: "sorguluyor" },
  { value: "needs_review", label: "inceleme gerekiyor" },
];

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

function createConnectionEntityOption(optionValue: PatternConnectionOption): HTMLOptionElement {
  const kindLabel =
    optionValue.kind === "evidence" ? "Kanıt" : optionValue.kind === "source" ? "Kaynak" : "Öğe";
  const scopeLabel = optionValue.isLocal ? "Yerel" : "Domain";
  const option = createElement(
    "option",
    undefined,
    `${scopeLabel} ${kindLabel}: ${optionValue.label}`
  );
  option.value = optionValue.id;
  return option;
}

function createEdgeTypeOption(value: AuthoredConnectionEdgeType, label: string): HTMLOptionElement {
  const option = createElement("option", undefined, label);
  option.value = value;
  return option;
}

function resetConnectionFormDefaults(
  sourceSelect: HTMLSelectElement,
  edgeTypeSelect: HTMLSelectElement,
  targetSelect: HTMLSelectElement,
  connectionOptions: readonly PatternConnectionOption[]
): void {
  sourceSelect.value = connectionOptions[0]?.id ?? "";
  edgeTypeSelect.value = "supports";
  targetSelect.value = connectionOptions[1]?.id ?? connectionOptions[0]?.id ?? "";
}

function createConnectionAuthoringForm(
  actions: PatternPanelActions,
  connectionOptions: readonly PatternConnectionOption[]
): HTMLFormElement {
  const connectionForm = createElement("form", "pattern-room-inline-form");
  connectionForm.dataset["patternAuthorEdgeForm"] = "true";

  const sourceSelect = createElement("select", "pattern-room-inline-input");
  sourceSelect.name = "sourceId";
  sourceSelect.dataset["patternAuthorEdgeSource"] = "true";
  sourceSelect.append(...connectionOptions.map(createConnectionEntityOption));

  const edgeTypeSelect = createElement("select", "pattern-room-inline-input");
  edgeTypeSelect.name = "edgeType";
  edgeTypeSelect.dataset["patternAuthorEdgeType"] = "true";
  edgeTypeSelect.append(
    ...CONNECTION_EDGE_TYPE_OPTIONS.map((option) => {
      return createEdgeTypeOption(option.value, option.label);
    })
  );

  const targetSelect = createElement("select", "pattern-room-inline-input");
  targetSelect.name = "targetId";
  targetSelect.dataset["patternAuthorEdgeTarget"] = "true";
  targetSelect.append(...connectionOptions.map(createConnectionEntityOption));

  const note = createTextInput("note", "Not (opsiyonel)");
  note.dataset["patternAuthorEdgeNote"] = "true";

  const submit = createSubmitButton("Bağla");
  const hasEnoughOptions = connectionOptions.length >= 2;
  sourceSelect.disabled = !hasEnoughOptions;
  edgeTypeSelect.disabled = !hasEnoughOptions;
  targetSelect.disabled = !hasEnoughOptions;
  note.disabled = !hasEnoughOptions;
  submit.disabled = !hasEnoughOptions;
  resetConnectionFormDefaults(sourceSelect, edgeTypeSelect, targetSelect, connectionOptions);

  connectionForm.addEventListener("submit", (event) => {
    event.preventDefault();
    if (
      sourceSelect.value === "" ||
      targetSelect.value === "" ||
      sourceSelect.value === targetSelect.value
    ) {
      return;
    }

    actions.addAuthoredEdge(
      edgeTypeSelect.value as AuthoredConnectionEdgeType,
      sourceSelect.value,
      targetSelect.value,
      note.value
    );
    connectionForm.reset();
    resetConnectionFormDefaults(sourceSelect, edgeTypeSelect, targetSelect, connectionOptions);
  });

  connectionForm.append(
    createElement(
      "p",
      "pattern-room-inline-note",
      "Bağlantılar Rapor panelinde Yerel Bağlantılar bölümünde listelenir."
    ),
    sourceSelect,
    edgeTypeSelect,
    targetSelect,
    note,
    submit
  );
  return connectionForm;
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
  shell.append(createBoardAuthoringPanel(actions, data.connectionOptions), boardScene);
  return shell;
}
