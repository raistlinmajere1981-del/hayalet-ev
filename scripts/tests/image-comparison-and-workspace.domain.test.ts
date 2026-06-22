import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

import {
  getActiveExecutionIntent,
  getActiveSuggestionPreview,
  getAnalysisActionBlockReason,
  getAnalysisPreparationGroups,
  getProcessingOverlayState,
  getWaveformTimelineModel,
} from "../../rooms/laboratory/runtime/lab-selectors.ts";
import { createLabStore } from "../../rooms/laboratory/runtime/lab-store.ts";
import { renderLabDrawer } from "../../rooms/laboratory/ui/lab-drawer.ts";
import { renderLabProcessStrip } from "../../rooms/laboratory/ui/lab-process-strip.ts";
import { renderLabSourcePanel } from "../../rooms/laboratory/ui/lab-source-panel.ts";
import { renderLabLeftRail, renderLabTopBar } from "../../rooms/laboratory/ui/lab-top-bar.ts";
import { createLabI18n } from "../../rooms/laboratory/ui/lab-i18n.ts";
import { renderLabLayout } from "../../rooms/laboratory/ui/lab-layout.ts";
import { renderPipeline } from "../../rooms/laboratory/ui/laboratory-layout.ts";
import { renderReportOverlay } from "../../rooms/laboratory/ui/report-overlay.ts";
import { renderToolManagementOverlay } from "../../rooms/laboratory/ui/tool-management-overlay.ts";
import { renderWorkspaceOperationControls } from "../../rooms/laboratory/ui/workspace-operation-controls.ts";
import {
  renderSourceIntake,
  renderWorkspaceSurface,
} from "../../rooms/laboratory/ui/workspace-surface.ts";

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

