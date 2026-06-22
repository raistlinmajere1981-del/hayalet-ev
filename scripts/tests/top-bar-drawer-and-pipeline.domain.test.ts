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

describe("top bar drawer and pipeline", () => {
  void test("laboratory top bar reflects active v2 shell navigation", () => {
    const store = createSeededState();
    store.dispatch({ type: "tool-manager-toggled", open: true });
    const html = renderLabTopBar(store.getState());
    const leftRail = renderLabLeftRail(store.getState());

    assert.match(html, /class="labx-top-bar" data-lab-region="topbar"/);
    assert.equal(leftRail, "");
    assert.match(html, /data-lab-action="source-panel-toggle"/);
    assert.doesNotMatch(html, /data-lab-action="project-workspace-open"/);
    assert.doesNotMatch(html, /Project Management/);
    assert.match(html, /lab-demo\.mp4/);
    assert.match(html, /640×360/);
    assert.doesNotMatch(html, /2026-04-21 12-00 - lab-demo\.mp4/);
    assert.doesNotMatch(html, /data-lab-action="topbar-pill-source"/);
    assert.doesNotMatch(leftRail, /data-lab-action="topbar-pill-source"/);
    assert.doesNotMatch(leftRail, /data-lab-action="topbar-pill-analyze"/);
    assert.doesNotMatch(leftRail, /data-lab-action="topbar-pill-results"/);
    assert.match(html, /data-lab-action="toggle-tool-manager"/);
    assert.doesNotMatch(html, /Modül Yönetimi|Seçili Modüller|Yoğun operatör tezgahı/);
  });

  void test("laboratory right drawer defaults to the help tab before source preparation", () => {
    const store = createEmptyReadyState();
    const copy = createTurkishCopy();
    const state = store.getState();
    const surface = renderWorkspaceSurface(state, { copy });
    const drawer = renderLabDrawer(state, surface, copy);

    assert.match(drawer, /aria-label="Yardım"[\s\S]*data-pill-state="active"/);
    assert.match(drawer, /aria-label="Analiz"/);
    assert.match(drawer, /aria-label="İşlem"/);
    assert.match(drawer, /aria-label="Sonuc"/);
    assert.match(drawer, /labx-drawer__body--selection/);
    assert.doesNotMatch(drawer, /Zaman çizelgesinde bir alan seçin|labx-drawer__selection-empty/);
    assert.doesNotMatch(drawer, /data-block-id="analysis-prep"/);
  });

  void test("laboratory draft project renders empty workspace before full bootstrap readiness", () => {
    const store = createDraftBootstrapState();
    const copy = createTurkishCopy();
    const state = store.getState();
    const surface = renderWorkspaceSurface(state, { copy });
    const drawer = renderLabDrawer(state, surface, copy);

    assert.equal(state.bootReady, false);
    assert.doesNotMatch(surface.main, /data-lab-center-skeleton="true"/);
    assert.match(surface.main, /data-media-viewport-state="empty"/);
    assert.match(surface.main, /Proje kaynagi henuz hazir degil/);
    assert.doesNotMatch(drawer, /labx-drawer-skeleton/);
    assert.match(drawer, /aria-label="Yardım"[\s\S]*data-pill-state="active"/);
  });

  void test("laboratory inactive right-side regions stay mounted as hidden containers", () => {
    const bootStore = createLabStore();
    const bootSurface = renderWorkspaceSurface(bootStore.getState());

    assert.match(bootSurface.inspector ?? "", /data-lab-region="inspector-panel"/);
    assert.match(bootSurface.inspector ?? "", /data-empty="true"/);
    assert.match(bootSurface.inspector ?? "", /hidden aria-hidden="true"/);

    const store = createSeededState();
    store.dispatch({ type: "drawer-collapsed-toggled" });
    const surface = renderWorkspaceSurface(store.getState());
    const drawer = renderLabDrawer(store.getState(), surface);

    assert.match(drawer, /data-lab-region="context-panel"/);
    assert.match(drawer, /data-empty="true"/);
    assert.match(drawer, /hidden aria-hidden="true"/);
    assert.match(drawer, /class="labx-drawer__body"/);
    assert.doesNotMatch(drawer, /class="labx-pipeline-block"/);
  });

  void test("laboratory pipeline renderer escapes metadata and omits hidden or empty blocks", () => {
    const markup = renderPipeline(
      [
        {
          id: 'unsafe"&',
          render() {
            return "<span>Visible block</span>";
          },
          type: "section",
        },
        {
          id: "hidden",
          render() {
            return "<span>Hidden block</span>";
          },
          type: "action",
          visible() {
            return false;
          },
        },
        {
          id: "empty",
          render() {
            return "   ";
          },
          type: "status",
        },
      ],
      "setup"
    );

    assert.match(markup, /class="labx-pipeline-block"/);
    assert.match(markup, /data-block-id="unsafe&quot;&amp;"/);
    assert.match(markup, /data-block-type="section"/);
    assert.match(markup, /data-block-mode="setup"/);
    assert.match(markup, /Visible block/);
    assert.doesNotMatch(markup, /Hidden block|data-block-id="hidden"|data-block-id="empty"/);
    assert.doesNotMatch(markup, /class="labx-pipeline"/);
  });
});
