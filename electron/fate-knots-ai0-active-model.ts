import { readFile } from "fs/promises";
import { join } from "path";
import { normalizeOpencodeUiSharedState } from "../shared/opencode-ui-state.js";
import { Paths } from "./paths.ts";

export interface FateKnotsAi0ActiveModel {
  modelKey: string;
  providerID: string;
  modelID: string;
  source: "last-selected" | "default";
}

function parseModelKey(modelKey: string): { providerID: string; modelID: string } | null {
  const normalized = modelKey.trim();
  const separator = normalized.indexOf(":");
  if (separator <= 0 || separator >= normalized.length - 1) return null;
  const providerID = normalized.slice(0, separator).trim();
  const modelID = normalized.slice(separator + 1).trim();
  return providerID !== "" && modelID !== "" ? { providerID, modelID } : null;
}

export async function readFateKnotsAi0ActiveModel(): Promise<FateKnotsAi0ActiveModel | null> {
  const statePath = join(Paths.getDataDir(), "shared", "opencode-ui-state.json");
  try {
    const raw = JSON.parse(await readFile(statePath, "utf8")) as unknown;
    const state = normalizeOpencodeUiSharedState(raw);
    const lastSelected = state.modelPreferences.lastSelectedModelKey;
    const fallback = state.modelPreferences.defaultModelKey;
    const modelKey = lastSelected ?? fallback;
    if (modelKey === null) return null;
    const parsed = parseModelKey(modelKey);
    if (parsed === null) return null;
    return {
      modelKey,
      ...parsed,
      source: lastSelected !== null ? "last-selected" : "default",
    };
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return null;
    throw error;
  }
}
