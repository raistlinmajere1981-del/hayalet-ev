import {
  asLabRecord,
  asNonEmptyString,
  asStringArray,
  getCapabilityFamilyIdsForIntentId,
  getIntentIdsForModuleId,
  getIntentLabel,
} from "../models/lab-types.js";
import type {
  LabAiReport,
  LabArtifactProjection,
  LabBookmark,
  LabComparisonVariant,
  LabCorrelationCluster,
  LabForensicNote,
  LabFindingProjection,
  LabInteractiveSettings,
  LabIntentId,
  LabModuleState,
  LabModuleTraceEntry,
  LabNarrativeCue,
  LabROIRegion,
  LabRun,
  LabUserReport,
} from "../models/lab-types.js";
import type { AnalysisScope } from "../shared/types/analysis-scope.js";

export interface LabIntentReportGroup {
  intentId: LabIntentId;
  label: string;
  findings: LabFindingProjection[];
  artifacts: LabArtifactProjection[];
  modules: Array<{
    id: string;
    title: string;
    status: LabModuleState["status"];
  }>;
}

const AUDIO_TRANSPORT_CAPABILITY_IDS = [
  "audio-signal",
  "audio-recovery",
  "transcription",
  "speaker-analysis",
  "prosody-emotion",
  "sound-classification",
  "source-separation",
  "music-analysis",
] as const;

type ReportSignalWindow = {
  startSeconds: number | null;
  endSeconds: number | null;
  durationSeconds: number | null;
};

type ReportCorrelationSignal = {
  id: string;
  findingId: string | null;
  label: string;
  signalType: string;
  level: string;
  confidence: string;
  window: ReportSignalWindow;
};

const MAX_SCOPE_NARRATIVE_SIGNAL_SECONDS = 5;

const NARRATIVE_TRIGGER_TERMS = [
  "kaybol",
  "belir",
  "gorun",
  "dondu",
  "karardi",
  "ses",
  "ciglik",
  "simdi",
  "tam o anda",
  "bagir",
  "nefes",
  "panik",
  "kork",
  "tepki",
  "vanish",
  "disappear",
  "appear",
  "freeze",
  "dark",
  "scream",
  "now",
] as const;

function asFiniteNumber(value: unknown): number | null {
  const numericValue = typeof value === "number" ? value : Number(value);
  return Number.isFinite(numericValue) ? numericValue : null;
}

function getLevelWeight(level: string): number {
  return level === "high" ? 3 : level === "medium" ? 2 : 1;
}

function normalizeNarrativeText(text: string): string {
  return text
    .toLocaleLowerCase("tr-TR")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/ı/g, "i")
    .replace(/ç/g, "c")
    .replace(/ğ/g, "g")
    .replace(/ö/g, "o")
    .replace(/ş/g, "s")
    .replace(/ü/g, "u");
}

function normalizeSignalWindow(value: unknown): ReportSignalWindow {
  const source = asLabRecord(value);
  const startSeconds = asFiniteNumber(source["startSeconds"]);
  const endSeconds = asFiniteNumber(source["endSeconds"]);
  const durationSeconds = asFiniteNumber(source["durationSeconds"]);
  return {
    startSeconds,
    endSeconds,
    durationSeconds:
      durationSeconds !== null
        ? durationSeconds
        : startSeconds !== null && endSeconds !== null
          ? Math.max(0, endSeconds - startSeconds)
          : null,
  };
}

function getScopeWindow(run: LabRun): ReportSignalWindow {
  const timeRange = asLabRecord(run.analysisScope?.timeRange);
  const startMs = asFiniteNumber(timeRange["startMs"]);
  const endMs = asFiniteNumber(timeRange["endMs"]);
  return {
    startSeconds: startMs === null ? null : startMs / 1000,
    endSeconds: endMs === null ? null : endMs / 1000,
    durationSeconds:
      startMs !== null && endMs !== null ? Math.max(0, (endMs - startMs) / 1000) : null,
  };
}

