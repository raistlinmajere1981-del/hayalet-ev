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

describe("source drawer and operation controls", () => {
  void test("laboratory drawer keeps media operation controls out of report-analysis tabs", () => {
    const store = createSeededState(true);
    const sourceDrawer = renderLabDrawer(
      store.getState(),
      renderWorkspaceSurface(store.getState())
    );
    assert.doesNotMatch(sourceDrawer, /data-lab-drawer-workspace-controls="true"/);

    store.dispatch({ type: "workspace-controls-tab-selected", tab: "operations" });
    const operationDrawer = renderLabDrawer(
      store.getState(),
      renderWorkspaceSurface(store.getState())
    );

    assert.doesNotMatch(operationDrawer, /data-lab-drawer-workspace-controls="true"/);
    assert.doesNotMatch(operationDrawer, /data-lab-workspace-inspector="true"/);
    assert.doesNotMatch(operationDrawer, /data-operation-id=/);
    assert.match(operationDrawer, /data-lab-action="run-deep-analysis"/);
  });

  void test("laboratory operation buttons reflect scoped running action state", () => {
    const store = createSeededState(true);
    store.dispatch({
      type: "user-action-added",
      actionEvent: {
        id: "user-action-enhanced-frame",
        type: "custom",
        label: "İyileştirilmiş frame hazırlanıyor",
        status: "running",
        startedAt: 1,
        requestId: "request-enhanced-frame",
        projectId: "project-1",
        sourceAction: "export-enhanced-frame",
        progress: 42,
      },
    });

    const surface = renderWorkspaceSurface(store.getState());

    assert.match(
      surface.inspector ?? "",
      /data-operation-id="enhanced-frame"[\s\S]*data-action-status="running"/
    );
    assert.match(
      surface.inspector ?? "",
      /data-lab-operation-capability="enhanced-frame"[\s\S]*aria-busy="true"/
    );
    assert.match(
      surface.inspector ?? "",
      /data-lab-action="operation-cancel"[\s\S]*data-lab-value="enhanced-frame"/
    );
    assert.match(surface.inspector ?? "", />Cancel<\/button>/);
    assert.match(surface.inspector ?? "", /data-lab-operation-capability="audio-cleanup"/);
    assert.match(surface.inspector ?? "", /data-lab-operation-capability="band-pass-voice"/);
  });

  void test("laboratory workspace operations follow the selected asset media kind", () => {
    const store = createSeededState(true);
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

    const surface = renderWorkspaceSurface(store.getState());

    assert.match(surface.main, /data-lab-workspace-asset-kind="audio"/);
    assert.match(surface.inspector ?? "", /data-operation-id="audio-extract"/);
    assert.match(surface.inspector ?? "", /data-operation-id="audio-cleanup"/);
    assert.match(surface.inspector ?? "", /data-operation-id="band-pass-voice"/);
    assert.doesNotMatch(surface.inspector ?? "", /data-operation-id="enhanced-frame"/);
    assert.doesNotMatch(surface.inspector ?? "", /data-operation-id="frame-grab"/);
  });

  void test("laboratory selected image assets stay on the processable inspection stage", () => {
    const store = createSeededState(true);
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

    const surface = renderWorkspaceSurface(store.getState());

    assert.match(surface.main, /data-lab-preview-inspection-stage="true"/);
    assert.match(surface.main, /data-lab-selection-roi-stage="true"/);
    assert.match(surface.main, /data-lab-preview-inspection-topology="single-image"/);
    assert.match(surface.main, /data-lab-workspace-asset-id="asset-enhanced-frame"/);
    assert.match(surface.main, /data-lab-workspace-asset-kind="image"/);
    assert.match(surface.main, /data-lab-preserve-media="workspace-preview"/);
    assert.doesNotMatch(surface.main, /class="labx-workspace-content"/);
    assert.doesNotMatch(surface.main, /data-preview-mode=/);
    assert.match(surface.inspector ?? "", /data-operation-id="enhanced-frame"/);
  });
});
