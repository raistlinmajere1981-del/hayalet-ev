import { requestAgentProfiles } from "../agent-profiles.js";
import type { AgentProfileRequest, AgentProfileScope } from "../../../../shared/agent-profiles.js";
import type { CommandPayload } from "./utils.js";
import { parseArgs } from "./utils.js";

export async function agentProfileCommand(
  action: "list" | "select" | "inspect" | "capabilities",
  payload: CommandPayload = {}
): Promise<{ success: boolean; message: string; data?: unknown }> {
  try {
    const args = parseArgs(payload.args ?? "");
    const profileId = action === "select" ? args.shift() : undefined;
    const [agentId, roomId, roleId, purpose] = args;
    const scope: AgentProfileScope = {
      purpose: purpose === "development" ? "development" : "runtime",
      agentId:
        agentId ??
        (typeof payload.provider === "string" && /^ai[0-9]+$/.test(payload.provider)
          ? payload.provider
          : "ai0"),
      roomId: roomId ?? "default",
      roleId: roleId ?? "default",
    };
    if (purpose !== undefined && purpose !== "runtime" && purpose !== "development")
      throw new Error("Purpose must be runtime or development");
    if (action === "select" && (profileId === undefined || profileId === ""))
      throw new Error("Profile id is required");
    const request: AgentProfileRequest =
      action === "select"
        ? { action, scope, profileId: profileId ?? "" }
        : action === "list"
          ? { action }
          : { action, scope };
    const data = await requestAgentProfiles<unknown>(request);
    return { success: true, message: JSON.stringify(data), data };
  } catch (error) {
    return { success: false, message: error instanceof Error ? error.message : String(error) };
  }
}
