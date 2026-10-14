import { requestAi0Runtime } from "../ai0-runtime.js";
import type { CommandPayload } from "./utils.js";
import { parseArgs } from "./utils.js";
import type { Ai0ImageArtifact } from "../../../../shared/ai0-runtime.js";

export async function ai0ImageCommand(
  action: "status" | "generate",
  payload: CommandPayload = {}
): Promise<{ success: boolean; message: string; data?: unknown }> {
  try {
    const args = parseArgs(payload.args ?? "");
    const data =
      action === "status"
        ? await requestAi0Runtime<unknown>({ action: "image-status" })
        : await requestAi0Runtime<Ai0ImageArtifact>({
            action: "image-generate",
            prompt: args[0] ?? "",
            aspectRatio: args[1] ?? "1:1",
          });
    return { success: true, data, message: JSON.stringify(data) };
  } catch (error) {
    return { success: false, message: error instanceof Error ? error.message : String(error) };
  }
}
