export function createLaboratoryManagedSubtitleRunnerRuntime(deps: any) {
  const {
    asNonEmptyString,
    buildSubtitleAnalysisStats,
    clone,
    createProcessArtifact,
    createProcessFinding,
    getProjectSubtitleProcessDir,
    normalizeProcessFinding,
    toRecord,
    updateProcessModule,
    writeJsonFile,
    writeTextFile,
  } = deps;

  async function runSubtitleManagedProcess(runtime: any, project: any, target: any, artifactBase: any, processRecord: any) {
    const findings: any[] = [];
    const artifacts: any[] = [];
    const warnings: any[] = [];
    const stats = await buildSubtitleAnalysisStats(runtime, project, target);
    const subtitleProcessDir = getProjectSubtitleProcessDir(runtime, project);
    const summaryPath = `${subtitleProcessDir}/${artifactBase}-subtitle-summary.json`;
    const topWordsPath = `${subtitleProcessDir}/${artifactBase}-top-words.txt`;
    const moduleArtifactIds: Record<string, string[]> = {};

    await writeJsonFile(summaryPath, {
      generatedAt: new Date().toISOString(),
      target: clone(processRecord.targetSummary),
      stats: clone(stats),
    });

    const summaryArtifact = createProcessArtifact(
      "batch-summary",
      "subtitle-summary",
      summaryPath,
      "Subtitle Summary",
      {
        totalFiles: stats.totalFiles,
        totalCues: stats.totalCues,
      }
    );
    if (summaryArtifact) {
      artifacts.push(summaryArtifact);
      moduleArtifactIds["batch-summary"] = [summaryArtifact.id];
    }

    if (Array.isArray(stats.topWords) && stats.topWords.length > 0) {
      await writeTextFile(
        topWordsPath,
        stats.topWords
          .map(function (entry: any) {
            return `${entry.word}\t${entry.count}`;
          })
          .join("\n")
      );
      const topWordsArtifact = createProcessArtifact(
        "lexical-frequency",
        "subtitle-top-words",
        topWordsPath,
        "Top Subtitle Terms",
        {
          topWord: stats.topWords[0] ? stats.topWords[0].word : null,
        }
      );
      if (topWordsArtifact) {
        artifacts.push(topWordsArtifact);
        moduleArtifactIds["lexical-frequency"] = [topWordsArtifact.id];
      }
    }

    for (let index = 0; index < processRecord.modules.length; index += 1) {
      const moduleEntry = toRecord(processRecord.modules[index]);
      const moduleId = asNonEmptyString(moduleEntry.id) || `subtitle-module-${index}`;
      const moduleStatus = asNonEmptyString(moduleEntry.status) || "queued";
      if (["planned", "gated", "blocked", "skipped"].includes(moduleStatus)) {
        continue;
      }

      updateProcessModule(processRecord, moduleId, {
        status: "running",
        percent: 30,
        startedAt: new Date().toISOString(),
      });

      const moduleFindings = [];
      let summary;

      if (moduleId === "format-qc") {
        summary = `${stats.totalCues} cues checked across ${stats.totalFiles} subtitle file(s).`;
        if (stats.totalCues === 0) {
          moduleFindings.push(
            createProcessFinding(
              moduleId,
              "measured",
              "high",
              "medium",
              "No subtitle cues were parsed",
              "The current subtitle selection does not expose parseable cues.",
              stats.totalFiles,
              []
            )
          );
        }
        if (stats.emptyCueCount > 0) {
          moduleFindings.push(
            createProcessFinding(
              moduleId,
              "measured",
              "low",
              "medium",
              "Empty subtitle cues detected",
              `${stats.emptyCueCount} cue(s) contain no visible text after parsing.`,
              stats.emptyCueCount,
              []
            )
          );
        }
      } else if (moduleId === "readability-density") {
        summary = `Average line density is ${Number(stats.averageCharsPerLine || 0).toFixed(1)} chars/line.`;
        if (stats.longLineCount > 0) {
          moduleFindings.push(
            createProcessFinding(
              moduleId,
              "measured",
              stats.longLineCount > 12 ? "high" : "medium",
              "medium",
              "Long subtitle lines found",
              `${stats.longLineCount} line(s) exceed the 42 character readability budget.`,
              stats.longLineCount,
              []
            )
          );
        }
        if (typeof stats.averageCps === "number" && stats.averageCps > 17) {
          moduleFindings.push(
            createProcessFinding(
              moduleId,
              "measured",
              stats.averageCps > 20 ? "high" : "medium",
              "medium",
              "Average subtitle CPS is elevated",
              `Average character density is ${stats.averageCps.toFixed(1)} characters per second.`,
              Math.round(stats.averageCps),
              []
            )
          );
        }
      } else if (moduleId === "cue-timing-structure") {
        summary = `Timing checks found ${stats.overlapCount} overlap(s) and ${stats.invalidDurationCount} invalid duration cue(s).`;
        if (stats.overlapCount > 0) {
          moduleFindings.push(
            createProcessFinding(
              moduleId,
              "measured",
              "high",
              "medium",
              "Subtitle overlaps detected",
              `${stats.overlapCount} cue overlap(s) were found in the active selection.`,
              stats.overlapCount,
              []
            )
          );
        }
        if (stats.invalidDurationCount > 0) {
          moduleFindings.push(
            createProcessFinding(
              moduleId,
              "measured",
              "medium",
              "medium",
              "Invalid cue durations detected",
              `${stats.invalidDurationCount} cue(s) have zero or negative duration.`,
              stats.invalidDurationCount,
              []
            )
          );
        }
      } else if (moduleId === "lexical-frequency") {
        const topWord = stats.topWords[0];
        summary =
          topWord && topWord.word
            ? `Top lexical term is "${topWord.word}" with ${topWord.count} hits.`
            : "No lexical frequency signal was extracted from the active selection.";
      } else if (moduleId === "batch-summary") {
        summary = `${stats.totalFiles} file(s), ${stats.totalCues} cues, ${stats.uniqueFormats.join(", ") || "--"} format(s).`;
        if (stats.uniqueLanguages.length > 1) {
          moduleFindings.push(
            createProcessFinding(
              moduleId,
              "derived",
              "low",
              "medium",
              "Multiple subtitle languages detected",
              `The current selection mixes ${stats.uniqueLanguages.join(", ")} subtitle tracks.`,
              stats.uniqueLanguages.length,
              moduleArtifactIds["batch-summary"] || []
            )
          );
        }
      } else {
        summary = "Subtitle analysis module finished on the current selection.";
      }

      moduleFindings.forEach(function (finding: any) {
        findings.push(normalizeProcessFinding(finding));
      });
      updateProcessModule(processRecord, moduleId, {
        status: "ready",
        percent: 100,
        completedAt: new Date().toISOString(),
        summary: summary || "",
        artifactIds: moduleArtifactIds[moduleId] || [],
        findingIds: moduleFindings.map(function (finding: any) {
          return finding.id;
        }),
      });
    }

    return {
      findings: findings,
      artifacts: artifacts,
      warnings: warnings,
    };
  }

  return {
    runSubtitleManagedProcess,
  };
}
