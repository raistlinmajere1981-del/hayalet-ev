import type { PatternRoomMockData } from "../../shared/types/pattern-room.js";
import { createElement, createPanelShell } from "./pattern-panel-utils.js";

export function createBoardPanel(data: PatternRoomMockData, onBack: () => void): HTMLElement {
  const shell = createPanelShell("board", "Dedektif Panosu", onBack);
  const boardScene = createElement("div", "pattern-room-board-scene");
  const grid = createElement("div", "pattern-room-board-grid");

  data.boardCategories.forEach((category) => {
    const lane = createElement("article", `pattern-room-board-lane ${category.tone}`);
    const laneHeader = createElement("header", "pattern-room-board-lane-header");
    laneHeader.append(
      createElement("span", "pattern-room-board-lane-label", "Pano kategorisi"),
      createElement("h2", undefined, category.label),
      createElement("p", undefined, category.summary)
    );

    const pinList = createElement("div", "pattern-room-board-pins");
    category.pins.forEach((pinLabel) => {
      const pin = createElement("span", `pattern-room-board-node ${category.tone}`, pinLabel);
      pinList.append(pin);
    });

    lane.append(laneHeader, pinList);
    grid.append(lane);
  });

  boardScene.append(grid);
  shell.append(boardScene);
  return shell;
}
