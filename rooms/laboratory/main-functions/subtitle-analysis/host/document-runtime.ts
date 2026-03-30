export function createSubtitleDocumentRuntime(deps: {
  asNonEmptyString: (value: unknown) => string | null;
  asNumber: (value: unknown) => number | null;
  toRecord: (value: unknown) => Record<string, unknown>;
}) {
  const { asNonEmptyString, asNumber, toRecord } = deps;

  function normalizeSubtitleText(rawText: unknown) {
    return String(rawText || "").replace(/\r\n/g, "\n");
  }

  function applySubtitleTextCleanup(textValue: unknown, recipe: unknown) {
    let nextValue = String(textValue || "");
    const config = toRecord(recipe);

    if (config["stripHtml"] === true) {
      nextValue = nextValue.replace(/<[^>]+>/g, "");
    }
    if (config["removeMusicTags"] === true) {
      nextValue = nextValue
        .replace(/\[[^\]]*music[^\]]*\]/gi, "")
        .replace(/\([^)]*music[^)]*\)/gi, "")
        .replace(/[♪♫]+/g, "");
    }
    if (config["normalizeQuotes"] === true) {
      nextValue = nextValue.replace(/["""]/g, '"').replace(/[''']/g, "'");
    }
    if (config["trimWhitespace"] === true) {
      nextValue = nextValue
        .split("\n")
        .map(function (line: string) {
          return line.trim().replace(/[ \t]{2,}/g, " ");
        })
        .join("\n");
    }
    return nextValue;
  }

  function wrapSubtitleLines(lines: unknown, maxCharsPerLine: unknown) {
    const limit = Math.max(10, Math.round(asNumber(maxCharsPerLine) || 42));
    return (Array.isArray(lines) ? lines : [String(lines || "")]).reduce(function (
      accumulator: string[],
      lineValue: unknown
    ) {
      const line = String(lineValue || "").trim();
      if (line === "") {
        return accumulator;
      }
      if (line.length <= limit) {
        accumulator.push(line);
        return accumulator;
      }

      let currentLine = "";
      line.split(/\s+/).forEach(function (word: string) {
        if (currentLine === "") {
          currentLine = word;
          return;
        }
        if (`${currentLine} ${word}`.length <= limit) {
          currentLine = `${currentLine} ${word}`;
          return;
        }
        accumulator.push(currentLine);
        currentLine = word;
      });
      if (currentLine !== "") {
        accumulator.push(currentLine);
      }
      return accumulator;
    }, [] as string[]);
  }

  function transformSubtitleCueLines(lines: unknown, recipe: unknown) {
    const config = toRecord(recipe);
    let nextLines = (Array.isArray(lines) ? lines : []).map(function (line: unknown) {
      return applySubtitleTextCleanup(line, config);
    });

    if (config["mergeShortCues"] === true) {
      nextLines = [
        nextLines
          .join(" ")
          .replace(/[ \t]{2,}/g, " ")
          .trim(),
      ];
    }
    if (config["splitLongLines"] === true) {
      nextLines = wrapSubtitleLines(nextLines, config["maxCharsPerLine"]);
    }

    return nextLines.filter(function (line: unknown) {
      return String(line || "").trim() !== "";
    });
  }

  function parseSubtitleTimestamp(rawValue: unknown) {
    const normalized = asNonEmptyString(rawValue);
    if (normalized === null) {
      return null;
    }

    const cleaned = normalized.replace(",", ".").trim();
    const parts = cleaned.split(":").map(function (entry: string) {
      return entry.trim();
    });
    if (parts.length < 2 || parts.length > 3) {
      return null;
    }

    const secondsToken = parts.pop();
    const minutesToken = parts.pop();
    const hoursToken = parts.pop() || "0";
    const seconds = Number(secondsToken);
    const minutes = Number(minutesToken);
    const hours = Number(hoursToken);
    if (
      [hours, minutes, seconds].some(function (entry: number) {
        return Number.isFinite(entry) !== true;
      })
    ) {
      return null;
    }
    return hours * 3600 + minutes * 60 + seconds;
  }

  function splitAssDialogueFields(payload: string) {
    const fields: string[] = [];
    let buffer = "";
    let commaCount = 0;

    for (let cursor = 0; cursor < payload.length; cursor += 1) {
      const char = payload[cursor];
      if (char === "," && commaCount < 9) {
        fields.push(buffer);
        buffer = "";
        commaCount += 1;
      } else {
        buffer += char;
      }
    }

    fields.push(buffer);
    return fields;
  }

  function parseSubtitleCues(rawText: unknown, format: unknown) {
    const normalized = normalizeSubtitleText(rawText);
    const nextFormat = asNonEmptyString(format) || "srt";

    if (nextFormat === "ass" || nextFormat === "ssa") {
      return normalized
        .split("\n")
        .map(function (line: string) {
          return line.trim();
        })
        .filter(function (line: string) {
          return /^Dialogue:/i.test(line);
        })
        .map(function (line: string, index: number) {
          const payload = line.replace(/^Dialogue:\s*/i, "");
          const fields = splitAssDialogueFields(payload);
          const cueText = String(fields[9] || "")
            .replace(/\\N/g, "\n")
            .replace(/\{[^}]+\}/g, "");
          const textLines = cueText
            .split("\n")
            .map(function (entry: string) {
              return entry.trim();
            })
            .filter(Boolean);
          return {
            id: `ass-cue-${index}`,
            startSeconds: parseSubtitleTimestamp(fields[1]),
            endSeconds: parseSubtitleTimestamp(fields[2]),
            textLines: textLines,
            text: textLines.join(" "),
          };
        });
    }

    return normalized
      .split(/\n{2,}/)
      .map(function (block: string) {
        return block.trim();
      })
      .filter(Boolean)
      .map(function (block: string, index: number) {
        const lines = block.split("\n");
        const timingIndex = lines.findIndex(function (line: string) {
          return line.indexOf("-->") >= 0;
        });
        if (timingIndex === -1) {
          return null;
        }
        const timingLine = lines[timingIndex];
        if (timingLine === undefined) {
          return null;
        }
        const match = timingLine.match(/(.+?)\s*-->\s*(.+?)(?:\s+.+)?$/);
        const textLines = lines
          .slice(timingIndex + 1)
          .map(function (line: string) {
            return line.trim();
          })
          .filter(Boolean);
        return {
          id: `subtitle-cue-${index}`,
          startSeconds: parseSubtitleTimestamp(match ? match[1] : null),
          endSeconds: parseSubtitleTimestamp(match ? match[2] : null),
          textLines: textLines,
          text: textLines.join(" "),
        };
      })
      .filter(Boolean);
  }

  function formatSubtitleRenderTimestamp(secondsValue: unknown, format: string) {
    const totalMs = Math.max(0, Math.round((Number(secondsValue) || 0) * 1000));
    const hours = Math.floor(totalMs / 3600000);
    const minutes = Math.floor((totalMs % 3600000) / 60000);
    const seconds = Math.floor((totalMs % 60000) / 1000);
    const milliseconds = totalMs % 1000;
    const separator = format === "srt" ? "," : ".";
    return (
      [
        String(hours).padStart(2, "0"),
        String(minutes).padStart(2, "0"),
        String(seconds).padStart(2, "0"),
      ].join(":") + `${separator}${String(milliseconds).padStart(3, "0")}`
    );
  }

  function buildNormalizedSubtitleCueModel(rawText: unknown, format: unknown, recipe: unknown) {
    return parseSubtitleCues(rawText, format)
      .map(function (cue: any, index: number) {
        if (!cue) {
          return null;
        }
        const nextLines = transformSubtitleCueLines(cue.textLines, recipe);
        return {
          id: cue.id || `subtitle-cue-${index}`,
          startSeconds: cue.startSeconds,
          endSeconds: cue.endSeconds,
          textLines: nextLines,
          text: nextLines.join(" "),
        };
      })
      .filter(function (cue: any) {
        return cue && cue.textLines.length > 0;
      });
  }

  function serializeSubtitleCueModel(cues: unknown, format: unknown) {
    const nextFormat = asNonEmptyString(format) || "srt";
    if (nextFormat === "json") {
      return JSON.stringify(Array.isArray(cues) ? cues : [], null, 2);
    }

    const blocks = (Array.isArray(cues) ? cues : []).map(function (cue: any, index: number) {
      const startToken = formatSubtitleRenderTimestamp(cue.startSeconds, nextFormat);
      const endToken = formatSubtitleRenderTimestamp(cue.endSeconds, nextFormat);
      const header = `${startToken} --> ${endToken}`;
      const textLines = Array.isArray(cue.textLines) ? cue.textLines : [String(cue.text || "")];

      if (nextFormat === "vtt") {
        return [header].concat(textLines).join("\n");
      }
      return [String(index + 1), header].concat(textLines).join("\n");
    });

    return `${nextFormat === "vtt" ? "WEBVTT\n\n" : ""}${blocks.join("\n\n")}`.trim();
  }

  function resolveSubtitleOutputFormat(sourceFormat: unknown, outputFormatValue: unknown) {
    const requested = asNonEmptyString(outputFormatValue) || "source";
    if (requested === "source") {
      return asNonEmptyString(sourceFormat) || "srt";
    }
    return requested === "json" || requested === "vtt" || requested === "srt" ? requested : "srt";
  }

  function transformSubtitleDocument(
    rawText: unknown,
    format: unknown,
    recipe: unknown,
    outputFormatValue: unknown
  ) {
    const normalized = normalizeSubtitleText(rawText);
    const nextFormat = asNonEmptyString(format) || "srt";
    const outputFormat = resolveSubtitleOutputFormat(
      nextFormat,
      outputFormatValue || toRecord(recipe)["outputFormat"]
    );

    if (outputFormat !== nextFormat || outputFormat === "json") {
      return serializeSubtitleCueModel(
        buildNormalizedSubtitleCueModel(normalized, nextFormat, recipe),
        outputFormat
      );
    }

    if (nextFormat === "ass" || nextFormat === "ssa") {
      const transformedLines = normalized.split("\n").map(function (line: string) {
        if (/^Dialogue:/i.test(line) !== true) {
          return line;
        }

        const payload = line.replace(/^Dialogue:\s*/i, "");
        const fields = splitAssDialogueFields(payload);
        const textLines = String(fields[9] || "")
          .replace(/\\N/g, "\n")
          .split("\n");
        const nextText = transformSubtitleCueLines(textLines, recipe).join("\\N");
        return `Dialogue: ${fields.slice(0, 9).join(",")},${nextText}`;
      });

      return transformedLines.join("\n");
    }

    const transformedBlocks = normalized
      .split(/\n{2,}/)
      .map(function (block: string) {
        return block.trim();
      })
      .filter(Boolean)
      .map(function (block: string) {
        const lines = block.split("\n");
        const timingIndex = lines.findIndex(function (line: string) {
          return line.indexOf("-->") >= 0;
        });
        if (timingIndex === -1) {
          return block;
        }

        const headerLines = lines.slice(0, timingIndex + 1);
        const textLines = lines.slice(timingIndex + 1);
        const transformedTextLines = transformSubtitleCueLines(textLines, recipe);
        return headerLines.concat(transformedTextLines).join("\n");
      });

    let nextValue = transformedBlocks.join("\n\n");
    if (toRecord(recipe)["collapseBlankLines"] === true) {
      nextValue = nextValue.replace(/\n{3,}/g, "\n\n");
    }
    return nextValue.trim() === "" ? normalized.trim() : nextValue;
  }

  function buildSubtitleEditSummary(
    sourceText: unknown,
    outputText: unknown,
    format: unknown,
    outputFormatValue: unknown
  ) {
    const normalizedOutputFormat = resolveSubtitleOutputFormat(format, outputFormatValue);
    const sourceCues = parseSubtitleCues(sourceText, format);
    const outputCues =
      normalizedOutputFormat === "json"
        ? (function () {
            try {
              const parsed = JSON.parse(outputText as string);
              return Array.isArray(parsed) ? parsed.map(toRecord) : [];
            } catch (_error) {
              return [];
            }
          })()
        : parseSubtitleCues(outputText, normalizedOutputFormat);
    const sourceLines = normalizeSubtitleText(sourceText).split("\n").filter(Boolean);
    const outputLines = normalizeSubtitleText(outputText).split("\n").filter(Boolean);
    const maxLineLength = outputLines.reduce(function (maxValue: number, line: unknown) {
      return Math.max(maxValue, String(line || "").trim().length);
    }, 0);

    return {
      sourceCueCount: sourceCues.length,
      outputCueCount: outputCues.length,
      sourceLineCount: sourceLines.length,
      outputLineCount: outputLines.length,
      maxLineLength: maxLineLength,
      changed: normalizeSubtitleText(sourceText) !== normalizeSubtitleText(outputText),
      outputFormat: normalizedOutputFormat,
    };
  }

  return {
    applySubtitleTextCleanup,
    buildNormalizedSubtitleCueModel,
    buildSubtitleEditSummary,
    formatSubtitleRenderTimestamp,
    normalizeSubtitleText,
    parseSubtitleCues,
    parseSubtitleTimestamp,
    resolveSubtitleOutputFormat,
    serializeSubtitleCueModel,
    transformSubtitleCueLines,
    transformSubtitleDocument,
    wrapSubtitleLines,
  };
}
