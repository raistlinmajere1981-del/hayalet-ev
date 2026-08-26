import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

import { createMediaYoutubeSourceIntakeRuntime } from "../../rooms/laboratory/features/media-analysis/host/source-intake-youtube.ts";
import { createLabSourceActionController } from "../../rooms/laboratory/runtime/controller/lab-source-action-controller.ts";
import { createLabStore } from "../../rooms/laboratory/runtime/lab-store.ts";
import { createLaboratoryProjectRecordsRuntime } from "../../rooms/laboratory/shared/host/project-records.ts";
import { createLaboratoryPresetSourceRuntime } from "../../rooms/laboratory/shared/host/preset-source-runtime.ts";
import { LAB_FALLBACK_I18N } from "../../rooms/laboratory/ui/lab-i18n.ts";
import { renderLabSourcePanel } from "../../rooms/laboratory/ui/lab-source-panel.ts";
import { renderYoutubeRangeOverlay } from "../../rooms/laboratory/ui/youtube-range-overlay.ts";

const sourcePresets = JSON.parse(
  readFileSync("rooms/laboratory/tools/source-presets.json", "utf8")
) as Record<string, unknown>;

function toRecord(value: unknown): Record<string, unknown> {
  return value !== null && typeof value === "object" && Array.isArray(value) === false
    ? (value as Record<string, unknown>)
    : {};
}

function asNonEmptyString(value: unknown): string | null {
  return typeof value === "string" && value.trim() !== "" ? value.trim() : null;
}

function getPresetDefaultCustomValues(presetsValue: unknown, presetId: string) {
  return toRecord(
    toRecord(toRecord(toRecord(presetsValue)["youtubePresets"])[presetId])["defaultCustomValues"]
  );
}

function createYoutubeProject() {
  return {
    id: "project-youtube-range",
    source: {
      kind: "video",
      mode: "youtube",
      status: "idle",
      drafts: {
        kind: "video",
        youtubeUrl: "https://www.youtube.com/watch?v=abc123",
        youtubePreset: "custom",
        youtubeCaptureMode: "video+audio",
        youtubeCustom: {
          format: "18",
          mergeOutputFormat: "mp4",
          recodeVideo: "none",
          audioFormat: "none",
        },
      },
    },
    workbench: {},
  };
}

function createYoutubeRuntime(
  options: {
    project?: ReturnType<typeof createYoutubeProject>;
    toolCalls?: Array<Record<string, unknown>>;
  } = {}
) {
  const project = options.project ?? createYoutubeProject();
  const toolCalls = options.toolCalls ?? [];
  return createMediaYoutubeSourceIntakeRuntime({
    asNonEmptyString,
    async callRoomTools(payload) {
      toolCalls.push(payload);
      return {
        run: {
          stdout: "/tmp/lab-youtube-source/range-abc123.mp4\n",
        },
      };
    },
    async cancelJobsForProject() {
      return null;
    },
    clearJob() {},
    getActiveProject() {
      return project;
    },
    getPresetDefaultCustomValues,
    getProjectSourceDir() {
      return "/tmp/lab-youtube-source";
    },
    normalizeMimeType() {
      return "video/mp4";
    },
    async patchActiveProject(_runtime, updater) {
      updater(project);
      return null;
    },
    pushJobState() {},
    registerJob() {},
    resetEditForCurrentSource() {},
    resetProfileForCurrentSource() {},
    async resolvePreparedSource() {
      return {
        metadata: {
          durationSeconds: 10.04,
          videoCodec: "h264",
        },
        metadataError: null,
        mimeType: "video/mp4",
        storedFileName: "range-abc123.mp4",
        storedPath: "/tmp/lab-youtube-source/range-abc123.mp4",
      };
    },
    roomId: "laboratory",
    toRecord,
  });
}

const readyToolState = {
  ffmpeg: { installed: true, binaryPath: "/opt/laboratory/ffmpeg/bin/ffmpeg" },
  sourcePresets,
};

void test("laboratory YouTube range preview permits only the yt-dlp media CDN", () => {
  const windowManagerSource = readFileSync("electron/window-manager.ts", "utf8");

  assert.match(windowManagerSource, /media-src[^\n]+https:\/\/\*\.googlevideo\.com/);
  assert.doesNotMatch(windowManagerSource, /media-src[^\n]+https:\s/);
});

