import type {
  LabWaveformTimelineModel,
  LabWaveformTimelineVisualizerDeps,
} from "./lab-waveform-timeline-types.js";
import { createLabWaveformTimelineVisualizer as createBaseLabWaveformTimelineVisualizer } from "./lab-waveform-timeline-visualizer.js";

export type {
  LabWaveformTimelineModel,
  LabWaveformTimelineVisualizerDeps,
} from "./lab-waveform-timeline-types.js";
export {
  renderLabWaveformSelectionPanel,
  renderLabWaveformTimeline,
} from "./lab-waveform-timeline-render.js";

function createDecodeSafeWindowRef(
  deps: LabWaveformTimelineVisualizerDeps
): LabWaveformTimelineVisualizerDeps["windowRef"] {
  const sourceWindow = deps.windowRef;
  const sourceFetch =
    typeof sourceWindow.fetch === "function" ? sourceWindow.fetch.bind(sourceWindow) : null;
  const globalFetch =
    typeof globalThis.fetch === "function" ? globalThis.fetch.bind(globalThis) : null;
  const guardedFetch: typeof fetch = function (...args) {
    if (deps.getTimelineModel?.().sourceKind === "video") {
      return Promise.reject(new TypeError("Raw video waveform fallback decoding is disabled."));
    }
    if (sourceFetch !== null) {
      return sourceFetch(...args);
    }
    if (globalFetch !== null) {
      return globalFetch(...args);
    }
    return Promise.reject(new TypeError("Fetch is unavailable for waveform fallback decoding."));
  };

  return new Proxy(sourceWindow, {
    get(target, property) {
      if (property === "fetch") {
        return guardedFetch;
      }
      const value = Reflect.get(target, property, target);
      if (
        typeof value === "function" &&
        property !== "AudioContext" &&
        property !== "webkitAudioContext" &&
        property !== "Image"
      ) {
        return value.bind(target);
      }
      return value;
    },
  }) as LabWaveformTimelineVisualizerDeps["windowRef"];
}

export function createLabWaveformTimelineVisualizer(deps: LabWaveformTimelineVisualizerDeps) {
  return createBaseLabWaveformTimelineVisualizer({
    ...deps,
    windowRef: createDecodeSafeWindowRef(deps),
  });
}
