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

describe("source panel", () => {
  void test("laboratory source panel opens png artifacts from the primary click", () => {
    const store = createSeededState(true);
    store.dispatch({
      type: "asset-added",
      asset: {
        id: "artifact-png-1",
        type: "artifact",
        name: "reveal-frame.png",
        localPath: "/tmp/reveal-frame.png",
        createdAt: 500,
        runId: "run-1",
      },
    });

    const panelHtml = renderLabSourcePanel(store.getState());

    assert.match(
      panelHtml,
      /class="labx-sp-asset__btn"[^>]*data-lab-action="workspace-asset-select" data-lab-value="artifact-png-1"/
    );
    assert.doesNotMatch(panelHtml, /data-lab-action="source-activate-asset"/);
  });

  void test("laboratory source panel keeps asset order stable when active source timestamps change", () => {
    const store = createSeededState(true);
    store.dispatch({
      type: "asset-added",
      asset: {
        id: "source-stable-first",
        type: "source",
        name: "stable-first.mp4",
        localPath: "/tmp/stable-first.mp4",
        createdAt: 100,
      },
    });
    store.dispatch({
      type: "asset-added",
      asset: {
        id: "source-active-newer",
        type: "source",
        name: "active-newer.mp4",
        localPath: "/tmp/active-newer.mp4",
        createdAt: 999_000,
      },
    });

    const panelHtml = renderLabSourcePanel(store.getState());

    assert.ok(panelHtml.indexOf("stable-first.mp4") < panelHtml.indexOf("active-newer.mp4"));
  });

  void test("laboratory source panel opens the selected workspace asset group", () => {
    const store = createSeededState(true);
    store.dispatch({
      type: "asset-added",
      asset: {
        id: "asset-selected-audio",
        type: "audio",
        name: "selected-audio.wav",
        localPath: "/tmp/selected-audio.wav",
        createdAt: 300,
      },
    });
    store.dispatch({
      type: "workspace-asset-selected",
      assetId: "asset-selected-audio",
    });

    const panelHtml = renderLabSourcePanel(store.getState());

    assert.match(panelHtml, /<details class="labx-sp-group" open data-group-type="audio">/);
    assert.doesNotMatch(panelHtml, /<details class="labx-sp-group" open data-group-type="source">/);
  });

  void test("laboratory source panel marks only the workbench media as active", () => {
    const store = createSeededState(true);
    const state = store.getState();
    state.source = {
      ...state.source,
      metadata: {
        ...(state.source?.["metadata"] ?? {}),
        originAssetId: "asset-active-source",
      },
    };
    store.dispatch({
      type: "asset-added",
      asset: {
        id: "asset-active-source",
        type: "source",
        name: "active-source.png",
        localPath: "/tmp/active-source.png",
        createdAt: 100,
        metadata: {
          kind: "image",
        },
      },
    });
    store.dispatch({
      type: "asset-added",
      asset: {
        id: "asset-enhanced-frame",
        type: "image",
        name: "enhanced-frame.png",
        localPath: "/tmp/enhanced-frame.png",
        createdAt: 300,
        metadata: {
          kind: "image",
        },
      },
    });
    store.dispatch({
      type: "workspace-asset-selected",
      assetId: "asset-enhanced-frame",
    });

    const panelHtml = renderLabSourcePanel(store.getState());

    assert.doesNotMatch(panelHtml, /data-asset-id="asset-active-source"[^>]*data-active="true"/);
    assert.match(panelHtml, /data-asset-id="asset-enhanced-frame"[^>]*data-active="true"/);
    assert.doesNotMatch(panelHtml, /data-workspace-selected=/);
    assert.doesNotMatch(panelHtml, /Aktif kaynak/);
  });

  void test("laboratory source panel marks only comparison pair assets as active", () => {
    const store = createSeededState(true);
    const state = store.getState();
    state.source = {
      ...state.source,
      metadata: {
        ...(state.source?.["metadata"] ?? {}),
        originAssetId: "asset-active-source",
      },
    };
    store.dispatch({
      type: "asset-added",
      asset: {
        id: "asset-active-source",
        type: "source",
        name: "active-source.png",
        localPath: "/tmp/active-source.png",
        createdAt: 100,
        metadata: {
          kind: "image",
        },
      },
    });
    store.dispatch({
      type: "asset-added",
      asset: {
        id: "asset-reference-frame",
        type: "image",
        name: "reference-frame.png",
        localPath: "/tmp/reference-frame.png",
        createdAt: 300,
        metadata: {
          kind: "image",
        },
      },
    });
    store.dispatch({
      type: "asset-added",
      asset: {
        id: "asset-passive-frame",
        type: "image",
        name: "passive-frame.png",
        localPath: "/tmp/passive-frame.png",
        createdAt: 400,
        metadata: {
          kind: "image",
        },
      },
    });
    store.dispatch({
      type: "workspace-comparison-reference-set",
      assetId: "asset-reference-frame",
    });

    const panelHtml = renderLabSourcePanel(store.getState());

    assert.match(panelHtml, /data-asset-id="asset-active-source"[^>]*data-active="true"/);
    assert.match(panelHtml, /data-asset-id="asset-reference-frame"[^>]*data-active="true"/);
    assert.doesNotMatch(panelHtml, /data-asset-id="asset-passive-frame"[^>]*data-active="true"/);
    assert.doesNotMatch(panelHtml, /data-workspace-selected=/);
    assert.doesNotMatch(panelHtml, /Aktif kaynak/);
  });

  void test("laboratory comparison pair clicks only switch the active comparison side", () => {
    const store = createSeededState(true);
    const state = store.getState();
    state.source = {
      ...state.source,
      status: "ready",
      kind: "image",
      mode: "local",
      previewUrl: "file:///tmp/active-source.png",
      storedFileName: "active-source.png",
      storedPath: "/tmp/active-source.png",
      metadata: {
        originAssetId: "asset-active-source",
        width: 640,
        height: 480,
      },
    };
    store.dispatch({
      type: "asset-added",
      asset: {
        id: "asset-active-source",
        type: "source",
        name: "active-source.png",
        localPath: "/tmp/active-source.png",
        createdAt: 100,
        metadata: {
          kind: "image",
        },
      },
    });
    store.dispatch({
      type: "asset-added",
      asset: {
        id: "asset-reference-frame",
        type: "image",
        name: "reference-frame.png",
        localPath: "/tmp/reference-frame.png",
        createdAt: 300,
        metadata: {
          kind: "image",
        },
      },
    });
    store.dispatch({
      type: "workspace-comparison-reference-set",
      assetId: "asset-reference-frame",
    });

    store.dispatch({
      type: "workspace-asset-selected",
      assetId: "asset-active-source",
    });
    let current = store.getState();
    let surface = renderWorkspaceSurface(current);
    assert.equal(current.ui.activeWorkspaceAssetId, null);
    assert.equal(current.ui.workspace.comparisonReferenceAssetId, "asset-reference-frame");
    assert.equal(current.ui.workspace.comparisonRois.activeSide, "primary");
    assert.match(surface.main, /data-lab-workspace-comparison-stage="true"/);
    assert.match(surface.main, /data-side="primary" data-active="true"/);
    assert.match(surface.main, /data-side="reference" data-active="false"/);

    store.dispatch({
      type: "workspace-asset-selected",
      assetId: "asset-reference-frame",
    });
    current = store.getState();
    surface = renderWorkspaceSurface(current);
    assert.equal(current.ui.activeWorkspaceAssetId, null);
    assert.equal(current.ui.workspace.comparisonReferenceAssetId, "asset-reference-frame");
    assert.equal(current.ui.workspace.comparisonRois.activeSide, "reference");
    assert.match(surface.main, /data-lab-workspace-comparison-stage="true"/);
    assert.match(surface.main, /data-side="primary" data-active="false"/);
    assert.match(surface.main, /data-side="reference" data-active="true"/);
  });

  void test("laboratory selecting media outside the comparison pair returns to single view", () => {
    const store = createSeededState(true);
    const state = store.getState();
    state.source = {
      ...state.source,
      status: "ready",
      kind: "image",
      mode: "local",
      previewUrl: "file:///tmp/active-source.png",
      storedFileName: "active-source.png",
      storedPath: "/tmp/active-source.png",
      metadata: {
        originAssetId: "asset-active-source",
        width: 640,
        height: 480,
      },
    };
    store.dispatch({
      type: "asset-added",
      asset: {
        id: "asset-active-source",
        type: "source",
        name: "active-source.png",
        localPath: "/tmp/active-source.png",
        createdAt: 100,
        metadata: {
          kind: "image",
        },
      },
    });
    store.dispatch({
      type: "asset-added",
      asset: {
        id: "asset-reference-frame",
        type: "image",
        name: "reference-frame.png",
        localPath: "/tmp/reference-frame.png",
        createdAt: 300,
        metadata: {
          kind: "image",
        },
      },
    });
    store.dispatch({
      type: "asset-added",
      asset: {
        id: "asset-third-frame",
        type: "image",
        name: "third-frame.png",
        localPath: "/tmp/third-frame.png",
        createdAt: 400,
        metadata: {
          kind: "image",
        },
      },
    });
    store.dispatch({
      type: "workspace-comparison-reference-set",
      assetId: "asset-reference-frame",
    });
    store.dispatch({
      type: "workspace-asset-selected",
      assetId: "asset-third-frame",
    });

    const current = store.getState();
    const surface = renderWorkspaceSurface(current);
    const panelHtml = renderLabSourcePanel(current);

    assert.equal(current.ui.activeWorkspaceAssetId, "asset-third-frame");
    assert.equal(current.ui.workspace.comparisonReferenceAssetId, null);
    assert.equal(current.ui.workspace.comparisonRois.activeSide, "primary");
    assert.match(surface.main, /data-lab-preview-inspection-stage="true"/);
    assert.match(surface.main, /data-lab-workspace-asset-id="asset-third-frame"/);
    assert.doesNotMatch(surface.main, /data-lab-workspace-comparison-stage="true"/);
    assert.match(panelHtml, /data-asset-id="asset-third-frame"[^>]*data-active="true"/);
    assert.doesNotMatch(panelHtml, /data-asset-id="asset-active-source"[^>]*data-active="true"/);
    assert.doesNotMatch(panelHtml, /data-asset-id="asset-reference-frame"[^>]*data-active="true"/);
  });
});