void test("laboratory YouTube full and range requests share one yt-dlp argument builder", () => {
  const runtime = createYoutubeRuntime();
  const project = createYoutubeProject();
  const fullArgs = runtime.buildYtDlpArgs(project, readyToolState, "/tmp/lab-youtube-source");

  assert.equal(fullArgs.includes("--download-sections"), false);
  assert.equal(fullArgs.includes("--force-keyframes-at-cuts"), false);

  const rangeArgs = runtime.buildYtDlpArgs(
    project,
    readyToolState,
    "/tmp/lab-youtube-source",
    { startSeconds: 10, endSeconds: 20 },
    120
  );
  const rangeIndex = rangeArgs.indexOf("--download-sections");
  assert.notEqual(rangeIndex, -1);
  assert.equal(rangeArgs[rangeIndex + 1], "*10-20");
  assert.equal(rangeArgs.includes("--force-keyframes-at-cuts"), false);
});

void test("laboratory YouTube range validation rejects invalid and out-of-duration requests", () => {
  const runtime = createYoutubeRuntime();
  const project = createYoutubeProject();
  const build = (range: Record<string, unknown>, duration = 30) =>
    runtime.buildYtDlpArgs(project, readyToolState, "/tmp/lab-youtube-source", range, duration);

  assert.throws(
    () => build({ startSeconds: 20, endSeconds: 20 }),
    /endSeconds must be greater than startSeconds/
  );
  assert.throws(
    () => build({ startSeconds: -1, endSeconds: 20 }),
    /startSeconds must be zero or greater/
  );
  assert.throws(
    () => build({ startSeconds: 10, endSeconds: 30.1 }, 30),
    /exceeds the source duration/
  );
  assert.doesNotThrow(() => build({ startSeconds: 10, endSeconds: 10.2 }, 30));
  assert.throws(
    () =>
      runtime.buildYtDlpArgs(
        project,
        { ...readyToolState, ffmpeg: { installed: false } },
        "/tmp/lab-youtube-source",
        { startSeconds: 10, endSeconds: 20 },
        30
      ),
    /FFmpeg is required/
  );
});

void test("laboratory YouTube range source preserves requested bounds and original provenance", async () => {
  const project = createYoutubeProject();
  const toolCalls: Array<Record<string, unknown>> = [];
  const runtime = createYoutubeRuntime({ project, toolCalls });
  const runtimeState = {
    sourcePresets,
    toolState: {
      tools: {
        "yt-dlp": { installed: true },
        ffmpeg: { installed: true, binaryPath: "/opt/laboratory/ffmpeg/bin/ffmpeg" },
      },
    },
  };

  const result = await runtime.handleYoutubeDownload({}, runtimeState, "request-range", {
    range: { startSeconds: 1178.5, endSeconds: 1182.5 },
    youtubeMetadata: {
      durationSeconds: 3600,
      title: "Original evidence video",
      videoId: "abc123",
    },
  });

  const args = toolCalls[0]?.["args"] as string[];
  const rangeIndex = args.indexOf("--download-sections");
  const downloadedSource = project.source as Record<string, unknown>;
  assert.equal(args[rangeIndex + 1], "*1178.5-1182.5");
  assert.equal(downloadedSource["sourceRangeStartSeconds"], 1178.5);
  assert.deepEqual(downloadedSource["sourceOrigin"], {
    kind: "youtube-range",
    url: "https://www.youtube.com/watch?v=abc123",
    videoId: "abc123",
    title: "Original evidence video",
    startSeconds: 1178.5,
    endSeconds: 1182.5,
    requestedDurationSeconds: 4,
    rangeDownload: true,
  });
  assert.deepEqual(downloadedSource["metadata"], {
    durationSeconds: 10.04,
    videoCodec: "h264",
    requestedStartSeconds: 1178.5,
    requestedEndSeconds: 1182.5,
    requestedDurationSeconds: 4,
    sourceRangeStartSeconds: 1178.5,
  });
  assert.equal(toRecord(result)["requestedStartSeconds"], 1178.5);
  assert.equal(toRecord(result)["requestedEndSeconds"], 1182.5);
});

