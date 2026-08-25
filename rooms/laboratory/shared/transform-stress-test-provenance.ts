import { normalizeLaboratoryTransformStages } from "./transform-stress-test-model.js";

type LaboratoryRecord = Record<string, unknown>;

type LaboratoryTransformSourceKind = "video" | "audio" | "image";

function toRecord(value: unknown): LaboratoryRecord {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as LaboratoryRecord)
    : {};
}

function cloneSerializableRecord(value: unknown): LaboratoryRecord {
  try {
    return JSON.parse(JSON.stringify(toRecord(value))) as LaboratoryRecord;
  } catch {
    return {};
  }
}

export function buildLaboratoryTransformStackProvenanceFromRecipe(
  recipeValue: unknown,
  sourceKind: LaboratoryTransformSourceKind
) {
  const recipe = toRecord(recipeValue);
  const visualSection =
    sourceKind === "image" ? toRecord(recipe["image"]) : toRecord(recipe["video"]);
  const audioSection = toRecord(recipe["audio"]);
  const visual =
    sourceKind === "audio"
      ? []
      : normalizeLaboratoryTransformStages(visualSection["transformStages"], "visual");
  const audio = normalizeLaboratoryTransformStages(audioSection["transformStages"], "audio");

  return {
    sourceKind,
    visual: visual.map((stage, index) => ({
      ...stage,
      params: cloneSerializableRecord(stage.params),
      order: index,
    })),
    audio: audio.map((stage, index) => ({
      ...stage,
      params: cloneSerializableRecord(stage.params),
      order: index,
    })),
  };
}

export function cloneLaboratoryEditRecipeSnapshot(recipeValue: unknown) {
  return cloneSerializableRecord(recipeValue);
}
