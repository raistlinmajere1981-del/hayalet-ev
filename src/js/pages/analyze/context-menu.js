/**
 * ContextMenu - Analyze sayfası context menu ve modal işlemleri
 * 
 * Bu modül mesaj context menu ve okuma modalını yönetir:
 * - Context menu oluşturma ve gösterme
 * - Read modal yönetimi
 * - Context action handling
 */

import { AppState } from "../../modules/app-state.js";

let contextMenuEl = null;
let readModalEl = null;

/**
 * Context menu'yu başlat
 */
export function initContextMenu() {
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

/**
 * Read modal'ı başlat
 */
export function initReadModal() {
  readModalEl = document.getElementById("read-modal");
  const closeBtn = document.getElementById("read-modal-close");
  closeBtn?.addEventListener("click", hideReadModal);
}

/**
 * Context menu'yu göster
 * @param {MouseEvent} event - Mouse event
 * @param {Object} payload - { provider, text }
 * @param {Function} onAction - Action callback
 */
export function showContextMenu(event, payload, onAction) {
  event.preventDefault();
  
  if (!contextMenuEl) return;
  
  contextMenuEl.dataset.provider = payload.provider;
  contextMenuEl.dataset.text = payload.text || "";
  contextMenuEl.style.left = `${event.pageX}px`;
  contextMenuEl.style.top = `${event.pageY}px`;
  contextMenuEl.classList.remove("hidden");
  
  contextMenuEl.querySelectorAll("button").forEach((btn) => {
    btn.onclick = (e) => {
      const action = e.currentTarget.dataset.action;
      handleContextAction(action, payload, onAction);
      hideContextMenu();
    };
  });
}

/**
 * Context menu'yu gizle
 */
function hideContextMenu() {
  contextMenuEl?.classList.add("hidden");
}

/**
 * Context action'ı işle
 * @param {string} action - Action tipi (read, prepend, append)
 * @param {Object} payload - { provider, text }
 * @param {Function} onAction - Ek action callback
 */
function handleContextAction(action, payload, onAction) {
  if (action === "read") {
    showReadModal(payload);
    return;
  }
  
  if (action === "prepend" || action === "append") {
    const textarea = document.getElementById("compose-input");
    if (!textarea) return;
    
    const nickname = AppState.getNickname(payload.provider);
    const prefix = `${nickname} : `;
    const current = textarea.value || "";
    
    const newVal = action === "prepend"
      ? `${prefix}${payload.text}\n${current}`.trim()
      : `${current}\n${prefix}${payload.text}`.trim();
    
    textarea.value = newVal;
    
    onAction?.();
  }
}

/**
 * Read modal'ı göster
 * @param {Object} payload - { provider, text }
 */
export function showReadModal(payload) {
  if (!readModalEl) return;
  
  const body = document.getElementById("read-modal-body");
  if (body) {
    body.textContent = payload.text || "";
    body.scrollTop = 0;
  }
  
  readModalEl.classList.remove("hidden");
}

/**
 * Read modal'ı gizle
 */
function hideReadModal() {
  readModalEl?.classList.add("hidden");
}
