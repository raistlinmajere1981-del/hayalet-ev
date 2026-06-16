import type { RepairWizardState } from "../types/index.js";

export const MOCK_REPAIR_WIZARD_INITIAL: RepairWizardState = {
  currentStep: "device-info",
  draft: {
    manufacturer: "",
    model: "",
    boardCode: "",
    serialNumber: "",
    intakeNotes: "",
    primarySymptoms: [],
    symptomFreeText: "",
  },
  researchProgress: [],
  foundResources: [],
  generatedKnowledgePackId: null,
};
