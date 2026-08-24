import {
  LAB_AUDIO_TRANSFORM_STAGE_KINDS,
  LAB_VISUAL_TRANSFORM_STAGE_KINDS,
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
  if (numberValue === null) {
    return fallback;
  }
  return Math.min(maximum, Math.max(minimum, numberValue));
}

function formatNumber(value: number) {
  return Number(value.toFixed(4)).toString();
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
  if (stage.enabled !== true || !isVisualStageKind(stage.kind)) {
    return [];
  }

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
      if (channel === "green") {
        return ["colorchannelmixer=rr=0:rg=0:rb=0:gr=0:gg=1:gb=0:br=0:bg=0:bb=0"];
      }
      if (channel === "blue") {
        return ["colorchannelmixer=rr=0:rg=0:rb=0:gr=0:gg=0:gb=0:br=0:bg=0:bb=1"];
      }
      return ["colorchannelmixer=rr=1:rg=0:rb=0:gr=0:gg=0:gb=0:br=0:bg=0:bb=0"];
    }
    case "denoise": {
      const luma = formatNumber(clamp(params["luma"], 0, 20, 4));
      const chroma = formatNumber(clamp(params["chroma"], 0, 20, 3));
      return [`hqdn3d=${luma}:${chroma}:${luma}:${chroma}`];
    }
  }

  return [];
}

function compileAudioStage(stage: LaboratoryTransformStage): string[] {
  if (stage.enabled !== true || !isAudioStageKind(stage.kind)) {
    return [];
  }

  const params = stage.params;
  switch (stage.kind) {
    case "high-pass":
      return [`highpass=f=${formatNumber(clamp(params["hz"], 1, 20000, 80))}`];
    case "low-pass":
      return [`lowpass=f=${formatNumber(clamp(params["hz"], 1, 24000, 8000))}`];
    case "band-pass": {
      const lowHz = clamp(params["lowHz"], 1, 20000, 80);
      const requestedHighHz = clamp(params["highHz"], 2, 24000, 8000);
      const highHz = Math.min(24000, Math.max(lowHz + 1, requestedHighHz));
      return [
        `highpass=f=${formatNumber(lowHz)}`,
        `lowpass=f=${formatNumber(highHz)}`,
      ];
    }
    case "gain":
      return [`volume=${formatNumber(clamp(params["db"], -60, 30, 0))}dB`];
  }

  return [];
}

function appendFilterChain(command: string[], flag: "-vf" | "-af", filters: string[]) {
  if (filters.length === 0) {
    return command;
  }

  const nextCommand = [...command];
  const existingIndex = nextCommand.indexOf(flag);
  if (existingIndex >= 0 && existingIndex + 1 < nextCommand.length) {
    nextCommand[existingIndex + 1] = [nextCommand[existingIndex + 1], ...filters]
      .filter(Boolean)
      .join(",");
    return nextCommand;
  }

  const outputIndex = Math.max(0, nextCommand.length - 1);
  nextCommand.splice(outputIndex, 0, flag, filters.join(","));
  return nextCommand;
}

export function compileTransformStressTestFilters(projectValue: unknown): CompiledStressTestFilters {
  const project = toRecord(projectValue);
  const video = getVisualStages(project).flatMap(compileVisualStage);
  const audio = getAudioStages(project).flatMap(compileAudioStage);
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
  if (sourceKind === "video" || sourceKind === "image") {
    command = appendFilterChain(command, "-vf", compiled.video);
  }
  if (sourceKind === "audio" || (sourceKind === "video" && videoIncludesAudio)) {
    command = appendFilterChain(command, "-af", compiled.audio);
  }
  return command;
}
