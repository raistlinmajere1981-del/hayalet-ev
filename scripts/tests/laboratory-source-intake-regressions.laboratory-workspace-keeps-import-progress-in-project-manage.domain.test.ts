import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

import { createMediaYoutubeSourceIntakeRuntime } from "../../rooms/laboratory/features/media-analysis/host/source-intake-youtube.ts";
import { renderLabSourcePanel } from "../../rooms/laboratory/ui/lab-source-panel.ts";
import { renderWorkspaceSurface } from "../../rooms/laboratory/ui/workspace-surface.ts";

const sourcePresets = JSON.parse(
  readFileSync("rooms/laboratory/tools/source-presets.json", "utf8")
) as Record<string, unknown>;
const ytDlpForm = JSON.parse(
  readFileSync("rooms/laboratory/tools/yt-dlp.form.json", "utf8")
) as Record<string, unknown>;

function toRecord(value: unknown): Record<string, unknown> {
  return value !== null && typeof value === "object" && Array.isArray(value) === false
    ? (value as Record<string, unknown>)
    : {};
}

function asNonEmptyString(value: unknown) {
  return typeof value === "string" && value.trim() !== "" ? value.trim() : null;
}

function createYoutubeArgsRuntime() {
  return createMediaYoutubeSourceIntakeRuntime({
    asNonEmptyString,
    callRoomTools: async function () {
      return {};
    },
    cancelJobsForProject: async function () {
      return null;
    },
    clearJob: function () {
      return undefined;
    },
    getActiveProject: function () {
      return null;
    },
    getPresetDefaultCustomValues: function (presetsValue, presetId) {
      return toRecord(
        toRecord(toRecord(toRecord(presetsValue)["youtubePresets"])[presetId])[
          "defaultCustomValues"
        ]
      );
    },
    getProjectSourceDir: function () {
      return "/tmp/lab-youtube-source";
    },
    normalizeMimeType: function () {
      return "video/mp4";
    },
    patchActiveProject: async function () {
      return null;
    },
    pushJobState: function () {
      return undefined;
    },
    registerJob: function () {
      return undefined;
    },
    resetEditForCurrentSource: function () {
      return undefined;
    },
    resetProfileForCurrentSource: function () {
      return undefined;
    },
    resolvePreparedSource: async function () {
      return {
        metadata: {},
        metadataError: null,
        mimeType: "video/mp4",
        storedFileName: "clip.mp4",
        storedPath: "/tmp/lab-youtube-source/clip.mp4",
      };
    },
    roomId: "laboratory",
    toRecord,
  });
}

function assertArgPair(args: string[], flag: string, value: string) {
  const flagIndex = args.indexOf(flag);
  assert.notEqual(flagIndex, -1);
  assert.equal(args[flagIndex + 1], value);
}


