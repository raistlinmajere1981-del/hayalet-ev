import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

import { createLabStore } from "../../rooms/laboratory/runtime/lab-store.ts";
import { renderLabDrawer } from "../../rooms/laboratory/ui/lab-drawer.ts";
import { createLabI18n } from "../../rooms/laboratory/ui/lab-i18n.ts";
import { renderPipeline } from "../../rooms/laboratory/ui/laboratory-layout.ts";
import { renderWorkspaceSurface } from "../../rooms/laboratory/ui/workspace-surface.ts";

const sourcePresets = JSON.parse(
  readFileSync("rooms/laboratory/tools/source-presets.json", "utf8")
) as Record<string, unknown>;
const ytDlpForm = JSON.parse(
  readFileSync("rooms/laboratory/tools/yt-dlp.form.json", "utf8")
) as Record<string, unknown>;

function getPipelineBlockIds(markup: string): string[] {
  return Array.from(markup.matchAll(/data-block-id="([^"]+)"/g), function (match) {
    return match[1] as string;
  });
}

function captureDebugLogs(run: () => void) {
  const descriptor = Object.getOwnPropertyDescriptor(console, "info");
  const logs: unknown[][] = [];
  Object.defineProperty(console, "info", {
    configurable: true,
    value(...args: unknown[]) {
      logs.push(args);
    },
  });
  try {
    run();
  } finally {
    if (descriptor) {
      Object.defineProperty(console, "info", descriptor);
    } else {
      Reflect.deleteProperty(console, "info");
    }
  }
  return logs;
}

function withDocumentStub<T>(documentStub: unknown, run: () => T): T {
  const descriptor = Object.getOwnPropertyDescriptor(globalThis, "document");
  Object.defineProperty(globalThis, "document", {
    configurable: true,
    value: documentStub,
  });
  try {
    return run();
  } finally {
    if (descriptor) {
      Object.defineProperty(globalThis, "document", descriptor);
    } else {
      Reflect.deleteProperty(globalThis, "document");
    }
  }
}

function withoutDocument<T>(run: () => T): T {
  const descriptor = Object.getOwnPropertyDescriptor(globalThis, "document");
  Reflect.deleteProperty(globalThis, "document");
  try {
    return run();
  } finally {
    if (descriptor) {
      Object.defineProperty(globalThis, "document", descriptor);
    }
  }
}

function createTurkishCopy() {
  return createLabI18n({
    locale: "tr",
    translations: JSON.parse(readFileSync("rooms/laboratory/i18n/tr.json", "utf8")),
  });
}

function createEmptyReadyState() {
  const store = createLabStore();
  store.dispatch({
    type: "snapshot-received",
    payload: {
      featureId: "media-analysis",
      ready: true,
      activeProjectId: null,
      projects: [],
      activeProject: null,
      workbench: {
        activeModuleId: "media-analysis",
        availableModuleIds: ["media-analysis", "audio-analysis"],
        selectedModuleIds: ["media-analysis", "audio-analysis"],
      },
      sourcePresets,
      ytDlpForm,
      toolRegistry: [],
      toolState: {
        tools: {},
      },
      sourceProbeStatus: "idle",
      profileModels: [],
      reports: {
        user: null,
        ai: null,
        emptyReason: "Rapor henüz üretilmedi.",
      },
      activityFeed: [],
    },
  });
  return store;
}

function createDraftBootstrapState() {
  const store = createLabStore();
  store.dispatch({
    type: "snapshot-received",
    payload: {
      featureId: "media-analysis",
      ready: false,
      bootstrap: {
        status: "running",
        currentStepId: "refresh-tools",
      },
      activeProjectId: "draft-1",
      projects: [{ id: "draft-1", name: "Lab Session Draft", hasSource: false }],
      activeProject: {
        id: "draft-1",
        name: "Lab Session Draft",
        source: {
          status: "idle",
          kind: "video",
          mode: "local",
        },
        edit: {},
        profile: {},
        process: { records: {} },
        report: { records: {} },
        assets: [],
      },
      workbench: {
        activeModuleId: "media-analysis",
        availableModuleIds: ["media-analysis", "audio-analysis"],
        selectedModuleIds: ["media-analysis", "audio-analysis"],
      },
      sourcePresets,
      ytDlpForm,
      toolRegistry: [],
      toolState: {
        tools: {},
      },
      sourceProbeStatus: "idle",
      profileModels: [],
    },
  });
  return store;
}

