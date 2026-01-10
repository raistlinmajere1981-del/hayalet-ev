/**
 * UI Helpers - Merkezi UI yardımcı fonksiyonları
 * 
 * Bu modül sayfalar arasında tekrarlanan UI güncelleme mantığını
 * merkezi bir yerde toplar.
 */

import { SettingsManager } from "./settings-manager.js";
import { SlotController, SlotState } from "./slot-controller.js";
import { AppState } from "./app-state.js";

/**
 * Slot durumunu hesapla
 * @param {string} slot - 'ai1' veya 'ai2'
 * @returns {{ hasAccount: boolean, connected: boolean, state: string, isTransitioning: boolean, isError: boolean, urlExcluded: boolean }}
 */
export function getSlotStatus(slot) {
  const settings = SettingsManager.getSnapshot();
  const hasAccount = !!settings?.slots?.[slot]?.accountId;
  const slotState = SlotController.getState(slot);
  
  return {
    hasAccount,
    connected: slotState?.state === SlotState.CONNECTED,
    state: slotState?.state || SlotState.EMPTY,
    isTransitioning: slotState?.state === SlotState.CONNECTING || slotState?.state === SlotState.DISCONNECTING,
    isError: slotState?.state === SlotState.ERROR,
    urlExcluded: slotState?.urlExcluded || false,
  };
}

/**
 * Tüm slot'ların durumunu al
 * @returns {{ ai1: ReturnType<typeof getSlotStatus>, ai2: ReturnType<typeof getSlotStatus> }}
 */
export function getAllSlotStatus() {
  return {
    ai1: getSlotStatus("ai1"),
    ai2: getSlotStatus("ai2"),
  };
}

/**
 * Her iki AI'nin bağlı olup olmadığını kontrol et
 * @returns {boolean}
 */
export function areBothAIsConnected() {
  return SlotController.isConnected("ai1") && SlotController.isConnected("ai2");
}

/**
 * En az bir AI'nin bağlı olup olmadığını kontrol et
 * @returns {boolean}
 */
export function isAnyAIConnected() {
  return SlotController.isConnected("ai1") || SlotController.isConnected("ai2");
}

/**
 * Bağlı AI slot'larını listele
 * @returns {string[]}
 */
export function getConnectedAIs() {
  const connected = [];
  if (SlotController.isConnected("ai1")) connected.push("ai1");
  if (SlotController.isConnected("ai2")) connected.push("ai2");
  return connected;
}

/**
 * Status dot stilini güncelle
 * @param {HTMLElement|null} dotEl - Status dot elementi
 * @param {string} slot - 'ai1', 'ai2' veya 'user'
 */
export function updateStatusDot(dotEl, slot) {
  if (!dotEl) return;
  
  if (slot === "user") {
    // User her zaman bağlı
    dotEl.classList.add("connected");
    dotEl.style.backgroundColor = "#4CAF50"; // Green
    return;
  }
  
  const status = getSlotStatus(slot);
  
  if (!status.hasAccount) {
    // Slot boş - gri
    dotEl.classList.remove("connected");
    dotEl.style.backgroundColor = "#999";
  } else if (status.isError) {
    // Hata - kırmızı
    dotEl.classList.remove("connected");
    dotEl.style.backgroundColor = "#e74c3c";
  } else if (status.isTransitioning) {
    // Geçiş durumunda - sarı
    dotEl.classList.remove("connected");
    dotEl.style.backgroundColor = "#f39c12";
  } else if (status.connected) {
    // Bağlı - yeşil
    dotEl.classList.add("connected");
    dotEl.style.backgroundColor = "#4CAF50";
  } else {
    // Assigned ama bağlı değil - turuncu
    dotEl.classList.remove("connected");
    dotEl.style.backgroundColor = "#FFA726";
  }
}

/**
 * Status text'ini güncelle
 * @param {HTMLElement|null} textEl - Status text elementi
 * @param {string} slot - 'ai1', 'ai2' veya 'user'
 */
