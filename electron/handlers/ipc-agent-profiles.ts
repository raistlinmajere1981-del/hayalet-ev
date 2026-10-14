import { ai0RuntimeHost } from "../ai0/runtime-host.js";
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
  registerHandler("agent-profile-request", async (_event, payload: unknown) => {
    if (payload === null || typeof payload !== "object" || Array.isArray(payload))
      throw new Error("Invalid registry request");
    const request = payload as AgentProfileRequest;
    const data = handleAgentProfileRequest(request);
    if (
      [
        "select",
        "editor-save",
        "profile-save",
        "profile-delete",
        "instruction-save",
        "instruction-delete",
      ].includes(request.action)
    )
      await ai0RuntimeHost.invalidateChangedContexts();
    return { success: true, data };
  });
  registerHandler("assistant-profile-system", () => {
    const resolution = resolveAgentProfile(ASSISTANT_PROFILE_SCOPE);
    return { success: true, data: resolution };
  });
}
