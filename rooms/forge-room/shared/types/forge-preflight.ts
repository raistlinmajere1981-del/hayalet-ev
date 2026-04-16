export type ForgeOperatorSkillLevel = "beginner" | "intermediate" | "advanced";
export type ForgeOperatorCapabilityLevel = "none" | "basic" | "good";
export type ForgeOperatorMode = "learn-first" | "result-first";
export type ForgeOperatorRiskTolerance = "low" | "medium" | "high";
export type ForgePreflightStatus = "idle" | "fresh" | "stale" | "warning";
export type ForgeCapabilityTag =
  | "archive"
  | "camera"
  | "image"
  | "protocol"
  | "relay"
  | "repair-room"
  | "storage"
  | "ui";

export interface ForgeOperatorProfileSkill {
  level: ForgeOperatorSkillLevel | null;
  soldering: ForgeOperatorCapabilityLevel | null;
  measurement: ForgeOperatorCapabilityLevel | null;
  mechanical: ForgeOperatorCapabilityLevel | null;
}

export interface ForgeOperatorProfileTools {
  multimeter: boolean | null;
  solderingIron: boolean | null;
  hotAir: boolean | null;
  benchPowerSupply: boolean | null;
  magnification: boolean | null;
}

export interface ForgeOperatorProfilePreferences {
  mode: ForgeOperatorMode | null;
  riskTolerance: ForgeOperatorRiskTolerance | null;
}

export interface ForgeOperatorProfile {
  schemaVersion: number;
  updatedAt: string;
  skill: ForgeOperatorProfileSkill;
  tools: ForgeOperatorProfileTools;
  preferences: ForgeOperatorProfilePreferences;
}

export interface ForgeRunOverride {
  tools: Partial<ForgeOperatorProfileTools>;
  notes: string;
  enableRovoPreAnalysis: boolean;
}

export interface ForgeContextCapsule {
  summary: string;
  relevantModules: string[];
  constraints: string[];
}

export interface ForgeCapabilityDescriptor {
  id: string;
  title: string;
  summary: string;
  tags: ForgeCapabilityTag[];
  relevantModules: string[];
  roomIds: string[];
}

export interface ForgeCapabilityContext {
  items: ForgeCapabilityDescriptor[];
  omittedCount: number;
  selectedTags: ForgeCapabilityTag[];
  sizeBudget: number;
  summary: string;
}

export interface ForgeCoreSystemMetadata {
  featureId: string;
  mode: "guided";
  roomId: string;
  schemaVersion: number;
  sessionId: string | null;
}

export interface ForgeAppArchitectureSummary {
  exportBoundary: string;
  relevantModules: string[];
  storageBoundary: string;
  summary: string;
}

export interface ForgeTargetRoomContext {
  constraints: string[];
  relevantModules: string[];
  summary: string;
  targetRoomId: string;
}

export interface ForgeRovoPreAnalysis {
  missingInfo: string[];
  status: "completed" | "warning";
  summary: string;
  warnings: string[];
}

export interface ForgePreflightBundle {
  appArchitectureSummary: ForgeAppArchitectureSummary;
  capabilityContext: ForgeCapabilityContext | null;
  constraints: string[];
  coreSystemMetadata: ForgeCoreSystemMetadata;
  createdAt: string;
  operatorProfile: ForgeOperatorProfile;
  rovoPreAnalysis: ForgeRovoPreAnalysis | null;
  runOverride: ForgeRunOverride | null;
  schemaVersion: "v2";
  targetRoomContext: ForgeTargetRoomContext | null;
}

export interface ForgePreflightState {
  bundle: ForgePreflightBundle | null;
  errorMessage: string | null;
  promptCharCount: number;
  ranAt: string | null;
  staleReason: string | null;
  status: ForgePreflightStatus;
  warnings: string[];
}

export interface ForgeRunSignature {
  source: string[];
  updatedAt: string;
  value: string;
}

export interface ForgeSynthesisProvenance {
  operatorProfileSummary: string[];
  preflightWarnings: string[];
  runSignature: string | null;
}

export function createDefaultForgeOperatorProfile(updatedAt = ""): ForgeOperatorProfile {
  return {
    schemaVersion: 1,
    updatedAt,
    skill: {
      level: null,
      soldering: null,
      measurement: null,
      mechanical: null,
    },
    tools: {
      multimeter: null,
      solderingIron: null,
      hotAir: null,
      benchPowerSupply: null,
      magnification: null,
    },
    preferences: {
      mode: null,
      riskTolerance: null,
    },
  };
}

export function isForgeOperatorProfileEmpty(profile: ForgeOperatorProfile): boolean {
  return (
    profile.skill.level === null &&
    profile.skill.soldering === null &&
    profile.skill.measurement === null &&
    profile.skill.mechanical === null &&
    profile.tools.multimeter === null &&
    profile.tools.solderingIron === null &&
    profile.tools.hotAir === null &&
    profile.tools.benchPowerSupply === null &&
    profile.tools.magnification === null &&
    profile.preferences.mode === null &&
    profile.preferences.riskTolerance === null
  );
}

export function createEmptyForgeRunOverride(): ForgeRunOverride {
  return {
    tools: {},
    notes: "",
    enableRovoPreAnalysis: false,
  };
}

export function createEmptyForgeContextCapsule(): ForgeContextCapsule {
  return {
    summary: "",
    relevantModules: [],
    constraints: [],
  };
}

export function createEmptyForgePreflightState(): ForgePreflightState {
  return {
    bundle: null,
    errorMessage: null,
    promptCharCount: 0,
    ranAt: null,
    staleReason: null,
    status: "idle",
    warnings: [],
  };
}
