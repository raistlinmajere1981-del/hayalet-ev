export type NormalizedRoi = {
  height: number;
  width: number;
  x: number;
  y: number;
};

export type TrackingQuality = "high" | "medium" | "low" | "unreliable";

export type CameraTrackingMode =
  "global-feature-similarity" | "reference-feature-similarity" | "fixed-roi-fallback";

export type AnalysisCoordinateMode = "fixed-roi" | "camera-similarity" | "fixed-roi-fallback";

export type VisualResponseSweepAxis =
  | "exposure"
  | "gamma"
  | "brightness"
  | "black-level"
  | "contrast"
  | "local-contrast"
  | "blur"
  | "denoise"
  | "sharpen";

export type CameraSimilarityTransform = {
  dx: number;
  dy: number;
  rotationDegrees: number;
  scale: number;
};

export type CameraTransformPoint = {
  confidence: number;
  featureCount: number;
  forwardBackwardRatio: number;
  inlierCount: number;
  inlierRatio: number;
  quality: TrackingQuality;
  residual: CameraSimilarityTransform;
  residualErrorPx: number;
  timeSeconds: number;
  transform: CameraSimilarityTransform;
};

export type CameraTrackingCache = {
  algorithm: "feature-similarity-ransac";
  anchorSeconds: number;
  cacheId: string;
  createdAt: string;
  exclusionRois: NormalizedRoi[];
  fallbackUsed: boolean;
  mode: CameraTrackingMode;
  preferredReferenceRoi: NormalizedRoi | null;
  quality: TrackingQuality;
  sourceHeight: number;
  sourcePath: string;
  sourceWidth: number;
  transformModel: "similarity-dx-dy-rotation-scale";
  transforms: CameraTransformPoint[];
  version: 2;
};

function isCameraTrackingQualityUsableForMeasurement(
  quality: TrackingQuality
): quality is "high" | "medium" {
  return quality === "high" || quality === "medium";
}

export function isCameraTransformPointUsableForMeasurement(point: CameraTransformPoint) {
  return isCameraTrackingQualityUsableForMeasurement(point.quality) && point.confidence >= 0.56;
}

export function isCameraTransformPointUsableForDiagnostics(point: CameraTransformPoint) {
  return point.quality !== "unreliable" && point.confidence >= 0.38;
}

