import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

import {
  getActiveExecutionIntent,
  getActiveSuggestionPreview,
  getAnalysisActionBlockReason,
  getAnalysisPreparationGroups,
  getProcessingOverlayState,
} from "../../rooms/laboratory/runtime/lab-selectors.ts";
import { createLabStore } from "../../rooms/laboratory/runtime/lab-store.ts";
import { renderLabAssetPreviewOverlay } from "../../rooms/laboratory/ui/lab-asset-preview-overlay.ts";
import { renderLabDrawer } from "../../rooms/laboratory/ui/lab-drawer.ts";
import { renderLabProcessStrip } from "../../rooms/laboratory/ui/lab-process-strip.ts";
import { renderLabSourcePanel } from "../../rooms/laboratory/ui/lab-source-panel.ts";
import { renderLabLeftRail, renderLabTopBar } from "../../rooms/laboratory/ui/lab-top-bar.ts";
import { createLabI18n } from "../../rooms/laboratory/ui/lab-i18n.ts";
import { renderPipeline } from "../../rooms/laboratory/ui/laboratory-layout.ts";
import { renderReportOverlay } from "../../rooms/laboratory/ui/report-overlay.ts";
import { renderToolManagementOverlay } from "../../rooms/laboratory/ui/tool-management-overlay.ts";
import { renderWorkspaceOperationControls } from "../../rooms/laboratory/ui/workspace-operation-controls.ts";
import {
  renderSourceIntake,
  renderWorkspaceSurface,
} from "../../rooms/laboratory/ui/workspace-surface.ts";

const sourcePresets = JSON.parse(
  readFileSync("rooms/laboratory/shared/data/tools/source-presets.json", "utf8")
);
const ytDlpForm = JSON.parse(
  readFileSync("rooms/laboratory/shared/data/tools/yt-dlp.form.json", "utf8")
);

