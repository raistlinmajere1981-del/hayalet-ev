import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

import { createLabStore } from "../../rooms/laboratory/runtime/lab-store.ts";
import { renderProjectWorkspaceOverlay } from "../../rooms/laboratory/ui/project-workspace-overlay.ts";
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
  projectImportKind?: "video" | "audio" | "image";
  projectImportMethod?: "local" | "url" | "youtube";
  urlCheckResult?: Record<string, unknown>;
  youtubeStrategy?: "video_best" | "audio_only" | "low_size" | "custom";
  youtubeCustom?: Record<string, unknown>;
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
        availableModuleIds: ["media-analysis", "audio-analysis"],
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
  const sourceKind = overrides.projectImportKind || String(overrides.source["kind"] || "video");
  if (sourceKind === "video" || sourceKind === "audio" || sourceKind === "image") {
    store.dispatch({ type: "project-import-kind-changed", kind: sourceKind });
  }
  const sourceMethod = overrides.projectImportMethod || String(overrides.source["mode"] || "local");
  if (sourceMethod === "local" || sourceMethod === "url" || sourceMethod === "youtube") {
    store.dispatch({
      type: "project-import-method-changed",
      method: sourceMethod,
    });
  }
  if (overrides.youtubeStrategy) {
    store.dispatch({
      type: "youtube-import-set-strategy",
      strategy: overrides.youtubeStrategy,
    });
  }
  if (overrides.youtubeCustom) {
    store.dispatch({
      type: "youtube-import-custom-updated",
      patch: overrides.youtubeCustom as never,
    });
  }
  if (overrides.urlCheckResult) {
    store.dispatch({
      type: "host-event-received",
      event: {
        id: "evt-url-check",
        kind: "request-result",
        severity: "success",
        message: "URL check completed",
        detail: null,
        action: "project-import-check-url",
        stage: "completed",
        timestamp: Date.now(),
        source: "host",
        scope: "global",
        moduleId: null,
        rawLine: null,
        result: overrides.urlCheckResult,
      } as never,
    });
  }
  store.dispatch({
    type: "project-workspace-toggled",
    open: true,
  });
  return store.getState();
}

function renderProjectWorkspaceHtml(overrides: Parameters<typeof createWorkspaceState>[0]) {
  return renderProjectWorkspaceOverlay(createWorkspaceState(overrides));
}

test("laboratory workspace keeps import progress in project management instead of the center surface", () => {
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
          writeSubtitles: true,
          writeAutoSubtitles: false,
          subtitlesLang: "en.*",
          playlistItems: "",
          limitRate: "2M",
          retries: 12,
        },
      },
    },
  });
  const overlayHtml = renderProjectWorkspaceOverlay(state);
  const centerHtml = renderWorkspaceSurface(state).main;

  assert.match(overlayHtml, /class="labx-project-import"/);
  assert.match(overlayHtml, /data-lab-action="project-import-local-add"/);
  assert.match(overlayHtml, /data-lab-action="project-import-check-url"/);
  assert.match(overlayHtml, /data-lab-field="project-import\.urlInput"/);
  assert.doesNotMatch(overlayHtml, /data-lab-action="project-import-kind"/);
  assert.doesNotMatch(overlayHtml, /data-lab-action="project-import-method"/);
  assert.match(overlayHtml, /class="labx-project-import__progress"[\s\S]*?42%/);
  assert.match(overlayHtml, /class="labx-project-import__details"/);
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

test("laboratory workspace exposes one local picker and one URL checker for every media type", () => {
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

  assert.match(html, /Local Dosya Ekle/);
  assert.match(html, /data-lab-action="project-import-local-add"/);
  assert.match(html, /data-lab-action="project-import-check-url"/);
  assert.match(html, /data-lab-action="project-import-url-add"[\s\S]*disabled/);
  assert.doesNotMatch(html, /data-lab-action="project-import-method"/);
  assert.match(html, /data-lab-field="project-import\.urlInput"/);
  assert.equal(html.includes("project-import." + "file" + "NameHint"), false);
});

test("laboratory workspace surfaces missing yt-dlp after a checked YouTube URL", () => {
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
  assert.match(html, /data-lab-action="project-import-check-url"/);
  assert.match(html, /title="yt-dlp is required\."/);
});

