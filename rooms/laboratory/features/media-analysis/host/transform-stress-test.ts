import {
  LAB_AUDIO_TRANSFORM_STAGE_KINDS,
  LAB_VISUAL_TRANSFORM_STAGE_KINDS,
  createLaboratoryTransformStageParams,
  normalizeLaboratoryTransformStages,
} from "../../../shared/transform-stress-test-model.js";
import type {
  LaboratoryAudioTransformStageKind,
  LaboratoryTransformStage,
  LaboratoryVisualTransformStageKind,
} from "../../../shared/transform-stress-test-model.js";

type LaboratoryRecord = Record<string, unknown>;

type CompiledStressTestFilters = {
  video: string[];
  audio: string[];
};

export type LaboratoryAudioSweepAxis =
  | "pitch"
  | "speed"
  | "band-center"
  | "band-q"
  | "eq-gain";

export type LaboratoryAudioSweepVariant = {
  id: string;
  label: string;
  primaryAxis: LaboratoryAudioSweepAxis;
  primaryValue: number;
  secondaryAxis: "pitch" | "speed" | null;
  secondaryValue: number | null;
  filters: string[];
  stages: LaboratoryTransformStage[];
};

export type LaboratoryAudioSweepPlan = {
  requestedVariantCount: number;
  truncated: boolean;
  variants: LaboratoryAudioSweepVariant[];
};

function isVisualStageKind(
  value: LaboratoryTransformStage["kind"]
): value is LaboratoryVisualTransformStageKind {
  return LAB_VISUAL_TRANSFORM_STAGE_KINDS.some(function (kind) {
    return kind === value;
  });
}

function isAudioStageKind(
  value: LaboratoryTransformStage["kind"]
): value is LaboratoryAudioTransformStageKind {
  return LAB_AUDIO_TRANSFORM_STAGE_KINDS.some(function (kind) {
    return kind === value;
  });
}

function toRecord(value: unknown): LaboratoryRecord {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as LaboratoryRecord)
    : {};
}

function asNonEmptyString(value: unknown): string | null {
  return typeof value === "string" && value.trim() !== "" ? value.trim() : null;
}

function asFiniteNumber(value: unknown): number | null {
  const numberValue = typeof value === "number" ? value : Number(value);
  return Number.isFinite(numberValue) ? numberValue : null;
}

function clamp(value: unknown, minimum: number, maximum: number, fallback: number): number {
  const numberValue = asFiniteNumber(value);
  if (numberValue === null) return fallback;
  return Math.min(maximum, Math.max(minimum, numberValue));
}

function formatNumber(value: number) {
  return Number(value.toFixed(6)).toString();
}

function getRecipe(project: LaboratoryRecord) {
  return toRecord(toRecord(project["edit"])["recipe"]);
}

function getVisualStages(project: LaboratoryRecord) {
  const sourceKind = asNonEmptyString(toRecord(project["source"])["kind"]);
  const recipe = getRecipe(project);
  const section = sourceKind === "image" ? toRecord(recipe["image"]) : toRecord(recipe["video"]);
  return normalizeLaboratoryTransformStages(section["transformStages"], "visual");
}

function getAudioStages(project: LaboratoryRecord) {
  return normalizeLaboratoryTransformStages(
    toRecord(getRecipe(project)["audio"])["transformStages"],
    "audio"
  );
}

