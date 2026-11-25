import { validCalibration, yaw360, type Calibration, type V2 } from "../../spatial/world.ts";

type NumberField = number | undefined;

export interface CalibrationDraft {
  points: V2[];
  distanceM: NumberField;
  anchor: [NumberField, NumberField, NumberField];
  bearingDeg: NumberField;
  view: "pixels" | "plan" | "anchor";
}

export function calibrationDraft(calibration?: Calibration): CalibrationDraft {
  return {
    points: calibration?.pixels.map(([u, v]) => [u, v]) ?? [],
    distanceM: calibration?.distanceM,
    anchor: calibration ? [...calibration.anchor] : [0, 0, 0],
    bearingDeg: calibration?.bearingDeg ?? 0,
    view: "pixels",
  };
}

export function calibrationValue(draft: CalibrationDraft | undefined, pixels: V2 | undefined) {
  if (
    !draft ||
    draft.points.length !== 2 ||
    draft.distanceM === undefined ||
    draft.bearingDeg === undefined
  )
    return undefined;
  const [x, y, z] = draft.anchor;
  if (x === undefined || y === undefined || z === undefined) return undefined;
  const value: Calibration = {
    pixels: [[...draft.points[0]!], [...draft.points[1]!]],
    distanceM: draft.distanceM,
    anchor: [x, y, z],
    bearingDeg: yaw360(draft.bearingDeg),
  };
  return validCalibration(value, pixels) ? value : undefined;
}

export type CalibrationMark =
  { ok: true; points: V2[] } | { ok: false; reason: "outside" | "coincident" };

// Pixel calibration accepts at most two points: the first two marks form the pair and further
// marks restart the pair. A duplicate second mark is rejected so the scale never becomes zero.
export function markCalibrationPoint(
  points: V2[],
  pixels: V2 | undefined,
  point: V2
): CalibrationMark {
  const [u, v] = point;
  if (!pixels || u < 0 || v < 0 || u > pixels[0] || v > pixels[1])
    return { ok: false, reason: "outside" };
  const first = points[0];
  if (points.length === 1 && first?.[0] === u && first[1] === v)
    return { ok: false, reason: "coincident" };
  return { ok: true, points: points.length === 1 ? [first!, point] : [point] };
}
