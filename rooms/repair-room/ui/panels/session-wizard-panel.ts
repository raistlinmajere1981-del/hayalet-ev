import {
  REPAIR_DEVICE_CATALOG,
  REPAIR_DEVICE_TYPE_OPTIONS,
  REPAIR_SYMPTOM_CATALOG,
  REPAIR_SYMPTOM_OPTIONS,
  REPAIR_UNKNOWN_VALUE,
} from "../../shared/data/index.js";
import type { RepairKnowledgePack } from "../../shared/types/index.js";
import type { RepairUiState } from "../../shared/ui/state.js";
import { createRepairPanel } from "./panel-shell.js";

type TextFn = (path: string[], fallback: string) => string;

interface RenderSessionWizardPanelOptions {
  embedded?: boolean;
}

type WizardStepId = RepairUiState["wizard"]["currentStep"];

const UNKNOWN_VALUE = REPAIR_UNKNOWN_VALUE;
export const REPAIR_WIZARD_STEP_ORDER = [
  "device-info",
  "symptoms",
  "ai-research",
  "evidence-review",
  "ready",
] as const;
const DEVICE_TYPE_OPTIONS = REPAIR_DEVICE_TYPE_OPTIONS;

const AI_TARGET_OPTIONS = [
  { targetSlot: "ai0", label: "AI 0" },
  { targetSlot: "ai1", label: "AI 1" },
  { targetSlot: "ai2", label: "AI 2" },
] as const;

function uniqueList(values: string[]): string[] {
  return Array.from(new Set(values.map((value) => value.trim()).filter(Boolean)));
}

function getCatalogEntriesForDevice(deviceType: string) {
  const normalizedDeviceType = deviceType.trim();
  if (normalizedDeviceType === "" || normalizedDeviceType === UNKNOWN_VALUE) {
    return REPAIR_DEVICE_CATALOG;
  }
  return REPAIR_DEVICE_CATALOG.filter((entry) => entry.deviceType === normalizedDeviceType);
}

export function getManufacturerSuggestions(deviceType: string): string[] {
  return uniqueList([
    UNKNOWN_VALUE,
    ...getCatalogEntriesForDevice(deviceType).flatMap((entry) =>
      entry.manufacturers.map((manufacturer) => manufacturer.manufacturer)
    ),
  ]);
}

function getMatchingManufacturers(deviceType: string, manufacturer: string) {
  const normalizedManufacturer = manufacturer.trim();
  return getCatalogEntriesForDevice(deviceType)
    .flatMap((entry) => entry.manufacturers)
    .filter(
      (entry) => normalizedManufacturer === "" || entry.manufacturer === normalizedManufacturer
    );
}

export function getModelSuggestions(deviceType: string, manufacturer: string): string[] {
  return uniqueList([
    UNKNOWN_VALUE,
    ...getMatchingManufacturers(deviceType, manufacturer).flatMap((entry) =>
      entry.modelFamilies.map((modelFamily) => modelFamily.label)
    ),
  ]);
}

export function getBoardCodeSuggestions(
  deviceType: string,
  manufacturer: string,
  model: string
): string[] {
  const normalizedModel = model.trim();
  const catalogEntries = getCatalogEntriesForDevice(deviceType);
  const matchingManufacturers = getMatchingManufacturers(deviceType, manufacturer);
  return uniqueList([
    UNKNOWN_VALUE,
    ...catalogEntries.flatMap((entry) => entry.boardCodePatterns),
    ...matchingManufacturers.flatMap((entry) => entry.boardCodePatterns),
    ...matchingManufacturers.flatMap((entry) =>
      entry.modelFamilies
        .filter((modelFamily) => normalizedModel === "" || modelFamily.label === normalizedModel)
        .flatMap((modelFamily) => modelFamily.boardCodePatterns)
    ),
  ]);
}

