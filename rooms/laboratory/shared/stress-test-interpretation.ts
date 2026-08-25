type LaboratoryRecord = Record<string, unknown>;
type LaboratoryChangeMagnitude = "negligible" | "small" | "moderate" | "strong";
type LaboratoryChangeDirection = "decrease" | "stable" | "increase";
type LaboratoryInterpretationDataQuality = "sufficient" | "insufficient" | "unknown";

type LaboratoryControlInterpretationEvidence = {
  baselineSummary?: unknown;
  injectedSummary?: unknown;
};

export type LaboratoryMetricChangeInterpretation = {
  direction: LaboratoryChangeDirection;
  magnitude: LaboratoryChangeMagnitude;
  value: number | null;
};

export type LaboratoryTemporalSummaryInterpretation = {
  schemaVersion: 1;
  kind: "temporal-baseline";
  dataQuality: "sufficient" | "insufficient";
  frameActivity: "very-low" | "low" | "moderate" | "high";
  edgePersistence: "low" | "intermittent" | "persistent";
  luminanceVariation: "stable" | "mild" | "variable";
  chromaVariation: "stable" | "mild" | "variable";
};

export type LaboratoryControlSummaryInterpretation = {
  schemaVersion: 1;
  kind: "control-injection";
  dataQuality: LaboratoryInterpretationDataQuality;
  overallImpact: LaboratoryChangeMagnitude;
  frameDifference: LaboratoryMetricChangeInterpretation;
  edgePersistence: LaboratoryMetricChangeInterpretation;
  edgeEnergy: LaboratoryMetricChangeInterpretation;
  luminanceRange: LaboratoryMetricChangeInterpretation;
  chromaRange: LaboratoryMetricChangeInterpretation;
};

function toRecord(value: unknown): LaboratoryRecord {
  return value !== null && typeof value === "object" && Array.isArray(value) === false
    ? (value as LaboratoryRecord)
    : {};
}

