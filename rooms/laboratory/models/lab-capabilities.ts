import { asLabRecord, asNonEmptyString } from "./lab-primitives.js";
import {
  LAB_OPERATION_SETTINGS_DEFAULTS,
  LAB_OPERATION_SETTINGS_FIELDS,
} from "./lab-operation-settings.js";
import {
  cloneSettingsRecord,
  pickBoolean,
  pickNumber,
  pickOption,
} from "./lab-settings-normalization.js";
import {
  CAPABILITY_FAMILIES,
  CAPABILITY_MODULE_GROUPS,
  LAB_OPERATION_CAPABILITIES,
  WORKSPACE_INTENTS,
} from "./lab-capability-definitions.js";
import type {
  CapabilityFamilyId,
  LabAnalysisSettingsMap,
  LabIntentId,
  LabOperationCapabilityId,
  LabOperationSettingsMap,
  LabSettingsFieldMeta,
  LabSettingsRecord,
} from "./lab-capability-definitions.js";
export * from "./lab-capability-definitions.js";
export * from "./lab-operation-settings.js";

export function getIntentLabel(intentId: string): string {
  return (
    WORKSPACE_INTENTS.find(function (intent) {
      return intent.id === intentId;
    })?.label || intentId
  );
}

export function getIntentPreviewDescription(intentId: string): string {
  switch (intentId) {
    case "visual-inspection":
      return "Görsel yapı ve anomaliler analiz edilir";
    case "audio-investigation":
      return "Ses sinyali ve anomaliler analiz edilir";
    case "detail-enhancement":
      return "Görüntü detayları iyileştirilir";
    case "anomaly-detection":
      return "Olası anormallikler tespit edilir";
    default:
      return getIntentLabel(intentId);
  }
}

export function getCapabilityFamilyIdsForIntentId(intentId: LabIntentId): CapabilityFamilyId[] {
  const intent = WORKSPACE_INTENTS.find(function (entry) {
    return entry.id === intentId;
  });
  return Array.isArray(intent?.internalCapabilities) ? intent.internalCapabilities.slice() : [];
}

export const LAB_ANALYSIS_FAMILY_SETTINGS_DEFAULTS: Record<CapabilityFamilyId, LabSettingsRecord> =
  {
    "visual-structure": {
      samplingDensity: "balanced",
      frameStep: 24,
      sensitivity: "medium",
      roiOnly: false,
    },
    "visual-forensics": {
      samplingDensity: "balanced",
      sensitivity: "medium",
      roiOnly: false,
      revealStrength: 1,
    },
    "audio-signal": {
      sampleWindowSeconds: 60,
      silenceThresholdDb: -38,
      sensitivity: "medium",
    },
    "audio-recovery": {
      sampleWindowSeconds: 60,
      recoveryPreset: "speech",
      denoise: "medium",
      gain: 2,
    },
    transcription: {
      modelPolicy: "selected",
      language: "auto",
      sampleSeconds: 45,
      selectedRangeOnly: true,
    },
    "speaker-analysis": {
      speakerCount: "auto",
      minSegmentSeconds: 1.5,
      sensitivity: "medium",
    },
    "prosody-emotion": {
      windowSeconds: 3,
      silenceThresholdDb: -38,
      heuristicSensitivity: "medium",
    },
    "sound-classification": {
      topK: 8,
      threshold: 0.15,
    },
    "source-separation": {
      model: "htdemucs",
      device: "cpu",
      stems: "all",
    },
    "music-analysis": {
      sampleRate: 22050,
      focus: "balanced",
      essentiaFallback: true,
    },
  };