function createSeededState(ffmpegInstalled = false) {
  const store = createLabStore();
  store.dispatch({
    type: "snapshot-received",
    payload: {
      featureId: "media-analysis",
      ready: true,
      activeProjectId: "project-1",
      projects: [
        { id: "project-1", name: "2026-04-21 12-00 - lab-demo.mp4", hasSource: true },
        { id: "draft-1", name: "Draft", hasSource: false },
      ],
      activeProject: {
        id: "project-1",
        name: "2026-04-21 12-00 - lab-demo.mp4",
        createdAt: "2026-04-21T12:00:00.000Z",
        source: {
          status: "ready",
          kind: "video",
          mode: "local",
          previewUrl: "file:///tmp/lab-demo.mp4",
          storedFileName: "lab-demo.mp4",
          storedPath: "/tmp/lab-demo.mp4",
          routeLabel: "Local Copy",
          drafts: {
            urlInput: "",
            youtubeUrl: "",
            youtubePreset: "medium",
            youtubeCustom: {},
          },
          metadata: {
            audioCodec: "aac",
            width: 640,
            height: 360,
            durationSeconds: 801,
            sizeBytes: 86100000,
          },
        },
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
        selectedModuleIds: ["media-analysis", "audio-analysis"],
      },
      sourcePresets,
      ytDlpForm,
      toolRegistry: [
        {
          toolId: "ffmpeg",
          displayName: "FFmpeg",
          availability: "system-command",
          stageSupport: {
            source: "optional",
            process: "required",
          },
          usedBy: ["media-analysis", "audio-analysis"],
        },
        {
          toolId: "yt-dlp",
          displayName: "yt-dlp",
          availability: "installable",
          readinessImpact: "YouTube capture stays enabled from the source intake frame.",
          stageSupport: {
            source: "required",
          },
          usedBy: ["source-intake"],
        },
        {
          toolId: "librosa",
          displayName: "librosa",
          availability: "system-command",
          installerType: "python-venv-pip",
          installPackages: ["librosa", "numpy", "scipy"],
          estimatedDownloadSize: "80 - 250 MB",
          estimatedInstalledSize: "250 - 700 MB",
          venvDir: "${roomStorageDir}/runtime/librosa-venv",
          readinessImpact: "Music helpers stay blocked until the Python runtime is installed.",
          stageSupport: {
            process: "optional",
          },
          usedBy: ["audio-analysis"],
        },
        {
          toolId: "transcript-runtime",
          displayName: "Speech Runtime",
          availability: "installable",
          readinessImpact: "Optional transcription helpers stay available for room-local runs.",
          stageSupport: {
            process: "optional",
          },
          usedBy: ["audio-analysis"],
        },
      ],
      toolState: {
        tools: {
          ffmpeg: {
            installed: ffmpegInstalled,
          },
          "yt-dlp": {
            installed: true,
            version: "2026.04.20",
            latestVersion: "2026.04.20",
            lastCheckedAt: "2026-05-24T20:23:29.941Z",
            updateAvailable: false,
          },
          librosa: {
            installed: false,
          },
          "transcript-runtime": {
            installed: false,
          },
        },
      },
      sourceProbeStatus: "completed",
      profileModels: [],
      reports: {
        user: null,
        ai: null,
        emptyReason: "Rapor henüz üretilmedi.",
      },
      activityFeed: [],
    },
  });
  return store;
}