export function isCameraTrackingCacheUsableForMeasurement(cache: CameraTrackingCache) {
  const nonAnchor = cache.transforms.filter(function (point) {
    return Math.abs(point.timeSeconds - cache.anchorSeconds) > 0.001;
  });
  const usableCount = nonAnchor.filter(isCameraTransformPointUsableForMeasurement).length;
  return (
    cache.fallbackUsed !== true &&
    cache.mode !== "fixed-roi-fallback" &&
    isCameraTrackingQualityUsableForMeasurement(cache.quality) &&
    usableCount >= Math.max(2, Math.ceil(nonAnchor.length * 0.55))
  );
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

function isUnitInterval(value: unknown): value is number {
  return isFiniteNumber(value) && value >= 0 && value <= 1;
}

function isNormalizedRoi(value: unknown): value is NormalizedRoi {
  if (!isRecord(value)) return false;
  return (
    isFiniteNumber(value["x"]) &&
    value["x"] >= 0 &&
    isFiniteNumber(value["y"]) &&
    value["y"] >= 0 &&
    isFiniteNumber(value["width"]) &&
    value["width"] > 0 &&
    isFiniteNumber(value["height"]) &&
    value["height"] > 0 &&
    value["x"] + value["width"] <= 1 &&
    value["y"] + value["height"] <= 1
  );
}

function isCameraTransformPoint(value: unknown): value is CameraTransformPoint {
  if (!isRecord(value) || !isRecord(value["transform"]) || !isRecord(value["residual"])) {
    return false;
  }
  const transform = value["transform"];
  const residual = value["residual"];
  const quality = value["quality"];
  return (
    isUnitInterval(value["confidence"]) &&
    isFiniteNumber(value["featureCount"]) &&
    Number.isInteger(value["featureCount"]) &&
    value["featureCount"] >= 0 &&
    isUnitInterval(value["forwardBackwardRatio"]) &&
    isFiniteNumber(value["inlierCount"]) &&
    Number.isInteger(value["inlierCount"]) &&
    value["inlierCount"] >= 0 &&
    isUnitInterval(value["inlierRatio"]) &&
    (quality === "high" || quality === "medium" || quality === "low" || quality === "unreliable") &&
    isFiniteNumber(value["residualErrorPx"]) &&
    value["residualErrorPx"] >= 0 &&
    isFiniteNumber(value["timeSeconds"]) &&
    value["timeSeconds"] >= 0 &&
    [transform, residual].every(function (candidate) {
      return (
        isFiniteNumber(candidate["dx"]) &&
        isFiniteNumber(candidate["dy"]) &&
        isFiniteNumber(candidate["rotationDegrees"]) &&
        isFiniteNumber(candidate["scale"]) &&
        candidate["scale"] > 0
      );
    })
  );
}

export function isCameraTrackingCache(value: unknown): value is CameraTrackingCache {
  if (!isRecord(value)) return false;
  const exclusions = value["exclusionRois"];
  const preferredReferenceRoi = value["preferredReferenceRoi"];
  const transforms = value["transforms"];
  const quality = value["quality"];
  const mode = value["mode"];
  return (
    value["algorithm"] === "feature-similarity-ransac" &&
    value["version"] === 2 &&
    value["transformModel"] === "similarity-dx-dy-rotation-scale" &&
    isFiniteNumber(value["anchorSeconds"]) &&
    value["anchorSeconds"] >= 0 &&
    typeof value["cacheId"] === "string" &&
    value["cacheId"].trim() !== "" &&
    typeof value["createdAt"] === "string" &&
    value["createdAt"].trim() !== "" &&
    Array.isArray(exclusions) &&
    exclusions.every(isNormalizedRoi) &&
    typeof value["fallbackUsed"] === "boolean" &&
    (mode === "global-feature-similarity" ||
      mode === "reference-feature-similarity" ||
      mode === "fixed-roi-fallback") &&
    (preferredReferenceRoi === null || isNormalizedRoi(preferredReferenceRoi)) &&
    (quality === "high" || quality === "medium" || quality === "low" || quality === "unreliable") &&
    isFiniteNumber(value["sourceHeight"]) &&
    value["sourceHeight"] > 0 &&
    typeof value["sourcePath"] === "string" &&
    value["sourcePath"].trim() !== "" &&
    isFiniteNumber(value["sourceWidth"]) &&
    value["sourceWidth"] > 0 &&
    Array.isArray(transforms) &&
    transforms.length > 0 &&
    transforms.every(isCameraTransformPoint)
  );
}

export type TrackingProvenance = {
  algorithm: CameraTrackingCache["algorithm"];
  anchorSeconds: number;
  cacheId: string;
  confidence: number | null;
  error?: string;
  fallbackUsed: boolean;
  featureCount: number | null;
  forwardBackwardRatio: number | null;
  inlierRatio: number | null;
  measurementCoordinateMode?: AnalysisCoordinateMode;
  mode: CameraTrackingMode;
  quality: TrackingQuality;
  residualErrorPx: number | null;
  status: "completed" | "unavailable";
  transformModel: CameraTrackingCache["transformModel"];
  transformSeries: CameraTransformPoint[];
  version: CameraTrackingCache["version"];
};

export type StructuralFrameMetrics = {
  edgeSimilarity: number;
  normalizedAbsoluteDifference: number;
  normalizedPixelCorrelation: number;
  pixelCorrelation: number;
  structuralPersistence: number;
  structuralSimilarity: number;
};

export type StructuralRoleMeasurement = {
  metrics: StructuralFrameMetrics;
  roi: NormalizedRoi;
};

export type StructuralTimelinePoint = {
  background: StructuralRoleMeasurement;
  control: StructuralRoleMeasurement | null;
  differential: {
    targetVsBackgroundStructuralLoss: number;
    targetVsControlStructuralLoss: number | null;
  };
  offsetSeconds: number;
  target: StructuralRoleMeasurement;
  timeSeconds: number;
};

export type StructuralRoiStability = {
  measurementSuitableForSmallRoi: boolean;
  peakDisplacement: number | null;
  peakRotationDegrees: number | null;
  peakScaleDelta: number | null;
  referenceRoi: NormalizedRoi;
  residualErrorPx: number | null;
  risk: "unknown" | "negligible" | "low" | "moderate" | "high";
  riskRatio: number | null;
};

export type BackgroundReferenceConvergenceAssessment = {
  alignment: "camera-similarity" | "fixed-roi-fallback";
  assessment: {
    classification: string;
    convergenceGain: number;
    edgeConvergenceGain: number;
    eventConvergence: number;
    mechanismVerdict: "not-assessed";
    peakPostConvergence: number;
    peakPostOffsetSeconds: number;
    postConvergence: number;
    preConvergence: number;
    targetStructuralLossAtPeak: number | null;
    trackingQualityGate: "pass" | "limited";
    transitionShape: string;
  };
  eventAnchorRoi: NormalizedRoi;
  method: {
    alignment: string;
    epsilon: number;
    perspectiveHomography: "not-modeled";
    reference: string;
    similarity: string;
    timelineOffsetsSeconds: readonly number[];
  };
  phaseSummary: Record<string, unknown>;
  referenceRoi: NormalizedRoi;
  referenceTimeSeconds: number;
  status: "assessed" | "limited";
  timeline: Array<{
    metrics: StructuralFrameMetrics;
    offsetSeconds: number;
    roi: NormalizedRoi;
    timeSeconds: number;
  }>;
  tracking: {
    algorithm: CameraTrackingCache["algorithm"];
    cacheId: string;
    fallbackUsed: boolean;
    inlierRatio: number | null;
    mode: CameraTrackingMode;
    quality: TrackingQuality;
    referenceConfidence: number | null;
    residualErrorPx: number | null;
    transformModel: CameraTrackingCache["transformModel"];
  };
};

export type BackgroundReferenceConvergenceResult =
  | BackgroundReferenceConvergenceAssessment
  | { status: "not-assessed" }
  | { error: string; referenceTimeSeconds: number; status: "unavailable" };

export type StructuralTransitionAssessment = {
  assessment: {
    classification: string;
    mechanismVerdict: "not-assessed";
    trackingQualityGate: "pass" | "limited";
  };
  baseline: {
    model: "pre-midpoint-template";
    roiCoordinateAnchorSeconds: number;
    timeSeconds: number;
  };
  differential: {
    backgroundStructuralLoss: number;
    controlStructuralLoss: number | null;
    sceneStructuralLoss: number;
    targetSpecificStructuralLoss: number;
    targetStructuralLoss: number;
  };
  method: {
    absoluteDifference: string;
    baseline: string;
    edgeSimilarity: string;
    frameSize: string;
    pixelCorrelation: string;
    stabilization: string;
    structuralPersistence: string;
    structuralSimilarity: string;
    timelineOffsetsSeconds: readonly number[];
  };
  phaseSummary: Record<string, StructuralTimelinePoint | null>;
  revealedBackground: BackgroundReferenceConvergenceResult;
  roiStability: StructuralRoiStability;
  status: "assessed";
  timeline: StructuralTimelinePoint[];
};

export type StructuralTransitionResult =
  StructuralTransitionAssessment | { error: string; status: "unavailable" };

export type VisualResponseTemporalRequest = {
  endSeconds: number;
  roi: NormalizedRoi;
  sampleFps: number;
  startSeconds: number;
};

export type VisualResponseProbeRequest = {
  axis: VisualResponseSweepAxis;
  backgroundRoi: NormalizedRoi;
  temporalRequest: VisualResponseTemporalRequest;
};

export type VisualResponseRegionMetrics = {
  chromaDistance: number;
  edgeEnergy: number;
  edgePersistence: number;
  frameDifferenceEnergy: number;
  lumaHigh: number;
  lumaLow: number;
  lumaMax: number;
  lumaMin: number;
  lumaSpread: number;
  meanLuma: number;
  medianLuma: number;
  nearBlackFraction: number;
  persistentNearBlackFraction: number;
  recoveredDarkFraction: number;
  sampleCount: number;
  signalNoiseLike: number;
  temporalPersistence: number;
  visibilityScore: number;
};

export type VisualResponseMetricDifference = Omit<VisualResponseRegionMetrics, "sampleCount">;

export type VisualResponsePoint = {
  background: VisualResponseRegionMetrics;
  differential: VisualResponseMetricDifference;
  target: VisualResponseRegionMetrics;
  value: number;
};

export type VisualResponseInterpretation = {
  classification: string;
  dataQuality: string;
  differentialVisibilityRange?: number;
  peakLocalizedDifference?: number;
  sensorCompatibility: string;
};

export type VisualResponseResultInterpretation = VisualResponseInterpretation & {
  comparability?: Record<string, unknown>;
  corroboration?: Record<string, unknown>;
  photometricCoordinateMode: "fixed-roi";
  trackingAppliedToMeasurement: false;
  trackingQuality: TrackingQuality;
  trackingQualityGate: "advisory" | "limited";
  ungatedClassification: string;
};

export type VisualResponseMeasurement = {
  createdAt: string;
  hypothesis: "target-vs-background-response";
  id: string;
  interpretation: VisualResponseInterpretation;
  kind: "visibility-response";
  method: {
    axisValues: number[];
    metrics: string[];
    nearBlackThreshold8Bit: number;
    recoveryMultiplier: number;
  };
  points: VisualResponsePoint[];
  request: VisualResponseProbeRequest;
  sourceKind: "video";
  sourcePath: string;
};

export type VisualResponseResult = Omit<VisualResponseMeasurement, "interpretation"> & {
  interpretation: VisualResponseResultInterpretation;
  schemaVersion: 2;
  tracking: TrackingProvenance;
};

export type AppearanceTransitionMeasurementRequest = {
  backgroundRoi: NormalizedRoi;
  eventSeconds: number;
  temporalRequest: VisualResponseTemporalRequest;
};

export type AppearanceTransitionMeasurementPhase = {
  background: VisualResponseRegionMetrics;
  differential: VisualResponseMetricDifference;
  endSeconds: number;
  phase: "pre" | "event" | "post";
  startSeconds: number;
  target: VisualResponseRegionMetrics;
};

export type AppearanceTransitionInterpretation = {
  classification: string;
  dataQuality: "sufficient" | "limited";
  eventEdgePersistenceShift: number;
  eventFrameDifferenceShift: number;
  eventVisibilityShift: number;
  postVisibilityShift: number;
};

export type AppearanceTransitionMeasurement = {
  createdAt: string;
  hypothesis: "localized-appearance-disappearance-transition";
  id: string;
  interpretation: AppearanceTransitionInterpretation;
  kind: "appearance-transition";
  phases: AppearanceTransitionMeasurementPhase[];
  request: AppearanceTransitionMeasurementRequest;
  sourceKind: "video";
  sourcePath: string;
};

export type AppearanceTransitionPhase = AppearanceTransitionMeasurementPhase & {
  control: VisualResponseRegionMetrics | null;
  targetVsControl: Partial<Record<keyof VisualResponseMetricDifference, number | null>> | null;
};

export type AppearanceTransitionRequest = AppearanceTransitionMeasurementRequest & {
  backgroundReferenceSeconds?: number;
  controlRoi: NormalizedRoi | null;
};

export type AppearanceTransitionResultInterpretation = AppearanceTransitionInterpretation & {
  controlComparability: Record<string, unknown> | null;
  photometricCoordinateMode: "fixed-roi";
  structuralCoordinateMode: "camera-similarity" | "fixed-roi-fallback";
};

export type AppearanceTransitionResult = Omit<
  AppearanceTransitionMeasurement,
  "interpretation" | "phases" | "request"
> & {
  interpretation: AppearanceTransitionResultInterpretation;
  phases: AppearanceTransitionPhase[];
  request: AppearanceTransitionRequest;
  schemaVersion: 3;
  structural: StructuralTransitionResult;
  tracking: TrackingProvenance;
};

export type LaboratoryAnalysisResult = VisualResponseResult | AppearanceTransitionResult;

export type LaboratorySupplementalAnalysisKind =
  | "control-injection"
  | "impact-window-compare"
  | "motion-reference-lock"
  | "motion-vector-probe"
  | "photometric-attenuation"
  | "recompression-ladder"
  | "temporal-stress-test";

type LaboratoryHistoryIdentity = {
  createdAt: string;
  id: string;
  schemaVersion: number;
};

export type LaboratorySupplementalAnalysisResult = LaboratoryHistoryIdentity &
  Record<string, unknown> & {
    kind: LaboratorySupplementalAnalysisKind;
    schemaVersion: 2;
  };

export type LaboratoryHistoryEntry =
  LaboratoryAnalysisResult | LaboratorySupplementalAnalysisResult;

const supplementalAnalysisKinds = new Set<LaboratorySupplementalAnalysisKind>([
  "control-injection",
  "impact-window-compare",
  "motion-reference-lock",
  "motion-vector-probe",
  "photometric-attenuation",
  "recompression-ladder",
  "temporal-stress-test",
]);

function isNonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.trim() !== "";
}