export const LAB_ANALYSIS_MODULE_SETTINGS_DEFAULTS: Record<string, LabSettingsRecord> = {
  "frame-consistency": { samplingDensity: "balanced", frameStep: 24, sensitivity: "medium" },
  "lighting-consistency": { samplingDensity: "balanced", sensitivity: "medium", roiOnly: false },
  "background-consistency": { samplingDensity: "balanced", sensitivity: "medium", roiOnly: false },
  "occlusion-inconsistency": { samplingDensity: "balanced", sensitivity: "medium", roiOnly: false },
  "object-insert-remove-anomaly": {
    samplingDensity: "balanced",
    sensitivity: "medium",
    roiOnly: false,
  },
  "temporal-noise-pattern": { samplingDensity: "balanced", frameStep: 24, sensitivity: "medium" },
  "motion-anomaly": { samplingDensity: "dense", frameStep: 12, sensitivity: "medium" },
  "visual-signal-amplification": { revealStrength: 1, channelMode: "rgb", roiOnly: false },
  "color-channel-isolation": { channelMode: "red", revealStrength: 1, roiOnly: false },
  "gamma-scan": { gammaMin: 0.7, gammaMax: 1.7, revealStrength: 1, roiOnly: false },
  "contrast-scan": { contrastMin: 1.1, contrastMax: 1.6, revealStrength: 1, roiOnly: false },
  "edge-enhancement": { edgeStrength: 1, roiOnly: false },
  "histogram-equalization": { histogramStrength: 0.35, roiOnly: false },
  "hidden-detail-reveal": { revealStrength: 1.25, roiOnly: false },
  "ai-artifact-detection": { sensitivity: "medium", roiOnly: false },
  "signal-health": { sampleWindowSeconds: 60, silenceThresholdDb: -38, sensitivity: "medium" },
  "spectral-artifacts": { sampleWindowSeconds: 60, sensitivity: "medium" },
  "signal-recovery": { recoveryPreset: "speech", denoise: "medium", gain: 2.2 },
  "frequency-shift-reversal": { shiftHz: -120, lowHz: 100, highHz: 5200, gain: 2.1 },
  "band-pass-exploration": { centerHz: 1700, widthHz: 1800, gain: 6 },
  "spectrogram-guided-recovery": { lowHz: 120, highHz: 4200, denoise: "medium", gain: 2.6 },
  "hidden-pattern-extraction": { lowHz: 220, highHz: 6400, gain: 5.5, compression: "strong" },
  "phase-recovery-experiment": { phaseMode: "side", lowHz: 100, highHz: 5200, gain: 8 },
  transcription: {
    modelPolicy: "selected",
    language: "auto",
    sampleSeconds: 45,
    selectedRangeOnly: true,
  },
  "transcript-support": {
    modelPolicy: "selected",
    language: "auto",
    sampleSeconds: 45,
    selectedRangeOnly: true,
  },
  "speaker-diarization": {
    speakerCount: "auto",
    minSegmentSeconds: 1.5,
    sensitivity: "medium",
  },
  prosody: { windowSeconds: 3, silenceThresholdDb: -38, sensitivity: "medium" },
  emotion: { windowSeconds: 3, heuristicSensitivity: "medium" },
  "sound-events": { topK: 8, threshold: 0.15 },
  "source-separation": { model: "htdemucs", device: "cpu", stems: "all" },
  "music-rhythm-tonal": { sampleRate: 22050, focus: "balanced", essentiaFallback: true },
};

