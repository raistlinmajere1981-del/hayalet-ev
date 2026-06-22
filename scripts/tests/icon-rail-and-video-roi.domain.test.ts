import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

import { createLabStore } from "../../rooms/laboratory/runtime/lab-store.ts";
import { renderLabDrawer } from "../../rooms/laboratory/ui/lab-drawer.ts";
import { createLabI18n } from "../../rooms/laboratory/ui/lab-i18n.ts";
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

describe("icon rail and video ROI", () => {
  void test("laboratory icon rail operation popovers mirror active timeline and ROI scope", () => {
    const store = createSeededState(true);
    store.dispatch({
      type: "workspace-timeline-updated",
      startMs: 2400,
      endMs: 5600,
    });
    store.dispatch({
      type: "selection-inspection-mode-updated",
      mode: "visual",
    });
    store.dispatch({
      type: "selection-roi-updated",
      roi: {
        height: 0.4,
        width: 0.3,
        x: 0.1,
        y: 0.2,
      },
    });
    store.dispatch({
      type: "icon-rail-slot-selected",
      slotId: "clip-export",
    });

    const surface = renderWorkspaceSurface(store.getState());

    assert.match(surface.main, /data-slot="clip-export"/);
    assert.match(surface.main, /data-slot="clip-export"[\s\S]*labx-icon-rail-popover__title/);
    assert.doesNotMatch(surface.main, /data-slot="clip-export"[\s\S]*<h3>/);
    assert.match(surface.main, /data-title-hidden="true"/);
    assert.match(surface.main, /data-lab-operation-scope="timeRange"/);
    assert.match(surface.main, /data-lab-operation-scope="roi"/);
    assert.match(
      surface.main,
      /data-lab-field="operationSettings\.clip-export\.applyRoiCrop"[\s\S]*checked/
    );
  });

  void test("laboratory video ROI without a timeline range stays ROI-only in operation scope", () => {
    const store = createSeededState(true);
    store.dispatch({
      type: "selection-roi-updated",
      roi: {
        height: 0.4,
        width: 0.3,
        x: 0.1,
        y: 0.2,
      },
    });
    store.dispatch({
      type: "icon-rail-slot-selected",
      slotId: "roi-select",
    });

    const state = store.getState();
    const surface = renderWorkspaceSurface(state);
    const operationMarkup = `${surface.main}${surface.inspector ?? ""}`;

    assert.equal(state.ui.workspace.activeSelection?.id, "selection-default:full-video");
    assert.equal(state.ui.workspace.timelineStartMs, null);
    assert.equal(state.ui.workspace.timelineEndMs, null);
    assert.match(surface.main, /data-lab-selection-roi-enabled="true"/);
    assert.doesNotMatch(surface.main, /data-slot="roi-select"[\s\S]*<h3>/);
    assert.match(surface.main, /data-title-hidden="true"/);
    assert.match(operationMarkup, /data-lab-operation-scope="roi"/);
    assert.doesNotMatch(operationMarkup, /data-lab-operation-scope="timeRange"/);
  });

  void test("laboratory source drawer tab remains report-analysis only", () => {
    const store = createSeededState(true);
    store.dispatch({ type: "drawer-mode-requested", mode: "setup" });
    store.dispatch({ type: "selection-tab-toggled", active: false });
    store.dispatch({ type: "analysis-prep-group-toggled", capabilityId: "visual-forensics" });

    const drawer = renderLabDrawer(store.getState(), renderWorkspaceSurface(store.getState()));

    assert.match(drawer, /data-drawer-mode="setup"/);
    assert.match(drawer, /data-block-id="analysis-prep"/);
    assert.match(drawer, /data-lab-action="run-deep-analysis"/);
    assert.match(drawer, /Analysis Modules/);
    assert.doesNotMatch(drawer, /labx-decision-header/);
    assert.doesNotMatch(drawer, /data-operation-id=/);
    assert.doesNotMatch(drawer, /operationSettings\./);
    assert.doesNotMatch(
      drawer,
      /data-lab-action="timeline-export-clip"|data-lab-action="workspace-audio-cleanup-export"|data-lab-action="workspace-enhanced-frame-export"|data-lab-action="operation-cancel"/
    );
  });
});