function isNullableFiniteNumber(value: unknown): value is number | null {
  return value === null || isFiniteNumber(value);
}

function isNullableNonNegativeNumber(value: unknown): value is number | null {
  return value === null || (isFiniteNumber(value) && value >= 0);
}

function isTrackingQuality(value: unknown): value is TrackingQuality {
  return value === "high" || value === "medium" || value === "low" || value === "unreliable";
}

function isCameraTrackingMode(value: unknown): value is CameraTrackingMode {
  return (
    value === "global-feature-similarity" ||
    value === "reference-feature-similarity" ||
    value === "fixed-roi-fallback"
  );
}

function isAnalysisCoordinateMode(value: unknown): value is AnalysisCoordinateMode {
  return value === "fixed-roi" || value === "camera-similarity" || value === "fixed-roi-fallback";
}

function isTrackingProvenance(value: unknown): value is TrackingProvenance {
  if (!isRecord(value)) return false;
  const featureCount = value["featureCount"];
  const coordinateMode = value["measurementCoordinateMode"];
  const error = value["error"];
  const transforms = value["transformSeries"];
  return (
    value["algorithm"] === "feature-similarity-ransac" &&
    isFiniteNumber(value["anchorSeconds"]) &&
    value["anchorSeconds"] >= 0 &&
    isNonEmptyString(value["cacheId"]) &&
    (value["confidence"] === null || isUnitInterval(value["confidence"])) &&
    (error === undefined || typeof error === "string") &&
    typeof value["fallbackUsed"] === "boolean" &&
    (featureCount === null ||
      (isFiniteNumber(featureCount) && Number.isInteger(featureCount) && featureCount >= 0)) &&
    (value["forwardBackwardRatio"] === null || isUnitInterval(value["forwardBackwardRatio"])) &&
    (value["inlierRatio"] === null || isUnitInterval(value["inlierRatio"])) &&
    (coordinateMode === undefined || isAnalysisCoordinateMode(coordinateMode)) &&
    isCameraTrackingMode(value["mode"]) &&
    isTrackingQuality(value["quality"]) &&
    isNullableNonNegativeNumber(value["residualErrorPx"]) &&
    (value["status"] === "completed" || value["status"] === "unavailable") &&
    value["transformModel"] === "similarity-dx-dy-rotation-scale" &&
    Array.isArray(transforms) &&
    transforms.every(isCameraTransformPoint) &&
    value["version"] === 2
  );
}

