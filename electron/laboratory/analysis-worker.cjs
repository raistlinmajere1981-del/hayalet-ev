const { Buffer } = require("node:buffer");
const { spawn } = require("child_process");
const { mkdir } = require("fs/promises");
const process = require("node:process");
const { join } = require("path");
const { parentPort, workerData } = require("worker_threads");

let cancelRequested = false;
let activeChild = null;

const CANCELLED_ERROR = new Error("LABORATORY_ANALYSIS_CANCELLED");

if (parentPort) {
  parentPort.on("message", (message) => {
    if (!message || message.type !== "cancel") {
      return;
    }
    cancelRequested = true;
    if (activeChild) {
      try {
        activeChild.kill("SIGKILL");
      } catch {
        // Ignore child teardown failures during cancellation.
      }
    }
  });
}

function ensureNotCancelled() {
  if (cancelRequested) {
    throw CANCELLED_ERROR;
  }
}

function postProgress(phase, percent, summary, detail, currentAnalyzer) {
  if (!parentPort) {
    return;
  }

  parentPort.postMessage({
    type: "progress",
    phase,
    percent,
    summary,
    detail,
    currentAnalyzer: currentAnalyzer || null,
  });
}

function runBinary(binary, args) {
  return new Promise((resolve, reject) => {
    ensureNotCancelled();
    const child = spawn(binary, args, { stdio: ["ignore", "pipe", "pipe"] });
    activeChild = child;
    let stdout = Buffer.alloc(0);
    let stderr = "";

    child.stdout.on("data", (chunk) => {
      stdout = Buffer.concat([stdout, Buffer.from(chunk)]);
    });
    child.stderr.on("data", (chunk) => {
      stderr += String(chunk);
    });
    child.on("error", (error) => {
      activeChild = null;
      reject(error);
    });
    child.on("close", (code, signal) => {
      activeChild = null;
      if (cancelRequested) {
        reject(CANCELLED_ERROR);
        return;
      }
      if (code === 0) {
        resolve({ stdout, stderr });
        return;
      }
      reject(
        new Error(
          stderr.trim() || `${binary} exited with code ${String(code)} (${String(signal || "")})`
        )
      );
    });
  });
}

function clamp01(value) {
  if (!Number.isFinite(value)) {
    return 0;
  }
  return Math.max(0, Math.min(1, value));
}

function roundScore(value) {
  return Math.round(clamp01(value) * 100) / 100;
}

function roundMetric(value, digits = 2) {
  if (!Number.isFinite(value)) {
    return "0";
  }
  return Number(value).toFixed(digits);
}

function median(values) {
  if (!Array.isArray(values) || values.length === 0) {
    return 0;
  }
  const sorted = values.slice().sort((left, right) => left - right);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0 ? (sorted[middle - 1] + sorted[middle]) / 2 : sorted[middle];
}

function percentile(values, ratio) {
  if (!Array.isArray(values) || values.length === 0) {
    return 0;
  }
  const sorted = values.slice().sort((left, right) => left - right);
  const index = Math.max(0, Math.min(sorted.length - 1, Math.floor(sorted.length * ratio)));
  return sorted[index];
}

function buildMetrics(items) {
  return items.map((item) => ({
    label: item.label,
    value: item.value,
  }));
}

function createReport(status, score, summary, findings, metrics, evidence, details) {
  return {
    status,
    score: roundScore(score),
    summary,
    findings,
    metrics: buildMetrics(metrics),
    evidence,
    details,
  };
}

function parseClipRange(totalDuration, selection) {
  const requested = selection && selection.timeRange ? selection.timeRange : null;
  const safeDuration = Number.isFinite(totalDuration) && totalDuration > 0 ? totalDuration : 1;
  if (!requested) {
    return { startSec: 0, endSec: safeDuration, durationSec: safeDuration };
  }

  const startSec = Math.max(0, Math.min(safeDuration, Number(requested.startSec) || 0));
  const rawEnd = Number(requested.endSec) || safeDuration;
  const endSec = Math.max(startSec + 0.25, Math.min(safeDuration, rawEnd));
  return { startSec, endSec, durationSec: Math.max(0.25, endSec - startSec) };
}

