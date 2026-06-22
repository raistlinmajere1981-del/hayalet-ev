import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

import { createLabStore } from "../../rooms/laboratory/runtime/lab-store.ts";
import { renderLabSourcePanel } from "../../rooms/laboratory/ui/lab-source-panel.ts";
import { createLabI18n } from "../../rooms/laboratory/ui/lab-i18n.ts";
import { renderReportOverlay } from "../../rooms/laboratory/ui/report-overlay.ts";

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

describe("comparison pair and document reports", () => {
  void test("laboratory source panel opens png artifacts from the primary click path", () => {
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
      /class="labx-sp-asset__btn"[\s\S]*data-lab-action="workspace-asset-select"[\s\S]*data-lab-value="artifact-png-primary"/
    );
  });

  void test("laboratory document artifacts open inside the shared overlay shell", () => {
    const store = createLabStore();
    store.dispatch({
      type: "asset-added",
      asset: {
        id: "artifact-json-1",
        type: "artifact",
        name: "source-metadata.json",
        localPath: "/tmp/source-metadata.json",
        createdAt: 500,
        metadata: {
          format: "json",
        },
      },
    });
    store.dispatch({
      type: "document-overlay-opened",
      assetId: "artifact-json-1",
    });

    const html = renderReportOverlay(store.getState());

    assert.match(html, /id="lab-report-overlay-root"/);
    assert.match(html, /data-lab-document-overlay="true"/);
    assert.match(html, /data-lab-document-asset-id="artifact-json-1"/);
    assert.match(html, /source-metadata\.json/);
    assert.match(html, /class="labx-report-document-frame"/);
    assert.match(html, /src="file:\/\/\/tmp\/source-metadata\.json"/);
    assert.match(html, /data-lab-action="asset-download" data-lab-value="artifact-json-1"/);
    assert.doesNotMatch(html, /class="labx-report-tabs"/);
  });

  void test("laboratory report overlay renders snapshot summary and workspace-dirty freshness metadata", () => {
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
    assert.match(html, /data-workspace-dirty="true"/);
    assert.match(html, /Workspace farklı/);
    assert.match(html, /Report still reflects the frozen snapshot/);

    const translatedHtml = renderReportOverlay(store.getState(), createTurkishCopy());
    assert.match(translatedHtml, /Snapshot Summary|Snapshot Ozeti/);
  });

  void test("laboratory report overlay keeps scoped report-level findings without grouping buckets", () => {
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
            topFindings: [
              {
                id: "finding-report-1",
                title: "Belirgin anomali tespit edilmedi",
                detail: "Scoped run completed without a mapped module finding.",
                confidence: "low",
                evidence: ["report-summary.json"],
              },
            ],
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
        },
        lastRun: {
          id: "run-scoped-report",
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

    assert.match(html, /Belirgin anomali tespit edilmedi/);
    assert.match(html, /report-summary\.json/);
  });

  void test("laboratory report overlay lists transport-module evidence without selected analysis buckets", () => {
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
            topFindings: [
              {
                id: "finding-motion",
                title: "Motion spike",
                detail: "Movement anomaly detected",
                confidence: "medium",
                evidence: ["motion.png"],
              },
              {
                id: "finding-visual",
                title: "Reveal variant",
                detail: "Forensic reveal variant surfaced a suspicious edge",
                confidence: "medium",
                evidence: ["reveal.png"],
              },
              {
                id: "finding-audio",
                title: "Audio anomaly",
                detail: "Silence pockets detected during the sweep",
                confidence: "low",
                evidence: ["audio.png"],
              },
            ],
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

    assert.match(html, /Motion spike/);
    assert.match(html, /Reveal variant/);
    assert.match(html, /Audio anomaly/);
  });

  void test("laboratory report overlay lists audio transport evidence once without analysis buckets", () => {
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
            topFindings: [
              {
                id: "finding-audio",
                title: "Audio anomaly",
                detail: "Silence pockets detected during the sweep",
                confidence: "low",
                evidence: ["audio.png"],
              },
            ],
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

    assert.equal((html.match(/Audio anomaly/g) ?? []).length, 1);
  });
});
