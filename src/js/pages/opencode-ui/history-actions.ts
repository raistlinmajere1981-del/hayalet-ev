import { VISIBLE_MESSAGE_COUNT } from "@limits";
import type {
  OpencodeUiSessionDetail,
  OpencodeUiSessionMessage,
  OpencodeUiTodoItem,
  OpencodeUiToolCall,
  RuntimeState,
} from "./types.js";
import { t } from "./i18n.js";

type ByIdFn = <T extends HTMLElement>(id: string, guard?: (element: T) => boolean) => T | null;

interface HistoryContext {
  runtime: RuntimeState;
  byId: ByIdFn;
  initialUsageText: string;
  clearChatArea: () => void;
  renderTodoPanel: (todos: OpencodeUiTodoItem[]) => void;
  renderFilesPanel: (files: string[], workspacePath: string) => void;
  updateUsagePlaceholders: (text: string) => void;
  updateUsageFromSession: (usage: Record<string, unknown> | undefined) => void;
  addMessage: (
    role: "user" | "assistant",
    text: string,
    meta?: string,
    files?: Array<string | { name?: string; media_type?: string; fileName?: string; path?: string }>
  ) => HTMLElement | null;
  createHistoricAssistantToolHost: () => HTMLElement | null;
  renderHistoricToolCall: (targetContainer: HTMLElement, toolCall: OpencodeUiToolCall) => void;
  readSessionFromDisk: (sessionId: string) => Promise<OpencodeUiSessionDetail | null>;
  scrollChatToBottom: (force?: boolean) => void;
  buildSessionSnapshotKey: (messages: OpencodeUiSessionDetail["messages"] | undefined) => string;
  wait: (delayMs: number) => Promise<void>;
}

let liveSyncInFlight = false;
const historyVisibleStarts = new Map<string, number>();

function renderHistoryMessage(context: HistoryContext, message: OpencodeUiSessionMessage): void {
  if (message.role === "user") {
    context.addMessage("user", message.text, undefined, message.files);
    return;
  }

  const toolCalls = Array.isArray(message.toolCalls) ? message.toolCalls : [];
  const bubble = context.addMessage("assistant", message.text);
  const toolTarget =
    bubble?.parentElement instanceof HTMLElement
      ? bubble.parentElement
      : toolCalls.length > 0
        ? context.createHistoricAssistantToolHost()
        : null;

  if (toolTarget != null && toolCalls.length > 0) {
    for (const toolCall of toolCalls) {
      context.renderHistoricToolCall(toolTarget, toolCall);
    }
  }
}

function resolveVisibleStart(sessionId: string, totalMessages: number): number {
  if (totalMessages <= VISIBLE_MESSAGE_COUNT) {
    historyVisibleStarts.set(sessionId, 0);
    return 0;
  }

  const defaultStart = Math.max(0, totalMessages - VISIBLE_MESSAGE_COUNT);
  const storedStart = historyVisibleStarts.get(sessionId);
  const visibleStart =
    typeof storedStart === "number" && Number.isFinite(storedStart)
      ? Math.max(0, Math.min(storedStart, defaultStart))
      : defaultStart;

  historyVisibleStarts.set(sessionId, visibleStart);
  return visibleStart;
}

function renderSessionMessages(
  context: HistoryContext,
  detail: OpencodeUiSessionDetail,
  options: { preserveScrollOffset?: boolean } = {}
): void {
  const chatMessages = context.byId<HTMLElement>("chat-messages");
  if (chatMessages == null) {
    return;
  }

  const preserveScrollOffset = options.preserveScrollOffset === true;
  const previousScrollHeight = preserveScrollOffset ? chatMessages.scrollHeight : 0;
  const previousScrollTop = preserveScrollOffset ? chatMessages.scrollTop : 0;
  const messages = Array.isArray(detail.messages) ? detail.messages : [];
  const visibleStart = resolveVisibleStart(detail.id, messages.length);
  const visibleMessages = messages.slice(visibleStart);

  context.clearChatArea();

  if (visibleStart > 0) {
    const loadMoreButton = document.createElement("button");
    loadMoreButton.type = "button";
    loadMoreButton.className = "ds-history-load-more";
    loadMoreButton.textContent = t("session.loadMoreMessages", { count: visibleStart });
    loadMoreButton.addEventListener("click", () => {
      void loadMoreHistoryMessages(context, detail.id);
    });
    chatMessages.appendChild(loadMoreButton);
  }

  for (const message of visibleMessages) {
    renderHistoryMessage(context, message);
  }

  context.runtime.lastRenderedMessageCount = messages.length;
  context.runtime.lastRenderedSnapshotKey = context.buildSessionSnapshotKey(messages);

  if (preserveScrollOffset) {
    requestAnimationFrame(() => {
      const nextScrollTop = chatMessages.scrollHeight - previousScrollHeight + previousScrollTop;
      chatMessages.scrollTop = Math.max(0, nextScrollTop);
    });
    return;
  }

  context.scrollChatToBottom(true);
}

