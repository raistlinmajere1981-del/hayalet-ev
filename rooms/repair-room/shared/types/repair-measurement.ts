export type RepairInstrumentKind = "multimeter" | "power-supply" | "signal-gen";

export type RepairMultimeterMode =
  | "dc-voltage"
  | "ac-voltage"
  | "resistance"
  | "continuity"
  | "diode"
  | "capacitance"
  | "frequency";

export interface RepairMultimeterReading {
  id: string;
  occurredAt: string;
  mode: RepairMultimeterMode;
  range: string;
  channel: string;
  rawDisplay: string;
  value: number | null;
  unit: string;
  reference: string | null;
}

export interface RepairMeasurementSnapshot {
  instrumentId: string;
  kind: RepairInstrumentKind;
  label: string;
  mode: RepairMultimeterMode;
  range: string;
  display: string;
  value: number | null;
  unit: string;
  hold: boolean;
  driftAmplitude: number;
}

export interface RepairMeasurementState {
  activeInstrumentKind: RepairInstrumentKind;
  current: RepairMeasurementSnapshot;
  recent: RepairMultimeterReading[];
}
