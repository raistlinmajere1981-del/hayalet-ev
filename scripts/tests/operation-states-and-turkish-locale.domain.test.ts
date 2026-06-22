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

describe("operation states and Turkish locale", () => {
  void test("laboratory operation error buttons keep retry label short and expose message in title", () => {
    const html = renderWorkspaceOperationControls([
      {
        actionId: "workspace-enhanced-frame-export",
        actionStatus: "error",
        activeActionLabel: "İyileştirilmiş frame hazırlanıyor",
        activeActionMessage: "ffmpeg returned a very long diagnostic about an unsupported filter",
        activeJobId: null,
        activeRequestId: "request-enhanced-frame",
        blockReason: null,
        description: "Generate a clarity-focused frame or ROI variant.",
        flowKind: "operation-result",
        groupId: "frame",
        id: "enhanced-frame",
        label: "Enhanced Frame",
        outputKinds: ["frame", "image", "variant"],
        providerIds: ["ffmpeg-visual-reveal"],
        readiness: "ready",
        settings: {},
        settingsFields: [],
        sourceKinds: ["video", "image"],
        toolIds: ["ffmpeg"],
      },
    ]);

    assert.match(html, /data-action-status="error"/);
    assert.match(html, /<h3>Enhanced Frame<\/h3>/);
    assert.match(html, /data-title-hidden="false"/);
    assert.match(html, />Retry<\/button>/);
    assert.match(
      html,
      /title="ffmpeg returned a very long diagnostic about an unsupported filter"/
    );
    assert.match(html, /class="labx-operation-card__action-state"/);
    assert.doesNotMatch(html, /<h2 class="labx-card__title">(?:Operations|İşlemler)<\/h2>/);
  });

  void test("laboratory operation success state returns controls to the normal run action", () => {
    const html = renderWorkspaceOperationControls([
      {
        actionId: "workspace-selection-roi-export",
        actionStatus: "success",
        activeActionLabel: "Bölge görüntüsü alınıyor",
        activeActionMessage: "Bölge görüntüsü hazır",
        activeJobId: null,
        activeRequestId: "request-roi-crop",
        blockReason: null,
        description: "Crop the selected ROI.",
        flowKind: "operation-result",
        groupId: "frame",
        id: "roi-crop",
        label: "ROI Crop",
        outputKinds: ["image"],
        providerIds: ["ffmpeg-visual-reveal"],
        readiness: "ready",
        settings: {},
        settingsFields: [],
        sourceKinds: ["video", "image"],
        toolIds: ["ffmpeg"],
      },
    ]);

    assert.match(html, /data-action-status="idle"/);
    assert.match(html, />Run<\/button>/);
    assert.doesNotMatch(html, /Bölge görüntüsü hazır/);
    assert.doesNotMatch(html, /class="labx-operation-card__action-state"/);
  });

  void test("laboratory Turkish workspace controls localize operation and analysis catalog labels", () => {
    const store = createSeededState(true);
    store.dispatch({ type: "analysis-prep-group-toggled", capabilityId: "audio-signal" });
    store.dispatch({ type: "analysis-prep-group-expanded", capabilityIds: ["audio-signal"] });
    const trCopy = createTurkishCopy();
    const surface = renderWorkspaceSurface(store.getState(), { copy: trCopy });
    const drawer = renderLabDrawer(store.getState(), surface, trCopy);

    assert.match(surface.inspector ?? "", /Klip Dışa Aktarma/);
    assert.match(
      surface.inspector ?? "",
      /Aktif zaman aralığı seçiminden bağımsız bir klip oluştur/
    );
    assert.match(surface.inspector ?? "", /Kare Yakalama/);
    assert.match(surface.inspector ?? "", /Çıktı: klip/);
    assert.match(surface.inspector ?? "", /İşlemler/);
    assert.match(surface.inspector ?? "", /Ön ayar|On ayar/);
    assert.doesNotMatch(
      surface.inspector ?? "",
      /Clip Export|Frame Grab|Create a standalone clip|Capture the current video frame|>Preset<|>Apply preview</
    );
    assert.match(drawer, /Analiz Modulleri/);
    assert.match(drawer, /Ses sinyali/);
    assert.match(drawer, /Sinyal sagligi/);
    assert.doesNotMatch(
      drawer,
      /Visual inspection|Audio investigation|forensic markers|Audio signal|Speech evidence/
    );

    const blockedStore = createSeededState(false);
    const blockedSurface = renderWorkspaceSurface(blockedStore.getState(), { copy: trCopy });
    const blockedDrawer = renderLabDrawer(blockedStore.getState(), blockedSurface, trCopy);
    assert.match(blockedDrawer, /Mevcut araclarla yapilabilen analiz yok/);
    assert.doesNotMatch(blockedDrawer, /Gerekli araçlar kurulu değil/);
    assert.doesNotMatch(blockedDrawer, /Required tools not installed/);
  });

  void test("laboratory analysis preparation groups default closed and expand on demand", () => {
    const store = createSeededState(true);
    const defaultGroups = getAnalysisPreparationGroups(store.getState());
    assert.ok(defaultGroups.every((group) => group.selectionState === "none"));
    assert.ok(
      defaultGroups.every((group) => group.modules.every((module) => module.enabled === false))
    );

    const closedDrawer = renderLabDrawer(
      store.getState(),
      renderWorkspaceSurface(store.getState())
    );
    assert.match(closedDrawer, /data-lab-action="analysis-prep-group-toggle"/);
    assert.match(closedDrawer, /data-lab-action="analysis-prep-group-drawer-toggle"/);
    assert.match(closedDrawer, /aria-expanded="false"/);
    assert.doesNotMatch(closedDrawer, /class="labx-analysis-module"/);
    const closedGroupToggle = closedDrawer.match(
      /<input[^>]*data-lab-action="analysis-prep-group-toggle"[^>]*data-lab-value="audio-signal"[^>]*>/
    )?.[0];
    assert.ok(closedGroupToggle != null);
    assert.match(closedGroupToggle, /aria-checked="false"/);
    assert.match(closedGroupToggle, /data-selection-state="none"/);
    assert.doesNotMatch(closedGroupToggle, /\sdisabled(\s|>|\/)/);

    store.dispatch({ type: "analysis-prep-group-expanded", capabilityIds: ["audio-signal"] });
    const openDrawer = renderLabDrawer(store.getState(), renderWorkspaceSurface(store.getState()));

    assert.match(openDrawer, /data-lab-value="audio-signal"[\s\S]*aria-expanded="true"/);
    assert.match(openDrawer, /class="labx-analysis-module"/);
    assert.match(openDrawer, /Audio signal/);
    assert.deepEqual(store.getState().selectedCapabilities, []);
    const signalToggle = openDrawer.match(
      /<input[^>]*data-lab-action="module-toggle"[^>]*data-lab-value="audio-signal::signal-health"[^>]*>/
    )?.[0];
    assert.ok(signalToggle != null);
    assert.doesNotMatch(signalToggle, /\schecked(\s|>)/);
    assert.match(
      openDrawer,
      /data-lab-field="analysisSettings\.modules\.signal-health\.sampleWindowSeconds"/
    );
    assert.match(openDrawer, /data-lab-action="analysis-settings-reset"/);
  });
});
