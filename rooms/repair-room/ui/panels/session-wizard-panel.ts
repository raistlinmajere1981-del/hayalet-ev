import type { RepairUiState } from "../../shared/ui/state.js";
import { createRepairPanel } from "./panel-shell.js";

type TextFn = (path: string[], fallback: string) => string;

interface RenderSessionWizardPanelOptions {
  embedded?: boolean;
}

const STEP_LABELS: Record<string, string> = {
  "device-info": "Device",
  symptoms: "Symptoms",
  "ai-research": "Evidence",
  ready: "Start",
};

const STEP_ORDER = ["device-info", "symptoms", "ai-research", "ready"] as const;
const SYMPTOM_OPTIONS = [
  "No Power",
  "Boot Loop",
  "HDMI Dead",
  "No 5V_STBY",
  "Overcurrent",
] as const;

const AI_TARGET_OPTIONS = [
  { targetSlot: "ai1", label: "AI 1" },
  { targetSlot: "ai2", label: "AI 2" },
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

function getWizardHint(step: RepairUiState["wizard"]["currentStep"]): string {
  if (step === "device-info") {
    return "Capture only what helps identify the board. Photos and evidence can be attached later.";
  }
  if (step === "symptoms") {
    return "Pick the main failure signs, then add what you saw, heard, or measured at the bench.";
  }
  if (step === "ai-research") {
    return "Review the intake details, choose the AI slot, then start evidence research when ready.";
  }
  return "Review the evidence pack, then start the guided repair session.";
}

function appendAiTargetSelect(
  documentRef: Document,
  parent: HTMLElement,
  state: RepairUiState
): void {
  const wrapper = documentRef.createElement("label");
  wrapper.className = "repair-wizard-field";

  const label = documentRef.createElement("span");
  label.textContent = "Research AI slot";
  wrapper.append(label);

  const select = documentRef.createElement("select");
  select.className = "repair-wizard-field__input";
  select.dataset["repairAction"] = "set-ai-target-slot";
  select.value = state.aiDispatch.research.targetSlot;
  AI_TARGET_OPTIONS.forEach((option) => {
    const optionEl = documentRef.createElement("option");
    optionEl.value = option.targetSlot;
    optionEl.textContent = option.label;
    select.append(optionEl);
  });
  wrapper.append(select);
  parent.append(wrapper);
}

export function renderSessionWizardPanel(
  documentRef: Document,
  state: RepairUiState,
  text: TextFn,
  options: RenderSessionWizardPanelOptions = {}
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

  const hint = documentRef.createElement("div");
  hint.className = "repair-wizard-guidance";
  hint.textContent = getWizardHint(wizard.currentStep);
  body.append(hint);

  const form = documentRef.createElement("div");
  form.className = "repair-wizard-form";

  if (wizard.currentStep === "device-info") {
    appendField(documentRef, form, "Board maker", "manufacturer", wizard.draft.manufacturer);
    appendField(documentRef, form, "Device model", "model", wizard.draft.model);
    appendField(documentRef, form, "Board code", "boardCode", wizard.draft.boardCode);
    appendField(documentRef, form, "Serial / job ID", "serialNumber", wizard.draft.serialNumber);
    appendField(documentRef, form, "Bench notes", "intakeNotes", wizard.draft.intakeNotes, true);
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
      "What did you observe?",
      "symptomFreeText",
      wizard.draft.symptomFreeText,
      true
    );
    body.append(form);
  }

  if (wizard.currentStep === "ai-research") {
    const evidenceSetup = documentRef.createElement("div");
    evidenceSetup.className = "repair-wizard-form";
    appendAiTargetSelect(documentRef, evidenceSetup, state);
    body.append(evidenceSetup);
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
      ? "Start repair"
      : wizard.currentStep === "ai-research"
        ? wizard.researchProgress.length > 0
          ? "Review setup"
          : "Start evidence research"
        : wizard.currentStep === "symptoms"
          ? "Find evidence"
          : "Add symptoms";
  nextButton.dataset["repairAction"] =
    wizard.currentStep === "ready"
      ? "create-session"
      : wizard.currentStep === "ai-research" && wizard.researchProgress.length === 0
        ? "start-wizard-research"
        : "advance-wizard";
  actions.append(nextButton);
  body.append(actions);

  const panelId =
    options.embedded === true
      ? "session-wizard repair-panel--session-wizard-embedded"
      : "session-wizard";

  return createRepairPanel(documentRef, {
    panelId,
    eyebrow: text(["wizard", "eyebrow"], "START REPAIR"),
    title: text(["wizard", "title"], "Repair Intake"),
    statusDot: wizard.currentStep === "ai-research" ? "amber" : "idle",
    collapsed: options.embedded === true ? false : state.layout.collapsedPanels["session-wizard"],
    body,
  });
}