function getSymptomCatalogEntriesForDevice(deviceType: string) {
  const normalizedDeviceType = deviceType.trim();
  if (normalizedDeviceType === "" || normalizedDeviceType === UNKNOWN_VALUE) return [];
  return REPAIR_SYMPTOM_CATALOG.filter((entry) => entry.deviceType === normalizedDeviceType);
}

function getMatchingSymptomManufacturers(deviceType: string, manufacturer: string) {
  const normalizedManufacturer = manufacturer.trim();
  return getSymptomCatalogEntriesForDevice(deviceType)
    .flatMap((entry) => entry.manufacturers)
    .filter(
      (entry) => normalizedManufacturer === "" || entry.manufacturer === normalizedManufacturer
    );
}

function getSymptomOptionsForWizardDraft(draft: RepairUiState["wizard"]["draft"]): string[] {
  const normalizedModel = draft.model.trim();
  const catalogEntries = getSymptomCatalogEntriesForDevice(draft.deviceType);
  const matchingManufacturers = getMatchingSymptomManufacturers(
    draft.deviceType,
    draft.manufacturer
  );
  return uniqueList([
    ...REPAIR_SYMPTOM_OPTIONS,
    ...catalogEntries.flatMap((entry) => entry.symptoms),
    ...matchingManufacturers.flatMap((entry) => entry.symptoms),
    ...matchingManufacturers.flatMap((entry) =>
      entry.modelFamilies
        .filter((modelFamily) => normalizedModel === "" || modelFamily.label === normalizedModel)
        .flatMap((modelFamily) => modelFamily.symptoms)
    ),
    ...draft.primarySymptoms,
    ...draft.customSymptoms,
  ]);
}

function appendSymptomGroup(
  documentRef: Document,
  parent: HTMLElement,
  title: string,
  modifier: "available" | "selected"
): HTMLElement {
  const group = documentRef.createElement("div");
  group.className = [
    "repair-wizard-symptom-group",
    modifier === "available"
      ? "repair-wizard-symptom-group--available"
      : "repair-wizard-symptom-group--selected",
  ].join(" ");
  const heading = documentRef.createElement("div");
  heading.className = "repair-wizard-symptom-group__title";
  heading.textContent = title;
  group.append(heading);
  parent.append(group);
  return group;
}

function isDeviceComplete(state: RepairUiState): boolean {
  const draft = state.wizard.draft;
  return (
    draft.deviceType.trim() !== "" &&
    draft.manufacturer.trim() !== "" &&
    draft.model.trim() !== "" &&
    draft.boardCode.trim() !== ""
  );
}

function hasSymptoms(state: RepairUiState): boolean {
  return (
    state.wizard.draft.primarySymptoms.length > 0 || state.wizard.draft.customSymptoms.length > 0
  );
}

function hasResearchResult(state: RepairUiState): boolean {
  return state.wizard.generatedKnowledgePackId !== null || state.wizard.draft.researchSkipped;
}

export function canEnterRepairWizardStep(state: RepairUiState, stepId: WizardStepId): boolean {
  if (stepId === "device-info") return true;
  if (stepId === "symptoms") return isDeviceComplete(state);
  if (stepId === "ai-research") return isDeviceComplete(state) && hasSymptoms(state);
  if (stepId === "evidence-review") {
    return (
      isDeviceComplete(state) &&
      hasSymptoms(state) &&
      state.wizard.generatedKnowledgePackId !== null
    );
  }
  return isDeviceComplete(state) && hasSymptoms(state) && hasResearchResult(state);
}

export function isRepairWizardStepComplete(state: RepairUiState, stepId: WizardStepId): boolean {
  if (stepId === "device-info") return isDeviceComplete(state);
  if (stepId === "symptoms") return hasSymptoms(state);
  if (stepId === "ai-research") return hasResearchResult(state);
  if (stepId === "evidence-review")
    return state.wizard.evidenceReviewed || state.wizard.draft.researchSkipped;
  return state.phase === "session-active" || canEnterRepairWizardStep(state, "ready");
}

