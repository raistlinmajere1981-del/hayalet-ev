export type LaboratoryTransformStageScope = "visual" | "audio";

export type LaboratoryVisualTransformStageKind =
  | "brightness"
  | "contrast"
  | "gamma"
  | "saturation"
  | "blur"
  | "sharpen"
  | "grayscale"
  | "channel-isolation"
  | "denoise";

export type LaboratoryAudioTransformStageKind =
  | "speed"
  | "pitch-shift"
  | "high-pass"
  | "low-pass"
  | "band-pass"
  | "eq"
  | "formant-shift"
  | "spectral-envelope"
  | "audio-denoise"
  | "noise-profile"
  | "compressor"
  | "channel-matrix"
  | "polarity"
  | "gain"
  | "parameter-sweep";

export type LaboratoryTransformStageKind =
  LaboratoryVisualTransformStageKind | LaboratoryAudioTransformStageKind;

export type LaboratoryTransformStageRecord = Record<string, unknown>;

export type LaboratoryTransformStage = {
  id: string;
  kind: LaboratoryTransformStageKind;
  enabled: boolean;
  params: LaboratoryTransformStageRecord;
};

export type LaboratoryTransformStageParameter = {
  id: string;
  label: string;
  kind: "number" | "select";
  defaultValue: number | string;
  min?: number;
  max?: number;
  step?: number;
  unit?: string;
  options?: Array<{ label: string; value: string }>;
};

export type LaboratoryTransformStageDefinition = {
  kind: LaboratoryTransformStageKind;
  scope: LaboratoryTransformStageScope;
  label: string;
  parameters: LaboratoryTransformStageParameter[];
};

export const LAB_VISUAL_TRANSFORM_STAGE_KINDS: readonly LaboratoryVisualTransformStageKind[] = [
  "brightness",
  "contrast",
  "gamma",
  "saturation",
  "blur",
  "sharpen",
  "grayscale",
  "channel-isolation",
  "denoise",
];

export const LAB_AUDIO_TRANSFORM_STAGE_KINDS: readonly LaboratoryAudioTransformStageKind[] = [
  "speed",
  "pitch-shift",
  "high-pass",
  "low-pass",
  "band-pass",
  "eq",
  "formant-shift",
  "spectral-envelope",
  "audio-denoise",
  "noise-profile",
  "compressor",
  "channel-matrix",
  "polarity",
  "gain",
  "parameter-sweep",
];

