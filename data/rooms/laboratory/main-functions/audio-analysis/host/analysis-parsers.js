export function createAudioAnalysisParserRuntime() {
  function parseBlackDetectLog(stderrValue) {
    const matches = Array.from(String(stderrValue || "").match(/black_duration:([0-9.]+)/g) || []);
    return {
      count: matches.length,
      totalDurationSeconds: matches.reduce(function(total, match) {
        const value = Number(match.split(":")[1]);
        return total + (Number.isFinite(value) ? value : 0);
      }, 0)
    };
  }
  function parseFreezeDetectLog(stderrValue) {
    const matches = Array.from(String(stderrValue || "").match(/freeze_duration:([0-9.]+)/g) || []);
    return {
      count: matches.length,
      totalDurationSeconds: matches.reduce(function(total, match) {
        const value = Number(match.split(":")[1]);
        return total + (Number.isFinite(value) ? value : 0);
      }, 0)
    };
  }
  function parseSilenceDetectLog(stderrValue) {
    const matches = Array.from(String(stderrValue || "").match(/silence_duration: ([0-9.]+)/g) || []);
    return {
      count: matches.length,
      totalDurationSeconds: matches.reduce(function(total, match) {
        const value = Number(match.split(": ")[1]);
        return total + (Number.isFinite(value) ? value : 0);
      }, 0)
    };
  }
  function parseVolumeDetectLog(stderrValue) {
    const meanMatch = String(stderrValue || "").match(/mean_volume:\s*(-?[0-9.]+)\s*dB/i);
    const maxMatch = String(stderrValue || "").match(/max_volume:\s*(-?[0-9.]+)\s*dB/i);
    return {
      meanVolumeDb: meanMatch ? Number(meanMatch[1]) : null,
      maxVolumeDb: maxMatch ? Number(maxMatch[1]) : null
    };
  }
  function parseAspectralStatsText(rawText) {
    const rawMetrics = (String(rawText || "").match(/lavfi\.aspectralstats\.[a-zA-Z0-9_.-]+=-?[0-9.]+/g) || []).map(
      function(entry) {
        return entry.trim();
      }
    );
    const metricSamples = {};
    rawMetrics.forEach(function(entry) {
      const match = entry.match(/lavfi\.aspectralstats\.([a-zA-Z0-9_.-]+)=(-?[0-9.]+)/);
      if (!match) {
        return;
      }
      const metricId = match[1];
      const numericValue = Number(match[2]);
      if (!Number.isFinite(numericValue)) {
        return;
      }
      if (!metricSamples[metricId]) {
        metricSamples[metricId] = [];
      }
      metricSamples[metricId].push(numericValue);
    });
    return ["centroid", "rolloff", "flatness", "flux"].reduce(
      function(accumulator, metricId) {
        const samples = Array.isArray(metricSamples[metricId]) ? metricSamples[metricId] : [];
        const total = samples.reduce(function(sum, sample) {
          return sum + sample;
        }, 0);
        accumulator[metricId] = {
          sampleCount: samples.length,
          mean: samples.length > 0 ? total / samples.length : null,
          min: samples.length > 0 ? Math.min(...samples) : null,
          max: samples.length > 0 ? Math.max(...samples) : null
        };
        return accumulator;
      },
      {
        centroid: { sampleCount: 0, mean: null, min: null, max: null },
        rolloff: { sampleCount: 0, mean: null, min: null, max: null },
        flatness: { sampleCount: 0, mean: null, min: null, max: null },
        flux: { sampleCount: 0, mean: null, min: null, max: null }
      }
    );
  }
  function parseCsvTable(rawText) {
    const lines = String(rawText || "").split(/\r?\n/).map(function(entry) {
      return entry.trim();
    }).filter(Boolean);
    if (lines.length < 2) {
      return {
        header: [],
        rows: []
      };
    }
    const header = lines[0].split(";").map(function(entry) {
      return entry.trim();
    });
    const rows = lines.slice(1).map(function(line) {
      const values = line.split(";").map(function(entry) {
        return entry.trim();
      });
      return header.reduce(function(record, key, index) {
        record[key] = values[index] || "";
        return record;
      }, {});
    });
    return {
      header,
      rows
    };
  }
  function buildNumericSummary(values) {
    const samples = values.filter(function(entry) {
      return Number.isFinite(entry);
    });
    const total = samples.reduce(function(sum, sample) {
      return sum + sample;
    }, 0);
    return {
      sampleCount: samples.length,
      mean: samples.length > 0 ? total / samples.length : null,
      min: samples.length > 0 ? Math.min(...samples) : null,
      max: samples.length > 0 ? Math.max(...samples) : null
    };
  }
  function findProsodyColumn(header, pattern) {
    return header.find(function(column) {
      return pattern.test(column);
    }) || null;
  }
  function buildProsodySummaryFromCsv(rawText) {
    const table = parseCsvTable(rawText);
    const header = table.header;
    const rows = table.rows;
    const timestampKey = findProsodyColumn(header, /timestamp/i);
    const f0Key = findProsodyColumn(header, /(^|[_-])F0/i);
    const loudnessKey = findProsodyColumn(header, /loudness/i);
    const voiceProbKey = findProsodyColumn(header, /voiceprob/i);
    const f0Values = [];
    const loudnessValues = [];
    const voiceProbValues = [];
    let voicedFrames = 0;
    let totalDurationSeconds = 0;
    let estimatedPauseCount = 0;
    let previousVoiced = false;
    let firstTimestamp = null;
    let lastTimestamp = null;
    rows.forEach(function(record) {
      const timestampValue = Number(timestampKey ? record[timestampKey] : NaN);
      const f0Value = Number(f0Key ? record[f0Key] : NaN);
      const loudnessValue = Number(loudnessKey ? record[loudnessKey] : NaN);
      const voiceProbValue = Number(voiceProbKey ? record[voiceProbKey] : NaN);
      if (Number.isFinite(timestampValue)) {
        if (firstTimestamp === null) {
          firstTimestamp = timestampValue;
        }
        lastTimestamp = timestampValue;
      }
      if (Number.isFinite(f0Value) && f0Value > 0) {
        f0Values.push(f0Value);
      }
      if (Number.isFinite(loudnessValue)) {
        loudnessValues.push(loudnessValue);
      }
      if (Number.isFinite(voiceProbValue)) {
        voiceProbValues.push(voiceProbValue);
      }
      const voiced = Number.isFinite(voiceProbValue) ? voiceProbValue >= 0.5 : Number.isFinite(f0Value) && f0Value > 0;
      if (voiced) {
        voicedFrames += 1;
      }
      if (previousVoiced && voiced === false) {
        estimatedPauseCount += 1;
      }
      previousVoiced = voiced;
    });
    const startTimestamp = typeof firstTimestamp === "number" ? firstTimestamp : null;
    const endTimestamp = typeof lastTimestamp === "number" ? lastTimestamp : null;
    if (startTimestamp !== null && endTimestamp !== null && endTimestamp >= startTimestamp) {
      totalDurationSeconds = endTimestamp - startTimestamp;
    }
    const voicedRatio = rows.length > 0 ? voicedFrames / rows.length : null;
    const numericSummaries = {};
    if (f0Values.length > 0) {
      const summary = buildNumericSummary(f0Values);
      numericSummaries.f0 = summary;
    }
    if (loudnessValues.length > 0) {
      const summary = buildNumericSummary(loudnessValues);
      numericSummaries.loudness = summary;
    }
    if (voiceProbValues.length > 0) {
      const summary = buildNumericSummary(voiceProbValues);
      numericSummaries.voiceProbability = summary;
    }
    return {
      columns: header,
      frameCount: rows.length,
      durationSeconds: totalDurationSeconds,
      meanF0Hz: numericSummaries.f0 ? numericSummaries.f0.mean : null,
      meanLoudness: numericSummaries.loudness ? numericSummaries.loudness.mean : null,
      voicedRatio,
      estimatedPauseCount,
      numericSummaries
    };
  }
  function buildEmotionHeuristicFromProsody(prosodySummary) {
    const summary = prosodySummary && typeof prosodySummary === "object" ? prosodySummary : {};
    const cues = [];
    let score = 0;
    if (typeof summary.meanF0Hz === "number") {
      if (summary.meanF0Hz >= 185) {
        score += 1;
        cues.push("Pitch baseline trends high.");
      } else if (summary.meanF0Hz <= 140) {
        score -= 1;
        cues.push("Pitch baseline trends low.");
      }
    }
    if (typeof summary.voicedRatio === "number") {
      if (summary.voicedRatio >= 0.7) {
        score += 1;
        cues.push("Voiced ratio stays consistently high.");
      } else if (summary.voicedRatio <= 0.45) {
        score -= 1;
        cues.push("Voiced ratio drops across the sample.");
      }
    }
    if (typeof summary.estimatedPauseCount === "number" && typeof summary.durationSeconds === "number" && summary.durationSeconds > 0) {
      const pauseDensity = summary.estimatedPauseCount / Math.max(summary.durationSeconds, 1);
      if (pauseDensity >= 0.45) {
        score -= 1;
        cues.push("Estimated pause density is elevated.");
      } else if (pauseDensity <= 0.12) {
        score += 1;
        cues.push("Estimated pause density stays low.");
      }
    }
    const label = score >= 2 ? "elevated-arousal-candidate" : score <= -2 ? "subdued-arousal-candidate" : "steady-arousal-candidate";
    return {
      label,
      score,
      confidence: Math.abs(score) >= 3 ? "medium" : "low",
      cues,
      disclaimer: "Heuristic only. This module suggests coarse arousal-style labels and is not a factual emotion classifier.",
      prosodySummary: summary
    };
  }
  return {
    buildEmotionHeuristicFromProsody,
    buildProsodySummaryFromCsv,
    parseAspectralStatsText,
    parseBlackDetectLog,
    parseFreezeDetectLog,
    parseSilenceDetectLog,
    parseVolumeDetectLog
  };
}