export const LAB_ANALYSIS_MODULE_SETTINGS_FIELDS: Record<string, LabSettingsFieldMeta[]> = {
  "frame-consistency": [
    {
      id: "samplingDensity",
      label: "Sampling",
      kind: "select",
      options: ["sparse", "balanced", "dense"].map((value) => ({ label: value, value })),
    },
    { id: "frameStep", label: "Frame step", kind: "number", min: 1, max: 120, step: 1 },
    {
      id: "sensitivity",
      label: "Sensitivity",
      kind: "select",
      options: ["low", "medium", "high"].map((value) => ({ label: value, value })),
    },
  ],
  "visual-signal-amplification": [
    { id: "revealStrength", label: "Reveal", kind: "number", min: 0.25, max: 2, step: 0.05 },
    {
      id: "channelMode",
      label: "Channel",
      kind: "select",
      options: ["rgb", "red", "green", "blue"].map((value) => ({ label: value, value })),
    },
    { id: "roiOnly", label: "ROI only", kind: "toggle" },
  ],
  "color-channel-isolation": [
    {
      id: "channelMode",
      label: "Channel",
      kind: "select",
      options: ["red", "green", "blue"].map((value) => ({ label: value, value })),
    },
    { id: "revealStrength", label: "Reveal", kind: "number", min: 0.25, max: 2, step: 0.05 },
  ],
  "gamma-scan": [
    { id: "gammaMin", label: "Gamma min", kind: "number", min: 0.1, max: 2, step: 0.05 },
    { id: "gammaMax", label: "Gamma max", kind: "number", min: 0.2, max: 5, step: 0.05 },
    { id: "revealStrength", label: "Reveal", kind: "number", min: 0.25, max: 2, step: 0.05 },
  ],
  "contrast-scan": [
    { id: "contrastMin", label: "Contrast min", kind: "number", min: 0.5, max: 2, step: 0.05 },
    { id: "contrastMax", label: "Contrast max", kind: "number", min: 0.6, max: 3, step: 0.05 },
    { id: "revealStrength", label: "Reveal", kind: "number", min: 0.25, max: 2, step: 0.05 },
  ],
  "edge-enhancement": [
    { id: "edgeStrength", label: "Edge", kind: "number", min: 0.25, max: 2, step: 0.05 },
    { id: "roiOnly", label: "ROI only", kind: "toggle" },
  ],
  "histogram-equalization": [
    {
      id: "histogramStrength",
      label: "Strength",
      kind: "number",
      min: 0.05,
      max: 1,
      step: 0.05,
    },
    { id: "roiOnly", label: "ROI only", kind: "toggle" },
  ],
  "hidden-detail-reveal": [
    { id: "revealStrength", label: "Reveal", kind: "number", min: 0.25, max: 2, step: 0.05 },
    { id: "roiOnly", label: "ROI only", kind: "toggle" },
  ],
  "signal-health": [
    {
      id: "sampleWindowSeconds",
      label: "Window",
      kind: "number",
      min: 5,
      max: 600,
      step: 5,
      unit: "s",
    },
    {
      id: "silenceThresholdDb",
      label: "Silence",
      kind: "number",
      min: -80,
      max: -10,
      step: 1,
      unit: "dB",
    },
  ],
  "spectral-artifacts": [
    {
      id: "sampleWindowSeconds",
      label: "Window",
      kind: "number",
      min: 5,
      max: 600,
      step: 5,
      unit: "s",
    },
    {
      id: "sensitivity",
      label: "Sensitivity",
      kind: "select",
      options: ["low", "medium", "high"].map((value) => ({ label: value, value })),
    },
  ],
  "signal-recovery": [
    {
      id: "recoveryPreset",
      label: "Preset",
      kind: "select",
      options: ["speech", "broadband", "hidden"].map((value) => ({ label: value, value })),
    },
    {
      id: "denoise",
      label: "Denoise",
      kind: "select",
      options: ["light", "medium", "strong"].map((value) => ({ label: value, value })),
    },
    { id: "gain", label: "Gain", kind: "number", min: 0.5, max: 8, step: 0.1, unit: "x" },
  ],
  "frequency-shift-reversal": [
    { id: "shiftHz", label: "Shift", kind: "number", min: -600, max: 600, step: 10, unit: "Hz" },
    { id: "gain", label: "Gain", kind: "number", min: 0.5, max: 8, step: 0.1, unit: "x" },
  ],
  "band-pass-exploration": [
    { id: "centerHz", label: "Center", kind: "number", min: 100, max: 6000, step: 50, unit: "Hz" },
    { id: "widthHz", label: "Width", kind: "number", min: 100, max: 8000, step: 50, unit: "Hz" },
    { id: "gain", label: "Gain", kind: "number", min: 0.5, max: 10, step: 0.1, unit: "x" },
  ],
  "spectrogram-guided-recovery": [
    { id: "lowHz", label: "Low", kind: "number", min: 20, max: 2000, step: 10, unit: "Hz" },
    { id: "highHz", label: "High", kind: "number", min: 1000, max: 12000, step: 100, unit: "Hz" },
    {
      id: "denoise",
      label: "Denoise",
      kind: "select",
      options: ["light", "medium", "strong"].map((value) => ({ label: value, value })),
    },
    { id: "gain", label: "Gain", kind: "number", min: 0.5, max: 10, step: 0.1, unit: "x" },
  ],
  "hidden-pattern-extraction": [
    { id: "lowHz", label: "Low", kind: "number", min: 20, max: 2000, step: 10, unit: "Hz" },
    { id: "highHz", label: "High", kind: "number", min: 1000, max: 12000, step: 100, unit: "Hz" },
    { id: "gain", label: "Gain", kind: "number", min: 0.5, max: 10, step: 0.1, unit: "x" },
    {
      id: "compression",
      label: "Compression",
      kind: "select",
      options: ["off", "light", "medium", "strong"].map((value) => ({ label: value, value })),
    },
  ],
  "phase-recovery-experiment": [
    {
      id: "phaseMode",
      label: "Phase",
      kind: "select",
      options: ["side", "left", "right", "mono"].map((value) => ({ label: value, value })),
    },
    { id: "lowHz", label: "Low", kind: "number", min: 20, max: 2000, step: 10, unit: "Hz" },
    { id: "highHz", label: "High", kind: "number", min: 1000, max: 12000, step: 100, unit: "Hz" },
    { id: "gain", label: "Gain", kind: "number", min: 0.5, max: 10, step: 0.1, unit: "x" },
  ],
  transcription: [
    {
      id: "modelPolicy",
      label: "Model",
      kind: "select",
      options: ["selected", "fastest", "best-ready"].map((value) => ({ label: value, value })),
    },
    {
      id: "language",
      label: "Language",
      kind: "select",
      options: ["auto", "tr", "en"].map((value) => ({ label: value, value })),
    },
    { id: "sampleSeconds", label: "Sample", kind: "number", min: 5, max: 600, step: 5, unit: "s" },
  ],
  "speaker-diarization": [
    {
      id: "speakerCount",
      label: "Speakers",
      kind: "select",
      options: ["auto", "2", "3", "4", "5"].map((value) => ({ label: value, value })),
    },
    {
      id: "minSegmentSeconds",
      label: "Min segment",
      kind: "number",
      min: 0.2,
      max: 10,
      step: 0.1,
      unit: "s",
    },
  ],
  prosody: [
    {
      id: "windowSeconds",
      label: "Window",
      kind: "number",
      min: 0.5,
      max: 10,
      step: 0.5,
      unit: "s",
    },
    {
      id: "silenceThresholdDb",
      label: "Silence",
      kind: "number",
      min: -80,
      max: -10,
      step: 1,
      unit: "dB",
    },
  ],
  emotion: [
    {
      id: "heuristicSensitivity",
      label: "Sensitivity",
      kind: "select",
      options: ["low", "medium", "high"].map((value) => ({ label: value, value })),
    },
  ],
  "sound-events": [
    { id: "topK", label: "Top K", kind: "number", min: 1, max: 30, step: 1 },
    { id: "threshold", label: "Threshold", kind: "number", min: 0.01, max: 0.95, step: 0.01 },
  ],
  "source-separation": LAB_OPERATION_SETTINGS_FIELDS["stem-separation"]!.slice(0, 3),
  "music-rhythm-tonal": [
    {
      id: "sampleRate",
      label: "Sample rate",
      kind: "select",
      options: ["16000", "22050", "44100"].map((value) => ({ label: `${value} Hz`, value })),
    },
    {
      id: "focus",
      label: "Focus",
      kind: "select",
      options: ["balanced", "rhythm", "tonal"].map((value) => ({ label: value, value })),
    },
    { id: "essentiaFallback", label: "Essentia fallback", kind: "toggle" },
  ],
};

