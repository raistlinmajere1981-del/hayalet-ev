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
  "evidence-review": "Review",
  ready: "Start",
};

const STEP_ORDER = ["device-info", "symptoms", "ai-research", "evidence-review", "ready"] as const;
const SYMPTOM_OPTIONS = [
  "No Power",
  "Boot Loop",
  "HDMI Dead",
  "No 5V_STBY",
  "Overcurrent",
] as const;

const AI_TARGET_OPTIONS = [
  { targetSlot: "ai0", label: "AI 0" },
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
  if (step === "evidence-review") {
    return "Review AI evidence before it becomes part of the repair session.";
  }
  return "Review the evidence pack, then start the guided repair session.";
}

function getWizardStepLabel(stepId: string, text: TextFn): string {
  if (stepId === "device-info") return text(["wizard", "steps", "deviceInfo"], "Device");
  if (stepId === "symptoms") return text(["wizard", "steps", "symptoms"], "Symptoms");
  if (stepId === "ai-research") return text(["wizard", "steps", "aiResearch"], "Evidence");
  if (stepId === "evidence-review") return text(["wizard", "steps", "evidenceReview"], "Review");
  if (stepId === "ready") return text(["wizard", "steps", "ready"], "Start");
  return STEP_LABELS[stepId] ?? stepId;
}

function getLocalizedWizardHint(
  step: RepairUiState["wizard"]["currentStep"],
  text: TextFn
): string {
  if (step === "device-info") {
    return text(["wizard", "hints", "deviceInfo"], getWizardHint(step));
  }
  if (step === "symptoms") {
    return text(["wizard", "hints", "symptoms"], getWizardHint(step));
  }
  if (step === "ai-research") {
    return text(["wizard", "hints", "aiResearch"], getWizardHint(step));
  }
  if (step === "evidence-review") {
    return text(["wizard", "hints", "evidenceReview"], getWizardHint(step));
  }
  return text(["wizard", "hints", "ready"], getWizardHint(step));
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
    label.textContent = getWizardStepLabel(stepId, text);
    step.append(label);

    stepper.append(step);
  }

  body.append(stepper);

  const hint = documentRef.createElement("div");
  hint.className = "repair-wizard-guidance";
  hint.textContent = getLocalizedWizardHint(wizard.currentStep, text);
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

  if (wizard.currentStep === "evidence-review") {
    const review = documentRef.createElement("div");
    review.className = "repair-wizard-form";

    const pack = state.knowledgePack.pack;
    const summary = documentRef.createElement("div");
    summary.className = "repair-wizard-guidance";
    summary.textContent =
      pack === null
        ? text(
            ["wizard", "evidenceReview", "empty"],
            "No evidence pack is available yet. Run evidence research again."
          )
        : text(
            ["wizard", "evidenceReview", "summary"],
            "{resources} resources, {failures} failure notes, {testPoints} test points."
          )
            .replace("{resources}", String(pack.resources.length))
            .replace("{failures}", String(pack.commonFailures.length))
            .replace("{testPoints}", String(pack.testPoints.length));
    review.append(summary);

    if (pack !== null) {
      pack.resources.slice(0, 4).forEach((resource) => {
        const row = documentRef.createElement("div");
        row.className = "repair-research-item";
        row.textContent = `${resource.kind}: ${resource.label} (${Math.round(resource.confidence * 100)}%)`;
        review.append(row);
      });
      pack.commonFailures.slice(0, 3).forEach((failure) => {
        const row = documentRef.createElement("div");
        row.className = "repair-research-item";
        row.textContent = `${text(["wizard", "evidenceReview", "failurePrefix"], "Failure")}: ${failure.label} (${Math.round(failure.confidence * 100)}%)`;
        review.append(row);
      });
      pack.testPoints.slice(0, 3).forEach((point) => {
        const row = documentRef.createElement("div");
        row.className = "repair-research-item";
        row.textContent = `${text(["wizard", "evidenceReview", "probePrefix"], "Probe")}: ${point.label} • ${point.expectedValue}${point.unit}`;
        review.append(row);
      });
    }

    body.append(review);
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
      ? text(["wizard", "actions", "startRepair"], "Start repair")
      : wizard.currentStep === "evidence-review"
        ? text(["wizard", "actions", "approveEvidence"], "Approve evidence")
        : wizard.currentStep === "ai-research"
          ? wizard.researchProgress.length > 0
            ? text(["wizard", "actions", "reviewSetup"], "Review setup")
            : text(["wizard", "actions", "startEvidenceResearch"], "Start evidence research")
          : wizard.currentStep === "symptoms"
            ? text(["wizard", "actions", "findEvidence"], "Find evidence")
            : text(["wizard", "actions", "addSymptoms"], "Add symptoms");
  nextButton.dataset["repairAction"] =
    wizard.currentStep === "ready"
      ? "create-session"
      : wizard.currentStep === "evidence-review"
        ? "advance-wizard"
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
