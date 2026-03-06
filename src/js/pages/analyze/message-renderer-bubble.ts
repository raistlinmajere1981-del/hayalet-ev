import { LogCategory } from "@shared/logging-core";
import { getErrorMessage } from "@shared/index.js";
import { Logger } from "../../modules/logger/index.js";
import {
  isOpenPathResult,
  type AttachmentData,
  type MessageItem,
} from "./message-renderer-types.js";

interface BubbleCallbacks {
  onContextMenu?: (e: MouseEvent, data: { provider: string; text: string }) => void;
  onDoubleClick?: (data: { provider: string; text: string }) => void;
}

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

export function createMessageBubble(
  msg: MessageItem,
  provider: string,
  attachmentsBasePath: string,
  msgAttachments: AttachmentData[],
  callbacks: BubbleCallbacks
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
