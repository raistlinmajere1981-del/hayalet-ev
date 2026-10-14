import type {
  AgentProfileRequest,
  AgentProfileBridge,
  AgentProfileResolution,
} from "../../../shared/agent-profiles.js";

export async function requestAgentProfiles<T>(request: AgentProfileRequest): Promise<T> {
  const api = window.electronAPI as Partial<AgentProfileBridge> | undefined;
  if (typeof api?.agentProfileRequest !== "function")
    throw new Error("Agent Profile Registry is unavailable");
  const result = await api.agentProfileRequest(request);
  if (!result.success) throw new Error(result.error ?? "Agent Profile Registry request failed");
  return result.data as T;
}

export async function resolveAssistantProfileSystem(): Promise<AgentProfileResolution> {
  const api = window.electronAPI as Partial<AgentProfileBridge> | undefined;
  if (typeof api?.assistantProfileSystem !== "function")
    throw new Error("Agent Profile Registry is unavailable");
  const result = await api.assistantProfileSystem();
  if (!result.success) throw new Error(result.error ?? "Assistant profile resolution failed");
  return result.data as AgentProfileResolution;
}