function getModeProfile(mode) {
  if (mode === "fast") {
    return { sampleFrames: 12, frameSize: 72, audioRate: 11025 };
  }
  if (mode === "deep") {
    return { sampleFrames: 48, frameSize: 144, audioRate: 16000 };
  }
  return { sampleFrames: 28, frameSize: 96, audioRate: 12000 };
}

function buildCropFilter(region) {
  if (!region) {
    return null;
  }

  return [
    `crop=iw*${(region.widthPct / 100).toFixed(6)}`,
    `ih*${(region.heightPct / 100).toFixed(6)}`,
    `iw*${(region.xPct / 100).toFixed(6)}`,
    `ih*${(region.yPct / 100).toFixed(6)}`,
  ].join(":");
}

async function extractGrayFrames(sourcePath, clipRange, profile, region) {
  ensureNotCancelled();
  const clipDuration = Math.max(0.25, clipRange.durationSec);
  const fps = Math.min(6, Math.max(0.35, profile.sampleFrames / clipDuration));
  const filters = [];
  const crop = buildCropFilter(region);
  if (crop) {
    filters.push(crop);
  }
  filters.push(`fps=${fps.toFixed(4)}`);
  filters.push(`scale=${profile.frameSize}:${profile.frameSize}:flags=lanczos`);
  filters.push("format=gray");

  const result = await runBinary("ffmpeg", [
    "-v",
    "error",
    "-ss",
    String(clipRange.startSec),
    "-t",
    String(clipRange.durationSec),
    "-i",
    sourcePath,
    "-an",
    "-sn",
    "-dn",
    "-vf",
    filters.join(","),
    "-f",
    "rawvideo",
    "-pix_fmt",
    "gray",
    "pipe:1",
  ]);

  const frameBytes = profile.frameSize * profile.frameSize;
  const frameCount = Math.floor(result.stdout.length / frameBytes);
  const frames = [];
  for (let index = 0; index < frameCount; index += 1) {
    const start = index * frameBytes;
    frames.push(result.stdout.subarray(start, start + frameBytes));
  }

  return {
    frames,
    fps,
    frameSize: profile.frameSize,
    startSec: clipRange.startSec,
    durationSec: clipRange.durationSec,
  };
}

function meanAbsoluteDifference(frameA, frameB) {
  let total = 0;
  const length = Math.min(frameA.length, frameB.length);
  for (let index = 0; index < length; index += 1) {
    total += Math.abs(frameA[index] - frameB[index]);
  }
  return total / Math.max(1, length) / 255;
}

function buildDiffProfile(frameSet) {
  const diffs = [];
  for (let index = 1; index < frameSet.frames.length; index += 1) {
    diffs.push(meanAbsoluteDifference(frameSet.frames[index - 1], frameSet.frames[index]));
  }
  return diffs;
}

function timestampForIndex(frameSet, index) {
  return frameSet.startSec + index / Math.max(frameSet.fps, 0.001);
}

function topIndices(values, count) {
  return values
    .map((value, index) => ({ value, index }))
    .sort((left, right) => right.value - left.value)
    .slice(0, count)
    .map((item) => item.index);
}

