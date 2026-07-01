import type { RepairUiState } from "../../shared/ui/state.js";
import {
  getMeasurementDisplayLabel,
  getMeasurementModeOptions,
  getMeasurementModeRangeText,
} from "../runtime/measurement-labels.js";
import { createRepairPanel } from "./panel-shell.js";

type TextFn = (path: string[], fallback: string) => string;

const MEASUREMENT_UNIT_OPTIONS = [
  "V",
  "mV",
  "A",
  "mA",
  "Ohm",
  "kOhm",
  "MOhm",
  "F",
  "uF",
  "nF",
  "Hz",
];

function createFieldShell(documentRef: Document, labelText: string): HTMLLabelElement {
  const field = documentRef.createElement("label");
  field.className = "repair-measurement-field";

  const label = documentRef.createElement("span");
  label.className = "repair-measurement-field__label";
  label.textContent = labelText;
  field.append(label);

  return field;
}

function appendTextInput(
  documentRef: Document,
  parent: HTMLElement,
  options: {
    label: string;
    inputName: string;
    placeholder: string;
    value?: string;
    inputMode?: "decimal" | "text";
    required?: boolean;
  }
): HTMLInputElement {
  const field = createFieldShell(documentRef, options.label);
  const input = documentRef.createElement("input");
  input.className = "repair-measurement-field__control";
  input.type = "text";
  input.placeholder = options.placeholder;
  input.value = options.value ?? "";
  input.dataset["repairInput"] = options.inputName;
  if (options.inputMode !== undefined) input.inputMode = options.inputMode;
  if (options.required === true) input.required = true;
  field.append(input);
  parent.append(field);
  return input;
}

function appendSelectInput(
  documentRef: Document,
  parent: HTMLElement,
  options: {
    label: string;
    inputName: string;
    selected: string;
    items: Array<{ value: string; label: string }>;
  }
): HTMLSelectElement {
  const field = createFieldShell(documentRef, options.label);
  const select = documentRef.createElement("select");
  select.className = "repair-measurement-field__control";
  select.dataset["repairInput"] = options.inputName;

  options.items.forEach((item) => {
    const option = documentRef.createElement("option");
    option.value = item.value;
    option.textContent = item.label;
    option.selected = item.value === options.selected;
    select.append(option);
  });

  field.append(select);
  parent.append(field);
  return select;
}

function appendReadingsEmptyState(documentRef: Document, list: HTMLElement, text: TextFn): void {
  const empty = documentRef.createElement("div");
  empty.className = "repair-readings-empty";
  empty.textContent = text(["measurement", "labels", "noReadings"], "Henüz manuel ölçüm yok");
  list.append(empty);
}