[
  "lighting-consistency",
  "background-consistency",
  "occlusion-inconsistency",
  "object-insert-remove-anomaly",
  "temporal-noise-pattern",
  "motion-anomaly",
  "ai-artifact-detection",
  "spectral-artifacts",
  "spectrogram-guided-recovery",
  "hidden-pattern-extraction",
  "phase-recovery-experiment",
  "transcript-support",
].forEach(function (moduleId) {
  if (LAB_ANALYSIS_MODULE_SETTINGS_FIELDS[moduleId] === undefined) {
    const capabilityId = CAPABILITY_MODULE_GROUPS.find(function (entry) {
      return entry.moduleIds.includes(moduleId);
    })?.capabilityId;
    LAB_ANALYSIS_MODULE_SETTINGS_FIELDS[moduleId] =
      capabilityId === "visual-structure"
        ? LAB_ANALYSIS_MODULE_SETTINGS_FIELDS["frame-consistency"]!.slice()
        : capabilityId === "visual-forensics"
          ? LAB_ANALYSIS_MODULE_SETTINGS_FIELDS["visual-signal-amplification"]!.slice()
          : capabilityId === "audio-signal"
            ? LAB_ANALYSIS_MODULE_SETTINGS_FIELDS["signal-health"]!.slice()
            : capabilityId === "audio-recovery"
              ? LAB_ANALYSIS_MODULE_SETTINGS_FIELDS["signal-recovery"]!.slice()
              : [];
  }
});

