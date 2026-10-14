export type AgentProfilePurpose = "development" | "runtime";
export type AgentInstructionLayer = "base" | "agent" | "room" | "role";

export interface AgentProfileScope {
  purpose: AgentProfilePurpose;
  agentId: string;
  roomId: string;
  roleId: string;
}

export const ASSISTANT_PROFILE_SCOPE: AgentProfileScope = {
  purpose: "development",
  agentId: "ai0",
  roomId: "assistant",
  roleId: "default",
};

export interface AgentCharacterProfile {
  id: string;
  name: string;
  description: string;
  selectedFeatureIds: string[];
  instructionId: string | null;
  requestedCapabilities: string[];
  version: number;
  createdAt: number;
  updatedAt: number;
}

export interface AgentInstruction {
  id: string;
  purpose: AgentProfilePurpose;
  layer: AgentInstructionLayer;
  targetId: string;
  content: string;
  version: number;
}

// Only the host adapter can attest capabilities; profile selection never grants tools.
export interface AgentCapabilitySnapshot {
  source: string;
  modelId: string | null;
  systemInstructions: boolean;
  tools: string[];
}

export interface AgentProfileResolution {
  scope: AgentProfileScope;
  profile: AgentCharacterProfile;
  resolverVersion: 1;
  hash: string;
  layers: Array<{ id: string; version: number; layer: string }>;
  characterFeatures: Array<{ id: string; content: string; version: number }>;
  system: string;
  capabilities: AgentCapabilitySnapshot;
  unavailableCapabilities: string[];
  delivery: "system" | "workspace";
}

export interface AgentCharacterEditorState {
  revision: number;
  activeProfileId: string | null;
  profiles: AgentCharacterProfile[];
}

export type AgentProfileRequest =
  | { action: "list" }
  | { action: "instruction-list"; purpose: AgentProfilePurpose }
  | {
      action: "profile-save";
      profile: Omit<AgentCharacterProfile, "version" | "createdAt" | "updatedAt">;
      expectedVersion: number;
    }
  | { action: "profile-delete"; id: string; expectedVersion: number }
  | { action: "editor-read"; scope?: AgentProfileScope }
  | { action: "editor-save"; scope?: AgentProfileScope; state: AgentCharacterEditorState }
  | { action: "select"; scope: AgentProfileScope; profileId: string }
  | { action: "inspect"; scope: AgentProfileScope }
  | { action: "capabilities"; scope: AgentProfileScope }
  | { action: "resolve"; scope: AgentProfileScope }
  | {
      action: "instruction-save";
      instruction: Omit<AgentInstruction, "version">;
      expectedVersion: number;
    }
  | { action: "instruction-delete"; id: string; expectedVersion: number };

export interface AgentProfileResponse {
  success: boolean;
  data?: unknown;
  error?: string;
}

export interface AgentProfileBridge {
  agentProfileRequest: (request: AgentProfileRequest) => Promise<AgentProfileResponse>;
  assistantProfileSystem: () => Promise<AgentProfileResponse>;
}
