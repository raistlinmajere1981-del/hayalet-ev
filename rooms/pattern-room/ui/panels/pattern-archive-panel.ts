import type { PatternPanelActions, PatternRoomMockData } from "../../shared/types/pattern-room.js";
import { createActionButton, createElement, createPanelShell } from "./pattern-panel-utils.js";

function sourceTypeClass(sourceTypeLabel: string): string {
  if (sourceTypeLabel === "Kitap / Metin") {
    return "text-source";
  }
  if (sourceTypeLabel === "Görsel kaynak") {
    return "visual-source";
  }
  if (sourceTypeLabel === "Masa çıktısı") {
    return "table-output";
  }
  return "uncertain-source";
}

export function createArchivePanel(
  data: PatternRoomMockData,
  actions: PatternPanelActions,
  onBack: () => void
): HTMLElement {
  const shell = createPanelShell("archive", "Arşiv", onBack);
  const list = createElement("div", "pattern-room-archive-list");

  data.sources.forEach((source) => {
    const toneClass = sourceTypeClass(source.sourceTypeLabel);
    const card = createElement("article", `pattern-room-archive-card ${toneClass}`);
    const drawer = createElement("span", "pattern-room-archive-drawer", source.origin);
    const tag = createElement(
      "span",
      `pattern-room-source-tag ${toneClass}`,
      source.sourceTypeLabel
    );
    const actionsRow = createElement("div", "pattern-room-action-row");
    const pinButton = createActionButton("Panoya İliştir", () => {
      actions.pinSourceToBoard(source.id, "evidence");
    });
    pinButton.dataset["patternPinSource"] = source.id;

    const debateButton = createActionButton("10. Adam’a Ekle", () => {
      actions.addSourceToDebate(source.id);
    });
    debateButton.dataset["patternAddSourceDebate"] = source.id;
    actionsRow.append(pinButton, debateButton);

    card.append(
      drawer,
      tag,
      createElement("h3", undefined, source.label),
      createElement("p", undefined, source.note),
      createElement("small", undefined, source.status),
      actionsRow
    );
    list.append(card);
  });

  shell.append(list);
  return shell;
}