const STRUCTURAL_METRIC_KEYS = [
  "edgeSimilarity",
  "normalizedAbsoluteDifference",
  "normalizedPixelCorrelation",
  "pixelCorrelation",
  "structuralPersistence",
  "structuralSimilarity",
] as const;

function isStructuralFrameMetrics(value: unknown): value is StructuralFrameMetrics {
  return (
    isRecord(value) &&
    STRUCTURAL_METRIC_KEYS.every(function (key) {
      return isFiniteNumber(value[key]);
    })
  );
}

function isStructuralRoleMeasurement(value: unknown): value is StructuralRoleMeasurement {
  return (
    isRecord(value) && isStructuralFrameMetrics(value["metrics"]) && isNormalizedRoi(value["roi"])
  );
}

function isStructuralTimelinePoint(value: unknown): value is StructuralTimelinePoint {
  if (!isRecord(value) || !isRecord(value["differential"])) return false;
  const differential = value["differential"];
  return (
    isStructuralRoleMeasurement(value["background"]) &&
    (value["control"] === null || isStructuralRoleMeasurement(value["control"])) &&
    isFiniteNumber(differential["targetVsBackgroundStructuralLoss"]) &&
    isNullableFiniteNumber(differential["targetVsControlStructuralLoss"]) &&
    isFiniteNumber(value["offsetSeconds"]) &&
    isStructuralRoleMeasurement(value["target"]) &&
    isFiniteNumber(value["timeSeconds"]) &&
    value["timeSeconds"] >= 0
  );
}

