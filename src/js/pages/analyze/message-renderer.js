/**
 * MessageRenderer - Analyze sayfası mesaj render işlemleri
 * 
 * Bu modül conversation mesajlarını render eder:
 * - DOM'a mesaj bubble'ları ekleme
 * - Attachment link'leri oluşturma
 * - Base64 decode
 */

import { LogManager } from "../../modules/log-manager.js";
import { AppState } from "../../modules/app-state.js";

/**
 * Base64 encoded string'i decode et
 * @param {string} data - Base64 encoded string
 * @returns {string}
 */
export function decodeBase64(data) {
  try {
    const binary = atob(data);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) {
      bytes[i] = binary.charCodeAt(i);
    }
    const decoder = new TextDecoder("utf-8");
    return decoder.decode(bytes);
  } catch (_err) {
    return "";
  }
}

/**
 * Mesajları render et
 * @param {string} provider - Slot ID (ai1/ai2)
 * @param {Object} callbacks - { onContextMenu, onDoubleClick }
 * @returns {Promise<{lastMessage: string}>}
 */
export async function renderMessages(provider, callbacks = {}) {
  const container = document.getElementById(`messages-${provider}`);
  const select = document.getElementById(`conversation-${provider}`);
  const filter = document.getElementById(`filter-count-${provider}`);
  
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

    const messages = await window.electronAPI?.dbGetMessages?.({
      accountId: accountInfo.id,
      conversationId,
    });
    
    if (!messages || !messages.length) {
      container.innerHTML = '<div class="message-placeholder">Mesaj bulunamadı.</div>';
      return { lastMessage: "" };
    }
    
    let items = messages;
    
    const limitVal = filter?.value;
    if (limitVal && limitVal !== "all") {
      const n = parseInt(limitVal, 10);
      if (!Number.isNaN(n)) {
        items = items.slice(-n);
      }
    }
    
    items.forEach((msg) => {
      const bubble = createMessageBubble(msg, provider, conversationId, callbacks);
      container.appendChild(bubble);
    });
    
    if (!items.length) {
      container.innerHTML = '<div class="message-placeholder">Mesaj bulunamadı.</div>';
    }
    
    const lastAssistant = [...items]
      .reverse()
      .find((m) => m.role === "assistant" && (m.text || "").trim());
    
    container.scrollTop = container.scrollHeight;
    
    return { lastMessage: lastAssistant?.text || "" };
  } catch (_err) {
    container.innerHTML = '<div class="message-placeholder">Mesajlar okunamadı.</div>';
    return { lastMessage: "" };
  }
}

/**
 * Tek bir mesaj bubble'ı oluştur
 * @param {Object} msg - Mesaj objesi
 * @param {string} provider - Slot ID
 * @param {string} folder - Archive klasörü
 * @param {Object} callbacks - { onContextMenu, onDoubleClick }
 * @returns {HTMLElement}
 */
function createMessageBubble(msg, provider, folder, callbacks) {
  const bubble = document.createElement("div");
  bubble.className = `msg-bubble ${msg.role === "assistant" ? "msg-ai" : "msg-user"}`;
  
  const meta = document.createElement("div");
  meta.className = "msg-meta";
  meta.textContent = msg.author || msg.role || "";
  bubble.appendChild(meta);
  
  const text = document.createElement("div");
  text.className = "msg-text";
  text.textContent = msg.text || "";
  bubble.appendChild(text);
  
  if (Array.isArray(msg.attachments) && msg.attachments.length && msg.role !== "assistant") {
    const attWrap = document.createElement("div");
    attWrap.className = "msg-attachments";
    
    msg.attachments.forEach((att) => {
      const link = document.createElement("button");
      link.className = "attachment-link";
      link.textContent = att.name || att.renamedName || "dosya";
      link.addEventListener("click", () => openAttachment(att, folder));
      attWrap.appendChild(link);
    });
    
    bubble.appendChild(attWrap);
  }
  
  if (callbacks.onContextMenu) {
    bubble.addEventListener("contextmenu", (e) => {
      callbacks.onContextMenu(e, { provider, text: msg.text || "" });
    });
  }
  
  if (callbacks.onDoubleClick) {
    bubble.addEventListener("dblclick", () => {
      callbacks.onDoubleClick({ provider, text: msg.text || "" });
    });
  }
  
  return bubble;
}

/**
 * Attachment dosyasını aç
 * @param {Object} att - Attachment objesi
 * @param {string} folder - Archive klasörü
 */
async function openAttachment(att, folder) {
  const targetPath = att.path || (folder ? `${folder}/${att.renamedName || att.name}` : "");
  
  if (!targetPath) return;
  
  try {
    const res = await window.electronAPI?.openPath?.(targetPath);
    if (!res?.success) {
      throw new Error(res?.message || "açılamadı");
    }
  } catch (err) {
    LogManager.addEvent("analyze", "warning", `Ek açılamadı: ${err.message}`);
  }
}