export function normalizeLabOperationSettings(
  capabilityId: LabOperationCapabilityId,
  value: unknown
): LabSettingsRecord {
  const defaults = LAB_OPERATION_SETTINGS_DEFAULTS[capabilityId];
  const record = asLabRecord(value);
  const source = asLabRecord(record[capabilityId] ?? record);
  switch (capabilityId) {
    case "clip-export":
      return {
        format: pickOption(source["format"], ["mp4", "webm", "gif"], String(defaults["format"])),
        quality: pickOption(
          source["quality"],
          ["compact", "balanced", "high"],
          String(defaults["quality"])
        ),
        fps: pickOption(source["fps"], ["source", "12", "24", "30"], String(defaults["fps"])),
        includeAudio: pickBoolean(source["includeAudio"], Boolean(defaults["includeAudio"])),
        applyRoiCrop: pickBoolean(source["applyRoiCrop"], Boolean(defaults["applyRoiCrop"])),
        scale: pickOption(
          source["scale"],
          ["source", "480p", "720p", "1080p"],
          String(defaults["scale"])
        ),
      };
    case "frame-grab":
      return {
        frameMode: pickOption(
          source["frameMode"],
          ["current", "middle", "burst"],
          String(defaults["frameMode"])
        ),
        burstCount: pickNumber(source["burstCount"], Number(defaults["burstCount"]), 1, 12, 1),
        format: pickOption(source["format"], ["png", "jpg", "webp"], String(defaults["format"])),
        quality: pickNumber(source["quality"], Number(defaults["quality"]), 1, 100, 1),
        timestampLabel: pickBoolean(source["timestampLabel"], Boolean(defaults["timestampLabel"])),
      };
    case "roi-crop":
      return {
        padding: pickNumber(source["padding"], Number(defaults["padding"]), 0, 100, 1),
        aspectLock: pickOption(
          source["aspectLock"],
          ["free", "square", "16:9", "4:3"],
          String(defaults["aspectLock"])
        ),
        outputSize: pickOption(
          source["outputSize"],
          ["source", "512", "1024", "2048"],
          String(defaults["outputSize"])
        ),
        format: pickOption(source["format"], ["png", "jpg", "webp"], String(defaults["format"])),
      };
    case "enhanced-frame":
    case "before-after-variant":
      return {
        ...cloneSettingsRecord(defaults),
        ...(capabilityId === "before-after-variant"
          ? {
              layout: pickOption(
                source["layout"],
                ["side-by-side", "stacked", "wipe"],
                String(defaults["layout"])
              ),
              revealPreset: pickOption(
                source["revealPreset"],
                ["clarity", "low-light", "edge", "forensic"],
                String(defaults["revealPreset"])
              ),
            }
          : {
              preset: pickOption(
                source["preset"],
                ["clarity", "low-light", "edge", "forensic"],
                String(defaults["preset"])
              ),
              applyPreviewSettings: pickBoolean(
                source["applyPreviewSettings"],
                Boolean(defaults["applyPreviewSettings"])
              ),
            }),
        strength: pickNumber(source["strength"], Number(defaults["strength"]), 0.25, 2, 0.05),
        format: pickOption(source["format"], ["png", "jpg", "webp"], String(defaults["format"])),
      };
    case "audio-extract":
      return {
        format: pickOption(source["format"], ["wav", "flac", "mp3"], String(defaults["format"])),
        channels: pickOption(
          source["channels"],
          ["mono", "stereo", "source"],
          String(defaults["channels"])
        ),
        sampleRate: pickNumber(
          source["sampleRate"],
          Number(defaults["sampleRate"]),
          8000,
          96000,
          1
        ),
        timelineOnly: pickBoolean(source["timelineOnly"], Boolean(defaults["timelineOnly"])),
      };
    case "audio-cleanup": {
      const highpassHz = pickNumber(
        source["highpassHz"],
        Number(defaults["highpassHz"]),
        20,
        1000,
        10
      );
      const lowpassHz = pickNumber(
        source["lowpassHz"],
        Number(defaults["lowpassHz"]),
        highpassHz + 100,
        20000,
        100
      );
      return {
        denoise: pickOption(
          source["denoise"],
          ["light", "medium", "strong"],
          String(defaults["denoise"])
        ),
        highpassHz,
        lowpassHz: Math.max(highpassHz + 100, lowpassHz),
        normalizeTargetDb: pickNumber(
          source["normalizeTargetDb"],
          Number(defaults["normalizeTargetDb"]),
          -30,
          -6,
          1
        ),
        compressor: pickBoolean(source["compressor"], Boolean(defaults["compressor"])),
      };
    }
    case "band-pass-voice": {
      const lowHz = pickNumber(source["lowHz"], Number(defaults["lowHz"]), 20, 1000, 10);
      const highHz = pickNumber(
        source["highHz"],
        Number(defaults["highHz"]),
        lowHz + 200,
        10000,
        100
      );
      return {
        lowHz,
        highHz: Math.max(lowHz + 200, highHz),
        widthQ: pickNumber(source["widthQ"], Number(defaults["widthQ"]), 0.1, 10, 0.1),
        gain: pickNumber(source["gain"], Number(defaults["gain"]), 0.5, 8, 0.1),
        channels: pickOption(source["channels"], ["mono", "stereo"], String(defaults["channels"])),
      };
    }
    case "stem-separation":
      return {
        model: pickOption(
          source["model"],
          ["htdemucs", "htdemucs_ft", "mdx_extra"],
          String(defaults["model"])
        ),
        device: pickOption(source["device"], ["cpu", "cuda"], String(defaults["device"])),
        stems: pickOption(
          source["stems"],
          ["all", "vocals", "drums", "bass", "other"],
          String(defaults["stems"])
        ),
        segmentPreset: pickOption(
          source["segmentPreset"],
          ["fast", "balanced", "quality"],
          String(defaults["segmentPreset"])
        ),
      };
    case "segment-stabilization":
      return {
        shakiness: pickOption(
          source["shakiness"],
          ["low", "medium", "high"],
          String(defaults["shakiness"])
        ),
        smoothing: pickNumber(source["smoothing"], Number(defaults["smoothing"]), 1, 30, 1),
        cropMode: pickOption(
          source["cropMode"],
          ["keep", "adaptive", "fixed"],
          String(defaults["cropMode"])
        ),
        quality: pickOption(
          source["quality"],
          ["compact", "balanced", "high"],
          String(defaults["quality"])
        ),
      };
    default:
      return cloneSettingsRecord(defaults);
  }
}

