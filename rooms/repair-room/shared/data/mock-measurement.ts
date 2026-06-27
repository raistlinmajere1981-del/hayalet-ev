import type { RepairMeasurementSnapshot, RepairMeasurementState } from "../types/index.js";

const EMPTY_CURRENT_SNAPSHOT: RepairMeasurementSnapshot = {
  instrumentId: "manual-entry",
  kind: "multimeter",
  label: "Manual entry",
  mode: "dc-voltage",
  range: "-",
  display: "-",
  value: null,
  unit: "",
  hold: false,
  driftAmplitude: 0,
};

export const MOCK_REPAIR_MEASUREMENT_STATE: RepairMeasurementState = {
  activeInstrumentKind: "multimeter",
  current: EMPTY_CURRENT_SNAPSHOT,
  recent: [],
  evidence: [],
  comparisonEventId: null,
};
