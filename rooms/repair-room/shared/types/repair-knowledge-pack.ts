export interface RepairKnowledgePackResource {
  id: string;
  label: string;
  kind: "schematic" | "board-image" | "thread" | "datasheet" | "note";
  src: string | null;
  source: string;
  pages: number | null;
  confidence: number;
}

export interface RepairCommonFailure {
  id: string;
  label: string;
  rationale: string;
  affectedPart: string | null;
  recommendedAction: string;
  confidence: number;
}

export interface RepairTestPoint {
  id: string;
  label: string;
  rail: string;
  expectedValue: number;
  unit: string;
  tolerance: number | null;
  pinAt: { xPx: number; yPx: number } | null;
}

export interface RepairKnowledgePackStats {
  schematics: number;
  boardImages: number;
  commonFailures: number;
  repairNotes: number;
  testPoints: number;
}

export interface RepairKnowledgePack {
  schemaVersion: number;
  id: string;
  modelNumber: string;
  deviceLabel: string;
  stats: RepairKnowledgePackStats;
  resources: RepairKnowledgePackResource[];
  commonFailures: RepairCommonFailure[];
  testPoints: RepairTestPoint[];
  notes: string[];
  createdAt: string;
}

export interface RepairKnowledgePackProgress {
  step:
    | "searching-device-info"
    | "finding-schematics"
    | "collecting-board-images"
    | "analyzing-common-failures"
    | "preparing-knowledge-pack"
    | "complete";
  label: string;
  completed: boolean;
}