describe("laboratory workspace keeps import progress in project management instead of the ", () => {
void test("laboratory workspace keeps import progress in project management instead of the center surface", () => {
  const state = createWorkspaceState({
    activityFeed: [
      {
        id: "evt-1",
        message: "YouTube source is being prepared",
        detail: "Fetching media streams and writing into the project source folder.",
        action: "source-download-youtube",
        stage: "running",
        percent: 42,
        timestamp: Date.now(),
        source: "host",
        kind: "activity",
        severity: "info",
        scope: "global",
        moduleId: null,
        rawLine: null,
      },
    ],
    sourceProbeStatus: "running",
    toolState: {
      tools: {
        "yt-dlp": { installed: true },
      },
    },
    source: {
      kind: "video",
      mode: "youtube",
      status: "idle",
      storedFileName: null,
      storedPath: null,
      routeLabel: null,
      metadata: {},
      drafts: {
        urlInput: "",
        youtubeUrl: "https://youtube.com/watch?v=abc123",
        youtubePreset: "custom",
        youtubeCustom: {
          format: "best[height<=720]/best",
          mergeOutputFormat: "mp4",
          recodeVideo: "none",
          audioFormat: "none",
          limitRate: "2M",
          retries: 12,
        },
      },
    },
  });
  const overlayHtml = renderLabSourcePanel(state);
  const centerHtml = renderWorkspaceSurface(state).main;

  assert.match(overlayHtml, /class="labx-source-panel"/);
  assert.match(overlayHtml, /class="labx-sp-url-overlay"/);
  assert.match(overlayHtml, /data-lab-action="project-import-local-add"/);
  assert.match(overlayHtml, /data-lab-action="project-import-check-url"/);
  assert.match(overlayHtml, /data-lab-field="project-import\.urlInput"/);
  assert.doesNotMatch(overlayHtml, /data-lab-action="project-import-kind"/);
  assert.doesNotMatch(overlayHtml, /data-lab-action="project-import-method"/);
  assert.match(overlayHtml, /class="labx-project-import__progress"[\s\S]*?42%/);
  assert.doesNotMatch(overlayHtml, /class="labx-project-import__details"/);
  assert.doesNotMatch(overlayHtml, /<img class="labx-import-review__media"/);
  assert.doesNotMatch(overlayHtml, /data-lab-field="source\.kind"/);
  assert.doesNotMatch(overlayHtml, /data-lab-field="source\.mode"/);
  assert.doesNotMatch(centerHtml, /data-lab-field="source\.kind"/);
  assert.doesNotMatch(centerHtml, /class="labx-source-bar/);
  assert.doesNotMatch(centerHtml, /class="labx-source-intake__progress"/);
  assert.doesNotMatch(
    centerHtml,
    /Fetching media streams and writing into the project source folder\./
  );
  assert.doesNotMatch(
    overlayHtml + centerHtml,
    /yt-dlp downloads the media into the project source folder and keeps the resolved preset with the project draft\./
  );
});
void test("laboratory workspace exposes one local picker and one URL checker for every media type", () => {
  const html = renderProjectWorkspaceHtml({
    source: {
      kind: "audio",
      mode: "url",
      status: "idle",
      storedFileName: null,
      storedPath: null,
      routeLabel: null,
      metadata: {},
      drafts: {
        urlInput: "https://example.com/clip.mp3",
        youtubeUrl: "",
        youtubePreset: "medium",
        youtubeCustom: {},
      },
    },
  });

  assert.match(html, /Yerel Dosya Ekle/);
  assert.match(html, /data-lab-action="project-import-local-add"/);
  assert.match(html, /data-lab-action="project-import-check-url"/);
  assert.doesNotMatch(html, /data-lab-action="project-import-url-add"/);
  assert.match(html, /data-lab-action="project-import-clear"/);
  assert.doesNotMatch(html, /data-lab-action="project-import-method"/);
  assert.match(html, /data-lab-field="project-import\.urlInput"/);
  assert.equal(html.includes("project-import." + "file" + "NameHint"), false);
});
void test("laboratory workspace surfaces missing yt-dlp after a checked YouTube URL", () => {
  const html = renderProjectWorkspaceHtml({
    toolState: { tools: {} },
    urlCheckResult: {
      url: "https://youtube.com/watch?v=abc123",
      isYoutube: true,
      kind: "video",
      preview: { title: "Evidence clip", thumbnail: "https://img.youtube.com/vi/abc123/0.jpg" },
      formats: [{ formatId: "18", label: "MP4 360p", kind: "muxed", extension: "mp4" }],
      selectedVideoFormatId: "18",
    },
    source: {
      kind: "video",
      mode: "youtube",
      status: "idle",
      storedFileName: null,
      storedPath: null,
      routeLabel: null,
      metadata: {},
      drafts: {
        urlInput: "",
        youtubeUrl: "https://youtube.com/watch?v=abc123",
        youtubePreset: "medium",
        youtubeCustom: {},
      },
    },
  });

  assert.match(html, /data-lab-action="project-import-url-add"[\s\S]*disabled/);
  assert.doesNotMatch(html, /data-lab-action="project-import-check-url"/);
  assert.match(html, /yt-dlp is required\./);
});
void test("laboratory workspace shows checked YouTube details and rich download controls", () => {
  const html = renderProjectWorkspaceHtml({
    toolState: {
      tools: {
        "yt-dlp": { installed: true },
      },
    },
    urlCheckResult: {
      url: "https://youtube.com/watch?v=abc123",
      isYoutube: true,
      kind: "video",
      preview: {
        title: "Evidence clip",
        duration: 154,
        thumbnail: "https://img.youtube.com/vi/abc123/0.jpg",
      },
      formats: [
        {
          formatId: "137",
          label: "Video 1080p",
          kind: "video",
          extension: "mp4",
          resolution: "1920x1080",
        },
        {
          formatId: "140",
          label: "Audio m4a",
          kind: "audio",
          extension: "m4a",
          bitrateKbps: 128,
        },
      ],
      selectedVideoFormatId: "137",
      selectedAudioFormatId: "140",
    },
    source: {
      kind: "video",
      mode: "youtube",
      status: "idle",
      storedFileName: null,
      storedPath: null,
      routeLabel: null,
      metadata: {},
      drafts: {
        urlInput: "",
        youtubeUrl: "https://youtube.com/watch?v=abc123",
        youtubePreset: "custom",
        youtubeCustom: {
          format: "best[height<=720]/best",
          mergeOutputFormat: "mp4",
          recodeVideo: "none",
          audioFormat: "none",
          limitRate: "2M",
          retries: 12,
        },
      },
    },
  });

  assert.match(html, /class="labx-project-import__youtube-result"/);
  assert.match(
    html,
    /class="labx-project-import__youtube-result"[\s\S]*class="labx-project-import__details"/
  );
  assert.equal((html.match(/class="labx-project-import__details"/g) ?? []).length, 1);
  assert.match(html, /data-lab-field="project-import\.youtubeVideoFormat"/);
  assert.match(html, /data-lab-field="project-import\.youtubeAudioFormat"/);
  assert.match(html, /<option value="137" selected>Video 1080p<\/option>/);
  assert.match(html, /<option value="140" selected>Audio m4a<\/option>/);
  assert.doesNotMatch(html, /class="labx-project-import__format-grid"/);
  assert.doesNotMatch(html, /class="labx-pw-inspector labx-import-review"/);
  assert.match(html, /data-lab-action="project-import-url-add"/);
  assert.doesNotMatch(html, /data-lab-action="project-import-check-url"/);
  assert.match(html, /data-lab-field="project-import\.youtubeCaptureMode"/);
  assert.doesNotMatch(html, /data-lab-field="project-import\.youtubeCustom\.format"/);
  assert.doesNotMatch(html, /data-lab-field="project-import\.youtubeCustom\.playlistItems"/);
  assert.doesNotMatch(html, /data-lab-field="project-import\.youtubeCustom\.writeSubtitles"/);
  assert.doesNotMatch(html, /data-lab-field="project-import\.youtubeCustom\.writeAutoSubtitles"/);
  assert.doesNotMatch(html, /data-lab-field="project-import\.youtubeCustom\.subtitlesLang"/);
  assert.match(html, /data-lab-field="project-import\.youtubeCustom\.mergeOutputFormat"/);
  assert.match(html, /data-lab-field="project-import\.youtubeCustom\.retries"/);
  assert.doesNotMatch(html, /data-lab-field="project-import\.youtubeCustom\.audioQuality"/);
  assert.doesNotMatch(html, /Source Import Workspace/);
  assert.doesNotMatch(html, /Kaynak Ice Aktarma Calisma Alani/);
  assert.doesNotMatch(html, />Video \/ YouTube</);
  assert.doesNotMatch(html, /data-lab-action="youtube-import-set-strategy"/);
  assert.doesNotMatch(html, /data-lab-field="youtube-import\.custom\.resolution"/);
  assert.doesNotMatch(html, /class="labx-source-intake__youtube-stack"/);
  assert.doesNotMatch(html, /data-lab-field="source\.youtubeCustom\.format"/);
  assert.doesNotMatch(
    html,
    /yt-dlp downloads the media into the project source folder and keeps the resolved preset with the project draft\./
  );
});
});
