type RecordValue = Record<string, unknown>;

type NormalizedRoi = {
  height: number;
  width: number;
  x: number;
  y: number;
};

const NEUTRAL_AXIS_VALUE: Record<string, number> = {
  exposure: 0,
  gamma: 1,
  brightness: 0,
  "black-level": 0,
  contrast: 1,
  "local-contrast": 0,
  blur: 0,
  denoise: 0,
  sharpen: 0,
};

function record(value: unknown): RecordValue {
  return value !== null && typeof value === "object" && !Array.isArray(value)
    ? (value as RecordValue)
    : {};
}

function finite(value: unknown) {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function clamp01(value: number) {
  return Math.max(0, Math.min(1, value));
}

function metric(entry: RecordValue, key: string) {
  return finite(entry[key]) ?? 0;
}

function normalizeRoi(value: unknown): NormalizedRoi | null {
  const source = record(value);
  const x = finite(source["x"]);
  const y = finite(source["y"]);
  const width = finite(source["width"]);
  const height = finite(source["height"]);
  if (x === null || y === null || width === null || height === null || width <= 0 || height <= 0) {
    return null;
  }
  return { x, y, width, height };
}

function similarity(delta: number, tolerance: number) {
  return clamp01(1 - Math.abs(delta) / tolerance);
}

function range(values: number[]) {
  return values.length === 0 ? 0 : Math.max(...values) - Math.min(...values);
}

function findBaselinePoint(points: RecordValue[], axis: string) {
  const neutral = NEUTRAL_AXIS_VALUE[axis] ?? 0;
  return points.reduce<RecordValue | null>(function (best, point) {
    const pointValue = finite(point["value"]);
    if (pointValue === null) return best;
    if (best === null) return point;
    const bestValue = finite(best["value"]);
    if (bestValue === null) return point;
    return Math.abs(pointValue - neutral) < Math.abs(bestValue - neutral) ? point : best;
  }, null);
}

function buildComparability(
  target: RecordValue,
  background: RecordValue,
  targetRoi: NormalizedRoi | null,
  backgroundRoi: NormalizedRoi | null
) {
  const targetArea = targetRoi === null ? 0 : targetRoi.width * targetRoi.height;
  const backgroundArea = backgroundRoi === null ? 0 : backgroundRoi.width * backgroundRoi.height;
  const roiAreaRatio =
    targetArea > 0 && backgroundArea > 0
      ? Math.min(targetArea, backgroundArea) / Math.max(targetArea, backgroundArea)
      : 0;
  const lumaDelta = metric(target, "meanLuma") - metric(background, "meanLuma");
  const spreadDelta = metric(target, "lumaSpread") - metric(background, "lumaSpread");
  const edgeDelta = metric(target, "edgeEnergy") - metric(background, "edgeEnergy");
  const temporalDelta =
    metric(target, "temporalPersistence") - metric(background, "temporalPersistence");
  const chromaDelta = metric(target, "chromaDistance") - metric(background, "chromaDistance");
  const backgroundSpread = metric(background, "lumaSpread");
  const areaSimilarity = clamp01(roiAreaRatio / 0.5);
  const backgroundHomogeneity = clamp01(1 - Math.max(0, backgroundSpread - 0.35) / 0.4);
  const weightedScore =
    areaSimilarity * 0.25 +
    similarity(lumaDelta, 0.35) * 0.2 +
    similarity(spreadDelta, 0.35) * 0.15 +
    similarity(edgeDelta, 0.15) * 0.15 +
    similarity(temporalDelta, 0.3) * 0.1 +
    similarity(chromaDelta, 0.15) * 0.05 +
    backgroundHomogeneity * 0.1;
  const score = roiAreaRatio < 0.25 ? Math.min(weightedScore, 0.49) : weightedScore;
  const status = score >= 0.75 ? "high" : score >= 0.55 ? "moderate" : "low";
  return {
    status,
    score,
    roiAreaRatio,
    baselineMeanLumaDelta: lumaDelta,
    baselineLumaSpreadDelta: spreadDelta,
    baselineEdgeEnergyDelta: edgeDelta,
    baselineTemporalPersistenceDelta: temporalDelta,
    baselineChromaDelta: chromaDelta,
    backgroundLumaSpread: backgroundSpread,
  };
}

export function buildLaboratoryVisualResponseReportAssessment(value: unknown) {
  const entry = record(value);
  const request = record(entry["request"]);
  const temporalRequest = record(request["temporalRequest"]);
  const axis = typeof request["axis"] === "string" ? request["axis"] : "response";
  const points = Array.isArray(entry["points"])
    ? entry["points"].map(function (point) {
        return record(point);
      })
    : [];
  if (points.length < 3) {
    return {
      dataQuality: "insufficient",
      classification: "sample-insufficient",
      sensorCompatibility: "unknown",
    };
  }

  const baselinePoint = findBaselinePoint(points, axis) ?? points[Math.floor(points.length / 2)] ?? {};
  const baselineTarget = record(baselinePoint["target"]);
  const baselineBackground = record(baselinePoint["background"]);
  const comparability = buildComparability(
    baselineTarget,
    baselineBackground,
    normalizeRoi(temporalRequest["roi"]),
    normalizeRoi(request["backgroundRoi"])
  );

  const visibilityDeltas = points.map(function (point) {
    return metric(record(point["differential"]), "visibilityScore");
  });
  const visibilityRange = range(visibilityDeltas);
  const center = Math.abs(visibilityDeltas[Math.floor(visibilityDeltas.length / 2)] ?? 0);
  const localized = Math.max(...visibilityDeltas.map(Math.abs));
  const edgeRange = range(
    points.map(function (point) {
      return metric(record(point["differential"]), "edgeEnergy");
    })
  );
  const recoveredDarkRange = range(
    points.map(function (point) {
      return metric(record(point["differential"]), "recoveredDarkFraction");
    })
  );
  const temporalRange = range(
    points.map(function (point) {
      return metric(record(point["differential"]), "temporalPersistence");
    })
  );
  const chromaRange = range(
    points.map(function (point) {
      return metric(record(point["differential"]), "chromaDistance");
    })
  );
  const supportingMetricCount = [
    edgeRange >= 0.04,
    recoveredDarkRange >= 0.08,
    temporalRange >= 0.08,
    chromaRange >= 0.05,
  ].filter(Boolean).length;
  const sensorAxis = ["exposure", "gamma", "brightness", "black-level", "denoise"].includes(axis);
  const classification =
    comparability.status === "low"
      ? "background-not-comparable"
      : localized < 0.08
        ? "target-and-background-change-together"
        : visibilityRange < 0.12 && center < 0.12
          ? "physical-environment-like-response"
          : visibilityRange >= 0.22 && supportingMetricCount >= 2
            ? "target-response-differs"
            : visibilityRange >= 0.16 && supportingMetricCount <= 1
              ? "visibility-only-separation"
              : "result-uncertain";

  return {
    dataQuality: comparability.status === "low" ? "limited-by-background-comparability" : "sufficient",
    classification,
    sensorCompatibility:
      comparability.status === "low"
        ? "not-assessed"
        : sensorAxis && visibilityRange < 0.14
          ? "low-light-sensor-compatible"
          : sensorAxis && visibilityRange >= 0.22 && supportingMetricCount >= 2
            ? "not-explained-by-global-sensor-response-alone"
            : "not-assessed",
    differentialVisibilityRange: visibilityRange,
    peakLocalizedDifference: localized,
    comparability,
    corroboration: {
      supportingMetricCount,
      edgeRange,
      recoveredDarkRange,
      temporalRange,
      chromaRange,
    },
  };
}