function analyzeMetadata(probe) {
  let score = 0.05;
  const findings = [];
  const metrics = [
    { label: "Container", value: probe.container || "unknown" },
    { label: "Video codec", value: probe.videoCodec || "unknown" },
    { label: "Audio codec", value: probe.audioCodec || "none" },
    { label: "Frame rate", value: `${roundMetric(probe.fps, 2)} fps` },
  ];

  if (typeof probe.encoder === "string" && /lavf|lavc|ffmpeg/i.test(probe.encoder)) {
    score += 0.28;
    findings.push(
      "Encoder tag suggests the file was exported or remuxed by a post-processing tool."
    );
    metrics.push({ label: "Encoder", value: probe.encoder });
  }

  const avg = Number(probe.fps) || 0;
  const real = (() => {
    if (typeof probe.realFrameRateRaw !== "string") {
      return avg;
    }
    const parts = probe.realFrameRateRaw.split("/");
    const numerator = Number(parts[0] || 0);
    const denominator = Number(parts[1] || 1);
    return denominator === 0 ? avg : numerator / denominator;
  })();
  const fpsDrift = avg > 0 ? Math.abs(avg - real) / avg : 0;
  if (fpsDrift >= 0.04) {
    score += 0.17;
    findings.push("Average and real frame-rate readings differ more than expected.");
    metrics.push({ label: "FPS drift", value: `${roundMetric(fpsDrift * 100, 1)}%` });
  }

  if (!Number.isFinite(probe.bitrate) || probe.bitrate === null || probe.bitrate <= 0) {
    score += 0.06;
    findings.push("Bitrate metadata is sparse, which can happen after repackaging.");
  } else {
    metrics.push({ label: "Bitrate", value: `${Math.round(probe.bitrate / 1000)} kbps` });
  }

  if (findings.length === 0) {
    findings.push("Container, codec, and frame-rate metadata look internally consistent.");
  }

  return createReport("ok", score, findings[0], findings, metrics, [], {
    encoder: probe.encoder,
    avgFrameRateRaw: probe.avgFrameRateRaw,
    realFrameRateRaw: probe.realFrameRateRaw,
    formatName: probe.formatName,
  });
}

function analyzeMotion(fullFrames, focusFrames, clipRange, hasRegion) {
  const fullDiffs = buildDiffProfile(fullFrames);
  const focusDiffs = buildDiffProfile(focusFrames);
  if (fullDiffs.length === 0) {
    return createReport(
      "ok",
      0.04,
      "Not enough sampled frames to form a motion profile.",
      ["Not enough sampled frames to form a motion profile."],
      [{ label: "Sampled frames", value: String(fullFrames.frames.length) }],
      [],
      { sampledFrames: fullFrames.frames.length }
    );
  }

  const fullMedian = median(fullDiffs);
  const abruptCuts = fullDiffs.filter((value) => value > Math.max(0.12, fullMedian * 2.1));
  let score = abruptCuts.length > 0 ? Math.min(0.24, abruptCuts.length / fullDiffs.length) : 0.06;
  const findings = [];
  const evidence = [];

  if (abruptCuts.length > 0) {
    findings.push("Frame-to-frame continuity shows abrupt jumps in the sampled clip.");
    topIndices(fullDiffs, Math.min(3, abruptCuts.length)).forEach((index) => {
      evidence.push({
        id: `motion-cut-${index}`,
        title: "Abrupt frame delta",
        summary: `Motion delta peaked around ${roundMetric(fullDiffs[index] * 100, 1)}%.`,
        score: roundScore(fullDiffs[index]),
        timestampStartSec: timestampForIndex(fullFrames, index),
        timestampEndSec: timestampForIndex(fullFrames, index + 1),
      });
    });
  }

  if (hasRegion && focusDiffs.length === fullDiffs.length && focusDiffs.length > 0) {
    const ratios = focusDiffs.map((value, index) => value / Math.max(0.01, fullDiffs[index]));
    const suspiciousRatios = ratios.filter(
      (value, index) => value > 1.55 && focusDiffs[index] > 0.06
    );
    if (suspiciousRatios.length > 0) {
      score += Math.min(0.36, suspiciousRatios.length / ratios.length);
      findings.push("The selected region moves differently from the surrounding frame.");
      topIndices(ratios, Math.min(3, suspiciousRatios.length)).forEach((index) => {
        evidence.push({
          id: `motion-ratio-${index}`,
          title: "Region/background mismatch",
          summary: `Selected area motion was ${roundMetric(ratios[index], 2)}x the background profile.`,
          score: roundScore(Math.min(1, ratios[index] / 2)),
          timestampStartSec: timestampForIndex(fullFrames, index),
          timestampEndSec: timestampForIndex(fullFrames, index + 1),
        });
      });
    }
  }

  if (findings.length === 0) {
    findings.push("Sampled motion remains broadly aligned across neighboring frames.");
  }

  return createReport(
    "ok",
    score,
    findings[0],
    findings,
    [
      { label: "Sampled frames", value: String(fullFrames.frames.length) },
      { label: "Clip span", value: `${roundMetric(clipRange.durationSec, 2)} s` },
      { label: "Median motion delta", value: `${roundMetric(fullMedian * 100, 2)}%` },
      { label: "Max motion delta", value: `${roundMetric(Math.max(...fullDiffs) * 100, 2)}%` },
    ],
    evidence,
    {
      sampledFrames: fullFrames.frames.length,
      abruptCount: abruptCuts.length,
    }
  );
}

