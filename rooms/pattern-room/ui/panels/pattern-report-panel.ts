import type { PatternRoomMockData } from "../../shared/types/pattern-room.js";
import { createElement, createPanelShell } from "./pattern-panel-utils.js";

export function createReportPanel(data: PatternRoomMockData, onBack: () => void): HTMLElement {
  const shell = createPanelShell("report", "Rapor", onBack);
  const report = createElement("article", "pattern-room-report");
  report.append(
    createElement("span", "pattern-room-kicker", "Rapor / İz Kaydı"),
    createElement("h2", undefined, data.reportSummary.label),
    createElement(
      "p",
      undefined,
      `${data.reportSummary.status} rapor; yalnızca yerel izleri özetler.`
    )
  );

  const list = createElement("div", "pattern-room-report-list");
  data.reportSummary.sections.forEach((section) => {
    const item = createElement("section", `pattern-room-report-card ${section.tone}`);
    const bullets = createElement("ul", "pattern-room-report-bullets");
    section.bullets.forEach((bullet) => {
      bullets.append(createElement("li", undefined, bullet));
    });
    item.append(
      createElement("span", "pattern-room-list-eyebrow", "Rapor bölümü"),
      createElement("h3", undefined, section.label),
      createElement("p", undefined, section.note),
      bullets
    );
    list.append(item);
  });
  report.append(list);
  shell.append(report);
  return shell;
}
