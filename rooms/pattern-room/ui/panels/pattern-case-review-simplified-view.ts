import type { PatternRoomCaseReviewSectionKey } from "../../shared/types/pattern-room-case-review-result.js";
import {
  createPatternCaseReviewRuntimeView,
  type PatternCaseReviewRuntimePanelState,
} from "./pattern-case-review-runtime-view.js";
import { createElement } from "./pattern-panel-utils.js";

export type PatternCaseReviewSimplifiedViewOptions = {
  readonly onHistoryFocus?: () => void;
};

type PatternCaseReviewResultGroup = "evaluation" | "gaps" | "confidence";
type PatternCaseReviewWorkbenchPanel = "apply" | "candidates" | "raw-response" | "history";

const RESULT_GROUP_BY_SECTION: Readonly<
  Record<PatternRoomCaseReviewSectionKey, PatternCaseReviewResultGroup>
> = {
  observation: "evaluation",
  evidence: "evaluation",
  analysis: "evaluation",
  counterArgument: "evaluation",
  missingInformation: "gaps",
  openQuestions: "gaps",
  confidenceNotes: "confidence",
};

const RESULT_GROUP_LABELS: Readonly<Record<PatternCaseReviewResultGroup, string>> = {
  evaluation: "Ana değerlendirme",
  gaps: "Eksikler ve açık sorular",
  confidence: "Güven ve teknik notlar",
};

const WORKBENCH_PANEL_LABELS: Readonly<Record<PatternCaseReviewWorkbenchPanel, string>> = {
  apply: "Uygulama",
  candidates: "Kanıt tepsisi",
  "raw-response": "Ham yanıt",
  history: "Geçmiş",
};

function findResultMeta(result: HTMLElement): HTMLElement | null {
  const selectors = [
    "[data-pattern-case-review-confidence='true']",
    "[data-pattern-case-review-missing-evidence='true']",
    "[data-pattern-case-review-open-questions='true']",
    "[data-pattern-case-review-suggested-connections='true']",
    "[data-pattern-case-review-warnings='true']",
  ];
  for (const selector of selectors) {
    const item = result.querySelector<HTMLElement>(selector);
    if (item?.parentElement !== null && item?.parentElement !== undefined) {
      return item.parentElement;
    }
  }
  return null;
}

function createResultGroup(
  group: PatternCaseReviewResultGroup,
  body: HTMLElement
): HTMLElement | null {
  if (body.children.length === 0) {
    return null;
  }

  const section = createElement("section", `pattern-room-analysis-result-group ${group}`);
  section.dataset["patternCaseReviewResultGroup"] = group;
  const header = createElement("header", "pattern-room-analysis-result-group-header");
  header.append(
    createElement("span", "pattern-room-analysis-result-index", String(body.children.length)),
    createElement("strong", undefined, RESULT_GROUP_LABELS[group])
  );
  section.append(header, body);
  return section;
}

function groupReviewResultSections(parsed: HTMLElement): void {
  const result = parsed.querySelector<HTMLElement>("[data-pattern-case-review-result='true']");
  if (result === null) {
    return;
  }

  const bodies: Record<PatternCaseReviewResultGroup, HTMLElement> = {
    evaluation: createElement("div", "pattern-room-analysis-result-group-body"),
    gaps: createElement("div", "pattern-room-analysis-result-group-body"),
    confidence: createElement("div", "pattern-room-analysis-result-group-body"),
  };

  const sections = Array.from(
    result.querySelectorAll<HTMLElement>("[data-pattern-case-review-section]")
  );
  sections.forEach((section) => {
    const sectionKey = section.dataset[
      "patternCaseReviewSection"
    ] as PatternRoomCaseReviewSectionKey;
    section.remove();
    bodies[RESULT_GROUP_BY_SECTION[sectionKey]].append(section);
  });

  const meta = findResultMeta(result);
  if (meta !== null) {
    meta.remove();
    bodies.confidence.append(meta);
  }

  const groups = [
    createResultGroup("evaluation", bodies.evaluation),
    createResultGroup("gaps", bodies.gaps),
    createResultGroup("confidence", bodies.confidence),
  ].filter((group): group is HTMLElement => group !== null);

  const insertionPoint = result.children[1] ?? null;
  groups.forEach((group) => {
    result.insertBefore(group, insertionPoint);
  });
}

function createMetric(label: string, value: string): HTMLElement {
  const metric = createElement("span", "pattern-room-analysis-desk-metric");
  metric.append(
    createElement("small", undefined, label),
    createElement("strong", undefined, value)
  );
  return metric;
}

function resolveInitialWorkbenchPanel(
  state: PatternCaseReviewRuntimePanelState
): PatternCaseReviewWorkbenchPanel {
  if (state.evidenceCandidates.length > 0) {
    return "candidates";
  }
  if (state.session?.status === "ready" || state.session?.status === "applied") {
    return "apply";
  }
  if (state.session?.reply !== null && state.session?.reply !== undefined) {
    return "raw-response";
  }
  return "apply";
}

function createWorkbenchButton(
  id: PatternCaseReviewWorkbenchPanel,
  badge: string
): HTMLButtonElement {
  const button = createElement("button", "pattern-room-analysis-workbench-tab");
  button.type = "button";
  button.dataset["patternAnalysisWorkbenchTab"] = id;
  button.ariaPressed = "false";
  button.append(
    createElement("strong", undefined, WORKBENCH_PANEL_LABELS[id]),
    createElement("span", undefined, badge)
  );
  return button;
}

