import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

import { createMediaUrlSourceIntakeRuntime } from "../../rooms/laboratory/features/media-analysis/host/source-intake-url.ts";
import { createMediaYoutubeSourceIntakeRuntime } from "../../rooms/laboratory/features/media-analysis/host/source-intake-youtube.ts";
import { createLabStore } from "../../rooms/laboratory/runtime/lab-store.ts";
import { resolveDrawerMode } from "../../rooms/laboratory/runtime/lab-selectors.ts";
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


describe("laboratory workspace shows YouTube conversion quality only when audio conversion", () => {
void test("laboratory workspace shows YouTube conversion quality only when audio conversion applies", () => {
  const enTranslations = JSON.parse(readFileSync("rooms/laboratory/i18n/en.json", "utf8")) as Record<string, unknown>;
  const trTranslations = JSON.parse(readFileSync("rooms/laboratory/i18n/tr.json", "utf8")) as Record<string, unknown>;
  const checkedYoutubeResult = {
    url: "https://youtube.com/watch?v=abc123",
    isYoutube: true,
    kind: "video",
    preview: { title: "Evidence clip" },
    formats: [
      { formatId: "137", label: "Video 1080p", kind: "video", extension: "mp4" },
      { formatId: "140", label: "Audio m4a", kind: "audio", extension: "m4a" },
    ],
    selectedVideoFormatId: "137",
    selectedAudioFormatId: "140",
  };
  const baseSource = {
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
      youtubeCaptureMode: "video+audio",
      youtubeCustom: {
        audioFormat: "none",
      },
    },
  };

  const keepOriginalHtml = renderProjectWorkspaceHtml({
    toolState: { tools: { "yt-dlp": { installed: true } } },
    urlCheckResult: checkedYoutubeResult,
    source: baseSource,
  });
  assert.doesNotMatch(
    keepOriginalHtml,
    /data-lab-field="project-import\.youtubeCustom\.audioQuality"/
  );

  const extractAudioHtml = renderProjectWorkspaceHtml({
    toolState: { tools: { "yt-dlp": { installed: true } } },
    urlCheckResult: checkedYoutubeResult,
    source: {
      ...baseSource,
      drafts: {
        ...baseSource.drafts,
        youtubeCustom: {
          audioFormat: "mp3",
        },
      },
    },
  });
  assert.match(extractAudioHtml, /data-lab-field="project-import\.youtubeCustom\.audioQuality"/);

  const audioOnlyHtml = renderProjectWorkspaceHtml({
    toolState: { tools: { "yt-dlp": { installed: true } } },
    urlCheckResult: checkedYoutubeResult,
    source: {
      ...baseSource,
      drafts: {
        ...baseSource.drafts,
        youtubeCaptureMode: "audio-only",
      },
    },
  });
  assert.match(audioOnlyHtml, /data-lab-field="project-import\.youtubeCustom\.audioQuality"/);
  assert.doesNotMatch(audioOnlyHtml, /data-lab-field="project-import\.youtubeVideoFormat"/);
  const enYouTubeRoot = enTranslations["mediaAnalysis"] as Record<string, unknown>;
  const trYouTubeRoot = trTranslations["mediaAnalysis"] as Record<string, unknown>;
  const enSource = enYouTubeRoot["source"] as Record<string, unknown>;
  const trSource = trYouTubeRoot["source"] as Record<string, unknown>;
  const enForm = enSource["youtubeForm"] as Record<string, unknown>;
  const trForm = trSource["youtubeForm"] as Record<string, unknown>;
  const enFields = enForm["fields"] as Record<string, unknown>;
  const trFields = trForm["fields"] as Record<string, unknown>;
  assert.equal(
    enFields["audioQuality"],
    "Conversion quality"
  );
  assert.equal(
    trFields["audioQuality"],
    "Donusturme kalitesi"
  );
});
void test("laboratory workspace hides URL check details while checking", () => {
  const store = createLabStore();
  store.dispatch({
    type: "snapshot-received",
    payload: {
      ready: true,
      featureId: "media-analysis",
      activeProjectId: "project-1",
      projects: [{ id: "project-1", name: "Draft", hasSource: false }],
      activeProject: {
        id: "project-1",
        name: "Draft",
        source: {
          kind: "video",
          mode: "youtube",
          status: "idle",
          drafts: {
            urlInput: "",
            youtubeUrl: "",
            youtubePreset: "medium",
            youtubeCustom: {},
          },
        },
        edit: {},
        profile: { preflight: {} },
        process: { records: {} },
        report: { records: {} },
      },
      sourcePresets,
      toolState: { tools: { "yt-dlp": { installed: true } } },
    },
  });
  store.dispatch({
    type: "project-import-draft-updated",
    kind: "video",
    patch: { urlInput: "https://youtube.com/watch?v=abc123" },
  });
  store.dispatch({
    type: "project-import-url-check-started",
    url: "https://youtube.com/watch?v=abc123",
  });
  const html = renderLabSourcePanel(store.getState());

  assert.match(html, /data-lab-action="project-import-check-url"[\s\S]*disabled/);
  assert.match(html, /YouTube format/i);
  assert.doesNotMatch(html, /class="labx-project-import__youtube-result"/);
  assert.doesNotMatch(html, /class="labx-project-import__details"/);
  assert.doesNotMatch(html, /data-lab-field="project-import\.youtubeCustom\.format"/);
  assert.doesNotMatch(html, /data-lab-field="project-import\.youtubeVideoFormat"/);
  assert.doesNotMatch(html, /data-lab-field="project-import\.youtubeAudioFormat"/);
});
void test("laboratory YouTube project import forwards selected yt-dlp streams to host args", () => {
  const runtime = createYoutubeArgsRuntime();
  const toolState = {
    ffmpeg: { installed: true },
    sourcePresets,
  };
  const project = {
    id: "project-youtube-stream-selection",
    source: {
      drafts: {
        youtubeUrl: "https://youtube.com/watch?v=abc123",
        youtubePreset: "custom",
        youtubeCaptureMode: "video-only",
        youtubeCustom: {
          format: "137",
          mergeOutputFormat: "mp4",
          recodeVideo: "none",
          playlistItems: "1-3",
          writeSubtitles: true,
          writeAutoSubtitles: true,
          subtitlesLang: "en.*",
        },
      },
    },
  };

  const videoOnlyArgs = runtime.buildYtDlpArgs(project, toolState, "/tmp/lab-source");

  assertArgPair(videoOnlyArgs, "-f", "137");
  assertArgPair(videoOnlyArgs, "--merge-output-format", "mp4");
  assert.equal(videoOnlyArgs.includes("bestvideo"), false);
  assert.equal(videoOnlyArgs.includes("--playlist-items"), false);
  assert.equal(videoOnlyArgs.includes("1-3"), false);
  assert.equal(videoOnlyArgs.includes("--write-subs"), false);
  assert.equal(videoOnlyArgs.includes("--write-auto-subs"), false);
  assert.equal(videoOnlyArgs.includes("--sub-langs"), false);
  assert.equal(videoOnlyArgs.includes("en.*"), false);
  assert.equal(videoOnlyArgs.includes("--no-playlist"), true);

  const audioOnlyArgs = runtime.buildYtDlpArgs(
    {
      ...project,
      source: {
        drafts: {
          youtubeUrl: "https://youtube.com/watch?v=abc123",
          youtubePreset: "custom",
          youtubeCaptureMode: "audio-only",
          youtubeCustom: {
            format: "140",
            audioFormat: "mp3",
            audioQuality: "2",
          },
        },
      },
    },
    toolState,
    "/tmp/lab-source"
  );

  assertArgPair(audioOnlyArgs, "-f", "140");
  assert.equal(audioOnlyArgs.includes("-x"), true);
  assertArgPair(audioOnlyArgs, "--audio-format", "mp3");
  assertArgPair(audioOnlyArgs, "--audio-quality", "2");
});
void test("laboratory workspace removes the legacy local-copy helper copy from the intake panel", () => {
  const html = renderProjectWorkspaceHtml({
    source: {
      kind: "video",
      mode: "local",
      status: "idle",
      storedFileName: null,
      storedPath: null,
      routeLabel: null,
      metadata: {},
      drafts: {
        urlInput: "",
        youtubeUrl: "",
        youtubePreset: "medium",
        youtubeCustom: {},
      },
    },
  });

  assert.match(html, /Yerel Dosya Ekle/);
  assert.match(html, /data-lab-action="project-import-local-add"/);
  assert.doesNotMatch(html, /Copy Local Source/);
  assert.doesNotMatch(
    html,
    /The selected file is copied into the active project source folder\. Your original local file stays untouched\./
  );
});
});
