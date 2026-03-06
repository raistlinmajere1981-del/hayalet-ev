import { ConnectButtonState } from "@shared/asistan.js";

export function resolveAsistanConnectButtonState(options: {
  slotState?: string;
  isServerRunning: boolean;
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
