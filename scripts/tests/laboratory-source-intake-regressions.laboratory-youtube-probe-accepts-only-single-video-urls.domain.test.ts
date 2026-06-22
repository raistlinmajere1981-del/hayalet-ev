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


describe("laboratory YouTube probe accepts only single video URLs", () => {
void test("laboratory YouTube probe accepts only single video URLs", async () => {
  const toolCalls: Array<Record<string, unknown>> = [];
  const runtime = createMediaYoutubeSourceIntakeRuntime({
    asNonEmptyString,
    async callRoomTools(payload) {
      toolCalls.push(payload);
      return {
        run: {
          stdout: JSON.stringify({
            title: "Evidence clip",
            duration: 154,
            thumbnail: "https://img.youtube.com/vi/abc123/0.jpg",
            webpage_url: "https://www.youtube.com/watch?v=abc123",
            formats: [
              {
                format_id: "18",
                ext: "mp4",
                vcodec: "avc1",
                acodec: "mp4a",
              },
            ],
          }),
        },
      };
    },
    cancelJobsForProject: async function () {
      return null;
    },
    clearJob: function () {
      return undefined;
    },
    getActiveProject: function () {
      return {
        id: "project-youtube-probe",
        source: {
          drafts: {},
        },
      };
    },
    getPresetDefaultCustomValues: function () {
      return {};
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
  const runtimeState = {
    toolState: {
      tools: {
        "yt-dlp": { installed: true },
      },
    },
  };
  const rejectedUrls = [
    "https://www.youtube.com/playlist?list=PL123",
    "https://www.youtube.com/@example-channel",
    "https://www.youtube.com/watch?v=abc123&list=PL123",
  ];

  async function rejectForUrl(url: string): Promise<void> {
    await assert.rejects(
      async () => await runtime.handleYoutubeProbe({}, runtimeState, "req-youtube-probe", url),
      /Only a single YouTube video URL is supported\./
    );
  }
  await Promise.all(rejectedUrls.map(rejectForUrl));

  assert.equal(toolCalls.length, 0);

  const result = await runtime.handleYoutubeProbe(
    {},
    runtimeState,
    "req-youtube-probe",
    "https://youtu.be/abc123?t=4"
  );

  assert.equal(toRecord(result)["kind"], "video");
  assert.deepEqual(toolCalls[0]?.["args"], [
    "--dump-single-json",
    "--skip-download",
    "--no-playlist",
    "https://youtu.be/abc123?t=4",
  ]);
});

function createWorkspaceState(overrides: {
  activityFeed?: Array<Record<string, unknown>>;
  sourceProbeStatus?: "idle" | "running" | "completed" | "failed";
  toolState?: Record<string, unknown>;
  projectImportKind?: "video" | "audio" | "image";
  projectImportMethod?: "local" | "url" | "youtube";
  urlCheckResult?: Record<string, unknown>;
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
      toolState: overrides.toolState ?? { tools: {} },
      profileModels: [],
      sourceProbeStatus: overrides.sourceProbeStatus ?? "idle",
      activityFeed: overrides.activityFeed ?? [],
    },
  });
  (overrides.activityFeed ?? []).forEach(function (event) {
    store.dispatch({
      type: "host-event-received",
      event: event as never,
    });
  });
  const sourceKind = overrides.projectImportKind ?? String((overrides.source["kind"] as string | undefined) ?? "video");
  if (sourceKind === "video" || sourceKind === "audio" || sourceKind === "image") {
    store.dispatch({ type: "project-import-kind-changed", kind: sourceKind });
  }
  const sourceMethod = overrides.projectImportMethod ?? String((overrides.source["mode"] as string | undefined) ?? "local");
  if (sourceMethod === "local" || sourceMethod === "url" || sourceMethod === "youtube") {
    store.dispatch({
      type: "project-import-method-changed",
      method: sourceMethod,
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
  return store.getState();
}

function renderProjectWorkspaceHtml(overrides: Parameters<typeof createWorkspaceState>[0]) {
  return renderLabSourcePanel(createWorkspaceState(overrides));
}

type ProjectImportSourceAction =
  | "source-pick-local"
  | "source-download-url"
  | "source-download-youtube";

function createTrackedProjectImportStore(
  requestId = "req-project-import",
  action: ProjectImportSourceAction = "source-download-url"
) {
  const store = createLabStore();
  store.dispatch({
    type: "snapshot-received",
    payload: {
      ready: true,
      featureId: "media-analysis",
      activeProjectId: "project-1",
      projects: [{ id: "project-1", name: "Import Project", hasSource: true }],
      activeProject: {
        id: "project-1",
        name: "Import Project",
        source: {
          kind: "video",
          mode: "url",
          status: "ready",
          storedFileName: "source.mp4",
          storedPath: "/tmp/source.mp4",
          routeLabel: "Direct URL",
          metadata: { durationSeconds: 4 },
          drafts: {},
        },
        edit: {},
        profile: { preflight: {} },
        process: { records: {} },
        report: { records: {} },
      },
      workbench: {
        activeModuleId: "media-analysis",
        availableModuleIds: ["media-analysis"],
        selectedModuleIds: ["media-analysis"],
      },
      sourcePresets,
      ytDlpForm,
      toolState: { tools: {} },
      profileModels: [],
      sourceProbeStatus: "idle",
      activityFeed: [],
    },
  });
  store.dispatch({ type: "drawer-mode-requested", mode: "result" });
  store.dispatch({ type: "report-overlay-toggled", open: true });
  store.dispatch({
    type: "project-import-review-focused",
    focus: "running",
    action,
    requestId,
  });
void test("laboratory URL intake downloads image sources into the frame asset category", async () => {
  let activeProject: Record<string, unknown> = {
    id: "project-url-image",
    source: {
      kind: "image",
      drafts: {
        kind: "image",
        urlInput: "https://example.test/evidence.png",
      },
    },
    workbench: {},
    assets: [],
  };
  const toolCalls: Array<Record<string, unknown>> = [];

  const runtime = createMediaUrlSourceIntakeRuntime({
    asNonEmptyString,
    async callRoomTools(payload) {
      toolCalls.push(payload);
      return {
        download: {
          contentType: "image/png",
          fileName: "evidence.png",
          path: "/tmp/lab-project/sources/evidence.png",
        },
      };
    },
    cancelJobsForProject: async function () {
      return null;
    },
    clearJob: function () {
      return undefined;
    },
    deriveFilename() {
      return "evidence.png";
    },
    getActiveProject() {
      return activeProject;
    },
    getProjectSourceDir() {
      return "/tmp/lab-project/sources";
    },
    normalizeMimeType() {
      return "image/png";
    },
    patchActiveProject: async function (_runtime, updater) {
      activeProject = updater(activeProject);
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
    resolvePreparedSource: async function (_runtime, _project, options) {
      return {
        metadata: {
          height: 720,
          width: 1280,
        },
        metadataError: null,
        mimeType: options["mimeType"] as string,
        storedFileName: options["storedFileName"] as string,
        storedPath: options["storedPath"] as string,
      };
    },
    roomId: "laboratory",
    toRecord,
  });

  await runtime.handleUrlDownload({}, {}, "req-url-image");

  assert.equal(toolCalls[0]?.["operation"], "download-file");
  const assets = Array.isArray(activeProject["assets"])
    ? (activeProject["assets"] as Array<Record<string, unknown>>)
    : [];
  const imageAsset = assets.find(function (asset) {
    return asset["type"] === "image";
  });
  assert.equal(imageAsset?.["localPath"], "/tmp/lab-project/sources/evidence.png");
  assert.equal(imageAsset?.["url"], "https://example.test/evidence.png");
  assert.equal(toRecord(imageAsset?.["metadata"])["flowKind"], "remote-url-import");
});
  void test(`laboratory project import completion closes project management for ${action}`, () => {
    const store = createTrackedProjectImportStore("req-project-import", action);

    store.dispatch({
      type: "host-event-received",
      event: {
        id: `evt-import-complete-${action}`,
        kind: "request-result",
        severity: "success",
        message: "Project source imported",
        detail: null,
        action,
        stage: "completed",
        requestId: "req-project-import",
        timestamp: Date.now(),
        source: "host",
        scope: "global",
        moduleId: null,
        rawLine: null,
      },
    });

    const state = store.getState();
    assert.equal(state.sourceProbeStatus, "completed");
    assert.equal(state.ui.projectImport.reviewFocus, "completed");
    assert.equal(state.ui.workspace.sourceIntakeCollapsed, true);
    assert.equal(state.ui.workspace.reportOverlayOpen, false);
    assert.equal(state.ui.workspace.drawerModeOverride, "setup");
    assert.equal(resolveDrawerMode(state), "setup");
  });
void test("laboratory project import completion ignores unrelated source requests", () => {
  const store = createTrackedProjectImportStore();

  store.dispatch({
    type: "host-event-received",
    event: {
      id: "evt-import-other-complete",
      kind: "request-result",
      severity: "success",
      message: "URL source downloaded",
      detail: null,
      action: "source-download-url",
      stage: "completed",
      requestId: "req-other",
      timestamp: Date.now(),
      source: "host",
      scope: "global",
      moduleId: null,
      rawLine: null,
    },
  });

  const state = store.getState();
  assert.equal(state.sourceProbeStatus, "completed");
  assert.equal(state.ui.projectImport.reviewFocus, "running");
  assert.equal(state.ui.workspace.reportOverlayOpen, true);
});
});
