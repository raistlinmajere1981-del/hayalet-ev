import type {
  LabAudioFocusSettings,
  LabInterpretationItem,
  LabSelection,
} from "../models/lab-types.js";

type InterpretationContext = {
  activeSelection: LabSelection | null;
  audioFocus: LabAudioFocusSettings;
  sourceKind: string;
};

function pushInterpretation(items: LabInterpretationItem[], item: LabInterpretationItem) {
  if (items.some((entry) => entry.id === item.id)) {
    return;
  }
  items.push(item);
}

function sourceSupportsAudioInterpretation(sourceKind: string) {
  return sourceKind === "audio" || sourceKind === "video";
}

export function buildInterpretationItems(context: InterpretationContext): LabInterpretationItem[] {
  const items: LabInterpretationItem[] = [];
  const selection = context.activeSelection;
  const audioFocus = context.audioFocus;
  const audioContextAvailable = sourceSupportsAudioInterpretation(context.sourceKind);

  if (audioContextAvailable && audioFocus.gain > 1.5) {
    pushInterpretation(items, {
      id: "audio-high-gain",
      type: "warning",
      message: "High gain may introduce clipping or noise amplification",
      confidence: 0.88,
      relatedAction: "inspect-audio",
    });
  }

  if (audioContextAvailable && audioFocus.playbackRate < 0.5) {
    pushInterpretation(items, {
      id: "audio-slow-playback",
      type: "hint",
      message: "Slow playback can reveal temporal anomalies",
      confidence: 0.82,
    });
  }

  if (audioContextAvailable && audioFocus.playbackRate > 1.5) {
    pushInterpretation(items, {
      id: "audio-fast-playback",
      type: "hint",
      message: "Fast playback helps detect repetitive patterns",
      confidence: 0.8,
    });
  }

  if (
    audioContextAvailable &&
    audioFocus.filterType === "lowpass" &&
    audioFocus.filterFrequency <= 1200
  ) {
    pushInterpretation(items, {
      id: "audio-lowpass-suppressed-highs",
      type: "info",
      message: "High frequencies are suppressed",
      confidence: 0.76,
      relatedAction: "inspect-audio",
    });
  }

  if (audioContextAvailable && audioFocus.eqBands.some((band) => band.gain > 8)) {
    pushInterpretation(items, {
      id: "audio-extreme-eq-boost",
      type: "warning",
      message: "Extreme EQ boost may distort signal perception",
      confidence: 0.84,
      relatedAction: "inspect-audio",
    });
  }

  if (selection !== null && selection.endMs > selection.startMs) {
    const durationMs = selection.endMs - selection.startMs;
    if (durationMs < 500) {
      pushInterpretation(items, {
        id: "selection-short-context",
        type: "hint",
        message: "Very short segment; context may be insufficient",
        confidence: 0.75,
      });
    }
    if (durationMs > 10_000) {
      pushInterpretation(items, {
        id: "selection-wide-context",
        type: "info",
        message: "Wide selection; consider narrowing focus",
        confidence: 0.72,
      });
    }
  }

  return items;
}
