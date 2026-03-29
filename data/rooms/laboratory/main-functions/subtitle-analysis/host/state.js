import { createSubtitleStateDefaultsRuntime } from "./state-defaults.js";
import { createSubtitleStateNormalizationRuntime } from "./state-normalization.js";
import { createSubtitleStateProjectRuntime } from "./state-projects.js";
export function createSubtitleStateRuntime(deps) {
  const defaultsRuntime = createSubtitleStateDefaultsRuntime(deps);
  const normalizationRuntime = createSubtitleStateNormalizationRuntime(deps);
  const projectRuntime = createSubtitleStateProjectRuntime(deps);
  return {
    ...defaultsRuntime,
    ...normalizationRuntime,
    ...projectRuntime
  };
}
