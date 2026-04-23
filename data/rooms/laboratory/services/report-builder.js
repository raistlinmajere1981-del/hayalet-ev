import {
  asLabRecord,
  asNonEmptyString,
  asStringArray,
  getCapabilityFamilyIdsForIntentId,
  getIntentIdsForModuleId,
  getIntentLabel
} from "../models/lab-types.js";
const AUDIO_TRANSPORT_CAPABILITY_IDS = [
  "audio-signal",
  "audio-recovery",
  "transcription",
  "speaker-analysis",
  "prosody-emotion",
  "sound-classification",
  "source-separation",
  "music-analysis"
];
function buildEvidenceLabels(findings, artifacts, finding) {
  const artifactLookup = /* @__PURE__ */ new Map();
  artifacts.forEach(function(artifact) {
    artifactLookup.set(artifact.id, artifact);
  });
  const labels = finding.artifactIds.map(function(artifactId) {
    const artifact = artifactLookup.get(artifactId);
    if (!artifact) {
      return null;
    }
    return artifact.fileName || artifact.kind || artifact.id;
  }).filter((entry) => entry !== null);
  if (labels.length > 0) {
    return labels;
  }
  if (finding.evidenceCount > 0) {
    return [`${String(finding.evidenceCount)} kanit izi`];
  }
  return findings.length > 0 ? ["Yapisal bulgu kaydi"] : [];
}
export function buildUserReport(run, reportRecord) {
  if (!run) {
    return null;
  }
  const normalizedReport = asLabRecord(reportRecord);
  const generatedSummary = asNonEmptyString(asLabRecord(normalizedReport["userReport"])["summary"]) || (run.findings[0] ? `En yuksek oncelikli bulgu: ${run.findings[0].title}. Toplam ${String(run.findings.length)} bulgu ve ${String(run.artifacts.length)} artefakt kaydi mevcut.` : run.emptyReason || "Calisma tamamlandi fakat on plana cikan bulgu kaydi uretilmedi.");
  const confidence = run.findings[0]?.confidence || asNonEmptyString(asLabRecord(normalizedReport["userReport"])["confidence"]) || "low";
  const suspiciousFrames = run.artifacts.filter(function(artifact) {
    return artifact.previewUrl && artifact.kind !== "transcript";
  }).slice(0, 6).map(function(artifact) {
    return {
      artifactId: artifact.id,
      previewUrl: artifact.previewUrl || "",
      label: artifact.fileName || artifact.kind || artifact.id
    };
  });
  const hypothesisResult = run.hypothesisSummary || null;
  const elapsedSeconds = run.endedAt && run.startedAt ? Math.round((run.endedAt - run.startedAt) / 1e3) : 0;
  const moduleSummary = run.moduleOrder.map(function(moduleId) {
    const mod = run.modules[moduleId];
    if (!mod) {
      return { id: moduleId, title: moduleId, status: "unknown" };
    }
    return {
      id: mod.id,
      title: mod.title || mod.id,
      status: mod.status
    };
  });
  return {
    summary: generatedSummary,
    confidence,
    topFindings: run.findings.slice(0, 3).map(function(finding) {
      return {
        id: finding.id,
        title: finding.title,
        detail: finding.detail,
        confidence: finding.confidence,
        evidence: buildEvidenceLabels(run.findings, run.artifacts, finding)
      };
    }),
    suspiciousFrames,
    hypothesisResult,
    elapsedSeconds,
    moduleSummary
  };
}
export function buildAiReport(run, reportRecord) {
  if (!run) {
    return null;
  }
  const normalizedReport = asLabRecord(reportRecord);
  const degradedConditions = asStringArray(normalizedReport["caveats"]).concat(run.warnings);
  const errors = [run.error, asNonEmptyString(normalizedReport["error"])].filter(
    (entry) => entry !== null
  );
  const moduleTrace = run.moduleTrace.slice();
  const analysisScope = run.analysisScope;
  const comparisonVariants = run.comparisonVariants.slice();
  return {
    manifest: {
      featureId: normalizedReport["featureId"] || null,
      sourceRunId: normalizedReport["sourceRunId"] || run.id,
      generatedAt: normalizedReport["generatedAt"] || (/* @__PURE__ */ new Date()).toISOString(),
      moduleCount: run.moduleOrder.length,
      artifactCount: run.artifacts.length,
      findingCount: run.findings.length,
      status: normalizedReport["status"] || run.state,
      emptyReason: normalizedReport["emptyReason"] || run.emptyReason || null
    },
    findings: run.findings,
    artifacts: run.artifacts,
    warnings: Array.from(new Set(asStringArray(normalizedReport["warnings"]).concat(run.warnings))),
    errors,
    degradedConditions: Array.from(new Set(degradedConditions)),
    moduleTrace,
    analysisScope,
    comparisonVariants
  };
}
export function buildIntentReportGroups(run) {
  if (!run) {
    return [];
  }
  const scopeIntentIds = Array.isArray(run.analysisScope?.intentIds) ? run.analysisScope?.intentIds.filter(
    (entry) => typeof entry === "string"
  ) : [];
  const orderedIntentIds = scopeIntentIds.filter(function(intentId, index) {
    return scopeIntentIds.indexOf(intentId) === index;
  });
  function resolveTransportIntentIds(moduleId) {
    if (moduleId === "motion") {
      return orderedIntentIds.filter(function(intentId) {
        return getCapabilityFamilyIdsForIntentId(intentId).includes("visual-structure");
      });
    }
    if (moduleId === "visual-signal") {
      return orderedIntentIds.filter(function(intentId) {
        return getCapabilityFamilyIdsForIntentId(intentId).includes("visual-forensics");
      });
    }
    if (moduleId === "audio") {
      const fallbackCapabilityIds = orderedIntentIds.flatMap(function(intentId) {
        return getCapabilityFamilyIdsForIntentId(intentId);
      }).filter(function(capabilityId, index, allCapabilityIds) {
        return AUDIO_TRANSPORT_CAPABILITY_IDS.includes(
          capabilityId
        ) && allCapabilityIds.indexOf(capabilityId) === index;
      });
      if (fallbackCapabilityIds.length === 0) {
        return [];
      }
      return orderedIntentIds.filter(function(intentId) {
        const intentCapabilityIds = getCapabilityFamilyIdsForIntentId(intentId);
        return fallbackCapabilityIds.some(function(capabilityId) {
          return intentCapabilityIds.includes(capabilityId);
        });
      });
    }
    if (moduleId === "report" && orderedIntentIds.length === 1) {
      return orderedIntentIds.slice();
    }
    return [];
  }
  function resolveIntentIdsForGroupedItem(moduleId) {
    const mappedIntentIds = getIntentIdsForModuleId(moduleId).filter(function(intentId) {
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
  return orderedIntentIds.map(function(intentId) {
    const findings = run.findings.filter(function(finding) {
      const candidateModuleIds = [finding.moduleId, finding.sourceModule].filter(
        (moduleId) => typeof moduleId === "string" && moduleId.trim() !== ""
      );
      if (candidateModuleIds.length === 0) {
        return resolveIntentIdsForGroupedItem(null).includes(intentId);
      }
      return candidateModuleIds.some(function(moduleId) {
        return resolveIntentIdsForGroupedItem(moduleId).includes(intentId);
      });
    });
    const artifacts = run.artifacts.filter(function(artifact) {
      const metadataSourceModule = asNonEmptyString(asLabRecord(artifact.metadata)["sourceModule"]);
      const candidateModuleIds = [artifact.moduleId, metadataSourceModule].filter(
        (moduleId) => typeof moduleId === "string" && moduleId.trim() !== ""
      );
      if (candidateModuleIds.length === 0) {
        return resolveIntentIdsForGroupedItem(null).includes(intentId);
      }
      return candidateModuleIds.some(function(moduleId) {
        return resolveIntentIdsForGroupedItem(moduleId).includes(intentId);
      });
    });
    const modules = run.moduleOrder.filter(function(moduleId) {
      const module = run.modules[moduleId];
      const metadataModuleIds = asStringArray(asLabRecord(module?.metadata)["moduleIds"]);
      const candidateModuleIds = [moduleId].concat(metadataModuleIds);
      return candidateModuleIds.some(function(candidateModuleId) {
        return resolveIntentIdsForGroupedItem(candidateModuleId).includes(intentId);
      });
    }).map(function(moduleId) {
      const module = run.modules[moduleId];
      return {
        id: moduleId,
        title: module?.title || moduleId,
        status: module?.status || "idle"
      };
    });
    return {
      intentId,
      label: getIntentLabel(intentId),
      findings,
      artifacts,
      modules
    };
  });
}
export function buildWorkspaceContext(workspaceState) {
  return {
    timeRange: {
      startMs: workspaceState.timelineStartMs,
      endMs: workspaceState.timelineEndMs
    },
    roiRegions: workspaceState.roiRegions.filter(function(region) {
      return region.active;
    }),
    interactiveSettings: { ...workspaceState.interactiveSettings },
    hypothesis: workspaceState.hypothesis,
    selectedIntents: workspaceState.selectedIntents.slice(),
    bookmarks: workspaceState.bookmarks.slice().sort(function(a, b) {
      return a.timeMs - b.timeMs;
    })
  };
}