function getFindingWindow(finding: LabFindingProjection, run: LabRun): ReportSignalWindow {
  const metadata = asLabRecord(finding.metadata);
  const segment = Array.isArray(metadata["temporalSegments"])
    ? metadata["temporalSegments"].map(normalizeSignalWindow).find(function (entry) {
        return entry.startSeconds !== null || entry.endSeconds !== null;
      })
    : null;
  if (segment) {
    return segment;
  }

  const correlationWindow = normalizeSignalWindow(
    asLabRecord(asLabRecord(metadata["correlation"])["window"])
  );
  if (correlationWindow.startSeconds !== null || correlationWindow.endSeconds !== null) {
    return correlationWindow;
  }

  const referenceTimeRange = asLabRecord(asLabRecord(finding.reference)["timeRange"]);
  const startMs = asFiniteNumber(referenceTimeRange["startMs"]);
  const endMs = asFiniteNumber(referenceTimeRange["endMs"]);
  if (startMs !== null || endMs !== null) {
    return {
      startSeconds: startMs === null ? null : startMs / 1000,
      endSeconds: endMs === null ? null : endMs / 1000,
      durationSeconds:
        startMs !== null && endMs !== null ? Math.max(0, (endMs - startMs) / 1000) : null,
    };
  }

  return getScopeWindow(run);
}

function hasFindingTemporalAnchor(finding: LabFindingProjection): boolean {
  const metadata = asLabRecord(finding.metadata);
  const hasSegment = Array.isArray(metadata["temporalSegments"])
    ? metadata["temporalSegments"].map(normalizeSignalWindow).some(function (entry) {
        return entry.startSeconds !== null || entry.endSeconds !== null;
      })
    : false;
  if (hasSegment) {
    return true;
  }

  const correlationWindow = normalizeSignalWindow(
    asLabRecord(asLabRecord(metadata["correlation"])["window"])
  );
  if (correlationWindow.startSeconds !== null || correlationWindow.endSeconds !== null) {
    return true;
  }

  const referenceTimeRange = asLabRecord(asLabRecord(finding.reference)["timeRange"]);
  const startMs = asFiniteNumber(referenceTimeRange["startMs"]);
  const endMs = asFiniteNumber(referenceTimeRange["endMs"]);
  return startMs !== null || endMs !== null;
}

function inferSignalType(finding: LabFindingProjection): string | null {
  const metadata = asLabRecord(finding.metadata);
  const correlation = asLabRecord(metadata["correlation"]);
  const explicitSignalType = asNonEmptyString(correlation["signalType"]);
  if (explicitSignalType !== null) {
    return explicitSignalType;
  }

  const sourceText = normalizeNarrativeText(
    `${finding.sourceModule || ""} ${finding.moduleId || ""} ${finding.code || ""} ${finding.title} ${finding.detail}`
  );
  if (/frame-consistency|freeze|dondu/.test(sourceText)) {
    return "freeze";
  }
  if (/black|dark|karar|lighting|luminance|temporal-noise/.test(sourceText)) {
    return "luminance-collapse";
  }
  if (/audio|silence|volume|spectral|ses|ciglik/.test(sourceText)) {
    return "audio-discontinuity";
  }
  if (/motion|movement|hareket/.test(sourceText)) {
    return "motion-discontinuity";
  }
  if (/narrative|transcript|speech|anlati/.test(sourceText)) {
    return "narrative-trigger";
  }
  return null;
}

function findingHasExplicitCorrelationSignal(finding: LabFindingProjection): boolean {
  return (
    asNonEmptyString(asLabRecord(asLabRecord(finding.metadata)["correlation"])["signalType"]) !==
    null
  );
}

function findingTextLooksNegativeOrBaseline(finding: LabFindingProjection): boolean {
  const normalized = normalizeNarrativeText(`${finding.title} ${finding.detail}`);
  return /\b(no|not|none|without|normal|baseline|expected|clear|yok|degil|bulunmadi|saptanmadi)\b|no anomaly|no freeze|no black|no silence|no trigger|not detected|none detected|tespit edilmedi|anomali yok/.test(
    normalized
  );
}

function shouldIncludeCorrelationSignal(finding: LabFindingProjection): boolean {
  if (
    findingTextLooksNegativeOrBaseline(finding) &&
    !findingHasExplicitCorrelationSignal(finding)
  ) {
    return false;
  }
  if (findingHasExplicitCorrelationSignal(finding)) {
    return true;
  }
  if (finding.level === "high" || finding.level === "medium") {
    return true;
  }
  return /detected|found|anomaly|freeze|black|silence|trigger|kaybol|belir/.test(
    normalizeNarrativeText(`${finding.title} ${finding.detail}`)
  );
}