function compileVisualStage(stage: LaboratoryTransformStage): string[] {
  if (stage.enabled !== true || !isVisualStageKind(stage.kind)) return [];
  const params = stage.params;
  switch (stage.kind) {
    case "brightness":
      return [`eq=brightness=${formatNumber(clamp(params["value"], -1, 1, 0))}`];
    case "contrast":
      return [`eq=contrast=${formatNumber(clamp(params["value"], 0.1, 3, 1))}`];
    case "gamma":
      return [`eq=gamma=${formatNumber(clamp(params["value"], 0.1, 5, 1))}`];
    case "saturation":
      return [`eq=saturation=${formatNumber(clamp(params["value"], 0, 3, 1))}`];
    case "blur":
      return [`boxblur=${formatNumber(clamp(params["radius"], 0.1, 20, 1))}:1`];
    case "sharpen":
      return [`unsharp=5:5:${formatNumber(clamp(params["amount"], 0, 3, 1))}:5:5:0`];
    case "grayscale":
      return ["hue=s=0"];
    case "channel-isolation": {
      const channel = asNonEmptyString(params["channel"]) || "red";
      if (channel === "green") return ["colorchannelmixer=rr=0:rg=0:rb=0:gr=0:gg=1:gb=0:br=0:bg=0:bb=0"];
      if (channel === "blue") return ["colorchannelmixer=rr=0:rg=0:rb=0:gr=0:gg=0:gb=0:br=0:bg=0:bb=1"];
      return ["colorchannelmixer=rr=1:rg=0:rb=0:gr=0:gg=0:gb=0:br=0:bg=0:bb=0"];
    }
    case "denoise": {
      const luma = formatNumber(clamp(params["luma"], 0, 20, 4));
      const chroma = formatNumber(clamp(params["chroma"], 0, 20, 3));
      return [`hqdn3d=${luma}:${chroma}:${luma}:${chroma}`];
    }
    default:
      return [];
  }
}

function compileTempoFilters(factorValue: unknown) {
  let remaining = clamp(factorValue, 0.25, 2, 1);
  const filters: string[] = [];
  while (remaining < 0.5 - 0.000001) {
    filters.push("atempo=0.5");
    remaining /= 0.5;
  }
  while (remaining > 2 + 0.000001) {
    filters.push("atempo=2");
    remaining /= 2;
  }
  if (Math.abs(remaining - 1) > 0.000001) {
    filters.push(`atempo=${formatNumber(remaining)}`);
  }
  return filters;
}

function pitchRatio(semitonesValue: unknown) {
  return Math.pow(2, clamp(semitonesValue, -12, 12, 0) / 12);
}