const LAB_TRANSFORM_STAGE_DEFINITIONS: readonly LaboratoryTransformStageDefinition[] = [
  {
    kind: "brightness",
    scope: "visual",
    label: "Brightness",
    parameters: [
      { id: "value", label: "Value", kind: "number", defaultValue: 0, min: -1, max: 1, step: 0.05 },
    ],
  },
  {
    kind: "contrast",
    scope: "visual",
    label: "Contrast",
    parameters: [
      {
        id: "value",
        label: "Value",
        kind: "number",
        defaultValue: 1,
        min: 0.1,
        max: 3,
        step: 0.05,
      },
    ],
  },
  {
    kind: "gamma",
    scope: "visual",
    label: "Gamma",
    parameters: [
      {
        id: "value",
        label: "Value",
        kind: "number",
        defaultValue: 1,
        min: 0.1,
        max: 5,
        step: 0.05,
      },
    ],
  },
  {
    kind: "saturation",
    scope: "visual",
    label: "Saturation",
    parameters: [
      { id: "value", label: "Value", kind: "number", defaultValue: 1, min: 0, max: 3, step: 0.05 },
    ],
  },
  {
    kind: "blur",
    scope: "visual",
    label: "Blur",
    parameters: [
      {
        id: "radius",
        label: "Radius",
        kind: "number",
        defaultValue: 1,
        min: 0.1,
        max: 20,
        step: 0.1,
      },
    ],
  },
  {
    kind: "sharpen",
    scope: "visual",
    label: "Sharpen",
    parameters: [
      {
        id: "amount",
        label: "Amount",
        kind: "number",
        defaultValue: 1,
        min: 0,
        max: 3,
        step: 0.05,
      },
    ],
  },
  {
    kind: "grayscale",
    scope: "visual",
    label: "Grayscale / luma",
    parameters: [],
  },
  {
    kind: "channel-isolation",
    scope: "visual",
    label: "RGB isolation",
    parameters: [
      {
        id: "channel",
        label: "Channel",
        kind: "select",
        defaultValue: "red",
        options: ["red", "green", "blue"].map((value) => ({ label: value.toUpperCase(), value })),
      },
    ],
  },
  {
    kind: "denoise",
    scope: "visual",
    label: "Denoise",
    parameters: [
      { id: "luma", label: "Luma", kind: "number", defaultValue: 4, min: 0, max: 20, step: 0.5 },
      {
        id: "chroma",
        label: "Chroma",
        kind: "number",
        defaultValue: 3,
        min: 0,
        max: 20,
        step: 0.5,
      },
    ],
  },
  {
    kind: "speed",
    scope: "audio",
    label: "Speed / time stretch",
    parameters: [
      {
        id: "factor",
        label: "Speed",
        kind: "number",
        defaultValue: 1,
        min: 0.25,
        max: 2,
        step: 0.05,
        unit: "×",
      },
    ],
  },
  {
    kind: "pitch-shift",
    scope: "audio",
    label: "Pitch shift",
    parameters: [
      {
        id: "semitones",
        label: "Pitch",
        kind: "number",
        defaultValue: 0,
        min: -12,
        max: 12,
        step: 0.25,
        unit: "st",
      },
      {
        id: "formantMode",
        label: "Formants",
        kind: "select",
        defaultValue: "shifted",
        options: [
          { label: "Shift with pitch (built-in)", value: "shifted" },
          { label: "Preserve (Rubber Band)", value: "preserved" },
        ],
      },
    ],
  },
  {
    kind: "high-pass",
    scope: "audio",
    label: "High-pass",
    parameters: [
      {
        id: "hz",
        label: "Frequency",
        kind: "number",
        defaultValue: 80,
        min: 1,
        max: 20000,
        step: 1,
        unit: "Hz",
      },
    ],
  },
  {
    kind: "low-pass",
    scope: "audio",
    label: "Low-pass",
    parameters: [
      {
        id: "hz",
        label: "Frequency",
        kind: "number",
        defaultValue: 8000,
        min: 1,
        max: 24000,
        step: 1,
        unit: "Hz",
      },
    ],
  },
  {
    kind: "band-pass",
    scope: "audio",
    label: "Band-pass",
    parameters: [
      {
        id: "mode",
        label: "Definition",
        kind: "select",
        defaultValue: "edges",
        options: [
          { label: "Low / High edges", value: "edges" },
          { label: "Center / Q", value: "center-q" },
        ],
      },
      {
        id: "lowHz",
        label: "Low",
        kind: "number",
        defaultValue: 80,
        min: 1,
        max: 20000,
        step: 1,
        unit: "Hz",
      },
      {
        id: "highHz",
        label: "High",
        kind: "number",
        defaultValue: 8000,
        min: 2,
        max: 24000,
        step: 1,
        unit: "Hz",
      },
      {
        id: "centerHz",
        label: "Center",
        kind: "number",
        defaultValue: 1000,
        min: 20,
        max: 20000,
        step: 1,
        unit: "Hz",
      },
      { id: "q", label: "Q", kind: "number", defaultValue: 2, min: 0.1, max: 50, step: 0.1 },
    ],
  },
  {
    kind: "eq",
    scope: "audio",
    label: "Parametric EQ",
    parameters: [
      {
        id: "frequencyHz",
        label: "Frequency",
        kind: "number",
        defaultValue: 1000,
        min: 20,
        max: 20000,
        step: 1,
        unit: "Hz",
      },
      {
        id: "gainDb",
        label: "Gain",
        kind: "number",
        defaultValue: 0,
        min: -24,
        max: 24,
        step: 0.5,
        unit: "dB",
      },
      { id: "q", label: "Q", kind: "number", defaultValue: 1, min: 0.1, max: 20, step: 0.1 },
    ],
  },
  {
    kind: "formant-shift",
    scope: "audio",
    label: "Formant shift (Rubber Band)",
    parameters: [
      {
        id: "semitones",
        label: "Formant shift",
        kind: "number",
        defaultValue: 0,
        min: -12,
        max: 12,
        step: 0.25,
        unit: "st",
      },
    ],
  },
  {
    kind: "spectral-envelope",
    scope: "audio",
    label: "Spectral envelope correction",
    parameters: [
      {
        id: "lowGainDb",
        label: "Low shelf",
        kind: "number",
        defaultValue: 0,
        min: -18,
        max: 18,
        step: 0.5,
        unit: "dB",
      },
      {
        id: "highGainDb",
        label: "High shelf",
        kind: "number",
        defaultValue: 0,
        min: -18,
        max: 18,
        step: 0.5,
        unit: "dB",
      },
    ],
  },
  {
    kind: "audio-denoise",
    scope: "audio",
    label: "FFT denoise",
    parameters: [
      {
        id: "reductionDb",
        label: "Reduction",
        kind: "number",
        defaultValue: 10,
        min: 0,
        max: 30,
        step: 1,
        unit: "dB",
      },
      {
        id: "noiseFloorDb",
        label: "Noise floor",
        kind: "number",
        defaultValue: -50,
        min: -80,
        max: -20,
        step: 1,
        unit: "dB",
      },
    ],
  },
  {
    kind: "noise-profile",
    scope: "audio",
    label: "Noise profile / spectral subtraction",
    parameters: [
      {
        id: "profileStartSec",
        label: "Profile start",
        kind: "number",
        defaultValue: 0,
        min: 0,
        max: 86400,
        step: 0.01,
        unit: "s",
      },
      {
        id: "profileEndSec",
        label: "Profile end",
        kind: "number",
        defaultValue: 0.5,
        min: 0.01,
        max: 86400,
        step: 0.01,
        unit: "s",
      },
      {
        id: "reductionDb",
        label: "Reduction",
        kind: "number",
        defaultValue: 12,
        min: 0,
        max: 30,
        step: 1,
        unit: "dB",
      },
      {
        id: "noiseFloorDb",
        label: "Noise floor",
        kind: "number",
        defaultValue: -50,
        min: -80,
        max: -20,
        step: 1,
        unit: "dB",
      },
    ],
  },
  {
    kind: "compressor",
    scope: "audio",
    label: "Compressor",
    parameters: [
      {
        id: "thresholdDb",
        label: "Threshold",
        kind: "number",
        defaultValue: -18,
        min: -60,
        max: 0,
        step: 1,
        unit: "dB",
      },
      { id: "ratio", label: "Ratio", kind: "number", defaultValue: 3, min: 1, max: 20, step: 0.5 },
      {
        id: "attackMs",
        label: "Attack",
        kind: "number",
        defaultValue: 20,
        min: 0.01,
        max: 2000,
        step: 1,
        unit: "ms",
      },
      {
        id: "releaseMs",
        label: "Release",
        kind: "number",
        defaultValue: 250,
        min: 0.01,
        max: 9000,
        step: 10,
        unit: "ms",
      },
    ],
  },
  {
    kind: "channel-matrix",
    scope: "audio",
    label: "Channel / Mid-Side",
    parameters: [
      {
        id: "mode",
        label: "Listen",
        kind: "select",
        defaultValue: "stereo",
        options: [
          { label: "Stereo", value: "stereo" },
          { label: "Left", value: "left" },
          { label: "Right", value: "right" },
          { label: "L+R / mono", value: "mono" },
          { label: "Mid", value: "mid" },
          { label: "Side", value: "side" },
          { label: "L−R", value: "l-minus-r" },
        ],
      },
    ],
  },
  {
    kind: "polarity",
    scope: "audio",
    label: "Phase / polarity",
    parameters: [
      {
        id: "mode",
        label: "Test",
        kind: "select",
        defaultValue: "none",
        options: [
          { label: "No change", value: "none" },
          { label: "Invert Left", value: "invert-left" },
          { label: "Invert Right", value: "invert-right" },
          { label: "Invert Both", value: "invert-both" },
          { label: "Mono collapse", value: "mono-collapse" },
        ],
      },
    ],
  },
  {
    kind: "gain",
    scope: "audio",
    label: "Gain",
    parameters: [
      {
        id: "db",
        label: "Gain",
        kind: "number",
        defaultValue: 0,
        min: -60,
        max: 30,
        step: 0.5,
        unit: "dB",
      },
    ],
  },
  {
    kind: "parameter-sweep",
    scope: "audio",
    label: "Parameter sweep",
    parameters: [
      {
        id: "primaryAxis",
        label: "Primary axis",
        kind: "select",
        defaultValue: "pitch",
        options: [
          { label: "Pitch", value: "pitch" },
          { label: "Speed", value: "speed" },
          { label: "Band-pass center", value: "band-center" },
          { label: "Band-pass Q", value: "band-q" },
          { label: "EQ gain", value: "eq-gain" },
        ],
      },
      {
        id: "secondaryAxis",
        label: "Cartesian axis",
        kind: "select",
        defaultValue: "none",
        options: [
          { label: "None", value: "none" },
          { label: "Pitch", value: "pitch" },
          { label: "Speed", value: "speed" },
        ],
      },
      {
        id: "pitchStart",
        label: "Pitch start",
        kind: "number",
        defaultValue: -12,
        min: -12,
        max: 12,
        step: 0.25,
        unit: "st",
      },
      {
        id: "pitchEnd",
        label: "Pitch end",
        kind: "number",
        defaultValue: 12,
        min: -12,
        max: 12,
        step: 0.25,
        unit: "st",
      },
      {
        id: "pitchStep",
        label: "Pitch step",
        kind: "number",
        defaultValue: 1,
        min: 0.25,
        max: 12,
        step: 0.25,
        unit: "st",
      },
      {
        id: "speedStart",
        label: "Speed start",
        kind: "number",
        defaultValue: 0.25,
        min: 0.25,
        max: 2,
        step: 0.05,
        unit: "×",
      },
      {
        id: "speedEnd",
        label: "Speed end",
        kind: "number",
        defaultValue: 2,
        min: 0.25,
        max: 2,
        step: 0.05,
        unit: "×",
      },
      {
        id: "speedStep",
        label: "Speed step",
        kind: "number",
        defaultValue: 0.25,
        min: 0.05,
        max: 1.75,
        step: 0.05,
        unit: "×",
      },
      {
        id: "bandCenterStart",
        label: "Center start",
        kind: "number",
        defaultValue: 250,
        min: 20,
        max: 20000,
        step: 10,
        unit: "Hz",
      },
      {
        id: "bandCenterEnd",
        label: "Center end",
        kind: "number",
        defaultValue: 4000,
        min: 20,
        max: 20000,
        step: 10,
        unit: "Hz",
      },
      {
        id: "bandCenterStep",
        label: "Center step",
        kind: "number",
        defaultValue: 250,
        min: 1,
        max: 10000,
        step: 1,
        unit: "Hz",
      },
      {
        id: "bandQStart",
        label: "Q start",
        kind: "number",
        defaultValue: 0.5,
        min: 0.1,
        max: 50,
        step: 0.1,
      },
      {
        id: "bandQEnd",
        label: "Q end",
        kind: "number",
        defaultValue: 8,
        min: 0.1,
        max: 50,
        step: 0.1,
      },
      {
        id: "bandQStep",
        label: "Q step",
        kind: "number",
        defaultValue: 0.5,
        min: 0.1,
        max: 25,
        step: 0.1,
      },
      {
        id: "eqGainStart",
        label: "EQ gain start",
        kind: "number",
        defaultValue: -12,
        min: -24,
        max: 24,
        step: 0.5,
        unit: "dB",
      },
      {
        id: "eqGainEnd",
        label: "EQ gain end",
        kind: "number",
        defaultValue: 12,
        min: -24,
        max: 24,
        step: 0.5,
        unit: "dB",
      },
      {
        id: "eqGainStep",
        label: "EQ gain step",
        kind: "number",
        defaultValue: 3,
        min: 0.5,
        max: 24,
        step: 0.5,
        unit: "dB",
      },
      {
        id: "maxVariants",
        label: "Maximum variants",
        kind: "number",
        defaultValue: 49,
        min: 4,
        max: 200,
        step: 1,
      },
    ],
  },
];

