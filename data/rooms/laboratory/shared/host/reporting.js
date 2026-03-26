export function createLaboratoryReportingRuntime(deps) {
  const {
    asNonEmptyString,
    asNumber,
    clone,
    syncProjectAudioAnalysisProjection,
    normalizeAudioAnalysisState,
    getAudioAnalysisModulesForRuntime,
    toRecord,
    normalizeStringArray,
    normalizeAudioAnalysisModuleResult,
    getFindingSeverityRank,
    formatIdentifierLabel,
    normalizeFeatureReportRecord,
    createEmptyFeatureReportRecord,
    getActiveProject,
    getFeatureProcessRecord,
    normalizeProcessFinding,
    normalizeProcessArtifact,
    getSubtitleAnalysisModuleDescriptors,
    getSubtitleSelectedEntries,
    normalizeProcessModule,
    getFeatureReportRecord,
    getFeatureReportDir,
    ensureProjectDirectories,
    getFeatureReportExportAction,
    ensureReportJobSlotAvailable,
    registerJob,
    pushJobState,
    patchActiveProject,
    setFeatureReportRecord,
    sanitizeFileSegment,
    normalizeReportExport,
    writeTextFile,
    clearJob,
    audioFeatureId,
    subtitleFeatureId,
    mediaFeatureId,
  } = deps;

  function buildAudioAnalysisReportProjection(runtime, project) {
    const projectedProject = clone(project);
    syncProjectAudioAnalysisProjection(runtime, projectedProject);

    const audioAnalysis = normalizeAudioAnalysisState(projectedProject.audioAnalysis, runtime);
    const catalogMap = getAudioAnalysisModulesForRuntime(runtime).reduce(function (accumulator, entry) {
      const moduleId = asNonEmptyString(entry.id);
      if (moduleId !== null) {
        accumulator[moduleId] = entry;
      }
      return accumulator;
    }, {});
    const orderedIds = normalizeStringArray(toRecord(audioAnalysis.analysisCatalog).orderedIds);
    const extraIds = Object.keys(toRecord(audioAnalysis.results)).filter(function (moduleId) {
      return !orderedIds.includes(moduleId);
    });
    const orderedResults = orderedIds.concat(extraIds).map(function (moduleId) {
      return normalizeAudioAnalysisModuleResult(
        toRecord(toRecord(audioAnalysis.results)[moduleId]),
        moduleId,
        toRecord(catalogMap[moduleId])
      );
    });

    return {
      audioAnalysis: audioAnalysis,
      orderedResults: orderedResults,
    };
  }

  function getProcessArtifactByKind(processRecord, kind) {
    return (
      (Array.isArray(processRecord.artifacts) ? processRecord.artifacts.map(normalizeProcessArtifact) : []).find(
        function (entry) {
          return asNonEmptyString(entry.kind) === kind;
        }
      ) || null
    );
  }

  function formatReportCardLabel(card) {
    const label = asNonEmptyString(toRecord(card).label);
    if (label !== null) {
      return label;
    }
    const labelKey = asNonEmptyString(toRecord(card).labelKey);
    if (labelKey !== null) {
      return formatIdentifierLabel(labelKey.split(".").pop() || labelKey);
    }
    return "Summary";
  }

  function composeAudioAnalysisReport(runtime, project) {
    const processRecord = getFeatureProcessRecord(project, audioFeatureId);
    if (processRecord.status !== "ready" && processRecord.status !== "stale") {
      return normalizeFeatureReportRecord(
        {
          ...createEmptyFeatureReportRecord(audioFeatureId),
          status: processRecord.status === "running" ? "staged" : "idle",
          warnings: processRecord.warnings || [],
        },
        audioFeatureId
      );
    }

    const projection = buildAudioAnalysisReportProjection(runtime, project);
    const orderedResults = projection.orderedResults;
    const findings = orderedResults
      .flatMap(function (entry) {
        return Array.isArray(entry.signals) ? entry.signals : [];
      })
      .map(normalizeProcessFinding)
      .sort(function (left, right) {
        return getFindingSeverityRank(right.level) - getFindingSeverityRank(left.level);
      });
    const artifactCount = orderedResults.reduce(function (sum, entry) {
      return sum + (Array.isArray(entry.artifacts) ? entry.artifacts.length : 0);
    }, 0);
    const completedCount = orderedResults.filter(function (entry) {
      return ["complete", "stale"].includes(asNonEmptyString(entry.status) || "idle");
    }).length;
    const gatedCount = orderedResults.filter(function (entry) {
      return asNonEmptyString(entry.status) === "gated";
    }).length;
    const plannedCount = orderedResults.filter(function (entry) {
      return asNonEmptyString(entry.status) === "planned";
    }).length;
    const blockedCount = orderedResults.filter(function (entry) {
      return asNonEmptyString(entry.status) === "blocked";
    }).length;
    const warnings = Array.from(
      new Set(
        normalizeStringArray(processRecord.warnings).concat(
          orderedResults.flatMap(function (entry) {
            return normalizeStringArray(entry.warnings);
          })
        )
      )
    );
    const caveats = [];
    if (plannedCount > 0) {
      caveats.push(`${String(plannedCount)} audio module(s) remain planned for the v2 rollout.`);
    }
    if (gatedCount > 0) {
      caveats.push(`${String(gatedCount)} audio module(s) remain capability-gated on the current runtime.`);
    }
    if (blockedCount > 0) {
      caveats.push("Blocked audio modules keep their slot visible until the target and providers are ready.");
    }

    return normalizeFeatureReportRecord(
      {
        featureId: audioFeatureId,
        status: "ready",
        sourceRunId: processRecord.runId,
        generatedAt: new Date().toISOString(),
        summaryCards: [
          {
            id: "audio-target",
            label: "Target",
            value:
              asNonEmptyString(toRecord(projection.audioAnalysis.source).targetLabel) ||
              asNonEmptyString(toRecord(processRecord.targetSummary).label) ||
              project.name,
          },
          {
            id: "audio-visible-modules",
            label: "Visible modules",
            value: String(orderedResults.length),
          },
          {
            id: "audio-completed-modules",
            label: "Completed modules",
            value: String(completedCount),
          },
          {
            id: "audio-findings",
            label: "Findings",
            value: String(findings.length),
          },
          {
            id: "audio-artifacts",
            label: "Artifacts",
            value: String(artifactCount),
          },
        ],
        findings: findings,
        caveats: caveats,
        warnings: warnings,
        exports: getFeatureReportRecord(project, audioFeatureId).exports,
        error: null,
      },
      audioFeatureId
    );
  }

  function composeSubtitleAnalysisReport(runtime, project) {
    const processRecord = getFeatureProcessRecord(project, subtitleFeatureId);
    if (processRecord.status !== "ready" && processRecord.status !== "stale") {
      return normalizeFeatureReportRecord(
        {
          ...createEmptyFeatureReportRecord(subtitleFeatureId),
          status: processRecord.status === "running" ? "staged" : "idle",
          warnings: processRecord.warnings || [],
        },
        subtitleFeatureId
      );
    }

    const findings = (Array.isArray(processRecord.findings) ? processRecord.findings : [])
      .map(normalizeProcessFinding)
      .sort(function (left, right) {
        return getFindingSeverityRank(right.level) - getFindingSeverityRank(left.level);
      });
    const modules = Array.isArray(processRecord.modules) ? processRecord.modules.map(normalizeProcessModule) : [];
    const completedCount = modules.filter(function (entry) {
      return ["ready", "stale", "complete"].includes(asNonEmptyString(entry.status) || "idle");
    }).length;
    const plannedCount = getSubtitleAnalysisModuleDescriptors(runtime).filter(function (entry) {
      return asNonEmptyString(entry.status) === "planned";
    }).length;
    const targetEntries = getSubtitleSelectedEntries(project);
    const summaryArtifact = getProcessArtifactByKind(processRecord, "subtitle-summary");
    const lexicalArtifact = getProcessArtifactByKind(processRecord, "subtitle-top-words");
    const lexicalModule =
      modules.find(function (entry) {
        return entry.id === "lexical-frequency";
      }) || null;
    const totalCues =
      asNumber(toRecord(summaryArtifact).metadata.totalCues) ||
      findings.reduce(function (sum, entry) {
        return sum + Math.max(0, Math.round(asNumber(entry.evidenceCount) || 0));
      }, 0) ||
      0;
    const uniqueLanguages = Array.from(
      new Set(
        targetEntries
          .map(function (entry) {
            return asNonEmptyString(toRecord(entry).language);
          })
          .filter(Boolean)
      )
    );
    const topWord =
      asNonEmptyString(toRecord(lexicalArtifact).metadata.topWord) ||
      (typeof toRecord(lexicalModule).summary === "string" &&
      toRecord(lexicalModule).summary.toLowerCase().includes("top lexical term is")
        ? asNonEmptyString(
            toRecord(lexicalModule)
              .summary.replace(/^.*?"/, "")
              .replace(/".*$/, "")
          )
        : null);
    const warnings = Array.from(
      new Set(
        normalizeStringArray(processRecord.warnings).concat(
          modules.flatMap(function (entry) {
            return normalizeStringArray(entry.warnings);
          })
        )
      )
    );
    const caveats = [];

    if (plannedCount > 0) {
      caveats.push(`${plannedCount} subtitle module(s) remain planned for the next rollout.`);
    }
    if (targetEntries.length > 1) {
      caveats.push("Batch subtitle selections summarize the currently selected entries only.");
    }
    if (uniqueLanguages.length === 0) {
      caveats.push("Subtitle language tags are missing on the current selection.");
    }

    return normalizeFeatureReportRecord(
      {
        featureId: subtitleFeatureId,
        status: "ready",
        sourceRunId: processRecord.runId,
        generatedAt: new Date().toISOString(),
        summaryCards: [
          {
            id: "subtitle-target",
            labelKey: "subtitleAnalysis.report.summaryCards.target",
            value: asNonEmptyString(toRecord(processRecord.targetSummary).label) || project.name,
          },
          {
            id: "subtitle-files",
            labelKey: "subtitleAnalysis.report.summaryCards.files",
            value: String(asNumber(toRecord(processRecord.targetSummary).entryCount) || targetEntries.length || 0),
          },
          {
            id: "subtitle-cues",
            labelKey: "subtitleAnalysis.report.summaryCards.cues",
            value: String(totalCues),
          },
          {
            id: "subtitle-findings",
            labelKey: "subtitleAnalysis.report.summaryCards.findings",
            value: String(findings.length),
          },
          {
            id: "subtitle-languages",
            labelKey: "subtitleAnalysis.report.summaryCards.languages",
            value: uniqueLanguages.length > 0 ? uniqueLanguages.join(", ") : "--",
          },
          {
            id: "subtitle-top-term",
            labelKey: "subtitleAnalysis.report.summaryCards.topTerm",
            value: topWord || "--",
          },
          {
            id: "subtitle-modules",
            labelKey: "subtitleAnalysis.report.summaryCards.modules",
            value: String(completedCount),
          },
        ],
        findings: findings,
        caveats: caveats,
        warnings: warnings,
        exports: getFeatureReportRecord(project, subtitleFeatureId).exports,
        error: null,
      },
      subtitleFeatureId
    );
  }

  function composeFeatureReport(runtime, project, featureId) {
    if (featureId === audioFeatureId) {
      return composeAudioAnalysisReport(runtime, project);
    }
    if (featureId === subtitleFeatureId) {
      return composeSubtitleAnalysisReport(runtime, project);
    }

    const processRecord = getFeatureProcessRecord(project, featureId);
    if (processRecord.status !== "ready" && processRecord.status !== "stale") {
      return normalizeFeatureReportRecord(
        {
          ...createEmptyFeatureReportRecord(featureId),
          status: processRecord.status === "running" ? "staged" : "idle",
          warnings: processRecord.warnings || [],
        },
        featureId
      );
    }

    const findings = (Array.isArray(processRecord.findings) ? processRecord.findings : [])
      .map(normalizeProcessFinding)
      .sort(function (left, right) {
        return getFindingSeverityRank(right.level) - getFindingSeverityRank(left.level);
      });
    const topLevel = findings[0] ? asNonEmptyString(findings[0].level) || "low" : "low";
    const caveats = [];
    if (featureId === mediaFeatureId) {
      caveats.push("Process findings remain evidence-led but still reflect heuristic interpretation where noted.");
    } else {
      caveats.push("Planned audio modules remain visible but do not pretend to be implemented.");
    }

    return normalizeFeatureReportRecord(
      {
        featureId: featureId,
        status: "ready",
        sourceRunId: processRecord.runId,
        generatedAt: new Date().toISOString(),
        summaryCards: [
          {
            id: `${featureId}-target`,
            labelKey: "mediaAnalysis.profile.summary.target",
            value: asNonEmptyString(toRecord(processRecord.targetSummary).label) || project.name,
          },
          {
            id: `${featureId}-modules`,
            label: "Modules",
            value: String((Array.isArray(processRecord.modules) ? processRecord.modules : []).length),
          },
          {
            id: `${featureId}-findings`,
            labelKey: "mediaAnalysis.profile.summary.signals",
            value: String(findings.length),
          },
          {
            id: `${featureId}-artifacts`,
            labelKey: "mediaAnalysis.profile.summary.artifacts",
            value: String((Array.isArray(processRecord.artifacts) ? processRecord.artifacts : []).length),
          },
          {
            id: `${featureId}-risk`,
            label: "Top risk",
            value: topLevel,
          },
        ],
        findings: findings,
        caveats: caveats,
        warnings: Array.isArray(processRecord.warnings) ? processRecord.warnings : [],
        exports: getFeatureReportRecord(project, featureId).exports,
        error: null,
      },
      featureId
    );
  }

  function getFeatureLabel(featureId) {
    if (featureId === audioFeatureId) {
      return "Audio Analysis";
    }
    if (featureId === subtitleFeatureId) {
      return "Subtitle Analysis";
    }
    return "Media Analysis";
  }

  function buildReportMarkdown(runtime, project, featureId, reportRecord) {
    const lines = [
      `# ${getFeatureLabel(featureId)} Report`,
      "",
      `Project: ${project.name}`,
      `Generated: ${asNonEmptyString(reportRecord.generatedAt) || new Date().toISOString()}`,
      "",
      "## Summary",
    ];

    (Array.isArray(reportRecord.summaryCards) ? reportRecord.summaryCards : []).forEach(function (card) {
      lines.push(`- ${formatReportCardLabel(card)}: ${card.value || "--"}`);
    });

    if (featureId === audioFeatureId) {
      const projection = buildAudioAnalysisReportProjection(runtime, project);
      lines.push("", "## Modules");
      projection.orderedResults.forEach(function (result) {
        const metrics = Array.isArray(result.metrics) ? result.metrics : [];
        const metricsSummary = metrics
          .map(function (metric) {
            return `${asNonEmptyString(metric.label) || formatIdentifierLabel(metric.id)}: ${metric.value || "--"}`;
          })
          .join(", ");
        lines.push(
          `- ${formatIdentifierLabel(result.moduleId)}: ${formatIdentifierLabel(result.status || "idle")}${
            result.summary ? ` - ${result.summary}` : ""
          }`
        );
        if (metricsSummary !== "") {
          lines.push(`  Metrics: ${metricsSummary}`);
        }
        if (Array.isArray(result.blockers) && result.blockers.length > 0) {
          lines.push(`  Blockers: ${result.blockers.join(" | ")}`);
        }
        if (Array.isArray(result.warnings) && result.warnings.length > 0) {
          lines.push(`  Warnings: ${result.warnings.join(" | ")}`);
        }
      });
    } else if (featureId === subtitleFeatureId) {
      lines.push("", "## Modules");
      (Array.isArray(getFeatureProcessRecord(project, featureId).modules)
        ? getFeatureProcessRecord(project, featureId).modules
        : []
      )
        .map(normalizeProcessModule)
        .forEach(function (moduleEntry) {
          lines.push(
            `- ${moduleEntry.title || formatIdentifierLabel(moduleEntry.id)}: ${
              formatIdentifierLabel(moduleEntry.status || "idle")
            }${moduleEntry.summary ? ` - ${moduleEntry.summary}` : ""}`
          );
        });
    }

    lines.push("", "## Findings");
    if (Array.isArray(reportRecord.findings) && reportRecord.findings.length > 0) {
      reportRecord.findings.forEach(function (finding) {
        lines.push(`- ${finding.title || finding.moduleId || "Finding"}: ${finding.detail || ""}`);
      });
    } else {
      lines.push("- No findings were recorded for the active report.");
    }

    if (Array.isArray(reportRecord.caveats) && reportRecord.caveats.length > 0) {
      lines.push("", "## Caveats");
      reportRecord.caveats.forEach(function (entry) {
        lines.push(`- ${entry}`);
      });
    }

    if (Array.isArray(reportRecord.warnings) && reportRecord.warnings.length > 0) {
      lines.push("", "## Warnings");
      reportRecord.warnings.forEach(function (entry) {
        lines.push(`- ${entry}`);
      });
    }

    if (Array.isArray(reportRecord.exports) && reportRecord.exports.length > 0) {
      lines.push("", "## Exports");
      reportRecord.exports.forEach(function (entry) {
        lines.push(`- ${entry.fileName || entry.path || "--"} (${entry.format || "md"}, ${entry.status || "ready"})`);
      });
    }

    return lines.join("\n");
  }

  async function exportFeatureReport(api, runtime, requestId, featureId) {
    const project = getActiveProject(runtime);
    if (project === null) {
      throw new Error("Active project is missing.");
    }

    await ensureProjectDirectories(runtime, project, requestId);
    const reportRecord = composeFeatureReport(runtime, project, featureId);
    if (reportRecord.status !== "ready") {
      throw new Error("Run the process stage before exporting a report.");
    }

    const action = getFeatureReportExportAction(featureId);
    ensureReportJobSlotAvailable(runtime, project.id, action);
    const jobId = `room-report-${featureId}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    registerJob(runtime, {
      jobId: jobId,
      requestId: requestId,
      action: action,
      projectId: project.id,
      featureStage: "report",
    });
    pushJobState(api, {
      requestId: requestId,
      jobId: jobId,
      action: action,
      projectId: project.id,
      featureStage: "report",
      stage: "queued",
      percent: 0,
    });

    try {
      const stamp = new Date().toISOString().replace(/[:.]/g, "-");
      const fileName = `${sanitizeFileSegment(project.slug, "project")}-${featureId}-${stamp}.md`;
      const outputPath = `${getFeatureReportDir(runtime, project, featureId)}/${fileName}`;
      await writeTextFile(outputPath, buildReportMarkdown(runtime, project, featureId, reportRecord));
      const exportEntry = normalizeReportExport({
        format: "md",
        path: outputPath,
        fileName: fileName,
        status: "ready",
      });

      await patchActiveProject(runtime, function (nextProject) {
        const nextReportRecord = composeFeatureReport(runtime, nextProject, featureId);
        nextReportRecord.exports = [exportEntry].concat(
          (Array.isArray(getFeatureReportRecord(nextProject, featureId).exports)
            ? getFeatureReportRecord(nextProject, featureId).exports
            : []
          ).slice(0, 7)
        );
        setFeatureReportRecord(nextProject, featureId, nextReportRecord);
        return nextProject;
      });
      pushJobState(api, {
        requestId: requestId,
        jobId: jobId,
        action: action,
        projectId: project.id,
        featureStage: "report",
        stage: "completed",
        percent: 100,
      });
    } catch (error) {
      await patchActiveProject(runtime, function (nextProject) {
        setFeatureReportRecord(nextProject, featureId, {
          ...getFeatureReportRecord(nextProject, featureId),
          status: "error",
          error: error instanceof Error ? error.message : String(error),
        });
        return nextProject;
      });
      pushJobState(api, {
        requestId: requestId,
        jobId: jobId,
        action: action,
        projectId: project.id,
        featureStage: "report",
        stage: "failed",
        message: error instanceof Error ? error.message : String(error),
      });
      throw error;
    } finally {
      clearJob(runtime, jobId);
    }
  }

  return {
    buildAudioAnalysisReportProjection,
    composeAudioAnalysisReport,
    composeSubtitleAnalysisReport,
    composeFeatureReport,
    buildReportMarkdown,
    exportFeatureReport,
    formatReportCardLabel,
    getProcessArtifactByKind,
  };
}
