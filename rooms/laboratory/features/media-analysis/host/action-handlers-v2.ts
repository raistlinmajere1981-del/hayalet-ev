import { createMediaActionRuntime as createLegacyMediaActionRuntime } from "./action-handlers.js";
import { createLaboratoryCameraTrackingRuntime } from "./camera-tracking-v2.js";
import type { LaboratoryCameraTransformCache } from "./camera-tracking-v2.js";
import { createLaboratoryStructuralTransitionV2Runtime } from "./structural-transition-v2.js";
import { createLaboratoryBackgroundReferenceConvergenceV2Runtime } from "./background-reference-convergence-v2.js";
import { normalizeLaboratoryResponseBackgroundRoi } from "../../../shared/visual-response-probe-model.js";

type LegacyDeps = Parameters<typeof createLegacyMediaActionRuntime>[0];
type LegacyRuntime = ReturnType<typeof createLegacyMediaActionRuntime>;
type RecordValue = Record<string, unknown>;

type RunControlInjectionArgs = Parameters<LegacyRuntime["runControlInjection"]>;

const TRANSITION_OFFSETS = [-1, -0.8, -0.6, -0.4, -0.2, 0, 0.2, 0.4, 0.6, 0.8, 1] as const;

function asRecord(value: unknown): RecordValue {
  return value !== null && typeof value === "object" && !Array.isArray(value)
    ? (value as RecordValue)
    : {};
}