function readFiniteNumber(record: LaboratoryRecord, key: string): number | null {
  const value = record[key];
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function readEdgePersistence(record: LaboratoryRecord) {
  return (
    readFiniteNumber(record, "spatialEdgePersistenceRatio") ??
    readFiniteNumber(record, "edgePersistenceRatio")
  );
}

function hasTemporalSamples(value: unknown) {
  const summary = toRecord(value);
  const spatialSampleCount = readFiniteNumber(summary, "edgePersistenceSampleCount");
  return (
    (readFiniteNumber(summary, "sampleCount") ?? 0) > 0 &&
    (readFiniteNumber(summary, "frameDifferenceSampleCount") ?? 0) > 0 &&
    (readFiniteNumber(summary, "edgeSampleCount") ?? 0) > 0 &&
    (spatialSampleCount === null || spatialSampleCount > 0)
  );
}

function rankMagnitude(value: LaboratoryChangeMagnitude) {
  if (value === "strong") return 3;
  if (value === "moderate") return 2;
  if (value === "small") return 1;
  return 0;
}

function magnitudeFromRank(rank: number): LaboratoryChangeMagnitude {
  if (rank >= 3) return "strong";
  if (rank === 2) return "moderate";
  if (rank === 1) return "small";
  return "negligible";
}

function interpretDelta(
  value: number | null,
  thresholds: readonly [number, number, number]
): LaboratoryMetricChangeInterpretation {
  if (value === null) {
    return { direction: "stable", magnitude: "negligible", value: null };
  }
  const absolute = Math.abs(value);
  const magnitude: LaboratoryChangeMagnitude =
    absolute < thresholds[0]
      ? "negligible"
      : absolute < thresholds[1]
        ? "small"
        : absolute < thresholds[2]
          ? "moderate"
          : "strong";
  return {
    direction: magnitude === "negligible" ? "stable" : value > 0 ? "increase" : "decrease",
    magnitude,
    value,
  };
}

export function interpretLaboratoryTemporalSummary(
  value: unknown
): LaboratoryTemporalSummaryInterpretation {
  const summary = toRecord(value);
  const meanFrameDifference = Math.max(
    0,
    readFiniteNumber(summary, "meanFrameDifferenceEnergy") ?? 0
  );
  const edgePersistenceRatio = Math.max(0, Math.min(1, readEdgePersistence(summary) ?? 0));
  const lumaRange = Math.max(0, readFiniteNumber(summary, "lumaRange") ?? 0);
  const chromaRange = Math.max(
    Math.max(0, readFiniteNumber(summary, "chromaURange") ?? 0),
    Math.max(0, readFiniteNumber(summary, "chromaVRange") ?? 0)
  );

  return {
    schemaVersion: 1,
    kind: "temporal-baseline",
    dataQuality: hasTemporalSamples(summary) ? "sufficient" : "insufficient",
    frameActivity:
      meanFrameDifference < 0.003
        ? "very-low"
        : meanFrameDifference < 0.01
          ? "low"
          : meanFrameDifference < 0.03
            ? "moderate"
            : "high",
    edgePersistence:
      edgePersistenceRatio < 0.1
        ? "low"
        : edgePersistenceRatio < 0.6
          ? "intermittent"
          : "persistent",
    luminanceVariation: lumaRange < 0.01 ? "stable" : lumaRange < 0.05 ? "mild" : "variable",
    chromaVariation: chromaRange < 0.01 ? "stable" : chromaRange < 0.05 ? "mild" : "variable",
  };
}

export function interpretLaboratoryControlDelta(
  value: unknown,
  evidence?: LaboratoryControlInterpretationEvidence
): LaboratoryControlSummaryInterpretation {
  const delta = toRecord(value);
  const frameDifference = interpretDelta(
    readFiniteNumber(delta, "meanFrameDifferenceEnergy"),
    [0.003, 0.01, 0.03]
  );
  const edgePersistence = interpretDelta(readEdgePersistence(delta), [0.03, 0.12, 0.3]);
  const edgeEnergy = interpretDelta(readFiniteNumber(delta, "meanEdgeEnergy"), [0.003, 0.01, 0.03]);
  const luminanceRange = interpretDelta(readFiniteNumber(delta, "lumaRange"), [0.005, 0.02, 0.06]);
  const chromaMagnitude = Math.max(
    Math.abs(readFiniteNumber(delta, "chromaURange") ?? 0),
    Math.abs(readFiniteNumber(delta, "chromaVRange") ?? 0)
  );
  const chromaSignedSource =
    Math.abs(readFiniteNumber(delta, "chromaURange") ?? 0) >=
    Math.abs(readFiniteNumber(delta, "chromaVRange") ?? 0)
      ? readFiniteNumber(delta, "chromaURange")
      : readFiniteNumber(delta, "chromaVRange");
  const chromaRange = interpretDelta(
    chromaSignedSource === null ? null : Math.sign(chromaSignedSource) * chromaMagnitude,
    [0.005, 0.02, 0.06]
  );
  const overallImpact = magnitudeFromRank(
    Math.max(
      rankMagnitude(frameDifference.magnitude),
      rankMagnitude(edgePersistence.magnitude),
      rankMagnitude(edgeEnergy.magnitude),
      rankMagnitude(luminanceRange.magnitude),
      rankMagnitude(chromaRange.magnitude)
    )
  );
  const dataQuality: LaboratoryInterpretationDataQuality =
    evidence === undefined
      ? "unknown"
      : hasTemporalSamples(evidence.baselineSummary) && hasTemporalSamples(evidence.injectedSummary)
        ? "sufficient"
        : "insufficient";

  return {
    schemaVersion: 1,
    kind: "control-injection",
    dataQuality,
    overallImpact,
    frameDifference,
    edgePersistence,
    edgeEnergy,
    luminanceRange,
    chromaRange,
  };
}