function getWindowCenter(window: ReportSignalWindow): number | null {
  if (window.startSeconds !== null && window.endSeconds !== null) {
    return (window.startSeconds + window.endSeconds) / 2;
  }
  return window.startSeconds ?? window.endSeconds;
}

function windowsBelongTogether(left: ReportSignalWindow, right: ReportSignalWindow): boolean {
  const leftCenter = getWindowCenter(left);
  const rightCenter = getWindowCenter(right);
  if (leftCenter === null || rightCenter === null) {
    return false;
  }
  const toleranceSeconds = 2.5;
  if (Math.abs(leftCenter - rightCenter) <= toleranceSeconds) {
    return true;
  }
  if (
    left.startSeconds !== null &&
    left.endSeconds !== null &&
    right.startSeconds !== null &&
    right.endSeconds !== null
  ) {
    return (
      left.startSeconds <= right.endSeconds + toleranceSeconds &&
      right.startSeconds <= left.endSeconds + toleranceSeconds
    );
  }
  return false;
}

function formatSeconds(value: number | null): string {
  return value === null ? "scope" : `${value.toFixed(2)}s`;
}

function findNarrativeTerms(text: string): string[] {
  const normalized = normalizeNarrativeText(text);
  const matches = NARRATIVE_TRIGGER_TERMS.map(normalizeNarrativeText).filter(function (term) {
    return normalized.includes(term);
  });
  return Array.from(new Set(matches));
}

function buildNarrativeCues(
  run: LabRun,
  artifacts: LabArtifactProjection[],
  findings: LabFindingProjection[]
): LabNarrativeCue[] {
  const cues: LabNarrativeCue[] = [];
  const seen = new Set<string>();
  const scopeWindow = getScopeWindow(run);
  const hasNarrowScope =
    scopeWindow.durationSeconds !== null &&
    scopeWindow.durationSeconds > 0 &&
    scopeWindow.durationSeconds <= MAX_SCOPE_NARRATIVE_SIGNAL_SECONDS;

  function addCue(
    phrase: string,
    source: string,
    detail: string,
    options: {
      confidence?: string;
      endSeconds?: number | null;
      startSeconds?: number | null;
      temporalBasis?: LabNarrativeCue["temporalBasis"];
    } = {}
  ) {
    const key = `${source}:${phrase}`;
    if (seen.has(key)) {
      return;
    }
    seen.add(key);
    cues.push({
      id: `narrative-${cues.length + 1}`,
      phrase,
      source,
      detail,
      confidence: options.confidence || "low",
      endSeconds: options.endSeconds ?? null,
      startSeconds: options.startSeconds ?? null,
      temporalBasis: options.temporalBasis || "text-only",
    });
  }

  const hypothesis = run.hypothesisSummary || run.analysisScope?.hypothesis || "";
  findNarrativeTerms(hypothesis).forEach(function (phrase) {
    addCue(
      phrase,
      "analysis-hypothesis",
      hasNarrowScope
        ? "Frozen analysis hypothesis contains a narrative trigger term inside a narrow review scope."
        : "Frozen analysis hypothesis contains a scope-level narrative trigger term.",
      {
        confidence: hasNarrowScope ? "medium" : "low",
        endSeconds: hasNarrowScope ? scopeWindow.endSeconds : null,
        startSeconds: hasNarrowScope ? scopeWindow.startSeconds : null,
        temporalBasis: hasNarrowScope ? "narrow-scope" : "scope",
      }
    );
  });

  artifacts.forEach(function (artifact) {
    const metadata = asLabRecord(artifact.metadata);
    asStringArray(metadata["narrativeTriggerPhrases"]).forEach(function (phrase) {
      const normalizedPhrase = normalizeNarrativeText(phrase);
      if (normalizedPhrase === "") {
        return;
      }
      const triggerTerms = findNarrativeTerms(phrase);
      (triggerTerms.length > 0 ? triggerTerms : [normalizedPhrase]).forEach(function (term) {
        addCue(
          term,
          artifact.fileName || artifact.kind || artifact.id,
          "Transcript sampling surfaced this trigger phrase without word-level timing.",
          {
            confidence: "low",
            temporalBasis: "text-only",
          }
        );
      });
    });
    if (Array.isArray(metadata["narrativeTriggerWindows"])) {
      metadata["narrativeTriggerWindows"].map(asLabRecord).forEach(function (windowRecord) {
        const phrase = asNonEmptyString(windowRecord["phrase"]);
        const window = normalizeSignalWindow(windowRecord);
        if (phrase === null || (window.startSeconds === null && window.endSeconds === null)) {
          return;
        }
        addCue(
          normalizeNarrativeText(phrase),
          artifact.fileName || artifact.kind || artifact.id,
          "Transcript sampling surfaced this trigger phrase with a timestamped window.",
          {
            confidence: "medium",
            endSeconds: window.endSeconds,
            startSeconds: window.startSeconds,
            temporalBasis: "timestamp",
          }
        );
      });
    }
  });

  findings.forEach(function (finding) {
    const metadata = asLabRecord(finding.metadata);
    asStringArray(metadata["narrativeCues"]).forEach(function (phrase) {
      const normalizedPhrase = normalizeNarrativeText(phrase);
      if (normalizedPhrase === "") {
        return;
      }
      const triggerTerms = findNarrativeTerms(phrase);
      (triggerTerms.length > 0 ? triggerTerms : [normalizedPhrase]).forEach(function (term) {
        addCue(
          term,
          finding.title,
          "Transcript sampling surfaced this trigger phrase without a persisted transcript artifact.",
          {
            confidence: "low",
            temporalBasis: "text-only",
          }
        );
      });
    });
  });

  return cues.slice(0, 8);
}

