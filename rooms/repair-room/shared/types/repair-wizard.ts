import type { RepairKnowledgePackProgress } from "./repair-knowledge-pack.js";

export type RepairWizardStepId =
  | "device-info"
  | "symptoms"
  | "ai-research"
  | "evidence-review"
  | "ready";

export interface RepairWizardDraft {
  manufacturer: string;
  model: string;
  boardCode: string;
  serialNumber: string;
  intakeNotes: string;
  primarySymptoms: string[];
  symptomFreeText: string;
}

export interface RepairWizardState {
  currentStep: RepairWizardStepId;
  draft: RepairWizardDraft;
  researchProgress: RepairKnowledgePackProgress[];
  foundResources: Array<{ id: string; label: string; kind: string }>;
  generatedKnowledgePackId: string | null;
  evidenceReviewed: boolean;
}
