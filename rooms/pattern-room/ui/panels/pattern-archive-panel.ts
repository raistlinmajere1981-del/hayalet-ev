import { enhancePatternRoomWorkstations } from "../pattern-room-workstations.js";
import { createArchivePanel as createArchivePanelCore } from "./pattern-archive-panel-core.js";

export function createArchivePanel(
  ...args: Parameters<typeof createArchivePanelCore>
): ReturnType<typeof createArchivePanelCore> {
  const panel = createArchivePanelCore(...args);
  enhancePatternRoomWorkstations(panel);
  return panel;
}
