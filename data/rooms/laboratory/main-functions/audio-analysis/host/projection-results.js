export function createAudioAnalysisProjectionResultsRuntime(deps) {
  const {
    asNonEmptyString,
    normalizeAudioAnalysisMetric,
    normalizeStringArray,
    toRecord
  } = deps;
  function getAudioAnalysisConfidenceRank(confidence) {
    const nextConfidence = asNonEmptyString(confidence) || "low";
    return nextConfidence === "high" ? 3 : nextConfidence === "medium" ? 2 : 1;
  }
  function mapAudioAnalysisResultStatus(processRecord, moduleEntry, capabilityEntry) {
    const processStatus = asNonEmptyString(toRecord(processRecord).status) || "idle";
    const moduleStatus = asNonEmptyString(toRecord(moduleEntry).status) || "idle";
    const capabilityStatus = asNonEmptyString(toRecord(capabilityEntry).status) || "planned";
    if (moduleStatus === "ready") {
      return processStatus === "stale" ? "stale" : "complete";
    }
    if (moduleStatus === "error" || moduleStatus === "failed") {
      return "failed";
    }
    if (moduleStatus === "cancelled") {
      return "cancelled";
    }
    if (["planned", "gated", "blocked", "skipped", "running", "queued"].includes(moduleStatus)) {
      return moduleStatus;
    }
    if (processStatus === "stale" && capabilityStatus === "ready") {
      return "stale";
    }
    return capabilityStatus === "ready" ? "idle" : capabilityStatus;
  }
  function buildAudioAnalysisModuleMetrics(signals, artifacts) {
    const metrics = [
      {
        id: "signals",
        label: "Signals",
        value: String(signals.length)
      },
      {
        id: "artifacts",
        label: "Artifacts",
        value: String(artifacts.length)
      }
    ];
    const descriptorSummary = artifacts.map(function(artifact) {
      return toRecord(toRecord(artifact).metadata).descriptorSummary;
    }).find(function(entry) {
      return Object.keys(toRecord(entry)).length > 0;
    }) || {};
    const prosodySummary = artifacts.map(function(artifact) {
      return toRecord(toRecord(artifact).metadata).prosodySummary;
    }).find(function(entry) {
      return Object.keys(toRecord(entry)).length > 0;
    }) || {};
    const emotionHeuristic = artifacts.map(function(artifact) {
      return toRecord(toRecord(artifact).metadata).emotionHeuristic;
    }).find(function(entry) {
      return Object.keys(toRecord(entry)).length > 0;
    }) || {};
    const soundEventSummary = artifacts.map(function(artifact) {
      return toRecord(toRecord(artifact).metadata).topClasses;
    }).find(function(entry) {
      return Array.isArray(entry) && entry.length > 0;
    }) || [];
    const sourceSeparationSummary = artifacts.map(function(artifact) {
      return toRecord(toRecord(artifact).metadata);
    }).find(function(entry) {
      return typeof toRecord(entry).stemCount === "number";
    }) || {};
    const musicAnalysisSummary = artifacts.map(function(artifact) {
      return toRecord(toRecord(artifact).metadata).musicSummary;
    }).find(function(entry) {
      return Object.keys(toRecord(entry)).length > 0;
    }) || {};
    const diarizationSummary = artifacts.map(function(artifact) {
      return toRecord(toRecord(artifact).metadata).diarizationSummary;
    }).find(function(entry) {
      return Object.keys(toRecord(entry)).length > 0;
    }) || {};
    if (typeof toRecord(descriptorSummary.centroid).mean === "number") {
      metrics.push({
        id: "spectral-centroid",
        label: "Mean centroid",
        value: `${Number(toRecord(descriptorSummary.centroid).mean).toFixed(1)} Hz`
      });
    }
    if (typeof toRecord(descriptorSummary.rolloff).mean === "number") {
      metrics.push({
        id: "spectral-rolloff",
        label: "Mean rolloff",
        value: `${Number(toRecord(descriptorSummary.rolloff).mean).toFixed(1)} Hz`
      });
    }
    if (typeof toRecord(descriptorSummary.flatness).mean === "number") {
      metrics.push({
        id: "spectral-flatness",
        label: "Flatness",
        value: Number(toRecord(descriptorSummary.flatness).mean).toFixed(3)
      });
    }
    if (typeof prosodySummary.meanF0Hz === "number") {
      metrics.push({
        id: "prosody-f0",
        label: "Mean F0",
        value: `${Number(prosodySummary.meanF0Hz).toFixed(1)} Hz`
      });
    }
    if (typeof prosodySummary.voicedRatio === "number") {
      metrics.push({
        id: "prosody-voiced-ratio",
        label: "Voiced ratio",
        value: `${Math.round(Number(prosodySummary.voicedRatio) * 100)}%`
      });
    }
    if (typeof prosodySummary.estimatedPauseCount === "number") {
      metrics.push({
        id: "prosody-pauses",
        label: "Estimated pauses",
        value: String(prosodySummary.estimatedPauseCount)
      });
    }
    if (typeof emotionHeuristic.label === "string" && emotionHeuristic.label.trim() !== "") {
      metrics.push({
        id: "emotion-label",
        label: "Heuristic label",
        value: emotionHeuristic.label
      });
    }
    if (Array.isArray(soundEventSummary) && soundEventSummary.length > 0) {
      const topClass = toRecord(soundEventSummary[0]);
      metrics.push({
        id: "sound-event-top",
        label: "Top event",
        value: typeof topClass.label === "string" && topClass.label.trim() !== "" ? topClass.label : typeof topClass.className === "string" && topClass.className.trim() !== "" ? topClass.className : "Unknown"
      });
    }
    if (typeof sourceSeparationSummary.stemCount === "number") {
      metrics.push({
        id: "source-separation-stems",
        label: "Separated stems",
        value: String(sourceSeparationSummary.stemCount)
      });
    }
    if (typeof sourceSeparationSummary.modelName === "string" && sourceSeparationSummary.modelName.trim() !== "") {
      metrics.push({
        id: "source-separation-model",
        label: "Separation model",
        value: sourceSeparationSummary.modelName
      });
    }
    if (typeof musicAnalysisSummary.tempoBpm === "number") {
      metrics.push({
        id: "music-tempo",
        label: "Tempo",
        value: `${Number(musicAnalysisSummary.tempoBpm).toFixed(1)} BPM`
      });
    }
    if (typeof musicAnalysisSummary.dominantPitchClass === "string" && musicAnalysisSummary.dominantPitchClass.trim() !== "") {
      metrics.push({
        id: "music-pitch-class",
        label: "Dominant pitch class",
        value: musicAnalysisSummary.dominantPitchClass
      });
    }
    if (typeof diarizationSummary.speakerCount === "number") {
      metrics.push({
        id: "speaker-count",
        label: "Speakers",
        value: String(diarizationSummary.speakerCount)
      });
    }
    if (typeof diarizationSummary.segmentCount === "number") {
      metrics.push({
        id: "speaker-segments",
        label: "Speaker segments",
        value: String(diarizationSummary.segmentCount)
      });
    }
    return metrics.map(normalizeAudioAnalysisMetric);
  }
  function buildAudioAnalysisModuleSummary(resultStatus, moduleEntry, capabilityEntry) {
    const summary = asNonEmptyString(toRecord(moduleEntry).summary);
    if (summary !== null) {
      return summary;
    }
    const blockers = normalizeStringArray(toRecord(capabilityEntry).blockers);
    if (blockers.length > 0) {
      return blockers[0];
    }
    switch (resultStatus) {
      case "planned":
        return "Reserved for the later rollout.";
      case "gated":
        return "This module remains capability-gated on the current runtime.";
      case "blocked":
        return "Resolve the module blockers before running the audio desk.";
      case "stale":
        return "The target changed after the last completed run.";
      case "complete":
        return "This module completed during the latest managed run.";
      case "running":
        return "This module is currently running.";
      default:
        return "";
    }
  }
  return {
    buildAudioAnalysisModuleMetrics,
    buildAudioAnalysisModuleSummary,
    getAudioAnalysisConfidenceRank,
    mapAudioAnalysisResultStatus
  };
}
