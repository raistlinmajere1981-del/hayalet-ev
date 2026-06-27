import type { RepairPanelId } from "../../shared/types/index.js";
import type { RepairUiState } from "../../shared/ui/state.js";
import { setClassNameIfChanged, setTextIfChanged } from "./dom-utils.js";

export function createRepairMeasurementDomRuntime(params: {
  documentRef: Document;
  state: RepairUiState;
  updatePanelChrome: (panel: HTMLElement, panelId: RepairPanelId) => void;
}) {
  const { documentRef, state, updatePanelChrome } = params;

  function appendMeasurementReadingRow(
    list: HTMLElement,
    reading: RepairUiState["measurement"]["recent"][number]
  ): void {
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

    list.append(row);
  }

  function appendMeasurementEmptyState(list: HTMLElement): void {
    const empty = documentRef.createElement("div");
    empty.className = "repair-readings-empty";
    empty.textContent = "No manual readings yet";
    list.append(empty);
  }

  function updateMeasurementLiveDom(root: Document | HTMLElement = documentRef): void {
    const current = state.measurement.current;
    const value = root.querySelector<HTMLElement>(".repair-measurement-display__value");
    if (value !== null) setTextIfChanged(value, current.display);
    const unit = root.querySelector<HTMLElement>(".repair-measurement-display__unit");
    if (unit !== null) setTextIfChanged(unit, current.unit);
    const label = root.querySelector<HTMLElement>(".repair-measurement-display__label");
    if (label !== null) setTextIfChanged(label, current.label);
    const mode = root.querySelector<HTMLElement>(".repair-measurement-display__mode");
    if (mode !== null)
      setTextIfChanged(mode, `${current.mode.replace(/-/g, " ")} / ${current.range}`);

    const readingsList = root.querySelector<HTMLElement>(".repair-readings-list");
    if (readingsList === null) return;
    const fingerprint = state.measurement.recent
      .map((reading) => `${reading.id}:${reading.rawDisplay}`)
      .join("|");
    if (readingsList.dataset["fingerprint"] === fingerprint) return;
    readingsList.dataset["fingerprint"] = fingerprint;
    readingsList.replaceChildren();
    if (state.measurement.recent.length === 0) {
      appendMeasurementEmptyState(readingsList);
      return;
    }
    state.measurement.recent.forEach((reading) => {
      appendMeasurementReadingRow(readingsList, reading);
    });
  }

  function updateMeasurementEvidenceDom(root: Document | HTMLElement = documentRef): void {
    const list = root.querySelector<HTMLElement>(".repair-measurement-evidence-list");
    if (list === null) return;
    const fingerprint = state.workbench.measurementEvidence
      .map((entry) => `${entry.eventId}:${entry.currentDisplay}:${entry.history.join(">")}`)
      .join("|");
    if (list.dataset["fingerprint"] === fingerprint) return;
    list.dataset["fingerprint"] = fingerprint;
    list.replaceChildren();
    state.workbench.measurementEvidence.slice(0, 4).forEach((entry) => {
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

      list.append(card);
    });
  }

  function updateMeasurementPanelDom(panel: HTMLElement): void {
    updatePanelChrome(panel, "measurement");

    const dot = panel.querySelector<HTMLElement>(".repair-panel__status-dot");
    if (dot !== null) {
      setClassNameIfChanged(
        dot,
        `repair-panel__status-dot repair-panel__status-dot--${
          state.measurement.current.hold ? "amber" : "live"
        }`
      );
    }

    panel.querySelectorAll<HTMLElement>("[data-repair-action='set-instrument']").forEach((tab) => {
      tab.classList.toggle(
        "repair-tab--active",
        tab.dataset["instrumentKind"] === state.measurement.activeInstrumentKind
      );
    });

    updateMeasurementLiveDom(panel);
    updateMeasurementEvidenceDom(panel);
  }

  return {
    updateMeasurementEvidenceDom,
    updateMeasurementLiveDom,
    updateMeasurementPanelDom,
  };
}
