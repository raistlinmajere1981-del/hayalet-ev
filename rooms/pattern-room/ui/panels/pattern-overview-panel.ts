import type { PatternRoomMockData, PatternViewId } from "../../shared/types/pattern-room.js";
import { createElement, createMetric } from "./pattern-panel-utils.js";

const HOTSPOTS: Array<{
  id: Exclude<PatternViewId, "overview">;
  label: string;
  meta: string;
  iconClass: string;
}> = [
  { id: "board", label: "Dedektif Panosu", meta: "4 kategori", iconClass: "board" },
  { id: "desk", label: "Holografik Masa", meta: "İddia yüzeyi", iconClass: "desk" },
  { id: "archive", label: "Arşiv Dolabı", meta: "Kaynak türleri", iconClass: "archive" },
  { id: "tenth-man", label: "10. Adam Cihazı", meta: "Rol slotları", iconClass: "tenth-man" },
  { id: "report", label: "Rapor Terminali", meta: "Temkinli not", iconClass: "report" },
];

export function createOverviewPanel(
  data: PatternRoomMockData,
  onOpenView: (viewId: Exclude<PatternViewId, "overview">) => void
): HTMLElement {
  const shell = createElement("section", "pattern-room-overview");
  shell.dataset["patternView"] = "overview";

  const header = createElement("header", "pattern-room-overview-header");
  const titleWrap = createElement("div", "pattern-room-title-block");
  titleWrap.append(createElement("span", "pattern-room-kicker", data.roomLabel));
  titleWrap.append(createElement("h1", undefined, data.roomTitle));
  titleWrap.append(createElement("p", undefined, data.roomSummary));
  const metrics = createElement("div", "pattern-room-metrics");
  metrics.append(
    createMetric("Kategori", String(data.boardCategories.length)),
    createMetric("Kaynak", String(data.sources.length)),
    createMetric("Rol", String(data.tenthManSession.roles.length))
  );
  header.append(titleWrap, metrics);

  const stage = createElement("div", "pattern-room-office");
  stage.append(createElement("div", "pattern-room-office-wall"));

  const board = createElement("div", "pattern-room-office-board");
  board.append(createElement("span", "pattern-room-object-label", "Pano"));
  data.boardCategories.forEach((category) => {
    const pin = createElement("span", `pattern-room-pin ${category.tone}`, category.label);
    board.append(pin);
  });

  const table = createElement("div", "pattern-room-holo-table");
  table.append(
    createElement("span", "pattern-room-object-label", "Masa"),
    createElement("strong", undefined, data.subject)
  );

  const archive = createElement("div", "pattern-room-archive-cabinet");
  archive.append(createElement("span", "pattern-room-object-label", "Arşiv"));

  const tenthManDevice = createElement("div", "pattern-room-tenth-device");
  tenthManDevice.append(
    createElement("span", "pattern-room-object-label", "10. Adam"),
    createElement("i")
  );

  const reportTerminal = createElement("div", "pattern-room-report-terminal");
  reportTerminal.append(
    createElement("span", "pattern-room-object-label", "Rapor"),
    createElement("i")
  );

  const hotspotLayer = createElement("div", "pattern-room-hotspots");
  HOTSPOTS.forEach((hotspot) => {
    const button = createElement("button", `pattern-room-hotspot ${hotspot.id}`);
    button.type = "button";
    button.dataset["patternHotspot"] = hotspot.id;
    button.ariaLabel = hotspot.label;
    const textWrap = createElement("span", "pattern-room-hotspot-copy");
    textWrap.append(
      createElement("strong", undefined, hotspot.label),
      createElement("span", undefined, hotspot.meta)
    );
    button.append(createElement("span", `pattern-room-object-icon ${hotspot.iconClass}`), textWrap);
    button.addEventListener("click", () => {
      onOpenView(hotspot.id);
    });
    hotspotLayer.append(button);
  });

  stage.append(board, archive, table, tenthManDevice, reportTerminal, hotspotLayer);
  shell.append(header, stage);
  return shell;
}
