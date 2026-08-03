import {
  PATTERN_ROOM_CASE_REVIEW_SECTION_KEYS,
  type PatternRoomCaseReviewResult,
  type PatternRoomCaseReviewSectionKey,
} from "../../shared/types/pattern-room-case-review-result.js";
import type {
  PatternRoomCaseReviewApplyMode,
  PatternRoomCaseReviewHistoryEntry,
  PatternRoomCaseReviewSession,
  PatternRoomCaseReviewSessionStatus,
} from "../../shared/types/pattern-room-case-review-session.js";
import type {
  PatternCaseReviewTextKey,
  PatternCaseReviewTranslator,
} from "../pattern-case-review-i18n.js";
import { createActionButton, createElement } from "./pattern-panel-utils.js";

export type PatternCaseReviewApplyFeedback = {
  readonly tone: "success" | "error";
  readonly message: string;
};

export type PatternCaseReviewRuntimePanelState = {
  readonly session: PatternRoomCaseReviewSession | null;
  readonly history: readonly PatternRoomCaseReviewHistoryEntry[];
  readonly applyFeedback: PatternCaseReviewApplyFeedback | null;
  readonly applyDisabled: boolean;
  readonly text: PatternCaseReviewTranslator;
  readonly onCancel: () => void;
  readonly onRetry: () => void;
  readonly onResend: () => void;
  readonly onApply: (mode: PatternRoomCaseReviewApplyMode) => void;
};

const STATUS_TEXT_KEYS: Readonly<
  Record<PatternRoomCaseReviewSessionStatus, PatternCaseReviewTextKey>
> = {
  preview: "statuses.idle",
  dispatching: "statuses.running",
  "waiting-reply": "statuses.waiting",
  ready: "statuses.ready",
  failed: "statuses.error",
  "timed-out": "statuses.timeout",
  cancelled: "statuses.cancelled",
  applied: "statuses.applied",
};

const STATUS_CLASS_NAMES: Readonly<
  Record<PatternRoomCaseReviewSessionStatus, string>
> = {
  preview: "idle",
  dispatching: "running",
  "waiting-reply": "waiting",
  ready: "ready",
  failed: "error",
  "timed-out": "timeout",
  cancelled: "cancelled",
  applied: "applied",
};

const SECTION_TEXT_KEYS: Readonly<
  Record<PatternRoomCaseReviewSectionKey, PatternCaseReviewTextKey>
> = {
  observation: "sections.observation",
  evidence: "sections.evidence",
  analysis: "sections.analysis",
  counterArgument: "sections.counterArgument",
  missingInformation: "sections.missingInformation",
  openQuestions: "sections.openQuestions",
  confidenceNotes: "sections.confidenceNotes",
};

function createTextList(items: readonly string[], className?: string): HTMLUListElement | null {
  if (items.length === 0) {
    return null;
  }
  const list = createElement("ul", className ?? "pattern-room-case-review-result-list");
  items.forEach((item) => {
    list.append(createElement("li", undefined, item));
  });
  return list;
}

function appendResultSection(
  container: HTMLElement,
  result: PatternRoomCaseReviewResult,
  sectionKey: PatternRoomCaseReviewSectionKey,
  text: PatternCaseReviewTranslator
): void {
  const section = result.sections[sectionKey];
  if (section.items.length === 0 && section.rawText.trim() === "") {
    return;
  }

  const card = createElement("article", "pattern-room-case-review-section");
  card.dataset["patternCaseReviewSection"] = sectionKey;
  card.append(createElement("h4", undefined, text(SECTION_TEXT_KEYS[sectionKey])));
  const list = createTextList(section.items.map((item) => item.text));
  if (list !== null) {
    card.append(list);
  } else {
    card.append(createElement("p", "pattern-room-empty-state", section.rawText));
  }
  container.append(card);
}

function appendResultMetaList(
  container: HTMLElement,
  title: string,
  items: readonly string[],
  datasetKey: string
): void {
  if (items.length === 0) {
    return;
  }
  const card = createElement("article");
  card.dataset[datasetKey] = "true";
  card.append(createElement("h4", undefined, title));
  const list = createTextList(items);
  if (list !== null) {
    card.append(list);
  }
  container.append(card);
}