export function normalizeLabOperationSettingsMap(value: unknown): LabOperationSettingsMap {
  const record = asLabRecord(value);
  return LAB_OPERATION_CAPABILITIES.reduce<LabOperationSettingsMap>(function (
    settings,
    capability
  ) {
    settings[capability.id] = normalizeLabOperationSettings(capability.id, record[capability.id]);
    return settings;
  }, {} as LabOperationSettingsMap);
}

export function getDefaultLabAnalysisModuleSettings(moduleId: string): LabSettingsRecord {
  const capabilityId = getCapabilityFamilyForModuleId(moduleId);
  return {
    ...(capabilityId === null ? {} : LAB_ANALYSIS_FAMILY_SETTINGS_DEFAULTS[capabilityId]),
    ...cloneSettingsRecord(LAB_ANALYSIS_MODULE_SETTINGS_DEFAULTS[moduleId] || {}),
  };
}

export function normalizeLabAnalysisModuleSettings(
  moduleId: string,
  value: unknown
): LabSettingsRecord {
  const defaults = getDefaultLabAnalysisModuleSettings(moduleId);
  const record = asLabRecord(value);
  const source = asLabRecord(record[moduleId] ?? record);
  const next: LabSettingsRecord = {};
  Object.keys(defaults).forEach(function (key) {
    const fallback = defaults[key];
    switch (key) {
      case "samplingDensity":
      case "sensitivity":
      case "denoise":
      case "heuristicSensitivity":
        next[key] = pickOption(
          source[key],
          ["low", "medium", "high", "sparse", "balanced", "dense", "light", "strong"],
          String(fallback)
        );
        break;
      case "recoveryPreset":
        next[key] = pickOption(source[key], ["speech", "broadband", "hidden"], String(fallback));
        break;
      case "modelPolicy":
        next[key] = pickOption(
          source[key],
          ["selected", "fastest", "best-ready"],
          String(fallback)
        );
        break;
      case "language":
        next[key] = pickOption(source[key], ["auto", "tr", "en"], String(fallback));
        break;
      case "speakerCount":
        next[key] = pickOption(source[key], ["auto", "2", "3", "4", "5"], String(fallback));
        break;
      case "channelMode":
        next[key] = pickOption(source[key], ["rgb", "red", "green", "blue"], String(fallback));
        break;
      case "phaseMode":
        next[key] = pickOption(source[key], ["side", "left", "right", "mono"], String(fallback));
        break;
      case "compression":
        next[key] = pickOption(source[key], ["off", "light", "medium", "strong"], String(fallback));
        break;
      case "model":
        next[key] = pickOption(
          source[key],
          ["htdemucs", "htdemucs_ft", "mdx_extra"],
          String(fallback)
        );
        break;
      case "device":
        next[key] = pickOption(source[key], ["cpu", "cuda"], String(fallback));
        break;
      case "stems":
        next[key] = pickOption(
          source[key],
          ["all", "vocals", "drums", "bass", "other"],
          String(fallback)
        );
        break;
      case "focus":
        next[key] = pickOption(source[key], ["balanced", "rhythm", "tonal"], String(fallback));
        break;
      case "roiOnly":
      case "selectedRangeOnly":
      case "essentiaFallback":
        next[key] = pickBoolean(source[key], Boolean(fallback));
        break;
      case "threshold":
        next[key] = pickNumber(source[key], Number(fallback), 0.01, 0.95, 0.01);
        break;
      case "sampleRate":
        next[key] = pickNumber(source[key], Number(fallback), 8000, 96000, 1);
        break;
      case "silenceThresholdDb":
        next[key] = pickNumber(source[key], Number(fallback), -80, -10, 1);
        break;
      case "sampleWindowSeconds":
      case "sampleSeconds":
        next[key] = pickNumber(source[key], Number(fallback), 5, 600, 5);
        break;
      case "topK":
        next[key] = pickNumber(source[key], Number(fallback), 1, 30, 1);
        break;
      case "frameStep":
        next[key] = pickNumber(source[key], Number(fallback), 1, 120, 1);
        break;
      case "windowSeconds":
      case "minSegmentSeconds":
        next[key] = pickNumber(source[key], Number(fallback), 0.2, 10, 0.1);
        break;
      case "gain":
        next[key] = pickNumber(source[key], Number(fallback), 0.5, 10, 0.1);
        break;
      default:
        next[key] =
          typeof fallback === "number"
            ? pickNumber(source[key], fallback, -10000, 10000, 0.01)
            : typeof fallback === "boolean"
              ? pickBoolean(source[key], fallback)
              : typeof fallback === "string"
                ? asNonEmptyString(source[key]) || fallback
                : null;
    }
  });
  return next;
}

