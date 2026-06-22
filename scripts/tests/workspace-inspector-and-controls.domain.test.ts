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

describe("workspace inspector and controls", () => {
  void test("laboratory setup drawer previews analysis outcomes before the analysis CTA", () => {
    const store = createSeededState(true);

    let surface = renderWorkspaceSurface(store.getState());
    let drawer = renderLabDrawer(store.getState(), surface);
    assert.doesNotMatch(drawer, /Bu analiz .* tespit edecek/);

    store.dispatch({
      type: "capability-set",
      capabilities: ["visual-structure", "visual-forensics"],
    });

    surface = renderWorkspaceSurface(store.getState());
    drawer = renderLabDrawer(store.getState(), surface);
    assert.deepEqual(getPipelineBlockIds(drawer), ["analysis-prep", "preflight", "analysis-cta"]);
    assert.match(drawer, /Bu analiz .* üzerinde/);
    assert.match(drawer, /Visual Structure, Visual Forensics modüllerini çalıştıracak/);
    assert.doesNotMatch(drawer, /görsel ve işitsel anomali taraması yaparak/);
    assert.doesNotMatch(drawer, /olası anormallikler ve sınıflandırılmış ses olayları/);
  });

  void test("laboratory setup drawer owns active source selection controls under the analysis CTA", () => {
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
    assert.deepEqual(getPipelineBlockIds(drawer), ["analysis-prep", "analysis-cta"]);
    assert.ok(ctaIndex > -1);
    assert.equal(selectionPanelIndex, -1);
  });

  void test("laboratory workspace inspector drawer persists collapsed visual tab state", () => {
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

  void test("laboratory workspace focus layer classes map to preview timeline and inspector", () => {
    const store = createSeededState(true);

    let surface = renderWorkspaceSurface(store.getState());
    assert.match(
      surface.main,
      /class="labx-workspace-preview labx-preview-area labx-focus-primary"/
    );
    assert.match(surface.main, /class="labx-timeline labx-timeline-area labx-focus-passive"/);
    assert.match(
      surface.inspector ?? "",
      /class="labx-workspace-inspector labx-inspector-panel labx-focus-passive"/
    );

    store.dispatch({ type: "lab-focus-layer-changed", layer: "timeline" });
    surface = renderWorkspaceSurface(store.getState());
    assert.match(
      surface.main,
      /class="labx-workspace-preview labx-preview-area labx-focus-passive"/
    );
    assert.match(surface.main, /class="labx-timeline labx-timeline-area labx-focus-secondary"/);
    assert.match(
      surface.inspector ?? "",
      /class="labx-workspace-inspector labx-inspector-panel labx-focus-passive"/
    );

    store.dispatch({ type: "lab-focus-layer-changed", layer: "inspector" });
    surface = renderWorkspaceSurface(store.getState());
    assert.match(
      surface.main,
      /class="labx-workspace-preview labx-preview-area labx-focus-passive"/
    );
    assert.match(surface.main, /class="labx-timeline labx-timeline-area labx-focus-passive"/);
    assert.match(
      surface.inspector ?? "",
      /class="labx-workspace-inspector labx-inspector-panel labx-focus-secondary"/
    );
  });

  void test("laboratory workspace inspector exposes operation controls without selection-tab operation focus", () => {
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

    const surface = renderWorkspaceSurface(store.getState());

    assert.match(surface.inspector ?? "", /data-active-tab="audio"/);
    assert.match(surface.inspector ?? "", /data-inspector-panel="operations"/);
    assert.match(surface.inspector ?? "", /data-operation-id="enhanced-frame"/);
    assert.match(surface.inspector ?? "", /data-operation-id="before-after-variant"/);
    assert.match(surface.inspector ?? "", /data-operation-id="band-pass-voice"/);
    assert.match(surface.inspector ?? "", /data-operation-id="stem-separation"/);
    assert.doesNotMatch(
      surface.inspector ?? "",
      /data-operation-id="enhanced-frame"[\s\S]*data-active="true"/
    );
    assert.match(
      surface.inspector ?? "",
      /class="labx-settings-block labx-settings-block--inline"/
    );
    assert.doesNotMatch(surface.inspector ?? "", /data-lab-collapsible-panel="true"/);
    assert.match(surface.inspector ?? "", /data-panel-id="operationSettings\.enhanced-frame"/);
    assert.doesNotMatch(surface.inspector ?? "", /class="labx-settings-block__state"/);
    assert.doesNotMatch(surface.inspector ?? "", /class="labx-settings-block__action"/);
    assert.match(surface.inspector ?? "", /data-lab-operation-scope="timeRange"/);
    assert.doesNotMatch(surface.inspector ?? "", /data-lab-operation-scope="roi"/);
    assert.match(
      surface.inspector ?? "",
      /data-lab-field="operationSettings\.enhanced-frame\.preset"/
    );
    assert.match(surface.inspector ?? "", /data-lab-action="operation-settings-reset"/);
  });

  void test("laboratory icon rail keeps only runnable realtime and output operations", () => {
    const store = createSeededState(true);
    const surface = renderWorkspaceSurface(store.getState());

    assert.match(surface.main, /data-lab-region="icon-rail"/);
    assert.match(surface.main, /data-lab-value="audio-focus"/);
    assert.match(surface.main, /data-lab-value="roi-select"/);
    assert.match(surface.main, /data-lab-value="clip-export"/);
    assert.match(surface.main, /data-lab-value="enhanced-frame"/);
    assert.doesNotMatch(surface.main, /data-lab-value="image-comparison"/);
    assert.doesNotMatch(surface.main, /data-lab-value="before-after"/);
    assert.doesNotMatch(surface.main, /data-lab-value="stem-separate"/);
    assert.doesNotMatch(surface.main, /data-lab-value="stabilize"/);
  });
});