function isStructuralRoiStability(value: unknown): value is StructuralRoiStability {
  if (!isRecord(value)) return false;
  const risk = value["risk"];
  return (
    typeof value["measurementSuitableForSmallRoi"] === "boolean" &&
    isNullableNonNegativeNumber(value["peakDisplacement"]) &&
    isNullableNonNegativeNumber(value["peakRotationDegrees"]) &&
    isNullableNonNegativeNumber(value["peakScaleDelta"]) &&
    isNormalizedRoi(value["referenceRoi"]) &&
    isNullableNonNegativeNumber(value["residualErrorPx"]) &&
    (risk === "unknown" ||
      risk === "negligible" ||
      risk === "low" ||
      risk === "moderate" ||
      risk === "high") &&
    isNullableNonNegativeNumber(value["riskRatio"])
  );
}

function isBackgroundTimelinePoint(value: unknown) {
  return (
    isRecord(value) &&
    isStructuralFrameMetrics(value["metrics"]) &&
    isFiniteNumber(value["offsetSeconds"]) &&
    isNormalizedRoi(value["roi"]) &&
    isFiniteNumber(value["timeSeconds"]) &&
    value["timeSeconds"] >= 0
  );
}

function isBackgroundReferenceConvergenceResult(
  value: unknown
): value is BackgroundReferenceConvergenceResult {
  if (!isRecord(value)) return false;
  if (value["status"] === "not-assessed") return true;
  if (value["status"] === "unavailable") {
    return (
      typeof value["error"] === "string" &&
      isFiniteNumber(value["referenceTimeSeconds"]) &&
      value["referenceTimeSeconds"] >= 0
    );
  }
  if (value["status"] !== "assessed" && value["status"] !== "limited") return false;
  if (
    !isRecord(value["assessment"]) ||
    !isRecord(value["method"]) ||
    !isRecord(value["tracking"])
  ) {
    return false;
  }
  const assessment = value["assessment"];
  const method = value["method"];
  const tracking = value["tracking"];
  const offsets = method["timelineOffsetsSeconds"];
  const timeline = value["timeline"];
  return (
    (value["alignment"] === "camera-similarity" || value["alignment"] === "fixed-roi-fallback") &&
    typeof assessment["classification"] === "string" &&
    isFiniteNumber(assessment["convergenceGain"]) &&
    isFiniteNumber(assessment["edgeConvergenceGain"]) &&
    isFiniteNumber(assessment["eventConvergence"]) &&
    assessment["mechanismVerdict"] === "not-assessed" &&
    isFiniteNumber(assessment["peakPostConvergence"]) &&
    isFiniteNumber(assessment["peakPostOffsetSeconds"]) &&
    isFiniteNumber(assessment["postConvergence"]) &&
    isFiniteNumber(assessment["preConvergence"]) &&
    isNullableFiniteNumber(assessment["targetStructuralLossAtPeak"]) &&
    (assessment["trackingQualityGate"] === "pass" ||
      assessment["trackingQualityGate"] === "limited") &&
    typeof assessment["transitionShape"] === "string" &&
    isNormalizedRoi(value["eventAnchorRoi"]) &&
    typeof method["alignment"] === "string" &&
    isFiniteNumber(method["epsilon"]) &&
    method["perspectiveHomography"] === "not-modeled" &&
    typeof method["reference"] === "string" &&
    typeof method["similarity"] === "string" &&
    Array.isArray(offsets) &&
    offsets.every(isFiniteNumber) &&
    isRecord(value["phaseSummary"]) &&
    isNormalizedRoi(value["referenceRoi"]) &&
    isFiniteNumber(value["referenceTimeSeconds"]) &&
    value["referenceTimeSeconds"] >= 0 &&
    Array.isArray(timeline) &&
    timeline.every(isBackgroundTimelinePoint) &&
    tracking["algorithm"] === "feature-similarity-ransac" &&
    isNonEmptyString(tracking["cacheId"]) &&
    typeof tracking["fallbackUsed"] === "boolean" &&
    isNullableFiniteNumber(tracking["inlierRatio"]) &&
    isCameraTrackingMode(tracking["mode"]) &&
    isTrackingQuality(tracking["quality"]) &&
    isNullableFiniteNumber(tracking["referenceConfidence"]) &&
    isNullableNonNegativeNumber(tracking["residualErrorPx"]) &&
    tracking["transformModel"] === "similarity-dx-dy-rotation-scale"
  );
}

