import type {
  PatternPanelActions,
  PatternReportItem,
  PatternReportSection,
  PatternRoomWorkspaceModel,
} from "../../shared/types/pattern-room.js";
import {
  createPatternWorkspaceTranslator,
  type PatternWorkspaceTranslator,
} from "../pattern-room-workspace-i18n.js";
import { createElement, createEmptyState, createPanelShell } from "./pattern-panel-utils.js";

const REPORT_META_SEPARATOR = " · ";

type PatternReportPriority = "primary" | "supporting" | "next";

type PatternReportPriorityDefinition = {
  readonly label: string;
  readonly shortLabel: string;
  readonly description: string;
};

const REPORT_PRIORITY_DEFINITIONS: Readonly<
  Record<PatternReportPriority, PatternReportPriorityDefinition>
> = {
  primary: {
    label: "Birincil bulgular",
    shortLabel: "BULGU",
    description: "Kaynak ve kanıt kayıtları; doğrulanabilir başlangıç yüzeyi.",
  },
  supporting: {
    label: "Destekleyici izler",
    shortLabel: "İZ",
    description: "Pano, bağlantı ve karşıt inceleme izleri; bağlam ve karşılaştırma.",
  },
  next: {
    label: "Sonraki çalışma",
    shortLabel: "TAKİP",
    description: "Açık sorular ve araştırmanın bir sonraki hamlesi.",
  },
};

function resolveReportPriority(sectionId: string): PatternReportPriority {
  if (sectionId === "report-source-summary" || sectionId === "report-evidence-notes") {
    return "primary";
  }
  if (sectionId === "report-next-research-notes") {
    return "next";
  }
  return "supporting";
}

function formatReportMetric(value: number, label: string): string {
  return `${String(value)} ${label}`;
}

function formatReportOutlineMetrics(section: PatternReportSection): string {
  return section.metrics
    .map((metric) => formatReportMetric(metric.value, metric.label))
    .join(REPORT_META_SEPARATOR);
}

function createReportMetrics(section: PatternReportSection): HTMLElement {
  const metrics = createElement("div", "pattern-room-casefile-sheet-metrics");
  metrics.dataset["patternReportMetrics"] = section.id;
  section.metrics.forEach((metric) => {
    const item = createElement("span", "pattern-room-casefile-sheet-metric");
    item.dataset["patternReportMetric"] = metric.id;
    item.append(
      createElement("strong", undefined, String(metric.value)),
      createElement("small", undefined, metric.label)
    );
    metrics.append(item);
  });
  return metrics;
}