export function normalizeLabAnalysisSettingsMap(value: unknown): LabAnalysisSettingsMap {
  const record = asLabRecord(value);
  const rawFamilies = asLabRecord(record["families"]);
  const rawModules = asLabRecord(record["modules"]);
  const families = CAPABILITY_FAMILIES.reduce<
    Partial<Record<CapabilityFamilyId, LabSettingsRecord>>
  >(function (settings, family) {
    const defaults = LAB_ANALYSIS_FAMILY_SETTINGS_DEFAULTS[family.id];
    const source = asLabRecord(rawFamilies[family.id]);
    const next = cloneSettingsRecord(defaults);
    Object.keys(defaults).forEach(function (key) {
      const value = source[key];
      if (
        typeof value === "string" ||
        typeof value === "number" ||
        typeof value === "boolean" ||
        value === null
      ) {
        next[key] = value;
      }
    });
    settings[family.id] = next;
    return settings;
  }, {});
  const modules = Object.keys(LAB_ANALYSIS_MODULE_SETTINGS_DEFAULTS).reduce<
    Record<string, LabSettingsRecord>
  >(function (settings, moduleId) {
    settings[moduleId] = normalizeLabAnalysisModuleSettings(moduleId, rawModules[moduleId]);
    return settings;
  }, {});
  return { families, modules };
}

