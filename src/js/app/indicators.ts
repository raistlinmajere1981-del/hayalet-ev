import { AppState } from "../modules/app-state.js";
import { getMimeTypeFromPath } from "../constants/index.js";
import { getErrorMessage } from "@shared/index.js";
import { Logger, LogCategory } from "../modules/logger/index.js";
import { SettingsManager } from "../modules/settings-manager.js";
import { SlotController } from "../modules/slot-controller.js";
import { WebviewManager } from "../modules/webview-manager.js";
import { shellT } from "./shell-i18n.js";

export function updateIndicatorAvatars(): void {
  const getAvatar = (provider: string): string | undefined => AppState.getAvatar(provider);

  // NOTE: AI0 uses the provider logo only while connected.
  const ai0Connected = SlotController.isConnected("ai0");
  const ai0AvatarPath = ai0Connected === true ? getAvatar("ai0") : undefined;

  const map = {
    ai0: {
      el: document.getElementById("indicator-avatar-ai0"),
      path: ai0AvatarPath,
      connected: ai0Connected,
      nickname: AppState.getNickname("ai0"),
      isAssistant: true,
    },
    ai1: {
      el: document.getElementById("indicator-avatar-ai1"),
      path: getAvatar("ai1"),
      connected: SlotController.isConnected("ai1"),
      nickname: AppState.getNickname("ai1"),
      isAssistant: false,
    },
    ai2: {
      el: document.getElementById("indicator-avatar-ai2"),
      path: getAvatar("ai2"),
      connected: SlotController.isConnected("ai2"),
      nickname: AppState.getNickname("ai2"),
      isAssistant: false,
    },
  };

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

  const applyAvatar = (
    el: HTMLElement | null,
    src: string | null,
    slotState: "empty" | "disconnected" | "connected"
  ): void => {
    if (el === null) return;
    if (src !== null && src !== "") {
      // NOTE: Runtime-loaded data URLs feed a CSS var to avoid direct backgroundImage.
      el.style.setProperty("--avatar-image", `url('${src}')`);
      el.classList.remove("avatar-placeholder");
      el.textContent = "";
    } else {
      el.style.removeProperty("--avatar-image");
      el.classList.add("avatar-placeholder");
      el.textContent = "";
    }

    const cluster = el.closest(".indicator-cluster");
    if (!(cluster instanceof HTMLElement)) return;

    cluster.classList.remove("is-empty", "is-disconnected", "is-connected");
    if (slotState === "empty") {
      cluster.classList.add("is-empty");
    } else if (slotState === "disconnected") {
      cluster.classList.add("is-disconnected");
    } else {
      cluster.classList.add("is-connected");
    }
  };

  Object.entries(map).forEach(([provider, { el, path, isAssistant }]) => {
    if (!el) return;
    const providerKey = provider as "ai0" | "ai1" | "ai2";

    let slotState: "empty" | "disconnected" | "connected" = "empty";

    const settings = SettingsManager.getSnapshot();

    const assistantAccountId = settings.assistantSlot?.accountId ?? "";
    const slotAccountId = settings.slots[providerKey]?.accountId ?? "";
    const hasAccount = isAssistant ? assistantAccountId !== "" : slotAccountId !== "";
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

    if (isAssistant) return;

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
                Logger.debug(
                  LogCategory.DATABASE,
                  shellT("logs.manualSyncFailed", { message: getErrorMessage(err) }),
                  {
                    error: err instanceof Error ? err : new Error(String(err)),
                  }
                );
              });
            };
            btn.__convRefreshHandler = handler;
            btn.addEventListener("click", handler);
          }
        } catch (e) {}
      }
    } catch (e) {
      Logger.debug(
        LogCategory.SYSTEM,
        shellT("logs.conversationRefreshSetupFailed", { message: getErrorMessage(e) }),
        {
          error: getErrorMessage(e),
        }
      );
    }
  });
}
