import { PATTERN_ROOM_MOCK_DATA } from "../shared/data/pattern-room-mock-data.js";
import type { PatternViewId } from "../shared/types/pattern-room.js";
import { createArchivePanel } from "./panels/pattern-archive-panel.js";
import { createBoardPanel } from "./panels/pattern-board-panel.js";
import { createDeskPanel } from "./panels/pattern-desk-panel.js";
import { createOverviewPanel } from "./panels/pattern-overview-panel.js";
import { createReportPanel } from "./panels/pattern-report-panel.js";
import { createTenthManPanel } from "./panels/pattern-tenth-man-panel.js";

type FocusedPatternViewId = Exclude<PatternViewId, "overview">;

export type PatternRoomUiRuntime = {
  start: () => void;
};

function resolveRoot(): HTMLElement {
  const existingRoot = document.getElementById("app");
  if (existingRoot !== null) {
    return existingRoot;
  }

  const root = document.createElement("div");
  root.id = "app";
  document.body.append(root);
  return root;
}

export function createPatternRoomUiRuntime(): PatternRoomUiRuntime {
  const root = resolveRoot();
  let activeView: PatternViewId = "overview";

  function setActiveView(viewId: PatternViewId): void {
    activeView = viewId;
    render();
  }

  function renderFocusedView(viewId: FocusedPatternViewId): HTMLElement {
    const onBack = (): void => {
      setActiveView("overview");
    };
    const panelFactories: Record<FocusedPatternViewId, () => HTMLElement> = {
      archive: () => createArchivePanel(PATTERN_ROOM_MOCK_DATA, onBack),
      board: () => createBoardPanel(PATTERN_ROOM_MOCK_DATA, onBack),
      desk: () => createDeskPanel(PATTERN_ROOM_MOCK_DATA, onBack),
      report: () => createReportPanel(PATTERN_ROOM_MOCK_DATA, onBack),
      "tenth-man": () => createTenthManPanel(PATTERN_ROOM_MOCK_DATA, onBack),
    };
    return panelFactories[viewId]();
  }

  function render(): void {
    const content =
      activeView === "overview"
        ? createOverviewPanel(PATTERN_ROOM_MOCK_DATA, setActiveView)
        : renderFocusedView(activeView);
    root.replaceChildren(content);
  }

  function announceReady(): void {
    window.roomAPI?.ready?.({
      roomId: "pattern-room",
      featureId: "pattern-workbench",
      status: "ready",
    });
  }

  return {
    start(): void {
      render();
      announceReady();
    },
  };
}