const VISUAL_KIND_SET = new Set<string>(LAB_VISUAL_TRANSFORM_STAGE_KINDS);
const AUDIO_KIND_SET = new Set<string>(LAB_AUDIO_TRANSFORM_STAGE_KINDS);

function toRecord(value: unknown): LaboratoryTransformStageRecord {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as LaboratoryTransformStageRecord)
    : {};
}

function asNonEmptyString(value: unknown): string | null {
  return typeof value === "string" && value.trim() !== "" ? value.trim() : null;
}

export function isLaboratoryTransformStageKind(
  value: unknown,
  scope?: LaboratoryTransformStageScope
): value is LaboratoryTransformStageKind {
  const kind = asNonEmptyString(value);
  if (kind === null) return false;
  if (scope === "visual") return VISUAL_KIND_SET.has(kind);
  if (scope === "audio") return AUDIO_KIND_SET.has(kind);
  return VISUAL_KIND_SET.has(kind) || AUDIO_KIND_SET.has(kind);
}

export function getLaboratoryTransformStageDefinition(
  kind: LaboratoryTransformStageKind
): LaboratoryTransformStageDefinition {
  const definition = LAB_TRANSFORM_STAGE_DEFINITIONS.find((entry) => entry.kind === kind);
  if (definition === undefined) throw new Error(`Unknown Laboratory transform stage kind: ${kind}`);
  return definition;
}

