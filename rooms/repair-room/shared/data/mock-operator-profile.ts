import {
  REPAIR_OPERATOR_PROFILE_SCHEMA_VERSION,
  REPAIR_UI_COLORS,
} from "../repair-constants.js";
import type {
  RepairAiAdaptationHints,
  RepairOperatorProfile,
} from "../types/index.js";

export const MOCK_REPAIR_OPERATOR_PROFILE: RepairOperatorProfile = {
  schemaVersion: REPAIR_OPERATOR_PROFILE_SCHEMA_VERSION,
  profileId: "operator-default",
  displayName: "Bench Operator",
  bench: {
    tools: [
      {
        id: "soldering-iron-ts101",
        category: "soldering",
        label: "TS101 Soldering Iron",
        capabilities: ["100W", "USB-C PD", "0.4mm conical tip"],
        available: true,
        model: "Miniware TS101",
        notes: "Calibrated 2025-04, last tip change 2025-09.",
      },
      {
        id: "solder-wire-0p6",
        category: "soldering",
        label: "0.6mm Lead Solder Wire",
        capabilities: ["Sn60/Pb40", "Rosin core"],
        available: true,
        model: null,
        notes: null,
      },
      {
        id: "flux-no-clean",
        category: "soldering",
        label: "Flux (No Clean)",
        capabilities: ["RMA-compatible", "Pen + syringe"],
        available: true,
        model: "AMTECH NC-559-V2",
        notes: null,
      },
      {
        id: "multimeter-fnirsi-dmt99",
        category: "measurement",
        label: "FNIRSI DMT-99",
        capabilities: [
          "DC Voltage",
          "AC Voltage",
          "Resistance",
          "Continuity",
          "Diode",
          "Capacitance",
          "Frequency",
        ],
        available: true,
        model: "FNIRSI DMT-99",
        notes: "Auto-range, True-RMS, 9999 count.",
      },
      {
        id: "bench-psu",
        category: "power",
        label: "DC Bench Power Supply",
        capabilities: ["0-30 V", "0-5 A", "CV/CC"],
        available: true,
        model: "Riden RD6006",
        notes: null,
      },
      {
        id: "hot-air-quick861d",
        category: "soldering",
        label: "Hot Air Station (Quick 861D)",
        capabilities: ["100-500°C", "Air 1-100"],
        available: true,
        model: "Quick 861D",
        notes: null,
      },
      {
        id: "microscope-relife-rl-m3t",
        category: "vision",
        label: "Microscope (Relife RL-M3T)",
        capabilities: ["7-45× zoom", "Trinocular", "Ring LED"],
        available: true,
        model: "Relife RL-M3T",
        notes: null,
      },
      {
        id: "esd-mat",
        category: "other",
        label: "ESD Safe Mat",
        capabilities: ["Anti-static", "Wrist strap port"],
        available: true,
        model: null,
        notes: null,
      },
    ],
    consumables: [
      { id: "isopropyl-alcohol", label: "Isopropyl Alcohol 99%", available: true, notes: null },
      { id: "kapton-tape", label: "Kapton Tape (25mm)", available: true, notes: null },
      { id: "desoldering-wick", label: "Desoldering Wick 2mm", available: true, notes: null },
    ],
    safety: [
      { id: "safety-goggles", label: "Safety Goggles", available: true },
      { id: "fume-extractor", label: "Fume Extractor", available: true },
      { id: "wrist-strap", label: "Anti-static Wrist Strap", available: true },
    ],
  },
  skills: [
    { id: "thru-hole", label: "Through-hole soldering", proficiency: 5 },
    { id: "smd-0402", label: "SMD ≥ 0402", proficiency: 4 },
    { id: "smps-repair", label: "SMPS repair", proficiency: 3 },
    { id: "hdmi-repair", label: "HDMI port replacement", proficiency: 4 },
    { id: "microscope-work", label: "Microscope work", proficiency: 4 },
  ],
  preferences: {
    measurementSystem: "metric",
    annotationDefaultColor: REPAIR_UI_COLORS.cyan,
    annotationDefaultStrokeWidth: 2,
    riskTolerance: "medium",
    aiVerbosity: "standard",
  },
  updatedAt: "2026-05-09T08:14:22.000Z",
};

export function buildMockRepairAiAdaptation(
  profile: RepairOperatorProfile
): RepairAiAdaptationHints {
  const has = (id: string): boolean =>
    profile.bench.tools.some((tool) => tool.id === id && tool.available);
  return {
    hasOscilloscope: has("oscilloscope"),
    hasBenchPsu: has("bench-psu"),
    hasThermalCamera: has("thermal-camera"),
    hasHotAirStation: has("hot-air-quick861d"),
    hasMicroscope: has("microscope-relife-rl-m3t"),
    preferMultimeterFallbacks: has("oscilloscope") === false,
  };
}
