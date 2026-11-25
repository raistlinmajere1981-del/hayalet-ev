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
