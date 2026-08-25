// Core cleanup controls: patternRemoveLocalSource, patternResetLocalSession.
import { enhanceArchiveFileIntake } from "../pattern-room-file-intake.js";
import { enhancePatternRoomWorkstations } from "../pattern-room-workstations.js";
import { createArchivePanel as createArchivePanelCore } from "./pattern-archive-panel-core.js";

export function createArchivePanel(
  ...args: Parameters<typeof createArchivePanelCore>
): ReturnType<typeof createArchivePanelCore> {
  const panel = createArchivePanelCore(...args);
  enhancePatternRoomWorkstations(panel);
  enhanceArchiveFileIntake(panel, args[0], args[1]);
  return panel;
}