function createReviewResult(
  result: PatternRoomCaseReviewResult,
  text: PatternCaseReviewTranslator
): HTMLElement {
  const container = createElement("section", "pattern-room-case-review-result");
  container.dataset["patternCaseReviewResult"] = "true";

  const summary = createElement("article", "pattern-room-case-review-result-summary");
  summary.append(
    createElement("h3", undefined, text("result.title")),
    createElement("p", undefined, result.summary)
  );
  container.append(summary);

  PATTERN_ROOM_CASE_REVIEW_SECTION_KEYS.forEach((sectionKey) => {
    appendResultSection(container, result, sectionKey, text);
  });

  const meta = createElement("div", "pattern-room-case-review-result-meta");
  appendResultMetaList(meta, text("result.confidence"), result.confidence, "patternCaseReviewConfidence");
  appendResultMetaList(
    meta,
    text("result.missingEvidence"),
    result.missingEvidence,
    "patternCaseReviewMissingEvidence"
  );
  appendResultMetaList(
    meta,
    text("result.openQuestions"),
    result.openQuestions,
    "patternCaseReviewOpenQuestions"
  );
  appendResultMetaList(
    meta,
    text("result.suggestedConnections"),
    result.suggestedConnections.map((connection) => {
      const connectionText = `${connection.sourceId} → ${connection.edgeType} → ${connection.targetId}`;
      return connection.note === null ? connectionText : `${connectionText} — ${connection.note}`;
    }),
    "patternCaseReviewSuggestedConnections"
  );
  appendResultMetaList(
    meta,
    text("result.warnings"),
    result.warnings.map((warning) => `[${warning.code}] ${warning.message}`),
    "patternCaseReviewWarnings"
  );
  if (meta.children.length > 0) {
    container.append(meta);
  }

  if (result.fallbackUsed) {
    const fallbackWarning = createElement(
      "p",
      "pattern-room-case-review-preview-status failed",
      text("messages.fallbackWarning")
    );
    fallbackWarning.dataset["patternCaseReviewFallbackWarning"] = "true";
    container.append(fallbackWarning);
  }

  return container;
}

function formatHistoryTimestamp(timestamp: string): string {
  const value = new Date(timestamp);
  if (Number.isNaN(value.getTime())) {
    return timestamp;
  }
  return value.toISOString().replace("T", " ").replace(".000Z", " UTC");
}

function shortenHash(hash: string | null): string {
  if (hash === null || hash === "") {
    return "—";
  }
  return hash.length > 16 ? `${hash.slice(0, 12)}…` : hash;
}

function createHistoryValue(
  label: string,
  value: string,
  options: { readonly code?: boolean; readonly title?: string } = {}
): HTMLElement {
  const wrapper = createElement("div");
  wrapper.append(createElement("span", undefined, label));
  const valueElement = createElement(options.code === true ? "code" : "p", undefined, value);
  if (options.title !== undefined) {
    valueElement.title = options.title;
  }
  wrapper.append(valueElement);
  return wrapper;
}

function createHistory(
  history: readonly PatternRoomCaseReviewHistoryEntry[],
  text: PatternCaseReviewTranslator
): HTMLElement {
  const section = createElement("section", "pattern-room-case-review-history");
  section.dataset["patternCaseReviewHistory"] = "true";
  section.append(createElement("h3", undefined, text("history.title")));

  if (history.length === 0) {
    section.append(
      createElement("p", "pattern-room-empty-state", text("messages.historyEmpty"))
    );
    return section;
  }

  const list = createElement("div", "pattern-room-case-review-history-list");
  history.forEach((entry) => {
    const item = createElement("article", "pattern-room-case-review-history-item");
    item.dataset["patternCaseReviewHistoryItem"] = entry.sessionId;
    item.append(
      createHistoryValue(text("history.timestamp"), formatHistoryTimestamp(entry.timestamp)),
      createHistoryValue(text("history.role"), entry.role),
      createHistoryValue(text("history.packetHash"), shortenHash(entry.packetHash), {
        code: true,
        title: entry.packetHash,
      }),
      createHistoryValue(text("history.responseHash"), shortenHash(entry.responseHash), {
        code: true,
        ...(entry.responseHash === null ? {} : { title: entry.responseHash }),
      }),
      createHistoryValue(text("history.state"), text(STATUS_TEXT_KEYS[entry.state]))
    );
    list.append(item);
  });
  section.append(list);
  return section;
}

