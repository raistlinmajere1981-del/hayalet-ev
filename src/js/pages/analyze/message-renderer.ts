import { LogCategory } from "@shared/logging-core";
import { Logger } from "../../modules/logger/index.js";
import { getErrorMessage } from "@shared/index.js";
import { AppState } from "../../modules/app-state.js";
import { VISIBLE_MESSAGE_COUNT, MESSAGE_HEIGHT_ESTIMATE } from "@limits";
import {
  buildAttachmentsByMessage,
  buildRenderSnapshot,
  canUseIncrementalAppend,
  getScrollTopAfterPrepend,
  shouldAutoScrollToBottom,
  shouldSkipRender,
  type RenderSnapshot,
} from "./render-cache.js";

function formatTimestamp(timestamp: number | undefined): string {
  if (timestamp === undefined || Number.isNaN(timestamp)) return "";
  const d = new Date(timestamp);
  return d.toLocaleString("tr-TR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export interface RenderCallbacks {
  onContextMenu?: (e: MouseEvent, data: { provider: string; text: string }) => void;
  onDoubleClick?: (data: { provider: string; text: string }) => void;
}

interface MessageItem {
  id: string;
  role: string;
  content?: string;
  text?: string;
  author?: string;
  createdAt?: number;
}

interface RenderState {
  allMessages: MessageItem[];
  visibleStart: number;
  visibleEnd: number;
  totalHeight: number;
  scrollTop: number;
  attachmentsByMessage: Record<string, AttachmentData[]>;
  attachmentsBasePath: string;
}

interface RenderPayload {
  conversationId: string;
  messages: MessageItem[];
  attachmentsByMessage: Record<string, AttachmentData[]>;
  needsVirtualization: boolean;
}

const renderStates = new Map<string, RenderState>();
const renderSnapshots = new Map<string, RenderSnapshot>();
const renderPayloads = new Map<string, RenderPayload>();

export function resetMessageRenderState(provider: string): void {
  renderStates.delete(provider);
  renderSnapshots.delete(provider);
  renderPayloads.delete(provider);
}

function resolveScrollTarget(container: HTMLElement): HTMLElement {
  const virtualScroll = container.querySelector(".msg-virtual-scroll");
  return virtualScroll instanceof HTMLElement ? virtualScroll : container;
}

function scheduleScrollToBottom(container: HTMLElement, shouldScroll: boolean): void {
  if (!shouldScroll) {
    return;
  }

  const target = resolveScrollTarget(container);

  const raf = globalThis.requestAnimationFrame;
  if (typeof raf === "function") {
    raf(() => {
      target.scrollTop = target.scrollHeight;
    });
    return;
  }

  target.scrollTop = target.scrollHeight;
}

export async function renderMessages(
  provider: string,
  callbacks: RenderCallbacks = {}
): Promise<{ lastMessage: string }> {
  Logger.debug(LogCategory.ANALYZE, `renderMessages started for ${provider}`);

  const container = document.getElementById(`messages-${provider}`);
  const select = document.getElementById(`conversation-${provider}`) as HTMLSelectElement | null;

  Logger.debug(LogCategory.ANALYZE, `Elements found:`, {
    hasContainer: !!container,
    hasSelect: !!select,
    selectValue: select?.value,
    selectOptionsCount: select?.options.length,
  });

  if (!container) {
    Logger.warn(LogCategory.ANALYZE, `Container not found: messages-${provider}`);
    return { lastMessage: "" };
  }

  if (!select) {
    Logger.warn(LogCategory.ANALYZE, `Select not found: conversation-${provider}`);
    resetMessageRenderState(provider);
    container.innerHTML = '<div class="message-placeholder">Sohbet listesi yükleniyor...</div>';
    return { lastMessage: "" };
  }

  const selected = select.selectedOptions[0];

  Logger.debug(LogCategory.ANALYZE, `Conversation selection:`, {
    selectedValue: selected?.value,
    hasSelected: selected !== undefined,
  });

  if (!selected || selected.value === "new") {
    resetMessageRenderState(provider);
    container.innerHTML =
      '<div class="message-placeholder">Yeni sohbet ba\u015flat\u0131l\u0131yor...</div>';
    return { lastMessage: "" };
  }

  try {
    const conversationId = selected.value;
    const accountInfo = AppState.getAccountForSlot(provider);

    Logger.debug(LogCategory.ANALYZE, `Fetching messages from DB:`, {
      accountId: accountInfo?.id,
      conversationId,
    });

    const accountId = accountInfo?.id ?? "";
    if (accountId === "") {
      resetMessageRenderState(provider);
      container.innerHTML = '<div class="message-placeholder">Hesap bilgisi bulunamadı.</div>';
      return { lastMessage: "" };
    }

    const electronApi = window.electronAPI;
    if (electronApi === undefined) {
      resetMessageRenderState(provider);
      container.innerHTML = '<div class="message-placeholder">Uygulama API bulunamadı.</div>';
      return { lastMessage: "" };
    }

    const dbGetMessages = electronApi.dbGetMessages;
    const rawMessagesResult: unknown =
      typeof dbGetMessages === "function"
        ? await dbGetMessages({ accountId, conversationId })
        : undefined;
    const messagesResult = isDbMessagesResult(rawMessagesResult) ? rawMessagesResult : {};
    const rawMessages = Array.isArray(messagesResult.data) ? messagesResult.data : [];
    const messages = rawMessages.filter((message): message is MessageItem =>
      isMessageItem(message)
    );

    Logger.debug(LogCategory.ANALYZE, `DB query result:`, {
      messagesCount: messages.length,
      hasResult: rawMessagesResult !== undefined && rawMessagesResult !== null,
      hasData: Array.isArray(messagesResult.data),
    });
    let attachments: AttachmentData[] = [];
    try {
      Logger.debug(LogCategory.ANALYZE, `Fetching attachments for conversation:`, {
        accountId,
        conversationId,
      });
      const dbGetAttachments = electronApi["dbGetAttachments"];
      const rawAttachmentsResult: unknown =
        typeof dbGetAttachments === "function"
          ? await dbGetAttachments({
              accountId,
              conversationId,
            })
          : undefined;
      const attachmentsResult = isDbAttachmentsResult(rawAttachmentsResult)
        ? rawAttachmentsResult
        : {};
      const rawAttachments = Array.isArray(attachmentsResult.data) ? attachmentsResult.data : [];
      attachments = rawAttachments.filter((attachment): attachment is AttachmentData =>
        isAttachmentData(attachment)
      );
      Logger.debug(LogCategory.ANALYZE, `Attachments fetched:`, {
        count: attachments.length,
        success: attachmentsResult.success === true,
      });
    } catch (err) {
      Logger.warn(LogCategory.ANALYZE, `Failed to fetch attachments:`, { error: err });
    }

    const attachmentsByMessage = buildAttachmentsByMessage(attachments);

    const attachmentsBasePath = `data/${accountId}/attachments/${conversationId}`;

    const items = messages;
    const lastAssistant = [...items]
      .reverse()
      .find((m) => m.role === "assistant" && (m.content ?? m.text ?? "").trim().length > 0);

    const nextSnapshot = buildRenderSnapshot(conversationId, items, attachments);
    const previousSnapshot = renderSnapshots.get(provider);
    const previousPayload = renderPayloads.get(provider);
    const totalMessages = items.length;
    const needsVirtualization = totalMessages > VISIBLE_MESSAGE_COUNT;
    const hasRenderedContent =
      container.querySelector(".msg-bubble") !== null ||
      container.querySelector(".msg-virtual-scroll") !== null;

    const scrollTargetBefore = resolveScrollTarget(container);
    const shouldStickToBottom =
      !hasRenderedContent ||
      shouldAutoScrollToBottom({
        scrollTop: scrollTargetBefore.scrollTop,
        clientHeight: scrollTargetBefore.clientHeight,
        scrollHeight: scrollTargetBefore.scrollHeight,
      });

    if (hasRenderedContent && shouldSkipRender(previousSnapshot, nextSnapshot)) {
      Logger.debug(LogCategory.ANALYZE, "Skip rerender: snapshot unchanged", {
        provider,
        conversationId,
      });
      renderPayloads.set(provider, {
        conversationId,
        messages: items,
        attachmentsByMessage,
        needsVirtualization,
      });
      scheduleScrollToBottom(container, shouldStickToBottom);
      return { lastMessage: lastAssistant?.text ?? lastAssistant?.content ?? "" };
    }

    const canTryIncrementalAppend =
      hasRenderedContent &&
      !needsVirtualization &&
      previousPayload?.needsVirtualization === false &&
      previousPayload.conversationId === conversationId;

    if (canTryIncrementalAppend) {
      const existingBubbleCount = container.querySelectorAll(".msg-bubble").length;
      const appendDecision = canUseIncrementalAppend({
        previousMessages: previousPayload.messages,
        nextMessages: items,
        previousAttachmentsByMessage: previousPayload.attachmentsByMessage,
        nextAttachmentsByMessage: attachmentsByMessage,
      });

      if (existingBubbleCount >= previousPayload.messages.length && appendDecision.canAppend) {
        const appendedItems = items.slice(appendDecision.appendStart);
        appendedItems.forEach((msg) => {
          const msgAttachments = attachmentsByMessage[msg.id] ?? [];
          const bubble = createMessageBubble(
            msg,
            provider,
            attachmentsBasePath,
            msgAttachments,
            callbacks
          );
          container.appendChild(bubble);
        });

        renderStates.delete(provider);
        renderSnapshots.set(provider, nextSnapshot);
        renderPayloads.set(provider, {
          conversationId,
          messages: items,
          attachmentsByMessage,
          needsVirtualization,
        });
        scheduleScrollToBottom(container, shouldStickToBottom);
        return { lastMessage: lastAssistant?.text ?? lastAssistant?.content ?? "" };
      }
    }

    container.innerHTML = "";

    if (needsVirtualization) {
      const scrollContainer = document.createElement("div");
      scrollContainer.className = "msg-virtual-scroll";
      scrollContainer.style.height = "400px";
      scrollContainer.style.overflow = "auto";
      scrollContainer.style.position = "relative";

      const contentContainer = document.createElement("div");
      contentContainer.className = "msg-virtual-content";
      contentContainer.style.position = "relative";
      const totalHeight = totalMessages * MESSAGE_HEIGHT_ESTIMATE;
      contentContainer.style.height = `${totalHeight}px`;

      const visibleStart = Math.max(0, totalMessages - VISIBLE_MESSAGE_COUNT);
      const visibleEnd = totalMessages;

      renderStates.set(provider, {
        allMessages: items,
        visibleStart,
        visibleEnd,
        totalHeight,
        scrollTop: scrollContainer.scrollTop,
        attachmentsByMessage,
        attachmentsBasePath,
      });

      const spacerTop = document.createElement("div");
      spacerTop.style.height = `${visibleStart * MESSAGE_HEIGHT_ESTIMATE}px`;
      contentContainer.appendChild(spacerTop);

      const visibleItems = items.slice(visibleStart, visibleEnd);
      visibleItems.forEach((msg) => {
        const msgAttachments = attachmentsByMessage[msg.id] ?? [];
        const bubble = createMessageBubble(
          msg,
          provider,
          attachmentsBasePath,
          msgAttachments,
          callbacks
        );
        contentContainer.appendChild(bubble);
      });

      const spacerBottom = document.createElement("div");
      spacerBottom.style.height = `${(totalMessages - visibleEnd) * MESSAGE_HEIGHT_ESTIMATE}px`;
      contentContainer.appendChild(spacerBottom);

      scrollContainer.appendChild(contentContainer);
      container.appendChild(scrollContainer);

      if (visibleStart > 0) {
        const loadMoreBtn = document.createElement("button");
        loadMoreBtn.className = "load-more-btn";
        loadMoreBtn.textContent = `Daha fazla göster (${visibleStart} mesaj)`;
        loadMoreBtn.onclick = (): void => {
          loadMoreMessages(provider, container, callbacks);
        };
        container.insertBefore(loadMoreBtn, scrollContainer);
      }

      scheduleScrollToBottom(container, shouldStickToBottom);
    } else {
      renderStates.delete(provider);
      items.forEach((msg) => {
        const msgAttachments = attachmentsByMessage[msg.id] ?? [];
        const bubble = createMessageBubble(
          msg,
          provider,
          attachmentsBasePath,
          msgAttachments,
          callbacks
        );
        container.appendChild(bubble);
      });

      scheduleScrollToBottom(container, shouldStickToBottom);
    }

    renderSnapshots.set(provider, nextSnapshot);
    renderPayloads.set(provider, {
      conversationId,
      messages: items,
      attachmentsByMessage,
      needsVirtualization,
    });

    return { lastMessage: lastAssistant?.text ?? lastAssistant?.content ?? "" };
  } catch (_err) {
    resetMessageRenderState(provider);
    container.innerHTML = '<div class="message-placeholder">Mesajlar okunamadı.</div>';
    return { lastMessage: "" };
  }
}

function loadMoreMessages(
  provider: string,
  container: HTMLElement,
  callbacks: RenderCallbacks
): void {
  const state = renderStates.get(provider);
  if (!state) return;

  const newVisibleStart = Math.max(0, state.visibleStart - VISIBLE_MESSAGE_COUNT);
  if (newVisibleStart === state.visibleStart) return;

  const additionalMessages = state.allMessages.slice(newVisibleStart, state.visibleStart);

  const scrollContainer = container.querySelector(".msg-virtual-scroll");
  if (!(scrollContainer instanceof HTMLElement)) return;
  const contentContainer = scrollContainer.querySelector(".msg-virtual-content");
  if (!(contentContainer instanceof HTMLElement)) return;

  const previousHeight = contentContainer.scrollHeight;
  const previousScrollTop = scrollContainer.scrollTop;

  const spacerTop = contentContainer.firstChild;
  if (spacerTop instanceof HTMLElement) {
    spacerTop.style.height = `${newVisibleStart * MESSAGE_HEIGHT_ESTIMATE}px`;
  }

  const fragment = document.createDocumentFragment();
  additionalMessages.forEach((msg) => {
    const msgAttachments = state.attachmentsByMessage[msg.id] ?? [];
    const bubble = createMessageBubble(
      msg,
      provider,
      state.attachmentsBasePath,
      msgAttachments,
      callbacks
    );
    fragment.appendChild(bubble);
  });

  const firstVisibleBubble = contentContainer.children[1];
  if (firstVisibleBubble) {
    contentContainer.insertBefore(fragment, firstVisibleBubble);
  }

  const nextHeight = contentContainer.scrollHeight;
  scrollContainer.scrollTop = getScrollTopAfterPrepend({
    previousScrollTop,
    previousHeight,
    nextHeight,
  });

  state.visibleStart = newVisibleStart;
  state.scrollTop = scrollContainer.scrollTop;

  const loadMoreBtn = container.querySelector(".load-more-btn");
  if (loadMoreBtn) {
    if (newVisibleStart === 0) {
      loadMoreBtn.remove();
    } else {
      loadMoreBtn.textContent = `Daha fazla göster (${newVisibleStart} mesaj)`;
    }
  }
}

interface MessageData {
  id: string;
  role: string;
  content?: string;
  text?: string;
  author?: string;
  createdAt?: number;
}

interface AttachmentData {
  messageId: string;
  originalName?: string;
  storedName?: string;
  storedPath?: string;
}

interface DbMessagesResult {
  data?: MessageItem[];
}

interface DbAttachmentsResult {
  data?: AttachmentData[];
  success?: boolean;
}

interface OpenPathResult {
  success?: boolean;
  message?: string;
}

function isMessageItem(value: unknown): value is MessageItem {
  if (value === null || value === undefined || typeof value !== "object") {
    return false;
  }
  const maybe = value as Record<string, unknown>;
  return (
    typeof maybe["id"] === "string" &&
    typeof maybe["role"] === "string" &&
    (maybe["content"] === undefined || typeof maybe["content"] === "string") &&
    (maybe["text"] === undefined || typeof maybe["text"] === "string") &&
    (maybe["author"] === undefined || typeof maybe["author"] === "string") &&
    (maybe["createdAt"] === undefined || typeof maybe["createdAt"] === "number")
  );
}

function isAttachmentData(value: unknown): value is AttachmentData {
  if (value === null || value === undefined || typeof value !== "object") {
    return false;
  }
  const maybe = value as Record<string, unknown>;
  return (
    typeof maybe["messageId"] === "string" &&
    (maybe["originalName"] === undefined || typeof maybe["originalName"] === "string") &&
    (maybe["storedName"] === undefined || typeof maybe["storedName"] === "string") &&
    (maybe["storedPath"] === undefined || typeof maybe["storedPath"] === "string")
  );
}

function isDbMessagesResult(value: unknown): value is DbMessagesResult {
  if (value === null || value === undefined || typeof value !== "object") {
    return false;
  }
  const maybe = value as Record<string, unknown>;
  return maybe["data"] === undefined || Array.isArray(maybe["data"]);
}

function isDbAttachmentsResult(value: unknown): value is DbAttachmentsResult {
  if (value === null || value === undefined || typeof value !== "object") {
    return false;
  }
  const maybe = value as Record<string, unknown>;
  const dataValid = maybe["data"] === undefined || Array.isArray(maybe["data"]);
  const successValid = maybe["success"] === undefined || typeof maybe["success"] === "boolean";
  return dataValid && successValid;
}

function isOpenPathResult(value: unknown): value is OpenPathResult {
  if (value === null || value === undefined || typeof value !== "object") {
    return false;
  }
  const maybe = value as Record<string, unknown>;
  const successValid = maybe["success"] === undefined || typeof maybe["success"] === "boolean";
  const messageValid = maybe["message"] === undefined || typeof maybe["message"] === "string";
  return successValid && messageValid;
}

function createMessageBubble(
  msg: MessageData,
  provider: string,
  attachmentsBasePath: string,
  msgAttachments: AttachmentData[],
  callbacks: RenderCallbacks
): HTMLElement {
  const bubble = document.createElement("div");
  bubble.className = `msg-bubble ${msg.role === "assistant" ? "msg-ai" : "msg-user"}`;

  const messageText = msg.content ?? msg.text ?? "";

  const header = document.createElement("div");
  header.className = "msg-header";

  const meta = document.createElement("div");
  meta.className = "msg-meta";
  meta.textContent = msg.author ?? msg.role;
  header.appendChild(meta);

  if (msg.createdAt !== undefined) {
    const time = document.createElement("div");
    time.className = "msg-time";
    time.textContent = formatTimestamp(msg.createdAt);
    header.appendChild(time);
  }

  bubble.appendChild(header);

  const text = document.createElement("div");
  text.className = "msg-text";
  text.textContent = messageText;
  bubble.appendChild(text);

  if (msgAttachments.length > 0) {
    const attWrap = document.createElement("div");
    attWrap.className = "msg-attachments";

    msgAttachments.forEach((att: AttachmentData) => {
      const link = document.createElement("button");
      link.className = "attachment-link";
      link.textContent = `📎 ${att.originalName ?? att.storedName ?? "dosya"}`;
      link.addEventListener("click", () => {
        const filePath =
          att.storedPath ??
          `${attachmentsBasePath}/${att.messageId}/${att.storedName ?? "unknown"}`;
        void openAttachmentByPath(filePath);
      });
      attWrap.appendChild(link);
    });

    bubble.appendChild(attWrap);
  }

  if (callbacks.onContextMenu) {
    bubble.addEventListener("contextmenu", (e) => {
      callbacks.onContextMenu?.(e, { provider, text: messageText });
    });
  }

  if (callbacks.onDoubleClick) {
    bubble.addEventListener("dblclick", () => {
      callbacks.onDoubleClick?.({ provider, text: messageText });
    });
  }

  return bubble;
}

async function openAttachmentByPath(filePath: string): Promise<void> {
  if (filePath === "") return;

  try {
    const electronApi = window.electronAPI;
    if (electronApi === undefined) {
      throw new Error("electronAPI bulunamadı");
    }
    const openPath = electronApi.openPath;
    const rawRes: unknown =
      typeof openPath === "function"
        ? await openPath(filePath)
        : { success: false, message: "açılamadı" };
    const res = isOpenPathResult(rawRes) ? rawRes : null;
    if (res?.success !== true) {
      throw new Error(res?.message ?? "açılamadı");
    }
  } catch (err) {
    Logger.warn(LogCategory.ANALYZE, `Dosya açılamadı: ${getErrorMessage(err)}`);
  }
}