export function updateStatusText(textEl, slot) {
  if (!textEl) return;
  
  if (slot === "user") {
    textEl.textContent = "Bağlı";
    return;
  }
  
  const status = getSlotStatus(slot);
  
  if (!status.hasAccount) {
    textEl.textContent = "Hesap yok";
  } else if (status.isError) {
    textEl.textContent = "Hata";
  } else if (status.state === SlotState.CONNECTING) {
    textEl.textContent = "Bağlanıyor...";
  } else if (status.state === SlotState.DISCONNECTING) {
    textEl.textContent = "Kesiliyor...";
  } else if (status.connected) {
    textEl.textContent = status.urlExcluded ? "Bağlı (URL hariç)" : "Bağlı";
  } else {
    textEl.textContent = "Bağlı değil";
  }
}

/**
 * Toggle butonunu güncelle
 * @param {HTMLButtonElement|null} btnEl - Toggle button elementi
 * @param {string} slot - 'ai1' veya 'ai2'
 */
export function updateToggleButton(btnEl, slot) {
  if (!btnEl) return;
  
  const status = getSlotStatus(slot);
  
  if (!status.hasAccount) {
    btnEl.textContent = "Hesap Ata";
    btnEl.disabled = true;
    btnEl.title = "Settings'ten hesap atayın";
  } else if (status.isTransitioning) {
    btnEl.textContent = status.state === SlotState.CONNECTING ? "Bağlanıyor..." : "Kesiliyor...";
    btnEl.disabled = true;
  } else if (status.connected) {
    btnEl.textContent = "Bağlantıyı Kes";
    btnEl.disabled = false;
    btnEl.classList.remove("btn-primary");
    btnEl.classList.add("btn-secondary");
  } else {
    btnEl.textContent = "Bağlan";
    btnEl.disabled = false;
    btnEl.classList.remove("btn-secondary");
    btnEl.classList.add("btn-primary");
  }
}

/**
 * Slot için nickname al
 * @param {string} slot - 'ai1', 'ai2' veya 'user'
 * @returns {string}
 */
export function getNickname(slot) {
  return AppState.getNickname(slot);
}

/**
 * Avatar yükle ve elementi güncelle
 * @param {HTMLElement|null} avatarEl - Avatar elementi
 * @param {string} slot - 'ai1', 'ai2' veya 'user'
 */
export async function updateAvatar(avatarEl, slot) {
  if (!avatarEl) return;
  
  const settings = SettingsManager.getSnapshot();
  let avatarPath = "";
  
  if (slot === "user") {
    avatarPath = settings.user?.avatarPath || "";
  } else {
    const accountId = settings.slots?.[slot]?.accountId;
    const account = accountId ? settings.accounts?.find((a) => a.id === accountId) : null;
    avatarPath = account?.avatarPath || "";
  }
  
  if (!avatarPath) {
    avatarEl.innerHTML = "";
    avatarEl.style.backgroundImage = "";
    return;
  }
  
  try {
    if (window.electronAPI?.readFile) {
      const imageData = await window.electronAPI.readFile(avatarPath);
      if (imageData) {
        const ext = avatarPath.split(".").pop().toLowerCase();
        const mimeTypes = {
          jpg: "image/jpeg",
          jpeg: "image/jpeg",
          png: "image/png",
          gif: "image/gif",
          webp: "image/webp",
        };
        const mimeType = mimeTypes[ext] || "image/png";
        avatarEl.innerHTML = `<img src="data:${mimeType};base64,${imageData}" alt="${slot} avatar" style="width: 100%; height: 100%; object-fit: cover;">`;
      }
    }
  } catch {
    avatarEl.innerHTML = "";
    avatarEl.style.backgroundImage = "";
  }
  
  // Opacity based on connection state
  const status = getSlotStatus(slot);
  if (slot !== "user" && status.hasAccount && !status.connected) {
    avatarEl.style.opacity = "0.5";
  } else {
    avatarEl.style.opacity = "1";
  }
}