export function getLaboratoryTransformStageDefinitions(scope: LaboratoryTransformStageScope) {
  return LAB_TRANSFORM_STAGE_DEFINITIONS.filter((definition) => definition.scope === scope);
}

export function createLaboratoryTransformStageParams(
  kind: LaboratoryTransformStageKind
): LaboratoryTransformStageRecord {
  const definition = getLaboratoryTransformStageDefinition(kind);
  return definition.parameters.reduce<LaboratoryTransformStageRecord>((params, parameter) => {
    params[parameter.id] = parameter.defaultValue;
    return params;
  }, {});
}

function createUniqueStageId(
  stages: LaboratoryTransformStage[],
  kind: LaboratoryTransformStageKind
) {
  let suffix = 1;
  let candidate = `${kind}-${suffix}`;
  const ids = new Set(stages.map((stage) => stage.id));
  while (ids.has(candidate)) {
    suffix += 1;
    candidate = `${kind}-${suffix}`;
  }
  return candidate;
}

export function normalizeLaboratoryTransformStages(
  value: unknown,
  scope?: LaboratoryTransformStageScope
): LaboratoryTransformStage[] {
  if (!Array.isArray(value)) return [];
  return value
    .map(function (entry: unknown, index: number): LaboratoryTransformStage | null {
      const record = toRecord(entry);
      if (!isLaboratoryTransformStageKind(record["kind"], scope)) return null;
      return {
        id: asNonEmptyString(record["id"]) || `stage-${index + 1}`,
        kind: record["kind"],
        enabled: record["enabled"] !== false,
        params: {
          ...createLaboratoryTransformStageParams(record["kind"]),
          ...toRecord(record["params"]),
        },
      };
    })
    .filter((entry): entry is LaboratoryTransformStage => entry !== null);
}

