function toRecord(value) {
  return value !== null && typeof value === "object" && Array.isArray(value) === false ? value : {};
}
function asNonEmptyString(value) {
  return typeof value === "string" && value.trim() !== "" ? value.trim() : null;
}
function asFiniteNumber(value) {
  const numericValue = Number(value);
  return Number.isFinite(numericValue) ? numericValue : null;
}
function normalizeStartEndRange(rawValue, startKey, endKey) {
  const source = toRecord(rawValue);
  const startValue = asFiniteNumber(source[startKey]);
  const endValue = asFiniteNumber(source[endKey]);
  if (startValue === null || endValue === null) {
    return null;
  }
  const start = Math.max(0, Math.round(Math.min(startValue, endValue)));
  const end = Math.max(start, Math.round(Math.max(startValue, endValue)));
  return { start, end };
}
export function normalizeAnalysisReference(rawValue) {
  const source = toRecord(rawValue);
  const timeRange = normalizeStartEndRange(source["timeRange"], "startMs", "endMs");
  const frameRange = normalizeStartEndRange(source["frameRange"], "startFrame", "endFrame");
  const regionSource = toRecord(source["region"]);
  const regionX = asFiniteNumber(regionSource["x"]);
  const regionY = asFiniteNumber(regionSource["y"]);
  const regionWidth = asFiniteNumber(regionSource["width"]);
  const regionHeight = asFiniteNumber(regionSource["height"]);
  const hasRegion = regionX !== null && regionY !== null && regionWidth !== null && regionHeight !== null;
  if (timeRange === null && frameRange === null && hasRegion !== true) {
    return null;
  }
  return {
    ...timeRange ? {
      timeRange: {
        startMs: timeRange.start,
        endMs: timeRange.end
      }
    } : {},
    ...frameRange ? {
      frameRange: {
        startFrame: frameRange.start,
        endFrame: frameRange.end
      }
    } : {},
    ...hasRegion ? {
      region: {
        x: Math.max(0, Math.round(regionX || 0)),
        y: Math.max(0, Math.round(regionY || 0)),
        width: Math.max(1, Math.round(regionWidth || 0)),
        height: Math.max(1, Math.round(regionHeight || 0))
      }
    } : {}
  };
}
export function normalizeAnalysisScope(rawValue) {
  const source = toRecord(rawValue);
  const reference = normalizeAnalysisReference(source);
  const focus = asNonEmptyString(source["focus"]);
  const hypothesis = asNonEmptyString(source["hypothesis"]);
  const lifecycleSource = toRecord(source["lifecycle"]);
  const lifecycle = Object.keys(lifecycleSource).length > 0 || hypothesis !== null || focus !== null || reference !== null ? {
    mutable: lifecycleSource["mutable"] !== false,
    processId: asNonEmptyString(lifecycleSource["processId"]),
    frozenAt: asNonEmptyString(lifecycleSource["frozenAt"])
  } : null;
  if (reference === null && hypothesis === null && focus === null && lifecycle === null) {
    return null;
  }
  return {
    ...reference || {},
    ...focus && (focus === "visual" || focus === "audio" || focus === "subtitle" || focus === "cross-modal") ? { focus } : {},
    ...hypothesis ? { hypothesis } : {},
    ...lifecycle ? { lifecycle } : {}
  };
}
export function freezeAnalysisScope(rawValue, processId, frozenAt = (/* @__PURE__ */ new Date()).toISOString()) {
  const normalized = normalizeAnalysisScope(rawValue);
  if (normalized === null) {
    return null;
  }
  return {
    ...normalized,
    lifecycle: {
      mutable: false,
      processId,
      frozenAt
    }
  };
}
export function serializeAnalysisScope(rawValue) {
  const normalized = normalizeAnalysisScope(rawValue);
  if (normalized === null) {
    return null;
  }
  return JSON.parse(JSON.stringify(normalized));
}
