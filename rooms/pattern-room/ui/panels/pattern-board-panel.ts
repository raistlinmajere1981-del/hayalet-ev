import { enhancePatternBoardInteractions } from "../pattern-room-board-interactions.js";
import { createBoardPanel as createBoardPanelCore } from "./pattern-board-panel-core.js";

export function createBoardPanel(
  ...args: Parameters<typeof createBoardPanelCore>
): ReturnType<typeof createBoardPanelCore> {
  const panel = createBoardPanelCore(...args);
  enhancePatternBoardInteractions(panel);
  return panel;
}
