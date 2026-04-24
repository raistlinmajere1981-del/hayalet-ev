import {
  asLabRecord,
  asNonEmptyString,
  asNumber,
  createLabEventId,
} from "../models/lab-types.js";
import type {
  LabSelection,
  LabSelectionIntent,
  LabSelectionType,
  LabWorkspaceUiState,
} from "../models/lab-types.js";

export function normalizeWorkspaceTimelineRange(
  startMs: number | null | undefined,
  endMs: number | null | undefined
) {
  const nextStart =
    typeof startMs === "number" && Number.isFinite(startMs)
      ? Math.max(0, Math.round(startMs))
      : null;
  const nextEnd =
    typeof endMs === "number" && Number.isFinite(endMs) ? Math.max(0, Math.round(endMs)) : null;
  if (nextStart !== null && nextEnd !== null && nextEnd <= nextStart) {
    return {
      endMs: null,
      startMs: nextStart,
    };
  }
  return {
    endMs: nextEnd,
    startMs: nextStart,
  };
}

export function normalizeLabSelectionType(value: unknown): LabSelectionType {
  switch (value) {
    case "clip":
    case "focus":
    case "inspect":
      return value;
    default:
      return "unknown";
  }
}

export function normalizeLabSelectionIntent(
  value: unknown,
  fallback: LabSelectionIntent = "general"
): LabSelectionIntent {
  switch (value) {
    case "anomaly":
    case "motion":
    case "audio":
    case "visual":
    case "general":
      return value;
    default:
      return fallback;
  }
}

function normalizeSelectionRoi(value: unknown): LabSelection["roi"] | undefined {
  const record = asLabRecord(value);
  const x = asNumber(record["x"]);
  const y = asNumber(record["y"]);
  const width = asNumber(record["width"]);
  const height = asNumber(record["height"]);
  if (x === null || y === null || width === null || height === null || width <= 0 || height <= 0) {
    return undefined;
  }
  return {
    x,
    y,
    width,
    height,
  };
}

function getSelectionSeedForRange(
  value: unknown,
  startMs: number,
  endMs: number
): Partial<LabSelection> | null {
  const record = asLabRecord(value);
  const seedRange = normalizeWorkspaceTimelineRange(
    asNumber(record["startMs"]),
    asNumber(record["endMs"])
  );
  if (seedRange.startMs !== startMs || seedRange.endMs !== endMs) {
    return null;
  }

  const id = asNonEmptyString(record["id"]);
  const label = asNonEmptyString(record["label"]) || undefined;
  const roi = normalizeSelectionRoi(record["roi"]);
  const createdAt = asNumber(record["createdAt"]);

  return {
    ...(id === null ? {} : { id }),
    type: normalizeLabSelectionType(record["type"]),
    intent: normalizeLabSelectionIntent(record["intent"]),
    ...(label === undefined ? {} : { label }),
    ...(roi === undefined ? {} : { roi }),
    ...(createdAt === null ? {} : { createdAt: Math.max(0, Math.round(createdAt)) }),
  };
}

export function createActiveSelectionFromRange(
  startMs: number | null,
  endMs: number | null,
  previousSelection: LabSelection | null,
  options: {
    persistedSelection?: unknown;
  } = {}
): LabSelection | null {
  if (startMs === null || endMs === null || endMs <= startMs) {
    return null;
  }

  const selectionSeed = getSelectionSeedForRange(options.persistedSelection, startMs, endMs);
  const nextType = previousSelection?.type || selectionSeed?.type || "clip";
  const nextIntent = normalizeLabSelectionIntent(previousSelection?.intent ?? selectionSeed?.intent);
  const nextLabel = previousSelection?.label ?? selectionSeed?.label;
  const nextRoi = previousSelection?.roi ?? selectionSeed?.roi;

  return {
    id: previousSelection?.id || selectionSeed?.id || createLabEventId("selection"),
    startMs,
    endMs,
    type: nextType === "unknown" ? "clip" : nextType,
    intent: nextIntent,
    ...(nextLabel === undefined ? {} : { label: nextLabel }),
    ...(nextRoi === undefined ? {} : { roi: nextRoi }),
    createdAt: previousSelection?.createdAt || selectionSeed?.createdAt || Math.max(0, Date.now()),
  };
}

export function syncWorkspaceSelectionWithRange(
  workspace: LabWorkspaceUiState,
  range: { startMs: number | null; endMs: number | null },
  options: {
    persistedSelection?: unknown;
  } = {}
): LabWorkspaceUiState {
  return {
    ...workspace,
    timelineStartMs: range.startMs,
    timelineEndMs: range.endMs,
    activeSelection: createActiveSelectionFromRange(
      range.startMs,
      range.endMs,
      workspace.activeSelection,
      options
    ),
  };
}

export function clearWorkspaceSelection(workspace: LabWorkspaceUiState): LabWorkspaceUiState {
  return {
    ...workspace,
    timelineStartMs: null,
    timelineEndMs: null,
    activeSelection: null,
  };
}

export function getWorkspaceSourceSelectionResetKey(source: Record<string, unknown> | null) {
  const sourceRecord = asLabRecord(source);
  return JSON.stringify({
    kind: asNonEmptyString(sourceRecord["kind"]),
    mode: asNonEmptyString(sourceRecord["mode"]),
    storedPath: asNonEmptyString(sourceRecord["storedPath"]),
    sourceAssetId: asNonEmptyString(sourceRecord["sourceAssetId"]),
    sourceUrl: asNonEmptyString(sourceRecord["sourceUrl"]),
    storedFileName: asNonEmptyString(sourceRecord["storedFileName"]),
  });
}