void test("laboratory YouTube range provenance survives project normalization", () => {
  const presetSourceRuntime = createLaboratoryPresetSourceRuntime({
    asNonEmptyString,
    clone<T>(value: T): T {
      return JSON.parse(JSON.stringify(value)) as T;
    },
    toRecord,
  });
  const projectRecords = createLaboratoryProjectRecordsRuntime({
    asNonEmptyString,
    clone<T>(value: T): T {
      return JSON.parse(JSON.stringify(value)) as T;
    },
    buildProjectName: () => "Range project",
    buildProjectSlug: () => "range-project",
    createDefaultEditState: () => ({}),
    createDefaultProfileState: () => ({}),
    createEmptyAudioAnalysisState: () => ({}),
    createEmptyProcessState: () => ({}),
    createEmptyReportState: () => ({}),
    createEmptySourceDrafts: () => ({}),
    getDefaultMode: () => "local",
    getDefaultSourceType: () => "video",
    getDefaultYoutubePreset: () => "custom",
    getPreferredFeatureSourceKind: () => "video",
    getPresetDefaultCustomValues: () => ({}),
    normalizeAudioAnalysisState: (value) => value,
    normalizeEditState: (value) => value,
    normalizeProcessState: (value) => value,
    normalizeProfileState: (value) => value,
    normalizeReportState: (value) => value,
    normalizeSourceMetadata: presetSourceRuntime.normalizeSourceMetadata,
    projectSchemaVersion: 1,
    toRecord,
  });
  const project = createYoutubeProject();
  Object.assign(project.source, {
    metadata: {
      durationSeconds: 4.04,
      requestedStartSeconds: 1178.5,
      requestedEndSeconds: 1182.5,
      requestedDurationSeconds: 4,
      sourceRangeStartSeconds: 1178.5,
    },
    sourceOrigin: {
      kind: "youtube-range",
      url: "https://www.youtube.com/watch?v=abc123",
      videoId: "abc123",
      title: "Original evidence video",
      startSeconds: 1178.5,
      endSeconds: 1182.5,
      requestedDurationSeconds: 4,
      rangeDownload: true,
    },
    sourceRangeStartSeconds: 1178.5,
  });

  const normalized = projectRecords.normalizeProject(project, sourcePresets, {}, {}, [], {}, {});
  const normalizedSource = normalized.source as unknown as Record<string, unknown>;
  const normalizedMetadata = toRecord(normalizedSource["metadata"]);

  assert.equal(normalizedSource["sourceRangeStartSeconds"], 1178.5);
  assert.deepEqual(normalizedSource["sourceOrigin"], {
    kind: "youtube-range",
    url: "https://www.youtube.com/watch?v=abc123",
    videoId: "abc123",
    title: "Original evidence video",
    startSeconds: 1178.5,
    endSeconds: 1182.5,
    requestedDurationSeconds: 4,
    rangeDownload: true,
  });
  assert.equal(normalizedMetadata["requestedStartSeconds"], 1178.5);
  assert.equal(normalizedMetadata["requestedEndSeconds"], 1182.5);
  assert.equal(normalizedMetadata["requestedDurationSeconds"], 4);
  assert.equal(normalizedMetadata["sourceRangeStartSeconds"], 1178.5);
});

function createReadyYoutubeStore() {
  const store = createLabStore();
  const url = "https://www.youtube.com/watch?v=abc123";
  store.dispatch({
    type: "hydrate",
    payload: {
      toolState: {
        tools: {
          "yt-dlp": { installed: true },
          ffmpeg: { installed: true },
        },
      },
    },
  });
  store.dispatch({ type: "project-import-url-check-started", url });
  store.dispatch({
    type: "host-event-received",
    event: {
      id: "event-youtube-probe",
      kind: "request-result",
      severity: "success",
      message: "YouTube URL checked",
      detail: null,
      action: "project-import-check-url",
      stage: "completed",
      requestId: "request-youtube-probe",
      timestamp: Date.now(),
      source: "host",
      scope: "global",
      moduleId: null,
      rawLine: null,
      result: {
        url,
        isYoutube: true,
        kind: "video",
        preview: {
          title: "Evidence event",
          duration: 120,
          thumbnail: "https://img.youtube.com/vi/abc123/0.jpg",
          webpageUrl: url,
          videoId: "abc123",
          streamUrl: "https://rr1---sn.example.googlevideo.com/videoplayback?id=abc123",
        },
        formats: [
          {
            formatId: "18",
            label: "Muxed 360p",
            kind: "muxed",
            extension: "mp4",
          },
        ],
        selectedVideoFormatId: "18",
        selectedAudioFormatId: "18",
      },
    } as never,
  });
  return store;
}