async function loadMoreHistoryMessages(context: HistoryContext, sessionId: string): Promise<void> {
  const detail = await context.readSessionFromDisk(sessionId);
  if (detail == null || context.runtime.activeSessionId !== sessionId) {
    return;
  }

  const messages = Array.isArray(detail.messages) ? detail.messages : [];
  const currentVisibleStart = resolveVisibleStart(sessionId, messages.length);
  const nextVisibleStart = Math.max(0, currentVisibleStart - VISIBLE_MESSAGE_COUNT);

  if (nextVisibleStart === currentVisibleStart) {
    return;
  }

  historyVisibleStarts.set(sessionId, nextVisibleStart);
  renderSessionMessages(context, detail, { preserveScrollOffset: true });
}

export async function loadActiveSessionHistory(context: HistoryContext): Promise<void> {
  const sessionId = context.runtime.activeSessionId;
  if (sessionId == null || sessionId === "") {
    historyVisibleStarts.clear();
    context.clearChatArea();
    context.renderTodoPanel([]);
    context.renderFilesPanel([], "");
    context.updateUsagePlaceholders(context.initialUsageText);
    return;
  }

  const detail = await context.readSessionFromDisk(sessionId);
  if (detail == null) {
    historyVisibleStarts.delete(sessionId);
    context.clearChatArea();
    context.renderTodoPanel([]);
    context.renderFilesPanel([], "");
    context.updateUsagePlaceholders(context.initialUsageText);
    return;
  }

  const workingDirEl = context.byId<HTMLElement>("working-dir");
  if (workingDirEl != null && detail.workspace_path !== "") {
    workingDirEl.textContent = detail.workspace_path;
    workingDirEl.setAttribute("title", detail.workspace_path);
  }

  context.renderTodoPanel(Array.isArray(detail.todos) ? detail.todos : []);
  context.renderFilesPanel(
    Array.isArray(detail.changed_files) ? detail.changed_files : [],
    detail.workspace_path
  );
  renderSessionMessages(context, detail);
  context.updateUsageFromSession(detail.usage);
}

export async function syncActiveSessionHistoryIfUpdated(context: HistoryContext): Promise<void> {
  const sessionId = context.runtime.activeSessionId;
  if (sessionId == null || sessionId === "" || liveSyncInFlight) {
    return;
  }

  liveSyncInFlight = true;

  try {
    const detail = await context.readSessionFromDisk(sessionId);
    if (detail == null || context.runtime.activeSessionId !== sessionId) {
      return;
    }

    const messages = Array.isArray(detail.messages) ? detail.messages : [];
    const nextCount = messages.length;
    const nextSnapshot = context.buildSessionSnapshotKey(messages);

    if (
      nextCount !== context.runtime.lastRenderedMessageCount ||
      nextSnapshot !== context.runtime.lastRenderedSnapshotKey
    ) {
      await loadActiveSessionHistory(context);
    }
  } catch (_error) {
  } finally {
    liveSyncInFlight = false;
  }
}

export async function withHistorySyncFallback(
  context: HistoryContext,
  fallbackText: string
): Promise<void> {
  const sessionId = context.runtime.activeSessionId;
  if (sessionId == null || sessionId === "") {
    if (fallbackText !== "") {
      context.addMessage("assistant", fallbackText);
      context.scrollChatToBottom(true);
    }
    return;
  }

  const minExpectedCount = context.runtime.lastRenderedMessageCount + 1;

  const trySync = async (attempt: number): Promise<boolean> => {
    const detail = await context.readSessionFromDisk(sessionId);
    const messageCount = detail?.messages.length ?? 0;

    if (detail != null && messageCount >= minExpectedCount) {
      await loadActiveSessionHistory(context);
      return true;
    }

    if (attempt >= 9) {
      return false;
    }

    await context.wait(250);
    return await trySync(attempt + 1);
  };

  const synced = await trySync(0);
  if (!synced && fallbackText !== "") {
    context.addMessage("assistant", fallbackText);
    context.scrollChatToBottom(true);
  }
}