function getNarrativeCueSignalWindow(cue: LabNarrativeCue): ReportSignalWindow | null {
  const startSeconds = asFiniteNumber(cue.startSeconds);
  const endSeconds = asFiniteNumber(cue.endSeconds);
  if (startSeconds === null && endSeconds === null) {
    return null;
  }
  return {
    startSeconds,
    endSeconds,
    durationSeconds:
      startSeconds !== null && endSeconds !== null ? Math.max(0, endSeconds - startSeconds) : null,
  };
}

function buildCorrelationSignals(
  run: LabRun,
  findings: LabFindingProjection[],
  narrativeCues: LabNarrativeCue[]
): ReportCorrelationSignal[] {
  const findingSignals = findings
    .filter(shouldIncludeCorrelationSignal)
    .map(function (finding): ReportCorrelationSignal | null {
      const signalType = inferSignalType(finding);
      if (signalType === null) {
        return null;
      }
      if (signalType === "narrative-trigger" && !hasFindingTemporalAnchor(finding)) {
        return null;
      }
      const correlation = asLabRecord(asLabRecord(finding.metadata)["correlation"]);
      return {
        id: `signal-${finding.id}`,
        findingId: finding.id,
        label: asNonEmptyString(correlation["label"]) || finding.title,
        signalType,
        level: finding.level,
        confidence: finding.confidence,
        window: getFindingWindow(finding, run),
      };
    })
    .filter((entry): entry is ReportCorrelationSignal => entry !== null);

  const narrativeSignals = narrativeCues
    .map(function (cue): ReportCorrelationSignal | null {
      const window = getNarrativeCueSignalWindow(cue);
      if (window === null) {
        return null;
      }
      return {
        id: `signal-${cue.id}`,
        findingId: null,
        label: cue.phrase,
        signalType: "narrative-trigger",
        level: cue.confidence === "medium" ? "medium" : "low",
        confidence: cue.confidence || "low",
        window,
      };
    })
    .filter((entry): entry is ReportCorrelationSignal => entry !== null);

  const seen = new Set<string>();
  return findingSignals.concat(narrativeSignals).filter(function (signal) {
    const key = [
      signal.signalType,
      signal.window.startSeconds === null ? "scope" : signal.window.startSeconds.toFixed(2),
      signal.window.endSeconds === null ? "scope" : signal.window.endSeconds.toFixed(2),
    ].join(":");
    if (seen.has(key)) {
      return false;
    }
    seen.add(key);
    return true;
  });
}

