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

describe("analysis preparation and suggestions", () => {
  void test("laboratory analysis preparation parent and child toggles stay synchronized", () => {
    const store = createSeededState(true);

    store.dispatch({ type: "analysis-prep-group-toggled", capabilityId: "audio-signal" });
    let audioGroup = getAnalysisPreparationGroups(store.getState()).find(function (group) {
      return group.capabilityId === "audio-signal";
    });
    assert.equal(audioGroup?.selectionState, "full");
    assert.ok(audioGroup.modules.every((module) => module.enabled));
    assert.deepEqual(store.getState().ui.workspace.analysisPrepExpandedCapabilityIds, []);

    store.dispatch({ type: "analysis-prep-group-toggled", capabilityId: "audio-signal" });
    audioGroup = getAnalysisPreparationGroups(store.getState()).find(function (group) {
      return group.capabilityId === "audio-signal";
    });
    assert.equal(audioGroup?.selectionState, "none");
    assert.ok(audioGroup.modules.every((module) => !module.enabled));
    assert.deepEqual(store.getState().ui.workspace.analysisPrepExpandedCapabilityIds, []);

    store.dispatch({
      type: "analysis-prep-module-toggled",
      capabilityId: "audio-signal",
      moduleId: "signal-health",
    });
    audioGroup = getAnalysisPreparationGroups(store.getState()).find(function (group) {
      return group.capabilityId === "audio-signal";
    });
    assert.equal(audioGroup?.selectionState, "partial");
    assert.equal(
      audioGroup.modules.find((module) => module.moduleId === "signal-health")?.enabled,
      true
    );
    assert.ok(store.getState().selectedCapabilities.includes("audio-signal"));

    const drawer = renderLabDrawer(store.getState(), renderWorkspaceSurface(store.getState()));
    assert.match(drawer, /data-selection-state="partial"[\s\S]*data-lab-value="audio-signal"/);
    const partialGroupToggle = drawer.match(
      /<input[^>]*data-lab-action="analysis-prep-group-toggle"[^>]*data-lab-value="audio-signal"[^>]*>/
    )?.[0];
    assert.ok(partialGroupToggle != null);
    assert.match(partialGroupToggle, /aria-checked="mixed"/);
    assert.match(partialGroupToggle, /data-lab-indeterminate="true"/);
    assert.match(partialGroupToggle, /data-selection-state="partial"/);
    assert.doesNotMatch(partialGroupToggle, /\schecked(\s|>|\/)/);
    assert.doesNotMatch(partialGroupToggle, /\sdisabled(\s|>|\/)/);

    store.dispatch({ type: "analysis-prep-group-toggled", capabilityId: "audio-signal" });
    audioGroup = getAnalysisPreparationGroups(store.getState()).find(function (group) {
      return group.capabilityId === "audio-signal";
    });
    assert.equal(audioGroup?.selectionState, "full");
    assert.ok(audioGroup.modules.every((module) => module.enabled));
    const fullDrawer = renderLabDrawer(store.getState(), renderWorkspaceSurface(store.getState()));
    const fullGroupToggle = fullDrawer.match(
      /<input[^>]*data-lab-action="analysis-prep-group-toggle"[^>]*data-lab-value="audio-signal"[^>]*>/
    )?.[0];
    assert.ok(fullGroupToggle != null);
    assert.match(fullGroupToggle, /aria-checked="true"/);
    assert.match(fullGroupToggle, /data-lab-indeterminate="false"/);
    assert.match(fullGroupToggle, /data-selection-state="full"/);
    assert.match(fullGroupToggle, /\schecked(\s|>|\/)/);
  });

  void test("laboratory selection guidance splits expanded operation and analysis suggestions", () => {
    const store = createSeededState(true);
    store.dispatch({
      type: "workspace-timeline-updated",
      startMs: 2400,
      endMs: 5600,
    });
    store.dispatch({
      type: "selection-inspection-mode-updated",
      mode: "audio",
    });

    const surface = renderWorkspaceSurface(store.getState());

    assert.match(surface.side, /Önerilen Analizler/);
    assert.doesNotMatch(surface.side, /Önerilen İşlemler/);
    assert.doesNotMatch(surface.side, /Sesi temizle/);
    assert.doesNotMatch(surface.side, /Kaynaklari ayir/);
    assert.match(surface.side, /Metadata kontrolu/);
    assert.match(surface.side, /Sahne gecislerini tara/);
  });

  void test("laboratory operation suggestions stay out of the selection tab and source analysis rail", () => {
    const store = createSeededState(true);
    store.dispatch({
      type: "workspace-timeline-updated",
      startMs: 2400,
      endMs: 5600,
    });
    store.dispatch({
      type: "selection-inspection-mode-updated",
      mode: "audio",
    });
    store.dispatch({
      type: "workspace-selection-suggestion-preview-set",
      suggestionId: "clean-audio",
    });
    store.dispatch({
      type: "workspace-selection-suggestion-accepted",
      suggestionId: "clean-audio",
    });

    const surface = renderWorkspaceSurface(store.getState());
    const drawer = renderLabDrawer(store.getState(), surface);

    assert.equal(getActiveSuggestionPreview(store.getState()), null);
    assert.equal(getActiveExecutionIntent(store.getState()), null);
    assert.doesNotMatch(surface.side, /data-lab-selection-suggestion="clean-audio"/);
    assert.doesNotMatch(surface.side, /Sesi temizle/);
    assert.doesNotMatch(drawer, /data-active="true"[\s\S]*Audio signal/);
  });

  void test("laboratory analysis suggestion acceptance opens and highlights the preparation rail", () => {
    const store = createSeededState(true);
    store.dispatch({
      type: "workspace-timeline-updated",
      startMs: 2400,
      endMs: 5600,
    });
    store.dispatch({
      type: "selection-inspection-mode-updated",
      mode: "audio",
    });
    store.dispatch({ type: "drawer-collapsed-toggled" });
    store.dispatch({
      type: "workspace-selection-suggestion-preview-set",
      suggestionId: "audio-inspect",
    });
    store.dispatch({
      type: "workspace-selection-suggestion-accepted",
      suggestionId: "audio-inspect",
    });

    const surface = renderWorkspaceSurface(store.getState());
    const drawer = renderLabDrawer(store.getState(), surface);

    assert.notEqual(drawer, "");
    assert.match(drawer, /data-drawer-mode="setup"/);
    assert.match(drawer, /data-active="true"[\s\S]*Audio signal/);
    assert.doesNotMatch(drawer, /data-active="true"[\s\S]*Audio recovery/);
  });

  void test("laboratory queued analysis suggestions stay in the help tab after checking ready analyses", () => {
    const store = createSeededState(true);
    store.dispatch({
      type: "workspace-timeline-updated",
      startMs: 2400,
      endMs: 5600,
    });
    store.dispatch({
      type: "selection-inspection-mode-updated",
      mode: "audio",
    });
    store.dispatch({
      type: "workspace-selection-suggestion-preview-set",
      suggestionId: "audio-inspect",
    });
    store.dispatch({
      type: "workspace-selection-suggestion-queued",
      suggestionId: "audio-inspect",
    });

    const surface = renderWorkspaceSurface(store.getState());
    const drawer = renderLabDrawer(store.getState(), surface);

    assert.deepEqual(store.getState().selectedCapabilities, ["audio-signal"]);
    assert.equal(store.getState().ui.workspace.selectionTabActive, true);
    assert.equal(store.getState().ui.activeSuggestionPreviewId, null);
    assert.match(drawer, /data-pill-state="active"[\s\S]*Yardım/);
    assert.match(drawer, /lab-selection-panel--drawer/);
  });

  void test("laboratory root keeps passive selection suggestions outside the run controller", () => {
    const rootSource = readFileSync("rooms/laboratory/ui/lab-root.ts", "utf8");
    const binderSource = readFileSync(
      "rooms/laboratory/ui/lab-selection-suggestion-binder.ts",
      "utf8"
    );
    const runControllerSource = readFileSync(
      "rooms/laboratory/runtime/lab-run-controller.ts",
      "utf8"
    );

    assert.match(rootSource, /bindLabSelectionSuggestionClicks/);
    assert.match(rootSource, /beforeunload/);
    assert.match(binderSource, /workspace-selection-suggestion-accepted/);
    assert.match(binderSource, /workspace-selection-suggestion-dismissed/);
    assert.doesNotMatch(rootSource, /createLabExecutionDispatcher/);
    assert.doesNotMatch(rootSource, /getExecutionDispatchCandidate/);
    assert.doesNotMatch(runControllerSource, /createLabExecutionDispatcher/);
    assert.doesNotMatch(runControllerSource, /workspace-execution-dispatch/);
  });

  void test("laboratory analysis readiness allows capability-only selection when modules are ready", () => {
    const store = createSeededState(true);
    store.dispatch({ type: "capability-set", capabilities: ["visual-forensics"] });

    assert.equal(getAnalysisActionBlockReason(store.getState()), null);
  });
});
