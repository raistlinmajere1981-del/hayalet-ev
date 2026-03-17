import type { ConnectButtonState, SlotStateInfo, WebviewElement } from "@shared/assistant.js";

import { AppI18n } from "../../modules/i18n/index.js";
import { SlotController, SlotState } from "../../modules/slot-controller.js";
import { formatConnectionIndicatorText } from "./connection-indicator.js";
import { resolveAssistantConnectButtonState } from "./connect-flow.js";
import { resolveOverlayStage, shouldKeepOverlayVisibleForToolsReady } from "./overlay-stage.js";
import type { OverlayStage } from "./overlay-stage.js";

export interface AssistantConnectionUiController {
  providerSelect: HTMLSelectElement | null;
  devtoolsBtn: HTMLButtonElement | null;
  testBtn: HTMLButtonElement | null;
  urlDisplay: HTMLElement | null;
  statusDot: HTMLElement | null;
  statusText: HTMLElement | null;
  _activeAdapter: { id: string } | null;
  _connectFlowActive: boolean;
  _connectOverlayStage: OverlayStage | null;
  _providerToolsReady: boolean;
  _isServerRunning: boolean;
  _systemServerPort: number | null;
  _setupWebviewEvents: (webviewEl: WebviewElement) => void;
  _setButtonState: (state: ConnectButtonState, errorMsg?: string) => void;
  _updateOverlay: (
    overlayEl: HTMLElement | null,
    stateClass: string,
    icon: string,
    title: string,
    subtitle: string
  ) => void;
  _syncSystemServerStatus: (options?: { refreshUi?: boolean }) => Promise<void>;
}

function assistantConnectionT(key: string): string {
  return AppI18n.t(`shell.assistant.connectionUi.${key}`);
}

export function updateAssistantConnectionUI(
  controller: AssistantConnectionUiController,
  skipSystemServerSync = false
): void {
  const slotState = SlotController.getState("ai0") as SlotStateInfo | null;

  const isConnected = slotState?.state === SlotState.CONNECTED;
  const isConnecting = slotState?.state === SlotState.CONNECTING;
  const isConnectingUi = isConnecting || controller._connectFlowActive;
  const isError = slotState?.state === SlotState.ERROR;
  const hasAccount = slotState?.accountId !== undefined && slotState.accountId !== "";
  const providerId = controller.providerSelect?.value ?? controller._activeAdapter?.id;
  const shouldHoldToolsReadyOverlay = shouldKeepOverlayVisibleForToolsReady({
    ...(typeof providerId === "string" && providerId !== "" ? { providerId } : {}),
    isConnected,
    connectFlowActive: controller._connectFlowActive,
    toolsReady: controller._providerToolsReady,
  });

  const webviewEl = document.getElementById("ai0-webview") as WebviewElement | null;
  const mountEl = document.getElementById("ai0-webview-mount");
  const overlayEl = document.getElementById("ai0-webview-overlay");

  if (webviewEl != null && mountEl != null && !mountEl.contains(webviewEl)) {
    SlotController.ensureWebviewMounted("ai0");
    webviewEl.classList.add("webview-frame");
  }

  if (webviewEl !== null && webviewEl.dataset["eventsSetup"] === undefined) {
    controller._setupWebviewEvents(webviewEl);
    webviewEl.dataset["eventsSetup"] = "true";
  }

  let overlayVisible = false;

  if (overlayEl != null) {
    overlayEl.classList.remove(
      "is-hidden",
      "is-empty",
      "is-disconnected",
      "is-connecting",
      "is-error"
    );

    if (!hasAccount) {
      overlayVisible = true;
      controller._updateOverlay(
        overlayEl,
        "is-empty",
        "🤖",
        assistantConnectionT("noAccountTitle"),
        assistantConnectionT("noAccountSubtitle")
      );
    } else if (isConnectingUi) {
      overlayVisible = true;
      const stage = resolveOverlayStage({
        ...(typeof providerId === "string" && providerId !== "" ? { providerId } : {}),
        connectFlowActive: controller._connectFlowActive,
        stage: controller._connectOverlayStage,
      });
      controller._updateOverlay(overlayEl, "is-connecting", "🔄", stage.title, stage.subtitle);
    } else if (shouldHoldToolsReadyOverlay) {
      overlayVisible = true;
      const holdTitle =
        typeof controller._connectOverlayStage?.title === "string" &&
        controller._connectOverlayStage.title.trim() !== ""
          ? controller._connectOverlayStage.title
          : assistantConnectionT("toolsLoadingTitle");
      const holdSubtitle =
        typeof controller._connectOverlayStage?.subtitle === "string" &&
        controller._connectOverlayStage.subtitle.trim() !== ""
          ? controller._connectOverlayStage.subtitle
          : assistantConnectionT("toolsLoadingSubtitle");

      controller._updateOverlay(overlayEl, "is-connecting", "🔄", holdTitle, holdSubtitle);
    } else if (isError) {
      overlayVisible = true;
      controller._updateOverlay(
        overlayEl,
        "is-error",
        "❌",
        assistantConnectionT("connectionErrorTitle"),
        slotState.error ?? assistantConnectionT("connectionErrorRetry")
      );
    } else if (!isConnected) {
      overlayVisible = true;
      controller._updateOverlay(
        overlayEl,
        "is-disconnected",
        "⚡",
        assistantConnectionT("disconnectedTitle"),
        assistantConnectionT("disconnectedSubtitle")
      );
    } else {
      overlayEl.classList.add("is-hidden");
      if (webviewEl != null) {
        SlotController.ensureWebviewAttached("ai0");
      }
    }
  }

  if (mountEl != null) {
    mountEl.classList.toggle("webview-content-blocked", overlayVisible);
  }

  const buttonState = resolveAssistantConnectButtonState({
    ...(slotState?.state !== undefined ? { slotState: slotState.state } : {}),
    connectFlowActive: controller._connectFlowActive,
  });
  controller._setButtonState(buttonState);

  if (controller.devtoolsBtn != null) {
    controller.devtoolsBtn.disabled = !isConnected;
  }

  if (controller.testBtn != null) {
    controller.testBtn.disabled = !isConnected;
    controller.testBtn.title = !isConnected
      ? assistantConnectionT("testButtonDisconnected")
      : assistantConnectionT("testButtonReady");
  }

  if (controller.statusDot != null) {
    controller.statusDot.classList.toggle("is-connected", isConnected);
  }

  if (controller.statusText != null) {
    controller.statusText.textContent = formatConnectionIndicatorText({
      isConnected,
      isServerRunning: controller._isServerRunning,
      ...(typeof controller._systemServerPort === "number"
        ? { port: controller._systemServerPort }
        : {}),
    });
  }

  if (controller.urlDisplay !== null) {
    if (slotState?.currentUrl !== undefined && slotState.currentUrl !== "") {
      controller.urlDisplay.textContent = slotState.currentUrl;
    } else {
      controller.urlDisplay.textContent = "-";
    }
  }

  if (!skipSystemServerSync) {
    void controller._syncSystemServerStatus();
  }
}
