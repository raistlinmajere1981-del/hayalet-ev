import type {
  RepairChatTurn,
  RepairEvent,
  RepairInstrumentKind,
  RepairKnowledgePack,
  RepairMultimeterReading,
  RepairOperatorProfile,
  RepairOperatorProfileTabId,
  RepairOverlayLayerId,
  RepairPanelId,
  RepairSession,
  RepairSessionListItem,
  RepairWizardState,
  RepairWizardDraft,
  RepairWorkbenchTool,
} from "../../shared/types/index.js";
import type { RepairTacticalFeedItem, RepairUiPhase } from "../../shared/ui/state.js";

export type RepairRuntimeAction =
  | { type: "phase/set"; phase: RepairUiPhase }
  | {
      type: "session/activate";
      sessionId: string | null;
    }
  | {
      type: "session/upsert";
      session: RepairSession;
    }
  | {
      type: "session-list/set";
      list: RepairSessionListItem[];
    }
  | {
      type: "workbench/set-tool";
      tool: RepairWorkbenchTool;
    }
  | {
      type: "workbench/set-frozen";
      isFrozen: boolean;
      frozenAt: string | null;
    }
  | {
      type: "workbench/set-cursor";
      xPx: number;
      yPx: number;
      gridX: number;
      gridY: number;
    }
  | {
      type: "workbench/set-viewport";
      zoom: number;
      panXPx: number;
      panYPx: number;
    }
  | {
      type: "workbench/set-timeline";
      playheadMs: number;
      zoom: number;
      rangeStartMs: number | null;
      rangeEndMs: number | null;
      autoFollowLive: boolean;
    }
  | {
      type: "workbench/toggle-layer";
      layerId: RepairOverlayLayerId;
      visible: boolean;
    }
  | {
      type: "workbench/set-focus-event";
      eventId: string | null;
    }
  | {
      type: "workbench/set-focus-mode";
      focusMode: boolean;
    }
  | {
      type: "events/append";
      sessionId: string;
      event: RepairEvent;
    }
  | {
      type: "tactical-feed/set";
      items: RepairTacticalFeedItem[];
    }
  | {
      type: "tactical-feed/append";
      item: RepairTacticalFeedItem;
    }
  | {
      type: "wizard/set";
      wizard: RepairWizardState;
    }
  | {
      type: "wizard/advance";
      step: RepairWizardState["currentStep"];
    }
  | {
      type: "wizard/patch-draft";
      patch: Partial<RepairWizardDraft>;
    }
  | {
      type: "knowledge-pack/set";
      pack: RepairKnowledgePack | null;
      attachedToSessionId: string | null;
    }
  | {
      type: "knowledge-pack/set-preview-tab";
      tabId: "schematic-preview" | "board-view" | "notes";
    }
  | {
      type: "measurement/set-instrument";
      instrumentKind: RepairInstrumentKind;
    }
  | {
      type: "operator-profile/set";
      profile: RepairOperatorProfile;
    }
  | {
      type: "measurement/append-reading";
      reading: RepairMultimeterReading;
    }
  | {
      type: "measurement/set-display";
      display: string;
      value: number | null;
      hold: boolean;
    }
  | {
      type: "chat/append-turn";
      turn: RepairChatTurn;
    }
  | {
      type: "chat/set-composer";
      draft: string;
    }
  | {
      type: "chat/set-pending";
      turnId: string | null;
    }
  | {
      type: "layout/collapse-panel";
      panelId: RepairPanelId;
      collapsed: boolean;
    }
  | {
      type: "layout/pin-panel";
      panelId: RepairPanelId;
      pinned: boolean;
    }
  | {
      type: "layout/set-focus-mode";
      focusMode: boolean;
    }
  | {
      type: "layout/set-operator-profile-tab";
      tabId: RepairOperatorProfileTabId;
    }
  | {
      type: "ambient/tick";
      nowIso: string;
    };
