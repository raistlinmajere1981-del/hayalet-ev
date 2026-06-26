import {
  REPAIR_DEVICE_CATALOG,
  REPAIR_DEVICE_TYPE_OPTIONS,
  REPAIR_SYMPTOM_CATALOG,
  REPAIR_SYMPTOM_OPTIONS,
  REPAIR_UNKNOWN_VALUE,
} from "../../shared/data/index.js";
import type {
  RepairCommonFailure,
  RepairKnowledgePack,
  RepairKnowledgePackResource,
  RepairKnowledgePackResourceKind,
  RepairTestPoint,
  RepairWizardManualNote,
} from "../../shared/types/index.js";
import type { RepairUiState } from "../../shared/ui/state.js";
import { resolveRepairAssetUrl } from "../repair-asset-url.js";
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
    return isDeviceComplete(state) && hasSymptoms(state) && hasResearchResult(state);
  }
  return isDeviceComplete(state) && hasSymptoms(state) && hasResearchResult(state);
}

export function isRepairWizardStepComplete(state: RepairUiState, stepId: WizardStepId): boolean {
  if (stepId === "device-info") return isDeviceComplete(state);
  if (stepId === "symptoms") return hasSymptoms(state);
  if (stepId === "ai-research") return hasResearchResult(state);
  if (stepId === "evidence-review") return state.wizard.evidenceReviewed;
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

type EvidenceSelectionKind = "resource" | "failure" | "test-point";
type EvidenceRemovalKind = EvidenceSelectionKind | "note";
type ManualEvidenceDraft = RepairUiState["wizard"]["draft"]["manualEvidence"];

interface EvidenceResourcePanelConfig {
  kind: RepairKnowledgePackResourceKind;
  title: string;
  addLabel: string;
  urlPlaceholder: string;
}

const RESOURCE_PANEL_CONFIGS: EvidenceResourcePanelConfig[] = [
  {
    kind: "schematic",
    title: "Şemalar",
    addLabel: "Şema ekle",
    urlPlaceholder: "https://... veya /dosya/yolu.pdf",
  },
  {
    kind: "board-image",
    title: "Kart görselleri",
    addLabel: "Görsel ekle",
    urlPlaceholder: "https://... veya /dosya/yolu.png",
  },
  {
    kind: "datasheet",
    title: "Datasheet / doküman",
    addLabel: "Doküman ekle",
    urlPlaceholder: "https://... veya /dosya/yolu.pdf",
  },
  {
    kind: "thread",
    title: "Forum / link",
    addLabel: "Link ekle",
    urlPlaceholder: "https://forum...",
  },
  {
    kind: "note",
    title: "Kaynak notları",
    addLabel: "Kaynak ekle",
    urlPlaceholder: "https://... veya /dosya/yolu.txt",
  },
];

function formatEvidenceConfidence(confidence: number): string {
  return `${Math.round(confidence * 100)}%`;
}

function joinEvidenceMeta(parts: Array<string | null | undefined | false>): string {
  return parts
    .filter((part): part is string => typeof part === "string" && part.trim() !== "")
    .join(" - ");
}

function appendEvidencePanel(
  documentRef: Document,
  parent: HTMLElement,
  title: string,
  count: number
): HTMLElement {
  const panel = documentRef.createElement("section");
  panel.className = "repair-evidence-panel";

  const header = documentRef.createElement("div");
  header.className = "repair-evidence-panel__header";
  const heading = documentRef.createElement("h3");
  heading.textContent = title;
  const countEl = documentRef.createElement("span");
  countEl.className = "repair-evidence-panel__count";
  countEl.textContent = String(count);
  header.append(heading, countEl);

  const list = documentRef.createElement("div");
  list.className = "repair-evidence-panel__list";
  panel.append(header, list);
  parent.append(panel);
  return list;
}

function appendEmptyEvidenceMessage(documentRef: Document, parent: HTMLElement): void {
  const empty = documentRef.createElement("div");
  empty.className = "repair-evidence-panel__empty";
  empty.textContent = "Kayıt yok";
  parent.append(empty);
}

function appendEvidenceEntry(params: {
  checked?: boolean;
  documentRef: Document;
  id: string;
  label: string;
  meta: string;
  parent: HTMLElement;
  removalKind: EvidenceRemovalKind;
  resource?: RepairKnowledgePackResource;
  selectionKind?: EvidenceSelectionKind;
  text: TextFn;
}): void {
  const row = params.documentRef.createElement("div");
  row.className = [
    "repair-evidence-option",
    params.resource !== undefined ? "repair-evidence-option--resource" : "",
    params.selectionKind === undefined ? "repair-evidence-option--static" : "",
  ]
    .filter(Boolean)
    .join(" ");

  if (params.selectionKind !== undefined) {
    const checkbox = params.documentRef.createElement("input");
    checkbox.type = "checkbox";
    checkbox.checked = params.checked === true;
    checkbox.dataset["repairAction"] = "evidence-selection";
    checkbox.dataset["evidenceKind"] = params.selectionKind;
    checkbox.dataset["evidenceId"] = params.id;
    row.append(checkbox);
  } else {
    const marker = params.documentRef.createElement("span");
    marker.className = "repair-evidence-option__marker";
    row.append(marker);
  }

  const body = params.documentRef.createElement("span");
  body.className = "repair-evidence-option__body";
  const title = params.documentRef.createElement("strong");
  title.textContent = params.label;
  body.append(title);
  if (params.meta.trim() !== "") {
    const meta = params.documentRef.createElement("span");
    meta.textContent = params.meta;
    body.append(meta);
  }
  row.append(body);

  if (params.resource !== undefined) {
    appendEvidenceResourceActions(params.documentRef, row, params.resource, params.text);
  }

  const remove = params.documentRef.createElement("button");
  remove.className = "repair-evidence-option__remove";
  remove.type = "button";
  remove.textContent = params.text(["wizard", "evidenceReview", "remove"], "Kaldır");
  remove.dataset["repairAction"] = "remove-knowledge-evidence";
  remove.dataset["evidenceKind"] = params.removalKind;
  remove.dataset["evidenceId"] = params.id;
  row.append(remove);

  params.parent.append(row);
}

function getEvidenceResourceUrl(resource: RepairKnowledgePackResource): string | null {
  return resource.sourceUrl ?? resource.downloadUrl ?? resource.src;
}

function toEvidenceHref(source: string): string {
  const resolved = resolveRepairAssetUrl(source) ?? source;
  if (/^[a-zA-Z]:[\\/]/.test(resolved)) return `file:///${resolved.replace(/\\/g, "/")}`;
  if (resolved.startsWith("/")) return `file://${resolved}`;
  return resolved;
}

function appendEvidenceResourceActions(
  documentRef: Document,
  row: HTMLElement,
  resource: RepairKnowledgePackResource,
  text: TextFn
): void {
  const url = getEvidenceResourceUrl(resource);
  if (url === null) return;
  const resolvedUrl = resolveRepairAssetUrl(url) ?? url;
  const actions = documentRef.createElement("div");
  actions.className = "repair-evidence-option__actions";

  const preview = documentRef.createElement("button");
  preview.className = "repair-evidence-option__link";
  preview.type = "button";
  preview.textContent = text(["wizard", "evidenceReview", "preview"], "Önizle");
  preview.dataset["repairAction"] = "open-evidence-source";
  preview.dataset["sourceUrl"] = resolvedUrl;
  actions.append(preview);

  const downloadUrl = resource.downloadUrl ?? url;
  const download = documentRef.createElement("a");
  download.className = "repair-evidence-option__link";
  download.href = toEvidenceHref(downloadUrl);
  download.target = "_blank";
  download.rel = "noopener noreferrer";
  download.download = "";
  download.textContent = text(["wizard", "evidenceReview", "download"], "İndir");
  actions.append(download);
  row.append(actions);
}

function appendManualInput(params: {
  dataset?: Record<string, string>;
  documentRef: Document;
  inputMode?: string;
  name: string;
  parent: HTMLElement;
  placeholder: string;
  type?: string;
}): HTMLInputElement {
  const input = params.documentRef.createElement("input");
  input.className = "repair-wizard-field__input";
  input.placeholder = params.placeholder;
  input.dataset["repairInput"] = params.name;
  input.type = params.type ?? "text";
  if (params.inputMode !== undefined) input.inputMode = params.inputMode;
  Object.entries(params.dataset ?? {}).forEach(([key, value]) => {
    input.dataset[key] = value;
  });
  params.parent.append(input);
  return input;
}

function appendManualTextarea(params: {
  dataset?: Record<string, string>;
  documentRef: Document;
  name: string;
  parent: HTMLElement;
  placeholder: string;
}): HTMLTextAreaElement {
  const textarea = params.documentRef.createElement("textarea");
  textarea.className = "repair-wizard-field__input";
  textarea.placeholder = params.placeholder;
  textarea.dataset["repairInput"] = params.name;
  Object.entries(params.dataset ?? {}).forEach(([key, value]) => {
    textarea.dataset[key] = value;
  });
  params.parent.append(textarea);
  return textarea;
}

function appendManualEvidenceFormActions(
  documentRef: Document,
  parent: HTMLElement,
  label: string,
  action: string,
  dataset: Record<string, string> = {}
): void {
  const actions = documentRef.createElement("div");
  actions.className = "repair-manual-evidence-form__actions";
  const add = appendActionButton(documentRef, actions, label, action, "repair-secondary-btn");
  Object.entries(dataset).forEach(([key, value]) => {
    add.dataset[key] = value;
  });
  parent.append(actions);
}

function appendManualResourceForm(
  documentRef: Document,
  parent: HTMLElement,
  config: EvidenceResourcePanelConfig,
  text: TextFn
): void {
  const form = documentRef.createElement("div");
  form.className = "repair-manual-evidence-form repair-manual-evidence-form--resource";
  const dataset = { resourceKind: config.kind };
  const grid = documentRef.createElement("div");
  grid.className = "repair-manual-evidence-form__grid";

  appendManualInput({
    dataset,
    documentRef,
    name: "manual-resource-label",
    parent: grid,
    placeholder: text(["wizard", "evidenceReview", "manualLabel"], "Kaynak adı"),
  });
  appendManualInput({
    dataset,
    documentRef,
    name: "manual-resource-url",
    parent: grid,
    placeholder: config.urlPlaceholder,
  });

  const pick = appendActionButton(
    documentRef,
    grid,
    "Dosya",
    "pick-manual-resource-file",
    "repair-secondary-btn"
  );
  pick.dataset["resourceKind"] = config.kind;
  form.append(grid);
  appendManualEvidenceFormActions(
    documentRef,
    form,
    text(["wizard", "evidenceReview", "manualAdd"], config.addLabel),
    "add-manual-knowledge-resource",
    dataset
  );
  parent.append(form);
}

function appendManualFailureForm(documentRef: Document, parent: HTMLElement): void {
  const form = documentRef.createElement("div");
  form.className = "repair-manual-evidence-form";
  const grid = documentRef.createElement("div");
  grid.className = "repair-manual-evidence-form__grid";
  appendManualInput({
    documentRef,
    name: "manual-failure-label",
    parent: grid,
    placeholder: "Arıza adı",
  });
  appendManualInput({
    documentRef,
    name: "manual-failure-part",
    parent: grid,
    placeholder: "Parça / bölge",
  });
  appendManualInput({
    documentRef,
    name: "manual-failure-action",
    parent: grid,
    placeholder: "Önerilen işlem",
  });
  form.append(grid);
  appendManualTextarea({
    documentRef,
    name: "manual-failure-rationale",
    parent: form,
    placeholder: "Gerekçe / gözlem",
  });
  appendManualEvidenceFormActions(documentRef, form, "Arıza ekle", "add-manual-knowledge-failure");
  parent.append(form);
}

function appendManualTestPointForm(documentRef: Document, parent: HTMLElement): void {
  const form = documentRef.createElement("div");
  form.className = "repair-manual-evidence-form";
  const grid = documentRef.createElement("div");
  grid.className = "repair-manual-evidence-form__grid";
  appendManualInput({
    documentRef,
    name: "manual-test-label",
    parent: grid,
    placeholder: "Test noktası",
  });
  appendManualInput({ documentRef, name: "manual-test-rail", parent: grid, placeholder: "Rail" });
  appendManualInput({
    documentRef,
    inputMode: "decimal",
    name: "manual-test-expected",
    parent: grid,
    placeholder: "Beklenen değer",
  });
  appendManualInput({ documentRef, name: "manual-test-unit", parent: grid, placeholder: "Birim" });
  appendManualInput({
    documentRef,
    inputMode: "decimal",
    name: "manual-test-tolerance",
    parent: grid,
    placeholder: "Tolerans",
  });
  form.append(grid);
  appendManualEvidenceFormActions(
    documentRef,
    form,
    "Test noktası ekle",
    "add-manual-knowledge-test-point"
  );
  parent.append(form);
}

function appendManualNoteForm(documentRef: Document, parent: HTMLElement): void {
  const form = documentRef.createElement("div");
  form.className = "repair-manual-evidence-form";
  appendManualTextarea({
    documentRef,
    name: "manual-note-text",
    parent: form,
    placeholder: "Not",
  });
  appendManualInput({
    documentRef,
    name: "manual-note-source",
    parent: form,
    placeholder: "Kaynak",
  });
  appendManualEvidenceFormActions(documentRef, form, "Not ekle", "add-manual-knowledge-note");
  parent.append(form);
}

function getReviewResources(
  pack: RepairKnowledgePack,
  manualEvidence: ManualEvidenceDraft,
  kind: RepairKnowledgePackResourceKind
): RepairKnowledgePackResource[] {
  const removedResourceIds = new Set(manualEvidence.removedResourceIds);
  return [
    ...pack.resources.filter(
      (resource) => resource.kind === kind && !removedResourceIds.has(resource.id)
    ),
    ...manualEvidence.resources.filter((resource) => resource.kind === kind),
  ];
}

function getReviewFailures(
  pack: RepairKnowledgePack,
  manualEvidence: ManualEvidenceDraft
): RepairCommonFailure[] {
  const removedFailureIds = new Set(manualEvidence.removedFailureIds);
  return [
    ...pack.commonFailures.filter((failure) => !removedFailureIds.has(failure.id)),
    ...manualEvidence.failures,
  ];
}

function getReviewTestPoints(
  pack: RepairKnowledgePack,
  manualEvidence: ManualEvidenceDraft
): RepairTestPoint[] {
  const removedTestPointIds = new Set(manualEvidence.removedTestPointIds);
  return [
    ...pack.testPoints.filter((point) => !removedTestPointIds.has(point.id)),
    ...manualEvidence.testPoints,
  ];
}

function createPackNoteId(index: number): string {
  return `note-ai-${index + 1}`;
}

function getReviewNotes(
  pack: RepairKnowledgePack,
  manualEvidence: ManualEvidenceDraft
): RepairWizardManualNote[] {
  const removedNoteIds = new Set(manualEvidence.removedNoteIds);
  return [
    ...pack.notes
      .map<RepairWizardManualNote>((note, index) => ({
        id: createPackNoteId(index),
        text: note,
        source: "AI araştırması",
        confidence: 1,
      }))
      .filter((note) => !removedNoteIds.has(note.id)),
    ...manualEvidence.notes,
  ];
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
  const draft = state.wizard.draft;
  const manualEvidence = draft.manualEvidence;

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

  RESOURCE_PANEL_CONFIGS.forEach((config) => {
    const resources = getReviewResources(pack, manualEvidence, config.kind);
    const panel = appendEvidencePanel(documentRef, review, config.title, resources.length);
    if (resources.length === 0) appendEmptyEvidenceMessage(documentRef, panel);
    resources.forEach((resource) => {
      appendEvidenceEntry({
        checked: draft.selectedEvidenceResourceIds.includes(resource.id),
        documentRef,
        id: resource.id,
        label: resource.label,
        meta: joinEvidenceMeta([
          resource.addedBy === "operator" ? "Manuel" : resource.source,
          formatEvidenceConfidence(resource.confidence),
          resource.pages === null ? null : `${resource.pages} sayfa`,
        ]),
        parent: panel,
        removalKind: "resource",
        resource,
        selectionKind: "resource",
        text,
      });
    });
    appendManualResourceForm(documentRef, panel, config, text);
  });

  const failures = getReviewFailures(pack, manualEvidence);
  const failurePanel = appendEvidencePanel(documentRef, review, "Arızalar", failures.length);
  if (failures.length === 0) appendEmptyEvidenceMessage(documentRef, failurePanel);
  failures.forEach((failure) => {
    appendEvidenceEntry({
      checked: draft.selectedFailureIds.includes(failure.id),
      documentRef,
      id: failure.id,
      label: failure.label,
      meta: joinEvidenceMeta([
        failure.affectedPart,
        failure.recommendedAction,
        formatEvidenceConfidence(failure.confidence),
      ]),
      parent: failurePanel,
      removalKind: "failure",
      selectionKind: "failure",
      text,
    });
  });
  appendManualFailureForm(documentRef, failurePanel);

  const testPoints = getReviewTestPoints(pack, manualEvidence);
  const testPointPanel = appendEvidencePanel(
    documentRef,
    review,
    "Test noktaları",
    testPoints.length
  );
  if (testPoints.length === 0) appendEmptyEvidenceMessage(documentRef, testPointPanel);
  testPoints.forEach((point) => {
    appendEvidenceEntry({
      checked: draft.selectedTestPointIds.includes(point.id),
      documentRef,
      id: point.id,
      label: point.label,
      meta: joinEvidenceMeta([
        point.rail,
        `${point.expectedValue}${point.unit}`,
        point.tolerance === null ? null : `+/-${point.tolerance}${point.unit}`,
      ]),
      parent: testPointPanel,
      removalKind: "test-point",
      selectionKind: "test-point",
      text,
    });
  });
  appendManualTestPointForm(documentRef, testPointPanel);

  const notes = getReviewNotes(pack, manualEvidence);
  const notePanel = appendEvidencePanel(documentRef, review, "Notlar", notes.length);
  if (notes.length === 0) appendEmptyEvidenceMessage(documentRef, notePanel);
  notes.forEach((note) => {
    appendEvidenceEntry({
      documentRef,
      id: note.id,
      label: note.text,
      meta: joinEvidenceMeta([note.source, formatEvidenceConfidence(note.confidence)]),
      parent: notePanel,
      removalKind: "note",
      text,
    });
  });
  appendManualNoteForm(documentRef, notePanel);

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
    noPanelControls: true,
    body,
  });
}