function buildCorrelationClusters(signals: ReportCorrelationSignal[]): LabCorrelationCluster[] {
  const clusters: ReportCorrelationSignal[][] = [];
  signals
    .slice()
    .sort(function (left, right) {
      return (
        (getWindowCenter(left.window) ?? Number.MAX_SAFE_INTEGER) -
        (getWindowCenter(right.window) ?? Number.MAX_SAFE_INTEGER)
      );
    })
    .forEach(function (signal) {
      const matchedCluster = clusters.find(function (cluster) {
        return cluster.some(function (entry) {
          return windowsBelongTogether(entry.window, signal.window);
        });
      });
      if (matchedCluster) {
        matchedCluster.push(signal);
      } else {
        clusters.push([signal]);
      }
    });

  const nullWindowSignals = signals.filter(function (signal) {
    return getWindowCenter(signal.window) === null;
  });
  if (nullWindowSignals.length > 1) {
    clusters.push(nullWindowSignals);
  }

  return clusters
    .map(function (cluster, index): LabCorrelationCluster | null {
      const signalTypes = Array.from(new Set(cluster.map((signal) => signal.signalType)));
      if (signalTypes.length < 2) {
        return null;
      }
      const score =
        cluster.reduce<number>(function (total, signal) {
          return total + getLevelWeight(signal.level);
        }, 0) +
        Math.max(0, signalTypes.length - 1) * 2;
      const startSeconds = cluster.reduce<number | null>(function (minValue, signal) {
        const value = signal.window.startSeconds;
        return value === null ? minValue : minValue === null ? value : Math.min(minValue, value);
      }, null);
      const endSeconds = cluster.reduce<number | null>(function (maxValue, signal) {
        const value = signal.window.endSeconds;
        return value === null ? maxValue : maxValue === null ? value : Math.max(maxValue, value);
      }, null);
      const level = score >= 8 || signalTypes.length >= 4 ? "high" : score >= 5 ? "medium" : "low";
      return {
        id: `correlation-cluster-${index + 1}`,
        title: `${signalTypes.length} signal family correlation`,
        detail: `${cluster.length} signal(s) converge around ${formatSeconds(startSeconds)} - ${formatSeconds(endSeconds)}: ${signalTypes.join(", ")}.`,
        score,
        level,
        confidence: signalTypes.length >= 3 ? "medium" : "low",
        startSeconds,
        endSeconds,
        signalCount: cluster.length,
        signalTypes,
        findingIds: cluster
          .map(function (signal) {
            return signal.findingId;
          })
          .filter((entry): entry is string => entry !== null),
      };
    })
    .filter((entry): entry is LabCorrelationCluster => entry !== null)
    .sort(function (left, right) {
      return right.score - left.score;
    })
    .slice(0, 6);
}

function buildForensicNotes(findings: LabFindingProjection[]): LabForensicNote[] {
  const notes: LabForensicNote[] = [];
  const seen = new Set<string>();
  findings.forEach(function (finding) {
    const probeSummary = asLabRecord(asLabRecord(finding.metadata)["probeSummary"]);
    Object.keys(probeSummary).forEach(function (key) {
      const summary = asLabRecord(probeSummary[key]);
      const count = asFiniteNumber(summary["count"]) || 0;
      if (count <= 0) {
        return;
      }
      const total = asFiniteNumber(summary["totalDurationSeconds"]);
      const max = asFiniteNumber(summary["maxDurationSeconds"]);
      const average = asFiniteNumber(summary["averageDurationSeconds"]);
      const hasLocalSegments = Array.isArray(summary["segments"])
        ? summary["segments"].map(normalizeSignalWindow).some(function (entry) {
            return entry.startSeconds !== null || entry.endSeconds !== null;
          })
        : false;
      const scope = hasLocalSegments ? "local" : "global";
      const measuredFields = [
        "interval count",
        total !== null ? "total duration" : null,
        max !== null ? "max duration" : null,
        average !== null ? "average duration" : null,
        hasLocalSegments ? "temporal segments" : null,
      ].filter((entry): entry is string => entry !== null);
      const followUpChecks = [
        "GOP boundary",
        "duplicate-frame ratio",
        "encoder-artifact attribution",
      ];
      const dedupeKey = `${finding.moduleId || "module"}:${key}:${String(count)}:${String(
        total
      )}:${String(max)}`;
      if (seen.has(dedupeKey)) {
        return;
      }
      seen.add(dedupeKey);
      notes.push({
        id: `forensic-${finding.id}-${key}`,
        label: `${key} probe`,
        detail: `Measured ${scope} evidence: ${count} interval(s), total ${formatSeconds(total)}, max ${formatSeconds(max)}. Follow-up only: ${followUpChecks.join(", ")}.`,
        followUpChecks,
        measuredFields,
        moduleId: finding.moduleId,
        scope,
      });
    });
  });
  return notes.slice(0, 8);
}

