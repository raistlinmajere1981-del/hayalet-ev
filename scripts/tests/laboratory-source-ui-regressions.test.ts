import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

import {
  getActiveExecutionCandidate,
  getExecutionDispatchCandidate,
  getAnalysisActionBlockReason,
} from "../../rooms/laboratory/runtime/lab-selectors.ts";
import { createMockExecutionResult } from "../../rooms/laboratory/runtime/lab-execution-dispatcher.ts";
import { createLabStore } from "../../rooms/laboratory/runtime/lab-store.ts";
import { renderLabAssetPreviewOverlay } from "../../rooms/laboratory/ui/lab-asset-preview-overlay.ts";
import { renderLabLeftRail } from "../../rooms/laboratory/ui/lab-left-rail.ts";
import { renderLabProjectAssetsPanel } from "../../rooms/laboratory/ui/lab-project-assets-panel.ts";
import { createLabI18n } from "../../rooms/laboratory/ui/lab-i18n.ts";
import { renderReportOverlay } from "../../rooms/laboratory/ui/report-overlay.ts";
import { renderToolManagementOverlay } from "../../rooms/laboratory/ui/tool-management-overlay.ts";
import { renderWorkspaceProcessPanel } from "../../rooms/laboratory/ui/workspace-process-panel.ts";
import { renderWorkspaceSurface } from "../../rooms/laboratory/ui/workspace-surface.ts";