export function renderMeasurementPanel(
  documentRef: Document,
  state: RepairUiState,
  text: TextFn
): HTMLElement {
  const body = documentRef.createElement("div");
  body.className = "repair-panel__body";

  const meas = state.measurement;
  const evidence = state.workbench.measurementEvidence;
  const hasActiveSession = state.sessions.activeId !== null && state.sessions.detail !== null;

  // -- Tabs
  const tabs = documentRef.createElement("div");
  tabs.className = "repair-tabs";

  const tabItems = [
    { id: "multimeter", label: text(["measurement", "tabMultimeter"], "Multimetre") },
    { id: "power-supply", label: text(["measurement", "tabPsu"], "Güç Kaynağı") },
    { id: "signal-gen", label: text(["measurement", "tabSigGen"], "Sinyal Üretici") },
  ];

  for (const tab of tabItems) {
    const tabEl = documentRef.createElement("div");
    tabEl.className = `repair-tab${
      hasActiveSession && meas.activeInstrumentKind === tab.id ? " repair-tab--active" : ""
    }`;
    tabEl.textContent = tab.label;
    tabEl.dataset["repairAction"] = "set-instrument";
    tabEl.dataset["instrumentKind"] = tab.id;
    tabs.append(tabEl);
  }

  body.append(tabs);

  // -- Current reading display
  const display = documentRef.createElement("div");
  display.className = "repair-measurement-display";

  const valueEl = documentRef.createElement("div");
  valueEl.className = "repair-measurement-display__value";
  valueEl.textContent = meas.current.display;
  display.append(valueEl);

  const unitEl = documentRef.createElement("div");
  unitEl.className = "repair-measurement-display__unit";
  unitEl.textContent = meas.current.unit;
  display.append(unitEl);

  const labelEl = documentRef.createElement("div");
  labelEl.className = "repair-measurement-display__label";
  labelEl.textContent = getMeasurementDisplayLabel(meas.current.label, text);
  display.append(labelEl);

  const modeEl = documentRef.createElement("div");
  modeEl.className = "repair-measurement-display__mode";
  modeEl.textContent = getMeasurementModeRangeText(meas.current.mode, meas.current.range, text);
  display.append(modeEl);

  body.append(display);

  const formHeader = documentRef.createElement("div");
  formHeader.className = "repair-section-label";
  formHeader.textContent = text(["measurement", "manualEntry"], "Manuel Okuma");
  body.append(formHeader);

  const form = documentRef.createElement("div");
  form.className = "repair-measurement-form";

  appendTextInput(documentRef, form, {
    label: text(["measurement", "reference"], "Referans"),
    inputName: "measurement-reference",
    placeholder: "TP1 / U14 VCC",
  });
  appendTextInput(documentRef, form, {
    label: text(["measurement", "value"], "Değer"),
    inputName: "measurement-raw-display",
    placeholder: "0.000 / OL",
    inputMode: "decimal",
    required: true,
  });
  appendSelectInput(documentRef, form, {
    label: text(["measurement", "mode"], "Mod"),
    inputName: "measurement-mode",
    selected: meas.current.mode,
    items: getMeasurementModeOptions(text),
  });
  appendSelectInput(documentRef, form, {
    label: text(["measurement", "unit"], "Birim"),
    inputName: "measurement-unit",
    selected: meas.current.unit || "V",
    items: MEASUREMENT_UNIT_OPTIONS.map((unit) => ({ value: unit, label: unit })),
  });
  appendTextInput(documentRef, form, {
    label: text(["measurement", "range"], "Aralık"),
    inputName: "measurement-range",
    placeholder: meas.current.range === "-" ? "20 V" : meas.current.range,
  });
  appendTextInput(documentRef, form, {
    label: text(["measurement", "channel"], "Kanal"),
    inputName: "measurement-channel",
    placeholder: "COM/V",
    value: "COM/V",
  });

  const record = documentRef.createElement("button");
  record.className = "repair-measurement-form__action";
  record.type = "button";
  record.textContent = text(["measurement", "record"], "Kaydet");
  record.dataset["repairAction"] = "add-manual-measurement";
  record.title = hasActiveSession
    ? text(["measurement", "recordTitle"], "Manuel ölçüm kaydet")
    : text(["measurement", "recordDisabled"], "Önce bir tamir oturumu aç");
  form.append(record);
  body.append(form);

  // -- Recent readings
  const readingsHeader = documentRef.createElement("div");
  readingsHeader.className = "repair-section-label";
  readingsHeader.textContent = text(["measurement", "recent"], "Son Okumalar");
  body.append(readingsHeader);

  const readingsList = documentRef.createElement("div");
  readingsList.className = "repair-readings-list";

  if (meas.recent.length === 0) {
    appendReadingsEmptyState(documentRef, readingsList, text);
  }

  for (const reading of meas.recent) {
    const row = documentRef.createElement("div");
    row.className = "repair-reading-row";

    const ref = documentRef.createElement("span");
    ref.className = "repair-reading-row__ref";
    ref.textContent = reading.reference ?? reading.channel;
    row.append(ref);

    const val = documentRef.createElement("span");
    val.className = "repair-reading-row__value";
    val.textContent = reading.rawDisplay;
    row.append(val);

    const unit = documentRef.createElement("span");
    unit.className = "repair-reading-row__unit";
    unit.textContent = reading.unit;
    row.append(unit);

    readingsList.append(row);
  }

  body.append(readingsList);

  if (evidence.length > 0) {
    const evidenceHeader = documentRef.createElement("div");
    evidenceHeader.className = "repair-section-label";
    evidenceHeader.textContent = text(["measurement", "evidence"], "Konumsal Kanıt");
    body.append(evidenceHeader);

    const evidenceList = documentRef.createElement("div");
    evidenceList.className = "repair-measurement-evidence-list";
    evidence.slice(0, 4).forEach((entry) => {
      const card = documentRef.createElement("button");
      card.className = "repair-measurement-evidence";
      card.type = "button";
      card.dataset["repairAction"] = "jump-to-event";
      card.dataset["eventId"] = entry.eventId;

      const label = documentRef.createElement("span");
      label.className = "repair-measurement-evidence__label";
      label.textContent = entry.reference;
      card.append(label);

      const value = documentRef.createElement("span");
      value.className = "repair-measurement-evidence__value";
      value.textContent =
        entry.previousDisplay === null
          ? entry.currentDisplay
          : `${entry.previousDisplay} -> ${entry.currentDisplay}`;
      card.append(value);

      const spark = documentRef.createElement("span");
      spark.className = "repair-measurement-evidence__spark";
      entry.history.slice(-6).forEach((reading, index) => {
        const bar = documentRef.createElement("i");
        bar.style.height = `${Math.max(3, Math.min(16, 4 + index * 2))}px`;
        bar.title = reading;
        spark.append(bar);
      });
      card.append(spark);

      evidenceList.append(card);
    });
    body.append(evidenceList);
  }

  return createRepairPanel(documentRef, {
    panelId: "measurement",
    eyebrow: text(["measurement", "eyebrow"], "ÖLÇÜM PANELİ"),
    title: text(["measurement", "title"], "Multimetre"),
    statusDot: meas.current.hold ? "amber" : "live",
    collapsed: state.layout.collapsedPanels["measurement"],
    noPanelControls: true,
    body,
  });
}
