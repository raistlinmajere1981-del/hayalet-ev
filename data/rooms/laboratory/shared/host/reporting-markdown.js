export function createLaboratoryReportMarkdownRuntime(deps) {
  const {
    asNonEmptyString,
    audioFeatureId,
    buildAudioAnalysisReportProjection,
    formatIdentifierLabel,
    getFeatureProcessRecord,
    normalizeProcessModule,
    subtitleFeatureId,
    toRecord
  } = deps;
  function toProjectRecord(value) {
    return toRecord(value);
  }
  function toReportCardRecord(value) {
    return toRecord(value);
  }
  function toFeatureReportRecord(value) {
    return toRecord(value);
  }
  function toFeatureProcessRecord(value) {
    return toRecord(value);
  }
  function toProcessModuleRecord(value) {
    return toRecord(value);
  }
  function toFindingRecord(value) {
    return toRecord(value);
  }
  function toExportRecord(value) {
    return toRecord(value);
  }
  function toMetricRecord(value) {
    return toRecord(value);
  }
  function toAudioModuleResultRecord(value) {
    return toRecord(value);
  }
  function toString(value, fallback = "") {
    if (typeof value === "string") {
      return value;
    }
    if (typeof value === "number" || typeof value === "boolean") {
      return String(value);
    }
    return fallback;
  }
  function toStringArray(value) {
    if (!Array.isArray(value)) {
      return [];
    }
    return value.map(function(entry) {
      const stringValue = toString(entry).trim();
      return stringValue !== "" ? stringValue : null;
    }).filter((entry) => entry !== null);
  }
  function formatValue(value) {
    const stringValue = toString(value).trim();
    return stringValue !== "" ? stringValue : "--";
  }
  function formatReportCardLabel(card) {
    const label = asNonEmptyString(card.label);
    if (label !== null) {
      return label;
    }
    const labelKey = asNonEmptyString(card.labelKey);
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
  function getSubtitleProcessModules(project, featureId) {
    const processRecord = toFeatureProcessRecord(getFeatureProcessRecord(project, featureId));
    return Array.isArray(processRecord.modules) ? processRecord.modules.map(normalizeProcessModule).map(toProcessModuleRecord) : [];
  }
  function buildReportMarkdown(runtime, project, featureId, reportRecord) {
    const projectRecord = toProjectRecord(project);
    const normalizedReportRecord = toFeatureReportRecord(reportRecord);
    const userReport = toRecord(normalizedReportRecord.userReport);
    const emptyReason = asNonEmptyString(normalizedReportRecord["emptyReason"]);
    const lines = [
      `# ${getFeatureLabel(featureId)} Report`,
      "",
      `Project: ${asNonEmptyString(projectRecord.name) || "--"}`,
      `Generated: ${asNonEmptyString(normalizedReportRecord.generatedAt) || (/* @__PURE__ */ new Date()).toISOString()}`,
      "",
      "## Summary"
    ];
    if (asNonEmptyString(userReport["summary"]) !== null) {
      lines.push(asNonEmptyString(userReport["summary"]) || "--");
      lines.push("");
      lines.push(`Confidence: ${formatValue(userReport["confidence"])}`);
    } else {
      const summaryCards = Array.isArray(normalizedReportRecord.summaryCards) ? normalizedReportRecord.summaryCards.map(toReportCardRecord) : [];
      summaryCards.forEach(function(card) {
        lines.push(`- ${formatReportCardLabel(card)}: ${formatValue(card.value)}`);
      });
      if (summaryCards.length === 0 && emptyReason !== null) {
        lines.push(emptyReason);
      }
    }
    if (featureId === audioFeatureId) {
      const projection = buildAudioAnalysisReportProjection(runtime, projectRecord);
      lines.push("", "## Modules");
      projection.orderedResults.map(toAudioModuleResultRecord).forEach(function(result) {
        const metrics = Array.isArray(result.metrics) ? result.metrics.map(toMetricRecord) : [];
        const metricsSummary = metrics.map(function(metric) {
          const label = asNonEmptyString(metric.label) || formatIdentifierLabel(toString(metric.id));
          return `${label}: ${formatValue(metric.value)}`;
        }).filter(Boolean).join(", ");
        lines.push(
          `- ${formatIdentifierLabel(toString(result.moduleId, "module"))}: ${formatIdentifierLabel(
            toString(result.status, "idle")
          )}${toString(result.summary) !== "" ? ` - ${toString(result.summary)}` : ""}`
        );
        const blockers = toStringArray(result.blockers);
        const warnings2 = toStringArray(result.warnings);
        if (metricsSummary !== "") {
          lines.push(`  Metrics: ${metricsSummary}`);
        }
        if (blockers.length > 0) {
          lines.push(`  Blockers: ${blockers.join(" | ")}`);
        }
        if (warnings2.length > 0) {
          lines.push(`  Warnings: ${warnings2.join(" | ")}`);
        }
      });
    } else if (featureId === subtitleFeatureId) {
      lines.push("", "## Modules");
      getSubtitleProcessModules(projectRecord, subtitleFeatureId).forEach(function(moduleEntry) {
        lines.push(
          `- ${toString(moduleEntry.title) || formatIdentifierLabel(toString(moduleEntry.id, "module"))}: ${formatIdentifierLabel(
            toString(moduleEntry.status, "idle")
          )}${toString(moduleEntry.summary) !== "" ? ` - ${toString(moduleEntry.summary)}` : ""}`
        );
      });
    }
    lines.push("", "## Findings");
    const findings = Array.isArray(userReport["topFindings"]) ? userReport["topFindings"].map(toFindingRecord) : Array.isArray(normalizedReportRecord.findings) ? normalizedReportRecord.findings.map(toFindingRecord) : [];
    if (findings.length > 0) {
      findings.forEach(function(finding) {
        lines.push(
          `- ${toString(finding.title) || toString(finding.moduleId) || "Finding"}: ${toString(
            finding.detail
          )}${asNonEmptyString(finding.confidence) ? ` (${toString(finding.confidence)})` : ""}`
        );
        const evidence = toStringArray(finding.evidence);
        if (evidence.length > 0) {
          lines.push(`  Evidence: ${evidence.join(" | ")}`);
        }
      });
    } else {
      lines.push(`- ${emptyReason || "No findings were recorded for the active report."}`);
    }
    const caveats = toStringArray(normalizedReportRecord.caveats);
    if (caveats.length > 0) {
      lines.push("", "## Caveats");
      caveats.forEach(function(entry) {
        lines.push(`- ${entry}`);
      });
    }
    const warnings = toStringArray(normalizedReportRecord.warnings);
    if (warnings.length > 0) {
      lines.push("", "## Warnings");
      warnings.forEach(function(entry) {
        lines.push(`- ${entry}`);
      });
    }
    const exports = Array.isArray(normalizedReportRecord.exports) ? normalizedReportRecord.exports.map(toExportRecord) : [];
    if (exports.length > 0) {
      lines.push("", "## Exports");
      exports.forEach(function(entry) {
        lines.push(
          `- ${toString(entry.fileName) || toString(entry.path) || "--"} (${toString(
            entry.format,
            "md"
          )}, ${toString(entry.status, "ready")})`
        );
      });
    }
    return lines.join("\n");
  }
  return {
    buildReportMarkdown,
    formatReportCardLabel
  };
}
