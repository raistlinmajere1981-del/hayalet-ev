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

describe("transparency and process strip", () => {
  void test("laboratory process strip renders recent action history from user actions", () => {
    const store = createSeededState(true);

    store.dispatch({
      type: "asset-added",
      asset: {
        id: "asset-frame-result",
        type: "frame",
        name: "frame_01.png",
        localPath: "/tmp/frame_01.png",
        createdAt: 200,
        sourceId: "source-1",
        runId: "run-1",
      },
    });

    store.dispatch({
      type: "user-action-added",
      actionEvent: {
        id: "user-action-running",
        type: "export-clip",
        label: "Klip çıkarılıyor",
        status: "running",
        startedAt: Date.now() - 3000,
        projectId: "project-1",
        requestId: "req-running",
        sourceAction: "export-timeline-clip",
      },
    });
    store.dispatch({
      type: "user-action-added",
      actionEvent: {
        id: "user-action-success",
        type: "grab-frame",
        label: "Frame alınıyor",
        status: "success",
        startedAt: Date.now() - 5000,
        finishedAt: Date.now() - 1000,
        message: "Frame alındı",
        projectId: "project-1",
        requestId: "req-success",
        resultAssetIds: ["asset-frame-result"],
        sourceAction: "export-frame-grab",
      },
    });

    const state = store.getState();
    const surface = renderWorkspaceSurface(state);

    assert.doesNotMatch(surface.main, /labx-topbar-actions/);
    assert.match(surface.inspector ?? "", /data-operation-id="clip-export"[\s\S]*Klip çıkarılıyor/);

    const collapsedStripHtml = renderLabProcessStrip(store.getState());
    assert.match(collapsedStripHtml, /data-process-view="compact"/);
    assert.match(collapsedStripHtml, /class="labx-strip-detail-toggle"/);
    assert.match(collapsedStripHtml, /aria-expanded="false"/);
    assert.doesNotMatch(collapsedStripHtml, /data-lab-process-expanded="true"/);
    assert.doesNotMatch(collapsedStripHtml, /class="labx-strip-expand"/);
    assert.doesNotMatch(collapsedStripHtml, /class="labx-strip-cancel"/);

    store.dispatch({ type: "workspace-process-view-toggled", force: true });
    const stripHtml = renderLabProcessStrip(store.getState());
    assert.match(stripHtml, /data-process-view="expanded"/);
    assert.match(stripHtml, /data-lab-process-expanded="true"/);
    assert.match(stripHtml, /aria-expanded="true"/);
    assert.match(stripHtml, /Analiz özeti/);
    assert.match(stripHtml, /Ham log/);
    assert.match(stripHtml, /Ham log yok/);
    assert.match(stripHtml, /Frame alındı/);
    assert.match(stripHtml, /frame_01\.png/);
  });

  void test("laboratory process strip renders multi-output action summaries with overflow counts", () => {
    const store = createSeededState(true);

    store.dispatch({
      type: "asset-added",
      asset: {
        id: "asset-report-user",
        type: "report",
        name: "report-user.md",
        localPath: "/tmp/report-user.md",
        createdAt: 200,
        sourceId: "source-1",
        runId: "run-1",
      },
    });
    store.dispatch({
      type: "asset-added",
      asset: {
        id: "asset-report-ai",
        type: "report",
        name: "report-ai.json",
        localPath: "/tmp/report-ai.json",
        createdAt: 300,
        sourceId: "source-1",
        runId: "run-1",
      },
    });
    store.dispatch({
      type: "user-action-added",
      actionEvent: {
        id: "user-action-report-success",
        type: "custom",
        label: "Rapor dışa aktarılıyor",
        status: "success",
        startedAt: Date.now() - 5000,
        finishedAt: Date.now() - 1000,
        message: "Rapor dışa aktarıldı",
        projectId: "project-1",
        requestId: "req-report-success",
        resultAssetIds: ["asset-report-user", "asset-report-ai"],
        sourceAction: "report-export",
      },
    });

    const state = store.getState();
    const surface = renderWorkspaceSurface(state);

    assert.doesNotMatch(surface.main, /report-user\.md \+1/);
    store.dispatch({ type: "workspace-process-view-toggled", force: true });
    const stripHtml = renderLabProcessStrip(store.getState());
    assert.match(stripHtml, /report-user\.md, report-ai\.json/);
  });

  void test("laboratory source panel renders registry groups and workspace open actions", () => {
    const store = createSeededState(true);
    store.dispatch({
      type: "asset-added",
      asset: {
        id: "clip-local-1",
        type: "clip",
        name: "clip_01.mp4",
        localPath: "/tmp/clip_01.mp4",
        createdAt: 200,
        sourceId: "source-1",
        runId: "run-1",
        metadata: {
          durationMs: 1400,
        },
      },
    });
    store.dispatch({
      type: "asset-added",
      asset: {
        id: "clip-remote-1",
        type: "clip",
        name: "remote_clip.mp4",
        url: "https://example.test/remote_clip.mp4",
        createdAt: 300,
      },
    });
    store.dispatch({
      type: "asset-added",
      asset: {
        id: "report-1",
        type: "report",
        name: "run_report.md",
        localPath: "/tmp/run_report.md",
        createdAt: 400,
        runId: "run-1",
        metadata: {
          reportView: "user",
        },
      },
    });
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

    assert.match(panelHtml, /Klipler/);
    assert.match(panelHtml, /Raporlar/);
    assert.match(panelHtml, /clip_01\.mp4/);
    assert.match(panelHtml, /run_report\.md/);
    assert.match(panelHtml, /data-lab-action="open-report-overlay" data-lab-value="user"/);
    assert.match(panelHtml, /data-lab-action="asset-download"/);
    assert.match(panelHtml, /data-lab-action="asset-remove"/);
    assert.match(
      panelHtml,
      /class="labx-sp-asset__btn"[^>]*data-lab-action="workspace-asset-select" data-lab-value="clip-local-1"/
    );
    assert.match(
      panelHtml,
      /class="labx-sp-asset__btn"[^>]*data-lab-action="workspace-asset-select" data-lab-value="artifact-png-1"/
    );
    assert.match(
      panelHtml,
      /data-lab-action="workspace-asset-select" data-lab-value="clip-local-1"/
    );
    assert.match(
      panelHtml,
      /data-lab-action="workspace-asset-select" data-lab-value="clip-remote-1"/
    );
    assert.doesNotMatch(panelHtml, /data-lab-action="workspace-content-open"/);
    assert.doesNotMatch(panelHtml, /data-lab-action="source-activate-asset"/);
    assert.doesNotMatch(panelHtml, /data-lab-action="asset-use-as-source"/);
  });
});
