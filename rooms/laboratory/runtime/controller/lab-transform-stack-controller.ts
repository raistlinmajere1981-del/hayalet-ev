import { asLabRecord } from "../../domain/lab-types.js";
import type { LabEditConfig } from "../../domain/lab-types.js";
import {
  isLaboratoryTransformStageKind,
  mutateLaboratoryTransformStages,
  normalizeLaboratoryTransformStages,
} from "../../shared/transform-stress-test-model.js";
import type {
  LaboratoryTransformStageKind,
  LaboratoryTransformStageMutation,
  LaboratoryTransformStageScope,
} from "../../shared/transform-stress-test-model.js";
import { buildLaboratoryTransformStackProvenanceFromRecipe } from "../../shared/transform-stress-test-provenance.js";

type LaboratoryTransformSourceKind = "video" | "audio" | "image";

export type LaboratoryTransformStackMutationRequest =
  | { type: "add"; kind: string }
  | { type: "remove"; stageId: string }
  | { type: "move"; stageId: string; direction: "up" | "down" }
  | { type: "enabled"; stageId: string; enabled: boolean }
  | { type: "parameter"; stageId: string; parameterId: string; value: unknown };

type BuildTransformStageRecipePatchInput = {
  editConfig: LabEditConfig | null;
  sourceKind: LaboratoryTransformSourceKind;
  scope: LaboratoryTransformStageScope;
  mutation: LaboratoryTransformStackMutationRequest;
};

export function getLaboratoryTransformRecipeSection(
  sourceKind: LaboratoryTransformSourceKind,
  scope: LaboratoryTransformStageScope
): "video" | "audio" | "image" {
  if (scope === "audio") {
    return "audio";
  }
  return sourceKind === "image" ? "image" : "video";
}

function readLaboratoryTransformRecipeStages(
  editConfig: LabEditConfig | null,
  sourceKind: LaboratoryTransformSourceKind,
  scope: LaboratoryTransformStageScope
) {
  const recipe = asLabRecord(editConfig?.recipe);
  const sectionId = getLaboratoryTransformRecipeSection(sourceKind, scope);
  return normalizeLaboratoryTransformStages(
    asLabRecord(recipe[sectionId])["transformStages"],
    scope
  );
}

function normalizeMutation(
  scope: LaboratoryTransformStageScope,
  mutation: LaboratoryTransformStackMutationRequest
): LaboratoryTransformStageMutation | null {
  if (mutation.type === "add") {
    if (!isLaboratoryTransformStageKind(mutation.kind, scope)) {
      return null;
    }
    return { type: "add", kind: mutation.kind as LaboratoryTransformStageKind };
  }
  if (mutation.type === "remove") {
    return mutation.stageId.trim() === "" ? null : mutation;
  }
  if (mutation.type === "move") {
    return mutation.stageId.trim() === "" ? null : mutation;
  }
  if (mutation.type === "enabled") {
    return mutation.stageId.trim() === "" ? null : mutation;
  }
  if (mutation.stageId.trim() === "" || mutation.parameterId.trim() === "") {
    return null;
  }
  return mutation;
}

export function buildLaboratoryTransformStageRecipePatch(
  input: BuildTransformStageRecipePatchInput
): Record<string, unknown> | null {
  const mutation = normalizeMutation(input.scope, input.mutation);
  if (mutation === null) {
    return null;
  }
  const sectionId = getLaboratoryTransformRecipeSection(input.sourceKind, input.scope);
  const currentStages = readLaboratoryTransformRecipeStages(
    input.editConfig,
    input.sourceKind,
    input.scope
  );
  const transformStages = mutateLaboratoryTransformStages(currentStages, input.scope, mutation);
  return {
    [sectionId]: {
      transformStages,
    },
  };
}

export function buildLaboratoryTransformStackProvenance(
  editConfig: LabEditConfig | null,
  sourceKind: LaboratoryTransformSourceKind
) {
  return buildLaboratoryTransformStackProvenanceFromRecipe(
    asLabRecord(editConfig?.recipe),
    sourceKind
  );
}