export function isRepairWizardStepIncomplete(state: RepairUiState, stepId: WizardStepId): boolean {
  if (stepId === "device-info") return !isDeviceComplete(state);
  if (stepId === "symptoms") return isDeviceComplete(state) && !hasSymptoms(state);
  if (stepId === "ai-research") return state.wizard.draft.researchStatus === "failed";
  return false;
}

function getWizardStepLabel(stepId: WizardStepId, text: TextFn): string {
  if (stepId === "device-info") return text(["wizard", "steps", "deviceInfo"], "Cihaz");
  if (stepId === "symptoms") return text(["wizard", "steps", "symptoms"], "Semptom");
  if (stepId === "ai-research") return text(["wizard", "steps", "aiResearch"], "Araştırma");
  if (stepId === "evidence-review") {
    return text(["wizard", "steps", "evidenceReview"], "İnceleme");
  }
  return text(["wizard", "steps", "ready"], "Hazır");
}

function getWizardHint(step: WizardStepId, text: TextFn): string {
  if (step === "device-info") {
    return text(
      ["wizard", "hints", "deviceInfo"],
      "Cihaz türü, marka, model ve kart kodunu tamamla; bilinmeyenler için Bilinmiyor seç."
    );
  }
  if (step === "symptoms") {
    return text(
      ["wizard", "hints", "symptoms"],
      "Varsayılan semptomları seç veya kendi semptomunu ekle."
    );
  }
  if (step === "ai-research") {
    return text(
      ["wizard", "hints", "aiResearch"],
      "AI slotunu seç, araştırmayı başlat veya evidence pack olmadan devam et."
    );
  }
  if (step === "evidence-review") {
    return text(
      ["wizard", "hints", "evidenceReview"],
      "Oturum arşivine alınacak kaynakları, arızaları ve test noktalarını seç."
    );
  }
  return text(
    ["wizard", "hints", "ready"],
    "Cihaz, semptom ve araştırma özetini kontrol edip tamiri başlat."
  );
}

function appendSuggestionMenu(
  documentRef: Document,
  parent: HTMLElement,
  field: string,
  options: string[]
): void {
  if (options.length === 0) return;
  const menu = documentRef.createElement("div");
  menu.className = "repair-wizard-suggestions";
  menu.setAttribute("role", "listbox");
  options.forEach((option) => {
    const optionEl = documentRef.createElement("button");
    optionEl.className = "repair-wizard-suggestion";
    optionEl.type = "button";
    optionEl.textContent = option;
    optionEl.dataset["repairAction"] = "wizard-suggestion";
    optionEl.dataset["wizardField"] = field;
    optionEl.dataset["value"] = option;
    menu.append(optionEl);
  });
  parent.append(menu);
}

function appendField(
  documentRef: Document,
  parent: HTMLElement,
  label: string,
  field: string,
  value: string,
  options: { datalist?: string[]; multiline?: boolean; required?: boolean } = {}
): void {
  const wrapper = documentRef.createElement("div");
  wrapper.className = `repair-wizard-field${options.required === true ? " repair-wizard-field--required" : ""}`;

  const inputId = `repair-wizard-${field}-field`;
  const labelEl = documentRef.createElement("label");
  labelEl.className = "repair-wizard-field__label";
  labelEl.htmlFor = inputId;
  labelEl.textContent = label;
  wrapper.append(labelEl);

  const input =
    options.multiline === true
      ? documentRef.createElement("textarea")
      : documentRef.createElement("input");
  input.id = inputId;
  input.className = "repair-wizard-field__input";
  input.value = value;
  input.dataset["repairAction"] = "wizard-field";
  input.dataset["wizardField"] = field;
  wrapper.append(input);
  if (options.datalist !== undefined && options.multiline !== true) {
    input.autocomplete = "off";
    input.dataset["repairSuggestions"] = "true";
    appendSuggestionMenu(documentRef, wrapper, field, options.datalist);
  }

  parent.append(wrapper);
}

