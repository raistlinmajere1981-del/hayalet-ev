import type { Ai0RuntimeBridge, Ai0RuntimeRequest } from "../../../shared/ai0-runtime.js";

export async function requestAi0Runtime<T>(request: Ai0RuntimeRequest): Promise<T> {
  const api = window.electronAPI as Partial<Ai0RuntimeBridge> | undefined;
  if (typeof api?.ai0RuntimeRequest !== "function")
    throw new Error("Common AI0 runtime is unavailable");
  const response = await api.ai0RuntimeRequest(request);
  if (!response.success) throw new Error(response.error ?? "AI0 runtime request failed");
  return response.data as T;
}