function buildReportInsights(
  run: LabRun,
  findings: LabFindingProjection[]
): {
  correlationClusters: LabCorrelationCluster[];
  narrativeCues: LabNarrativeCue[];
  forensicNotes: LabForensicNote[];
} {
  const narrativeCues = buildNarrativeCues(run, run.artifacts, findings);
  const signals = buildCorrelationSignals(run, findings, narrativeCues);
  return {
    correlationClusters: buildCorrelationClusters(signals),
    forensicNotes: buildForensicNotes(findings),
    narrativeCues,
  };
}

function buildEvidenceLabels(
  findings: LabFindingProjection[],
  artifacts: LabArtifactProjection[],
  finding: LabFindingProjection
) {
  const artifactLookup = new Map<string, LabArtifactProjection>();
  artifacts.forEach(function (artifact) {
    artifactLookup.set(artifact.id, artifact);
  });
  const labels = finding.artifactIds
    .map(function (artifactId) {
      const artifact = artifactLookup.get(artifactId);
      if (!artifact) {
        return null;
      }
      return artifact.fileName || artifact.kind || artifact.id;
    })
    .filter((entry): entry is string => entry !== null);

  if (labels.length > 0) {
    return labels;
  }
  if (finding.evidenceCount > 0) {
    return [`${String(finding.evidenceCount)} kanit izi`];
  }
  return findings.length > 0 ? ["Yapisal bulgu kaydi"] : [];
}

export function buildUserReport(run: LabRun | null, reportRecord: unknown): LabUserReport | null {
  if (!run) {
    return null;
  }

  const normalizedReport = asLabRecord(reportRecord);
  const reportFindings = Array.isArray(normalizedReport["findings"])
    ? (normalizedReport["findings"] as LabFindingProjection[])
    : [];
  const rankedFindings = reportFindings.length > 0 ? reportFindings : run.findings;
  const primaryFinding = rankedFindings[0] || null;
  const existingUserReport = asLabRecord(normalizedReport["userReport"]);
  const insights = buildReportInsights(run, rankedFindings);
  const primaryCluster = insights.correlationClusters[0] || null;
  const generatedSummary = primaryCluster
    ? `Composite anomaly cluster: ${primaryCluster.detail} Toplam ${String(rankedFindings.length)} bulgu ve ${String(run.artifacts.length)} artefakt kaydi mevcut.`
    : primaryFinding
      ? `En yuksek oncelikli bulgu: ${primaryFinding.title}. Toplam ${String(rankedFindings.length)} bulgu ve ${String(run.artifacts.length)} artefakt kaydi mevcut.`
      : asNonEmptyString(existingUserReport["summary"]) ||
        run.emptyReason ||
        "Calisma tamamlandi fakat on plana cikan bulgu kaydi uretilmedi.";
  const confidence =
    primaryFinding?.confidence || asNonEmptyString(existingUserReport["confidence"]) || "low";

  const suspiciousFrames = run.artifacts
    .filter(function (artifact) {
      return artifact.previewUrl && artifact.kind !== "transcript";
    })
    .slice(0, 6)
    .map(function (artifact) {
      return {
        artifactId: artifact.id,
        previewUrl: artifact.previewUrl || "",
        label: artifact.fileName || artifact.kind || artifact.id,
      };
    });

  const hypothesisResult = run.hypothesisSummary || null;

  const elapsedSeconds =
    run.endedAt && run.startedAt ? Math.round((run.endedAt - run.startedAt) / 1000) : 0;

  const moduleSummary = run.moduleOrder.map(function (moduleId) {
    const mod = run.modules[moduleId];
    if (!mod) {
      return { id: moduleId, title: moduleId, status: "unknown" };
    }
    return {
      id: mod.id,
      title: mod.title || mod.id,
      status: mod.status,
    };
  });

  return {
    summary: generatedSummary,
    confidence,
    topFindings: rankedFindings.slice(0, 3).map(function (finding) {
      return {
        id: finding.id,
        title: finding.title,
        detail: finding.detail,
        confidence: finding.confidence,
        evidence: buildEvidenceLabels(rankedFindings, run.artifacts, finding),
      };
    }),
    suspiciousFrames,
    hypothesisResult,
    elapsedSeconds,
    moduleSummary,
    correlationSummary: primaryCluster ? primaryCluster.detail : null,
    topCorrelationClusters: insights.correlationClusters.slice(0, 3),
    narrativeCues: insights.narrativeCues,
    forensicNotes: insights.forensicNotes,
  };
}

