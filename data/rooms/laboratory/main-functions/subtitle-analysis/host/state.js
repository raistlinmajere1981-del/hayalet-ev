import { createSubtitleStateDefaultsRuntime } from "./state-defaults.js";
import { createSubtitleStateNormalizationRuntime } from "./state-normalization.js";
import { createSubtitleStateProjectRuntime } from "./state-projects.js";
export function createSubtitleStateRuntime(deps) {
  const { asNonEmptyString, asNumber, normalizeReportExport, normalizeStringArray, toRecord } = deps;
  const defaultsRuntime = createSubtitleStateDefaultsRuntime({ asNonEmptyString, toRecord });
  const normalizationRuntime = createSubtitleStateNormalizationRuntime({
    asNonEmptyString,
    asNumber,
    normalizeReportExport,
    normalizeStringArray,
    toRecord
  });
  const projectRuntime = createSubtitleStateProjectRuntime(deps);
  return {
    ...defaultsRuntime,
    ...normalizationRuntime,
    ...projectRuntime
  };
}
