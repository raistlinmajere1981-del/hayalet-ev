import { enhancePatternRoomWorkstations } from "../pattern-room-workstations.js";
import { createTenthManPanel as createTenthManPanelCore } from "./pattern-tenth-man-panel-core.js";

export type { PatternCaseReviewPreviewPanelState } from "./pattern-tenth-man-panel-core.js";

export function createTenthManPanel(
  ...args: Parameters<typeof createTenthManPanelCore>
): ReturnType<typeof createTenthManPanelCore> {
  const panel = createTenthManPanelCore(...args);
  enhancePatternRoomWorkstations(panel);
  return panel;
}
