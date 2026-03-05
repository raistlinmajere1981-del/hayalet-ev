/**
 * Indicator Avatars
 *
 * Top bar'daki AI slot avatar göstergelerini yönetir.
 * Her slot için bağlantı durumu ve avatar görselini günceller.
 */

import { AppState } from "../modules/app-state.js";
import { getMimeTypeFromPath } from "../constants/index.js";
import { getErrorMessage } from "@shared/index.js";
import { Logger, LogCategory } from "../modules/logger/index.js";
import { SettingsManager } from "../modules/settings-manager.js";
import { SlotController } from "../modules/slot-controller.js";
import { WebviewManager } from "../modules/webview-manager.js";

export function updateIndicatorAvatars(): void {
  const getAvatar = (provider: string): string | undefined => AppState.getAvatar(provider);

  // AI0: bağlı değilse boş avatar, bağlıysa seçili provider logosu
  const ai0Connected = SlotController.isConnected("ai0");
  const ai0AvatarPath = ai0Connected === true ? getAvatar("ai0") : undefined;

  const map = {
    ai0: {
      el: document.getElementById("indicator-avatar-ai0"),
      path: ai0AvatarPath,
      connected: ai0Connected,
      nickname: AppState.getNickname("ai0"),
      isAsistan: true,
    },
    ai1: {
      el: document.getElementById("indicator-avatar-ai1"),
      path: getAvatar("ai1"),
      connected: SlotController.isConnected("ai1"),
      nickname: AppState.getNickname("ai1"),
      isAsistan: false,
    },
    ai2: {
      el: document.getElementById("indicator-avatar-ai2"),
      path: getAvatar("ai2"),
      connected: SlotController.isConnected("ai2"),
      nickname: AppState.getNickname("ai2"),
      isAsistan: false,
    },
  };

  /**
   * @param {string | undefined} filePath
   * @returns {Promise<string | null>}
   */
  const buildDataUrl = async (filePath: string | undefined): Promise<string | null> => {
    if (filePath === undefined || filePath === "" || window.electronAPI?.readFile === undefined)
      return null;
    try {
      const data = await window.electronAPI.readFile(filePath);
      if (data === null || data === "") return null;
      const mime = getMimeTypeFromPath(filePath);
      return `data:${mime};base64,${data}`;
    } catch (err) {
      return null;
    }
  };

  /**
   * @param {HTMLElement | null} el
   * @param {string | null} src
   * @param {boolean} connected
   */
  const applyAvatar = (
    el: HTMLElement | null,
    src: string | null,
    slotState: "empty" | "disconnected" | "connected"
  ): void => {
    if (el === null) return;
    if (src !== null && src !== "") {
      el.style.backgroundImage = `url('${src}')`;
      el.classList.remove("avatar-placeholder");
      el.textContent = "";
    } else {
      el.style.backgroundImage = "";
      el.classList.add("avatar-placeholder");
      el.textContent = "";
    }

    const cluster = el.closest(".indicator-cluster");
    if (!(cluster instanceof HTMLElement)) return;

    if (slotState === "empty") {
      el.style.opacity = "0.3";
      cluster.style.opacity = "0.5";
      cluster.style.pointerEvents = "none";
      cluster.classList.remove("is-connected");
    } else if (slotState === "disconnected") {
      el.style.opacity = "0.6";
      cluster.style.opacity = "0.7";
      cluster.style.pointerEvents = "none";
      cluster.classList.remove("is-connected");
    } else {
      el.style.opacity = "1";
      cluster.style.opacity = "1";
      cluster.style.pointerEvents = "auto";
      cluster.classList.add("is-connected");
    }
  };

  Object.entries(map).forEach(([provider, { el, path, isAsistan }]) => {
    if (!el) return;
    const providerKey = provider as "ai0" | "ai1" | "ai2";

    let slotState: "empty" | "disconnected" | "connected" = "empty";

    const settings = SettingsManager.getSnapshot();

    const asistanAccountId = settings.asistanSlot?.accountId ?? "";
    const slotAccountId = settings.slots[providerKey]?.accountId ?? "";
    const hasAccount = isAsistan ? asistanAccountId !== "" : slotAccountId !== "";
    const connected = SlotController.isConnected(provider);

    if (!hasAccount) {
      slotState = "empty";
    } else if (connected === true) {
      slotState = "connected";
    } else {
      slotState = "disconnected";
    }

    applyAvatar(el, null, slotState);
    if (path !== undefined && path !== "") {
      void buildDataUrl(path).then((uri) => {
        if (uri !== null && uri !== "") applyAvatar(el, uri, slotState);
      });
    }

    if (isAsistan) return;

    try {
      const conv = document.getElementById(`conversation-${provider}`) as HTMLSelectElement | null;
      if (conv) {
        conv.disabled = slotState !== "connected";
        try {
          const btn = document.getElementById(`conversation-refresh-${provider}`) as
            | (HTMLButtonElement & { __convRefreshHandler?: EventListener })
            | null;
          if (btn) {
            btn.disabled = slotState !== "connected";
            if (btn.__convRefreshHandler) {
              btn.removeEventListener("click", btn.__convRefreshHandler);
            }
            const handler: EventListener = (ev: Event) => {
              ev.preventDefault();
              void WebviewManager.syncProvider(provider, { from: "manual" }).catch((err) => {
                Logger.debug(LogCategory.DATABASE, `Manual sync failed: ${getErrorMessage(err)}`, {
                  error: err instanceof Error ? err : new Error(String(err)),
                });
              });
            };
            btn.__convRefreshHandler = handler;
            btn.addEventListener("click", handler);
          }
        } catch (e) {
          /* noop */
        }
      }
    } catch (e) {
      Logger.debug(LogCategory.SYSTEM, "Conversation refresh handler setup failed", {
        error: getErrorMessage(e),
      });
    }
  });
}
