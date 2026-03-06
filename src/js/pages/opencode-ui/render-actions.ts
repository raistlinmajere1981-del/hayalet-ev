import { escapeHtml } from "./chat-utils.js";
import { normalizeString, toCompactLabel, toWorkspaceRelativePath } from "./message-content.js";
import type { OpencodeUiTodoItem, OpencodeUiToolCall } from "./types.js";

type ByIdFn = <T extends HTMLElement>(
  id: string,
  guard?: (element: T) => boolean
) => T | null;

export interface RenderContext {
  byId: ByIdFn;
  initialUsageText: string;
}

export function updateUsagePlaceholders(context: RenderContext, text: string): void {
  const usageValueEl = context.byId<HTMLElement>("usage-value");
  if (usageValueEl != null) {
    usageValueEl.textContent = "--";
  }

  const usageFillEl = context.byId<HTMLElement>("usage-fill");
  if (usageFillEl != null) {
    usageFillEl.style.width = "0%";
  }

  const usageStatsEl = context.byId<HTMLElement>("usage-stats");
  if (usageStatsEl != null) {
    usageStatsEl.innerHTML = `<span class="ds-progress__stat">${escapeHtml(text)}</span>`;
  }
}

export function updateUsageFromSession(
  context: RenderContext,
  usage: Record<string, unknown> | undefined
): void {
  if (usage == null || typeof usage !== "object") {
    updateUsagePlaceholders(context, context.initialUsageText);
    return;
  }

  const usageRecord = usage;
  const promptTokens = Number(usageRecord["prompt_tokens"] ?? 0);
  const completionTokens = Number(usageRecord["completion_tokens"] ?? 0);
  const reasoningTokens = Number(usageRecord["reasoning_tokens"] ?? 0);
  const totalTokens = Number(usageRecord["total_tokens"] ?? promptTokens + completionTokens);

  if (!Number.isFinite(totalTokens) || totalTokens <= 0) {
    updateUsagePlaceholders(context, context.initialUsageText);
    return;
  }

  const usageValueEl = context.byId<HTMLElement>("usage-value");
  if (usageValueEl != null) {
    usageValueEl.textContent = String(totalTokens);
  }

  const usageFillEl = context.byId<HTMLElement>("usage-fill");
  if (usageFillEl != null) {
    usageFillEl.style.width = "100%";
  }

  const usageStatsEl = context.byId<HTMLElement>("usage-stats");
  if (usageStatsEl != null) {
    let statsHtml =
      '<span class="ds-progress__stat">Prompt: <span class="ds-progress__stat-value">' +
      String(promptTokens) +
      '</span></span><span class="ds-progress__stat">Completion: <span class="ds-progress__stat-value">' +
      String(completionTokens) +
      "</span></span>";

    if (Number.isFinite(reasoningTokens) && reasoningTokens > 0) {
      statsHtml +=
        '<span class="ds-progress__stat">Reasoning: <span class="ds-progress__stat-value">' +
        String(reasoningTokens) +
        "</span></span>";
    }

    usageStatsEl.innerHTML = statsHtml;
  }
}

function buildRightTabPanelCard(
  title: string,
  eyebrow: string,
  bodyMarkup: string,
  countLabel?: string
): string {
  const countMarkup =
    countLabel != null && countLabel !== ""
      ? '<span class="ds-panel__count">' + escapeHtml(countLabel) + "</span>"
      : "";

  return (
    '<div class="ds-right-panel-card">' +
    '<div class="ds-right-panel-card__meta">' +
    "<div>" +
    '<div class="ds-right-panel-card__eyebrow">' +
    escapeHtml(eyebrow) +
    "</div>" +
    '<div class="ds-right-panel-card__title">' +
    escapeHtml(title) +
    "</div>" +
    "</div>" +
    countMarkup +
    "</div>" +
    bodyMarkup +
    "</div>"
  );
}

