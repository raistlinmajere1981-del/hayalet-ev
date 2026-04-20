type LaboratoryRecord = Record<string, unknown>;

type LaboratoryProcessRecord = LaboratoryRecord & {
  modules?: unknown;
  targetSummary?: unknown;
};

type LaboratoryProcessModuleRecord = LaboratoryRecord & {
  id?: unknown;
  status?: unknown;
};

type LaboratoryProcessFindingRecord = LaboratoryRecord & {
  id?: unknown;
};

type LaboratoryProcessArtifactRecord = LaboratoryRecord & {
  id?: unknown;
};

type LaboratorySubtitleTopWord = {
  count: number;
  word: string;
};

type LaboratorySubtitleAnalysisStats = {
  averageCharsPerLine: number;
  averageCps: number | null;
  documents?: Array<Record<string, unknown>>;
  emptyCueCount: number;
  invalidDurationCount: number;
  longLineCount: number;
  overlapCount: number;
  topWords: LaboratorySubtitleTopWord[];
  totalCues: number;
  totalFiles: number;
  totalLines?: number;
  uniqueFormats: string[];
  uniqueLanguages: string[];
};

type LaboratoryManagedSubtitleResult = {
  artifacts: LaboratoryProcessArtifactRecord[];
  findings: LaboratoryProcessFindingRecord[];
  warnings: string[];
};

type LaboratoryManagedSubtitleUpdateEmitter = ((payload: LaboratoryRecord) => void) | null;

type LaboratoryManagedSubtitleRunnerDeps = {
  asNonEmptyString: (value: unknown) => string | null;
  buildSubtitleAnalysisStats: (
    runtime: LaboratoryRecord,
    project: LaboratoryRecord,
    target: LaboratoryRecord
  ) => Promise<LaboratorySubtitleAnalysisStats>;
  clone: <T>(value: T) => T;
  createProcessArtifact: (
    moduleId: string,
    kind: string,
    path: string,
    title: string,
    metadata: LaboratoryRecord
  ) => LaboratoryProcessArtifactRecord | null;
  createProcessFinding: (
    moduleId: string,
    kind: string,
    level: string,
    confidence: string,
    title: string,
    detail: string,
    evidenceCount: number,
    artifactIds: string[]
  ) => LaboratoryProcessFindingRecord;
  getProjectSubtitleProcessDir: (runtime: LaboratoryRecord, project: LaboratoryRecord) => string;
  normalizeProcessFinding: (rawValue: unknown) => LaboratoryProcessFindingRecord;
  toRecord: (value: unknown) => LaboratoryRecord;
  updateProcessModule: (
    processRecord: LaboratoryProcessRecord,
    moduleId: string,
    patch: LaboratoryRecord
  ) => LaboratoryProcessRecord;
  writeJsonFile: (filePath: string, payload: unknown) => Promise<unknown> | unknown;
  writeTextFile: (filePath: string, content: string) => Promise<unknown> | unknown;
};