function computeBrightness(frame) {
  let total = 0;
  for (let index = 0; index < frame.length; index += 1) {
    total += frame[index];
  }
  return total / Math.max(1, frame.length) / 255;
}

function computeBlockiness(frame, size) {
  let boundary = 0;
  let boundaryCount = 0;
  let interior = 0;
  let interiorCount = 0;

  for (let y = 0; y < size; y += 1) {
    for (let x = 1; x < size; x += 1) {
      const current = frame[y * size + x];
      const previous = frame[y * size + x - 1];
      const delta = Math.abs(current - previous);
      if (x % 8 === 0) {
        boundary += delta;
        boundaryCount += 1;
      } else {
        interior += delta;
        interiorCount += 1;
      }
    }
  }

  for (let y = 1; y < size; y += 1) {
    for (let x = 0; x < size; x += 1) {
      const current = frame[y * size + x];
      const previous = frame[(y - 1) * size + x];
      const delta = Math.abs(current - previous);
      if (y % 8 === 0) {
        boundary += delta;
        boundaryCount += 1;
      } else {
        interior += delta;
        interiorCount += 1;
      }
    }
  }

  return boundary / Math.max(1, boundaryCount) / Math.max(1, interior / Math.max(1, interiorCount));
}

function computeBorderEnergy(frame, size) {
  const band = Math.max(2, Math.floor(size * 0.08));
  let border = 0;
  let borderCount = 0;
  let center = 0;
  let centerCount = 0;

  for (let y = 0; y < size; y += 1) {
    for (let x = 0; x < size; x += 1) {
      const value = frame[y * size + x];
      const inBorder = x < band || y < band || x >= size - band || y >= size - band;
      if (inBorder) {
        border += value;
        borderCount += 1;
      } else {
        center += value;
        centerCount += 1;
      }
    }
  }

  return border / Math.max(1, borderCount) / Math.max(1, center / Math.max(1, centerCount));
}

function analyzeVisual(frameSet, hasRegion) {
  if (frameSet.frames.length === 0) {
    return createReport(
      "ok",
      0.04,
      "Visual sampling did not produce enough frames to inspect.",
      ["Visual sampling did not produce enough frames to inspect."],
      [],
      [],
      {}
    );
  }

  const brightness = frameSet.frames.map((frame) => computeBrightness(frame));
  const blockiness = frameSet.frames.map((frame) => computeBlockiness(frame, frameSet.frameSize));
  const borderEnergy = hasRegion
    ? frameSet.frames.map((frame) => computeBorderEnergy(frame, frameSet.frameSize))
    : [];
  const brightnessDeltas = [];
  for (let index = 1; index < brightness.length; index += 1) {
    brightnessDeltas.push(Math.abs(brightness[index] - brightness[index - 1]));
  }

  const findings = [];
  const evidence = [];
  let score = 0.08;
  const medianBlockiness = median(blockiness);
  const maxBlockiness = Math.max(...blockiness);
  if (medianBlockiness > 1.18 || maxBlockiness > 1.32) {
    score += Math.min(0.3, (maxBlockiness - 1.1) * 0.4);
    findings.push("Compression intensity varies across the sampled region.");
    topIndices(blockiness, 3).forEach((index) => {
      evidence.push({
        id: `visual-block-${index}`,
        title: "Compression discontinuity",
        summary: `Blockiness ratio reached ${roundMetric(blockiness[index], 2)}.`,
        score: roundScore(Math.min(1, blockiness[index] / 2)),
        timestampStartSec: timestampForIndex(frameSet, index),
      });
    });
  }

  if (hasRegion && borderEnergy.length > 0) {
    const borderMedian = median(borderEnergy);
    const borderPeak = Math.max(...borderEnergy);
    if (borderMedian > 1.08 || borderPeak > 1.18) {
      score += Math.min(0.24, (borderPeak - 1.02) * 0.45);
      findings.push("Edge energy around the selected region is stronger than its center.");
      topIndices(borderEnergy, 2).forEach((index) => {
        evidence.push({
          id: `visual-edge-${index}`,
          title: "Edge emphasis",
          summary: `Border energy ratio reached ${roundMetric(borderEnergy[index], 2)}.`,
          score: roundScore(Math.min(1, borderEnergy[index] / 2)),
          timestampStartSec: timestampForIndex(frameSet, index),
        });
      });
    }
  }

  const abruptBrightness = brightnessDeltas.filter((value) => value > 0.11);
  if (abruptBrightness.length > 0) {
    score += Math.min(0.2, abruptBrightness.length / Math.max(1, brightnessDeltas.length));
    findings.push("Brightness shifts abruptly between nearby sampled frames.");
  }

  if (findings.length === 0) {
    findings.push(
      "Edge, brightness, and compression cues stay relatively even in the sampled frames."
    );
  }

  return createReport(
    "ok",
    score,
    findings[0],
    findings,
    [
      { label: "Sampled frames", value: String(frameSet.frames.length) },
      { label: "Median blockiness", value: roundMetric(medianBlockiness, 2) },
      { label: "Peak blockiness", value: roundMetric(maxBlockiness, 2) },
      {
        label: "Peak brightness jump",
        value: `${roundMetric(Math.max(0, ...brightnessDeltas) * 100, 1)}%`,
      },
    ],
    evidence,
    {}
  );
}