export function renderTodoPanel(context: RenderContext, todos: OpencodeUiTodoItem[]): void {
  const panel = context.byId<HTMLElement>("rtab-todo");
  if (panel == null) {
    return;
  }

  if (!Array.isArray(todos) || todos.length === 0) {
    panel.innerHTML = buildRightTabPanelCard(
      "Todo",
      "Session Ozeti",
      '<div class="empty-state">Henuz todo yok</div>',
      "0"
    );
    return;
  }

  const items = todos
    .map((todo) => {
      const content = normalizeString(todo.content).trim();
      if (content === "") {
        return "";
      }

      const statusRaw = normalizeString(todo.status).trim().toLowerCase();
      const priorityRaw = normalizeString(todo.priority).trim().toLowerCase();
      const status = statusRaw !== "" ? statusRaw : "pending";
      const priority = priorityRaw !== "" ? priorityRaw : "medium";
      return (
        '<div class="ds-todo-item ds-todo-item--' +
        escapeHtml(status) +
        '">' +
        '<div class="ds-todo-item__badges">' +
        '<span class="ds-todo-item__badge ds-todo-item__badge--status">' +
        escapeHtml(status) +
        "</span>" +
        '<span class="ds-todo-item__badge ds-todo-item__badge--priority">' +
        escapeHtml(priority) +
        "</span>" +
        "</div>" +
        '<div class="ds-todo-item__content">' +
        escapeHtml(content) +
        "</div>" +
        "</div>"
      );
    })
    .filter((item) => item !== "");

  panel.innerHTML = buildRightTabPanelCard(
    "Todo",
    "Session Ozeti",
    '<div class="ds-todo-list">' + items.join("") + "</div>",
    String(items.length)
  );
}

export function renderFilesPanel(
  context: RenderContext,
  files: string[],
  workspacePath: string
): void {
  const panel = context.byId<HTMLElement>("rtab-files");
  if (panel == null) {
    return;
  }

  if (!Array.isArray(files) || files.length === 0) {
    panel.innerHTML = buildRightTabPanelCard(
      "Files",
      "Workspace",
      '<div class="empty-state">Degisen dosya yok</div>',
      "0"
    );
    return;
  }

  const items = files
    .map((filePath) => {
      const fullPath = normalizeString(filePath).trim();
      if (fullPath === "") {
        return "";
      }

      const compactLabel = toCompactLabel(fullPath);
      const label = compactLabel !== "" ? compactLabel : fullPath;
      const relativePath = toWorkspaceRelativePath(fullPath, workspacePath);
      return (
        '<div class="ds-file-item" title="' +
        escapeHtml(fullPath) +
        '">' +
        '<div class="ds-file-item__name">' +
        escapeHtml(label) +
        "</div>" +
        '<div class="ds-file-item__path">' +
        escapeHtml(relativePath) +
        "</div>" +
        "</div>"
      );
    })
    .filter((item) => item !== "");

  if (items.length === 0) {
    panel.innerHTML = buildRightTabPanelCard(
      "Files",
      "Workspace",
      '<div class="empty-state">Degisen dosya yok</div>',
      "0"
    );
    return;
  }

  panel.innerHTML = buildRightTabPanelCard(
    "Files",
    "Workspace",
    '<div class="ds-file-list">' + items.join("") + "</div>",
    String(items.length)
  );
}

export function createHistoricAssistantToolHost(context: RenderContext): HTMLElement | null {
  const chatMessages = context.byId<HTMLElement>("chat-messages");
  if (chatMessages == null) {
    return null;
  }

  const chatEmpty = context.byId<HTMLElement>("chat-empty");
  if (chatEmpty != null) {
    chatEmpty.style.display = "none";
  }

  const host = document.createElement("div");
  host.className = "ds-message ds-message--assistant";
  chatMessages.appendChild(host);
  return host;
}

export function renderHistoricToolCall(
  targetContainer: HTMLElement,
  toolCall: OpencodeUiToolCall
): void {
  const card = document.createElement("div");
  card.className = "ds-tool-call ds-tool-call--open";

  const args = normalizeString(toolCall.args);
  const result = normalizeString(toolCall.result);

  card.innerHTML =
    '<div class="ds-tool-call__header">' +
    '<span class="ds-tool-call__icon">🔧</span>' +
    '<span class="ds-tool-call__name">' +
    escapeHtml(toolCall.name) +
    "</span>" +
    '<span class="ds-tool-call__status ds-tool-call__status--done">done</span>' +
    "</div>" +
    '<div class="ds-tool-call__body">' +
    (args !== ""
      ? '<div class="ds-tool-call__result"><strong>args</strong><br>' + escapeHtml(args) + "</div>"
      : "") +
    (result !== ""
      ? '<div class="ds-tool-call__result"><strong>result</strong><br>' +
        escapeHtml(result) +
        "</div>"
      : "") +
    "</div>";

  targetContainer.appendChild(card);
}