function getPipelineBlockIds(markup: string): string[] {
  return Array.from(markup.matchAll(/data-block-id="([^"]+)"/g), function (match) {
    return match[1]!;
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
          manualHint: "FFmpeg runs local media transforms for the active workspace.",
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
          toolId: "whisper-cli",
          displayName: "Whisper CLI",
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
          },
          "whisper-cli": {
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

test("laboratory top bar reflects active v2 shell navigation", () => {
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

test("laboratory inactive right-side regions stay mounted as hidden containers", () => {
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

test("laboratory pipeline renderer escapes metadata and omits hidden or empty blocks", () => {
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

test("laboratory pipeline trace is debug gated and follows rendered block order", () => {
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

test("laboratory v2 shell renders source intake in the setup drawer and preview media in center", () => {
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
  assert.match(surface.main, /class="labx-media-workbench"[^>]*data-lab-region="main-stage-inner"/);
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
  assert.match(surface.inspector ?? "", /data-inspector-panel="audio"[\s\S]*id="lab-audio-focus"/);
  assert.match(surface.inspector ?? "", /data-inspector-panel="visual"[\s\S]*labx-controls-card/);
  assert.doesNotMatch(surface.main, /class="labx-workspace-focus-row"/);
  assert.doesNotMatch(surface.main, /labx-timeline__range-info/);
  assert.doesNotMatch(surface.main, /labx-bookmarks/);
  assert.doesNotMatch(
    surface.main,
    /labx-timeline__header|Embedded audio|Preview and waveform share/
  );
  assert.doesNotMatch(surface.main, /Source setup controls/);
  assert.equal(surface.side.trim(), "");
  assert.match(drawer, /class="labx-drawer labx-context-panel" data-lab-region="context-panel"/);
  assert.match(drawer, /data-drawer-mode="setup"/);
  assert.deepEqual(getPipelineBlockIds(drawer), ["analysis-prep", "analysis-cta"]);
  assert.match(drawer, /data-block-mode="setup"/);
  assert.match(drawer, /Analysis Goals/);
  assert.match(drawer, /data-lab-action="run-deep-analysis"/);
  assert.doesNotMatch(
    drawer,
    /Source setup controls|Project Assets|data-lab-action="save-project"/
  );
  assert.doesNotMatch(surface.main, /Kaynak Seçimi|Hızlı modül seçimi burada yapılır/);
});

test("laboratory drawer keeps project assets visible in result and explore modes", () => {
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
    "decision-status",
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

test("laboratory workspace treats reused local assets as ready sources", () => {
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
  assert.match(drawer, /Analysis Goals/);
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

test("laboratory setup drawer previews intent outcomes before the analysis CTA", () => {
  const store = createSeededState(true);

  let surface = renderWorkspaceSurface(store.getState());
  let drawer = renderLabDrawer(store.getState(), surface);
  assert.doesNotMatch(drawer, /Bu analiz .* tespit edecek/);

  store.dispatch({
    type: "workspace-intent-set",
    intents: ["visual-inspection", "anomaly-detection"],
  });

  surface = renderWorkspaceSurface(store.getState());
  drawer = renderLabDrawer(store.getState(), surface);
  assert.deepEqual(getPipelineBlockIds(drawer), ["analysis-prep", "preflight", "analysis-cta"]);
  assert.match(drawer, /Bu analiz .* üzerinde/);
  assert.match(drawer, /görsel yapıyı ve forensic işaretleri inceleyerek/);
  assert.match(drawer, /görsel ve işitsel anomali taraması yaparak/);
  assert.match(drawer, /yapısal anomaliler ve forensic kanıtlar/);
  assert.match(drawer, /olası anormallikler ve sınıflandırılmış ses olayları/);
});

test("laboratory setup drawer owns active source selection controls under the analysis CTA", () => {
  const store = createSeededState(true);
  store.dispatch({
    type: "workspace-timeline-updated",
    startMs: 2400,
    endMs: 5600,
  });

  const surface = renderWorkspaceSurface(store.getState());
  const drawer = renderLabDrawer(store.getState(), surface);
  const ctaIndex = drawer.indexOf('data-lab-action="run-deep-analysis"');
  const selectionPanelIndex = drawer.indexOf("lab-selection-panel--drawer");

  assert.match(surface.main, /class="labx-timeline__selection lab-selection-overlay"/);
  assert.doesNotMatch(surface.main, /class="lab-selection-panel"/);
  assert.match(surface.side, /class="lab-selection-panel lab-selection-panel--drawer"/);
  assert.doesNotMatch(drawer, /class="lab-selection-panel lab-selection-panel--drawer"/);
  assert.deepEqual(getPipelineBlockIds(drawer), [
    "analysis-prep",
    "analysis-cta",
  ]);
  assert.ok(ctaIndex > -1);
  assert.equal(selectionPanelIndex, -1);
});

test("laboratory workspace inspector drawer persists collapsed visual tab state", () => {
  const store = createSeededState(true);
  store.dispatch({ type: "workspace-controls-tab-selected", tab: "visual" });
  store.dispatch({ type: "workspace-controls-drawer-toggled", force: false });

  const surface = renderWorkspaceSurface(store.getState());

  assert.match(surface.inspector ?? "", /data-lab-workspace-inspector="true"/);
  assert.match(surface.inspector ?? "", /data-lab-region="inspector-panel"/);
  assert.match(surface.inspector ?? "", /data-open="false"/);
  assert.match(surface.inspector ?? "", /data-active-tab="visual"/);
  assert.match(surface.inspector ?? "", /aria-expanded="false"/);
  assert.match(surface.inspector ?? "", /data-inspector-panel="visual"/);
});

test("laboratory workspace focus layer classes map to preview timeline and inspector", () => {
  const store = createSeededState(true);

  let surface = renderWorkspaceSurface(store.getState());
  assert.match(surface.main, /class="labx-workspace-preview labx-preview-area labx-focus-primary"/);
  assert.match(surface.main, /class="labx-timeline labx-timeline-area labx-focus-passive"/);
  assert.match(
    surface.inspector ?? "",
    /class="labx-workspace-inspector labx-inspector-panel labx-focus-passive"/
  );

  store.dispatch({ type: "lab-focus-layer-changed", layer: "timeline" });
  surface = renderWorkspaceSurface(store.getState());
  assert.match(surface.main, /class="labx-workspace-preview labx-preview-area labx-focus-passive"/);
  assert.match(surface.main, /class="labx-timeline labx-timeline-area labx-focus-secondary"/);
  assert.match(
    surface.inspector ?? "",
    /class="labx-workspace-inspector labx-inspector-panel labx-focus-passive"/
  );

  store.dispatch({ type: "lab-focus-layer-changed", layer: "inspector" });
  surface = renderWorkspaceSurface(store.getState());
  assert.match(surface.main, /class="labx-workspace-preview labx-preview-area labx-focus-passive"/);
  assert.match(surface.main, /class="labx-timeline labx-timeline-area labx-focus-passive"/);
  assert.match(
    surface.inspector ?? "",
    /class="labx-workspace-inspector labx-inspector-panel labx-focus-secondary"/
  );
});

test("laboratory workspace inspector exposes operation-result controls and active operation focus", () => {
  const store = createSeededState(true);
  store.dispatch({
    type: "workspace-timeline-updated",
    startMs: 2400,
    endMs: 5600,
  });
  store.dispatch({
    type: "workspace-selection-intent-updated",
    intent: "visual",
  });
  store.dispatch({
    type: "workspace-selection-suggestion-preview-set",
    suggestionId: "enhance-visual",
  });
  store.dispatch({
    type: "workspace-selection-suggestion-accepted",
    suggestionId: "enhance-visual",
  });

  const surface = renderWorkspaceSurface(store.getState());

  assert.match(surface.inspector ?? "", /data-active-tab="operations"/);
  assert.match(surface.inspector ?? "", /data-inspector-panel="operations"/);
  assert.match(surface.inspector ?? "", /data-operation-id="enhanced-frame"/);
  assert.match(surface.inspector ?? "", /data-operation-id="before-after-variant"/);
  assert.match(surface.inspector ?? "", /data-operation-id="band-pass-voice"/);
  assert.match(surface.inspector ?? "", /data-operation-id="stem-separation"/);
  assert.match(
    surface.inspector ?? "",
    /data-operation-id="enhanced-frame"[\s\S]*data-active="true"/
  );
  assert.match(surface.inspector ?? "", /class="labx-settings-block"/);
  assert.match(surface.inspector ?? "", /data-lab-collapsible-panel="true"/);
  assert.match(surface.inspector ?? "", /data-panel-id="operationSettings\.enhanced-frame"/);
  assert.match(surface.inspector ?? "", /class="labx-settings-block__state"/);
  assert.match(surface.inspector ?? "", /class="labx-settings-block__action"/);
  assert.match(
    surface.inspector ?? "",
    /data-lab-field="operationSettings\.enhanced-frame\.preset"/
  );
  assert.match(surface.inspector ?? "", /data-lab-action="operation-settings-reset"/);
});

test("laboratory operation buttons reflect scoped running action state", () => {
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

test("laboratory processing overlay uses the active operation contract and locks source/timeline controls", () => {
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
  assert.match(surface.main, /data-lab-region="processing-overlay"/);
  assert.match(surface.main, /İyileştirilmiş frame hazırlanıyor/);
  assert.match(surface.main, /data-indeterminate="false" style="width: 42%"/);
  assert.match(
    surface.main,
    /data-lab-action="operation-cancel"[\s\S]*data-lab-value="enhanced-frame"/
  );
  assert.match(sourceIntake, /data-lab-action="load-source"[^>]*disabled/);
  assert.match(surface.main, /data-lab-action="timeline-toggle-playback"[^>]*disabled/);
  assert.match(surface.main, /data-lab-field="workspace\.previewVolume"[^>]*disabled/);
  assert.match(surface.main, /class="labx-icon-rail"[^>]*data-locked="true"/);
});

test("laboratory operation error buttons keep retry label short and expose message in title", () => {
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
  assert.match(html, />Retry<\/button>/);
  assert.match(html, /title="ffmpeg returned a very long diagnostic about an unsupported filter"/);
  assert.match(html, /class="labx-operation-card__action-state"/);
});

test("laboratory Turkish workspace controls localize operation and intent catalog labels", () => {
  const store = createSeededState(true);
  store.dispatch({ type: "analysis-prep-group-toggled", intentId: "audio-investigation" });
  const trCopy = createTurkishCopy();
  const surface = renderWorkspaceSurface(store.getState(), { copy: trCopy });
  const drawer = renderLabDrawer(store.getState(), surface, trCopy);

  assert.match(surface.inspector ?? "", /Klip Dışa Aktarma/);
  assert.match(surface.inspector ?? "", /Aktif zaman aralığı seçiminden bağımsız bir klip oluştur/);
  assert.match(surface.inspector ?? "", /Kare Yakalama/);
  assert.match(surface.inspector ?? "", /Çıktı: klip/);
  assert.match(surface.inspector ?? "", /Duzenle/);
  assert.match(surface.inspector ?? "", /On ayar/);
  assert.doesNotMatch(
    surface.inspector ?? "",
    /Clip Export|Frame Grab|Create a standalone clip|Capture the current video frame|>Preset<|>Apply preview</
  );
  assert.match(drawer, /Görsel inceleme/);
  assert.match(drawer, /Ses araştırması/);
  assert.match(drawer, /Görsel yapıyı, kare kompozisyonunu/);
  assert.match(drawer, /Ses sinyali/);
  assert.match(drawer, /Sinyal sagligi/);
  assert.doesNotMatch(
    drawer,
    /Visual inspection|Audio investigation|forensic markers|Audio signal|Speech evidence/
  );

  const blockedStore = createSeededState(false);
  const blockedSurface = renderWorkspaceSurface(blockedStore.getState(), { copy: trCopy });
  const blockedDrawer = renderLabDrawer(blockedStore.getState(), blockedSurface, trCopy);
  assert.match(blockedDrawer, /Gerekli araçlar kurulu değil/);
  assert.doesNotMatch(blockedDrawer, /Required tools not installed/);
});

test("laboratory analysis preparation groups default closed and expand on demand", () => {
  const store = createSeededState(true);
  const defaultGroups = getAnalysisPreparationGroups(store.getState());
  assert.ok(defaultGroups.every((group) => group.selectionState === "none"));
  assert.ok(
    defaultGroups.every((group) => group.modules.every((module) => module.enabled === false))
  );

  const closedDrawer = renderLabDrawer(store.getState(), renderWorkspaceSurface(store.getState()));
  assert.match(closedDrawer, /data-lab-action="analysis-prep-group-toggle"/);
  assert.match(closedDrawer, /aria-expanded="false"/);
  assert.doesNotMatch(closedDrawer, /class="labx-analysis-module"/);

  store.dispatch({ type: "analysis-prep-group-toggled", intentId: "audio-investigation" });
  const openDrawer = renderLabDrawer(store.getState(), renderWorkspaceSurface(store.getState()));

  assert.match(openDrawer, /data-lab-value="audio-investigation"[\s\S]*aria-expanded="true"/);
  assert.match(openDrawer, /class="labx-analysis-module"/);
  assert.match(openDrawer, /Audio signal/);
  const signalToggle = openDrawer.match(
    /<input[\s\S]*data-lab-value="audio-investigation::signal-health"[\s\S]*?\/>/
  )?.[0];
  assert.ok(signalToggle);
  assert.doesNotMatch(signalToggle, /\schecked(\s|>)/);
  assert.match(
    openDrawer,
    /data-lab-field="analysisSettings\.modules\.signal-recovery\.recoveryPreset"/
  );
  assert.match(openDrawer, /data-lab-action="analysis-settings-reset"/);
});

test("laboratory analysis preparation parent and child toggles stay synchronized", () => {
  const store = createSeededState(true);

  store.dispatch({ type: "workspace-intent-toggled", intentId: "audio-investigation" });
  let audioGroup = getAnalysisPreparationGroups(store.getState()).find(function (group) {
    return group.intentId === "audio-investigation";
  });
  assert.equal(audioGroup?.selectionState, "full");
  assert.ok(audioGroup?.modules.every((module) => module.enabled));

  store.dispatch({ type: "workspace-intent-toggled", intentId: "audio-investigation" });
  audioGroup = getAnalysisPreparationGroups(store.getState()).find(function (group) {
    return group.intentId === "audio-investigation";
  });
  assert.equal(audioGroup?.selectionState, "none");
  assert.ok(audioGroup?.modules.every((module) => !module.enabled));

  store.dispatch({
    type: "analysis-prep-module-toggled",
    intentId: "audio-investigation",
    moduleId: "signal-health",
  });
  audioGroup = getAnalysisPreparationGroups(store.getState()).find(function (group) {
    return group.intentId === "audio-investigation";
  });
  assert.equal(audioGroup?.selectionState, "partial");
  assert.equal(
    audioGroup?.modules.find((module) => module.moduleId === "signal-health")?.enabled,
    true
  );
  assert.ok(store.getState().ui.workspace.selectedIntents.includes("audio-investigation"));

  const drawer = renderLabDrawer(store.getState(), renderWorkspaceSurface(store.getState()));
  assert.match(drawer, /data-selection-state="partial"[\s\S]*data-lab-value="audio-investigation"/);
});

test("laboratory selection guidance splits expanded operation and analysis suggestions", () => {
  const store = createSeededState(true);
  store.dispatch({
    type: "workspace-timeline-updated",
    startMs: 2400,
    endMs: 5600,
  });
  store.dispatch({
    type: "workspace-selection-intent-updated",
    intent: "audio",
  });

  const surface = renderWorkspaceSurface(store.getState());

  assert.match(surface.side, /Önerilen İşlemler/);
  assert.match(surface.side, /Önerilen Analizler/);
  assert.match(surface.side, /Sesi temizle/);
  assert.match(surface.side, /Kaynaklari ayir/);
  assert.match(surface.side, /Metadata kontrolu/);
  assert.match(surface.side, /Sahne gecislerini tara/);
});

test("laboratory operation suggestions resolve expanded preview and avoid analysis rail highlight", () => {
  const store = createSeededState(true);
  store.dispatch({
    type: "workspace-timeline-updated",
    startMs: 2400,
    endMs: 5600,
  });
  store.dispatch({
    type: "workspace-selection-intent-updated",
    intent: "audio",
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

  assert.equal(getActiveSuggestionPreview(store.getState())?.suggestionId, "clean-audio");
  assert.equal(getActiveExecutionIntent(store.getState())?.flowKind, "operation-result");
  assert.match(surface.inspector ?? "", /data-active-tab="operations"/);
  assert.doesNotMatch(drawer, /data-active="true"[\s\S]*Audio signal/);
});

test("laboratory analysis suggestion acceptance opens and highlights the preparation rail", () => {
  const store = createSeededState(true);
  store.dispatch({
    type: "workspace-timeline-updated",
    startMs: 2400,
    endMs: 5600,
  });
  store.dispatch({
    type: "workspace-selection-intent-updated",
    intent: "audio",
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
  assert.match(drawer, /data-active="true"[\s\S]*Audio recovery/);
});

test("laboratory root owns mock execution dispatch outside the run controller", () => {
  const rootSource = readFileSync("rooms/laboratory/ui/lab-root.ts", "utf8");
  const runControllerSource = readFileSync(
    "rooms/laboratory/runtime/lab-run-controller.ts",
    "utf8"
  );

  assert.match(rootSource, /createLabExecutionDispatcher/);
  assert.match(rootSource, /getExecutionDispatchCandidate/);
  assert.match(rootSource, /beforeunload/);
  assert.doesNotMatch(runControllerSource, /createLabExecutionDispatcher/);
  assert.doesNotMatch(runControllerSource, /workspace-execution-dispatch/);
});

test("laboratory analysis readiness allows intent-only selection when derived capabilities are ready", () => {
  const store = createSeededState(true);
  store.dispatch({ type: "workspace-intent-set", intents: ["visual-inspection"] });

  assert.equal(getAnalysisActionBlockReason(store.getState()), null);
});

test("laboratory tool overlay lists room-local tool lifecycle actions inside the live shell", () => {
  const store = createSeededState();
  store.dispatch({ type: "tool-manager-toggled", open: true });
  const state = store.getState();
  state.snapshot = {
    ...(state.snapshot || {}),
    jobs: [
      {
        jobId: "job-yt-dlp-install",
        action: "tool-install",
        toolId: "yt-dlp",
        stage: "running",
        percent: 64,
        phaseLabel: "Arşiv indiriliyor",
        message: "Paket indiriliyor",
      },
    ],
  };
  const html = renderToolManagementOverlay(store.getState());

  assert.match(html, /Araç Yönetimi/);
  assert.match(html, /Toplu güncelle/);
  assert.match(html, /Kurulu araç/);
  assert.match(html, /Güncelleme bekleyen/);
  assert.match(html, /İşlem takibi/);
  assert.match(html, /Kurulum ve güncelleme/);
  assert.match(html, /yt-dlp[\s\S]*Kurulum/);
  assert.match(html, /Arşiv indiriliyor/);
  assert.match(html, /64%/);
  assert.match(html, /role="progressbar"/);
  assert.match(html, /yt-dlp/);
  assert.match(html, /FFmpeg/);
  assert.match(html, /data-lab-action="tool-check-updates"/);
  assert.match(html, /data-lab-action="tool-install"/);
  assert.doesNotMatch(html, /Dense operator workbench|Modules|Focus/);

  const trCopy = createTurkishCopy();
  const translatedHtml = renderToolManagementOverlay(store.getState(), trCopy);
  assert.match(translatedHtml, /İşlem takibi/);
  assert.match(translatedHtml, /Seçili niyet ve yetenek aileleri/);
  assert.match(
    translatedHtml,
    /Uzak YouTube ve oynatma listesi tabanlı içe alma akışlarını bloke eder/
  );
  assert.doesNotMatch(translatedHtml, /YouTube capture stays enabled from the source intake frame/);
});

test("laboratory workspace panels show snapshot drift as a non-blocking visibility layer", () => {
  const store = createSeededState(true);
  const eventTimestamp = Date.now();

  store.dispatch({
    type: "host-event-received",
    event: {
      id: "evt-scope",
      kind: "analysis-scope-updated",
      severity: "info",
      message: "Analysis scope locked",
      detail: null,
      timestamp: eventTimestamp,
      source: "host",
      action: "process-run",
      stage: "running",
      scope: "run",
      moduleId: null,
      rawLine: null,
      analysisScope: {
        focus: "visual",
        timeRange: {
          startMs: 1200,
          endMs: 5400,
        },
        hypothesis: "frozen clue",
        intentIds: ["visual-inspection", "anomaly-detection"],
      },
    },
  });
  store.dispatch({
    type: "host-event-received",
    event: {
      id: "evt-complete",
      kind: "activity",
      severity: "success",
      message: "Analiz tamamlandi",
      detail: null,
      timestamp: eventTimestamp + 1,
      source: "host",
      action: "process-run",
      stage: "completed",
      scope: "run",
      moduleId: null,
      rawLine: null,
    },
  });
  store.dispatch({ type: "workspace-timeline-updated", startMs: 2400, endMs: 5600 });
  store.dispatch({ type: "workspace-hypothesis-updated", text: "live workspace clue" });
  store.dispatch({ type: "workspace-intent-set", intents: ["visual-inspection"] });

  store.dispatch({
    type: "host-event-received",
    event: {
      id: "evt-motion",
      kind: "activity",
      severity: "info",
      message: "Motion analysis running",
      detail: "Motion analysis running",
      timestamp: eventTimestamp + 2,
      source: "host",
      action: "process-run",
      stage: "running",
      scope: "run",
      moduleId: "motion-anomaly",
      rawLine: null,
    },
  });
  store.dispatch({
    type: "host-event-received",
    event: {
      id: "evt-visual",
      kind: "activity",
      severity: "error",
      message: "Visual signal failed",
      detail: "Visual signal failed",
      timestamp: eventTimestamp + 3,
      source: "host",
      action: "process-run",
      stage: "failed",
      scope: "run",
      moduleId: "frame-consistency",
      rawLine: null,
    },
  });
  store.dispatch({
    type: "host-event-received",
    event: {
      id: "evt-audio",
      kind: "activity",
      severity: "info",
      message: "Audio queued",
      detail: "Audio queued",
      timestamp: eventTimestamp + 4,
      source: "host",
      action: "process-run",
      stage: "queued",
      scope: "run",
      moduleId: "audio",
      rawLine: null,
    },
  });

  const state = store.getState();
  const surface = renderWorkspaceSurface(state);
  const drawer = renderLabDrawer(state, surface);
  const strip = renderLabProcessStrip(state);

  assert.match(drawer, /Analysis Progress/);
  assert.match(drawer, /class="labx-drawer labx-context-panel" data-lab-region="context-panel"/);
  assert.match(drawer, /data-lab-running-plan="true"/);
  assert.match(drawer, /Motion Anomaly/);
  assert.match(drawer, /Frame Consistency/);
  assert.match(drawer, /data-status="running"/);
  assert.doesNotMatch(drawer, /Pipeline/);
  assert.doesNotMatch(drawer, /Audio investigation/);
  assert.match(strip, /class="labx-process-strip"/);
  assert.match(strip, /data-lab-region="process-strip"/);
  assert.doesNotMatch(drawer, /run-intent-analysis/);
});

test("laboratory transparency renderers tolerate sparse run payloads", () => {
  const store = createSeededState(true);
  const state = store.getState() as ReturnType<typeof store.getState> & {
    run: Record<string, unknown>;
    reports: Record<string, unknown>;
  };

  const sparseRunPayload = {
    id: undefined,
    state: "completed",
    startedAt: Date.now() - 1000,
    modules: {},
    moduleOrder: [],
    events: undefined,
    rawLog: undefined,
    artifacts: [],
    findings: [],
    liveFindings: undefined,
    warnings: [],
    error: null,
    targetLabel: null,
    progress: 100,
    emptyReason: null,
    analysisScope: {
      focus: "visual",
      intentIds: ["visual-inspection"],
    },
    previewArtifacts: undefined,
    confidence: null,
    moduleTrace: undefined,
    comparisonVariants: undefined,
    hypothesisSummary: null,
  };
  state.run = sparseRunPayload as unknown as typeof state.run;
  state.reports = {
    user: null,
    ai: {
      manifest: {},
      findings: [],
      artifacts: [],
      warnings: [],
      errors: [],
      degradedConditions: [],
      moduleTrace: undefined,
      analysisScope: sparseRunPayload.analysisScope,
      comparisonVariants: [],
    },
    emptyReason: null,
  } as unknown as typeof state.reports;
  state.ui.workspace.reportOverlayOpen = true;

  assert.doesNotThrow(function () {
    renderReportOverlay(state);
  });
});

test("laboratory process strip renders recent action history from user actions", () => {
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

test("laboratory process strip renders multi-output action summaries with overflow counts", () => {
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

test("laboratory source panel renders registry groups and local asset actions only", () => {
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
  assert.match(panelHtml, /data-lab-action="open-report-overlay" data-lab-value="report-1"/);
  assert.match(panelHtml, /data-lab-action="asset-download"/);
  assert.match(panelHtml, /data-lab-action="asset-remove"/);
  assert.match(panelHtml, /data-lab-action="asset-use-as-source" data-lab-value="clip-local-1"/);
  assert.match(
    panelHtml,
    /data-lab-action="asset-use-as-source" data-lab-value="artifact-png-1"/
  );
  assert.doesNotMatch(
    panelHtml,
    /data-lab-action="asset-use-as-source" data-lab-value="clip-remote-1"/
  );
});

test("laboratory source panel uses png artifacts as sources from the primary click", () => {
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
    /data-lab-action="asset-use-as-source" data-lab-value="artifact-png-1"/
  );
  assert.doesNotMatch(
    panelHtml,
    /class="labx-sp-asset__btn"[^>]*data-lab-action="asset-preview"[^>]*data-lab-value="artifact-png-1"/
  );
});

test("laboratory source panel keeps asset order stable when active source timestamps change", () => {
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

test("laboratory source panel uses png artifacts as sources from the primary click path", () => {
  const store = createSeededState(true);
  store.dispatch({
    type: "asset-added",
    asset: {
      id: "artifact-png-primary",
      type: "artifact",
      name: "artifact-primary.png",
      localPath: "/tmp/artifact-primary.png",
      createdAt: 500,
      runId: "run-1",
    },
  });

  const panelHtml = renderLabSourcePanel(store.getState());

  assert.match(
    panelHtml,
    /class="labx-sp-asset__btn"[\s\S]*data-lab-action="asset-use-as-source"[\s\S]*data-lab-value="artifact-png-primary"/
  );
});

test("laboratory asset preview overlay renders selected video and audio assets in-app", () => {
  const store = createLabStore();
  store.dispatch({
    type: "asset-added",
    asset: {
      id: "asset-video-preview",
      type: "source",
      name: "CGI Analizi -1.mp4",
      localPath: "/tmp/CGI Analizi -1.mp4",
      createdAt: Date.now(),
      metadata: {
        durationSeconds: 32,
        sizeBytes: 2900000,
      },
    },
  });
  store.dispatch({
    type: "asset-added",
    asset: {
      id: "asset-audio-preview",
      type: "audio",
      name: "audio-track.wav",
      localPath: "/tmp/audio-track.wav",
      createdAt: Date.now(),
    },
  });

  store.dispatch({ type: "asset-preview-opened", assetId: "asset-video-preview" });
  const videoOverlay = renderLabAssetPreviewOverlay(store.getState());
  assert.match(videoOverlay, /id="lab-asset-preview-overlay-root"/);
  assert.match(videoOverlay, /data-open="true"/);
  assert.match(
    videoOverlay,
    /<video class="labx-asset-preview__media labx-asset-preview__media--video"/
  );
  assert.match(videoOverlay, /src="file:\/\/\/tmp\/CGI%20Analizi%20-1\.mp4"/);

  store.dispatch({ type: "asset-preview-opened", assetId: "asset-audio-preview" });
  const audioOverlay = renderLabAssetPreviewOverlay(store.getState());
  assert.match(audioOverlay, /class="labx-asset-preview__audio-shell"/);
  assert.match(audioOverlay, /<audio class="labx-asset-preview__audio-control"/);
  assert.match(audioOverlay, /src="file:\/\/\/tmp\/audio-track\.wav"/);

  store.dispatch({ type: "asset-preview-closed" });
  assert.match(renderLabAssetPreviewOverlay(store.getState()), /data-open="false"/);
});

test("laboratory report overlay renders snapshot summary and workspace-dirty freshness metadata", () => {
  const store = createLabStore();
  const baseWorkspace = store.getState().ui.workspace;

  store.dispatch({
    type: "hydrate",
    payload: {
      featureId: "media-analysis",
      projectIndex: {
        activeProjectId: "project-1",
        projects: [],
      },
      workbench: {},
      sourceProbeStatus: "completed",
      reports: {
        user: {
          summary: "Report summary",
          confidence: "medium",
          topFindings: [],
          suspiciousFrames: [],
          hypothesisResult: "frozen clue",
          elapsedSeconds: 5,
          moduleSummary: [],
        },
        ai: null,
        emptyReason: null,
      },
      reportView: "user",
      workspace: {
        ...baseWorkspace,
        reportOverlayOpen: true,
        timelineStartMs: 2400,
        timelineEndMs: 5600,
        hypothesis: "live workspace clue",
        selectedIntents: ["visual-inspection"],
      },
      lastRun: {
        id: "run-1",
        state: "completed",
        startedAt: Date.now() - 5000,
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
        analysisScope: {
          focus: "visual",
          timeRange: {
            startMs: 1200,
            endMs: 5400,
          },
          hypothesis: "frozen clue",
          intentIds: ["visual-inspection", "anomaly-detection"],
        },
        previewArtifacts: [],
        confidence: "medium",
        moduleTrace: [],
        comparisonVariants: [],
        hypothesisSummary: "frozen clue",
      },
    },
  });

  const html = renderReportOverlay(store.getState());

  assert.match(html, /Snapshot Summary/);
  assert.match(html, /Intent Groups/);
  assert.match(html, /data-workspace-dirty="true"/);
  assert.match(html, /Workspace farklı/);
  assert.match(html, /Report still reflects the frozen snapshot/);
  assert.match(html, /Visual inspection, Anomaly detection/);

  const translatedHtml = renderReportOverlay(store.getState(), createTurkishCopy());
  assert.match(translatedHtml, /Niyet Grupları/);
  assert.match(translatedHtml, /Görsel inceleme, Anomali tespiti/);
  assert.doesNotMatch(translatedHtml, /Intent Groups|Visual inspection|Anomaly detection/);
});

test("laboratory report overlay keeps scoped report-level findings inside the active intent group", () => {
  const store = createLabStore();
  const baseWorkspace = store.getState().ui.workspace;

  store.dispatch({
    type: "hydrate",
    payload: {
      featureId: "media-analysis",
      projectIndex: {
        activeProjectId: "project-1",
        projects: [],
      },
      workbench: {},
      sourceProbeStatus: "completed",
      reports: {
        user: {
          summary: "Scoped report summary",
          confidence: "low",
          topFindings: [],
          suspiciousFrames: [],
          hypothesisResult: null,
          elapsedSeconds: 3,
          moduleSummary: [],
        },
        ai: null,
        emptyReason: null,
      },
      reportView: "user",
      workspace: {
        ...baseWorkspace,
        reportOverlayOpen: true,
        selectedIntents: ["visual-inspection"],
      },
      lastRun: {
        id: "run-intent-scoped",
        state: "completed",
        startedAt: Date.now() - 4000,
        endedAt: Date.now() - 1000,
        modules: {},
        moduleOrder: [],
        events: [],
        rawLog: [],
        artifacts: [
          {
            id: "artifact-report-1",
            moduleId: null,
            kind: "report-summary",
            path: "/tmp/report-summary.json",
            fileName: "report-summary.json",
            previewUrl: null,
            createdAt: new Date().toISOString(),
          },
        ],
        findings: [
          {
            id: "finding-report-1",
            moduleId: "report",
            title: "Belirgin anomali tespit edilmedi",
            detail: "Scoped run completed without a mapped module finding.",
            level: "low",
            confidence: "low",
            kind: "derived",
            evidenceCount: 0,
            artifactIds: ["artifact-report-1"],
          },
        ],
        liveFindings: [],
        warnings: [],
        error: null,
        targetLabel: null,
        progress: 100,
        emptyReason: null,
        analysisScope: {
          focus: "visual",
          intentIds: ["visual-inspection"],
        },
        previewArtifacts: [],
        confidence: "low",
        moduleTrace: [],
        comparisonVariants: [],
        hypothesisSummary: null,
      },
    },
  });

  const html = renderReportOverlay(store.getState());

  assert.match(html, /Intent Groups/);
  assert.match(html, /Visual inspection/);
  assert.match(html, /Belirgin anomali tespit edilmedi/);
  assert.match(html, /report-summary\.json/);
  assert.doesNotMatch(html, /No findings mapped to this intent\./);
});

test("laboratory report overlay groups transport-module evidence into selected intent buckets", () => {
  const store = createLabStore();
  const baseWorkspace = store.getState().ui.workspace;

  store.dispatch({
    type: "hydrate",
    payload: {
      featureId: "media-analysis",
      projectIndex: {
        activeProjectId: "project-1",
        projects: [],
      },
      workbench: {},
      sourceProbeStatus: "completed",
      reports: {
        user: {
          summary: "Transport module report",
          confidence: "medium",
          topFindings: [],
          suspiciousFrames: [],
          hypothesisResult: null,
          elapsedSeconds: 4,
          moduleSummary: [],
        },
        ai: null,
        emptyReason: null,
      },
      reportView: "user",
      workspace: {
        ...baseWorkspace,
        reportOverlayOpen: true,
        selectedIntents: ["visual-inspection", "anomaly-detection"],
      },
      lastRun: {
        id: "run-transport-groups",
        state: "completed",
        startedAt: Date.now() - 4000,
        endedAt: Date.now() - 1000,
        modules: {
          motion: {
            id: "motion",
            title: "motion",
            status: "completed",
          },
          "visual-signal": {
            id: "visual-signal",
            title: "visual-signal",
            status: "completed",
          },
          audio: {
            id: "audio",
            title: "audio",
            status: "completed",
          },
        },
        moduleOrder: ["motion", "visual-signal", "audio"],
        events: [],
        rawLog: [],
        artifacts: [
          {
            id: "artifact-motion",
            moduleId: "motion",
            kind: "frame-preview",
            path: "/tmp/motion.png",
            fileName: "motion.png",
            previewUrl: null,
            createdAt: new Date().toISOString(),
            metadata: {
              sourceModule: "motion-anomaly",
            },
          },
          {
            id: "artifact-visual",
            moduleId: "visual-signal",
            kind: "reveal-preview",
            path: "/tmp/reveal.png",
            fileName: "reveal.png",
            previewUrl: null,
            createdAt: new Date().toISOString(),
            metadata: {
              sourceModule: "visual-signal-amplification",
            },
          },
          {
            id: "artifact-audio",
            moduleId: "audio",
            kind: "spectrogram",
            path: "/tmp/audio.png",
            fileName: "audio.png",
            previewUrl: null,
            createdAt: new Date().toISOString(),
          },
        ],
        findings: [
          {
            id: "finding-motion",
            moduleId: "motion",
            sourceModule: "motion-anomaly",
            title: "Motion spike",
            detail: "Movement anomaly detected",
            level: "medium",
            confidence: "medium",
            kind: "derived",
            evidenceCount: 2,
            artifactIds: ["artifact-motion"],
          },
          {
            id: "finding-visual",
            moduleId: "visual-signal",
            sourceModule: "visual-signal-amplification",
            title: "Reveal variant",
            detail: "Forensic reveal variant surfaced a suspicious edge",
            level: "medium",
            confidence: "medium",
            kind: "derived",
            evidenceCount: 1,
            artifactIds: ["artifact-visual"],
          },
          {
            id: "finding-audio",
            moduleId: "audio",
            title: "Audio anomaly",
            detail: "Silence pockets detected during the sweep",
            level: "low",
            confidence: "low",
            kind: "derived",
            evidenceCount: 1,
            artifactIds: ["artifact-audio"],
          },
        ],
        liveFindings: [],
        warnings: [],
        error: null,
        targetLabel: null,
        progress: 100,
        emptyReason: null,
        analysisScope: {
          focus: "visual",
          intentIds: ["visual-inspection", "anomaly-detection"],
        },
        previewArtifacts: [],
        confidence: "medium",
        moduleTrace: [],
        comparisonVariants: [],
        hypothesisSummary: null,
      },
    },
  });

  const html = renderReportOverlay(store.getState());

  assert.match(html, /Visual inspection/);
  assert.match(html, /Anomaly detection/);
  assert.match(html, /Motion spike/);
  assert.match(html, /Reveal variant/);
  assert.match(html, /Audio anomaly/);
  assert.doesNotMatch(html, /No findings mapped to this intent\./);
});

test("laboratory report overlay fans audio transport evidence across every matching audio intent bucket", () => {
  const store = createLabStore();
  const baseWorkspace = store.getState().ui.workspace;

  store.dispatch({
    type: "hydrate",
    payload: {
      featureId: "media-analysis",
      projectIndex: {
        activeProjectId: "project-1",
        projects: [],
      },
      workbench: {},
      sourceProbeStatus: "completed",
      reports: {
        user: {
          summary: "Audio transport report",
          confidence: "medium",
          topFindings: [],
          suspiciousFrames: [],
          hypothesisResult: null,
          elapsedSeconds: 4,
          moduleSummary: [],
        },
        ai: null,
        emptyReason: null,
      },
      reportView: "user",
      workspace: {
        ...baseWorkspace,
        reportOverlayOpen: true,
        selectedIntents: ["audio-investigation", "detail-enhancement", "anomaly-detection"],
      },
      lastRun: {
        id: "run-audio-transport-groups",
        state: "completed",
        startedAt: Date.now() - 4000,
        endedAt: Date.now() - 1000,
        modules: {
          audio: {
            id: "audio",
            title: "audio",
            status: "completed",
          },
        },
        moduleOrder: ["audio"],
        events: [],
        rawLog: [],
        artifacts: [
          {
            id: "artifact-audio",
            moduleId: "audio",
            kind: "spectrogram",
            path: "/tmp/audio.png",
            fileName: "audio.png",
            previewUrl: null,
            createdAt: new Date().toISOString(),
          },
        ],
        findings: [
          {
            id: "finding-audio",
            moduleId: "audio",
            title: "Audio anomaly",
            detail: "Silence pockets detected during the sweep",
            level: "low",
            confidence: "low",
            kind: "derived",
            evidenceCount: 1,
            artifactIds: ["artifact-audio"],
          },
        ],
        liveFindings: [],
        warnings: [],
        error: null,
        targetLabel: null,
        progress: 100,
        emptyReason: null,
        analysisScope: {
          focus: "audio",
          intentIds: ["audio-investigation", "detail-enhancement", "anomaly-detection"],
        },
        previewArtifacts: [],
        confidence: "medium",
        moduleTrace: [],
        comparisonVariants: [],
        hypothesisSummary: null,
      },
    },
  });

  const html = renderReportOverlay(store.getState());

  assert.match(html, /Audio investigation/);
  assert.match(html, /Detail enhancement/);
  assert.match(html, /Anomaly detection/);
  assert.equal((html.match(/Audio anomaly/g) || []).length, 3);
  assert.doesNotMatch(html, /No findings mapped to this intent\./);
});

test("laboratory store applies optimistic source and workbench patches for source controls", () => {
  const store = createSeededState();
  store.dispatch({
    type: "source-config-patched",
    patch: {
      kind: "audio",
      mode: "url",
    },
  });
  store.dispatch({
    type: "workbench-updated",
    workbench: {
      activeModuleId: "audio-analysis",
      availableModuleIds: ["media-analysis", "audio-analysis"],
      selectedModuleIds: ["media-analysis", "audio-analysis"],
    },
  });
  store.dispatch({ type: "tool-manager-toggled", open: true });

  const state = store.getState();
  assert.equal(state.source?.["kind"], "audio");
  assert.equal(state.source?.["mode"], "url");
  assert.equal(state.workbench["activeModuleId"], "audio-analysis");
  assert.equal(state.ui.toolManagerOpen, true);
});