export function createPatternCaseReviewSimplifiedView(
  state: PatternCaseReviewRuntimePanelState,
  options: PatternCaseReviewSimplifiedViewOptions = {}
): HTMLElement {
  const runtime = createPatternCaseReviewRuntimeView(state);
  runtime.classList.add("pattern-room-analysis-desk-runtime");
  const status = runtime.children[0] as HTMLElement | undefined;
  const workspace = runtime.children[1] as HTMLElement | undefined;
  if (status === undefined || workspace === undefined || workspace.children.length < 5) {
    return runtime;
  }

  const response = workspace.children[0] as HTMLElement;
  const parsed = workspace.children[1] as HTMLElement;
  const apply = workspace.children[2] as HTMLElement;
  const candidates = workspace.children[3] as HTMLElement;
  const history = workspace.children[4] as HTMLElement;

  groupReviewResultSections(parsed);

  const commandStrip = createElement("section", "pattern-room-analysis-command-strip");
  const commandCopy = createElement("div", "pattern-room-analysis-command-copy");
  commandCopy.append(
    createElement("span", "pattern-room-kicker", "Analiz masası"),
    createElement(
      "strong",
      undefined,
      state.session?.result === null || state.session?.result === undefined
        ? "İnceleme sonucu bekleniyor"
        : "Bulgular ayrıştırıldı"
    )
  );
  const result = state.session?.result ?? null;
  const metrics = createElement("div", "pattern-room-analysis-desk-metrics");
  metrics.append(
    createMetric("Bulgu", String(result?.items.length ?? 0)),
    createMetric("Eksik", String(result?.missingEvidence.length ?? 0)),
    createMetric("Soru", String(result?.openQuestions.length ?? 0)),
    createMetric("Aday", String(state.evidenceCandidates.length))
  );
  status.remove();
  commandStrip.append(commandCopy, metrics, status);

  const desk = createElement("div", "pattern-room-analysis-desk");
  desk.dataset["patternAnalysisDesk"] = "true";

  const findings = createElement("section", "pattern-room-analysis-findings");
  const findingsHeader = createElement("header", "pattern-room-analysis-findings-header");
  findingsHeader.append(
    createElement("span", "pattern-room-kicker", "Bulgular masası"),
    createElement("strong", undefined, "AI değerlendirmesi"),
    createElement(
      "small",
      undefined,
      "Sonuçlar burada okunur; hiçbir bulgu vakaya kullanıcı onayı olmadan işlenmez."
    )
  );
  parsed.remove();
  findings.append(findingsHeader, parsed);

  const workbench = createElement("aside", "pattern-room-analysis-workbench");
  const workbenchHeader = createElement("header", "pattern-room-analysis-workbench-header");
  workbenchHeader.append(
    createElement("span", "pattern-room-kicker", "Çalışma tepsisi"),
    createElement("strong", undefined, "Sonraki işlem")
  );

  const tabs = createElement("div", "pattern-room-analysis-workbench-tabs");
  tabs.role = "tablist";
  tabs.ariaLabel = "AI inceleme yardımcı araçları";
  const tabButtons = new Map<PatternCaseReviewWorkbenchPanel, HTMLButtonElement>();
  const panelElements = new Map<PatternCaseReviewWorkbenchPanel, HTMLElement>();

  const panelEntries: ReadonlyArray<
    readonly [PatternCaseReviewWorkbenchPanel, HTMLElement, string]
  > = [
    ["apply", apply, result === null ? "—" : "hazır"],
    ["candidates", candidates, String(state.evidenceCandidates.length)],
    [
      "raw-response",
      response,
      state.session?.reply === null || state.session?.reply === undefined ? "0" : "1",
    ],
    ["history", history, String(state.history.length)],
  ];

  const panelStack = createElement("div", "pattern-room-analysis-workbench-stack");
  const activatePanel = (id: PatternCaseReviewWorkbenchPanel): void => {
    tabButtons.forEach((button, buttonId) => {
      const active = buttonId === id;
      button.ariaPressed = active ? "true" : "false";
      button.dataset["patternAnalysisWorkbenchTabActive"] = active ? "true" : "false";
      button.tabIndex = active ? 0 : -1;
      button.classList.toggle("active", active);
    });
    panelElements.forEach((panel, panelId) => {
      panel.hidden = panelId !== id;
      panel.dataset["patternAnalysisWorkbenchPanelActive"] = panelId === id ? "true" : "false";
    });
  };

  panelEntries.forEach(([id, panel, badge]) => {
    panel.remove();
    panel.classList.add("pattern-room-analysis-workbench-panel");
    panel.dataset["patternAnalysisWorkbenchPanel"] = id;
    const button = createWorkbenchButton(id, badge);
    button.role = "tab";
    button.addEventListener("click", () => {
      activatePanel(id);
    });
    tabButtons.set(id, button);
    panelElements.set(id, panel);
    tabs.append(button);
    panelStack.append(panel);
  });

  delete history.dataset["patternCaseReviewHistory"];
  delete history.dataset["patternCaseReviewWorkspaceHistory"];
  history.dataset["patternCaseReviewHistory"] = "true";
  history.dataset["patternCaseReviewWorkspaceHistory"] = "true";
  history.tabIndex = -1;
  const nativeFocus = typeof history.focus === "function" ? history.focus.bind(history) : null;
  history.focus = (): void => {
    activatePanel("history");
    options.onHistoryFocus?.();
    nativeFocus?.();
  };
  if (typeof history.scrollIntoView !== "function") {
    history.scrollIntoView = (): void => {
      return;
    };
  }

  workbench.append(workbenchHeader, tabs, panelStack);
  desk.append(findings, workbench);
  runtime.replaceChildren(commandStrip, desk);
  activatePanel(resolveInitialWorkbenchPanel(state));
  return runtime;
}
