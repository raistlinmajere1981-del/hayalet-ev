import type { RepairWizardState } from "../types/index.js";

export const MOCK_REPAIR_WIZARD_INITIAL: RepairWizardState = {
  currentStep: "ready",
  draft: {
    manufacturer: "Samsung",
    model: "BN44-00932A",
    boardCode: "BN44-00932A",
    serialNumber: "R21Z14CSN100123",
    intakeNotes: "No power. Bulk cap discharged before intake.",
    primarySymptoms: ["No Power"],
    symptomFreeText: "Dead board. Confirms no 5V_STBY at output connector pin 9.",
  },
  researchProgress: [
    { step: "searching-device-info", label: "Searching device information…", completed: true },
    { step: "finding-schematics", label: "Finding schematics…", completed: true },
    { step: "collecting-board-images", label: "Collecting board images…", completed: true },
    { step: "analyzing-common-failures", label: "Analyzing common failures…", completed: true },
    { step: "preparing-knowledge-pack", label: "Preparing knowledge pack…", completed: true },
  ],
  foundResources: [
    { id: "schematic-bn44-00932a-rev-a", label: "Schematic Rev A.pdf", kind: "schematic" },
    { id: "board-top-side", label: "Top Side - Annotated", kind: "board-image" },
    { id: "board-bottom-side", label: "Bottom Side - Annotated", kind: "board-image" },
    { id: "thread-eevblog-no-power", label: "EEVblog: BN44-00932A no power", kind: "thread" },
  ],
  generatedKnowledgePackId: "bn44-00932a",
};