function createReportItem(item: PatternReportItem, index: number): HTMLElement {
  const entry = createElement("article", "pattern-room-casefile-entry");
  entry.dataset["patternReportItem"] = item.id;
  entry.append(
    createElement("span", "pattern-room-casefile-entry-index", String(index + 1).padStart(2, "0")),
    createElement("h4", undefined, item.label)
  );

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

function createSectionSheet(section: PatternReportSection): HTMLElement {
  const priority = resolveReportPriority(section.id);
  const definition = REPORT_PRIORITY_DEFINITIONS[priority];
  const sheet = createElement(
    "section",
    `pattern-room-casefile-sheet ${priority} ${section.tone}`
  );
  sheet.dataset["patternReportSection"] = section.id;
  sheet.dataset["patternCasefilePriority"] = priority;
  sheet.tabIndex = -1;

  const masthead = createElement("header", "pattern-room-casefile-sheet-header");
  const heading = createElement("div", "pattern-room-casefile-sheet-heading");
  heading.append(
    createElement("span", "pattern-room-casefile-priority-stamp", definition.shortLabel),
    createElement("span", "pattern-room-list-eyebrow", definition.label),
    createElement("h2", undefined, section.label),
    createElement("p", undefined, section.note)
  );
  masthead.append(heading, createReportMetrics(section));
  sheet.append(masthead);

  if (section.items.length === 0) {
    const empty = createElement("div", "pattern-room-casefile-empty");
    empty.append(
      createElement("span", "pattern-room-kicker", "Kayıt yok"),
      createEmptyState(section.emptyMessage, "complete-empty", { compact: true })
    );
    sheet.append(empty);
    return sheet;
  }

  const items = createElement("div", "pattern-room-casefile-entries");
  section.items.forEach((item, index) => {
    items.append(createReportItem(item, index));
  });
  sheet.append(items);
  return sheet;
}

function createReportInspectorSummary(data: PatternRoomWorkspaceModel): HTMLElement {
  const sections = data.reportSummary.sections;
  const itemCount = sections.reduce((count, section) => count + section.items.length, 0);
  const populatedSectionCount = sections.filter((section) => section.items.length > 0).length;
  const summary = createElement("section", "pattern-room-report-inspector-summary");
  summary.dataset["patternReportSummary"] = "true";

  const status = createElement("div", "pattern-room-report-inspector-status");
  status.append(
    createElement("span", "pattern-room-report-status-chip", "Taslak"),
    createElement("span", "pattern-room-report-status-chip secondary", "Yerel iz"),
    createElement("span", "pattern-room-report-status-chip secondary", "Salt okunur")
  );

  const metrics = createElement("div", "pattern-room-report-inspector-metrics");
  const metricValues: ReadonlyArray<readonly [string, number]> = [
    ["Bölüm", sections.length],
    ["Dolu", populatedSectionCount],
    ["Kayıt", itemCount],
  ];
  metricValues.forEach(([label, value]) => {
    const metric = createElement("div", "pattern-room-report-inspector-metric");
    metric.append(
      createElement("span", undefined, label),
      createElement("strong", undefined, String(value))
    );
    metrics.append(metric);
  });

  summary.append(
    status,
    createElement("h2", undefined, data.reportSummary.label),
    metrics,
    createElement(
      "p",
      "pattern-room-report-inspector-disclaimer",
      "Bu dosya yerel araştırma izlerini düzenler; doğrulanmış vaka gerçeği üretmez."
    )
  );
  return summary;
}

function createPriorityStrip(data: PatternRoomWorkspaceModel): HTMLElement {
  const strip = createElement("div", "pattern-room-casefile-priority-strip");
  (["primary", "supporting", "next"] as const).forEach((priority) => {
    const sections = data.reportSummary.sections.filter(
      (section) => resolveReportPriority(section.id) === priority
    );
    const itemCount = sections.reduce((count, section) => count + section.items.length, 0);
    const definition = REPORT_PRIORITY_DEFINITIONS[priority];
    const card = createElement("span", `pattern-room-casefile-priority ${priority}`);
    card.append(
      createElement("small", undefined, definition.shortLabel),
      createElement("strong", undefined, String(itemCount)),
      createElement("span", undefined, definition.label)
    );
    strip.append(card);
  });
  return strip;
}

function createFolioButton(section: PatternReportSection, index: number): HTMLButtonElement {
  const button = createElement("button", "pattern-room-casefile-tab");
  button.type = "button";
  button.dataset["patternReportJump"] = section.id;
  button.dataset["patternCasefileTab"] = section.id;
  button.append(
    createElement("span", "pattern-room-casefile-tab-index", String(index + 1).padStart(2, "0")),
    createElement("strong", undefined, section.label),
    createElement("small", undefined, formatReportOutlineMetrics(section))
  );
  return button;
}

export function createReportPanel(
  data: PatternRoomWorkspaceModel,
  _actions: PatternPanelActions,
  onBack: () => void,
  text: PatternWorkspaceTranslator = createPatternWorkspaceTranslator("tr", null)
): HTMLElement {
  const shell = createPanelShell("report", text("nav.report.label"), onBack);
  shell.classList.add("pattern-room-report-panel", "pattern-room-casefile-panel");

  const workspace = createElement("div", "pattern-room-report-workspace pattern-room-casefile-workspace");
  const outline = createElement("aside", "pattern-room-report-outline");
  outline.dataset["patternReportOutline"] = "true";
  outline.ariaLabel = text("report.outlineLabel");
  outline.append(
    createReportInspectorSummary(data),
    createElement("span", "pattern-room-context-inspector-label", "Dosya durumu")
  );

  const report = createElement("article", "pattern-room-report pattern-room-casefile-document");
  report.dataset["patternReportDocument"] = "true";
  report.ariaLabel = text("report.documentLabel");

  const cover = createElement("header", "pattern-room-casefile-cover");
  const coverCopy = createElement("div", "pattern-room-casefile-cover-copy");
  coverCopy.append(
    createElement("span", "pattern-room-kicker", "Vaka dosyası / yerel çalışma"),
    createElement("h2", undefined, data.reportSummary.label),
    createElement(
      "p",
      undefined,
      "Kaynak, kanıt, pano ve karşıt inceleme izlerini tek dosyada sırala; her folioyu ayrı incele."
    )
  );
  const coverStamp = createElement("div", "pattern-room-casefile-cover-stamp");
  coverStamp.append(
    createElement("span", undefined, "CASE FILE"),
    createElement("strong", undefined, data.subject),
    createElement("small", undefined, `${String(data.reportSummary.sections.length)} FOLIO`)
  );
  cover.append(coverCopy, coverStamp, createPriorityStrip(data));

  const body = createElement("div", "pattern-room-casefile-body");
  const folioNavigation = createElement("nav", "pattern-room-casefile-tabs");
  folioNavigation.ariaLabel = "Vaka dosyası bölümleri";
  const sheetStack = createElement("div", "pattern-room-casefile-sheet-stack");
  const tabButtons = new Map<string, HTMLButtonElement>();
  const sheets = new Map<string, HTMLElement>();

  const activateSection = (sectionId: string): void => {
    tabButtons.forEach((button, id) => {
      const active = id === sectionId;
      button.classList.toggle("active", active);
      button.ariaCurrent = active ? "page" : null;
      button.ariaPressed = active ? "true" : "false";
      button.tabIndex = active ? 0 : -1;
    });
    sheets.forEach((sheet, id) => {
      const active = id === sectionId;
      sheet.hidden = !active;
      sheet.dataset["patternCasefileSheetActive"] = active ? "true" : "false";
    });
  };

  data.reportSummary.sections.forEach((section, index) => {
    const button = createFolioButton(section, index);
    button.ariaLabel = text("report.jumpLabel", { section: section.label });
    button.addEventListener("click", () => {
      activateSection(section.id);
      sheets.get(section.id)?.focus();
    });
    const sheet = createSectionSheet(section);
    tabButtons.set(section.id, button);
    sheets.set(section.id, sheet);
    folioNavigation.append(button);
    sheetStack.append(sheet);
  });

  body.append(folioNavigation, sheetStack);
  report.append(cover, body);
  workspace.append(outline, report);
  shell.append(workspace);

  const firstSection = data.reportSummary.sections[0];
  if (firstSection !== undefined) {
    activateSection(firstSection.id);
  }
  return shell;
}
