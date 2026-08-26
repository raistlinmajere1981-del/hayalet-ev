import assert from "node:assert/strict";
import test from "node:test";

import { createMediaYoutubeSourceIntakeRuntime } from "../../rooms/laboratory/features/media-analysis/host/source-intake-youtube.ts";

function toRecord(value: unknown): Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function asNonEmptyString(value: unknown): string | null {
  return typeof value === "string" && value.trim() !== "" ? value.trim() : null;
}

function createRuntime() {
  return createMediaYoutubeSourceIntakeRuntime({
    asNonEmptyString,
    async callRoomTools() {
      return {};
    },
    async cancelJobsForProject() {
      return null;
    },
    clearJob() {},
    getActiveProject() {
      return null;
    },
    getPresetDefaultCustomValues() {
      return {};
    },
    getProjectSourceDir() {
      return "/tmp";
    },
    normalizeMimeType() {
      return "video/mp4";
    },
    async patchActiveProject() {
      return null;
    },
    pushJobState() {},
    registerJob() {},
    resetEditForCurrentSource() {},
    resetProfileForCurrentSource() {},
    async resolvePreparedSource() {
      return {
        metadata: null,
        metadataError: null,
        mimeType: null,
        storedFileName: null,
        storedPath: null,
      };
    },
    roomId: "laboratory",
    toRecord,
  });
}

void test("YouTube range preview falls back to a direct video-only googlevideo stream", () => {
  const runtime = createRuntime();
  const videoOnlyUrl =
    "https://rr1---sn.example.googlevideo.com/videoplayback?id=video-only";
  const selected = runtime.getYoutubePreviewStreamUrl({
    formats: [
      {
        format_id: "137",
        url: videoOnlyUrl,
        ext: "mp4",
        height: 1080,
        vcodec: "avc1.640028",
        acodec: "none",
        has_drm: false,
      },
    ],
  });

  assert.equal(selected, videoOnlyUrl);
});

void test("YouTube range preview still prefers a muxed stream when one is available", () => {
  const runtime = createRuntime();
  const muxedUrl = "https://rr2---sn.example.googlevideo.com/videoplayback?id=muxed";
  const videoOnlyUrl =
    "https://rr1---sn.example.googlevideo.com/videoplayback?id=video-only";
  const selected = runtime.getYoutubePreviewStreamUrl({
    formats: [
      {
        format_id: "137",
        url: videoOnlyUrl,
        ext: "mp4",
        height: 480,
        vcodec: "avc1.4d401f",
        acodec: "none",
        has_drm: false,
      },
      {
        format_id: "18",
        url: muxedUrl,
        ext: "mp4",
        height: 360,
        vcodec: "avc1.42001E",
        acodec: "mp4a.40.2",
        has_drm: false,
      },
    ],
  });

  assert.equal(selected, muxedUrl);
});

void test("YouTube range preview rejects non-googlevideo and DRM candidates", () => {
  const runtime = createRuntime();
  const selected = runtime.getYoutubePreviewStreamUrl({
    formats: [
      {
        format_id: "18",
        url: "https://example.com/video.mp4",
        ext: "mp4",
        height: 360,
        vcodec: "avc1.42001E",
        acodec: "mp4a.40.2",
        has_drm: false,
      },
      {
        format_id: "22",
        url: "https://rr2---sn.example.googlevideo.com/videoplayback?id=drm",
        ext: "mp4",
        height: 720,
        vcodec: "avc1.64001F",
        acodec: "mp4a.40.2",
        has_drm: true,
      },
    ],
  });

  assert.equal(selected, null);
});
