type SubtitleProcessAnalysisRuntimeDeps = {
  asNonEmptyString: (value: unknown) => string | null;
  asNumber: (value: unknown) => number | null;
  formatIdentifierLabel: (value: unknown) => string;
  getSubtitleAnalysisModuleDescriptors: (
    runtime: Record<string, unknown>
  ) => Record<string, unknown>[];
  normalizeProcessModule: (value: unknown) => Record<string, unknown>;
  parseSubtitleCues: (
    rawText: string,
    format: string
  ) => Array<{
    id: string;
    startSeconds: number | null;
    endSeconds: number | null;
    textLines: string[];
    text: string;
  }>;
  readSubtitleText: (filePath: string) => Promise<string>;
  toRecord: (value: unknown) => Record<string, unknown>;
};

export function createSubtitleProcessAnalysisRuntime(deps: SubtitleProcessAnalysisRuntimeDeps) {
  const {
    asNonEmptyString,
    asNumber,
    formatIdentifierLabel,
    getSubtitleAnalysisModuleDescriptors,
    normalizeProcessModule,
    parseSubtitleCues,
    readSubtitleText,
    toRecord,
  } = deps;
  type SubtitleTopWord = { word: string; count: number };
  type SubtitleDocumentStats = {
    entryId: unknown;
    fileName: unknown;
    format: unknown;
    language: unknown;
    cueCount: number;
    lineCount: number;
    maxLineLength: number;
    longLineCount: number;
    overlapCount: number;
    invalidDurationCount: number;
    emptyCueCount: number;
    averageCharsPerLine: number;
    averageCps: number | null;
    wordCount: number;
    vocabularySize: number;
    topWords: SubtitleTopWord[];
  };

  function buildSubtitleProcessModules(
    runtime: Record<string, unknown>,
    target: Record<string, unknown>
  ) {
    const capabilities = toRecord(runtime["subtitleAnalysisCapabilities"])["modules"];
    const targetEntries = Array.isArray(target["entries"]) ? target["entries"] : [];

    return getSubtitleAnalysisModuleDescriptors(runtime).map(function (
      entry: Record<string, unknown>
    ) {
      const moduleId = asNonEmptyString(entry["id"]) || `subtitle-module-${Date.now()}`;
      const capability = toRecord((capabilities as Record<string, unknown>)[moduleId]);
      const configuredStatus =
        asNonEmptyString(capability["status"]) || asNonEmptyString(entry["status"]) || "planned";
      let status =
        configuredStatus === "ready" || configuredStatus === "implemented"
          ? "queued"
          : configuredStatus;
      let summary = "Reserved for the later subtitle rollout.";

      if (targetEntries.length === 0) {
        status = "blocked";
        summary = "Import subtitle files before running subtitle analysis.";
      } else if (configuredStatus === "planned") {
        status = "planned";
        summary = "Reserved for the next subtitle analysis rollout.";
      } else if (configuredStatus === "ready" || configuredStatus === "implemented") {
        summary = "Queued for the local subtitle analysis run.";
      }

      return normalizeProcessModule({
        id: moduleId,
        title: asNonEmptyString(entry["label"]) || formatIdentifierLabel(moduleId),
        status: status,
        percent: 0,
        summary: summary,
        warnings: [],
        artifactIds: [],
        findingIds: [],
      });
    });
  }

  function tokenizeSubtitleWords(textValue: string): string[] {
    const stopwords = new Set([
      "the",
      "and",
      "for",
      "that",
      "with",
      "this",
      "you",
      "your",
      "from",
      "have",
      "are",
      "bir",
      "ve",
      "ile",
      "bu",
      "icin",
      "için",
      "ama",
      "gibi",
      "daha",
      "cok",
      "çok",
      "kadar",
    ]);

    return String(textValue || "")
      .toLowerCase()
      .replace(/<[^>]+>/g, " ")
      .replace(/[^\p{L}\p{N}'-]+/gu, " ")
      .split(/\s+/)
      .map(function (entry: string) {
        return entry.trim();
      })
      .filter(function (entry: string) {
        return entry.length >= 3 && stopwords.has(entry) !== true;
      });
  }

  function buildSubtitleDocumentStats(entry: Record<string, unknown>, rawText: string) {
    const cues = parseSubtitleCues(rawText, String(entry["format"] || ""));
    const textLines = cues.flatMap(function (cue: { textLines: string[] }) {
      return Array.isArray(cue.textLines) ? cue.textLines : [];
    });
    const lineLengths = textLines.map(function (line: string) {
      return String(line || "").trim().length;
    });
    const words = tokenizeSubtitleWords(
      cues
        .map(function (cue: { text: string }) {
          return cue.text || "";
        })
        .join(" ")
    );
    const wordFrequency = words.reduce(
      function (accumulator: Record<string, number>, word: string) {
        accumulator[word] = (accumulator[word] || 0) + 1;
        return accumulator;
      },
      {} as Record<string, number>
    );
    let overlapCount = 0;
    let invalidDurationCount = 0;
    let emptyCueCount = 0;
    let totalCps = 0;
    let cpsCount = 0;

    for (let index = 0; index < cues.length; index += 1) {
      const cue = toRecord(cues[index]);
      const nextText = String(cue["text"] || "").trim();
      const startSeconds = asNumber(cue["startSeconds"]);
      const endSeconds = asNumber(cue["endSeconds"]);

      if (nextText === "") {
        emptyCueCount += 1;
      }
      if (startSeconds !== null && endSeconds !== null) {
        if (endSeconds <= startSeconds) {
          invalidDurationCount += 1;
        } else {
          totalCps += nextText.length / Math.max(0.01, endSeconds - startSeconds);
          cpsCount += 1;
        }
        if (index > 0) {
          const previousCue = toRecord(cues[index - 1]);
          const previousEnd = asNumber(previousCue["endSeconds"]);
          if (previousEnd !== null && startSeconds < previousEnd) {
            overlapCount += 1;
          }
        }
      }
    }

    const topWords = Object.keys(wordFrequency)
      .map(function (word: string) {
        return {
          word: word,
          count: wordFrequency[word] ?? 0,
        };
      })
      .sort(function (
        left: { count: number; word: string },
        right: { count: number; word: string }
      ) {
        return right.count - left.count || left.word.localeCompare(right.word);
      })
      .slice(0, 8);

    return {
      entryId: entry["id"],
      fileName: entry["fileName"],
      format: entry["format"],
      language: entry["language"],
      cueCount: cues.length,
      lineCount: textLines.length,
      maxLineLength: lineLengths.reduce(function (maxValue: number, lineLength: number) {
        return Math.max(maxValue, lineLength);
      }, 0),
      longLineCount: lineLengths.filter(function (lineLength: number) {
        return lineLength > 42;
      }).length,
      overlapCount: overlapCount,
      invalidDurationCount: invalidDurationCount,
      emptyCueCount: emptyCueCount,
      averageCharsPerLine:
        lineLengths.length > 0
          ? lineLengths.reduce(function (sum: number, lineLength: number) {
              return sum + lineLength;
            }, 0) / lineLengths.length
          : 0,
      averageCps: cpsCount > 0 ? totalCps / cpsCount : null,
      wordCount: words.length,
      vocabularySize: Object.keys(wordFrequency).length,
      topWords: topWords,
    };
  }

  async function buildSubtitleAnalysisStats(
    runtime: Record<string, unknown>,
    project: Record<string, unknown>,
    target: Record<string, unknown>
  ) {
    const entries = Array.isArray(target["entries"]) ? target["entries"] : [];
    const documents: SubtitleDocumentStats[] = [];

    for (let index = 0; index < entries.length; index += 1) {
      const entry = entries[index];
      if (entry && entry.path) {
        // eslint-disable-next-line no-await-in-loop -- NOTE: keep subtitle reads aligned with source entry order.
        const rawText = await readSubtitleText(entry.path);
        documents.push(buildSubtitleDocumentStats(entry, rawText));
      }
    }

    const topWords = documents
      .flatMap(function (document: SubtitleDocumentStats): SubtitleTopWord[] {
        return Array.isArray(document.topWords) ? document.topWords : [];
      })
      .reduce(
        function (accumulator: Record<string, number>, entry: SubtitleTopWord) {
          accumulator[entry.word] = (accumulator[entry.word] || 0) + (Number(entry.count) || 0);
          return accumulator;
        },
        {} as Record<string, number>
      );

    void runtime;
    void project;

    return {
      documents: documents,
      totalFiles: documents.length,
      totalCues: documents.reduce(function (sum: number, document: { cueCount: number }) {
        return sum + document.cueCount;
      }, 0),
      totalLines: documents.reduce(function (sum: number, document: { lineCount: number }) {
        return sum + document.lineCount;
      }, 0),
      longLineCount: documents.reduce(function (sum: number, document: { longLineCount: number }) {
        return sum + document.longLineCount;
      }, 0),
      overlapCount: documents.reduce(function (sum: number, document: { overlapCount: number }) {
        return sum + document.overlapCount;
      }, 0),
      invalidDurationCount: documents.reduce(function (
        sum: number,
        document: { invalidDurationCount: number }
      ) {
        return sum + document.invalidDurationCount;
      }, 0),
      emptyCueCount: documents.reduce(function (sum: number, document: { emptyCueCount: number }) {
        return sum + document.emptyCueCount;
      }, 0),
      averageCharsPerLine:
        documents.length > 0
          ? documents.reduce(function (sum: number, document: { averageCharsPerLine: number }) {
              return sum + document.averageCharsPerLine;
            }, 0) / documents.length
          : 0,
      averageCps:
        documents.filter(function (document: { averageCps: number | null }) {
          return typeof document.averageCps === "number";
        }).length > 0
          ? documents.reduce(function (sum: number, document: { averageCps: number | null }) {
              return sum + (typeof document.averageCps === "number" ? document.averageCps : 0);
            }, 0) /
            documents.filter(function (document: { averageCps: number | null }) {
              return typeof document.averageCps === "number";
            }).length
          : null,
      uniqueFormats: Array.from(
        new Set(
          documents
            .map(function (document: { format: unknown }) {
              return asNonEmptyString(document.format);
            })
            .filter(Boolean)
        )
      ),
      uniqueLanguages: Array.from(
        new Set(
          documents
            .map(function (document: { language: unknown }) {
              return asNonEmptyString(document.language);
            })
            .filter(Boolean)
        )
      ),
      topWords: Object.keys(topWords)
        .map(function (word: string) {
          return {
            word: word,
            count: topWords[word] ?? 0,
          };
        })
        .sort(function (
          left: { count: number; word: string },
          right: { count: number; word: string }
        ) {
          return right.count - left.count || left.word.localeCompare(right.word);
        })
        .slice(0, 10),
    };
  }

  return {
    buildSubtitleAnalysisStats,
    buildSubtitleProcessModules,
  };
}
