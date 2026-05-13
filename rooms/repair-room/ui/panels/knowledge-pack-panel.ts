import type { RepairUiState } from "../../shared/ui/state.js";
import { resolveRepairAssetUrl } from "../repair-asset-url.js";
import { createRepairPanel } from "./panel-shell.js";

type TextFn = (path: string[], fallback: string) => string;

export function renderKnowledgePackPanel(
  documentRef: Document,
  state: RepairUiState,
  text: TextFn
): HTMLElement {
  const body = documentRef.createElement("div");
  body.className = "repair-panel__body";

  const kp = state.knowledgePack;

  if (kp.pack === null) {
    const empty = documentRef.createElement("div");
    empty.className = "repair-empty-state";
    empty.textContent = text(["knowledgePack", "empty"], "No knowledge pack attached");
    body.append(empty);

    return createRepairPanel(documentRef, {
      panelId: "knowledge-pack",
      eyebrow: text(["knowledgePack", "eyebrow"], "KNOWLEDGE"),
      title: text(["knowledgePack", "title"], "Knowledge Pack"),
      statusDot: "idle",
      collapsed: state.layout.collapsedPanels["knowledge-pack"],
      pinned: state.layout.pinnedPanels["knowledge-pack"],
      body,
    });
  }

  const pack = kp.pack;

  // -- Header
  const header = documentRef.createElement("div");
  header.className = "repair-pack-header";

  const model = documentRef.createElement("div");
  model.className = "repair-pack-header__model";
  model.textContent = pack.modelNumber;
  header.append(model);

  const device = documentRef.createElement("div");
  device.className = "repair-pack-header__device";
  device.textContent = pack.deviceLabel;
  header.append(device);

  body.append(header);

  // -- Stats
  const stats = documentRef.createElement("div");
  stats.className = "repair-pack-stats";

  const statEntries: Array<[string, number]> = [
    [text(["knowledgePack", "schematics"], "Schematics"), pack.stats.schematics],
    [text(["knowledgePack", "boardImages"], "Board Images"), pack.stats.boardImages],
    [text(["knowledgePack", "commonFailures"], "Common Failures"), pack.stats.commonFailures],
    [text(["knowledgePack", "repairNotes"], "Repair Notes"), pack.stats.repairNotes],
    [text(["knowledgePack", "testPoints"], "Test Points"), pack.stats.testPoints],
  ];

  for (const [label, value] of statEntries) {
    const row = documentRef.createElement("div");
    row.className = "repair-pack-stat";

    const labelEl = documentRef.createElement("span");
    labelEl.textContent = label;
    row.append(labelEl);

    const valueEl = documentRef.createElement("span");
    valueEl.className = "repair-pack-stat__value";
    valueEl.textContent = String(value);
    row.append(valueEl);

    stats.append(row);
  }

  body.append(stats);

  const tabs = documentRef.createElement("div");
  tabs.className = "repair-tabs";
  tabs.style.marginTop = "8px";

  const tabItems = [
    {
      id: "schematic-preview",
      label: text(["knowledgePack", "tabSchematic"], "Schematic Preview"),
    },
    { id: "board-view", label: text(["knowledgePack", "tabBoard"], "Board View") },
    { id: "notes", label: text(["knowledgePack", "tabNotes"], "Notes") },
  ];

  for (const tab of tabItems) {
    const tabEl = documentRef.createElement("div");
    tabEl.className = `repair-tab${kp.previewTabId === tab.id ? " repair-tab--active" : ""}`;
    tabEl.textContent = tab.label;
    tabEl.dataset["repairAction"] = "knowledge-pack-tab";
    tabEl.dataset["tabId"] = tab.id;
    tabs.append(tabEl);
  }

  body.append(tabs);

  const preview = documentRef.createElement("div");
  preview.className = "repair-pack-preview";
  if (kp.previewTabId === "schematic-preview") {
    const resources = pack.resources
      .filter((resource) => resource.kind === "schematic" || resource.kind === "datasheet")
      .slice(0, 3);
    appendPreviewImage(
      documentRef,
      preview,
      resources[0]?.src ?? null,
      resources[0]?.label ?? "Schematic preview"
    );
    resources.forEach((resource) => {
      const row = documentRef.createElement("div");
      row.className = "repair-pack-preview__row";
      row.textContent = `${resource.label} • ${Math.round(resource.confidence * 100)}%`;
      preview.append(row);
    });
  } else if (kp.previewTabId === "board-view") {
    const resources = pack.resources
      .filter((resource) => resource.kind === "board-image")
      .slice(0, 4);
    appendPreviewImage(
      documentRef,
      preview,
      resources[0]?.src ?? null,
      resources[0]?.label ?? "Board preview"
    );
    resources.forEach((resource) => {
      const row = documentRef.createElement("div");
      row.className = "repair-pack-preview__row";
      row.textContent = `${resource.label} • ${resource.source}`;
      preview.append(row);
    });
  } else {
    pack.notes.slice(0, 4).forEach((note) => {
      const row = documentRef.createElement("div");
      row.className = "repair-pack-preview__row";
      row.textContent = note;
      preview.append(row);
    });
  }
  body.append(preview);

  const spatialList = documentRef.createElement("div");
  spatialList.className = "repair-knowledge-spatial-list";
  pack.commonFailures.slice(0, 3).forEach((failure) => {
    if (failure.spatialRef === null || failure.spatialRef === undefined) return;
    const card = documentRef.createElement("button");
    card.className = `repair-knowledge-spatial${
      kp.focusedSpatialRefId === failure.id ? " repair-knowledge-spatial--active" : ""
    }`;
    card.type = "button";
    card.dataset["repairAction"] = "knowledge-spatial-focus";
    card.dataset["spatialRefId"] = failure.id;
    card.textContent = failure.label;
    spatialList.append(card);
  });
  pack.testPoints.slice(0, 4).forEach((point) => {
    const card = documentRef.createElement("button");
    card.className = `repair-knowledge-spatial${
      kp.focusedSpatialRefId === point.id ? " repair-knowledge-spatial--active" : ""
    }`;
    card.type = "button";
    card.dataset["repairAction"] = "knowledge-spatial-focus";
    card.dataset["spatialRefId"] = point.id;
    card.textContent = `${point.label} • ${point.expectedValue}${point.unit}`;
    spatialList.append(card);
  });
  if (kp.focusedSpatialRefId !== null) {
    const promote = documentRef.createElement("button");
    promote.className = "repair-knowledge-spatial repair-knowledge-spatial--promote";
    promote.type = "button";
    promote.dataset["repairAction"] = "knowledge-spatial-promote";
    promote.dataset["spatialRefId"] = kp.focusedSpatialRefId;
    promote.textContent = "Promote focused region";
    spatialList.append(promote);
  }
  body.append(spatialList);

  // -- CTA
  if (kp.attachedToSessionId === null) {
    const cta = documentRef.createElement("button");
    cta.className = "repair-cta-btn";
    cta.textContent = text(["knowledgePack", "addToSession"], "Add to Session");
    cta.dataset["repairAction"] = "attach-knowledge-pack";
    cta.dataset["packId"] = pack.id;
    body.append(cta);
  }

  return createRepairPanel(documentRef, {
    panelId: "knowledge-pack",
    eyebrow: text(["knowledgePack", "eyebrow"], "KNOWLEDGE"),
    title: text(["knowledgePack", "title"], "Knowledge Pack"),
    statusDot: kp.attachedToSessionId !== null ? "live" : "idle",
    collapsed: state.layout.collapsedPanels["knowledge-pack"],
    pinned: state.layout.pinnedPanels["knowledge-pack"],
    body,
  });
}

function appendPreviewImage(
  documentRef: Document,
  preview: HTMLElement,
  src: string | null,
  alt: string
): void {
  if (src === null) return;
  const image = documentRef.createElement("img");
  image.className = "repair-pack-preview__image";
  image.src = resolveRepairAssetUrl(src) ?? src;
  image.alt = alt;
  preview.append(image);
}