export function getModuleIdsForCapabilityFamily(capabilityId: CapabilityFamilyId): string[] {
  return (
    CAPABILITY_MODULE_GROUPS.find(function (entry) {
      return entry.capabilityId === capabilityId;
    })?.moduleIds.slice() || []
  );
}

export function getIntentIdsForCapabilityFamily(capabilityId: CapabilityFamilyId): LabIntentId[] {
  return WORKSPACE_INTENTS.filter(function (intent) {
    return intent.internalCapabilities.includes(capabilityId);
  }).map(function (intent) {
    return intent.id;
  });
}

export function getCapabilityFamilyForModuleId(
  moduleId: string | null | undefined
): CapabilityFamilyId | null {
  if (typeof moduleId !== "string" || moduleId.trim() === "") {
    return null;
  }
  const normalizedModuleId = moduleId.trim();
  if (
    CAPABILITY_FAMILIES.some(function (family) {
      return family.id === normalizedModuleId;
    })
  ) {
    return normalizedModuleId as CapabilityFamilyId;
  }
  return (
    CAPABILITY_MODULE_GROUPS.find(function (entry) {
      return entry.moduleIds.includes(normalizedModuleId);
    })?.capabilityId || null
  );
}

export function getIntentIdsForModuleId(moduleId: string | null | undefined): LabIntentId[] {
  const capabilityId = getCapabilityFamilyForModuleId(moduleId);
  if (capabilityId === null) {
    return [];
  }
  return getIntentIdsForCapabilityFamily(capabilityId);
}
