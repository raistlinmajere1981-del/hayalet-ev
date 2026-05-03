export const LAB_OPERATION_UI_ACTION_TO_TRACKED_ACTION = {
  "timeline-export-clip": "export-timeline-clip",
  "timeline-grab-frame": "export-frame-grab",
  "timeline-extract-audio": "export-audio-track",
  "workspace-audio-cleanup-export": "export-clean-audio",
  "workspace-band-pass-voice-export": "export-band-pass-voice",
  "workspace-enhanced-frame-export": "export-enhanced-frame",
  "workspace-selection-roi-export": "export-roi-image",
} as const;

export type LabOperationUiActionId = keyof typeof LAB_OPERATION_UI_ACTION_TO_TRACKED_ACTION;
export type LabTrackedOperationActionId =
  (typeof LAB_OPERATION_UI_ACTION_TO_TRACKED_ACTION)[LabOperationUiActionId];

export function getTrackedOperationActionId(actionId: string | null | undefined) {
  if (!actionId) {
    return null;
  }
  return LAB_OPERATION_UI_ACTION_TO_TRACKED_ACTION[actionId as LabOperationUiActionId] ?? null;
}