export function compileLaboratoryAudioTransformStage(stage: LaboratoryTransformStage): string[] {
  if (stage.enabled !== true || !isAudioStageKind(stage.kind)) return [];
  const params = stage.params;
  switch (stage.kind) {
    case "speed":
      return compileTempoFilters(params["factor"]);
    case "pitch-shift": {
      const ratio = pitchRatio(params["semitones"]);
      if (Math.abs(ratio - 1) < 0.000001) return [];
      const formantMode = asNonEmptyString(params["formantMode"]) || "shifted";
      if (formantMode === "preserved") {
        return [`rubberband=tempo=1:pitch=${formatNumber(ratio)}:formant=preserved`];
      }
      const targetRate = 48000 * ratio;
      return [
        "aresample=48000",
        `asetrate=${formatNumber(targetRate)}`,
        "aresample=48000",
        ...compileTempoFilters(1 / ratio),
      ];
    }
    case "high-pass":
      return [`highpass=f=${formatNumber(clamp(params["hz"], 1, 20000, 80))}`];
    case "low-pass":
      return [`lowpass=f=${formatNumber(clamp(params["hz"], 1, 24000, 8000))}`];
    case "band-pass": {
      if (asNonEmptyString(params["mode"]) === "center-q") {
        const centerHz = clamp(params["centerHz"], 20, 20000, 1000);
        const q = clamp(params["q"], 0.1, 50, 2);
        const bandwidth = Math.max(2, centerHz / q);
        const lowHz = Math.max(1, centerHz - bandwidth / 2);
        const highHz = Math.min(24000, Math.max(lowHz + 1, centerHz + bandwidth / 2));
        return [`highpass=f=${formatNumber(lowHz)}`, `lowpass=f=${formatNumber(highHz)}`];
      }
      const lowHz = clamp(params["lowHz"], 1, 20000, 80);
      const requestedHighHz = clamp(params["highHz"], 2, 24000, 8000);
      const highHz = Math.min(24000, Math.max(lowHz + 1, requestedHighHz));
      return [`highpass=f=${formatNumber(lowHz)}`, `lowpass=f=${formatNumber(highHz)}`];
    }
    case "eq": {
      const frequencyHz = clamp(params["frequencyHz"], 20, 20000, 1000);
      const gainDb = clamp(params["gainDb"], -24, 24, 0);
      const q = clamp(params["q"], 0.1, 20, 1);
      return [`equalizer=f=${formatNumber(frequencyHz)}:t=q:w=${formatNumber(q)}:g=${formatNumber(gainDb)}`];
    }
    case "formant-shift": {
      const ratio = pitchRatio(params["semitones"]);
      if (Math.abs(ratio - 1) < 0.000001) return [];
      return [
        `rubberband=tempo=1:pitch=${formatNumber(ratio)}:formant=shifted`,
        `rubberband=tempo=1:pitch=${formatNumber(1 / ratio)}:formant=preserved`,
      ];
    }
    case "spectral-envelope": {
      const lowGain = clamp(params["lowGainDb"], -18, 18, 0);
      const highGain = clamp(params["highGainDb"], -18, 18, 0);
      return [
        `lowshelf=f=250:g=${formatNumber(lowGain)}`,
        `highshelf=f=4000:g=${formatNumber(highGain)}`,
      ];
    }
    case "audio-denoise": {
      const reduction = clamp(params["reductionDb"], 0, 30, 10);
      const noiseFloor = clamp(params["noiseFloorDb"], -80, -20, -50);
      return [`afftdn=nr=${formatNumber(reduction)}:nf=${formatNumber(noiseFloor)}`];
    }
    case "noise-profile": {
      const start = clamp(params["profileStartSec"], 0, 86399.99, 0);
      const end = Math.min(86400, Math.max(start + 0.01, clamp(params["profileEndSec"], 0.01, 86400, start + 0.5)));
      const reduction = clamp(params["reductionDb"], 0, 30, 12);
      const noiseFloor = clamp(params["noiseFloorDb"], -80, -20, -50);
      return [
        `asendcmd=${formatNumber(start)} afftdn sn start`,
        `asendcmd=${formatNumber(end)} afftdn sn stop`,
        `afftdn=nr=${formatNumber(reduction)}:nf=${formatNumber(noiseFloor)}`,
      ];
    }
    case "compressor": {
      const thresholdDb = clamp(params["thresholdDb"], -60, 0, -18);
      const thresholdLinear = Math.max(0.000976563, Math.min(1, Math.pow(10, thresholdDb / 20)));
      const ratio = clamp(params["ratio"], 1, 20, 3);
      const attack = clamp(params["attackMs"], 0.01, 2000, 20);
      const release = clamp(params["releaseMs"], 0.01, 9000, 250);
      return [`acompressor=threshold=${formatNumber(thresholdLinear)}:ratio=${formatNumber(ratio)}:attack=${formatNumber(attack)}:release=${formatNumber(release)}`];
    }
    case "channel-matrix": {
      const mode = asNonEmptyString(params["mode"]) || "stereo";
      if (mode === "stereo") return [];
      const stereo = "aformat=channel_layouts=stereo";
      if (mode === "left") return [stereo, "pan=mono|c0=c0"];
      if (mode === "right") return [stereo, "pan=mono|c0=c1"];
      if (mode === "side") return [stereo, "pan=mono|c0=0.5*c0-0.5*c1"];
      if (mode === "l-minus-r") return [stereo, "pan=mono|c0=c0-c1"];
      return [stereo, "pan=mono|c0=0.5*c0+0.5*c1"];
    }
    case "polarity": {
      const mode = asNonEmptyString(params["mode"]) || "none";
      if (mode === "invert-both") return ["volume=-1"];
      if (mode === "mono-collapse") return ["aformat=channel_layouts=stereo", "pan=mono|c0=0.5*c0+0.5*c1"];
      if (mode === "invert-left") return ["aformat=channel_layouts=stereo", "pan=stereo|c0=-1*c0|c1=c1"];
      if (mode === "invert-right") return ["aformat=channel_layouts=stereo", "pan=stereo|c0=c0|c1=-1*c1"];
      return [];
    }
    case "gain":
      return [`volume=${formatNumber(clamp(params["db"], -60, 30, 0))}dB`];
    case "parameter-sweep":
      return [];
    default:
      return [];
  }
}

export function compileLaboratoryAudioTransformStages(stagesValue: unknown) {
  return normalizeLaboratoryTransformStages(stagesValue, "audio").flatMap(
    compileLaboratoryAudioTransformStage
  );
}

