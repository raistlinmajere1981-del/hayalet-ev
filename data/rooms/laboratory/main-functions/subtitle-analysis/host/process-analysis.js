export function createSubtitleProcessAnalysisRuntime(deps) {
  const {
    asNonEmptyString,
    asNumber,
    formatIdentifierLabel,
    getSubtitleAnalysisModuleDescriptors,
    normalizeProcessModule,
    parseSubtitleCues,
    readSubtitleText,
    toRecord
  } = deps;
  function buildSubtitleProcessModules(runtime, target) {
    const capabilities = toRecord(runtime.subtitleAnalysisCapabilities).modules;
    const targetEntries = Array.isArray(target.entries) ? target.entries : [];
    return getSubtitleAnalysisModuleDescriptors(runtime).map(function(entry) {
      const moduleId = asNonEmptyString(entry.id) || `subtitle-module-${Date.now()}`;
      const capability = toRecord(capabilities[moduleId]);
      const configuredStatus = asNonEmptyString(capability.status) || asNonEmptyString(entry.status) || "planned";
      let status = configuredStatus === "ready" || configuredStatus === "implemented" ? "queued" : configuredStatus;
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
        title: asNonEmptyString(entry.label) || formatIdentifierLabel(moduleId),
        status,
        percent: 0,
        summary,
        warnings: [],
        artifactIds: [],
        findingIds: []
      });
    });
  }
  function tokenizeSubtitleWords(textValue) {
    const stopwords = /* @__PURE__ */ new Set([
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
      "kadar"
    ]);
    return String(textValue || "").toLowerCase().replace(/<[^>]+>/g, " ").replace(/[^\p{L}\p{N}'-]+/gu, " ").split(/\s+/).map(function(entry) {
      return entry.trim();
    }).filter(function(entry) {
      return entry.length >= 3 && stopwords.has(entry) !== true;
    });
  }
  function buildSubtitleDocumentStats(entry, rawText) {
    const cues = parseSubtitleCues(rawText, entry.format);
    const textLines = cues.flatMap(function(cue) {
      return Array.isArray(cue.textLines) ? cue.textLines : [];
    });
    const lineLengths = textLines.map(function(line) {
      return String(line || "").trim().length;
    });
    const words = tokenizeSubtitleWords(
      cues.map(function(cue) {
        return cue.text || "";
      }).join(" ")
    );
    const wordFrequency = words.reduce(function(accumulator, word) {
      accumulator[word] = (accumulator[word] || 0) + 1;
      return accumulator;
    }, {});
    let overlapCount = 0;
    let invalidDurationCount = 0;
    let emptyCueCount = 0;
    let totalCps = 0;
    let cpsCount = 0;
    for (let index = 0; index < cues.length; index += 1) {
      const cue = toRecord(cues[index]);
      const nextText = String(cue.text || "").trim();
      const startSeconds = asNumber(cue.startSeconds);
      const endSeconds = asNumber(cue.endSeconds);
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
          if (asNumber(previousCue.endSeconds) !== null && startSeconds < asNumber(previousCue.endSeconds)) {
            overlapCount += 1;
          }
        }
      }
    }
    const topWords = Object.keys(wordFrequency).map(function(word) {
      return {
        word,
        count: wordFrequency[word]
      };
    }).sort(function(left, right) {
      return right.count - left.count || left.word.localeCompare(right.word);
    }).slice(0, 8);
    return {
      entryId: entry.id,
      fileName: entry.fileName,
      format: entry.format,
      language: entry.language,
      cueCount: cues.length,
      lineCount: textLines.length,
      maxLineLength: lineLengths.reduce(function(maxValue, lineLength) {
        return Math.max(maxValue, lineLength);
      }, 0),
      longLineCount: lineLengths.filter(function(lineLength) {
        return lineLength > 42;
      }).length,
      overlapCount,
      invalidDurationCount,
      emptyCueCount,
      averageCharsPerLine: lineLengths.length > 0 ? lineLengths.reduce(function(sum, lineLength) {
        return sum + lineLength;
      }, 0) / lineLengths.length : 0,
      averageCps: cpsCount > 0 ? totalCps / cpsCount : null,
      wordCount: words.length,
      vocabularySize: Object.keys(wordFrequency).length,
      topWords
    };
  }
  async function buildSubtitleAnalysisStats(runtime, project, target) {
    const entries = Array.isArray(target.entries) ? target.entries : [];
    const documents = [];
    for (let index = 0; index < entries.length; index += 1) {
      const entry = entries[index];
      if (entry && entry.path) {
        const rawText = await readSubtitleText(entry.path);
        documents.push(buildSubtitleDocumentStats(entry, rawText));
      }
    }
    const topWords = documents.flatMap(function(document) {
      return Array.isArray(document.topWords) ? document.topWords : [];
    }).reduce(function(accumulator, entry) {
      accumulator[entry.word] = (accumulator[entry.word] || 0) + (Number(entry.count) || 0);
      return accumulator;
    }, {});
    void runtime;
    void project;
    return {
      documents,
      totalFiles: documents.length,
      totalCues: documents.reduce(function(sum, document) {
        return sum + document.cueCount;
      }, 0),
      totalLines: documents.reduce(function(sum, document) {
        return sum + document.lineCount;
      }, 0),
      longLineCount: documents.reduce(function(sum, document) {
        return sum + document.longLineCount;
      }, 0),
      overlapCount: documents.reduce(function(sum, document) {
        return sum + document.overlapCount;
      }, 0),
      invalidDurationCount: documents.reduce(function(sum, document) {
        return sum + document.invalidDurationCount;
      }, 0),
      emptyCueCount: documents.reduce(function(sum, document) {
        return sum + document.emptyCueCount;
      }, 0),
      averageCharsPerLine: documents.length > 0 ? documents.reduce(function(sum, document) {
        return sum + document.averageCharsPerLine;
      }, 0) / documents.length : 0,
      averageCps: documents.filter(function(document) {
        return typeof document.averageCps === "number";
      }).length > 0 ? documents.reduce(function(sum, document) {
        return sum + (typeof document.averageCps === "number" ? document.averageCps : 0);
      }, 0) / documents.filter(function(document) {
        return typeof document.averageCps === "number";
      }).length : null,
      uniqueFormats: Array.from(
        new Set(
          documents.map(function(document) {
            return asNonEmptyString(document.format);
          }).filter(Boolean)
        )
      ),
      uniqueLanguages: Array.from(
        new Set(
          documents.map(function(document) {
            return asNonEmptyString(document.language);
          }).filter(Boolean)
        )
      ),
      topWords: Object.keys(topWords).map(function(word) {
        return {
          word,
          count: topWords[word]
        };
      }).sort(function(left, right) {
        return right.count - left.count || left.word.localeCompare(right.word);
      }).slice(0, 10)
    };
  }
  return {
    buildSubtitleAnalysisStats,
    buildSubtitleProcessModules
  };
}
