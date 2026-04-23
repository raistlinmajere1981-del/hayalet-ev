import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

import { getAnalysisActionBlockReason } from "../../rooms/laboratory/runtime/lab-selectors.ts";
import { createLabStore } from "../../rooms/laboratory/runtime/lab-store.ts";
import { renderLabLeftRail } from "../../rooms/laboratory/ui/lab-left-rail.ts";
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
  store.dispatch({ type: "module-manager-toggled", open: true });
  const html = renderLabLeftRail(store.getState());

  assert.match(html, /Laboratory/);
  assert.match(html, /Media workspace/);
  assert.match(html, /PROJECT/);
  assert.match(html, /Tool Management/);
  assert.match(html, /Install, update, and refresh local analysis tools/);
  assert.match(html, /INTENTS/);
  assert.match(html, /STATUS/);
  assert.match(html, /Save/);
  assert.match(html, /Delete/);
  assert.doesNotMatch(html, /Modül Yönetimi|Seçili Modüller|Yoğun operatör tezgahı/);
});

test("laboratory workspace surface renders source intake, preview media, and deep-analysis CTA", () => {
  const surface = renderWorkspaceSurface(createSeededState().getState());

  assert.match(surface.main, /Source setup controls/);
  assert.match(surface.main, /Active: lab-demo\.mp4/);
  assert.match(surface.main, /lab-demo\.mp4/);
  assert.match(surface.main, /<video class="labx-preview-media labx-preview-media--workspace-video"/);
  assert.match(surface.main, /data-lab-action="workspace-toggle-source-intake"/);
  assert.match(surface.side, /Derin Analiz Başlat/);
  assert.match(surface.side, /Arka plan süreci[^<]*kilitlemez/);
  assert.doesNotMatch(surface.main, /Kaynak Seçimi|Hızlı modül seçimi burada yapılır/);
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
  store.dispatch({ type: "module-manager-toggled", open: true });

  const state = store.getState();
  assert.equal(state.source?.["kind"], "audio");
  assert.equal(state.source?.["mode"], "url");
  assert.equal(state.workbench["activeModuleId"], "audio-analysis");
  assert.equal(state.ui.moduleManagerOpen, true);
});