describe("v2 shell and source intake", () => {
  void test("laboratory pipeline trace is debug gated and follows rendered block order", () => {
    const blocks = [
      {
        id: "analysis-prep",
        render() {
          return "<span>Analysis prep</span>";
        },
        type: "section" as const,
      },
      {
        id: "hidden",
        render() {
          return "<span>Hidden</span>";
        },
        type: "action" as const,
        visible() {
          return false;
        },
      },
      {
        id: "empty",
        render() {
          return "";
        },
        type: "status" as const,
      },
      {
        id: "preflight",
        render() {
          return "<span>Preflight</span>";
        },
        type: "status" as const,
      },
    ];

    const noDocumentLogs = withoutDocument(function () {
      return captureDebugLogs(function () {
        renderPipeline(blocks, "setup");
      });
    });
    assert.equal(noDocumentLogs.length, 0);

    const noShellLogs = withDocumentStub(
      {
        querySelector() {
          return null;
        },
      },
      function () {
        return captureDebugLogs(function () {
          renderPipeline(blocks, "setup");
        });
      }
    );
    assert.equal(noShellLogs.length, 0);

    let debugShellPresent = true;
    const debugLogs = withDocumentStub(
      {
        querySelector(selector: string) {
          return selector === '.labx-shell[data-lab-debug-regions="true"]' && debugShellPresent
            ? {}
            : null;
        },
      },
      function () {
        const logs = captureDebugLogs(function () {
          renderPipeline(blocks, "setup");
        });
        debugShellPresent = false;
        const removedLogs = captureDebugLogs(function () {
          renderPipeline(blocks, "setup");
        });
        assert.equal(removedLogs.length, 0);
        return logs;
      }
    );

    assert.deepEqual(
      debugLogs.map(function (entry) {
        return entry[0];
      }),
      ["[lab][pipeline] setup -> analysis-prep (#0)", "[lab][pipeline] setup -> preflight (#1)"]
    );
    assert.deepEqual(debugLogs[0]?.[1], {
      blockId: "analysis-prep",
      index: 0,
      mode: "setup",
      type: "section",
    });
    assert.deepEqual(debugLogs[1]?.[1], {
      blockId: "preflight",
      index: 1,
      mode: "setup",
      type: "status",
    });
  });

  void test("laboratory v2 shell renders source intake in the setup drawer and preview media in center", () => {
    const store = createSeededState();
    store.dispatch({
      type: "asset-added",
      asset: {
        id: "clip-setup-drawer",
        type: "clip",
        name: "setup_clip.mp4",
        localPath: "/tmp/setup_clip.mp4",
        createdAt: 200,
        sourceId: "source-1",
        runId: "run-1",
      },
    });
    store.dispatch({
      type: "workspace-bookmark-added",
      bookmark: {
        id: "bookmark-note-1",
        timeMs: 18565,
        frameIndex: null,
        note: "Red flash",
        createdAt: 1,
      },
    });
    const state = store.getState();
    const surface = renderWorkspaceSurface(state);
    const drawer = renderLabDrawer(state, surface);

    assert.match(surface.main, /lab-demo\.mp4/);
    assert.match(
      surface.main,
      /class="labx-media-workbench"[^>]*data-lab-region="main-stage-inner"/
    );
    assert.match(
      surface.main,
      /class="labx-workspace-preview labx-preview-area [^"]*"[^>]*data-lab-region="preview-area"/
    );
    assert.match(
      surface.main,
      /<div class="labx-media-workbench"[^>]*data-lab-region="main-stage-inner"[^>]*>[\s\S]*?<div class="labx-workspace-preview labx-preview-area [^"]*"[^>]*data-lab-region="preview-area"[^>]*>[\s\S]*?<\/div>\s*<div class="labx-timeline labx-timeline-area[^"]*" id="lab-timeline" data-lab-region="timeline-area"/
    );
    assert.match(
      surface.main,
      /<video class="labx-preview-media labx-preview-media--workspace-video"/
    );
    assert.doesNotMatch(
      surface.main,
      /labx-preview-media--workspace-video"[^>]*\scontrols(?:\s|>|=)/
    );
    assert.match(surface.main, /data-lab-selection-roi-controls-reserve="0"/);
    assert.match(surface.main, /data-lab-action="timeline-toggle-playback"/);
    assert.match(surface.main, /data-lab-role="timeline-volume"/);
    assert.match(surface.main, /data-lab-role="timeline-bookmark-note"/);
    assert.match(surface.main, /data-lab-action="timeline-add-bookmark"/);
    assert.match(surface.main, /data-lab-action="timeline-remove-bookmark"/);
    assert.match(surface.main, /labx-timeline__pin-popover/);
    assert.match(surface.main, /Red flash/);
    assert.match(surface.main, /data-lab-field="workspace\.previewVolume"/);
    assert.match(surface.main, /class="labx-workspace-stage"/);
    assert.doesNotMatch(surface.main, /data-lab-region="inspector-panel"/);
    assert.match(surface.inspector ?? "", /data-lab-region="inspector-panel"/);
    assert.match(surface.inspector ?? "", /data-lab-workspace-inspector="true"/);
    assert.match(surface.inspector ?? "", /data-open="true"/);
    assert.match(surface.inspector ?? "", /data-lab-action="workspace-controls-drawer-toggle"/);
    assert.match(surface.inspector ?? "", /data-lab-action="workspace-controls-tab-select"/);
    assert.match(
      surface.inspector ?? "",
      /data-inspector-panel="audio"[\s\S]*id="lab-audio-focus"/
    );
    assert.match(surface.inspector ?? "", /data-inspector-panel="visual"[\s\S]*labx-controls-card/);
    assert.doesNotMatch(surface.inspector ?? "", /labx-audio-focus__header/);
    assert.doesNotMatch(
      surface.inspector ?? "",
      /<h2 class="labx-card__title">(?:Görsel Ayarlar|Visual Adjustments)<\/h2>/
    );
    assert.doesNotMatch(surface.main, /class="labx-workspace-focus-row"/);
    assert.doesNotMatch(surface.main, /labx-timeline__range-info/);
    assert.doesNotMatch(surface.main, /labx-bookmarks/);
    assert.doesNotMatch(
      surface.main,
      /labx-timeline__header|Embedded audio|Preview and waveform share/
    );
    assert.doesNotMatch(surface.main, /Source setup controls/);
    assert.match(surface.side, /data-lab-selection-panel="true"/);
    assert.match(surface.side, /Önerilen Analizler/);
    assert.doesNotMatch(surface.side, /Önerilen İşlemler/);
    assert.doesNotMatch(
      surface.side,
      /data-lab-execution-plan|data-lab-execution-simulation|data-lab-execution-payload-preview|data-lab-execution-details/
    );
    assert.match(drawer, /class="labx-drawer labx-context-panel" data-lab-region="context-panel"/);
    assert.match(drawer, /data-drawer-mode="setup"/);
    assert.deepEqual(getPipelineBlockIds(drawer), ["analysis-prep", "analysis-cta"]);
    assert.match(drawer, /data-block-mode="setup"/);
    assert.match(drawer, /Analysis Modules/);
    assert.match(drawer, /data-lab-action="run-deep-analysis"/);
    assert.doesNotMatch(
      drawer,
      /Source setup controls|Project Assets|data-lab-action="save-project"/
    );
    assert.doesNotMatch(surface.main, /Kaynak Seçimi|Hızlı modül seçimi burada yapılır/);
  });

  void test("laboratory drawer keeps project assets visible in result and explore modes", () => {
    const store = createSeededState();
    store.dispatch({
      type: "asset-added",
      asset: {
        id: "report-drawer-result",
        type: "report",
        name: "analysis-report.md",
        localPath: "/tmp/analysis-report.md",
        createdAt: 300,
        sourceId: "source-1",
        runId: "run-with-report",
      },
    });

    const state = store.getState() as ReturnType<typeof store.getState> & {
      run: Record<string, unknown>;
    };
    state.run = {
      id: "run-with-report",
      state: "completed",
      startedAt: Date.now() - 2000,
      endedAt: Date.now() - 1000,
      modules: {},
      moduleOrder: [],
      events: [],
      rawLog: [],
      artifacts: [],
      findings: [],
      liveFindings: [],
      warnings: [],
      error: null,
      targetLabel: null,
      progress: 100,
      emptyReason: null,
      analysisScope: null,
      previewArtifacts: [],
      confidence: null,
      moduleTrace: [],
      comparisonVariants: [],
      hypothesisSummary: null,
    };
    state.reports.user = {
      summary: "Report ready",
      confidence: "high",
      topFindings: [],
      suspiciousFrames: [],
      hypothesisResult: null,
      elapsedSeconds: 1,
      moduleSummary: [],
    };

    let surface = renderWorkspaceSurface(store.getState());
    let drawer = renderLabDrawer(store.getState(), surface);
    assert.match(drawer, /data-drawer-mode="result"/);
    assert.deepEqual(getPipelineBlockIds(drawer), [
      "context-summary",
      "report-action",
      "explore-toggle",
    ]);
    assert.match(drawer, /data-lab-action="open-report-overlay"/);
    assert.match(drawer, /data-lab-action="drawer-explore-toggled"/);
    assert.doesNotMatch(
      drawer,
      /analysis-report\.md|data-lab-action="asset-download"|data-lab-action="save-project"/
    );

    store.dispatch({ type: "drawer-explore-toggled" });
    surface = renderWorkspaceSurface(store.getState());
    drawer = renderLabDrawer(store.getState(), surface);
    assert.match(drawer, /data-drawer-mode="explore"/);
    assert.deepEqual(getPipelineBlockIds(drawer), [
      "workspace-comparison",
      "reanalyze-action",
      "result-toggle",
    ]);
    assert.match(drawer, /data-lab-action="run-deep-analysis"/);
    assert.doesNotMatch(drawer, /analysis-report\.md|data-lab-action="asset-preview"/);
  });

  void test("laboratory workspace treats reused local assets as ready sources", () => {
    const store = createSeededState();
    store.dispatch({
      type: "source-config-patched",
      patch: {
        routeLabel: "Asset reuse",
      },
    });
    store.dispatch({
      type: "workspace-bookmark-added",
      bookmark: {
        id: "bookmark-note-2",
        timeMs: 2200,
        frameIndex: null,
        note: "Audio pop",
        createdAt: 2,
      },
    });

    const state = store.getState();
    const surface = renderWorkspaceSurface(state);
    const drawer = renderLabDrawer(state, surface);

    assert.match(drawer, /data-drawer-mode="setup"/);
    assert.match(drawer, /Analysis Modules/);
    assert.match(
      surface.main,
      /<video class="labx-preview-media labx-preview-media--workspace-video"/
    );
    assert.doesNotMatch(
      surface.main,
      /labx-preview-media--workspace-video"[^>]*\scontrols(?:\s|>|=)/
    );
    assert.match(surface.main, /data-lab-selection-roi-controls-reserve="0"/);
    assert.match(surface.main, /data-lab-action="timeline-toggle-playback"/);
    assert.match(surface.main, /data-lab-role="timeline-volume"/);
    assert.match(surface.main, /data-lab-role="timeline-bookmark-note"/);
    assert.match(surface.main, /data-lab-action="timeline-add-bookmark"/);
    assert.match(surface.main, /data-lab-action="timeline-remove-bookmark"/);
    assert.match(surface.main, /labx-timeline__pin-popover/);
    assert.match(surface.main, /Audio pop/);
    assert.match(surface.main, /data-lab-field="workspace\.previewVolume"/);
    assert.doesNotMatch(surface.main, /labx-timeline__range-info/);
    assert.doesNotMatch(surface.main, /labx-bookmarks/);
    assert.doesNotMatch(
      surface.main,
      /labx-timeline__header|Embedded audio|Preview and waveform share/
    );
    assert.doesNotMatch(surface.main, /Awaiting source|Select a source to begin/);
  });
});