test("laboratory workspace replaces YouTube presets with checked format selectors", () => {
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
          writeSubtitles: true,
          writeAutoSubtitles: false,
          subtitlesLang: "en.*",
          playlistItems: "",
          limitRate: "2M",
          retries: 12,
        },
      },
    },
  });

  assert.match(html, /class="labx-project-import__youtube-result"/);
  assert.match(html, /data-lab-field="project-import\.youtubeVideoFormat"/);
  assert.match(html, /value="137" selected/);
  assert.match(html, /data-lab-field="project-import\.youtubeAudioFormat"/);
  assert.match(html, /value="140" selected/);
  assert.match(html, /data-lab-action="project-import-url-add"/);
  assert.match(html, /data-lab-action="project-import-check-url"/);
  assert.doesNotMatch(html, /data-lab-action="youtube-import-set-strategy"/);
  assert.doesNotMatch(html, /data-lab-field="youtube-import\.custom\.resolution"/);
  assert.doesNotMatch(html, /class="labx-source-intake__youtube-stack"/);
  assert.doesNotMatch(html, /data-lab-field="source\.youtubeCustom\.format"/);
  assert.doesNotMatch(
    html,
    /yt-dlp downloads the media into the project source folder and keeps the resolved preset with the project draft\./
  );
});

test("laboratory workspace removes the legacy local-copy helper copy from the intake panel", () => {
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

  assert.match(html, /Local Dosya Ekle/);
  assert.match(html, /data-lab-action="project-import-local-add"/);
  assert.doesNotMatch(html, /Copy Local Source/);
  assert.doesNotMatch(
    html,
    /The selected file is copied into the active project source folder\. Your original local file stays untouched\./
  );
});

test("laboratory controller keeps project import draft and add wiring on the active source flow", () => {
  const source = readFileSync("rooms/laboratory/runtime/lab-run-controller.ts", "utf8");

  assert.match(source, /function buildProjectImportDraftPatch/);
  assert.equal(source.includes("project-import." + "file" + "NameHint"), false);
  assert.match(source, /case "project-import\.urlInput":/);
  assert.match(source, /case "project-import\.youtubeVideoFormat":/);
  assert.match(source, /case "project-import\.youtubeAudioFormat":/);
  assert.match(source, /type: "project-import-draft-updated"/);
  assert.match(source, /type: "youtube-import-format-selected"/);
  assert.match(source, /function runProjectImportAdd/);
  assert.match(source, /buildProjectImportHostAction\(deps\.store\.getState\(\)\)/);
  assert.match(source, /buildProjectImportLocalHostAction/);
  assert.match(source, /buildProjectImportUrlCheckAction/);
  assert.match(
    source,
    /sendMediaAction\(importAction\.action, \{ fields: importAction\.fields \}\)/
  );
  assert.match(source, /case "project-import-local-add":/);
  assert.match(source, /case "project-import-check-url":/);
  assert.match(source, /case "project-import-url-add":/);
  assert.match(source, /case "project-import-add":/);
  assert.match(source, /case "project-import-clear":/);
  assert.match(source, /youtubeCustom: sourceDrafts\.youtubeCustom/);
  assert.match(source, /case "source-youtube-preset":/);
  assert.match(source, /field\.startsWith\("source\.youtubeCustom\."\)/);
  assert.match(source, /mode: getDefaultSourceMode\(state, targetValue\)/);
  assert.match(source, /case "source\.mode":/);
  assert.match(
    source,
    /case "source\.mode":\s*if \(targetValue === "youtube"\) \{\s*dispatch\(\{ type: "enter-youtube-import-mode" \}\);\s*return;\s*\}\s*if \(isWorkspaceMutationLocked\("source"\)\)/
  );
  assert.match(
    source,
    /sendMediaAction\("source-update-draft", \{\s*fields: mergeSourceDrafts\(state, patch\)/
  );
});

test("laboratory YouTube import progress hides tool command streams", () => {
  const roomToolService = readFileSync("electron/room-tool-service.ts", "utf8");
  const progressRuntime = readFileSync(
    "rooms/laboratory/shared/host/room-tools-progress.ts",
    "utf8"
  );
  const runtimeEvents = readFileSync("rooms/laboratory/shared/host/runtime-events.ts", "utf8");

  assert.match(roomToolService, /message: "Tool run started\."/);
  assert.doesNotMatch(roomToolService, /message:\s*\(request\.args \?\? \[\]\)\.join/);
  assert.match(progressRuntime, /job\.action !== "source-download-youtube"/);
  assert.match(progressRuntime, /phaseLabel/);
  assert.match(runtimeEvents, /percent: typeof throttledPayload\["percent"\]/);
});