describe("image comparison and workspace", () => {
  void test("laboratory image comparison workspace keeps image pair on the inspection workbench", () => {
    const store = createSeededState(true);
    const state = store.getState();
    state.source = {
      ...state.source,
      status: "ready",
      kind: "image",
      mode: "local",
      previewUrl: "file:///tmp/primary-image.png",
      storedFileName: "primary-image.png",
      storedPath: "/tmp/primary-image.png",
      routeLabel: "Local Copy",
      metadata: {
        height: 480,
        width: 640,
      },
    };
    store.dispatch({
      type: "asset-added",
      asset: {
        id: "asset-reference-image",
        type: "image",
        name: "reference-image.png",
        localPath: "/tmp/reference-image.png",
        createdAt: 400,
        metadata: { kind: "image" },
      },
    });
    store.dispatch({
      type: "asset-added",
      asset: {
        id: "asset-comparison-snapshot",
        type: "image",
        name: "comparison-finding-snapshot.png",
        localPath: "/tmp/comparison-finding-snapshot.png",
        createdAt: 410,
        metadata: {
          artifactKind: "comparison-finding-snapshot",
          findingId: "finding-1",
        },
      },
    });
    store.dispatch({
      type: "asset-added",
      asset: {
        id: "asset-comparison-manifest",
        type: "artifact",
        name: "comparison-finding.json",
        localPath: "/tmp/comparison-finding.json",
        createdAt: 411,
        metadata: {
          artifactKind: "comparison-finding-manifest",
          captureContext: {
            comparisonRois: {
              activeSide: "reference",
              primary: { x: 0.1, y: 0.2, width: 0.3, height: 0.4 },
              reference: { x: 0.2, y: 0.1, width: 0.25, height: 0.35 },
            },
          },
          findingId: "finding-1",
          note: "Sol göz çevresinde belirgin fark",
          primaryAssetId: "asset-primary-image",
          referenceAssetId: "asset-reference-image",
          roiSummary:
            "Primary ROI x=10%, y=20%, w=30%, h=40%; Reference ROI x=20%, y=10%, w=25%, h=35%; active=reference",
          snapshotAssetId: "asset-comparison-snapshot",
        },
      },
    });
    store.dispatch({
      type: "workspace-comparison-reference-set",
      assetId: "asset-reference-image",
    });
    store.dispatch({
      type: "workspace-comparison-updated",
      patch: { comparisonViewMode: "side-by-side" },
    });
    store.dispatch({
      type: "selection-roi-updated",
      comparisonSide: "primary",
      roi: { x: 0.1, y: 0.2, width: 0.3, height: 0.4 },
    });
    store.dispatch({
      type: "selection-roi-updated",
      comparisonSide: "reference",
      roi: { x: 0.2, y: 0.1, width: 0.25, height: 0.35 },
    });
    store.dispatch({
      type: "workspace-interactive-updated",
      comparisonSide: "reference",
      patch: { brightness: 112 },
    });

    const surface = renderWorkspaceSurface(store.getState());

    assert.match(surface.main, /data-lab-workspace-comparison-stage="true"/);
    assert.match(surface.main, /data-lab-selection-roi-stage="true"/);
    assert.match(surface.main, /data-lab-selection-roi-controls-reserve="0"/);
    assert.match(surface.main, /data-lab-selection-roi-overlay="true"/);
    assert.match(surface.main, /id="lab-roi-overlay-primary"/);
    assert.match(surface.main, /id="lab-roi-overlay-reference"/);
    assert.match(surface.main, /data-lab-comparison-roi-side="primary"/);
    assert.match(surface.main, /data-lab-comparison-roi-side="reference"/);
    assert.match(surface.main, /data-side="primary" data-active="false"/);
    assert.match(surface.main, /data-side="reference" data-active="true"/);
    assert.match(surface.main, /data-lab-comparison-roi-side="reference"[\s\S]*data-active="true"/);
    assert.match(surface.main, /data-lab-preview-inspection-stage="true"/);
    assert.match(surface.main, /data-lab-preview-inspection-topology="comparison-paired"/);
    assert.match(
      surface.main,
      /data-lab-preserve-media="workspace-comparison-primary" src="file:\/\/\/tmp\/primary-image\.png"/
    );
    assert.match(
      surface.main,
      /data-lab-preserve-media="workspace-comparison-reference" src="file:\/\/\/tmp\/reference-image\.png"/
    );
    assert.doesNotMatch(
      surface.main,
      /data-lab-preserve-media="workspace-comparison-primary"[^>]*style=/
    );
    assert.match(
      surface.main,
      /data-lab-preserve-media="workspace-comparison-reference"[^>]*style="filter: brightness\(1\.12\);"/
    );
    assert.match(surface.main, /data-lab-value="image-comparison"/);
    assert.doesNotMatch(surface.main, /data-preview-mode=/);
    assert.match(
      surface.inspector ?? "",
      /data-readiness="ready"[\s\S]*data-operation-id="image-comparison"/
    );
    assert.match(surface.inspector ?? "", /data-lab-comparison-roi-status="primary"/);
    assert.match(surface.inspector ?? "", /data-lab-comparison-roi-status="reference"/);
    assert.match(
      surface.inspector ?? "",
      /data-lab-comparison-roi-status="reference"[\s\S]*data-active="true"[\s\S]*data-selected="true"/
    );
    assert.match(surface.inspector ?? "", /data-lab-comparison-finding-list="true"/);
    assert.match(surface.inspector ?? "", /data-lab-action="workspace-comparison-finding-focus"/);
    assert.match(surface.inspector ?? "", /data-lab-value="finding-1"/);
    assert.match(surface.inspector ?? "", /Sol göz çevresinde belirgin fark/);
    assert.match(surface.inspector ?? "", /Primary ROI x=10%, y=20%, w=30%, h=40%/);
  });

  void test("laboratory image comparison visual controls follow the active image settings", () => {
    const store = createSeededState(true);
    const state = store.getState();
    state.source = {
      ...state.source,
      status: "ready",
      kind: "image",
      mode: "local",
      previewUrl: "file:///tmp/primary-image.png",
      storedFileName: "primary-image.png",
      storedPath: "/tmp/primary-image.png",
      routeLabel: "Local Copy",
    };
    store.dispatch({
      type: "asset-added",
      asset: {
        id: "asset-reference-image",
        type: "image",
        name: "reference-image.png",
        localPath: "/tmp/reference-image.png",
        createdAt: 400,
        metadata: { kind: "image" },
      },
    });
    store.dispatch({
      type: "workspace-comparison-reference-set",
      assetId: "asset-reference-image",
    });
    store.dispatch({
      type: "workspace-interactive-updated",
      comparisonSide: "primary",
      patch: { brightness: 132 },
    });
    store.dispatch({
      type: "workspace-interactive-updated",
      comparisonSide: "reference",
      patch: { brightness: 84 },
    });

    store.dispatch({ type: "workspace-comparison-side-activated", side: "primary" });
    let surface = renderWorkspaceSurface(store.getState());

    assert.match(
      surface.inspector ?? "",
      /value="132"[\s\S]*data-lab-field="workspace\.interactive\.brightness"/
    );
    assert.match(
      surface.main,
      /data-lab-preserve-media="workspace-comparison-primary"[^>]*style="filter: brightness\(1\.32\);"/
    );

    store.dispatch({ type: "workspace-comparison-side-activated", side: "reference" });
    surface = renderWorkspaceSurface(store.getState());

    assert.match(
      surface.inspector ?? "",
      /value="84"[\s\S]*data-lab-field="workspace\.interactive\.brightness"/
    );
    assert.match(
      surface.main,
      /data-lab-preserve-media="workspace-comparison-reference"[^>]*style="filter: brightness\(0\.84\);"/
    );
  });

  void test("laboratory workspace asset preview resets timeline controls to the selected file", () => {
    const store = createSeededState(true);
    store.dispatch({
      type: "workspace-timeline-updated",
      startMs: 72_232,
      endMs: 129_335,
    });
    store.dispatch({
      type: "asset-added",
      asset: {
        id: "asset-audio-target",
        type: "audio",
        name: "voice-clean.wav",
        localPath: "/tmp/voice-clean.wav",
        createdAt: 300,
        metadata: {
          durationMs: 4200,
          kind: "audio",
        },
      },
    });

    store.dispatch({
      type: "workspace-asset-selected",
      assetId: "asset-audio-target",
    });

    const state = store.getState();
    const timeline = getWaveformTimelineModel(state);
    const surface = renderWorkspaceSurface(state);

    assert.equal(state.ui.workspace.timelineStartMs, null);
    assert.equal(state.ui.workspace.timelineEndMs, null);
    assert.equal(state.ui.workspace.activeSelection, null);
    assert.equal(timeline.sourceKind, "audio");
    assert.equal(timeline.durationMs, 4200);
    assert.equal(timeline.startMs, null);
    assert.equal(timeline.endMs, null);
    assert.equal(timeline.activeSelection?.startMs, 0);
    assert.equal(timeline.activeSelection.endMs, 4200);
    assert.match(surface.main, /data-duration="4200"/);
    assert.match(surface.main, /00:04\.200/);
    assert.doesNotMatch(surface.main, /01:12\.232/);
    assert.doesNotMatch(surface.main, /02:09\.335/);
  });

  void test("laboratory workspace operations block remote asset targets instead of falling back to source", () => {
    const store = createSeededState(true);
    store.dispatch({
      type: "asset-added",
      asset: {
        id: "asset-remote-clip",
        type: "clip",
        name: "remote_clip.mp4",
        url: "https://example.test/remote_clip.mp4",
        createdAt: 300,
        metadata: {
          kind: "video",
        },
      },
    });
    store.dispatch({
      type: "workspace-asset-selected",
      assetId: "asset-remote-clip",
    });

    const surface = renderWorkspaceSurface(store.getState());

    assert.match(surface.main, /data-lab-workspace-asset-kind="video"/);
    assert.match(
      surface.inspector ?? "",
      /data-readiness="blocked"[\s\S]*data-operation-id="clip-export"/
    );
    assert.match(surface.inspector ?? "", /Seçili dosya yerel işlem hedefi değil/);
    assert.doesNotMatch(surface.inspector ?? "", /data-lab-action="timeline-export-clip"/);
  });

  void test("laboratory running work keeps the active operation contract without a fullscreen overlay", () => {
    const store = createSeededState(true);
    store.dispatch({
      type: "user-action-added",
      actionEvent: {
        id: "user-action-enhanced-frame",
        type: "custom",
        label: "İyileştirilmiş frame hazırlanıyor",
        status: "running",
        startedAt: Date.now() - 2400,
        requestId: "request-enhanced-frame",
        projectId: "project-1",
        sourceAction: "export-enhanced-frame",
        progress: 42,
      },
    });
    store.dispatch({ type: "workspace-source-intake-toggled", force: false });

    const overlay = getProcessingOverlayState(store.getState());
    const surface = renderWorkspaceSurface(store.getState());
    const sourceIntake = renderSourceIntake(store.getState());

    assert.equal(overlay.active, true);
    assert.equal(overlay.cancelAction, "operation-cancel");
    assert.equal(overlay.cancelValue, "enhanced-frame");
    assert.equal(overlay.progress, 42);
    assert.doesNotMatch(surface.main, /data-lab-region="processing-overlay"/);
    assert.doesNotMatch(surface.main, /class="labx-processing-overlay"/);
    assert.doesNotMatch(surface.main, /İyileştirilmiş frame hazırlanıyor/);
    assert.doesNotMatch(surface.main, /data-indeterminate="false" style="width: 42%"/);
    assert.doesNotMatch(
      surface.main,
      /data-lab-action="operation-cancel"[\s\S]*data-lab-value="enhanced-frame"/
    );
    assert.match(sourceIntake, /data-lab-action="load-source"[^>]*disabled/);
    assert.match(surface.main, /data-lab-action="timeline-toggle-playback"[^>]*disabled/);
    assert.match(surface.main, /data-lab-field="workspace\.previewVolume"[^>]*disabled/);
    assert.match(surface.main, /class="labx-icon-rail"[^>]*data-locked="true"/);
  });

  void test("laboratory active analysis locks source and workspace controls while showing process details", () => {
    const store = createSeededState(true);
    store.dispatch({
      type: "run-started",
      action: "process-run",
    });

    const state = store.getState();
    const surface = renderWorkspaceSurface(state);
    const sourcePanel = renderLabSourcePanel(state);
    const strip = renderLabProcessStrip(state);
    const layout = renderLabLayout(state, surface);

    assert.match(sourcePanel, /class="labx-source-panel"[^>]*data-analysis-locked="true"/);
    assert.match(sourcePanel, /data-lab-field="project\.id"[^>]*disabled/);
    assert.match(sourcePanel, /data-lab-action="project-create"[^>]*disabled/);
    assert.match(sourcePanel, /data-lab-action="project-import-local-add"[^>]*disabled/);
    assert.match(sourcePanel, /data-lab-field="project-import\.urlInput"[^>]*disabled/);
    assert.match(surface.main, /class="labx-workspace-main"[^>]*data-analysis-locked="true"/);
    assert.match(
      surface.main,
      /class="labx-media-workbench"[^>]*data-analysis-locked="true"[^>]*inert/
    );
    assert.match(strip, /data-process-view="expanded"/);
    assert.match(strip, /data-process-view-forced="true"/);
    assert.match(strip, /data-lab-process-expanded="true"/);
    assert.match(strip, /data-lab-action="workspace-process-view-toggled"[^>]*disabled/);
    assert.match(layout, /data-process-view="expanded"/);
  });
});