function appendFilterChain(command: string[], flag: "-vf" | "-af", filters: string[]) {
  if (filters.length === 0) return command;
  const nextCommand = [...command];
  const existingIndex = nextCommand.indexOf(flag);
  if (existingIndex >= 0 && existingIndex + 1 < nextCommand.length) {
    nextCommand[existingIndex + 1] = [nextCommand[existingIndex + 1], ...filters].filter(Boolean).join(",");
    return nextCommand;
  }
  const outputIndex = Math.max(0, nextCommand.length - 1);
  nextCommand.splice(outputIndex, 0, flag, filters.join(","));
  return nextCommand;
}

export function appendLaboratoryAudioFiltersToCommand(commandValue: readonly string[], filters: string[]) {
  return appendFilterChain([...commandValue], "-af", filters);
}

function asSweepAxis(value: unknown): LaboratoryAudioSweepAxis {
  const candidate = asNonEmptyString(value);
  return candidate === "speed" || candidate === "band-center" || candidate === "band-q" || candidate === "eq-gain"
    ? candidate
    : "pitch";
}

function buildRange(start: number, end: number, step: number, hardLimit = 2000) {
  const values: number[] = [];
  const direction = end >= start ? 1 : -1;
  const normalizedStep = Math.max(0.000001, Math.abs(step)) * direction;
  let value = start;
  for (let index = 0; index < hardLimit; index += 1) {
    if ((direction > 0 && value > end + 0.000001) || (direction < 0 && value < end - 0.000001)) break;
    values.push(Number(value.toFixed(6)));
    value += normalizedStep;
  }
  return values.length > 0 ? values : [start];
}

function getAxisRange(axis: LaboratoryAudioSweepAxis, params: LaboratoryRecord) {
  if (axis === "speed") {
    return buildRange(
      clamp(params["speedStart"], 0.25, 2, 0.25),
      clamp(params["speedEnd"], 0.25, 2, 2),
      clamp(params["speedStep"], 0.05, 1.75, 0.25)
    );
  }
  if (axis === "band-center") {
    return buildRange(
      clamp(params["bandCenterStart"], 20, 20000, 250),
      clamp(params["bandCenterEnd"], 20, 20000, 4000),
      clamp(params["bandCenterStep"], 1, 10000, 250)
    );
  }
  if (axis === "band-q") {
    return buildRange(
      clamp(params["bandQStart"], 0.1, 50, 0.5),
      clamp(params["bandQEnd"], 0.1, 50, 8),
      clamp(params["bandQStep"], 0.1, 25, 0.5)
    );
  }
  if (axis === "eq-gain") {
    return buildRange(
      clamp(params["eqGainStart"], -24, 24, -12),
      clamp(params["eqGainEnd"], -24, 24, 12),
      clamp(params["eqGainStep"], 0.5, 24, 3)
    );
  }
  return buildRange(
    clamp(params["pitchStart"], -12, 12, -12),
    clamp(params["pitchEnd"], -12, 12, 12),
    clamp(params["pitchStep"], 0.25, 12, 1)
  );
}

function axisUnit(axis: LaboratoryAudioSweepAxis) {
  if (axis === "pitch") return "st";
  if (axis === "speed") return "×";
  if (axis === "band-center") return "Hz";
  if (axis === "eq-gain") return "dB";
  return "Q";
}

function overrideAxis(
  stagesValue: LaboratoryTransformStage[],
  axis: LaboratoryAudioSweepAxis,
  value: number
) {
  const stages = stagesValue
    .filter((stage) => stage.kind !== "parameter-sweep")
    .map((stage) => ({ ...stage, params: { ...stage.params } }));
  const kind: LaboratoryAudioTransformStageKind =
    axis === "pitch" ? "pitch-shift" : axis === "speed" ? "speed" : axis === "eq-gain" ? "eq" : "band-pass";
  let target = stages.find((stage) => stage.enabled === true && stage.kind === kind) || null;
  if (target === null) {
    target = {
      id: `sweep-${kind}`,
      kind,
      enabled: true,
      params: createLaboratoryTransformStageParams(kind),
    };
    stages.push(target);
  }
  if (axis === "pitch") target.params["semitones"] = value;
  if (axis === "speed") target.params["factor"] = value;
  if (axis === "eq-gain") target.params["gainDb"] = value;
  if (axis === "band-center") {
    target.params["mode"] = "center-q";
    target.params["centerHz"] = value;
  }
  if (axis === "band-q") {
    target.params["mode"] = "center-q";
    target.params["q"] = value;
  }
  return stages;
}