const sourcePresets = JSON.parse(
  readFileSync("rooms/laboratory/shared/data/tools/source-presets.json", "utf8")
);
const ytDlpForm = JSON.parse(
  readFileSync("rooms/laboratory/shared/data/tools/yt-dlp.form.json", "utf8")
);

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
            fileNameHint: "lab-demo.mp4",
            urlInput: "",
            youtubeUrl: "",
            youtubePreset: "medium",
            youtubeCustom: {},
          },
          metadata: {
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
        availableModuleIds: ["media-analysis", "audio-analysis", "subtitle-analysis"],
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
          usedBy: ["subtitle-analysis"],
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

test("laboratory left rail reflects the active workspace shell navigation", () => {
  const store = createSeededState();
  store.dispatch({ type: "tool-manager-toggled", open: true });
  const html = renderLabLeftRail(store.getState());

  assert.match(html, /Laboratory/);
  assert.match(html, /Media workspace/);
  assert.match(html, /Project Assets/);
  assert.match(html, /Tool Management/);
  assert.match(html, /INTENTS/);
  assert.match(html, /Save/);
  assert.match(html, /Delete/);
  assert.doesNotMatch(html, /Modül Yönetimi|Seçili Modüller|Yoğun operatör tezgahı/);
});

test("laboratory workspace surface renders source intake, preview media, and deep-analysis CTA", () => {
  const surface = renderWorkspaceSurface(createSeededState().getState());

  assert.match(surface.main, /Source setup controls/);
  assert.match(surface.main, /Active: lab-demo\.mp4/);
  assert.match(surface.main, /lab-demo\.mp4/);
  assert.match(
    surface.main,
    /<video class="labx-preview-media labx-preview-media--workspace-video"/
  );
  assert.match(surface.main, /data-lab-action="workspace-toggle-source-intake"/);
  assert.match(surface.side, /Analizi Başlat/);
  assert.match(surface.side, /Raporu Görüntüle/);
  assert.doesNotMatch(surface.main, /Kaynak Seçimi|Hızlı modül seçimi burada yapılır/);
});

test("laboratory workspace treats reused local assets as ready sources", () => {
  const store = createSeededState();
  store.dispatch({
    type: "source-config-patched",
    patch: {
      routeLabel: "Asset reuse",
    },
  });

  const surface = renderWorkspaceSurface(store.getState());

  assert.match(surface.main, /Source ready/);
  assert.match(surface.main, /Active: lab-demo\.mp4/);
  assert.match(
    surface.main,
    /<video class="labx-preview-media labx-preview-media--workspace-video"/
  );
  assert.doesNotMatch(surface.main, /Awaiting source|Select a source to begin/);
});

test("laboratory workspace surface previews intent outcomes before the analysis CTA", () => {
  const store = createSeededState(true);

  let surface = renderWorkspaceSurface(store.getState());
  assert.match(surface.side, /Bu analiz şunları yapacak:/);
  assert.match(surface.side, /Analiz için intent seçin/);

  store.dispatch({
    type: "workspace-intent-set",
    intents: ["visual-inspection", "anomaly-detection"],
  });

  surface = renderWorkspaceSurface(store.getState());
  assert.match(surface.side, /Görsel yapı ve anomaliler analiz edilir/);
  assert.match(surface.side, /Olası anormallikler tespit edilir/);
  assert.match(surface.side, /Beklenen çıktılar:/);
  assert.match(surface.side, /Nesne tespiti/);
  assert.match(surface.side, /Öneriler/);
});

test("laboratory process panel previews intent execution before the first run", () => {
  const store = createSeededState(true);
  store.dispatch({
    type: "workspace-intent-set",
    intents: ["visual-inspection", "anomaly-detection"],
  });

  const html = renderWorkspaceProcessPanel(store.getState(), { sourceReady: true });

  assert.match(html, /Intent → Execution Map/);
  assert.match(html, /Henüz yürütme yok/);
  assert.match(html, /Visual inspection/);
  assert.match(html, /Anomaly detection/);
  assert.match(html, /Visual Structure/);
  assert.match(html, /Bekliyor/);
});

test("laboratory process panel shows minimal execution runtime state without controls", () => {
  const store = createSeededState(true);
  const state = store.getState();

  state.ui.executionRuntime = {
    status: "running",
    activePlanId: "plan:audio-inspect",
    dispatchId: "dispatch:test",
    progress: 25,
  };
  const runningHtml = renderWorkspaceProcessPanel(state, { sourceReady: true });
  assert.match(runningHtml, /class="labx-execution-runtime"/);
  assert.match(runningHtml, /Executing plan/);
  assert.match(runningHtml, /data-progress="25"/);
  const indicatorStart = runningHtml.indexOf('class="labx-execution-runtime"');
  const indicatorEnd = runningHtml.indexOf("</div>", indicatorStart);
  const indicatorHtml = runningHtml.slice(indicatorStart, indicatorEnd);
  assert.doesNotMatch(indicatorHtml, /<button/);

  state.ui.executionRuntime = {
    status: "completed",
    activePlanId: "plan:audio-inspect",
    dispatchId: "dispatch:test",
    progress: 100,
    result: {
      summary: "Mock execution completed for plan:audio-inspect.",
      insights: [],
      artifacts: [],
      metrics: {},
    },
  };
  const completedHtml = renderWorkspaceProcessPanel(state, { sourceReady: true });
  assert.match(completedHtml, /Execution complete/);
  assert.match(completedHtml, /data-progress="100"/);
});

test("laboratory process panel renders materialized execution insights and elements", () => {
  const store = createSeededState(true);
  store.dispatch({
    type: "workspace-timeline-updated",
    startMs: 1000,
    endMs: 3000,
  });
  store.dispatch({
    type: "workspace-selection-intent-updated",
    intent: "audio",
  });
  store.dispatch({
    type: "workspace-selection-suggestion-preview-set",
    suggestionId: "audio-inspect",
  });
  store.dispatch({
    type: "workspace-selection-suggestion-accepted",
    suggestionId: "audio-inspect",
  });
  const activeCandidate = getActiveExecutionCandidate(store.getState());
  assert.ok(activeCandidate);
  store.dispatch({
    type: "workspace-execution-commitment-set",
    planId: activeCandidate.planId,
  });
  const dispatchCandidate = getExecutionDispatchCandidate(store.getState());
  assert.ok(dispatchCandidate);
  store.dispatch({
    type: "workspace-execution-dispatch",
    planId: dispatchCandidate.planId,
    dispatchId: dispatchCandidate.dispatchId,
  });
  store.dispatch({
    type: "workspace-execution-completed",
    planId: dispatchCandidate.planId,
    dispatchId: dispatchCandidate.dispatchId,
    result: createMockExecutionResult(dispatchCandidate),
  });

  const html = renderWorkspaceProcessPanel(store.getState(), { sourceReady: true });

  assert.match(html, /Insights/);
  assert.match(html, /Frequency cluster detected/);
  assert.match(html, /Detected elements/);
  assert.match(html, /Frequency cluster marker/);
  assert.match(html, /Outcome evaluated/);
  assert.match(html, /Goal evaluation: Audio goal remains inconclusive for the current result/);
  assert.doesNotMatch(html, /data-lab-action="execution/);
});

test("laboratory process panel resolves evaluated outcome copy in Turkish", () => {
  const store = createSeededState(true);
  store.dispatch({
    type: "workspace-timeline-updated",
    startMs: 1000,
    endMs: 3000,
  });
  store.dispatch({
    type: "workspace-selection-intent-updated",
    intent: "audio",
  });
  store.dispatch({
    type: "workspace-selection-suggestion-preview-set",
    suggestionId: "audio-inspect",
  });
  store.dispatch({
    type: "workspace-selection-suggestion-accepted",
    suggestionId: "audio-inspect",
  });
  const activeCandidate = getActiveExecutionCandidate(store.getState());
  assert.ok(activeCandidate);
  store.dispatch({
    type: "workspace-execution-commitment-set",
    planId: activeCandidate.planId,
  });
  const dispatchCandidate = getExecutionDispatchCandidate(store.getState());
  assert.ok(dispatchCandidate);
  store.dispatch({
    type: "workspace-execution-dispatch",
    planId: dispatchCandidate.planId,
    dispatchId: dispatchCandidate.dispatchId,
  });
  store.dispatch({
    type: "workspace-execution-completed",
    planId: dispatchCandidate.planId,
    dispatchId: dispatchCandidate.dispatchId,
    result: createMockExecutionResult(dispatchCandidate),
  });

  const tr = createLabI18n({
    locale: "tr",
    translations: JSON.parse(readFileSync("rooms/laboratory/i18n/tr.json", "utf8")),
  });
  const html = renderWorkspaceProcessPanel(store.getState(), { sourceReady: true, copy: tr });

  assert.match(html, /Sonuç değerlendirildi/);
  assert.match(html, /Hedef değerlendirmesi: Audio goal remains inconclusive for the current result/);
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

test("laboratory process panel keeps the intent map visible when a run has no frozen scope snapshot", () => {
  const store = createSeededState(true);
  store.dispatch({
    type: "workspace-intent-set",
    intents: ["visual-inspection"],
  });

  const state = store.getState() as ReturnType<typeof store.getState> & {
    run: Record<string, unknown>;
  };
  state.run = {
    id: "run-live-fallback",
    state: "running",
    startedAt: Date.now() - 2000,
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
    progress: 10,
    emptyReason: null,
    analysisScope: null,
    previewArtifacts: [],
    confidence: null,
    moduleTrace: [],
    comparisonVariants: [],
    hypothesisSummary: null,
  };

  const html = renderWorkspaceProcessPanel(state, { sourceReady: true });

  assert.match(html, /Intent → Execution Map/);
  assert.match(html, /Visual inspection/);
});

test("laboratory process panel renders intent output trace from project assets", () => {
  const store = createSeededState(true);
  store.dispatch({
    type: "asset-added",
    asset: {
      id: "asset-frame-visual",
      type: "frame",
      name: "frame_01.png",
      localPath: "/tmp/frame_01.png",
      createdAt: 200,
      sourceId: "source-1",
      runId: "run-output-trace",
      intentIds: ["visual-inspection"],
    },
  });

  const state = store.getState() as ReturnType<typeof store.getState> & {
    run: Record<string, unknown>;
  };
  state.ui.workspace.selectedIntents = ["anomaly-detection"];
  state.run = {
    id: "run-output-trace",
    state: "completed",
    startedAt: Date.now() - 2000,
    endedAt: Date.now() - 500,
    modules: {
      motion: {
        id: "motion",
        title: "Motion Analysis",
        status: "completed",
      },
    },
    moduleOrder: ["motion"],
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
      intentIds: ["visual-inspection", "audio-investigation", "detail-enhancement"],
    },
    previewArtifacts: [],
    confidence: "medium",
    moduleTrace: [],
    comparisonVariants: [],
    hypothesisSummary: null,
  };

  const html = renderWorkspaceProcessPanel(state, { sourceReady: true });

  assert.match(html, /INTENT OUTPUT TRACE/);
  assert.match(html, /Frame outputs/);
  assert.match(html, /Anomaly data/);
  assert.match(html, /frame_01\.png/);
  assert.match(html, /data-matched="true"/);
  assert.match(html, /data-matched="false"/);
  assert.match(html, /Bu intent herhangi bir çıktı üretmedi/);
  assert.match(html, /Bu intent için beklenen çıktı tanımı yok/);
  assert.ok(html.indexOf("INTENT OUTPUT TRACE") < html.indexOf("Pipeline"));
});

test("laboratory process panel output trace keeps frozen intent snapshot during live drift", () => {
  const store = createSeededState(true);
  store.dispatch({
    type: "workspace-intent-set",
    intents: ["audio-investigation"],
  });
  store.dispatch({
    type: "asset-added",
    asset: {
      id: "asset-audio-live",
      type: "audio",
      name: "live_audio.wav",
      localPath: "/tmp/live_audio.wav",
      createdAt: 200,
      sourceId: "source-1",
      runId: "run-frozen-trace",
      intentIds: ["audio-investigation"],
    },
  });

  const state = store.getState() as ReturnType<typeof store.getState> & {
    run: Record<string, unknown>;
  };
  state.run = {
    id: "run-frozen-trace",
    state: "running",
    startedAt: Date.now() - 2000,
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
    progress: 20,
    emptyReason: null,
    analysisScope: {
      focus: "visual",
      intentIds: ["visual-inspection"],
    },
    previewArtifacts: [],
    confidence: null,
    moduleTrace: [],
    comparisonVariants: [],
    hypothesisSummary: null,
  };

  const html = renderWorkspaceProcessPanel(state, { sourceReady: true });

  assert.match(html, /INTENT OUTPUT TRACE/);
  assert.match(html, /Visual inspection/);
  assert.doesNotMatch(html, /Audio investigation/);
  assert.doesNotMatch(html, /live_audio\.wav/);
});

test("laboratory process panel trace keeps unknown frozen intent ids visible as unmapped observations", () => {
  const store = createSeededState(true);
  const state = store.getState() as ReturnType<typeof store.getState> & {
    run: Record<string, unknown>;
  };

  state.run = {
    id: "run-unknown-intent",
    state: "completed",
    startedAt: Date.now() - 2000,
    endedAt: Date.now() - 500,
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
      intentIds: ["future-intent"],
    },
    previewArtifacts: [],
    confidence: null,
    moduleTrace: [],
    comparisonVariants: [],
    hypothesisSummary: null,
  };

  const html = renderWorkspaceProcessPanel(state, { sourceReady: true });

  assert.match(html, /INTENT OUTPUT TRACE/);
  assert.match(html, /future-intent/);
  assert.match(html, /Bu intent için beklenen çıktı tanımı yok/);
});

test("laboratory analysis readiness allows intent-only selection when derived capabilities are ready", () => {
  const store = createSeededState(true);
  store.dispatch({ type: "workspace-intent-set", intents: ["visual-inspection"] });

  assert.equal(getAnalysisActionBlockReason(store.getState()), null);
});

test("laboratory tool overlay lists room-local tool lifecycle actions inside the live shell", () => {
  const store = createSeededState();
  store.dispatch({ type: "tool-manager-toggled", open: true });
  const html = renderToolManagementOverlay(store.getState());

  assert.match(html, /Araç Yönetimi/);
  assert.match(html, /Toplu güncelle/);
  assert.match(html, /Kurulu araç/);
  assert.match(html, /Güncelleme bekleyen/);
  assert.match(html, /yt-dlp/);
  assert.match(html, /FFmpeg/);
  assert.match(html, /data-lab-action="tool-check-updates"/);
  assert.match(html, /data-lab-action="tool-install"/);
  assert.doesNotMatch(html, /Dense operator workbench|Modules|Focus/);

  const trCopy = createLabI18n({
    locale: "tr",
    translations: JSON.parse(readFileSync("rooms/laboratory/i18n/tr.json", "utf8")),
  });
  const translatedHtml = renderToolManagementOverlay(store.getState(), trCopy);
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
      moduleId: "motion",
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
      moduleId: "visual-signal",
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
  const processPanel = renderWorkspaceProcessPanel(state, { sourceReady: true });

  assert.match(processPanel, /Run Snapshot/);
  assert.match(processPanel, /Visual inspection/);
  assert.match(processPanel, /Anomaly detection/);
  assert.match(processPanel, /Intent → Execution Map/);
  assert.match(processPanel, /Çalışan modül: motion/);
  assert.match(processPanel, /Tamamlanamadı/);
  assert.match(processPanel, /Bu modül çalışmadı, diğerleri devam ediyor/);
  assert.match(processPanel, /Bekliyor/);
  assert.match(processPanel, /Live workspace changed in Timeline, Hypothesis, Intents/);
  assert.match(processPanel, /Visual inspection, Anomaly detection/);
  assert.match(surface.side, /Analizi İptal Et/);
  assert.doesNotMatch(surface.side, /run-intent-analysis/);
});

test("laboratory process panel prefers preserved transport module metadata and fans audio transport across audio capabilities", () => {
  const store = createSeededState(true);
  const state = store.getState() as ReturnType<typeof store.getState> & {
    run: Record<string, unknown>;
  };

  state.run = {
    id: "run-transport-metadata",
    state: "running",
    startedAt: Date.now() - 2000,
    modules: {
      motion: {
        id: "motion",
        title: "Motion Analysis",
        status: "running",
        metadata: {
          moduleIds: ["frame-consistency", "motion-anomaly"],
        },
      },
      "visual-signal": {
        id: "visual-signal",
        title: "Visual Signal Amplification",
        status: "failed",
        metadata: {
          moduleIds: ["visual-signal-amplification", "hidden-detail-reveal"],
        },
      },
      audio: {
        id: "audio",
        title: "Audio Sweep",
        status: "queued",
      },
    },
    moduleOrder: ["motion", "visual-signal", "audio"],
    events: [],
    rawLog: [],
    artifacts: [],
    findings: [],
    liveFindings: [],
    warnings: [],
    error: null,
    targetLabel: null,
    progress: 25,
    emptyReason: null,
    analysisScope: {
      focus: "visual",
      intentIds: [
        "visual-inspection",
        "audio-investigation",
        "detail-enhancement",
        "anomaly-detection",
      ],
    },
    previewArtifacts: [],
    confidence: null,
    moduleTrace: [],
    comparisonVariants: [],
    hypothesisSummary: null,
  };

  const html = renderWorkspaceProcessPanel(state, { sourceReady: true });

  assert.match(html, /frame-consistency/);
  assert.match(html, /visual-signal-amplification/);
  assert.match(html, /Audio Signal/);
  assert.match(html, /Speaker Analysis/);
  assert.match(html, /Source Separation/);
  assert.ok((html.match(/Audio Sweep/g) || []).length >= 4);
});

test("laboratory process panel keeps report wrapper modules visible for single-intent runs", () => {
  const store = createSeededState(true);
  const state = store.getState() as ReturnType<typeof store.getState> & {
    run: Record<string, unknown>;
  };

  state.run = {
    id: "run-report-wrapper",
    state: "completed",
    startedAt: Date.now() - 2000,
    endedAt: Date.now() - 500,
    modules: {
      report: {
        id: "report",
        title: "Report Wrapper",
        status: "completed",
      },
    },
    moduleOrder: ["report"],
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
      intentIds: ["visual-inspection"],
    },
    previewArtifacts: [],
    confidence: "medium",
    moduleTrace: [],
    comparisonVariants: [],
    hypothesisSummary: null,
  };

  const html = renderWorkspaceProcessPanel(state, { sourceReady: true });

  assert.match(html, /Report Wrapper/);
});

test("laboratory transparency renderers tolerate sparse run payloads", () => {
  const store = createSeededState(true);
  const state = store.getState() as ReturnType<typeof store.getState> & {
    run: Record<string, unknown>;
    reports: Record<string, unknown>;
  };

  state.run = {
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
      analysisScope: state.run["analysisScope"],
      comparisonVariants: [],
    },
    emptyReason: null,
  };
  state.ui.workspace.reportOverlayOpen = true;

  assert.doesNotThrow(function () {
    renderWorkspaceProcessPanel(state, { sourceReady: true });
  });
  assert.doesNotThrow(function () {
    renderReportOverlay(state);
  });
});

