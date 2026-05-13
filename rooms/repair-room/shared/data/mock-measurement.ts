import type {
  RepairMeasurementSnapshot,
  RepairMeasurementState,
  RepairMultimeterReading,
} from "../types/index.js";

const MOCK_RECENT_READINGS: RepairMultimeterReading[] = [
  {
    id: "reading-psu-1",
    occurredAt: "2026-05-10T10:33:02.000Z",
    mode: "dc-voltage",
    range: "20 V",
    channel: "COM/VΩ",
    rawDisplay: "0.000",
    value: 0,
    unit: "V",
    reference: "C101 (Bulk Cap)",
  },
  {
    id: "reading-psu-2",
    occurredAt: "2026-05-10T10:34:18.000Z",
    mode: "resistance",
    range: "20 MΩ",
    channel: "COM/VΩ",
    rawDisplay: "OL",
    value: null,
    unit: "Ω",
    reference: "R201 (Startup Res)",
  },
  {
    id: "reading-psu-3",
    occurredAt: "2026-05-10T10:36:32.000Z",
    mode: "dc-voltage",
    range: "20 V",
    channel: "COM/VΩ",
    rawDisplay: "0.000",
    value: 0,
    unit: "V",
    reference: "U14 VCC",
  },
  {
    id: "reading-psu-4",
    occurredAt: "2026-05-10T10:38:04.000Z",
    mode: "dc-voltage",
    range: "2 V",
    channel: "COM/VΩ",
    rawDisplay: "0.123",
    value: 0.123,
    unit: "V",
    reference: "U14 GATE",
  },
  {
    id: "reading-psu-5",
    occurredAt: "2026-05-10T10:42:11.000Z",
    mode: "dc-voltage",
    range: "20 V",
    channel: "COM/VΩ",
    rawDisplay: "0.000",
    value: 0,
    unit: "V",
    reference: "Standby 5V",
  },
];

const MOCK_CURRENT_SNAPSHOT: RepairMeasurementSnapshot = {
  instrumentId: "multimeter-fnirsi-dmt99",
  kind: "multimeter",
  label: "FNIRSI DMT-99",
  mode: "dc-voltage",
  range: "20 V",
  display: "0.000",
  value: 0,
  unit: "V",
  hold: false,
  driftAmplitude: 0.002,
};

export const MOCK_REPAIR_MEASUREMENT_STATE: RepairMeasurementState = {
  activeInstrumentKind: "multimeter",
  current: MOCK_CURRENT_SNAPSHOT,
  recent: MOCK_RECENT_READINGS,
  evidence: [],
  comparisonEventId: null,
};