async function extractAudioSamples(sourcePath, clipRange, audioRate) {
  const result = await runBinary("ffmpeg", [
    "-v",
    "error",
    "-ss",
    String(clipRange.startSec),
    "-t",
    String(clipRange.durationSec),
    "-i",
    sourcePath,
    "-vn",
    "-ac",
    "1",
    "-ar",
    String(audioRate),
    "-f",
    "s16le",
    "pipe:1",
  ]);

  return result.stdout;
}

function analyzeAudio(buffer, clipRange, audioRate, hasAudio) {
  if (!hasAudio) {
    return createReport(
      "no-audio",
      0,
      "The clip has no audio stream, so the audio analyzer was skipped.",
      ["The clip has no audio stream, so the audio analyzer was skipped."],
      [{ label: "Audio", value: "none" }],
      [],
      {}
    );
  }

  if (buffer.length < 4) {
    return createReport(
      "unsupported",
      0.02,
      "Audio data was too small to build a stable profile.",
      ["Audio data was too small to build a stable profile."],
      [{ label: "Samples", value: "0" }],
      [],
      {}
    );
  }

  const windowSize = 4096;
  const rmsValues = [];
  for (let offset = 0; offset + windowSize * 2 <= buffer.length; offset += windowSize * 2) {
    let total = 0;
    for (let index = 0; index < windowSize; index += 1) {
      const sample = buffer.readInt16LE(offset + index * 2) / 32768;
      total += sample * sample;
    }
    rmsValues.push(Math.sqrt(total / windowSize));
  }

  if (rmsValues.length < 2) {
    return createReport(
      "ok",
      0.04,
      "Audio was present, but the sample was too short for stronger checks.",
      ["Audio was present, but the sample was too short for stronger checks."],
      [{ label: "Windows", value: String(rmsValues.length) }],
      [],
      {}
    );
  }

  const deltas = [];
  for (let index = 1; index < rmsValues.length; index += 1) {
    deltas.push(Math.abs(rmsValues[index] - rmsValues[index - 1]));
  }

  const abrupt = deltas.filter((value) => value > 0.08);
  const firstHalfFloor = percentile(
    rmsValues.slice(0, Math.max(1, Math.floor(rmsValues.length / 2))),
    0.2
  );
  const secondHalfFloor = percentile(rmsValues.slice(Math.floor(rmsValues.length / 2)), 0.2);
  let score = abrupt.length > 0 ? Math.min(0.22, abrupt.length / deltas.length) : 0.05;
  const findings = [];
  const evidence = [];

  if (abrupt.length > 0) {
    findings.push("Audio loudness shifts abruptly in the sampled window.");
    topIndices(deltas, Math.min(3, abrupt.length)).forEach((index) => {
      const windowStart = clipRange.startSec + (index * windowSize) / audioRate;
      evidence.push({
        id: `audio-jump-${index}`,
        title: "Audio discontinuity",
        summary: `RMS delta reached ${roundMetric(deltas[index] * 100, 1)}%.`,
        score: roundScore(Math.min(1, deltas[index] * 4)),
        timestampStartSec: windowStart,
        timestampEndSec: windowStart + windowSize / audioRate,
      });
    });
  }

  if (Math.abs(firstHalfFloor - secondHalfFloor) > 0.035) {
    score += 0.18;
    findings.push("Noise-floor baseline changes across the analyzed clip.");
  }

  if (findings.length === 0) {
    findings.push("Audio continuity and noise-floor levels stay relatively stable.");
  }

  return createReport(
    "ok",
    score,
    findings[0],
    findings,
    [
      { label: "Audio windows", value: String(rmsValues.length) },
      { label: "Peak RMS jump", value: `${roundMetric(Math.max(...deltas) * 100, 1)}%` },
      {
        label: "Noise floor drift",
        value: `${roundMetric(Math.abs(firstHalfFloor - secondHalfFloor) * 100, 1)}%`,
      },
    ],
    evidence,
    {}
  );
}

