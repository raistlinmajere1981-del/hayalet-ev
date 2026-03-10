import { LogCategory } from "@shared/logging-core";
import { getErrorMessage } from "@shared/index.js";
import { formatErrorWithDetail } from "../../../../shared/i18n/error-detail.js";
import { Logger } from "../../modules/logger/index.js";
import { AppI18n } from "../../modules/i18n/index.js";
import { resolveIntlLocale } from "../../../../shared/i18n/locale.js";
import {
  isOpenPathResult,
  type AttachmentData,
  type MessageItem,
} from "./message-renderer-types.js";

interface BubbleCallbacks {
  onMessageAction?: (
    action: "read" | "prepend" | "append",
    data: { provider: string; text: string }
  ) => void;
}

function analyzeBubbleT(key: string, params?: Record<string, string | number>): string {
  return AppI18n.t(`app.analyze.bubble.${key}`, params);
}

function formatTimestamp(timestamp: number | undefined): string {
  if (timestamp === undefined || Number.isNaN(timestamp)) return "";
  const d = new Date(timestamp);
  return d.toLocaleString(resolveIntlLocale(AppI18n.getLocale()), {
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

  const headerRight = document.createElement("div");
  headerRight.className = "msg-header__right";

  if (callbacks.onMessageAction && messageText.trim() !== "") {
    const actions = document.createElement("div");
    actions.className = "msg-actions";

    const actionConfigs: Array<{
      action: "read" | "prepend" | "append";
      icon: string;
      title: string;
    }> = [
      { action: "read", icon: "👁", title: analyzeBubbleT("actions.read") },
      { action: "prepend", icon: "↥", title: analyzeBubbleT("actions.prepend") },
      { action: "append", icon: "↧", title: analyzeBubbleT("actions.append") },
    ];

    actionConfigs.forEach(({ action, icon, title }) => {
      const button = document.createElement("button");
      button.type = "button";
      button.className = "msg-action-btn";
      button.textContent = icon;
      button.title = title;
      button.setAttribute("aria-label", title);
      button.addEventListener("click", (event) => {
        event.preventDefault();
        event.stopPropagation();
        callbacks.onMessageAction?.(action, { provider, text: messageText });
      });
      actions.appendChild(button);
    });

    headerRight.appendChild(actions);
  }

  if (msg.createdAt !== undefined) {
    const time = document.createElement("div");
    time.className = "msg-time";
    time.textContent = formatTimestamp(msg.createdAt);
    headerRight.appendChild(time);
  }

  if (headerRight.childElementCount > 0) {
    header.appendChild(headerRight);
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
      link.textContent = `📎 ${att.originalName ?? att.storedName ?? analyzeBubbleT("attachmentFallback")}`;
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

  return bubble;
}

async function openAttachmentByPath(filePath: string): Promise<void> {
  if (filePath === "") return;

  try {
    const electronApi = window.electronAPI;
    if (electronApi === undefined) {
      throw new Error(analyzeBubbleT("errors.electronApiUnavailable"));
    }
    const openPath = electronApi.openPath;
    const rawRes: unknown =
      typeof openPath === "function"
        ? await openPath(filePath)
        : { success: false, message: analyzeBubbleT("errors.openFailed") };
    const res = isOpenPathResult(rawRes) ? rawRes : null;
    if (res?.success !== true) {
      throw new Error(formatErrorWithDetail(analyzeBubbleT("errors.openFailed"), res?.message));
    }
  } catch (err) {
    Logger.warn(
      LogCategory.ANALYZE,
      analyzeBubbleT("logs.openFailed", { message: getErrorMessage(err) })
    );
  }
}
