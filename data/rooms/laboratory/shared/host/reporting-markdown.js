export function createLaboratoryReportMarkdownRuntime(deps) {
  const {
    asNonEmptyString,
    formatIdentifierLabel,
    toRecord,
    getFeatureProcessRecord,
    normalizeProcessModule,
    buildAudioAnalysisReportProjection,
    audioFeatureId,
    subtitleFeatureId
  } = deps;
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
      `Generated: ${asNonEmptyString(reportRecord.generatedAt) || (/* @__PURE__ */ new Date()).toISOString()}`,
      "",
      "## Summary"
    ];
    (Array.isArray(reportRecord.summaryCards) ? reportRecord.summaryCards : []).forEach(function(card) {
      lines.push(`- ${formatReportCardLabel(card)}: ${card.value || "--"}`);
    });
    if (featureId === audioFeatureId) {
      const projection = buildAudioAnalysisReportProjection(runtime, project);
      lines.push("", "## Modules");
      projection.orderedResults.forEach(function(result) {
        const metrics = Array.isArray(result.metrics) ? result.metrics : [];
        const metricsSummary = metrics.map(function(metric) {
          return `${asNonEmptyString(metric.label) || formatIdentifierLabel(metric.id)}: ${metric.value || "--"}`;
        }).join(", ");
        lines.push(
          `- ${formatIdentifierLabel(result.moduleId)}: ${formatIdentifierLabel(result.status || "idle")}${result.summary ? ` - ${result.summary}` : ""}`
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
      (Array.isArray(getFeatureProcessRecord(project, featureId).modules) ? getFeatureProcessRecord(project, featureId).modules : []).map(normalizeProcessModule).forEach(function(moduleEntry) {
        lines.push(
          `- ${moduleEntry.title || formatIdentifierLabel(moduleEntry.id)}: ${formatIdentifierLabel(moduleEntry.status || "idle")}${moduleEntry.summary ? ` - ${moduleEntry.summary}` : ""}`
        );
      });
    }
    lines.push("", "## Findings");
    if (Array.isArray(reportRecord.findings) && reportRecord.findings.length > 0) {
      reportRecord.findings.forEach(function(finding) {
        lines.push(`- ${finding.title || finding.moduleId || "Finding"}: ${finding.detail || ""}`);
      });
    } else {
      lines.push("- No findings were recorded for the active report.");
    }
    if (Array.isArray(reportRecord.caveats) && reportRecord.caveats.length > 0) {
      lines.push("", "## Caveats");
      reportRecord.caveats.forEach(function(entry) {
        lines.push(`- ${entry}`);
      });
    }
    if (Array.isArray(reportRecord.warnings) && reportRecord.warnings.length > 0) {
      lines.push("", "## Warnings");
      reportRecord.warnings.forEach(function(entry) {
        lines.push(`- ${entry}`);
      });
    }
    if (Array.isArray(reportRecord.exports) && reportRecord.exports.length > 0) {
      lines.push("", "## Exports");
      reportRecord.exports.forEach(function(entry) {
        lines.push(`- ${entry.fileName || entry.path || "--"} (${entry.format || "md"}, ${entry.status || "ready"})`);
      });
    }
    return lines.join("\n");
  }
  return {
    buildReportMarkdown,
    formatReportCardLabel
  };
}