function isStructuralTransitionResult(value: unknown): value is StructuralTransitionResult {
  if (!isRecord(value)) return false;
  if (value["status"] === "unavailable") return typeof value["error"] === "string";
  if (
    value["status"] !== "assessed" ||
    !isRecord(value["assessment"]) ||
    !isRecord(value["baseline"]) ||
    !isRecord(value["differential"]) ||
    !isRecord(value["method"]) ||
    !isRecord(value["phaseSummary"])
  ) {
    return false;
  }
  const assessment = value["assessment"];
  const baseline = value["baseline"];
  const differential = value["differential"];
  const method = value["method"];
  const offsets = method["timelineOffsetsSeconds"];
  const phaseSummary = value["phaseSummary"];
  const timeline = value["timeline"];
  return (
    typeof assessment["classification"] === "string" &&
    assessment["mechanismVerdict"] === "not-assessed" &&
    (assessment["trackingQualityGate"] === "pass" ||
      assessment["trackingQualityGate"] === "limited") &&
    baseline["model"] === "pre-midpoint-template" &&
    isFiniteNumber(baseline["roiCoordinateAnchorSeconds"]) &&
    baseline["roiCoordinateAnchorSeconds"] >= 0 &&
    isFiniteNumber(baseline["timeSeconds"]) &&
    baseline["timeSeconds"] >= 0 &&
    isFiniteNumber(differential["backgroundStructuralLoss"]) &&
    isNullableFiniteNumber(differential["controlStructuralLoss"]) &&
    isFiniteNumber(differential["sceneStructuralLoss"]) &&
    isFiniteNumber(differential["targetSpecificStructuralLoss"]) &&
    isFiniteNumber(differential["targetStructuralLoss"]) &&
    typeof method["absoluteDifference"] === "string" &&
    typeof method["baseline"] === "string" &&
    typeof method["edgeSimilarity"] === "string" &&
    typeof method["frameSize"] === "string" &&
    typeof method["pixelCorrelation"] === "string" &&
    typeof method["stabilization"] === "string" &&
    typeof method["structuralPersistence"] === "string" &&
    typeof method["structuralSimilarity"] === "string" &&
    Array.isArray(offsets) &&
    offsets.every(isFiniteNumber) &&
    Object.values(phaseSummary).every(function (point) {
      return point === null || isStructuralTimelinePoint(point);
    }) &&
    isBackgroundReferenceConvergenceResult(value["revealedBackground"]) &&
    isStructuralRoiStability(value["roiStability"]) &&
    Array.isArray(timeline) &&
    timeline.every(isStructuralTimelinePoint)
  );
}

const VISUAL_METRIC_DIFFERENCE_KEYS = [
  "chromaDistance",
  "edgeEnergy",
  "edgePersistence",
  "frameDifferenceEnergy",
  "lumaHigh",
  "lumaLow",
  "lumaMax",
  "lumaMin",
  "lumaSpread",
  "meanLuma",
  "medianLuma",
  "nearBlackFraction",
  "persistentNearBlackFraction",
  "recoveredDarkFraction",
  "signalNoiseLike",
  "temporalPersistence",
  "visibilityScore",
] as const;

