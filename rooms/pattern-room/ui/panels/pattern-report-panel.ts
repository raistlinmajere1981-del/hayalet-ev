import type {
  PatternPanelActions,
  PatternReportItem,
  PatternReportSection,
  PatternRoomMockData,
} from "../../shared/types/pattern-room.js";
import { createElement, createPanelShell } from "./pattern-panel-utils.js";

const REPORT_META_SEPARATOR = " · ";

function createReportItem(item: PatternReportItem): HTMLElement {
  const entry = createElement("article", "pattern-room-report-entry");
  entry.dataset["patternReportItem"] = item.id;
  entry.append(createElement("h4", undefined, item.label));

  if (item.meta.length > 0) {
    entry.append(
      createElement("small", "pattern-room-report-meta", item.meta.join(REPORT_META_SEPARATOR))
    );
  }

  entry.append(createElement("p", "pattern-room-report-preview", item.body));

  if (item.detail !== null) {
    entry.append(createElement("p", "pattern-room-report-detail", item.detail));
  }

  return entry;
}

function appendReportSectionContent(card: HTMLElement, section: PatternReportSection): void {
  if (section.items.length === 0) {
    card.append(createElement("p", "pattern-room-empty-state", section.emptyMessage));
    return;
  }

  const items = createElement("div", "pattern-room-report-items");
  section.items.forEach((item) => {
    items.append(createReportItem(item));
  });
  card.append(items);
}

export function createReportPanel(
  data: PatternRoomMockData,
  _actions: PatternPanelActions,
  onBack: () => void
): HTMLElement {
  const shell = createPanelShell("report", "Rapor", onBack);
  const report = createElement("article", "pattern-room-report");
  report.append(
    createElement("span", "pattern-room-kicker", "Taslak / Yerel iz"),
    createElement("h2", undefined, data.reportSummary.label),
    createElement(
      "p",
      undefined,
      "Taslak rapor; kullanıcı tarafından eklenen ve henüz doğrulanmamış yerel izlerden deterministik görünüm hazırlar."
    )
  );

  const list = createElement("div", "pattern-room-report-list");
  data.reportSummary.sections.forEach((section) => {
    const item = createElement("section", `pattern-room-report-card ${section.tone}`);
    item.dataset["patternReportSection"] = section.id;
    item.append(
      createElement("span", "pattern-room-list-eyebrow", "Taslak bölümü"),
      createElement("h3", undefined, section.label),
      createElement("p", undefined, section.note)
    );
    appendReportSectionContent(item, section);
    list.append(item);
  });
  report.append(list);
  shell.append(report);
  return shell;
}