export type LaboratoryTransformStageMutation =
  | { type: "add"; kind: LaboratoryTransformStageKind }
  | { type: "remove"; stageId: string }
  | { type: "move"; stageId: string; direction: "up" | "down" }
  | { type: "enabled"; stageId: string; enabled: boolean }
  | { type: "parameter"; stageId: string; parameterId: string; value: unknown };

export function mutateLaboratoryTransformStages(
  value: unknown,
  scope: LaboratoryTransformStageScope,
  mutation: LaboratoryTransformStageMutation
): LaboratoryTransformStage[] {
  const stages = normalizeLaboratoryTransformStages(value, scope).map((stage) => ({
    ...stage,
    params: { ...stage.params },
  }));

  if (mutation.type === "add") {
    if (!isLaboratoryTransformStageKind(mutation.kind, scope)) return stages;
    stages.push({
      id: createUniqueStageId(stages, mutation.kind),
      kind: mutation.kind,
      enabled: true,
      params: createLaboratoryTransformStageParams(mutation.kind),
    });
    return stages;
  }

  const index = stages.findIndex((stage) => stage.id === mutation.stageId);
  if (index < 0) return stages;
  const currentStage = stages[index];
  if (currentStage === undefined) return stages;

  if (mutation.type === "remove") {
    stages.splice(index, 1);
    return stages;
  }
  if (mutation.type === "move") {
    const targetIndex = mutation.direction === "up" ? index - 1 : index + 1;
    if (targetIndex < 0 || targetIndex >= stages.length) return stages;
    stages.splice(index, 1);
    stages.splice(targetIndex, 0, currentStage);
    return stages;
  }
  if (mutation.type === "enabled") {
    stages[index] = { ...currentStage, enabled: mutation.enabled };
    return stages;
  }

  stages[index] = {
    ...currentStage,
    params: {
      ...currentStage.params,
      [mutation.parameterId]: mutation.value,
    },
  };
  return stages;
}
