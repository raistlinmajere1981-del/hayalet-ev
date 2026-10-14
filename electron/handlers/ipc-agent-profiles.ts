import { registerHandler } from "./ipc-helpers.ts";
import {
  handleAgentProfileRequest,
  resolveAgentProfile,
  attestAgentCapabilities,
} from "../agent-profile-service.js";
import { ASSISTANT_PROFILE_SCOPE } from "../../shared/agent-profiles.js";
import type { AgentProfileRequest } from "../../shared/agent-profiles.js";

export function setupAgentProfileHandlers(): void {
  attestAgentCapabilities(ASSISTANT_PROFILE_SCOPE, {
    source: "OpenCode message transport; tool/model inventory unverified",
    modelId: null,
    systemInstructions: true,
    tools: [],
  });
  registerHandler("agent-profile-request", (_event, payload: unknown) => {
    if (payload === null || typeof payload !== "object" || Array.isArray(payload))
      throw new Error("Invalid registry request");
    const request = payload as AgentProfileRequest;
    return { success: true, data: handleAgentProfileRequest(request) };
  });
  registerHandler("assistant-profile-system", () => {
    const resolution = resolveAgentProfile(ASSISTANT_PROFILE_SCOPE);
    return { success: true, data: resolution };
  });
}
