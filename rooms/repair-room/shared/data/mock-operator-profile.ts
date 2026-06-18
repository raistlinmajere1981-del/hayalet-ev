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
    tools: [],
    consumables: [],
    safety: [],
  },
  skills: [],
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
