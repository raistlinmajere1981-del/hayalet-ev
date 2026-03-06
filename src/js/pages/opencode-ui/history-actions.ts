import type {
  OpencodeUiSessionDetail,
  OpencodeUiTodoItem,
  OpencodeUiToolCall,
  RuntimeState,
} from "./types.js";

type ByIdFn = <T extends HTMLElement>(
  id: string,
  guard?: (element: T) => boolean
) => T | null;

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
  buildSessionSnapshotKey: (
    messages: OpencodeUiSessionDetail["messages"] | undefined
  ) => string;
  wait: (delayMs: number) => Promise<void>;
}

let liveSyncInFlight = false;

export async function loadActiveSessionHistory(context: HistoryContext): Promise<void> {
  const sessionId = context.runtime.activeSessionId;
  if (sessionId == null || sessionId === "") {
    context.clearChatArea();
    context.renderTodoPanel([]);
    context.renderFilesPanel([], "");
    context.updateUsagePlaceholders(context.initialUsageText);
    return;
  }

  const detail = await context.readSessionFromDisk(sessionId);
  if (detail == null) {
    context.clearChatArea();
    context.renderTodoPanel([]);
    context.renderFilesPanel([], "");
    context.updateUsagePlaceholders(context.initialUsageText);
    return;
  }

  context.clearChatArea();

  const workingDirEl = context.byId<HTMLElement>("working-dir");
  if (workingDirEl != null && detail.workspace_path !== "") {
    workingDirEl.textContent = detail.workspace_path;
    workingDirEl.setAttribute("title", detail.workspace_path);
  }

  const messages = Array.isArray(detail.messages) ? detail.messages : [];
  context.renderTodoPanel(Array.isArray(detail.todos) ? detail.todos : []);
  context.renderFilesPanel(
    Array.isArray(detail.changed_files) ? detail.changed_files : [],
    detail.workspace_path
  );

  for (const message of messages) {
    if (message.role === "user") {
      context.addMessage("user", message.text, undefined, message.files);
      continue;
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

  context.runtime.lastRenderedMessageCount = messages.length;
  context.runtime.lastRenderedSnapshotKey = context.buildSessionSnapshotKey(messages);
  context.updateUsageFromSession(detail.usage);
  context.scrollChatToBottom(true);
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
