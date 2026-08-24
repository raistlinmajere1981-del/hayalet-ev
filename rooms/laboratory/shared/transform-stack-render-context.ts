import type { LabEditConfig, LabFeatureId } from "../domain/lab-types.js";

export type LaboratoryTransformStackSourceKind = "video" | "audio" | "image";
export type LaboratoryTransformPreviewMode = "source" | "transform" | "difference";

export type LaboratoryTransformStackRenderContext = {
  baselinePreviewUrl: string | null;
  differencePreviewUrl: string | null;
  editConfig: LabEditConfig | null;
  featureId: LabFeatureId;
  locked: boolean;
  previewStatus: string;
  sourceKind: LaboratoryTransformStackSourceKind | null;
  sourcePreviewUrl: string | null;
  transformPreviewMode: LaboratoryTransformPreviewMode;
  transformPreviewUrl: string | null;
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
