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
  const settings = SettingsManager.getSnapshot();
  const assistantAccountId = settings.assistantSlot?.accountId ?? "";

  const map: Array<{
    provider: "ai0" | "ai1" | "ai2" | "us1";
    el: HTMLElement | null;
    path: string | undefined;
    slotState: "empty" | "disconnected" | "connected";
    manageConversationSelect: boolean;
    fallbackText?: string;
  }> = [
    {
      provider: "ai0",
      el: document.getElementById("indicator-avatar-ai0"),
      path: ai0AvatarPath,
      slotState:
        assistantAccountId === "" ? "empty" : ai0Connected === true ? "connected" : "disconnected",
      manageConversationSelect: false,
    },
    {
      provider: "ai1",
      el: document.getElementById("indicator-avatar-ai1"),
      path: getAvatar("ai1"),
      slotState:
        AppState.getAccountForSlot("ai1") === null
          ? "empty"
          : SlotController.isConnected("ai1") === true
            ? "connected"
            : "disconnected",
      manageConversationSelect: true,
    },
    {
      provider: "ai2",
      el: document.getElementById("indicator-avatar-ai2"),
      path: getAvatar("ai2"),
      slotState:
        AppState.getAccountForSlot("ai2") === null
          ? "empty"
          : SlotController.isConnected("ai2") === true
            ? "connected"
            : "disconnected",
      manageConversationSelect: true,
    },
    {
      provider: "us1",
      el: document.getElementById("indicator-avatar-us1"),
      path: getAvatar("us1"),
      slotState:
        AppState.hasUs1Identity() === false
          ? "empty"
          : AppState.isUs1Connected() === true
            ? "connected"
            : "disconnected",
      manageConversationSelect: false,
      fallbackText: "US",
    },
  ];

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

  const getFallbackPath = (
    provider: "ai0" | "ai1" | "ai2" | "us1",
    slotState: "empty" | "disconnected" | "connected"
  ): string => {
    if (slotState === "empty") return "";

    if (provider === "ai1" || provider === "ai2") {
      const providerId = AppState.getProviderIdForSlot(provider) ?? "";
      if (providerId !== "") return `src/assets/${providerId}.png`;
      return "src/assets/default.png";
    }

    if (provider === "us1") {
      return "src/assets/default.png";
    }

    return "";
  };

  const applyAvatar = (
    el: HTMLElement | null,
    src: string | null,
    slotState: "empty" | "disconnected" | "connected",
    fallbackText = ""
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
      el.textContent = fallbackText;
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

  map.forEach(({ provider, el, path, slotState, manageConversationSelect, fallbackText }) => {
    if (!el) return;
    const fallbackPath = getFallbackPath(provider, slotState);
    const fallbackLabel = slotState === "empty" ? "" : (fallbackText ?? "");
    const candidates = [path ?? "", fallbackPath].filter(
      (candidate, index, arr) => candidate !== "" && arr.indexOf(candidate) === index
    );

    applyAvatar(el, null, slotState, fallbackLabel);
    const tryLoad = (index: number): void => {
      const candidate = candidates[index];
      if (candidate === undefined) {
        return;
      }
      void buildDataUrl(candidate).then((uri) => {
        if (uri !== null && uri !== "") {
          applyAvatar(el, uri, slotState, fallbackLabel);
        } else {
          tryLoad(index + 1);
        }
      });
    };

    if (candidates.length > 0) {
      tryLoad(0);
    }

    if (!manageConversationSelect) return;

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
