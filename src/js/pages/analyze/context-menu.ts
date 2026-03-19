import { AppState } from "../../modules/app-state.js";
import {
  createHiddenClassOverlayController,
  OVERLAY_GROUPS,
  OVERLAY_KINDS,
  type ManagedOverlayController,
} from "../../ui/overlay-system.js";

export interface MessageActionPayload {
  provider: string;
  text?: string;
}

export type MessageAction = "read" | "prepend" | "append";
type ActionCallback = () => void;

let readModalController: ManagedOverlayController | null = null;

export function initReadModal(): void {
  const readModalEl = document.getElementById("read-modal");
  if (readModalEl instanceof HTMLElement && readModalController === null) {
    readModalController = createHiddenClassOverlayController({
      id: "analyze-read-modal",
      element: readModalEl,
      kind: OVERLAY_KINDS.workspace,
      exclusiveGroup: OVERLAY_GROUPS.workspace,
      syncAriaHidden: false,
    });
  }
  const closeBtn = document.getElementById("read-modal-close");
  closeBtn?.addEventListener("click", hideReadModal);
}

export function applyMessageAction(
  action: MessageAction,
  payload: MessageActionPayload,
  onAction?: ActionCallback
): void {
  if (action === "read") {
    showReadModal(payload);
    return;
  }

  const textarea = document.getElementById("compose-input") as HTMLTextAreaElement | null;
  if (!textarea) return;

  const nickname = AppState.getNickname(payload.provider);
  const prefix = `${nickname} : `;
  const current = textarea.value;

  const newVal =
    action === "prepend"
      ? `${prefix}${payload.text ?? ""}\n${current}`.trim()
      : `${current}\n${prefix}${payload.text ?? ""}`.trim();

  textarea.value = newVal;

  textarea.dispatchEvent(new Event("input", { bubbles: true }));
  textarea.focus();
  textarea.setSelectionRange(textarea.value.length, textarea.value.length);
  onAction?.();
}

export function showReadModal(payload: MessageActionPayload): void {
  if (readModalController === null) return;

  const body = document.getElementById("read-modal-body");
  if (body) {
    body.textContent = payload.text ?? "";
    body.scrollTop = 0;
  }

  readModalController.open();
}

function hideReadModal(): void {
  readModalController?.close();
}
