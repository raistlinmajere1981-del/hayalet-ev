import type { DebateLocalPhase, DebateLocalTurn } from "../state/pattern-room-local-state.js";
import type { PatternEdgeType } from "./pattern-room-domain.js";

export type PatternViewId = "overview" | "board" | "desk" | "archive" | "tenth-man" | "report";

export type PatternBoardCategoryTone = "evidence" | "analysis" | "commentary" | "uncertainty";

export type PatternBoardLayerId = "evidence" | "analysis" | "interpretation" | "uncertainty";

export type PatternBoardPin = {
  id: string;
  label: string;
  layer: PatternBoardLayerId;
  layerLabel: string;
  tone: PatternBoardCategoryTone;
  confidenceLabel: string;
  content: string;
  sourceId: string | null;
  sourceLabel: string;
  origin: string | null;
  kind: "node" | "source" | "evidence" | "placeholder";
  isLocal: boolean;
};

export type PatternClaim = {
  id: string;
  label: string;
  summary: string;
  stance: "primary" | "counter";
};

export type PatternBoardCategory = {
  id: string;
  label: string;
  tone: PatternBoardCategoryTone;
  summary: string;
  pins: PatternBoardPin[];
};

export type PatternSource = {
  id: string;
  label: string;
  sourceTypeLabel: string;
  origin: string;
  status: "mocked" | "local";
  note: string;
  isLocal?: boolean;
};

export type PatternDummyRole = {
  id: string;
  label: string;
  note: string;
  connected?: boolean;
};

export type PatternDebateReference = {
  id: string;
  label: string;
  note: string;
  kind: "node" | "source" | "evidence";
};

export type PatternReportSection = {
  id: string;
  label: string;
  tone: PatternBoardCategoryTone;
  note: string;
  bullets: string[];
};

export type PatternConnectionOption = {
  id: string;
  label: string;
  kind: "node" | "source" | "evidence";
  isLocal: boolean;
};

export type PatternTenthManSession = {
  id: string;
  label: string;
  status: "dummy" | "active" | "completed";
  prompt: string;
  roles: PatternDummyRole[];
  references: PatternDebateReference[];
  phase?: DebateLocalPhase;
  turns?: DebateLocalTurn[];
  verdict?: string | null;
};

export type PatternReportSummary = {
  id: string;
  label: string;
  status: "dummy";
  sections: PatternReportSection[];
};

export type PatternRoomMockData = {
  roomTitle: string;
  roomLabel: string;
  roomSummary: string;
  subject: string;
  boardCategories: PatternBoardCategory[];
  connectionOptions: PatternConnectionOption[];
  claims: PatternClaim[];
  sources: PatternSource[];
  tenthManSession: PatternTenthManSession;
  reportSummary: PatternReportSummary;
};

export type PatternPanelActions = {
  getSelectedNodeId: () => string | null;
  selectNode: (nodeId: string) => void;
  sendNodeToDesk: (nodeId: string) => void;
  addNodeToDebate: (nodeId: string) => void;
  pinSourceToBoard: (sourceId: string, layer: PatternBoardLayerId) => void;
  addSourceToDebate: (sourceId: string) => void;
  addLocalNote: (text: string) => void;
  addAuthoredClaim: (label: string, content: string) => void;
  addAuthoredInspiration: (label: string, content: string) => void;
  addAuthoredUncertainty: (label: string, content: string) => void;
  addAuthoredSource: (label: string, origin: string, note: string) => void;
  addAuthoredEvidence: (
    label: string,
    excerpt: string,
    interpretation?: string,
    layer?: PatternBoardLayerId
  ) => void;
  addAuthoredEdge: (
    edgeType: PatternEdgeType,
    sourceId: string,
    targetId: string,
    note?: string
  ) => void;
  prepareDebate: () => void;
  assignDebateRoles: () => void;
  startDebate: () => void;
  advanceDebatePhase: () => void;
  completeDebate: () => void;
  reflectDebateToReport: () => void;
};
