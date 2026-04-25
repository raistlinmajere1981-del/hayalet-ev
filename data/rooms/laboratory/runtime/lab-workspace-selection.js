import { asLabRecord, asNonEmptyString, asNumber, createLabEventId } from "../models/lab-types.js";
export function normalizeWorkspaceTimelineRange(startMs, endMs) {
  const nextStart = typeof startMs === "number" && Number.isFinite(startMs) ? Math.max(0, Math.round(startMs)) : null;
  const nextEnd = typeof endMs === "number" && Number.isFinite(endMs) ? Math.max(0, Math.round(endMs)) : null;
  if (nextStart !== null && nextEnd !== null && nextEnd <= nextStart) {
    return {
      endMs: null,
      startMs: nextStart
    };
  }
  return {
    endMs: nextEnd,
    startMs: nextStart
  };
}
export function normalizeLabSelectionType(value) {
  switch (value) {
    case "clip":
    case "focus":
    case "inspect":
      return value;
    default:
      return "unknown";
  }
}
export function normalizeLabSelectionIntent(value, fallback = "general") {
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
export function normalizeLabSelectionRoi(value) {
  const record = asLabRecord(value);
  const x = asNumber(record["x"]);
  const y = asNumber(record["y"]);
  const width = asNumber(record["width"]);
  const height = asNumber(record["height"]);
  if (x === null || y === null || width === null || height === null || x < 0 || y < 0 || x >= 1 || y >= 1 || width <= 0 || height <= 0) {
    return void 0;
  }
  const clampedWidth = Math.min(1 - x, width);
  const clampedHeight = Math.min(1 - y, height);
  if (clampedWidth <= 0 || clampedHeight <= 0) {
    return void 0;
  }
  return {
    x,
    y,
    width: clampedWidth,
    height: clampedHeight
  };
}
function getSelectionSeedForRange(value, startMs, endMs) {
  const record = asLabRecord(value);
  const seedRange = normalizeWorkspaceTimelineRange(
    asNumber(record["startMs"]),
    asNumber(record["endMs"])
  );
  if (seedRange.startMs !== startMs || seedRange.endMs !== endMs) {
    return null;
  }
  const id = asNonEmptyString(record["id"]);
  const label = asNonEmptyString(record["label"]) || void 0;
  const roi = normalizeLabSelectionRoi(record["roi"]);
  const createdAt = asNumber(record["createdAt"]);
  return {
    ...id === null ? {} : { id },
    type: normalizeLabSelectionType(record["type"]),
    intent: normalizeLabSelectionIntent(record["intent"]),
    ...label === void 0 ? {} : { label },
    ...roi === void 0 ? {} : { roi },
    ...createdAt === null ? {} : { createdAt: Math.max(0, Math.round(createdAt)) }
  };
}
export function createActiveSelectionFromRange(startMs, endMs, previousSelection, options = {}) {
  if (startMs === null || endMs === null || endMs <= startMs) {
    return null;
  }
  const selectionSeed = getSelectionSeedForRange(options.persistedSelection, startMs, endMs);
  const nextType = previousSelection?.type || selectionSeed?.type || "clip";
  const nextIntent = normalizeLabSelectionIntent(
    previousSelection?.intent ?? selectionSeed?.intent
  );
  const nextLabel = previousSelection?.label ?? selectionSeed?.label;
  const previousSelectionMatchesRange = previousSelection?.startMs === startMs && previousSelection?.endMs === endMs;
  const nextRoi = previousSelectionMatchesRange ? previousSelection?.roi : selectionSeed?.roi;
  return {
    id: previousSelection?.id || selectionSeed?.id || createLabEventId("selection"),
    startMs,
    endMs,
    type: nextType === "unknown" ? "clip" : nextType,
    intent: nextIntent,
    ...nextLabel === void 0 ? {} : { label: nextLabel },
    ...nextRoi === void 0 ? {} : { roi: nextRoi },
    createdAt: previousSelection?.createdAt || selectionSeed?.createdAt || Math.max(0, Date.now())
  };
}
export function syncWorkspaceSelectionWithRange(workspace, range, options = {}) {
  return {
    ...workspace,
    timelineStartMs: range.startMs,
    timelineEndMs: range.endMs,
    activeSelection: createActiveSelectionFromRange(
      range.startMs,
      range.endMs,
      workspace.activeSelection,
      options
    )
  };
}
export function clearWorkspaceSelection(workspace) {
  return {
    ...workspace,
    timelineStartMs: null,
    timelineEndMs: null,
    activeSelection: null
  };
}
export function getWorkspaceSourceSelectionResetKey(source) {
  const sourceRecord = asLabRecord(source);
  return JSON.stringify({
    kind: asNonEmptyString(sourceRecord["kind"]),
    mode: asNonEmptyString(sourceRecord["mode"]),
    storedPath: asNonEmptyString(sourceRecord["storedPath"]),
    sourceAssetId: asNonEmptyString(sourceRecord["sourceAssetId"]),
    sourceUrl: asNonEmptyString(sourceRecord["sourceUrl"]),
    storedFileName: asNonEmptyString(sourceRecord["storedFileName"])
  });
}
