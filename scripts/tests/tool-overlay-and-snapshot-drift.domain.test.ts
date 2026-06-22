import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

import { createLabStore } from "../../rooms/laboratory/runtime/lab-store.ts";
import { renderLabDrawer } from "../../rooms/laboratory/ui/lab-drawer.ts";
import { renderLabProcessStrip } from "../../rooms/laboratory/ui/lab-process-strip.ts";
import { createLabI18n } from "../../rooms/laboratory/ui/lab-i18n.ts";
import { renderReportOverlay } from "../../rooms/laboratory/ui/report-overlay.ts";
import { renderToolManagementOverlay } from "../../rooms/laboratory/ui/tool-management-overlay.ts";
import { renderWorkspaceSurface } from "../../rooms/laboratory/ui/workspace-surface.ts";

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

describe("tool overlay and snapshot drift", () => {
  void test("laboratory tool overlay lists room-local tool lifecycle actions inside the live shell", () => {
    const store = createSeededState();
    store.dispatch({ type: "tool-manager-toggled", open: true });
    const state = store.getState();
    state.snapshot = {
      ...(state.snapshot ?? {}),
      jobs: [
        {
          jobId: "job-yt-dlp-install",
          action: "tool-install",
          toolId: "yt-dlp",
          stage: "running",
          percent: 64,
          phaseIndex: 2,
          phaseCount: 5,
          phaseLabel: "Arşiv indiriliyor",
          message: "Paket indiriliyor",
          detailLines: ["Downloading yt-dlp archive", "64% of 12 MB"],
        },
      ],
    };
    state.toolState = {
      ...state.toolState,
      tools: {
        ...(state.toolState["tools"] ?? {}),
        "yt-dlp": {
          ...(((state.toolState["tools"] as Record<string, unknown> | undefined)?.["yt-dlp"] ??
            {}) as Record<string, unknown>),
          latestVersion: "2026.05.10",
          updateAvailable: true,
        },
      },
    };
    const html = renderToolManagementOverlay(store.getState());

    assert.match(html, /Araç Yönetimi/);
    assert.match(html, /Güncellemeleri kontrol et/);
    assert.match(html, /Kurulu araç/);
    assert.match(html, /Güncelleme bekleyen/);
    assert.match(html, /İşlem takibi/);
    assert.match(html, /Kurulum ve güncelleme/);
    assert.match(html, /yt-dlp[\s\S]*Kurulum/);
    assert.match(html, /Arşiv indiriliyor/);
    assert.match(html, /64%/);
    assert.match(html, /Aşama 2\/5: Arşiv indiriliyor/);
    assert.match(html, /Downloading yt-dlp archive/);
    assert.match(html, /data-lab-action="tool-job-cancel" data-lab-value="job-yt-dlp-install"/);
    assert.match(html, /role="progressbar"/);
    assert.match(html, /yt-dlp/);
    assert.match(html, /FFmpeg/);
    assert.match(html, /data-lab-action="tool-check-all-updates"/);
    assert.match(html, /data-lab-update-choice value="yt-dlp" checked/);
    assert.match(html, /data-lab-action="tool-update-selected"/);
    assert.doesNotMatch(html, /data-lab-action="tool-update" data-lab-value="yt-dlp"/);
    assert.doesNotMatch(html, /<details class="labx-module-card__meta-details"/);
    assert.doesNotMatch(html, /class="labx-tool-monogram"/);
    assert.doesNotMatch(html, /Uygulama içi kurulum/);
    assert.match(html, /data-lab-action="tool-install-review"/);
    assert.match(html, /data-lab-action="tool-install-review" data-lab-value="librosa"/);
    assert.doesNotMatch(html, /Manuel kurulum|Manual setup/);
    assert.doesNotMatch(html, /Dense operator workbench|Modules|Focus/);

    const trCopy = createTurkishCopy();
    const translatedHtml = renderToolManagementOverlay(store.getState(), trCopy);
    assert.match(translatedHtml, /İşlem takibi/);
    assert.doesNotMatch(translatedHtml, /Laboratory araçları/);
    assert.match(translatedHtml, /Güncelleme listesi/);
    assert.match(translatedHtml, /Güncelleme bulundu \(/);
    assert.doesNotMatch(
      translatedHtml,
      /YouTube capture stays enabled from the source intake frame/
    );

    const idleStore = createSeededState();
    idleStore.dispatch({ type: "tool-manager-toggled", open: true });
    const idleHtml = renderToolManagementOverlay(idleStore.getState(), trCopy);
    assert.doesNotMatch(idleHtml, /Aktif kurulum veya güncelleme yok/);
    assert.doesNotMatch(idleHtml, /Bir araç işlemi başladığında ilerleme burada görünür/);
  });

  void test("laboratory tool manager asks for install confirmation with package and size details", () => {
    const store = createSeededState(true);
    store.dispatch({ type: "tool-manager-toggled", open: true });
    store.dispatch({ type: "tool-install-review-requested", toolId: "librosa" });

    const html = renderToolManagementOverlay(store.getState(), createTurkishCopy());

    assert.match(html, /Kurulum öncesi/);
    assert.match(html, /librosa kurulacak/);
    assert.match(html, /İndirilecek veri[\s\S]*80 - 250 MB/);
    assert.match(html, /Disk kullanımı[\s\S]*250 - 700 MB/);
    assert.match(html, /librosa/);
    assert.match(html, /numpy/);
    assert.match(html, /scipy/);
    assert.match(html, /Room-local Python runtime oluşturulur veya bozuksa onarılır/);
    assert.match(html, /data-lab-action="tool-install-confirm" data-lab-value="librosa"/);
    assert.match(html, /data-lab-action="tool-install-dismiss"/);
  });

  void test("laboratory workspace panels show snapshot drift as a non-blocking visibility layer", () => {
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
    store.dispatch({ type: "capability-set", capabilities: ["visual-forensics"] });

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
    assert.match(drawer, /data-lab-running-stages="true"/);
    assert.match(drawer, /data-lab-running-plan="true"/);
    assert.match(drawer, /Analysis stages/);
    assert.match(drawer, /0\/3 modules/);
    assert.match(drawer, /Visual Forensics/);
    assert.match(drawer, /data-status="active"/);
    assert.doesNotMatch(drawer, /Motion Anomaly/);
    assert.doesNotMatch(drawer, /Frame Consistency/);
    assert.doesNotMatch(drawer, /labx-analysis-module--locked/);
    assert.doesNotMatch(drawer, /Pipeline/);
    assert.doesNotMatch(drawer, /Audio investigation/);
    assert.match(strip, /class="labx-process-strip"/);
    assert.match(strip, /data-lab-region="process-strip"/);
  });

  void test("laboratory running drawer keeps module summary visible without selected analysis state", () => {
    const store = createSeededState(true);
    const eventTimestamp = Date.now();

    store.dispatch({
      type: "host-event-received",
      event: {
        id: "evt-run",
        kind: "activity",
        severity: "info",
        message: "Analiz basladi",
        detail: null,
        timestamp: eventTimestamp,
        source: "host",
        action: "process-run",
        stage: "running",
        scope: "run",
        moduleId: null,
        rawLine: null,
      },
    });
    store.dispatch({
      type: "host-event-received",
      event: {
        id: "evt-module",
        kind: "activity",
        severity: "info",
        message: "Runtime module running",
        detail: "Runtime module running",
        timestamp: eventTimestamp + 1,
        source: "host",
        action: "process-run",
        stage: "running",
        scope: "run",
        moduleId: "visual-signal",
        rawLine: null,
      },
    });
    store.dispatch({ type: "capability-set", capabilities: [] });

    const drawer = renderLabDrawer(store.getState(), renderWorkspaceSurface(store.getState()));

    assert.match(drawer, /data-lab-running-stages="true"/);
    assert.match(drawer, /data-lab-running-plan="true"/);
    assert.match(drawer, /Active modules/);
    assert.doesNotMatch(drawer, /Visual Signal/);
    assert.doesNotMatch(drawer, /labx-analysis-module--locked/);
    assert.doesNotMatch(drawer, /Analiz plani hazirlaniyor/);
  });

  void test("laboratory transparency renderers tolerate sparse run payloads", () => {
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
});
