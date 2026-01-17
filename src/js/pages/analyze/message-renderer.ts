/**
 * MessageRenderer - Analyze sayfası mesaj render işlemleri
 *
 * Bu modül conversation mesajlarını render eder:
 * - DOM'a mesaj bubble'ları ekleme
 * - Attachment link'leri oluşturma (conversation klasöründen)
 * - Tarih-saat gösterimi
 */

import { LogManager } from "../../modules/log-manager.js";
import { getErrorMessage } from "../../types/index.js";
import { AppState } from "../../modules/app-state.js";

function formatTimestamp(timestamp: number | undefined): string {
  if (!timestamp) return "";
  const d = new Date(timestamp);
  return d.toLocaleString("tr-TR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

interface RenderCallbacks {
  onContextMenu?: (e: MouseEvent, data: { provider: string; text: string }) => void;
  onDoubleClick?: (data: { provider: string; text: string }) => void;
}

export async function renderMessages(provider: string, callbacks: RenderCallbacks = {}): Promise<{ lastMessage: string }> {
  const container = document.getElementById(`messages-${provider}`);
  const select = document.getElementById(`conversation-${provider}`) as HTMLSelectElement | null;
  const filter = document.getElementById(`filter-count-${provider}`) as HTMLSelectElement | null;

  if (!container) return { lastMessage: "" };

  container.innerHTML = "";

  // Select element yoksa veya seçili option yoksa placeholder göster
  if (!select) {
    container.innerHTML = '<div class="message-placeholder">Sohbet listesi yükleniyor...</div>';
    return { lastMessage: "" };
  }

  const selected = select.selectedOptions?.[0];
  const folder = selected?.dataset?.folder || "";

  if (!selected || selected.value === "new") {
    container.innerHTML = '<div class="message-placeholder">Yeni sohbet başlatılıyor...</div>';
    return { lastMessage: "" };
  }

  if (!folder) {
    container.innerHTML = '<div class="message-placeholder">Sohbet seçiniz.</div>';
    return { lastMessage: "" };
  }

  try {
    // DB'den mesajları çek
    const conversationId = selected?.value;
    const accountInfo = AppState.getAccountForSlot(provider);

    if (!accountInfo?.id) {
      container.innerHTML = '<div class="message-placeholder">Hesap bilgisi bulunamadı.</div>';
      return { lastMessage: "" };
    }

    type MessageItem = { id: string; role: string; content?: string; text?: string; author?: string; createdAt?: number };
    const messages = await window.electronAPI?.dbGetMessages?.({
      accountId: accountInfo.id,
      conversationId,
    }) as MessageItem[] | undefined;

    if (!messages || !messages.length) {
      container.innerHTML = '<div class="message-placeholder">Mesaj bulunamadı.</div>';
      return { lastMessage: "" };
    }

    // Conversation attachments'larını DB'den al
    const attachmentsByMessage: Record<string, any[]> = {};
    try {
      const attachments = await window.electronAPI?.dbGetAttachments?.({
        accountId: accountInfo.id,
        conversationId,
      }) as Array<{ messageId: string }> | undefined;
      if (attachments && attachments.length) {
        // messageId'ye göre grupla (DB camelCase döndürüyor)
        attachments.forEach((att) => {
          if (!attachmentsByMessage[att.messageId]) {
            attachmentsByMessage[att.messageId] = [];
          }
          attachmentsByMessage[att.messageId].push(att);
        });
      }
    } catch (_e) {
      // Attachments alınamazsa boş
    }

    const attachmentsBasePath = `data/${accountInfo.id}/attachments/${conversationId}`;

    let items = messages;

    const limitVal = filter?.value;
    if (limitVal && limitVal !== "all") {
      const n = parseInt(limitVal, 10);
      if (!Number.isNaN(n)) {
        items = items.slice(-n);
      }
    }

    items.forEach((msg) => {
      const msgAttachments = attachmentsByMessage[msg.id] || [];
      const bubble = createMessageBubble(
        msg,
        provider,
        attachmentsBasePath,
        msgAttachments,
        callbacks
      );
      container.appendChild(bubble);
    });

    if (!items.length) {
      container.innerHTML = '<div class="message-placeholder">Mesaj bulunamadı.</div>';
    }

    const lastAssistant = [...items]
      .reverse()
      .find((m) => m.role === "assistant" && (m.content || "").trim());

    container.scrollTop = container.scrollHeight;

    return { lastMessage: lastAssistant?.text || "" };
  } catch (_err) {
    container.innerHTML = '<div class="message-placeholder">Mesajlar okunamadı.</div>';
    return { lastMessage: "" };
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

function createMessageBubble(
  msg: MessageData,
  provider: string,
  attachmentsBasePath: string,
  msgAttachments: AttachmentData[],
  callbacks: RenderCallbacks
): HTMLElement {
  const bubble = document.createElement("div");
  bubble.className = `msg-bubble ${msg.role === "assistant" ? "msg-ai" : "msg-user"}`;

  // Mesaj içeriği - DB'de 'content' alanında saklanıyor
  const messageText = msg.content || msg.text || "";

  // Header: meta (author) + timestamp
  const header = document.createElement("div");
  header.className = "msg-header";

  const meta = document.createElement("div");
  meta.className = "msg-meta";
  meta.textContent = msg.author || msg.role || "";
  header.appendChild(meta);

  // Tarih-saat gösterimi (DB camelCase döndürüyor)
  if (msg.createdAt) {
    const time = document.createElement("div");
    time.className = "msg-time";
    time.textContent = formatTimestamp(msg.createdAt);
    header.appendChild(time);
  }

  bubble.appendChild(header);

  // Mesaj içeriği
  const text = document.createElement("div");
  text.className = "msg-text";
  text.textContent = messageText;
  bubble.appendChild(text);

  // Mesaja ait attachments (DB'den - camelCase alanlar)
  if (msgAttachments && msgAttachments.length > 0) {
    const attWrap = document.createElement("div");
    attWrap.className = "msg-attachments";

    msgAttachments.forEach((att: AttachmentData) => {
      const link = document.createElement("button");
      link.className = "attachment-link";
      link.textContent = `📎 ${att.originalName || att.storedName || "dosya"}`;
      link.addEventListener("click", () => {
        const filePath =
          att.storedPath || `${attachmentsBasePath}/${att.messageId}/${att.storedName}`;
        openAttachmentByPath(filePath);
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

async function openAttachmentByPath(filePath: string) {
  if (!filePath) return;

  try {
    const res = await window.electronAPI?.openPath?.(filePath);
    if (!res?.success) {
      throw new Error(res?.message || "açılamadı");
    }
  } catch (err) {
    LogManager.addEvent("analyze", "warning", `Dosya açılamadı: ${getErrorMessage(err)}`);
  }
}
