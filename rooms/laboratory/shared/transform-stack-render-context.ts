import type { LabEditConfig, LabFeatureId } from "../domain/lab-types.js";
import type { LaboratoryTemporalStressTestRequest } from "./temporal-stress-test-model.js";

export type LaboratoryTransformStackSourceKind = "video" | "audio" | "image";
export type LaboratoryTransformPreviewMode = "source" | "transform" | "difference";

export type LaboratoryTransformStackRenderContext = {
  baselinePreviewUrl?: string | null | undefined;
  differencePreviewUrl?: string | null | undefined;
  editConfig: LabEditConfig | null;
  featureId: LabFeatureId;
  locked: boolean;
  previewStatus?: string | undefined;
  sourceKind: LaboratoryTransformStackSourceKind | null;
  sourcePreviewUrl?: string | null | undefined;
  temporalRequest?: LaboratoryTemporalStressTestRequest | null | undefined;
  transformPreviewMode?: LaboratoryTransformPreviewMode | undefined;
  transformPreviewUrl?: string | null | undefined;
};

const LAB_TRANSFORM_STACK_RENDER_CONTEXT = Symbol("laboratory-transform-stack-render-context");

type LaboratoryTransformStackRenderCarrier = {
  [LAB_TRANSFORM_STACK_RENDER_CONTEXT]?: LaboratoryTransformStackRenderContext;
};

export function attachLaboratoryTransformStackRenderContext<T extends object>(
  value: T,
  context: LaboratoryTransformStackRenderContext
): T {
  Object.defineProperty(value, LAB_TRANSFORM_STACK_RENDER_CONTEXT, {
    configurable: true,
    enumerable: false,
    value: context,
    writable: false,
  });
  return value;
}

export function readLaboratoryTransformStackRenderContext(
  value: unknown
): LaboratoryTransformStackRenderContext | null {
  if (value === null || typeof value !== "object") {
    return null;
  }
  return (
    (value as LaboratoryTransformStackRenderCarrier)[LAB_TRANSFORM_STACK_RENDER_CONTEXT] || null
  );
}
