import type {
  FateKnotsCardRequirement,
  FateKnotsPosition,
  FateKnotsRange,
  FateKnotsRow,
} from "./contracts.js";

export const FATE_KNOTS_ROWS = ["front", "rear"] as const;
export const FATE_KNOTS_RANGES = ["engaged", "near", "far"] as const;

export function isFateKnotsRow(value: unknown): value is FateKnotsRow {
  return value === "front" || value === "rear";
}

export function isFateKnotsRange(value: unknown): value is FateKnotsRange {
  return value === "engaged" || value === "near" || value === "far";
}

export function isFateKnotsPosition(value: unknown): value is FateKnotsPosition {
  if (typeof value !== "object" || value === null || Array.isArray(value)) return false;
  const record = value as Record<string, unknown>;
  return isFateKnotsRow(record["row"]) && isFateKnotsRange(record["range"]);
}

export function createFateKnotsPosition(
  row: FateKnotsRow,
  range: FateKnotsRange
): FateKnotsPosition {
  return { row, range };
}

/**
 * Applies only the dimensions explicitly supplied by a movement card.
 *
 * This helper deliberately does not invent adjacency, pathfinding, occupancy,
 * line-of-sight, or grid rules. A future rules layer may reject a transition,
 * but the V1 position primitive itself is only two small state dimensions.
 */
export function applyFateKnotsPositionPatch(
  current: FateKnotsPosition,
  patch: Partial<FateKnotsPosition>
): FateKnotsPosition {
  return {
    row: patch.row ?? current.row,
    range: patch.range ?? current.range,
  };
}

export function areFateKnotsPositionsEqual(
  left: FateKnotsPosition,
  right: FateKnotsPosition
): boolean {
  return left.row === right.row && left.range === right.range;
}

export function matchesFateKnotsActorPositionRequirement(
  position: FateKnotsPosition,
  requirement: FateKnotsCardRequirement
): boolean {
  if (requirement.rows && !requirement.rows.includes(position.row)) return false;
  if (requirement.ranges && !requirement.ranges.includes(position.range)) return false;
  return true;
}

export function matchesFateKnotsTargetPositionRequirement(
  position: FateKnotsPosition,
  requirement: FateKnotsCardRequirement
): boolean {
  if (requirement.targetRows && !requirement.targetRows.includes(position.row)) return false;
  if (requirement.targetRanges && !requirement.targetRanges.includes(position.range)) return false;
  return true;
}

/**
 * Useful for presentation/debug identities without exposing coordinates.
 */
export function getFateKnotsPositionKey(position: FateKnotsPosition): string {
  return `${position.row}:${position.range}`;
}
