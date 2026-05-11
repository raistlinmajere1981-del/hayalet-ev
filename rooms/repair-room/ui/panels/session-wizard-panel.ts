import type { RepairUiState } from "../../shared/ui/state.js";
import { createRepairPanel } from "./panel-shell.js";

type TextFn = (path: string[], fallback: string) => string;

const STEP_LABELS: Record<string, string> = {
  "device-info": "Device Info",
  symptoms: "Symptoms",
  "ai-research": "AI Research",
  ready: "Ready",
};

const STEP_ORDER = ["device-info", "symptoms", "ai-research", "ready"] as const;
const SYMPTOM_OPTIONS = [
  "No Power",
  "Boot Loop",
  "HDMI Dead",
  "No 5V_STBY",
  "Overcurrent",
] as const;

function appendField(
  documentRef: Document,
  parent: HTMLElement,
  label: string,
  field: string,
  value: string,
  multiline = false
): void {
  const wrapper = documentRef.createElement("label");
  wrapper.className = "repair-wizard-field";

  const labelEl = documentRef.createElement("span");
  labelEl.textContent = label;
  wrapper.append(labelEl);

  const input = multiline
    ? documentRef.createElement("textarea")
    : documentRef.createElement("input");
  input.className = "repair-wizard-field__input";
  input.value = value;
  input.dataset["repairAction"] = "wizard-field";
  input.dataset["wizardField"] = field;
  wrapper.append(input);

  parent.append(wrapper);
}

export function renderSessionWizardPanel(
  documentRef: Document,
  state: RepairUiState,
  text: TextFn
): HTMLElement {
  const body = documentRef.createElement("div");
  body.className = "repair-panel__body";

  const wizard = state.wizard;

  // -- Stepper
  const stepper = documentRef.createElement("div");
  stepper.className = "repair-wizard-stepper";

  const currentIdx = STEP_ORDER.indexOf(wizard.currentStep);

  for (let i = 0; i < STEP_ORDER.length; i++) {
    const stepId = STEP_ORDER[i] as (typeof STEP_ORDER)[number];
    const step = documentRef.createElement("div");
    const isDone = i < currentIdx;
    const isActive = i === currentIdx;
    step.className = `repair-wizard-step${isActive ? " repair-wizard-step--active" : ""}${isDone ? " repair-wizard-step--done" : ""}`;
    step.dataset["repairAction"] = "advance-wizard";
    step.dataset["step"] = stepId;

    const dot = documentRef.createElement("span");
    dot.className = "repair-wizard-step__dot";
    step.append(dot);

    const label = documentRef.createElement("span");
    label.textContent = STEP_LABELS[stepId] ?? stepId;
    step.append(label);

    stepper.append(step);
  }

  body.append(stepper);

  const form = documentRef.createElement("div");
  form.className = "repair-wizard-form";

  if (wizard.currentStep === "device-info") {
    appendField(documentRef, form, "Manufacturer", "manufacturer", wizard.draft.manufacturer);
    appendField(documentRef, form, "Model", "model", wizard.draft.model);
    appendField(documentRef, form, "Board code", "boardCode", wizard.draft.boardCode);
    appendField(documentRef, form, "S/N", "serialNumber", wizard.draft.serialNumber);
    appendField(documentRef, form, "Intake notes", "intakeNotes", wizard.draft.intakeNotes, true);
    body.append(form);
  }

  if (wizard.currentStep === "symptoms") {
    const chipRow = documentRef.createElement("div");
    chipRow.className = "repair-wizard-symptoms";
    SYMPTOM_OPTIONS.forEach((symptom) => {
      const chip = documentRef.createElement("button");
      chip.className = `repair-skill-chip${wizard.draft.primarySymptoms.includes(symptom) ? " repair-skill-chip--active" : ""}`;
      chip.type = "button";
      chip.textContent = symptom;
      chip.dataset["repairAction"] = "wizard-symptom";
      chip.dataset["symptom"] = symptom;
      chipRow.append(chip);
    });
    form.append(chipRow);
    appendField(
      documentRef,
      form,
      "Symptom notes",
      "symptomFreeText",
      wizard.draft.symptomFreeText,
      true
    );
    body.append(form);
  }

  // -- Research progress list
  if (wizard.researchProgress.length > 0) {
    const resList = documentRef.createElement("div");
    resList.className = "repair-research-list";

    for (const item of wizard.researchProgress) {
      const row = documentRef.createElement("div");
      row.className = `repair-research-item${item.completed ? " repair-research-item--done" : ""}`;

      const icon = documentRef.createElement("span");
      icon.className = "repair-research-item__icon";
      icon.textContent = item.completed ? "[done]" : "[...]";
      row.append(icon);

      const label = documentRef.createElement("span");
      label.textContent = item.label;
      row.append(label);

      resList.append(row);
    }

    body.append(resList);
  }

  // -- Found resources preview
  if (wizard.foundResources.length > 0) {
    const grid = documentRef.createElement("div");
    grid.style.display = "flex";
    grid.style.flexWrap = "wrap";
    grid.style.gap = "4px";
    grid.style.paddingTop = "8px";

    for (const res of wizard.foundResources) {
      const chip = documentRef.createElement("span");
      chip.className = "repair-skill-chip";
      chip.textContent = `${res.kind}: ${res.label}`;
      grid.append(chip);
    }

    body.append(grid);
  }

  const actions = documentRef.createElement("div");
  actions.className = "repair-panel-actions";
  const nextButton = documentRef.createElement("button");
  nextButton.className = "repair-cta-btn";
  nextButton.type = "button";
  nextButton.textContent =
    wizard.currentStep === "ready"
      ? "Create Session"
      : wizard.currentStep === "symptoms"
        ? "Start Research"
        : "Next Step";
  nextButton.dataset["repairAction"] =
    wizard.currentStep === "ready" ? "create-session" : "advance-wizard";
  actions.append(nextButton);
  body.append(actions);

  return createRepairPanel(documentRef, {
    panelId: "session-wizard",
    eyebrow: text(["wizard", "eyebrow"], "NEW SESSION"),
    title: text(["wizard", "title"], "Session Wizard"),
    statusDot: wizard.currentStep === "ai-research" ? "amber" : "idle",
    collapsed: state.layout.collapsedPanels["session-wizard"],
    pinned: state.layout.pinnedPanels["session-wizard"],
    body,
  });
}