function appendDeviceTypeSelect(
  documentRef: Document,
  parent: HTMLElement,
  state: RepairUiState
): void {
  const wrapper = documentRef.createElement("label");
  wrapper.className = "repair-wizard-field repair-wizard-field--required";

  const label = documentRef.createElement("span");
  label.textContent = "Cihaz türü";
  wrapper.append(label);

  const select = documentRef.createElement("select");
  select.className = "repair-wizard-field__input";
  select.dataset["repairAction"] = "wizard-field";
  select.dataset["wizardField"] = "deviceType";

  const placeholder = documentRef.createElement("option");
  placeholder.value = "";
  placeholder.textContent = "Seç";
  select.append(placeholder);

  DEVICE_TYPE_OPTIONS.forEach((option) => {
    const optionEl = documentRef.createElement("option");
    optionEl.value = option;
    optionEl.textContent = option;
    select.append(optionEl);
  });
  select.value = state.wizard.draft.deviceType;
  wrapper.append(select);
  parent.append(wrapper);
}

function appendAiTargetSelect(
  documentRef: Document,
  parent: HTMLElement,
  state: RepairUiState
): void {
  const wrapper = documentRef.createElement("label");
  wrapper.className = "repair-wizard-field";

  const label = documentRef.createElement("span");
  label.textContent = "AI slot";
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

function appendActionButton(
  documentRef: Document,
  parent: HTMLElement,
  label: string,
  action: string,
  className = "repair-cta-btn"
): HTMLButtonElement {
  const button = documentRef.createElement("button");
  button.className = className;
  button.type = "button";
  button.textContent = label;
  button.dataset["repairAction"] = action;
  parent.append(button);
  return button;
}

function appendSummaryRow(
  documentRef: Document,
  parent: HTMLElement,
  label: string,
  value: string
): void {
  const row = documentRef.createElement("div");
  row.className = "repair-wizard-summary-row";
  const labelEl = documentRef.createElement("span");
  labelEl.textContent = label;
  const valueEl = documentRef.createElement("strong");
  valueEl.textContent = value;
  row.append(labelEl, valueEl);
  parent.append(row);
}

function appendProgressList(
  documentRef: Document,
  parent: HTMLElement,
  state: RepairUiState
): void {
  if (state.wizard.researchProgress.length === 0) return;
  const resList = documentRef.createElement("div");
  resList.className = "repair-research-list";

  for (const item of state.wizard.researchProgress) {
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

  parent.append(resList);
}

function appendEvidenceCheckbox(params: {
  checked: boolean;
  documentRef: Document;
  id: string;
  kind: "resource" | "failure" | "test-point";
  label: string;
  meta: string;
  parent: HTMLElement;
}): void {
  const row = params.documentRef.createElement("label");
  row.className = "repair-evidence-option";

  const checkbox = params.documentRef.createElement("input");
  checkbox.type = "checkbox";
  checkbox.checked = params.checked;
  checkbox.dataset["repairAction"] = "evidence-selection";
  checkbox.dataset["evidenceKind"] = params.kind;
  checkbox.dataset["evidenceId"] = params.id;
  row.append(checkbox);

  const body = params.documentRef.createElement("span");
  body.className = "repair-evidence-option__body";
  const title = params.documentRef.createElement("strong");
  title.textContent = params.label;
  const meta = params.documentRef.createElement("span");
  meta.textContent = params.meta;
  body.append(title, meta);
  row.append(body);

  params.parent.append(row);
}

function appendEvidenceGroup(
  documentRef: Document,
  parent: HTMLElement,
  title: string
): HTMLElement {
  const group = documentRef.createElement("div");
  group.className = "repair-evidence-group";
  const heading = documentRef.createElement("h3");
  heading.textContent = title;
  group.append(heading);
  parent.append(group);
  return group;
}

function renderDeviceStep(documentRef: Document, state: RepairUiState): HTMLElement {
  const form = documentRef.createElement("div");
  form.className = "repair-wizard-form";
  const draft = state.wizard.draft;
  appendDeviceTypeSelect(documentRef, form, state);
  appendField(documentRef, form, "Marka", "manufacturer", draft.manufacturer, {
    datalist: getManufacturerSuggestions(draft.deviceType),
    required: true,
  });
  appendField(documentRef, form, "Model", "model", draft.model, {
    datalist: getModelSuggestions(draft.deviceType, draft.manufacturer),
    required: true,
  });
  appendField(documentRef, form, "Kart kodu", "boardCode", draft.boardCode, {
    datalist: getBoardCodeSuggestions(draft.deviceType, draft.manufacturer, draft.model),
    required: true,
  });
  appendField(documentRef, form, "Seri / iş no", "serialNumber", draft.serialNumber);
  appendField(documentRef, form, "Tezgah notu", "intakeNotes", draft.intakeNotes, {
    multiline: true,
  });
  return form;
}

function renderSymptomsStep(documentRef: Document, state: RepairUiState): HTMLElement {
  const form = documentRef.createElement("div");
  form.className = "repair-wizard-form";
  const draft = state.wizard.draft;

  const availableGroup = appendSymptomGroup(documentRef, form, "Önerilen semptomlar", "available");
  const chipRow = documentRef.createElement("div");
  chipRow.className = "repair-wizard-symptoms";
  const symptomOptions = getSymptomOptionsForWizardDraft(draft);
  const selectedSymptoms = uniqueList([...draft.primarySymptoms, ...draft.customSymptoms]);
  symptomOptions.forEach((symptom) => {
    const chip = documentRef.createElement("button");
    chip.className = `repair-skill-chip${selectedSymptoms.includes(symptom) ? " repair-skill-chip--active" : ""}`;
    chip.type = "button";
    chip.textContent = symptom;
    chip.dataset["repairAction"] = "wizard-symptom";
    chip.dataset["symptom"] = symptom;
    chipRow.append(chip);
  });
  availableGroup.append(chipRow);

  if (selectedSymptoms.length > 0) {
    const selectedGroup = appendSymptomGroup(documentRef, form, "Seçili semptomlar", "selected");
    const selectedRow = documentRef.createElement("div");
    selectedRow.className = "repair-wizard-selected-symptoms";
    selectedSymptoms.forEach((symptom) => {
      const selected = documentRef.createElement("button");
      selected.className = "repair-selected-chip";
      selected.type = "button";
      selected.textContent = `${symptom} x`;
      selected.dataset["repairAction"] = "remove-wizard-symptom";
      selected.dataset["symptom"] = symptom;
      selectedRow.append(selected);
    });
    selectedGroup.append(selectedRow);
  }

  const customRow = documentRef.createElement("div");
  customRow.className = "repair-wizard-inline-add";
  const customInput = documentRef.createElement("input");
  customInput.className = "repair-wizard-field__input";
  customInput.placeholder = "Özel semptom";
  customInput.dataset["repairInput"] = "wizard-custom-symptom";
  customRow.append(customInput);
  appendActionButton(documentRef, customRow, "Ekle", "add-custom-symptom", "repair-secondary-btn");
  form.append(customRow);

  appendField(documentRef, form, "Gözlem notu", "symptomFreeText", draft.symptomFreeText, {
    multiline: true,
  });
  return form;
}

function renderResearchStep(
  documentRef: Document,
  state: RepairUiState,
  text: TextFn
): HTMLElement {
  const form = documentRef.createElement("div");
  form.className = "repair-wizard-form";
  appendAiTargetSelect(documentRef, form, state);

  const message = state.wizard.draft.researchMessage ?? state.aiDispatch.research.message;
  if (message !== null && message.trim() !== "") {
    const status = documentRef.createElement("div");
    status.className = `repair-wizard-status repair-wizard-status--${state.wizard.draft.researchStatus}`;
    status.textContent = message;
    form.append(status);
  }

  if (state.wizard.draft.researchStatus === "failed") {
    const warning = documentRef.createElement("div");
    warning.className = "repair-wizard-warning";
    warning.textContent = text(
      ["wizard", "research", "bridgeWarning"],
      "AI bridge çalışmadı veya sonuç dönmedi. Tekrar dene ya da AI olmadan devam et."
    );
    form.append(warning);
  }

  appendProgressList(documentRef, form, state);

  const actions = documentRef.createElement("div");
  actions.className = "repair-wizard-inline-actions";
  appendActionButton(
    documentRef,
    actions,
    state.wizard.draft.researchStatus === "failed" ? "Tekrar dene" : "Araştırmayı başlat",
    "start-wizard-research"
  );
  appendActionButton(
    documentRef,
    actions,
    "AI olmadan devam et",
    "skip-wizard-research",
    "repair-secondary-btn"
  );
  form.append(actions);

  return form;
}

function renderEvidenceReviewStep(
  documentRef: Document,
  state: RepairUiState,
  text: TextFn
): HTMLElement {
  const review = documentRef.createElement("div");
  review.className = "repair-wizard-form";
  const pack: RepairKnowledgePack | null = state.knowledgePack.pack;

  if (pack === null) {
    const summary = documentRef.createElement("div");
    summary.className = "repair-wizard-guidance";
    summary.textContent = text(
      ["wizard", "evidenceReview", "empty"],
      "Evidence pack yok. Araştırmayı tekrar çalıştır veya AI olmadan devam et."
    );
    review.append(summary);
    return review;
  }

  const resourceGroup = appendEvidenceGroup(documentRef, review, "Kaynaklar");
  pack.resources.forEach((resource) => {
    appendEvidenceCheckbox({
      checked: state.wizard.draft.selectedEvidenceResourceIds.includes(resource.id),
      documentRef,
      id: resource.id,
      kind: "resource",
      label: resource.label,
      meta: `${resource.kind} - ${Math.round(resource.confidence * 100)}%`,
      parent: resourceGroup,
    });
  });

  const failureGroup = appendEvidenceGroup(documentRef, review, "Arızalar");
  pack.commonFailures.forEach((failure) => {
    appendEvidenceCheckbox({
      checked: state.wizard.draft.selectedFailureIds.includes(failure.id),
      documentRef,
      id: failure.id,
      kind: "failure",
      label: failure.label,
      meta: `${failure.recommendedAction} - ${Math.round(failure.confidence * 100)}%`,
      parent: failureGroup,
    });
  });

  const testPointGroup = appendEvidenceGroup(documentRef, review, "Test noktaları");
  pack.testPoints.forEach((point) => {
    appendEvidenceCheckbox({
      checked: state.wizard.draft.selectedTestPointIds.includes(point.id),
      documentRef,
      id: point.id,
      kind: "test-point",
      label: point.label,
      meta: `${point.rail} ${point.expectedValue}${point.unit}`,
      parent: testPointGroup,
    });
  });

  if (pack.notes.length > 0) {
    const notes = appendEvidenceGroup(documentRef, review, "Notlar");
    pack.notes.slice(0, 3).forEach((note) => {
      const row = documentRef.createElement("div");
      row.className = "repair-research-item";
      row.textContent = note;
      notes.append(row);
    });
  }

  return review;
}

function renderReadyStep(documentRef: Document, state: RepairUiState): HTMLElement {
  const ready = documentRef.createElement("div");
  ready.className = "repair-wizard-form";
  const draft = state.wizard.draft;
  appendSummaryRow(documentRef, ready, "Cihaz", `${draft.deviceType} / ${draft.manufacturer}`);
  appendSummaryRow(documentRef, ready, "Model", `${draft.model} / ${draft.boardCode}`);
  appendSummaryRow(
    documentRef,
    ready,
    "Semptom",
    uniqueList([...draft.primarySymptoms, ...draft.customSymptoms]).join(", ") || UNKNOWN_VALUE
  );
  appendSummaryRow(
    documentRef,
    ready,
    "Araştırma",
    draft.researchSkipped
      ? "AI olmadan"
      : state.wizard.generatedKnowledgePackId !== null
        ? "Evidence pack hazır"
        : "Bekliyor"
  );
  appendSummaryRow(
    documentRef,
    ready,
    "Evidence",
    `${draft.selectedEvidenceResourceIds.length} kaynak, ${draft.selectedFailureIds.length} arıza, ${draft.selectedTestPointIds.length} test noktası`
  );

  const actions = documentRef.createElement("div");
  actions.className = "repair-wizard-inline-actions";
  const start = appendActionButton(documentRef, actions, "Tamiri başlat", "create-session");
  start.disabled = !canEnterRepairWizardStep(state, "ready");
  ready.append(actions);
  return ready;
}

export function renderSessionWizardPanel(
  documentRef: Document,
  state: RepairUiState,
  text: TextFn,
  options: RenderSessionWizardPanelOptions = {}
): HTMLElement {
  const body = documentRef.createElement("div");
  body.className = "repair-panel__body repair-wizard-intake";

  const wizard = state.wizard;
  const stepper = documentRef.createElement("div");
  stepper.className = "repair-wizard-stepper";

  const currentIdx = REPAIR_WIZARD_STEP_ORDER.indexOf(wizard.currentStep);

  for (const [i, stepId] of REPAIR_WIZARD_STEP_ORDER.entries()) {
    const step = documentRef.createElement("button");
    const isDone = isRepairWizardStepComplete(state, stepId);
    const isActive = i === currentIdx;
    const isAvailable = canEnterRepairWizardStep(state, stepId);
    const isIncomplete = isRepairWizardStepIncomplete(state, stepId);
    step.type = "button";
    step.className = [
      "repair-wizard-step",
      isActive ? "repair-wizard-step--active" : "",
      isDone && !isActive ? "repair-wizard-step--done" : "",
      isAvailable ? "repair-wizard-step--clickable" : "repair-wizard-step--disabled",
      isIncomplete ? "repair-wizard-step--incomplete" : "",
    ]
      .filter(Boolean)
      .join(" ");
    step.disabled = !isAvailable;
    if (isAvailable) {
      step.dataset["repairAction"] = "advance-wizard";
      step.dataset["step"] = stepId;
    }

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
  hint.textContent = getWizardHint(wizard.currentStep, text);
  body.append(hint);

  if (wizard.currentStep === "device-info") {
    body.append(renderDeviceStep(documentRef, state));
  }
  if (wizard.currentStep === "symptoms") {
    body.append(renderSymptomsStep(documentRef, state));
  }
  if (wizard.currentStep === "ai-research") {
    body.append(renderResearchStep(documentRef, state, text));
  }
  if (wizard.currentStep === "evidence-review") {
    body.append(renderEvidenceReviewStep(documentRef, state, text));
  }
  if (wizard.currentStep === "ready") {
    body.append(renderReadyStep(documentRef, state));
  }

  const panelId =
    options.embedded === true
      ? "session-wizard repair-panel--session-wizard-embedded"
      : "session-wizard";

  return createRepairPanel(documentRef, {
    panelId,
    eyebrow: options.embedded === true ? "" : text(["wizard", "eyebrow"], "TAMİR"),
    title: options.embedded === true ? "" : text(["wizard", "title"], "Tamir Alımı"),
    statusDot: wizard.draft.researchStatus === "failed" ? "amber" : "idle",
    collapsed: options.embedded === true ? false : state.layout.collapsedPanels["session-wizard"],
    noPanelHeader: options.embedded === true,
    body,
  });
}