export function buildAiReport(run: LabRun | null, reportRecord: unknown): LabAiReport | null {
  if (!run) {
    return null;
  }

  const normalizedReport = asLabRecord(reportRecord);
  const degradedConditions = asStringArray(normalizedReport["caveats"]).concat(run.warnings);
  const errors = [run.error, asNonEmptyString(normalizedReport["error"])].filter(
    (entry): entry is string => entry !== null
  );

  const moduleTrace: LabModuleTraceEntry[] = Array.isArray(run.moduleTrace)
    ? run.moduleTrace.slice()
    : [];
  const analysisScope: AnalysisScope | null = run.analysisScope;
  const comparisonVariants: LabComparisonVariant[] = Array.isArray(run.comparisonVariants)
    ? run.comparisonVariants.slice()
    : [];
  const reportFindings = Array.isArray(normalizedReport["findings"])
    ? (normalizedReport["findings"] as LabFindingProjection[])
    : [];
  const rankedFindings = reportFindings.length > 0 ? reportFindings : run.findings;
  const insights = buildReportInsights(run, rankedFindings);

  return {
    manifest: {
      featureId: normalizedReport["featureId"] || null,
      sourceRunId: normalizedReport["sourceRunId"] || run.id,
      generatedAt: normalizedReport["generatedAt"] || new Date().toISOString(),
      moduleCount: run.moduleOrder.length,
      artifactCount: run.artifacts.length,
      findingCount: rankedFindings.length,
      correlationClusterCount: insights.correlationClusters.length,
      narrativeCueCount: insights.narrativeCues.length,
      status: normalizedReport["status"] || run.state,
      emptyReason: normalizedReport["emptyReason"] || run.emptyReason || null,
    },
    findings: rankedFindings,
    artifacts: run.artifacts,
    warnings: Array.from(new Set(asStringArray(normalizedReport["warnings"]).concat(run.warnings))),
    errors,
    degradedConditions: Array.from(new Set(degradedConditions)),
    moduleTrace,
    analysisScope,
    comparisonVariants,
    correlationClusters: insights.correlationClusters,
    narrativeCues: insights.narrativeCues,
    forensicNotes: insights.forensicNotes,
  };
}