function isVisualResponseMetricDifference(value: unknown): value is VisualResponseMetricDifference {
  return (
    isRecord(value) &&
    VISUAL_METRIC_DIFFERENCE_KEYS.every(function (key) {
      return isFiniteNumber(value[key]);
    })
  );
}

function isVisualResponseRegionMetrics(value: unknown): value is VisualResponseRegionMetrics {
  if (!isRecord(value)) return false;
  const sampleCount = value["sampleCount"];
  return (
    isVisualResponseMetricDifference(value) &&
    isFiniteNumber(sampleCount) &&
    Number.isInteger(sampleCount) &&
    sampleCount >= 0
  );
}

function isVisualResponseTemporalRequest(value: unknown): value is VisualResponseTemporalRequest {
  return (
    isRecord(value) &&
    isFiniteNumber(value["endSeconds"]) &&
    value["endSeconds"] >= 0 &&
    isNormalizedRoi(value["roi"]) &&
    isFiniteNumber(value["sampleFps"]) &&
    value["sampleFps"] > 0 &&
    isFiniteNumber(value["startSeconds"]) &&
    value["startSeconds"] >= 0 &&
    value["endSeconds"] >= value["startSeconds"]
  );
}

function isVisualResponseSweepAxis(value: unknown): value is VisualResponseSweepAxis {
  return (
    value === "exposure" ||
    value === "gamma" ||
    value === "brightness" ||
    value === "black-level" ||
    value === "contrast" ||
    value === "local-contrast" ||
    value === "blur" ||
    value === "denoise" ||
    value === "sharpen"
  );
}

function isVisualResponseProbeRequest(value: unknown): value is VisualResponseProbeRequest {
  return (
    isRecord(value) &&
    isVisualResponseSweepAxis(value["axis"]) &&
    isNormalizedRoi(value["backgroundRoi"]) &&
    isVisualResponseTemporalRequest(value["temporalRequest"])
  );
}

function isVisualResponsePoint(value: unknown): value is VisualResponsePoint {
  return (
    isRecord(value) &&
    isVisualResponseRegionMetrics(value["background"]) &&
    isVisualResponseMetricDifference(value["differential"]) &&
    isVisualResponseRegionMetrics(value["target"]) &&
    isFiniteNumber(value["value"])
  );
}

function isVisualResponseResultInterpretation(
  value: unknown
): value is VisualResponseResultInterpretation {
  if (!isRecord(value)) return false;
  const comparability = value["comparability"];
  const corroboration = value["corroboration"];
  const visibilityRange = value["differentialVisibilityRange"];
  const localizedDifference = value["peakLocalizedDifference"];
  return (
    typeof value["classification"] === "string" &&
    typeof value["dataQuality"] === "string" &&
    (visibilityRange === undefined || isFiniteNumber(visibilityRange)) &&
    (localizedDifference === undefined || isFiniteNumber(localizedDifference)) &&
    typeof value["sensorCompatibility"] === "string" &&
    (comparability === undefined || isRecord(comparability)) &&
    (corroboration === undefined || isRecord(corroboration)) &&
    value["photometricCoordinateMode"] === "fixed-roi" &&
    value["trackingAppliedToMeasurement"] === false &&
    isTrackingQuality(value["trackingQuality"]) &&
    (value["trackingQualityGate"] === "advisory" || value["trackingQualityGate"] === "limited") &&
    typeof value["ungatedClassification"] === "string"
  );
}

function isVisualResponseResult(value: unknown): value is VisualResponseResult {
  if (!isRecord(value) || !isRecord(value["method"])) return false;
  const method = value["method"];
  const axisValues = method["axisValues"];
  const metrics = method["metrics"];
  const points = value["points"];
  return (
    value["schemaVersion"] === 2 &&
    value["kind"] === "visibility-response" &&
    value["hypothesis"] === "target-vs-background-response" &&
    isNonEmptyString(value["id"]) &&
    isNonEmptyString(value["createdAt"]) &&
    isVisualResponseResultInterpretation(value["interpretation"]) &&
    Array.isArray(axisValues) &&
    axisValues.every(isFiniteNumber) &&
    Array.isArray(metrics) &&
    metrics.every(function (metric) {
      return typeof metric === "string";
    }) &&
    isFiniteNumber(method["nearBlackThreshold8Bit"]) &&
    isFiniteNumber(method["recoveryMultiplier"]) &&
    Array.isArray(points) &&
    points.every(isVisualResponsePoint) &&
    isVisualResponseProbeRequest(value["request"]) &&
    value["sourceKind"] === "video" &&
    isNonEmptyString(value["sourcePath"]) &&
    isTrackingProvenance(value["tracking"])
  );
}

