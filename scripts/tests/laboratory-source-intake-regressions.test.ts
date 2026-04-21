import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

import { createLabStore } from "../../rooms/laboratory/runtime/lab-store.ts";
import { renderWorkspaceSurface } from "../../rooms/laboratory/ui/workspace-surface.ts";

const sourcePresets = JSON.parse(
  readFileSync("rooms/laboratory/shared/data/tools/source-presets.json", "utf8")
);
const ytDlpForm = JSON.parse(
  readFileSync("rooms/laboratory/shared/data/tools/yt-dlp.form.json", "utf8")
);

function createWorkspaceState(overrides: {
  activityFeed?: Array<Record<string, unknown>>;
  sourceProbeStatus?: "idle" | "running" | "completed" | "failed";
  toolState?: Record<string, unknown>;
  source: Record<string, unknown>;
}) {
  const store = createLabStore();
  store.dispatch({
    type: "snapshot-received",
    payload: {
      ready: true,
      featureId: "media-analysis",
      activeProjectId: "project-1",
      projects: [{ id: "project-1", name: "2026-04-21 12-00 - draft", hasSource: false }],
      activeProject: {
        id: "project-1",
        name: "2026-04-21 12-00 - draft",
        createdAt: "2026-04-21T12:00:00.000Z",
        source: overrides.source,
        edit: {},
        profile: {
          preflight: {},
        },
        process: {
          records: {},
        },
        report: {
          records: {},
        },
      },
      workbench: {
        activeModuleId: "media-analysis",
        availableModuleIds: ["media-analysis", "audio-analysis", "subtitle-analysis"],
        selectedModuleIds: ["media-analysis"],
      },
      sourcePresets,
      ytDlpForm,
      toolState: overrides.toolState || { tools: {} },
      profileModels: [],
      sourceProbeStatus: overrides.sourceProbeStatus || "idle",
      activityFeed: overrides.activityFeed || [],
    },
  });
  (overrides.activityFeed || []).forEach(function (event) {
    store.dispatch({
      type: "host-event-received",
      event: event as never,
    });
  });
  return store.getState();
}

test("laboratory workspace places the source action beside import method and shows live import progress in the source bar", () => {
  const html = renderWorkspaceSurface(
    createWorkspaceState({
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
          fileNameHint: "",
          urlInput: "",
          youtubeUrl: "https://youtube.com/watch?v=abc123",
          youtubePreset: "custom",
          youtubeCustom: {
            format: "best[height<=720]/best",
            mergeOutputFormat: "mp4",
            recodeVideo: "none",
            audioFormat: "none",
            writeSubtitles: true,
            writeAutoSubtitles: false,
            subtitlesLang: "en.*",
            playlistItems: "",
            limitRate: "2M",
            retries: 12,
          },
        },
      },
    })
  ).main;

  assert.match(html, /data-lab-field="source\.kind"/);
  assert.match(
    html,
    /data-lab-field="source\.mode"[\s\S]*?<\/label>\s*<div class="labx-source-intake__action">[\s\S]*?Capture from YouTube/
  );
  assert.match(html, /data-lab-field="source\.youtubeUrl"/);
  assert.match(html, /class="labx-source-bar__progress"[\s\S]*?42%/);
  assert.doesNotMatch(html, /class="labx-source-intake__progress"/);
  assert.match(html, /Fetching media streams and writing into the project source folder\./);
  assert.doesNotMatch(
    html,
    /yt-dlp downloads the media into the project source folder and keeps the resolved preset with the project draft\./
  );
});

test("laboratory workspace keeps audio import limited to local and direct url methods", () => {
  const html = renderWorkspaceSurface(
    createWorkspaceState({
      source: {
        kind: "audio",
        mode: "url",
        status: "idle",
        storedFileName: null,
        storedPath: null,
        routeLabel: null,
        metadata: {},
        drafts: {
          fileNameHint: "clip.mp3",
          urlInput: "https://example.com/clip.mp3",
          youtubeUrl: "",
          youtubePreset: "medium",
          youtubeCustom: {},
        },
      },
    })
  ).main;

  assert.match(html, /<option value="audio" selected>Audio<\/option>/);
  assert.match(html, /<option value="local" >Local Copy<\/option>|<option value="local">Local Copy<\/option>/);
  assert.match(html, /<option value="url" selected>Direct URL<\/option>/);
  assert.doesNotMatch(html, /<option value="youtube"/);
  assert.match(html, /data-lab-field="source\.urlInput"/);
  assert.match(html, /data-lab-field="source\.fileNameHint"/);
  assert.match(html, /Download URL Source/);
});

test("laboratory workspace keeps youtube custom controls under the url and preset row in a dedicated two-row grid", () => {
  const html = renderWorkspaceSurface(
    createWorkspaceState({
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
          fileNameHint: "",
          urlInput: "",
          youtubeUrl: "https://youtube.com/watch?v=abc123",
          youtubePreset: "custom",
          youtubeCustom: {
            format: "best[height<=720]/best",
            mergeOutputFormat: "mp4",
            recodeVideo: "none",
            audioFormat: "none",
            writeSubtitles: true,
            writeAutoSubtitles: false,
            subtitlesLang: "en.*",
            playlistItems: "",
            limitRate: "2M",
            retries: 12,
          },
        },
      },
    })
  ).main;

  assert.match(html, /class="labx-source-intake__youtube-stack"/);
  assert.match(html, /class="labx-source-intake__youtube-main"/);
  assert.match(html, /class="labx-source-intake__custom-shell"/);
  assert.match(html, /class="labx-source-intake__custom-grid"/);
  assert.match(html, /data-lab-field="source\.youtubeCustom\.format"/);
  assert.match(html, /data-lab-field="source\.youtubeCustom\.writeSubtitles"/);
  assert.doesNotMatch(
    html,
    /yt-dlp downloads the media into the project source folder and keeps the resolved preset with the project draft\./
  );
});

test("laboratory workspace removes the legacy local-copy helper copy from the intake panel", () => {
  const html = renderWorkspaceSurface(
    createWorkspaceState({
      source: {
        kind: "video",
        mode: "local",
        status: "idle",
        storedFileName: null,
        storedPath: null,
        routeLabel: null,
        metadata: {},
        drafts: {
          fileNameHint: "",
          urlInput: "",
          youtubeUrl: "",
          youtubePreset: "medium",
          youtubeCustom: {},
        },
      },
    })
  ).main;

  assert.match(html, /Copy Local Source/);
  assert.doesNotMatch(
    html,
    /The selected file is copied into the active project source folder\. Your original local file stays untouched\./
  );
});

test("laboratory controller keeps youtube preset and custom draft wiring on the active source flow", () => {
  const source = readFileSync("rooms/laboratory/runtime/lab-run-controller.ts", "utf8");

  assert.match(source, /youtubeCustom: sourceDrafts\.youtubeCustom/);
  assert.match(source, /case "source-youtube-preset":/);
  assert.match(source, /field\.startsWith\("source\.youtubeCustom\."\)/);
  assert.match(source, /mode: getDefaultSourceMode\(state, targetValue\)/);
  assert.match(source, /sendMediaAction\("source-update-draft", \{\s*fields: mergeSourceDrafts\(state, patch\)/);
});