export function buildIntentReportGroups(run: LabRun | null): LabIntentReportGroup[] {
  if (!run) {
    return [];
  }

  const scopeIntentIds = Array.isArray(run.analysisScope?.intentIds)
    ? run.analysisScope?.intentIds.filter(
        (entry): entry is LabIntentId => typeof entry === "string"
      )
    : [];
  const orderedIntentIds = scopeIntentIds.filter(function (intentId, index) {
    return scopeIntentIds.indexOf(intentId) === index;
  });

  function resolveTransportIntentIds(moduleId: string | null) {
    if (moduleId === "motion") {
      return orderedIntentIds.filter(function (intentId) {
        return getCapabilityFamilyIdsForIntentId(intentId).includes("visual-structure");
      });
    }
    if (moduleId === "visual-signal") {
      return orderedIntentIds.filter(function (intentId) {
        return getCapabilityFamilyIdsForIntentId(intentId).includes("visual-forensics");
      });
    }
    if (moduleId === "audio") {
      const fallbackCapabilityIds = orderedIntentIds
        .flatMap(function (intentId) {
          return getCapabilityFamilyIdsForIntentId(intentId);
        })
        .filter(function (capabilityId, index, allCapabilityIds) {
          return (
            AUDIO_TRANSPORT_CAPABILITY_IDS.includes(
              capabilityId as (typeof AUDIO_TRANSPORT_CAPABILITY_IDS)[number]
            ) && allCapabilityIds.indexOf(capabilityId) === index
          );
        });
      if (fallbackCapabilityIds.length === 0) {
        return [];
      }
      return orderedIntentIds.filter(function (intentId) {
        const intentCapabilityIds = getCapabilityFamilyIdsForIntentId(intentId);
        return fallbackCapabilityIds.some(function (capabilityId) {
          return intentCapabilityIds.includes(capabilityId);
        });
      });
    }
    if (moduleId === "report" && orderedIntentIds.length === 1) {
      return orderedIntentIds.slice();
    }
    return [];
  }

  function resolveIntentIdsForGroupedItem(moduleId: string | null) {
    const mappedIntentIds = getIntentIdsForModuleId(moduleId).filter(function (intentId) {
      return orderedIntentIds.includes(intentId);
    });
    if (mappedIntentIds.length > 0) {
      return mappedIntentIds;
    }
    const transportIntentIds = resolveTransportIntentIds(moduleId);
    if (transportIntentIds.length > 0) {
      return transportIntentIds;
    }
    if (orderedIntentIds.length === 1 && moduleId === null) {
      return orderedIntentIds.slice();
    }
    return [];
  }

  return orderedIntentIds.map(function (intentId) {
    const findings = run.findings.filter(function (finding) {
      const candidateModuleIds = [finding.moduleId, finding.sourceModule].filter(
        (moduleId): moduleId is string => typeof moduleId === "string" && moduleId.trim() !== ""
      );
      if (candidateModuleIds.length === 0) {
        return resolveIntentIdsForGroupedItem(null).includes(intentId);
      }
      return candidateModuleIds.some(function (moduleId) {
        return resolveIntentIdsForGroupedItem(moduleId).includes(intentId);
      });
    });
    const artifacts = run.artifacts.filter(function (artifact) {
      const metadataSourceModule = asNonEmptyString(asLabRecord(artifact.metadata)["sourceModule"]);
      const candidateModuleIds = [artifact.moduleId, metadataSourceModule].filter(
        (moduleId): moduleId is string => typeof moduleId === "string" && moduleId.trim() !== ""
      );
      if (candidateModuleIds.length === 0) {
        return resolveIntentIdsForGroupedItem(null).includes(intentId);
      }
      return candidateModuleIds.some(function (moduleId) {
        return resolveIntentIdsForGroupedItem(moduleId).includes(intentId);
      });
    });
    const modules = run.moduleOrder
      .filter(function (moduleId) {
        const module = run.modules[moduleId];
        const metadataModuleIds = asStringArray(asLabRecord(module?.metadata)["moduleIds"]);
        const candidateModuleIds = [moduleId].concat(metadataModuleIds);
        return candidateModuleIds.some(function (candidateModuleId) {
          return resolveIntentIdsForGroupedItem(candidateModuleId).includes(intentId);
        });
      })
      .map(function (moduleId) {
        const module = run.modules[moduleId];
        return {
          id: moduleId,
          title: module?.title || moduleId,
          status: module?.status || "idle",
        };
      });

    return {
      intentId,
      label: getIntentLabel(intentId),
      findings,
      artifacts,
      modules,
    };
  });
}

/** V2.3: Build workspace context snapshot for report enrichment */
export interface LabWorkspaceReportContext {
  timeRange: { startMs: number | null; endMs: number | null };
  roiRegions: LabROIRegion[];
  interactiveSettings: LabInteractiveSettings;
  hypothesis: string;
  selectedIntents: LabIntentId[];
  bookmarks: LabBookmark[];
}

export function buildWorkspaceContext(workspaceState: {
  timelineStartMs: number | null;
  timelineEndMs: number | null;
  roiRegions: LabROIRegion[];
  interactiveSettings: LabInteractiveSettings;
  hypothesis: string;
  bookmarks: LabBookmark[];
  selectedIntents: LabIntentId[];
}): LabWorkspaceReportContext {
  return {
    timeRange: {
      startMs: workspaceState.timelineStartMs,
      endMs: workspaceState.timelineEndMs,
    },
    roiRegions: workspaceState.roiRegions.filter(function (region) {
      return region.active;
    }),
    interactiveSettings: { ...workspaceState.interactiveSettings },
    hypothesis: workspaceState.hypothesis,
    selectedIntents: workspaceState.selectedIntents.slice(),
    bookmarks: workspaceState.bookmarks.slice().sort(function (a, b) {
      return a.timeMs - b.timeMs;
    }),
  };
}