async function runAnalysis(payload) {
  const clipRange = parseClipRange(payload.probe.durationSec, payload.selection);
  const profile = getModeProfile(payload.mode);
  const derivedDir = join(payload.workspaceDir, "derived");
  await mkdir(derivedDir, { recursive: true });

  postProgress(
    "frame-extraction",
    12,
    "Preparing sampled frames.",
    "Collecting lightweight grayscale samples for motion and visual analysis."
  );
  const fullFrames = await extractGrayFrames(payload.sourcePath, clipRange, profile, null);
  const focusFrames = payload.selection.region
    ? await extractGrayFrames(payload.sourcePath, clipRange, profile, payload.selection.region)
    : fullFrames;

  postProgress(
    "metadata-analysis",
    24,
    "Inspecting metadata.",
    "Reading container, codec, encoder, and frame-rate signals.",
    "metadata"
  );
  const metadata = analyzeMetadata(payload.probe);

  postProgress(
    "motion-analysis",
    46,
    "Checking motion continuity.",
    "Comparing region motion against the surrounding frame.",
    "motion"
  );
  const motion = analyzeMotion(
    fullFrames,
    focusFrames,
    clipRange,
    Boolean(payload.selection.region)
  );

  postProgress(
    "visual-analysis",
    66,
    "Scanning visual inconsistencies.",
    "Measuring edge energy, compression changes, and brightness shifts.",
    "visual"
  );
  const visual = analyzeVisual(focusFrames, Boolean(payload.selection.region));

  postProgress(
    "audio-analysis",
    82,
    "Profiling audio continuity.",
    "Measuring abrupt loudness and noise-floor changes.",
    "audio"
  );
  const audioSamples = payload.probe.hasAudio
    ? await extractAudioSamples(payload.sourcePath, clipRange, profile.audioRate)
    : Buffer.alloc(0);
  const audio = analyzeAudio(audioSamples, clipRange, profile.audioRate, payload.probe.hasAudio);

  postProgress(
    "report-build",
    94,
    "Assembling reports.",
    "Final analyzer scores are being combined into report-ready output."
  );
  return {
    metadata,
    motion,
    visual,
    audio,
  };
}

(async function main() {
  try {
    const analyzers = await runAnalysis(workerData);
    if (parentPort) {
      parentPort.postMessage({
        type: "result",
        analyzers,
      });
    }
  } catch (error) {
    if (!parentPort) {
      process.exit(1);
      return;
    }

    if (error === CANCELLED_ERROR || (error && error.message === CANCELLED_ERROR.message)) {
      parentPort.postMessage({ type: "error", error: "Analysis cancelled." });
      process.exit(0);
      return;
    }

    parentPort.postMessage({
      type: "error",
      error: error && error.message ? error.message : String(error),
    });
    process.exit(1);
  }
})();