function isAppearanceTransitionPhase(value: unknown): value is AppearanceTransitionPhase {
  if (!isRecord(value)) return false;
  const targetVsControl = value["targetVsControl"];
  return (
    isVisualResponseRegionMetrics(value["background"]) &&
    isVisualResponseMetricDifference(value["differential"]) &&
    isFiniteNumber(value["endSeconds"]) &&
    value["endSeconds"] >= 0 &&
    (value["phase"] === "pre" || value["phase"] === "event" || value["phase"] === "post") &&
    isFiniteNumber(value["startSeconds"]) &&
    value["startSeconds"] >= 0 &&
    value["endSeconds"] >= value["startSeconds"] &&
    isVisualResponseRegionMetrics(value["target"]) &&
    (value["control"] === null || isVisualResponseRegionMetrics(value["control"])) &&
    (targetVsControl === null ||
      (isRecord(targetVsControl) &&
        Object.values(targetVsControl).every(function (metric) {
          return metric === null || isFiniteNumber(metric);
        })))
  );
}

function isAppearanceTransitionRequest(value: unknown): value is AppearanceTransitionRequest {
  if (!isRecord(value)) return false;
  const referenceSeconds = value["backgroundReferenceSeconds"];
  return (
    isNormalizedRoi(value["backgroundRoi"]) &&
    isFiniteNumber(value["eventSeconds"]) &&
    value["eventSeconds"] >= 0 &&
    isVisualResponseTemporalRequest(value["temporalRequest"]) &&
    (referenceSeconds === undefined ||
      (isFiniteNumber(referenceSeconds) && referenceSeconds >= 0)) &&
    (value["controlRoi"] === null || isNormalizedRoi(value["controlRoi"]))
  );
}

function isAppearanceTransitionResultInterpretation(
  value: unknown
): value is AppearanceTransitionResultInterpretation {
  return (
    isRecord(value) &&
    typeof value["classification"] === "string" &&
    (value["dataQuality"] === "sufficient" || value["dataQuality"] === "limited") &&
    isFiniteNumber(value["eventEdgePersistenceShift"]) &&
    isFiniteNumber(value["eventFrameDifferenceShift"]) &&
    isFiniteNumber(value["eventVisibilityShift"]) &&
    isFiniteNumber(value["postVisibilityShift"]) &&
    (value["controlComparability"] === null || isRecord(value["controlComparability"])) &&
    value["photometricCoordinateMode"] === "fixed-roi" &&
    (value["structuralCoordinateMode"] === "camera-similarity" ||
      value["structuralCoordinateMode"] === "fixed-roi-fallback")
  );
}

function isAppearanceTransitionResult(value: unknown): value is AppearanceTransitionResult {
  if (!isRecord(value)) return false;
  const phases = value["phases"];
  return (
    value["schemaVersion"] === 3 &&
    value["kind"] === "appearance-transition" &&
    value["hypothesis"] === "localized-appearance-disappearance-transition" &&
    isNonEmptyString(value["id"]) &&
    isNonEmptyString(value["createdAt"]) &&
    isAppearanceTransitionResultInterpretation(value["interpretation"]) &&
    Array.isArray(phases) &&
    phases.every(isAppearanceTransitionPhase) &&
    isAppearanceTransitionRequest(value["request"]) &&
    value["sourceKind"] === "video" &&
    isNonEmptyString(value["sourcePath"]) &&
    isStructuralTransitionResult(value["structural"]) &&
    isTrackingProvenance(value["tracking"])
  );
}

export function isLaboratoryHistoryEntry(value: unknown): value is LaboratoryHistoryEntry {
  if (!isRecord(value)) return false;
  if (
    !isFiniteNumber(value["schemaVersion"]) ||
    !isNonEmptyString(value["id"]) ||
    !isNonEmptyString(value["createdAt"])
  ) {
    return false;
  }

  const kind = value["kind"];
  if (kind === "visibility-response") {
    return isVisualResponseResult(value);
  }
  if (kind === "appearance-transition") {
    return isAppearanceTransitionResult(value);
  }
  if (
    typeof kind === "string" &&
    supplementalAnalysisKinds.has(kind as LaboratorySupplementalAnalysisKind)
  ) {
    return value["schemaVersion"] === 2;
  }
  return false;
}

export type AnalysisReportSection = {
  lines: string[];
  title: string;
};

export type AnalysisReportModel = {
  classification: string | null;
  createdAt: string;
  id: string;
  kind: LaboratoryAnalysisResult["kind"];
  sections: AnalysisReportSection[];
  status: string | null;
  summary: string;
  title: string;
};

export type AnalysisReportDescriptor = Pick<
  AnalysisReportModel,
  "classification" | "createdAt" | "id" | "kind" | "status" | "title"
> & {
  markdown: string;
};