function finite(record: RecordValue, key: string) {
  const value = record[key];
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function stringValue(value: unknown) {
  return typeof value === "string" && value.trim() !== "" ? value.trim() : null;
}

function trackingProvenance(cache: LaboratoryCameraTransformCache) {
  const points = cache.transforms.filter(function (point) {
    return Math.abs(point.timeSeconds - cache.anchorSeconds) > 0.001;
  });
  const usable = points.filter(function (point) {
    return point.quality !== "unreliable" && point.confidence >= 0.38;
  });
  const mean = function (values: number[]) {
    return values.length === 0
      ? 0
      : values.reduce(function (sum, value) {
          return sum + value;
        }, 0) / values.length;
  };
  return {
    algorithm: cache.algorithm,
    version: cache.version,
    transformModel: cache.transformModel,
    cacheId: cache.cacheId,
    anchorSeconds: cache.anchorSeconds,
    mode: cache.mode,
    quality: cache.quality,
    fallbackUsed: cache.fallbackUsed,
    confidence: mean(usable.map((point) => point.confidence)),
    inlierRatio: mean(usable.map((point) => point.inlierRatio)),
    forwardBackwardRatio: mean(usable.map((point) => point.forwardBackwardRatio)),
    residualErrorPx: mean(usable.map((point) => point.residualErrorPx)),
    featureCount: Math.round(mean(usable.map((point) => point.featureCount))),
    transformSeries: cache.transforms,
  };
}

export function createMediaActionRuntime(deps: LegacyDeps): LegacyRuntime {
  const legacy = createLegacyMediaActionRuntime(deps);
  const getProjectEditOutputDir = function (runtime: RecordValue, project: RecordValue) {
    return deps.getProjectEditOutputDir(runtime, project as never);
  };
  const tracker = createLaboratoryCameraTrackingRuntime({
    callRoomTools: deps.callRoomTools,
    getProjectEditOutputDir,
    patchActiveProject(runtime, patcher) {
      return deps.patchActiveProject(runtime, function (project) {
        return patcher(asRecord(project));
      });
    },
    readBinaryFileBytes: deps.readBinaryFileBytes,
    roomId: deps.roomId,
    toRecord: deps.toRecord,
  });
  const structuralV2 = createLaboratoryStructuralTransitionV2Runtime({
    callRoomTools: deps.callRoomTools,
    getProjectEditOutputDir,
    readBinaryFileBytes: deps.readBinaryFileBytes,
    roomId: deps.roomId,
    toRecord: deps.toRecord,
  });
  const convergenceV2 = createLaboratoryBackgroundReferenceConvergenceV2Runtime({
    callRoomTools: deps.callRoomTools,
    getProjectEditOutputDir,
    readBinaryFileBytes: deps.readBinaryFileBytes,
    roomId: deps.roomId,
    toRecord: deps.toRecord,
  });

  async function replaceStoredResult(runtime: RunControlInjectionArgs[0], result: RecordValue) {
    const resultId = stringValue(result["id"]);
    if (resultId === null) return result;
    await deps.patchActiveProject(runtime, function (project) {
      const projectRecord = asRecord(project);
      const edit = asRecord(projectRecord["edit"]);
      const history = Array.isArray(edit["temporalStressTests"])
        ? (edit["temporalStressTests"] as unknown[])
        : [];
      projectRecord["edit"] = {
        ...edit,
        temporalStressTests: history.map(function (entry) {
          const record = asRecord(entry);
          return stringValue(record["id"]) === resultId ? result : entry;
        }),
        lastActionAt: result["createdAt"],
        lastError: null,
      };
      return projectRecord;
    });
    return result;
  }

  async function buildTrackingCache(input: {
    actionRequest: RecordValue;
    backgroundReferenceSeconds: number | null;
    eventSeconds: number;
    project: RecordValue;
    requestId: string;
    runtime: RunControlInjectionArgs[0];
    sourceHeight: number;
    sourcePath: string;
    sourceWidth: number;
    durationSeconds: number | null;
    targetRoi: NonNullable<ReturnType<typeof normalizeLaboratoryResponseBackgroundRoi>>;
    controlRoi: ReturnType<typeof normalizeLaboratoryResponseBackgroundRoi>;
    backgroundRoi: NonNullable<ReturnType<typeof normalizeLaboratoryResponseBackgroundRoi>>;
  }) {
    const sourceEnd =
      input.durationSeconds ??
      Math.max(input.eventSeconds + 1, input.backgroundReferenceSeconds ?? 0);
    const sampleTimes = TRANSITION_OFFSETS.map(function (offset) {
      return Math.max(0, Math.min(sourceEnd, input.eventSeconds + offset));
    });
    if (input.backgroundReferenceSeconds !== null) {
      sampleTimes.push(Math.max(0, Math.min(sourceEnd, input.backgroundReferenceSeconds)));
    }
    return tracker.getOrCreateTrackingCache({
      anchorSeconds: input.eventSeconds,
      durationSeconds: input.durationSeconds,
      exclusionRois: [input.targetRoi, input.controlRoi],
      preferredReferenceRoi: input.backgroundRoi,
      project: input.project,
      requestId: input.requestId,
      runtime: input.runtime,
      sampleTimes,
      sourceHeight: input.sourceHeight,
      sourcePath: input.sourcePath,
      sourceWidth: input.sourceWidth,
    });
  }

  async function enrichTransitionV2(
    runtime: RunControlInjectionArgs[0],
    requestId: string,
    actionRequest: RecordValue,
    legacyResult: RecordValue
  ) {
    const projectValue = deps.getActiveProject(runtime);
    if (projectValue === null) return legacyResult;
    const project = asRecord(projectValue);
    const source = asRecord(project["source"]);
    const metadata = asRecord(source["metadata"]);
    const sourcePath = stringValue(source["storedPath"]);
    const sourceWidth = finite(metadata, "width");
    const sourceHeight = finite(metadata, "height");
    const durationSeconds = finite(metadata, "durationSeconds");
    const resultRequest = asRecord(legacyResult["request"]);
    const temporalRequest = asRecord(resultRequest["temporalRequest"]);
    const eventSeconds = finite(resultRequest, "eventSeconds");
    const targetRoi = normalizeLaboratoryResponseBackgroundRoi(temporalRequest["roi"]);
    const backgroundRoi =
      normalizeLaboratoryResponseBackgroundRoi(actionRequest["backgroundRoi"]) ??
      normalizeLaboratoryResponseBackgroundRoi(resultRequest["backgroundRoi"]);
    const controlRoi = normalizeLaboratoryResponseBackgroundRoi(actionRequest["controlRoi"]);
    const backgroundReferenceSecondsRaw = finite(actionRequest, "backgroundReferenceSeconds");
    const backgroundReferenceSeconds =
      backgroundReferenceSecondsRaw !== null && backgroundReferenceSecondsRaw >= 0
        ? backgroundReferenceSecondsRaw
        : null;
    if (
      sourcePath === null ||
      sourceWidth === null ||
      sourceHeight === null ||
      sourceWidth <= 0 ||
      sourceHeight <= 0 ||
      eventSeconds === null ||
      targetRoi === null ||
      backgroundRoi === null
    ) {
      return legacyResult;
    }

    let cache: LaboratoryCameraTransformCache;
    try {
      cache = await buildTrackingCache({
        actionRequest,
        backgroundReferenceSeconds,
        eventSeconds,
        project,
        requestId,
        runtime,
        sourceHeight,
        sourcePath,
        sourceWidth,
        durationSeconds,
        targetRoi,
        controlRoi,
        backgroundRoi,
      });
    } catch (error) {
      const interpretation = asRecord(legacyResult["interpretation"]);
      const limited = {
        ...legacyResult,
        trackingV2: {
          status: "unavailable",
          algorithm: "feature-similarity-ransac-v2",
          fallbackUsed: true,
          error: error instanceof Error ? error.message : "Camera tracking v2 failed.",
        },
        interpretation: {
          ...interpretation,
          trackingQualityGate: "legacy-fallback",
        },
      };
      return replaceStoredResult(runtime, limited);
    }

    let structural = asRecord(legacyResult["structural"]);
    try {
      structural = asRecord(
        await structuralV2.analyzeTransition({
          backgroundRoi,
          controlRoi,
          durationSeconds,
          eventSeconds,
          project,
          referenceRoi: backgroundRoi,
          requestId,
          runtime: runtime,
          sourceHeight,
          sourcePath,
          sourceWidth,
          targetRoi,
          trackingCache: cache,
        })
      );
      if (backgroundReferenceSeconds !== null) {
        structural = {
          ...structural,
          revealedBackground: await convergenceV2.analyzeConvergence({
            backgroundReferenceSeconds,
            durationSeconds,
            eventSeconds,
            project,
            requestId,
            runtime: runtime,
            sourceHeight,
            sourcePath,
            sourceWidth,
            targetRoi,
            targetStructuralTimeline: Array.isArray(structural["timeline"])
              ? (structural["timeline"] as unknown[])
              : [],
            trackingCache: cache,
          }),
        };
      }
    } catch (error) {
      structural = {
        ...structural,
        v2Status: "unavailable",
        v2Error: error instanceof Error ? error.message : "Stabilized Structural v2 failed.",
      };
    }

    const interpretation = asRecord(legacyResult["interpretation"]);
    const structuralAssessment = asRecord(structural["assessment"]);
    const revealedBackground = asRecord(structural["revealedBackground"]);
    const referenceAssessment = asRecord(revealedBackground["assessment"]);
    const provenance = trackingProvenance(cache);
    const trackingGate =
      cache.fallbackUsed || cache.quality === "unreliable" || cache.quality === "low"
        ? "limited"
        : "pass";
    const result = {
      ...legacyResult,
      schemaVersion: 3,
      structural,
      roiStability: structural["roiStability"],
      trackingV2: {
        status: "completed",
        ...provenance,
      },
      interpretation: {
        ...interpretation,
        structuralClassification: stringValue(structuralAssessment["classification"]),
        revealedBackgroundClassification: stringValue(referenceAssessment["classification"]),
        referenceTransitionShape: stringValue(referenceAssessment["transitionShape"]),
        trackingQuality: cache.quality,
        trackingQualityGate: trackingGate,
        photometricCoordinateMode: "fixed-roi-legacy",
        structuralCoordinateMode: cache.fallbackUsed
          ? "fixed-roi-fallback"
          : "camera-tracking-v2-similarity",
      },
    };
    return replaceStoredResult(runtime, result);
  }

  async function enrichVisibilityTracking(
    runtime: RunControlInjectionArgs[0],
    requestId: string,
    actionRequest: RecordValue,
    legacyResult: RecordValue
  ) {
    const projectValue = deps.getActiveProject(runtime);
    if (projectValue === null) return legacyResult;
    const project = asRecord(projectValue);
    const source = asRecord(project["source"]);
    const metadata = asRecord(source["metadata"]);
    const sourcePath = stringValue(source["storedPath"]);
    const sourceWidth = finite(metadata, "width");
    const sourceHeight = finite(metadata, "height");
    const durationSeconds = finite(metadata, "durationSeconds");
    const temporal = asRecord(actionRequest["temporalRequest"]);
    const start = finite(temporal, "startSeconds");
    const end = finite(temporal, "endSeconds");
    const targetRoi = normalizeLaboratoryResponseBackgroundRoi(temporal["roi"]);
    const backgroundRoi = normalizeLaboratoryResponseBackgroundRoi(actionRequest["backgroundRoi"]);
    if (
      sourcePath === null ||
      sourceWidth === null ||
      sourceHeight === null ||
      start === null ||
      end === null ||
      targetRoi === null ||
      backgroundRoi === null
    ) {
      return legacyResult;
    }
    const anchorSeconds = (start + end) / 2;
    const sampleTimes: number[] = [];
    const step = Math.max(0.2, Math.min(0.5, (end - start) / 8));
    for (let time = start; time <= end + 0.001; time += step) {
      sampleTimes.push(Math.min(end, time));
    }
    try {
      const cache = await tracker.getOrCreateTrackingCache({
        anchorSeconds,
        durationSeconds,
        exclusionRois: [targetRoi],
        preferredReferenceRoi: backgroundRoi,
        project,
        requestId,
        runtime: runtime,
        sampleTimes,
        sourceHeight,
        sourcePath,
        sourceWidth,
      });
      const interpretation = asRecord(legacyResult["interpretation"]);
      const limited =
        cache.fallbackUsed || cache.quality === "unreliable" || cache.quality === "low";
      const result = {
        ...legacyResult,
        trackingV2: {
          status: "completed",
          ...trackingProvenance(cache),
          measurementCoordinateMode: "fixed-roi-legacy",
        },
        interpretation: {
          ...interpretation,
          ungatedClassification: interpretation["classification"],
          classification: limited
            ? "roi-tracking-quality-limits-response-result"
            : interpretation["classification"],
          trackingQuality: cache.quality,
          trackingQualityGate: limited ? "limited" : "advisory",
          trackingAppliedToMeasurement: false,
        },
      };
      return replaceStoredResult(runtime, result);
    } catch {
      return legacyResult;
    }
  }

  async function runControlInjection(...args: RunControlInjectionArgs) {
    const [runtime, requestId, actionPayload] = args;
    const actionRequest = asRecord(asRecord(actionPayload)["request"]);
    const kind = stringValue(actionRequest["kind"]);
    const result = asRecord(await legacy.runControlInjection(...args));
    if (kind === "appearance-transition") {
      return enrichTransitionV2(runtime, requestId, actionRequest, result);
    }
    if (kind?.startsWith("response-") === true) {
      return enrichVisibilityTracking(runtime, requestId, actionRequest, result);
    }
    return result;
  }

  return {
    ...legacy,
    runControlInjection,
  };
}
