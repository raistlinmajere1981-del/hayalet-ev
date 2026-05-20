import { adaptDomainToViewModels } from "../shared/adapters/pattern-room-view-adapters.js";
import { PATTERN_ROOM_DOMAIN_MOCK } from "../shared/data/pattern-room-domain.mock.js";
import { createLocalState } from "../shared/state/pattern-room-local-state.js";
import { createSnapshot, restoreFromSnapshot } from "../shared/state/pattern-room-snapshot.js";
import type {
  PatternPanelActions,
  PatternRoomMockData,
  PatternViewId,
} from "../shared/types/pattern-room.js";
import type { PatternRoomSessionSnapshot } from "../shared/types/pattern-room-snapshot.js";
import { createArchivePanel } from "./panels/pattern-archive-panel.js";
import { createBoardPanel } from "./panels/pattern-board-panel.js";
import { createDeskPanel } from "./panels/pattern-desk-panel.js";
import { createOverviewPanel } from "./panels/pattern-overview-panel.js";
import { createReportPanel } from "./panels/pattern-report-panel.js";
import { createTenthManPanel } from "./panels/pattern-tenth-man-panel.js";

type FocusedPatternViewId = Exclude<PatternViewId, "overview">;

export type PatternRoomUiRuntime = {
  start: () => void;
  createSnapshot: () => PatternRoomSessionSnapshot;
  restoreSnapshot: (snapshot: unknown) => boolean;
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
  const localState = createLocalState(PATTERN_ROOM_DOMAIN_MOCK);
  let activeView: PatternViewId = "overview";
  let selectedNodeId: string | null = null;
  let viewModels: PatternRoomMockData = adaptDomainToViewModels(
    PATTERN_ROOM_DOMAIN_MOCK,
    localState.getOverlay()
  );

  const actions: PatternPanelActions = {
    getSelectedNodeId(): string | null {
      return selectedNodeId;
    },
    selectNode(nodeId: string): void {
      selectedNodeId = nodeId;
    },
    sendNodeToDesk(nodeId: string): void {
      localState.sendToDesk(nodeId);
    },
    addNodeToDebate(nodeId: string): void {
      localState.addToDebate(nodeId);
    },
    pinSourceToBoard(sourceId: string, layer): void {
      localState.pinSource(sourceId, layer);
    },
    addSourceToDebate(sourceId: string): void {
      localState.addToDebate(sourceId);
    },
    addLocalNote(text: string): void {
      localState.addLocalNote(text);
    },
    addAuthoredClaim(label: string, content: string): void {
      localState.addAuthoredClaim(label, content);
    },
    addAuthoredInspiration(label: string, content: string): void {
      localState.addAuthoredInspiration(label, content);
    },
    addAuthoredUncertainty(label: string, content: string): void {
      localState.addAuthoredUncertainty(label, content);
    },
    addAuthoredSource(label: string, origin: string, note: string): void {
      localState.addAuthoredSource(label, origin, note);
    },
    addAuthoredEvidence(label: string, excerpt: string, interpretation, layer): void {
      localState.addAuthoredEvidence(label, excerpt, interpretation, layer);
    },
    prepareDebate(): void {
      localState.prepareDebate();
    },
    assignDebateRoles(): void {
      localState.assignDebateRoles();
    },
    startDebate(): void {
      localState.startDebate();
    },
    advanceDebatePhase(): void {
      localState.advanceDebatePhase();
    },
    completeDebate(): void {
      localState.completeDebate();
    },
    reflectDebateToReport(): void {
      localState.reflectDebateToReport();
    },
  };

  localState.subscribe(() => {
    viewModels = adaptDomainToViewModels(PATTERN_ROOM_DOMAIN_MOCK, localState.getOverlay());
    render();
  });

  function setActiveView(viewId: PatternViewId): void {
    activeView = viewId;
    render();
  }

  function renderFocusedView(viewId: FocusedPatternViewId): HTMLElement {
    const onBack = (): void => {
      setActiveView("overview");
    };
    const panelFactories: Record<FocusedPatternViewId, () => HTMLElement> = {
      archive: () => createArchivePanel(viewModels, actions, onBack),
      board: () => createBoardPanel(viewModels, actions, onBack),
      desk: () => createDeskPanel(viewModels, actions, onBack),
      report: () => createReportPanel(viewModels, actions, onBack),
      "tenth-man": () => createTenthManPanel(viewModels, actions, onBack),
    };
    return panelFactories[viewId]();
  }

  function render(): void {
    const content =
      activeView === "overview"
        ? createOverviewPanel(viewModels, setActiveView)
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
    createSnapshot(): PatternRoomSessionSnapshot {
      return createSnapshot(localState, activeView);
    },
    restoreSnapshot(snapshot: unknown): boolean {
      const restoredState = restoreFromSnapshot(snapshot, PATTERN_ROOM_DOMAIN_MOCK);
      if (restoredState === null) {
        return false;
      }

      activeView = restoredState.activeView;
      localState.restoreOverlay(restoredState.overlay, restoredState.guards);
      return true;
    },
  };
}
