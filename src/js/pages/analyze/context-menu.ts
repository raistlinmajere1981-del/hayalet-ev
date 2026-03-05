/**
 * ContextMenu - Analyze sayfası context menu ve modal işlemleri
 *
 * Bu modül mesaj context menu ve okuma modalını yönetir:
 * - Context menu oluşturma ve gösterme
 * - Read modal yönetimi
 * - Context action handling
 */

import { AppState } from "../../modules/app-state.js";

interface ContextPayload {
  provider: string;
  text?: string;
}

type ActionCallback = () => void;

let contextMenuEl: HTMLDivElement | null = null;
let readModalEl: HTMLElement | null = null;

export function initContextMenu(): void {
  contextMenuEl = document.createElement("div");
  contextMenuEl.className = "msg-context hidden";
  contextMenuEl.innerHTML = `
    <button data-action="read">Okuma modu</button>
    <button data-action="prepend">Mesajın başına ekle</button>
    <button data-action="append">Mesajın sonuna ekle</button>
  `;
  document.body.appendChild(contextMenuEl);

  document.addEventListener("click", hideContextMenu);
}

export function initReadModal(): void {
  readModalEl = document.getElementById("read-modal");
  const closeBtn = document.getElementById("read-modal-close");
  closeBtn?.addEventListener("click", hideReadModal);
}

export function showContextMenu(
  event: MouseEvent,
  payload: ContextPayload,
  onAction?: ActionCallback
): void {
  event.preventDefault();

  if (!contextMenuEl) return;

  contextMenuEl.dataset["provider"] = payload.provider;
  contextMenuEl.dataset["text"] = payload.text ?? "";
  contextMenuEl.style.left = `${event.pageX}px`;
  contextMenuEl.style.top = `${event.pageY}px`;
  contextMenuEl.classList.remove("hidden");

  contextMenuEl.querySelectorAll("button").forEach((btn) => {
    btn.onclick = (e): void => {
      const target = e.currentTarget as HTMLButtonElement;
      const action = target.dataset["action"] ?? "";
      handleContextAction(action, payload, onAction);
      hideContextMenu();
    };
  });
}

function hideContextMenu(): void {
  contextMenuEl?.classList.add("hidden");
}

function handleContextAction(
  action: string,
  payload: ContextPayload,
  onAction?: ActionCallback
): void {
  if (action === "read") {
    showReadModal(payload);
    return;
  }

  if (action === "prepend" || action === "append") {
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

    onAction?.();
  }
}

export function showReadModal(payload: ContextPayload): void {
  if (!readModalEl) return;

  const body = document.getElementById("read-modal-body");
  if (body) {
    body.textContent = payload.text ?? "";
    body.scrollTop = 0;
  }

  readModalEl.classList.remove("hidden");
}

function hideReadModal(): void {
  readModalEl?.classList.add("hidden");
}
