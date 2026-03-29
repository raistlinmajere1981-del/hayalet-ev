import { createSubtitleStateDefaultsRuntime } from "./state-defaults.js";
import { createSubtitleStateNormalizationRuntime } from "./state-normalization.js";
import { createSubtitleStateProjectRuntime } from "./state-projects.js";

type SubtitleStateRuntimeDeps =
  & Parameters<typeof createSubtitleStateDefaultsRuntime>[0]
  & Parameters<typeof createSubtitleStateNormalizationRuntime>[0]
  & Parameters<typeof createSubtitleStateProjectRuntime>[0];

type SubtitleStateRuntime =
  & ReturnType<typeof createSubtitleStateDefaultsRuntime>
  & ReturnType<typeof createSubtitleStateNormalizationRuntime>
  & ReturnType<typeof createSubtitleStateProjectRuntime>;

export function createSubtitleStateRuntime(
  deps: SubtitleStateRuntimeDeps,
): SubtitleStateRuntime {
  const defaultsRuntime = createSubtitleStateDefaultsRuntime(deps);
  const normalizationRuntime = createSubtitleStateNormalizationRuntime(deps);
  const projectRuntime = createSubtitleStateProjectRuntime(deps);

  return {
    ...defaultsRuntime,
    ...normalizationRuntime,
    ...projectRuntime,
  };
}