function createRuntimeActions(
  state: PatternCaseReviewRuntimePanelState,
  session: PatternRoomCaseReviewSession
): HTMLElement | null {
  const actions = createElement("div", "pattern-room-case-review-runtime-actions");
  const isActive = session.status === "dispatching" || session.status === "waiting-reply";
  const canRetry =
    session.status === "failed" ||
    session.status === "timed-out" ||
    session.status === "cancelled";
  const canResend =
    session.status === "ready" ||
    session.status === "applied" ||
    session.status === "failed" ||
    session.status === "timed-out" ||
    session.status === "cancelled";

  if (isActive) {
    const cancel = createActionButton(state.text("actions.cancel"), state.onCancel);
    cancel.dataset["patternCaseReviewCancel"] = "true";
    actions.append(cancel);
  }
  if (canRetry) {
    const retry = createActionButton(state.text("actions.retry"), state.onRetry);
    retry.dataset["patternCaseReviewRetry"] = "true";
    actions.append(retry);
  }
  if (canResend) {
    const resend = createActionButton(state.text("actions.resend"), state.onResend);
    resend.dataset["patternCaseReviewResend"] = "true";
    actions.append(resend);
  }

  return actions.children.length === 0 ? null : actions;
}

function createApplyActions(state: PatternCaseReviewRuntimePanelState): HTMLElement | null {
  if (state.session?.result === null || state.session?.status !== "ready") {
    return null;
  }

  const actions = createElement("div", "pattern-room-case-review-apply-actions");
  const applyModes: ReadonlyArray<
    readonly [PatternRoomCaseReviewApplyMode, PatternCaseReviewTextKey, string]
  > = [
    ["all", "actions.applyAll", "patternCaseReviewApplyAll"],
    ["open-questions-only", "actions.applyOpenQuestions", "patternCaseReviewApplyOpenQuestions"],
    [
      "evidence-suggestions-only",
      "actions.applyEvidenceSuggestions",
      "patternCaseReviewApplyEvidenceSuggestions",
    ],
  ];
  applyModes.forEach(([mode, labelKey, datasetKey]) => {
    const button = createActionButton(state.text(labelKey), () => {
      state.onApply(mode);
    });
    button.dataset[datasetKey] = "true";
    button.disabled = state.applyDisabled;
    actions.append(button);
  });
  return actions;
}

export function createPatternCaseReviewRuntimeView(
  state: PatternCaseReviewRuntimePanelState
): HTMLElement {
  const runtime = createElement("section", "pattern-room-case-review-runtime");
  runtime.dataset["patternCaseReviewRuntime"] = "true";

  if (state.session === null) {
    runtime.append(createHistory(state.history, state.text));
    return runtime;
  }

  const statusRow = createElement("div", "pattern-room-case-review-runtime-status");
  const statusClass = STATUS_CLASS_NAMES[state.session.status];
  const status = createElement(
    "span",
    `pattern-room-case-review-status ${statusClass}`,
    state.text(STATUS_TEXT_KEYS[state.session.status])
  );
  status.dataset["patternCaseReviewState"] = state.session.status;
  statusRow.append(status);
  if (state.session.error !== null) {
    const error = createElement("p", "pattern-room-case-review-preview-status failed");
    error.dataset["patternCaseReviewError"] = state.session.error.code;
    error.textContent = state.session.error.message;
    statusRow.append(error);
  }
  runtime.append(statusRow);

  const runtimeActions = createRuntimeActions(state, state.session);
  if (runtimeActions !== null) {
    runtime.append(runtimeActions);
  }

  if (state.session.result !== null) {
    runtime.append(createReviewResult(state.session.result, state.text));
  } else if (state.session.status === "waiting-reply" || state.session.status === "dispatching") {
    runtime.append(
      createElement("p", "pattern-room-empty-state", state.text("messages.resultEmpty"))
    );
  }

  const applyActions = createApplyActions(state);
  if (applyActions !== null) {
    runtime.append(applyActions);
  }
  if (state.applyFeedback !== null) {
    const feedback = createElement(
      "p",
      `pattern-room-case-review-apply-feedback ${state.applyFeedback.tone}`,
      state.applyFeedback.message
    );
    feedback.dataset["patternCaseReviewApplyFeedback"] = state.applyFeedback.tone;
    runtime.append(feedback);
  }

  runtime.append(createHistory(state.history, state.text));
  return runtime;
}
