import type { LabUserActionEvent } from "../models/lab-types.js";

export const LAB_USER_ACTION_HISTORY_LIMIT = 24;
export const LAB_USER_ACTION_HUB_SUCCESS_WINDOW_MS = 2600;

type LabTrackedUserActionDefinition = {
  sourceAction: string;
  type: LabUserActionEvent["type"];
  label: string;
  successMessage: string;
  errorMessage: string;
};

const TRACKED_USER_ACTION_DEFINITIONS: Record<string, LabTrackedUserActionDefinition> = {
  "export-timeline-clip": {
    sourceAction: "export-timeline-clip",
    type: "export-clip",
    label: "Klip çıkarılıyor",
    successMessage: "Klip hazır",
    errorMessage: "Klip çıkarılamadı",
  },
  "export-frame-grab": {
    sourceAction: "export-frame-grab",
    type: "grab-frame",
    label: "Frame alınıyor",
    successMessage: "Frame alındı",
    errorMessage: "Frame alınamadı",
  },
  "export-audio-track": {
    sourceAction: "export-audio-track",
    type: "extract-audio",
    label: "Ses çıkarılıyor",
    successMessage: "Ses çıkarıldı",
    errorMessage: "Ses çıkarılamadı",
  },
  "export-roi-image": {
    sourceAction: "export-roi-image",
    type: "custom",
    label: "Bölge görüntüsü alınıyor",
    successMessage: "Bölge görüntüsü hazır",
    errorMessage: "Bölge görüntüsü alınamadı",
  },
  "report-export": {
    sourceAction: "report-export",
    type: "custom",
    label: "Rapor dışa aktarılıyor",
    successMessage: "Rapor dışa aktarıldı",
    errorMessage: "Rapor dışa aktarılamadı",
  },
  "audio-report-export": {
    sourceAction: "audio-report-export",
    type: "custom",
    label: "Ses raporu dışa aktarılıyor",
    successMessage: "Ses raporu dışa aktarıldı",
    errorMessage: "Ses raporu dışa aktarılamadı",
  },
};

export function getTrackedLabUserActionDefinition(action: string | null | undefined) {
  if (!action) {
    return null;
  }
  return TRACKED_USER_ACTION_DEFINITIONS[action] || null;
}

export function isTrackedLabUserAction(action: string | null | undefined) {
  return getTrackedLabUserActionDefinition(action) !== null;
}

export function getLabUserActionDisplayText(actionEvent: LabUserActionEvent) {
  if (actionEvent.status === "running") {
    return actionEvent.label;
  }
  return actionEvent.message || actionEvent.label;
}
