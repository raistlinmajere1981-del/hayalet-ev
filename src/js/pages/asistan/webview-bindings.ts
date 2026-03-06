import type { WebviewElement } from "@shared/asistan.js";

import { AppState } from "../../modules/app-state.js";
import { ProviderRegistry } from "../../modules/webview/provider-registry.js";
import type { OverlayStage } from "./overlay-stage.js";

interface BindAsistanWebviewIpcEventsOptions {
  webviewEl: HTMLElement | null;
  providerSelect: HTMLSelectElement | null;
  getActiveProviderId: () => string | null;
  isConnectFlowActive: () => boolean;
  getProviderToolsReady: () => boolean;
  setProviderToolsReady: (ready: boolean) => void;
  setConnectOverlayStage: (stage: OverlayStage | null) => void;
  updateConnectionUI: () => void;
  onMcpToggleFromHealth: (server: string, enabled: boolean) => Promise<void> | void;
  onOpencodeSessionChanged: (sessionId: string) => Promise<void> | void;
  onAssistantRuntimeControl: (patch: Record<string, unknown>) => Promise<void> | void;
}

export function bindAsistanWebviewIpcEvents(options: BindAsistanWebviewIpcEventsOptions): void {
  options.webviewEl?.addEventListener(
    "ipc-message",
    ((event: Event & { channel?: string; args?: unknown[] }) => {
      if (event.channel === "mcp-toggle-change") {
        const data = event.args?.[0] as { server: string; enabled: boolean } | undefined;
        if (data?.server != null) {
          void options.onMcpToggleFromHealth(data.server, data.enabled);
        }
      }

      if (event.channel === "opencode-ui-connect-stage") {
        const data = event.args?.[0] as { title?: string; subtitle?: string } | undefined;
        const selectedProviderId = options.providerSelect?.value ?? options.getActiveProviderId();
        const canShowStage =
          selectedProviderId === "opencode-ui" &&
          (options.isConnectFlowActive() || options.getProviderToolsReady() !== true);

        if (canShowStage) {
          const title = typeof data?.title === "string" ? data.title.trim() : "";
          const subtitle = typeof data?.subtitle === "string" ? data.subtitle.trim() : "";
          if (title !== "" && subtitle !== "") {
            options.setConnectOverlayStage({ title, subtitle });
            options.updateConnectionUI();
          }
        }
      }

      if (event.channel === "opencode-ui-tools-ready") {
        const data = event.args?.[0] as
          | { ready?: boolean; mcpStatus?: string; unresolvedServers?: string[] }
          | undefined;
        const selectedProviderId = options.providerSelect?.value ?? options.getActiveProviderId();
        if (selectedProviderId === "opencode-ui") {
          options.setProviderToolsReady(data?.ready === true);

          if (data?.ready !== true) {
            const unresolved = Array.isArray(data?.unresolvedServers)
              ? data.unresolvedServers.filter((item): item is string => typeof item === "string")
              : [];
            const unresolvedPreview = unresolved.slice(0, 3).join(", ");
            const mcpStatus = typeof data?.mcpStatus === "string" ? data.mcpStatus.trim() : "";

            options.setConnectOverlayStage({
              title: "MCP sunucuları bekleniyor",
              subtitle:
                unresolvedPreview !== ""
                  ? `Beklenen MCP: ${unresolvedPreview}`
                  : mcpStatus !== ""
                    ? `MCP durumu: ${mcpStatus}`
                    : "MCP sunucuları hazırlanıyor",
            });
          }

          options.updateConnectionUI();
        }
      }

      if (event.channel === "opencode-ui-session-changed") {
        const data = event.args?.[0] as { sessionId?: string | null } | undefined;
        const sessionId = data?.sessionId;
        if (typeof sessionId === "string" && sessionId !== "") {
          void options.onOpencodeSessionChanged(sessionId);
        }
      }

      if (event.channel === "assistant-runtime-control") {
        const data = event.args?.[0] as Record<string, unknown> | undefined;
        if (data !== undefined) {
          void options.onAssistantRuntimeControl(data);
        }
      }
    }) as EventListener
  );
}

interface BindAsistanPrimaryWebviewEventsOptions {
  webviewEl: WebviewElement;
  providerSelect: HTMLSelectElement | null;
  urlDisplay: HTMLElement | null;
  scheduleSaveLastOpencodeUrl: (url: string) => void;
  syncDisabledMcpToHealth: () => void;
}

export function bindAsistanPrimaryWebviewEvents(
  options: BindAsistanPrimaryWebviewEventsOptions
): void {
  options.webviewEl.addEventListener("did-stop-loading", () => {
    void (async (): Promise<void> => {
      try {
        if (typeof options.webviewEl.getWebContentsId !== "function") return;
        options.webviewEl.getWebContentsId();
      } catch (_) {
        return;
      }

      const currentProviderId = options.providerSelect?.value ?? AppState.getProviderIdForSlot("ai0");
      const cfg =
        typeof currentProviderId === "string" && currentProviderId !== ""
          ? ProviderRegistry.getAny(currentProviderId)
          : null;
      if (cfg !== null) {
        try {
          const configScript = `
            (function() {
              try {
                window.__hayalet_slot = "ai0";
                window.__hayalet_provider_config = ${JSON.stringify(cfg)};
                return true;
              } catch (e) {
                console.error('[Hayalet-Config-Inject] Failed:', e);
                return false;
              }
            })();
          `;
          await options.webviewEl.executeJavaScript?.(configScript);
        } catch (_err) {
          void _err;
        }
      }

      options.syncDisabledMcpToHealth();
    })();
  });

  options.webviewEl.addEventListener("did-navigate", () => {
    try {
      const url = options.webviewEl.getURL?.() ?? "";
      if (options.urlDisplay != null) {
        options.urlDisplay.textContent = url;
      }

      const providerId = options.providerSelect?.value ?? AppState.getProviderIdForSlot("ai0");
      if (providerId === "opencode") {
        options.scheduleSaveLastOpencodeUrl(url);
      }
    } catch (_) {}
  });
}