export function createLaboratoryManagedSubtitleRunnerRuntime(
  deps: LaboratoryManagedSubtitleRunnerDeps
) {
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

  function toProcessModuleRecord(value: unknown): LaboratoryProcessModuleRecord {
    return toRecord(value);
  }

  async function runSubtitleManagedProcess(
    runtime: LaboratoryRecord,
    project: LaboratoryRecord,
    target: LaboratoryRecord,
    artifactBase: string,
    processRecord: LaboratoryProcessRecord,
    emitRuntimeUpdate: LaboratoryManagedSubtitleUpdateEmitter = null
  ): Promise<LaboratoryManagedSubtitleResult> {
    const findings: LaboratoryProcessFindingRecord[] = [];
    const artifacts: LaboratoryProcessArtifactRecord[] = [];
    const warnings: string[] = [];
    const stats = await buildSubtitleAnalysisStats(runtime, project, target);
    const subtitleProcessDir = getProjectSubtitleProcessDir(runtime, project);
    const summaryPath = `${subtitleProcessDir}/${artifactBase}-subtitle-summary.json`;
    const topWordsPath = `${subtitleProcessDir}/${artifactBase}-top-words.txt`;
    const aiPayloadPath = `${subtitleProcessDir}/${artifactBase}-ai-payload.json`;
    const channelBatchPath = `${subtitleProcessDir}/${artifactBase}-channel-batch.json`;
    const moduleArtifactIds: Record<string, string[]> = {};
    const documents = Array.isArray(stats.documents) ? stats.documents.map(toRecord) : [];

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
      moduleArtifactIds["batch-summary"] = [String(summaryArtifact.id || "")];
    }

    if (stats.topWords.length > 0) {
      await writeTextFile(
        topWordsPath,
        stats.topWords
          .map(function (entry) {
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
        moduleArtifactIds["lexical-frequency"] = [String(topWordsArtifact.id || "")];
      }
    }

    await writeJsonFile(aiPayloadPath, {
      generatedAt: new Date().toISOString(),
      target: clone(processRecord.targetSummary),
      scope: clone(processRecord["analysisScope"] || null),
      payloadVersion: 1,
      summary: {
        totalFiles: stats.totalFiles,
        totalCues: stats.totalCues,
        totalLines: stats.totalLines || 0,
        averageCharsPerLine: stats.averageCharsPerLine,
        averageCps: stats.averageCps,
        uniqueFormats: stats.uniqueFormats,
        uniqueLanguages: stats.uniqueLanguages,
        topWords: stats.topWords,
      },
      files: documents.map(function (document) {
        return {
          entryId: document["entryId"] || null,
          fileName: document["fileName"] || null,
          format: document["format"] || null,
          language: document["language"] || null,
          cueCount: document["cueCount"] || 0,
          lineCount: document["lineCount"] || 0,
          longLineCount: document["longLineCount"] || 0,
          overlapCount: document["overlapCount"] || 0,
          invalidDurationCount: document["invalidDurationCount"] || 0,
          topWords: document["topWords"] || [],
        };
      }),
    });
    const aiPayloadArtifact = createProcessArtifact(
      "archive-to-ai-payload",
      "subtitle-ai-payload",
      aiPayloadPath,
      "Subtitle AI Payload",
      {
        totalFiles: stats.totalFiles,
        totalCues: stats.totalCues,
      }
    );
    if (aiPayloadArtifact) {
      artifacts.push(aiPayloadArtifact);
      moduleArtifactIds["archive-to-ai-payload"] = [String(aiPayloadArtifact.id || "")];
    }

    await writeJsonFile(channelBatchPath, {
      generatedAt: new Date().toISOString(),
      target: clone(processRecord.targetSummary),
      channelSummary: {
        totalFiles: stats.totalFiles,
        totalCues: stats.totalCues,
        uniqueLanguages: stats.uniqueLanguages,
        uniqueFormats: stats.uniqueFormats,
        repeatedVocabulary: stats.topWords.slice(0, 6),
      },
      files: documents,
    });
    const channelBatchArtifact = createProcessArtifact(
      "channel-batch-analysis",
      "subtitle-channel-batch",
      channelBatchPath,
      "Channel Batch Summary",
      {
        totalFiles: stats.totalFiles,
      }
    );
    if (channelBatchArtifact) {
      artifacts.push(channelBatchArtifact);
      moduleArtifactIds["channel-batch-analysis"] = [String(channelBatchArtifact.id || "")];
    }

    const modules = Array.isArray(processRecord.modules)
      ? processRecord.modules.map(toProcessModuleRecord)
      : [];

    for (let index = 0; index < modules.length; index += 1) {
      const moduleEntry = modules[index];
      if (!moduleEntry) {
        continue;
      }
      const moduleId = asNonEmptyString(moduleEntry.id) || `subtitle-module-${index}`;
      const moduleStatus = asNonEmptyString(moduleEntry.status) || "queued";
      if (["planned", "gated", "blocked", "skipped"].includes(moduleStatus)) {
        continue;
      }

      updateProcessModule(processRecord, moduleId, {
        status: "running",
        startedAt: new Date().toISOString(),
      });
      emitRuntimeUpdate?.({
        kind: "module-progress",
        moduleId,
        message: `${moduleId} module started`,
        moduleTrace: {
          id: `${moduleId}-running-${Date.now()}`,
          moduleId,
          stage: "process",
          status: "running",
          timestamp: new Date().toISOString(),
          message: `${moduleId} module started`,
          detail: null,
        },
        throttleWindow: `${moduleId}-module-batch`,
      });

      const moduleFindings: LaboratoryProcessFindingRecord[] = [];
      let summary: string;

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
      } else if (moduleId === "logical-consistency-check") {
        summary = `Logical consistency sweep reviewed ${stats.totalCues} cue(s) across ${stats.totalFiles} file(s).`;
        moduleArtifactIds[moduleId] = moduleArtifactIds["batch-summary"] || [];
        if (stats.invalidDurationCount + stats.emptyCueCount + stats.overlapCount > 0) {
          moduleFindings.push(
            createProcessFinding(
              moduleId,
              "derived",
              stats.invalidDurationCount + stats.overlapCount > 3 ? "medium" : "low",
              "low",
              "Coarse logical inconsistencies surfaced",
              `Subtitle timing and structural cues surfaced ${
                stats.invalidDurationCount + stats.emptyCueCount + stats.overlapCount
              } logic-adjacent issue marker(s).`,
              stats.invalidDurationCount + stats.emptyCueCount + stats.overlapCount,
              moduleArtifactIds[moduleId]
            )
          );
        }
      } else if (moduleId === "contradiction-detection") {
        const contradictionTokens = ["always", "never", "nobody", "everybody", "true", "false"];
        const presentContradictionTokens = stats.topWords.filter(function (entry) {
          return contradictionTokens.includes(String(entry.word || "").toLowerCase());
        });
        summary = `Contradiction heuristics scanned ${stats.topWords.length} dominant lexical markers.`;
        moduleArtifactIds[moduleId] = moduleArtifactIds["archive-to-ai-payload"] || [];
        if (presentContradictionTokens.length >= 2) {
          moduleFindings.push(
            createProcessFinding(
              moduleId,
              "heuristic",
              "low",
              "low",
              "Contradiction markers detected",
              `Opposing lexical markers (${presentContradictionTokens
                .map(function (entry) {
                  return entry.word;
                })
                .join(", ")}) appeared in the active subtitle selection.`,
              presentContradictionTokens.length,
              moduleArtifactIds[moduleId]
            )
          );
        }
      } else if (moduleId === "narrative-drift") {
        const firstDocument = documents[0] || null;
        const lastDocument = documents[documents.length - 1] || null;
        const firstWords = new Set(
          Array.isArray(firstDocument?.["topWords"])
            ? (firstDocument?.["topWords"] as Array<Record<string, unknown>>).map(function (entry) {
                return String(entry["word"] || "");
              })
            : []
        );
        const lastWords = new Set(
          Array.isArray(lastDocument?.["topWords"])
            ? (lastDocument?.["topWords"] as Array<Record<string, unknown>>).map(function (entry) {
                return String(entry["word"] || "");
              })
            : []
        );
        const sharedWordCount = Array.from(firstWords).filter(function (entry) {
          return lastWords.has(entry);
        }).length;
        summary =
          stats.totalFiles > 1
            ? `Narrative drift compared the first and last subtitle documents across ${stats.totalFiles} files.`
            : "Narrative drift requires multiple subtitle documents for stronger comparison.";
        moduleArtifactIds[moduleId] = moduleArtifactIds["channel-batch-analysis"] || [];
        if (stats.totalFiles > 1 && sharedWordCount <= 1) {
          moduleFindings.push(
            createProcessFinding(
              moduleId,
              "heuristic",
              "low",
              "low",
              "Narrative drift markers detected",
              "Top lexical terms diverge sharply between the beginning and end of the selected subtitle batch.",
              1,
              moduleArtifactIds[moduleId]
            )
          );
        }
      } else if (moduleId === "repetition-structure") {
        const topWord = stats.topWords[0] || null;
        summary =
          topWord && topWord.word
            ? `Repetition analysis centered on "${topWord.word}" with ${topWord.count} hit(s).`
            : "Repetition analysis found no dominant repeated term.";
        moduleArtifactIds[moduleId] = moduleArtifactIds["lexical-frequency"] || [];
        if (topWord && topWord.count >= Math.max(6, Math.round(stats.totalCues * 0.08))) {
          moduleFindings.push(
            createProcessFinding(
              moduleId,
              "derived",
              "low",
              "medium",
              "Repetition structure elevated",
              `The term "${topWord.word}" repeats ${topWord.count} times, suggesting a compressed or slogan-like subtitle structure.`,
              topWord.count,
              moduleArtifactIds[moduleId]
            )
          );
        }
      } else if (moduleId === "semantic-coherence") {
        summary = `Semantic coherence reviewed ${stats.totalFiles} file(s) with ${stats.totalCues} cue(s).`;
        moduleArtifactIds[moduleId] = moduleArtifactIds["archive-to-ai-payload"] || [];
        if (
          (typeof stats.averageCps === "number" && stats.averageCps > 18) ||
          stats.emptyCueCount > 0
        ) {
          moduleFindings.push(
            createProcessFinding(
              moduleId,
              "heuristic",
              "low",
              "low",
              "Semantic coherence may be degraded",
              "High cue density or empty cues suggest the subtitle flow may be harder to follow than a stable narrative pass.",
              Math.max(1, stats.emptyCueCount),
              moduleArtifactIds[moduleId]
            )
          );
        }
      } else if (moduleId === "archive-to-ai-payload") {
        summary = `AI payload export prepared ${stats.totalFiles} file(s) and ${stats.totalCues} cue(s) for downstream analysis.`;
        moduleArtifactIds[moduleId] = moduleArtifactIds["archive-to-ai-payload"] || [];
        if ((moduleArtifactIds[moduleId] || []).length > 0) {
          moduleFindings.push(
            createProcessFinding(
              moduleId,
              "derived",
              "low",
              "medium",
              "AI payload archived",
              "A compact subtitle archive payload is ready for downstream AI review.",
              1,
              moduleArtifactIds[moduleId]
            )
          );
        }
      } else if (moduleId === "channel-batch-analysis") {
        summary =
          stats.totalFiles > 1
            ? `Channel batch analysis summarized ${stats.totalFiles} files into a single archive snapshot.`
            : "Channel batch analysis has only one subtitle file in the current selection.";
        moduleArtifactIds[moduleId] = moduleArtifactIds["channel-batch-analysis"] || [];
        if (stats.totalFiles > 1) {
          moduleFindings.push(
            createProcessFinding(
              moduleId,
              "derived",
              "low",
              "medium",
              "Channel batch archive ready",
              `The current subtitle selection was packaged as a ${stats.totalFiles}-file narrative batch.`,
              stats.totalFiles,
              moduleArtifactIds[moduleId]
            )
          );
        }
      } else {
        summary = "Subtitle analysis module finished on the current selection.";
      }

      moduleFindings.forEach(function (finding) {
        findings.push(normalizeProcessFinding(finding));
      });
      updateProcessModule(processRecord, moduleId, {
        status: "ready",
        completedAt: new Date().toISOString(),
        summary,
        artifactIds: moduleArtifactIds[moduleId] || [],
        findingIds: moduleFindings.map(function (finding) {
          return String(finding.id || "");
        }),
      });
      if (moduleFindings.length > 0) {
        emitRuntimeUpdate?.({
          kind: "live-finding",
          moduleId,
          message: `${moduleId} findings updated`,
          detail:
            moduleFindings.length > 1
              ? `${moduleFindings.length} subtitle findings were aggregated for this module.`
              : asNonEmptyString(toRecord(moduleFindings[0])["detail"]) ||
                asNonEmptyString(toRecord(moduleFindings[0])["title"]) ||
                "Subtitle finding emitted.",
          finding: moduleFindings[0],
          moduleTrace: {
            id: `${moduleId}-finding-${Date.now()}`,
            moduleId,
            stage: "process",
            status: "finding",
            timestamp: new Date().toISOString(),
            message: `${moduleId} findings updated`,
            detail:
              moduleFindings.length > 1
                ? `${moduleFindings.length} subtitle findings were aggregated for this module.`
                : asNonEmptyString(toRecord(moduleFindings[0])["detail"]) ||
                  asNonEmptyString(toRecord(moduleFindings[0])["title"]) ||
                  "Subtitle finding emitted.",
          },
          throttleWindow: `${moduleId}-module-batch`,
        });
      }
      const moduleArtifactId = moduleArtifactIds[moduleId]?.[0] || null;
      const primaryArtifact =
        moduleArtifactId === null
          ? null
          : artifacts.find(function (entry) {
              return String(entry.id || "") === moduleArtifactId;
            }) || null;
      if (primaryArtifact) {
        emitRuntimeUpdate?.({
          kind: "preview-artifact",
          moduleId,
          message: `${moduleId} preview artifact ready`,
          detail: asNonEmptyString(toRecord(primaryArtifact)["label"]),
          artifact: primaryArtifact,
          moduleTrace: {
            id: `${moduleId}-preview-${Date.now()}`,
            moduleId,
            stage: "process",
            status: "preview-ready",
            timestamp: new Date().toISOString(),
            message: `${moduleId} preview artifact ready`,
            detail: asNonEmptyString(toRecord(primaryArtifact)["label"]),
          },
          throttleWindow: `${moduleId}-module-batch`,
        });
      }
      emitRuntimeUpdate?.({
        kind: "module-progress",
        moduleId,
        message: `${moduleId} module completed`,
        detail: summary,
        moduleTrace: {
          id: `${moduleId}-completed-${Date.now()}`,
          moduleId,
          stage: "process",
          status: "ready",
          timestamp: new Date().toISOString(),
          message: `${moduleId} module completed`,
          detail: summary,
        },
        throttleWindow: `${moduleId}-module-batch`,
      });
    }

    return {
      findings,
      artifacts,
      warnings,
    };
  }

  return {
    runSubtitleManagedProcess,
  };
}
