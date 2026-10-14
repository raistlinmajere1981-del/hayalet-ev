import type { AgentProfileScope } from "./agent-profiles.js";

export interface Ai0Model {
  providerID: string;
  id: string;
}

export const AI0_ASSISTANT_SCOPE: AgentProfileScope = {
  purpose: "runtime",
  agentId: "ai0",
  roomId: "assistant",
  roleId: "default",
};
export const AI0_IMAGE_SCOPE: AgentProfileScope = {
  purpose: "runtime",
  agentId: "ai0",
  roomId: "assistant",
  roleId: "image-generator",
};
export const FATE_KNOTS_NPC_SCOPE: AgentProfileScope = {
  purpose: "runtime",
  agentId: "ai0",
  roomId: "fate-knots",
  roleId: "fate-knots-npc",
};
export const FATE_KNOTS_IMAGE_SCOPE: AgentProfileScope = {
  purpose: "runtime",
  agentId: "ai0",
  roomId: "fate-knots",
  roleId: "fate-knots-image",
};

export interface Ai0CapabilityStatus {
  available: boolean;
  reason: string | null;
  model: Ai0Model | null;
  toolId: "image_generate" | null;
  verifiedTools: string[];
  profileHash: string | null;
  sessionId: string | null;
}
export interface Ai0ImageArtifact {
  path: string;
  mimeType: "image/png";
  bytes: number;
  width: number;
  height: number;
  sha256: string;
  manifestPath: string;
  workspacePath: string;
  stagingRoot: string;
  port: number;
  activeModelKey: string;
  profileHash: string;
}
export interface Ai0TextResult {
  text: string;
  sessionId: string;
  workspacePath: string;
  port: number;
  profileHash: string;
  model: Ai0Model;
}
export type Ai0RuntimeRequest =
  | { action: "models" }
  | { action: "model-select"; scope: AgentProfileScope; model: Ai0Model }
  | { action: "image-status"; scope?: AgentProfileScope }
  | {
      action: "image-generate";
      prompt: string;
      aspectRatio?: string;
      scope?: AgentProfileScope;
      timeoutMs?: number;
    }
  | {
      action: "chat";
      text: string;
      sessionId?: string;
      scope?: AgentProfileScope;
      timeoutMs?: number;
    }
  | { action: "image-open"; path: string };
export interface Ai0RuntimeResponse {
  success: boolean;
  data?: unknown;
  error?: string;
}
export interface Ai0RuntimeBridge {
  ai0RuntimeRequest: (request: Ai0RuntimeRequest) => Promise<Ai0RuntimeResponse>;
}
