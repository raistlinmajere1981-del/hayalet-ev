import type { RepairUiState } from "../../shared/ui/state.js";
import { createRepairPanel } from "./panel-shell.js";

type TextFn = (path: string[], fallback: string) => string;

export function renderMeasurementPanel(
  documentRef: Document,
  state: RepairUiState,
  text: TextFn
): HTMLElement {
  const body = documentRef.createElement("div");
  body.className = "repair-panel__body";

  const meas = state.measurement;
  const evidence = state.workbench.measurementEvidence;

  // -- Tabs
  const tabs = documentRef.createElement("div");
  tabs.className = "repair-tabs";

  const tabItems = [
    { id: "multimeter", label: text(["measurement", "tabMultimeter"], "Multimeter") },
    { id: "power-supply", label: text(["measurement", "tabPsu"], "Power Supply") },
    { id: "signal-gen", label: text(["measurement", "tabSigGen"], "Signal Gen") },
  ];

  for (const tab of tabItems) {
    const tabEl = documentRef.createElement("div");
    tabEl.className = `repair-tab${meas.activeInstrumentKind === tab.id ? " repair-tab--active" : ""}`;
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
  labelEl.textContent = meas.current.label;
  display.append(labelEl);

  const modeEl = documentRef.createElement("div");
  modeEl.className = "repair-measurement-display__mode";
  modeEl.textContent = `${meas.current.mode.replace(/-/g, " ")} / ${meas.current.range}`;
  display.append(modeEl);

  body.append(display);

  // -- Recent readings
  const readingsHeader = documentRef.createElement("div");
  readingsHeader.style.fontSize = "10px";
  readingsHeader.style.color = "var(--repair-text-dim)";
  readingsHeader.style.textTransform = "uppercase";
  readingsHeader.style.letterSpacing = "0.08em";
  readingsHeader.style.paddingBottom = "4px";
  readingsHeader.textContent = text(["measurement", "recent"], "Recent Readings");
  body.append(readingsHeader);

  const readingsList = documentRef.createElement("div");
  readingsList.className = "repair-readings-list";

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
    evidenceHeader.textContent = text(["measurement", "evidence"], "Spatial Evidence");
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
          : `${entry.previousDisplay} → ${entry.currentDisplay}`;
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
    eyebrow: text(["measurement", "eyebrow"], "INSTRUMENTS"),
    title: text(["measurement", "title"], "Measurement"),
    statusDot: meas.current.hold ? "amber" : "live",
    collapsed: state.layout.collapsedPanels["measurement"],
    pinned: state.layout.pinnedPanels["measurement"],
    body,
  });
}