void test("laboratory YouTube range UI keeps setters independent and cancel sends no request", () => {
  const store = createReadyYoutubeStore();
  const sentRequests: Array<{ action: string; payload?: Record<string, unknown> }> = [];
  const player = { currentTime: 0 };
  const controller = createLabSourceActionController({
    documentRef: {
      querySelector() {
        return player as unknown as Element;
      },
    } as Pick<Document, "querySelector">,
    dispatch: store.dispatch,
    pushLockedWorkspaceEvent() {},
    sendMediaAction(action, payload) {
      sentRequests.push(payload === undefined ? { action } : { action, payload });
      return `request-${String(sentRequests.length)}`;
    },
    store,
    updateWorkbench() {},
    windowRef: { confirm: () => true },
  });

  assert.equal(controller.handleSourceClickAction("youtube-range-open", ""), true);
  assert.equal(store.getState().ui.youtubeImport.rangeSelection.open, true);
  const sourcePanelHtml = renderLabSourcePanel(store.getState(), LAB_FALLBACK_I18N);
  assert.match(sourcePanelHtml, /data-lab-action="project-import-url-add"/);
  assert.match(sourcePanelHtml, /Tam Videoyu İndir/);
  assert.match(sourcePanelHtml, /data-lab-action="youtube-range-open"/);
  const overlayHtml = renderYoutubeRangeOverlay(store.getState(), LAB_FALLBACK_I18N);
  assert.match(overlayHtml, /data-lab-youtube-range-player="true"/);
  assert.match(overlayHtml, / controls/);
  assert.match(overlayHtml, /data-lab-action="youtube-range-set-start"/);
  assert.match(overlayHtml, /data-lab-action="youtube-range-set-end"/);

  player.currentTime = 10;
  controller.handleSourceClickAction("youtube-range-set-start", "");
  assert.equal(store.getState().ui.youtubeImport.rangeSelection.startSeconds, 10);
  assert.equal(store.getState().ui.youtubeImport.rangeSelection.endSeconds, null);

  player.currentTime = 20;
  controller.handleSourceClickAction("youtube-range-set-end", "");
  assert.equal(store.getState().ui.youtubeImport.rangeSelection.startSeconds, 10);
  assert.equal(store.getState().ui.youtubeImport.rangeSelection.endSeconds, 20);

  player.currentTime = 12;
  controller.handleSourceClickAction("youtube-range-set-start", "");
  assert.equal(store.getState().ui.youtubeImport.rangeSelection.startSeconds, 12);
  assert.equal(store.getState().ui.youtubeImport.rangeSelection.endSeconds, 20);

  controller.handleSourceClickAction("youtube-range-cancel", "");
  assert.equal(store.getState().ui.youtubeImport.rangeSelection.open, false);
  assert.equal(sentRequests.length, 0);
});

void test("laboratory YouTube range confirm sends the selected request and closes the overlay", () => {
  const store = createReadyYoutubeStore();
  const sentRequests: Array<{ action: string; payload?: Record<string, unknown> }> = [];
  const player = { currentTime: 0 };
  const controller = createLabSourceActionController({
    documentRef: {
      querySelector() {
        return player as unknown as Element;
      },
    } as Pick<Document, "querySelector">,
    dispatch: store.dispatch,
    pushLockedWorkspaceEvent() {},
    sendMediaAction(action, payload) {
      sentRequests.push(payload === undefined ? { action } : { action, payload });
      return "request-youtube-range";
    },
    store,
    updateWorkbench() {},
    windowRef: { confirm: () => true },
  });

  controller.handleSourceClickAction("youtube-range-open", "");
  player.currentTime = 10;
  controller.handleSourceClickAction("youtube-range-set-start", "");
  player.currentTime = 20;
  controller.handleSourceClickAction("youtube-range-set-end", "");
  controller.handleSourceClickAction("youtube-range-confirm", "");

  assert.equal(sentRequests.length, 1);
  assert.equal(sentRequests[0]?.action, "source-download-youtube");
  assert.deepEqual(sentRequests[0]?.payload?.["range"], {
    startSeconds: 10,
    endSeconds: 20,
  });
  assert.deepEqual(sentRequests[0]?.payload?.["youtubeMetadata"], {
    durationSeconds: 120,
    title: "Evidence event",
    videoId: "abc123",
    webpageUrl: "https://www.youtube.com/watch?v=abc123",
  });
  assert.equal(store.getState().ui.youtubeImport.rangeSelection.open, false);
});
