import { normalizeLaboratoryTemporalStressTestRequest } from "./temporal-stress-test-model.js";
import type { LaboratoryTemporalStressTestRequest } from "./temporal-stress-test-model.js";

export type LaboratoryResponseSweepAxis =
  | "exposure"
  | "gamma"
  | "brightness"
  | "black-level"
  | "contrast"
  | "local-contrast"
  | "blur"
  | "denoise"
  | "sharpen";

export type LaboratoryNormalizedRoi = NonNullable<LaboratoryTemporalStressTestRequest["roi"]>;

export type LaboratoryVisualResponseProbeRequest = {
  axis: LaboratoryResponseSweepAxis;
  temporalRequest: LaboratoryTemporalStressTestRequest;
  backgroundRoi: LaboratoryNormalizedRoi;
};

export const LAB_RESPONSE_SWEEP_AXES: readonly LaboratoryResponseSweepAxis[] = [
  "exposure",
  "gamma",
  "brightness",
  "black-level",
  "contrast",
  "local-contrast",
  "blur",
  "denoise",
  "sharpen",
];

const AXIS_VALUES: Record<LaboratoryResponseSweepAxis, readonly number[]> = {
  exposure: [-3, -2, -1, 0, 1, 2, 3],
  gamma: [0.45, 0.65, 0.85, 1, 1.25, 1.6, 2.2],
  brightness: [-0.3, -0.2, -0.1, 0, 0.1, 0.2, 0.3],
  "black-level": [0, 0.02, 0.04, 0.06, 0.1, 0.14, 0.2],
  contrast: [0.5, 0.7, 0.85, 1, 1.2, 1.5, 2],
  "local-contrast": [0, 0.35, 0.7, 1, 1.4, 1.8, 2.4],
  blur: [0, 0.5, 1, 2, 3, 5, 8],
  denoise: [0, 1.5, 3, 4.5, 6, 9, 12],
  sharpen: [0, 0.35, 0.7, 1, 1.4, 2, 3],
};

function toRecord(value: unknown): Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function finite(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function normalizeRoi(value: unknown): LaboratoryNormalizedRoi | null {
  const record = toRecord(value);
  const x = finite(record["x"]);
  const y = finite(record["y"]);
  const width = finite(record["width"]);
  const height = finite(record["height"]);
  if (x === null || y === null || width === null || height === null) return null;
  if (width <= 0 || height <= 0 || x < 0 || y < 0 || x + width > 1 || y + height > 1) return null;
  return { x, y, width, height };
}

export function isLaboratoryResponseSweepAxis(
  value: unknown
): value is LaboratoryResponseSweepAxis {
  return LAB_RESPONSE_SWEEP_AXES.includes(value as LaboratoryResponseSweepAxis);
}

export function getLaboratoryResponseSweepValues(axis: LaboratoryResponseSweepAxis) {
  return [...AXIS_VALUES[axis]];
}

export function normalizeLaboratoryVisualResponseProbeRequest(
  value: unknown,
  sourceDurationSeconds: number | null = null
): LaboratoryVisualResponseProbeRequest | null {
  const record = toRecord(value);
  if (!isLaboratoryResponseSweepAxis(record["axis"])) return null;
  const temporalRequest = normalizeLaboratoryTemporalStressTestRequest(
    record["temporalRequest"],
    sourceDurationSeconds
  );
  const backgroundRoi = normalizeRoi(record["backgroundRoi"]);
  if (temporalRequest === null || temporalRequest.roi === null || backgroundRoi === null)
    return null;
  return { axis: record["axis"], temporalRequest, backgroundRoi };
}

export function normalizeLaboratoryResponseBackgroundRoi(value: unknown) {
  return normalizeRoi(value);
}
