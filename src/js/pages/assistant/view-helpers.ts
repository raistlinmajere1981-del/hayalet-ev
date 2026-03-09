import { ConnectButtonState } from "@shared/assistant.js";
import type { AssistantTrafficState, ButtonStateConfig } from "@shared/assistant.js";
import { AppI18n } from "../../modules/i18n/index.js";
import { formatConnectionIndicatorText } from "./connection-indicator.js";

function assistantT(key: string): string {
  return AppI18n.t(`shell.assistant.${key}`);
}

export function applyConnectButtonState(
  connectButton: HTMLButtonElement | null,
  state: ConnectButtonState,
  errorMsg?: string
): void {
  if (connectButton == null) {
    return;
  }

  const stateConfig: Record<ConnectButtonState, ButtonStateConfig> = {
    [ConnectButtonState.IDLE]: {
      text: assistantT("buttonStates.idle"),
      classes: ["btn-primary"],
      disabled: false,
    },
    [ConnectButtonState.STARTING]: {
      text: assistantT("buttonStates.starting"),
      classes: ["btn-primary"],
      disabled: true,
    },
    [ConnectButtonState.CANCEL_CONNECTING]: {
      text: assistantT("buttonStates.cancelConnecting"),
      classes: ["btn-danger"],
      disabled: false,
    },
    [ConnectButtonState.CONNECTED]: {
      text: assistantT("buttonStates.connected"),
      classes: ["btn-danger"],
      disabled: false,
    },
    [ConnectButtonState.STOPPING]: {
      text: assistantT("buttonStates.stopping"),
      classes: ["btn-primary"],
      disabled: true,
    },
    [ConnectButtonState.ERROR]: {
      text: errorMsg ?? assistantT("buttonStates.error"),
      classes: ["btn-primary"],
      disabled: false,
    },
    [ConnectButtonState.SUCCESS_START]: {
      text: assistantT("buttonStates.successStart"),
      classes: ["btn-primary"],
      disabled: false,
    },
    [ConnectButtonState.SUCCESS_STOP]: {
      text: assistantT("buttonStates.successStop"),
      classes: ["btn-primary"],
      disabled: false,
    },
  };

  const config = stateConfig[state];
  connectButton.className = "btn " + config.classes.join(" ");
  connectButton.textContent = config.text;
  connectButton.disabled = config.disabled;
  connectButton.style.opacity = "";
  connectButton.style.transform = "";
  connectButton.style.transition = "";
}

export function updateServerStatusView(
  status: { running: boolean; port?: number },
  elements: {
    statusText: Element | null;
    statusDetails: Element | null;
    statusDot: Element | null;
  }
): void {
  if (elements.statusText == null) {
    return;
  }

  elements.statusText.textContent = formatConnectionIndicatorText({
    isConnected: status.running,
    isServerRunning: status.running,
    ...(typeof status.port === "number" ? { port: status.port } : {}),
  });

  if (elements.statusDetails != null) {
    elements.statusDetails.textContent = "";
  }

  if (status.running) {
    elements.statusDot?.classList.remove("status-disconnected", "status-error");
    elements.statusDot?.classList.add("status-connected");
    return;
  }

  elements.statusDot?.classList.remove("status-connected", "status-error");
  elements.statusDot?.classList.add("status-disconnected");
}

export function updateOverlayView(
  overlayEl: HTMLElement | null,
  stateClass: string,
  title: string,
  subtitle: string
): void {
  if (overlayEl == null) {
    return;
  }

  overlayEl.className = `webview-overlay ${stateClass}`;
  const titleEl = overlayEl.querySelector(".overlay-title");
  const subtitleEl = overlayEl.querySelector(".overlay-subtitle");

  if (titleEl != null) {
    titleEl.textContent = title;
  }
  if (subtitleEl != null) {
    subtitleEl.textContent = subtitle;
  }
}

export function updateTrafficStatusView(
  trafficState: AssistantTrafficState,
  elements: {
    statusDot: HTMLElement | null;
    statusText: HTMLElement | null;
  }
): void {
  const status = trafficState.state?.status;
  if (status === undefined) {
    return;
  }

  const { loading, thinking, send } = status;

  if (elements.statusDot != null) {
    elements.statusDot.classList.remove("loading", "thinking", "send-disabled");

    if (loading === "busy") {
      elements.statusDot.classList.add("loading");
    } else if (thinking === "busy") {
      elements.statusDot.classList.add("thinking");
    } else if (send === "busy") {
      elements.statusDot.classList.add("send-disabled");
    }
  }

  if (elements.statusText != null) {
    if (loading === "busy") {
      elements.statusText.textContent = assistantT("traffic.loading");
    } else if (thinking === "busy") {
      elements.statusText.textContent = assistantT("traffic.thinking");
    } else if (send === "busy") {
      elements.statusText.textContent = assistantT("traffic.sendDisabled");
    } else {
      elements.statusText.textContent = "";
    }
  }
}