function createVariantId(index: number, primaryAxis: LaboratoryAudioSweepAxis, primaryValue: number, secondaryAxis: string | null, secondaryValue: number | null) {
  return [
    `audio-sweep-${String(index + 1).padStart(3, "0")}`,
    primaryAxis,
    formatNumber(primaryValue),
    secondaryAxis || "none",
    secondaryValue === null ? "none" : formatNumber(secondaryValue),
  ]
    .join("-")
    .replace(/[^a-zA-Z0-9_.-]+/g, "-");
}

export function buildLaboratoryAudioSweepPlan(stagesValue: unknown): LaboratoryAudioSweepPlan | null {
  const stages = normalizeLaboratoryTransformStages(stagesValue, "audio");
  const sweepStage = stages.find((stage) => stage.enabled === true && stage.kind === "parameter-sweep") || null;
  if (sweepStage === null) return null;

  const primaryAxis = asSweepAxis(sweepStage.params["primaryAxis"]);
  const requestedSecondary = asNonEmptyString(sweepStage.params["secondaryAxis"]);
  const secondaryAxis: "pitch" | "speed" | null =
    requestedSecondary === "pitch" || requestedSecondary === "speed"
      ? requestedSecondary === primaryAxis
        ? null
        : requestedSecondary
      : null;
  const primaryValues = getAxisRange(primaryAxis, sweepStage.params);
  const secondaryValues = secondaryAxis === null ? [null] : getAxisRange(secondaryAxis, sweepStage.params);
  const requestedVariantCount = primaryValues.length * secondaryValues.length;
  const maxVariants = Math.round(clamp(sweepStage.params["maxVariants"], 4, 200, 49));
  const variants: LaboratoryAudioSweepVariant[] = [];

  outer: for (const primaryValue of primaryValues) {
    for (const secondaryValue of secondaryValues) {
      let variantStages = overrideAxis(stages, primaryAxis, primaryValue);
      if (secondaryAxis !== null && secondaryValue !== null) {
        variantStages = overrideAxis(variantStages, secondaryAxis, secondaryValue);
      }
      const secondaryLabel =
        secondaryAxis === null || secondaryValue === null
          ? ""
          : ` · ${secondaryAxis} ${formatNumber(secondaryValue)} ${axisUnit(secondaryAxis)}`;
      variants.push({
        id: createVariantId(variants.length, primaryAxis, primaryValue, secondaryAxis, secondaryValue),
        label: `${primaryAxis} ${formatNumber(primaryValue)} ${axisUnit(primaryAxis)}${secondaryLabel}`,
        primaryAxis,
        primaryValue,
        secondaryAxis,
        secondaryValue,
        filters: compileLaboratoryAudioTransformStages(variantStages),
        stages: variantStages,
      });
      if (variants.length >= maxVariants) break outer;
    }
  }

  return {
    requestedVariantCount,
    truncated: requestedVariantCount > variants.length,
    variants,
  };
}

export function compileTransformStressTestFilters(projectValue: unknown): CompiledStressTestFilters {
  const project = toRecord(projectValue);
  const video = getVisualStages(project).flatMap(compileVisualStage);
  const audio = getAudioStages(project).flatMap(compileLaboratoryAudioTransformStage);
  return { video, audio };
}

export function extendEditCommandWithTransformStressTest(
  commandValue: readonly string[],
  projectValue: unknown
) {
  const project = toRecord(projectValue);
  const sourceKind = asNonEmptyString(toRecord(project["source"])["kind"]);
  const compiled = compileTransformStressTestFilters(project);
  const videoIncludesAudio = toRecord(getRecipe(project)["video"])["includeAudio"] === true;

  let command = [...commandValue];
  if (sourceKind === "video" || sourceKind === "image") command = appendFilterChain(command, "-vf", compiled.video);
  if (sourceKind === "audio" || (sourceKind === "video" && videoIncludesAudio)) command = appendFilterChain(command, "-af", compiled.audio);
  return command;
}
