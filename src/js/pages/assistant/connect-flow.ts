import { ConnectButtonState } from "@shared/assistant.js";

export function resolveAssistantConnectButtonState(options: {
  slotState?: string;
  connectFlowActive: boolean;
}): ConnectButtonState {
  if (options.slotState === "connecting" || options.connectFlowActive) {
    return ConnectButtonState.CANCEL_CONNECTING;
  }

  if (options.slotState === "connected") {
    return ConnectButtonState.CONNECTED;
  }

  return ConnectButtonState.IDLE;
}
