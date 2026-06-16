import type { RepairUiState } from "../../shared/ui/state.js";

export function getCameraStatusChipState(
  state: RepairUiState,
  cameraActive: boolean
): "live" | "ready" | "manual" | "unavailable" {
  if (!state.operationsAvailable) return "unavailable";
  if (cameraActive) return "live";
  if (state.workbench.liveSource.connected || state.workbench.liveSource.available) return "ready";
  return "manual";
}

function getCameraSourceLabel(state: RepairUiState): string {
  const sourceType = state.workbench.liveSource.sourceType;
  if (sourceType === "android-camera") return "Android camera";
  if (sourceType === "snapshot") return "Snapshot";
  if (sourceType === "image") return "Board image";
  return state.layout.interactionSettings.cameraFeedPreference === "android-feed"
    ? "Android camera"
    : "Manual image";
}

export function getCameraStatusChipText(state: RepairUiState, cameraActive: boolean): string {
  const cameraSource = getCameraSourceLabel(state);
  if (!state.operationsAvailable) return "Camera not connected";
  if (cameraActive) return `${cameraSource} live`;
  if (state.workbench.liveSource.connected) return `${cameraSource} connected`;
  if (state.workbench.liveSource.available) return `${cameraSource} ready`;
  return "Manual board image";
}

export function getCameraStatusChipTitle(state: RepairUiState, cameraActive: boolean): string {
  if (!state.operationsAvailable) {
    return "Camera feed is optional. Open repair controls if you need companion access.";
  }
  if (cameraActive) return "Camera feed is live. Freeze the frame before probing tight areas.";
  if (state.workbench.liveSource.connected) return "Camera is connected but not marked live.";
  if (state.workbench.liveSource.available) return "Camera source is ready when needed.";
  return "Use a manual board image or start the Android camera when needed.";
}

export function getRouteLabel(route: "local" | "android"): string {
  return route === "android" ? "Android" : "Local";
}

export function getAssistanceProfileLabel(maxAiInterruptions: number): string {
  if (maxAiInterruptions <= 1) return "Quiet";
  if (maxAiInterruptions === 2) return "Balanced";
  return "Proactive";
}

export function uniqueRepairCapabilities(capabilities: string[]): string[] {
  return Array.from(new Set(capabilities));
}
