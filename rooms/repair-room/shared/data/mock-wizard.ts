import type { RepairWizardState } from "../types/index.js";

export const MOCK_REPAIR_WIZARD_INITIAL: RepairWizardState = {
  currentStep: "device-info",
  draft: {
    deviceType: "",
    manufacturer: "",
    model: "",
    boardCode: "",
    serialNumber: "",
    intakeNotes: "",
    primarySymptoms: [],
    customSymptoms: [],
    symptomFreeText: "",
    selectedEvidenceResourceIds: [],
    selectedFailureIds: [],
    selectedTestPointIds: [],
    researchSkipped: false,
    researchStatus: "idle",
    researchMessage: null,
  },
  researchProgress: [],
  foundResources: [],
  generatedKnowledgePackId: null,
  evidenceReviewed: false,
};
