import { LogCategory } from "@shared/logging-core";

import { Logger } from "../../modules/logger/index.js";

export function generateWorkflowSessionId(): string {
  return `wf-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

export async function syncAssistantRuntimeDefaults(): Promise<void> {
  const electronApi = window.electronAPI;
  if (electronApi === undefined || typeof electronApi.assistantRuntimeRead !== "function") return;

  try {
    const response = await electronApi.assistantRuntimeRead();
    const state = response.state;
    if (!response.success || state === undefined) {
      await electronApi.assistantRuntimeWrite({
        workflowSessionId: generateWorkflowSessionId(),
        desiredMode: "soft",
        phase: "idle",
      });
      return;
    }

    if (state.workflowSessionId === "") {
      await electronApi.assistantRuntimeWrite({
        workflowSessionId: generateWorkflowSessionId(),
      });
    }
  } catch (error) {
    Logger.warn(LogCategory.ASISTAN_CORE, "Asistan runtime varsayılanları yazılamadı", {
      error: (error as Error).message,
    });
  }
}

export async function updateAssistantRuntimeState(patch: Record<string, unknown>): Promise<void> {
  const electronApi = window.electronAPI;
  if (electronApi === undefined || typeof electronApi.assistantRuntimeWrite !== "function") return;

  try {
    const payload = { ...patch };
    if (
      (payload["workflowSessionId"] === undefined || payload["workflowSessionId"] === "") &&
      (payload["phase"] === "preparing-handoff" || payload["phase"] === "in-ghost")
    ) {
      payload["workflowSessionId"] = generateWorkflowSessionId();
    }

    await electronApi.assistantRuntimeWrite(payload);
  } catch (error) {
    Logger.warn(LogCategory.ASISTAN_CORE, "Asistan runtime state güncellenemedi", {
      error: (error as Error).message,
    });
  }
}
