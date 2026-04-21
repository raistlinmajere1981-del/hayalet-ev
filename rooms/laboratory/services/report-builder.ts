import { asLabRecord, asNonEmptyString, asStringArray } from "../models/lab-types.js";
import type {
  LabAiReport,
  LabArtifactProjection,
  LabBookmark,
  LabComparisonVariant,
  LabFindingProjection,
  LabInteractiveSettings,
  LabIntentId,
  LabModuleTraceEntry,
  LabROIRegion,
  LabRun,
  LabUserReport,
} from "../models/lab-types.js";
import type { AnalysisScope } from "../shared/types/analysis-scope.js";

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
  const generatedSummary =
    asNonEmptyString(asLabRecord(normalizedReport["userReport"])["summary"]) ||
    (run.findings[0]
      ? `En yuksek oncelikli bulgu: ${run.findings[0].title}. Toplam ${String(run.findings.length)} bulgu ve ${String(run.artifacts.length)} artefakt kaydi mevcut.`
      : run.emptyReason || "Calisma tamamlandi fakat on plana cikan bulgu kaydi uretilmedi.");
  const confidence =
    run.findings[0]?.confidence ||
    asNonEmptyString(asLabRecord(normalizedReport["userReport"])["confidence"]) ||
    "low";

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
    topFindings: run.findings.slice(0, 3).map(function (finding) {
      return {
        id: finding.id,
        title: finding.title,
        detail: finding.detail,
        confidence: finding.confidence,
        evidence: buildEvidenceLabels(run.findings, run.artifacts, finding),
      };
    }),
    suspiciousFrames,
    hypothesisResult,
    elapsedSeconds,
    moduleSummary,
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

  const moduleTrace: LabModuleTraceEntry[] = run.moduleTrace.slice();
  const analysisScope: AnalysisScope | null = run.analysisScope;
  const comparisonVariants: LabComparisonVariant[] = run.comparisonVariants.slice();

  return {
    manifest: {
      featureId: normalizedReport["featureId"] || null,
      sourceRunId: normalizedReport["sourceRunId"] || run.id,
      generatedAt: normalizedReport["generatedAt"] || new Date().toISOString(),
      moduleCount: run.moduleOrder.length,
      artifactCount: run.artifacts.length,
      findingCount: run.findings.length,
      status: normalizedReport["status"] || run.state,
      emptyReason: normalizedReport["emptyReason"] || run.emptyReason || null,
    },
    findings: run.findings,
    artifacts: run.artifacts,
    warnings: Array.from(new Set(asStringArray(normalizedReport["warnings"]).concat(run.warnings))),
    errors,
    degradedConditions: Array.from(new Set(degradedConditions)),
    moduleTrace,
    analysisScope,
    comparisonVariants,
  };
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