test("laboratory workspace surface renders action hub and recent action history from user actions", () => {
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
  const processHtml = renderWorkspaceProcessPanel(state, { sourceReady: true });

  assert.match(surface.main, /Klip çıkarılıyor/);
  assert.match(surface.main, /labx-topbar-actions/);
  assert.match(surface.main, /frame_01\.png/);
  assert.match(processHtml, /Son işlemler/);
  assert.match(processHtml, /Frame alındı/);
  assert.match(processHtml, /frame_01\.png/);
  assert.match(processHtml, /data-lab-action="asset-preview"/);
});

test("laboratory workspace surface renders multi-output action summaries with overflow counts", () => {
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
  const processHtml = renderWorkspaceProcessPanel(state, { sourceReady: true });

  assert.match(surface.main, /report-user\.md \+1/);
  assert.match(processHtml, /report-user\.md \+1/);
});

test("laboratory project assets panel renders registry groups and local asset actions only", () => {
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

  const panelHtml = renderLabProjectAssetsPanel(store.getState());
  const leftRailHtml = renderLabLeftRail(store.getState());

  assert.match(leftRailHtml, /Project Assets/);
  assert.match(panelHtml, /Clips/);
  assert.match(panelHtml, /Reports/);
  assert.match(panelHtml, /clip_01\.mp4/);
  assert.match(panelHtml, /run_report\.md/);
  assert.match(panelHtml, /data-lab-action="asset-preview"/);
  assert.match(panelHtml, /data-lab-action="asset-download"/);
  assert.match(panelHtml, /data-lab-action="asset-remove"/);
  assert.match(panelHtml, /data-lab-action="asset-use-as-source" data-lab-value="clip-local-1"/);
  assert.doesNotMatch(
    panelHtml,
    /data-lab-action="asset-use-as-source" data-lab-value="clip-remote-1"/
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
      currentStage: "report",
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
});

test("laboratory report overlay keeps scoped report-level findings inside the active intent group", () => {
  const store = createLabStore();
  const baseWorkspace = store.getState().ui.workspace;

  store.dispatch({
    type: "hydrate",
    payload: {
      currentStage: "report",
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
      currentStage: "report",
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
      currentStage: "report",
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
      availableModuleIds: ["media-analysis", "audio-analysis", "subtitle-analysis"],
      selectedModuleIds: ["media-analysis", "audio-analysis", "subtitle-analysis"],
    },
  });
  store.dispatch({ type: "tool-manager-toggled", open: true });

  const state = store.getState();
  assert.equal(state.source?.["kind"], "audio");
  assert.equal(state.source?.["mode"], "url");
  assert.equal(state.workbench["activeModuleId"], "audio-analysis");
  assert.equal(state.ui.toolManagerOpen, true);
});
