import test from "node:test";
import assert from "node:assert/strict";
import { createAudioAnalysisProbeRuntime } from "../../rooms/laboratory/features/audio-analysis/host/analysis-probes.ts";
import {
  createLaboratoryHostUtils,
  sanitizeLaboratoryFileSegment,
  toLaboratoryFfmpegTimestamp,
} from "../../rooms/laboratory/shared/host/host-utils.ts";

describe("utility helpers and probes", () => {
  void test("laboratory host utility helpers preserve file, timestamp, and clamp golden cases", () => {
    const hostUtils = createLaboratoryHostUtils({
      audioFeatureId: "audio-analysis",
      getDefaultSourceType() {
        return "media";
      },
      toRecord(value) {
        return value !== null && typeof value === "object" && Array.isArray(value) === false
          ? (value as Record<string, unknown>)
          : {};
      },
    });

    assert.equal(
      sanitizeLaboratoryFileSegment(" Clip 01 / Final!.mp4 ", "artifact"),
      "clip-01-final-mp4"
    );
    assert.equal(sanitizeLaboratoryFileSegment("", "fallback-name"), "fallback-name");
    assert.equal(toLaboratoryFfmpegTimestamp(1.23456, null), "1.235");
    assert.equal(toLaboratoryFfmpegTimestamp(-1, null), "0");
    assert.equal(toLaboratoryFfmpegTimestamp("bad", "2.000"), "2.000");
    assert.equal(hostUtils.clampNumber("3.5", 0, 2, 1), 2);
    assert.equal(hostUtils.clampNumber("bad", 0, 2, 1), 1);
  });

  void test("laboratory structure probes honor analysis time range and scale full-media timeout", async () => {
    const toolRuns: Array<Record<string, unknown>> = [];
    const probeRuntime = createAudioAnalysisProbeRuntime({
      asNonEmptyString(value: unknown) {
        return typeof value === "string" && value.trim() !== "" ? value : null;
      },
      asNumber(value: unknown) {
        return typeof value === "number" && Number.isFinite(value) ? value : null;
      },
      buildProsodySummaryFromCsv() {
        return {};
      },
      parseBlackDetectLog() {
        return { count: 0, segments: [] };
      },
      parseFreezeDetectLog() {
        return {
          count: 1,
          maxDurationSeconds: 1,
          segments: [{ durationSeconds: 1, endSeconds: 1, startSeconds: 0 }],
          totalDurationSeconds: 1,
        };
      },
      parseSilenceDetectLog() {
        return { count: 0, segments: [] };
      },
      parseVolumeDetectLog() {
        return {};
      },
      readTextFile: async () => null,
      runProfileTool: async function (_runtime, options) {
        toolRuns.push(options);
        return { stderr: "probe output" };
      },
      toRecord(value: unknown) {
        return value !== null && typeof value === "object" && Array.isArray(value) === false
          ? (value as Record<string, unknown>)
          : {};
      },
    });
    const runtime = { paths: { projectsDir: "/tmp/laboratory-projects" } };
    const project = { slug: "scope-probe" };
    const target = {
      metadata: { durationSeconds: 967.85415 },
      path: "/tmp/source.mp4",
    };
    function readStructureProbeRun(requestId: string) {
      const run = toolRuns.find(function (entry) {
        if (entry["requestId"] !== requestId) {
          return false;
        }
        const args = Array.isArray(entry["args"]) ? (entry["args"] as unknown[]) : [];
        return args.some(function (arg) {
          return typeof arg === "string" && arg.includes("blackdetect");
        });
      });
      assert.ok(run, `Expected structure probe run for ${requestId}.`);
      return run;
    }

    const scopedProbe = await probeRuntime.runVideoStructureProbe(
      runtime,
      project,
      "req-scoped",
      "job-scoped",
      target,
      {
        analysisScope: {
          timeRange: {
            endMs: 93_000,
            startMs: 89_000,
          },
        },
      }
    );
    const scopedRun = readStructureProbeRun("req-scoped");
    const scopedArgs = (scopedRun["args"] ?? []) as string[];
    const scopedFreeze = scopedProbe.freeze as Record<string, unknown>;
    const scopedSegments = scopedFreeze["segments"] as Array<Record<string, unknown>>;
    assert.deepEqual(scopedArgs.slice(0, 6), ["-hide_banner", "-ss", "89", "-t", "4", "-i"]);
    assert.equal(scopedRun["timeoutMs"], 120_000);
    assert.equal(scopedSegments[0]?.["startSeconds"], 89);
    assert.equal(scopedSegments[0]["endSeconds"], 90);

    await probeRuntime.runVideoStructureProbe(runtime, project, "req-full", "job-full", target);
    const fullRun = readStructureProbeRun("req-full");
    const fullArgs = (fullRun["args"] ?? []) as string[];
    assert.equal(fullArgs.includes("-ss"), false);
    assert.ok(Number(fullRun["timeoutMs"]) > 120_000);

    await probeRuntime.runVideoStructureProbe(
      runtime,
      project,
      "req-sample",
      "job-sample",
      target,
      {
        fallbackWindowSeconds: 45,
      }
    );
    const sampleRun = readStructureProbeRun("req-sample");
    const sampleArgs = (sampleRun["args"] ?? []) as string[];
    assert.deepEqual(sampleArgs.slice(0, 6), ["-hide_banner", "-ss", "0", "-t", "45", "-i"]);
  });

  void test("laboratory visual forensics probes run real tool paths before degrading", async () => {
    const toolRuns: Array<Record<string, unknown>> = [];
    const probeRuntime = createAudioAnalysisProbeRuntime({
      asNonEmptyString(value: unknown) {
        return typeof value === "string" && value.trim() !== "" ? value : null;
      },
      asNumber(value: unknown) {
        return typeof value === "number" && Number.isFinite(value) ? value : null;
      },
      buildProsodySummaryFromCsv() {
        return {};
      },
      parseBlackDetectLog() {
        return { count: 0, segments: [] };
      },
      parseFreezeDetectLog() {
        return { count: 0, segments: [] };
      },
      parseSilenceDetectLog() {
        return { count: 0, segments: [] };
      },
      parseVolumeDetectLog() {
        return {};
      },
      readTextFile: async () => null,
      runProfileTool: async function (_runtime, options) {
        toolRuns.push(options);
        const args = Array.isArray(options["args"]) ? (options["args"] as string[]) : [];
        if (options["toolId"] === "visual-forensics-py" && args[2] === "duplicate") {
          return {
            stdout: JSON.stringify({
              averageHashSimilarity: 0.97,
              averageSsim: 0.96,
              method: "opencv-phash-ssim",
              nearDuplicateFrameCount: 3,
              nearDuplicateFrameRatio: 0.3,
              sampledFrameCount: 12,
              status: "measured",
            }),
          };
        }
        if (options["toolId"] === "visual-forensics-py" && args[2] === "flow") {
          return {
            stdout: JSON.stringify({
              backgroundMotionEnergy: 0.04,
              confidence: "medium",
              method: "opencv-farneback",
              movementClass: "localized_subject_motion",
              sampledFrameCount: 8,
              status: "measured",
              subjectBackgroundMotionRatio: 3.2,
              subjectMotionEnergy: 0.13,
            }),
          };
        }
        if (options["toolId"] === "visual-forensics-py" && args[2] === "reference") {
          return {
            stdout: JSON.stringify({
              method: "opencv-skimage-ssim",
              qualityDelta: 0.08,
              sampledFrameCount: 1,
              ssim: 0.92,
              status: "measured",
            }),
          };
        }
        if (options["toolId"] === "exiftool") {
          return {
            stdout: JSON.stringify([
              {
                CreateDate: "2026:05:23 10:00:00",
                FileType: "MP4",
                ImageHeight: 1080,
                ImageWidth: 1920,
              },
            ]),
          };
        }
        if (options["toolId"] === "mediainfo") {
          return {
            stdout: JSON.stringify({
              media: {
                track: [
                  { "@type": "General", Duration: "4.000", Format: "MPEG-4" },
                  {
                    "@type": "Video",
                    Format: "h264",
                    FrameRate: "25",
                    Height: "1080",
                    Width: "1920",
                  },
                ],
              },
            }),
          };
        }
        if (args.includes("-show_format")) {
          return {
            stdout: JSON.stringify({
              format: { duration: "4.000", format_name: "mov,mp4,m4a,3gp,3g2,mj2" },
              streams: [
                {
                  avg_frame_rate: "25/1",
                  codec_name: "h264",
                  codec_type: "video",
                  height: 1080,
                  width: 1920,
                },
              ],
            }),
          };
        }
        if (args.includes("-show_entries")) {
          return {
            stdout: JSON.stringify({
              frames: [
                { best_effort_timestamp_time: "0", key_frame: 1, pict_type: "I", pkt_size: "1200" },
                {
                  best_effort_timestamp_time: "0.04",
                  key_frame: 0,
                  pict_type: "P",
                  pkt_size: "900",
                },
              ],
            }),
          };
        }
        if (args.includes("framehash")) {
          return {
            stdout: [
              "#tb 0: 1/25",
              "0, 0, 0, 1, 900, abc",
              "0, 0, 1, 1, 900, abc",
              "0, 0, 2, 1, 901, def",
            ].join("\n"),
          };
        }
        return { stderr: "probe output" };
      },
      toRecord(value: unknown) {
        return value !== null && typeof value === "object" && Array.isArray(value) === false
          ? (value as Record<string, unknown>)
          : {};
      },
    });
    const runtime = { paths: { projectsDir: "/tmp/laboratory-projects" } };
    const project = { slug: "forensics-probe" };
    const videoProbe = await probeRuntime.runVideoStructureProbe(
      runtime,
      project,
      "req-forensics",
      "job-forensics",
      { metadata: { durationSeconds: 4 }, path: "/tmp/source.mp4" },
      {
        moduleSettings: {
          "compression-signature-mapping": { artifactProfile: "edge", bppThreshold: 0.12 },
          "metadata-provenance-audit": { metadataDepth: "forensic" },
          "optical-flow-tracking": {
            cameraCompensation: "strong",
            flowEngine: "farneback",
            motionThreshold: 0.12,
          },
          "perceptual-duplicate-frame": {
            frameStep: 5,
            hashMode: "hybrid",
            minRunFrames: 2,
            similarityThreshold: 0.94,
          },
          "reference-quality-check": { metricSet: "ssim", minDelta: 0.04 },
        },
        referenceTarget: { path: "/tmp/reference.mp4" },
        sourceKind: "video",
      }
    );

    assert.equal(
      (videoProbe.nearDuplicateFrame as Record<string, unknown>)["method"],
      "ffmpeg-framehash+opencv-phash-ssim"
    );
    assert.equal(
      (videoProbe.nearDuplicateFrame as Record<string, unknown>)["nearDuplicateFrameCount"],
      3
    );
    assert.equal(videoProbe.opticalFlowTracking["method"], "opencv-farneback");
    assert.equal(videoProbe.metadataProvenance["coverage"], "cross-checked");
    assert.equal(videoProbe.referenceQuality["status"], "measured");
    assert.equal(
      (videoProbe.compressionSignature as Record<string, unknown>)["artifactProfile"],
      "edge"
    );

    const duplicateRun = toolRuns.find(function (entry) {
      const args = Array.isArray(entry["args"]) ? (entry["args"] as string[]) : [];
      return entry["toolId"] === "visual-forensics-py" && args[2] === "duplicate";
    });
    assert.ok(duplicateRun);
    const duplicateOptions = JSON.parse((duplicateRun["args"] as string[])[4] as string) as Record<
      string,
      unknown
    >;
    assert.equal(duplicateOptions["frameStep"], 5);
    assert.equal(duplicateOptions["similarityThreshold"], 0.94);
    assert.equal(
      toolRuns.some(function (entry) {
        return entry["toolId"] === "exiftool";
      }),
      true
    );
    assert.equal(
      toolRuns.some(function (entry) {
        return entry["toolId"] === "mediainfo";
      }),
      true
    );

    const imageProbe = await probeRuntime.runVideoStructureProbe(
      runtime,
      project,
      "req-image-forensics",
      "job-image-forensics",
      { metadata: { kind: "image" }, path: "/tmp/source.png" },
      {
        moduleSettings: {
          "reference-quality-check": { metricSet: "ssim", minDelta: 0.02 },
        },
        referenceTarget: { path: "/tmp/reference.png" },
        sourceKind: "image",
      }
    );
    assert.equal(imageProbe.metadataProvenance["status"], "measured");
    assert.equal(imageProbe.referenceQuality["status"], "measured");
    assert.equal(
      (imageProbe.nearDuplicateFrame as Record<string, unknown>)["status"],
      "unavailable"
    );
    assert.equal(
      toolRuns.some(function (entry) {
        const args = Array.isArray(entry["args"]) ? (entry["args"] as string[]) : [];
        return (
          entry["requestId"] === "req-image-forensics" &&
          args.includes("blackdetect=d=0.25:pix_th=0.10,freezedetect=n=-40dB:d=0.4")
        );
      }),
      false
    );
  });
});
