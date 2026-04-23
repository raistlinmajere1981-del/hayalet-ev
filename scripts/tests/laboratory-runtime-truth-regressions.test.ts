import test from "node:test";
import assert from "node:assert/strict";
import { createLabEventBus } from "../../rooms/laboratory/runtime/lab-event-bus.ts";
import { createLabRunController } from "../../rooms/laboratory/runtime/lab-run-controller.ts";
import { createLabHostBridge } from "../../rooms/laboratory/runtime/lab-host-bridge.ts";
import {
  getActualOutputs,
  getActionOutputs,
  getAssetById,
  getAssets,
  getAssetsByRun,
  getAssetsBySource,
  getAssetsByType,
  getCurrentSourceAsset,
  getDualPreviewVolume,
  getExpectedOutputs,
  getIntentDirtyMap,
  getLinkedAudioAssets,
  getParentSourceForAsset,
  getReportFreshness,
  getRunSnapshotSummary,
  getSelectedDualPreviewAudioAsset,
  getWorkspaceDiff,
  isDualPreviewActive,
  isDualPreviewAvailable,
  isExpectedOutputMatched,
} from "../../rooms/laboratory/runtime/lab-selectors.ts";
import { createLabStore } from "../../rooms/laboratory/runtime/lab-store.ts";
import { LAB_USER_ACTION_HUB_SUCCESS_WINDOW_MS } from "../../rooms/laboratory/runtime/lab-user-actions.ts";
import { extractFindings } from "../../rooms/laboratory/services/finding-engine.ts";
import { parseProcessOutput } from "../../rooms/laboratory/services/process-output-parser.ts";

type TimeoutFn = typeof globalThis.setTimeout;
type ClearTimeoutFn = typeof globalThis.clearTimeout;

function installTimerMock(): {
  scheduled: Array<{ fn: () => void; delay: number }>;
  restore: () => void;
} {
  const originalSetTimeout: TimeoutFn = globalThis.setTimeout;
  const originalClearTimeout: ClearTimeoutFn = globalThis.clearTimeout;
  const scheduled: Array<{ fn: () => void; delay: number }> = [];

  globalThis.setTimeout = ((fn: (...args: unknown[]) => void, delay?: number) => {
    scheduled.push({ fn: () => fn(), delay: delay ?? 0 });
    return scheduled.length as unknown as ReturnType<typeof setTimeout>;
  }) as TimeoutFn;

  globalThis.clearTimeout = (() => {}) as ClearTimeoutFn;

  return {
    scheduled,
    restore() {
      globalThis.setTimeout = originalSetTimeout;
      globalThis.clearTimeout = originalClearTimeout;
    },
  };
}

class FakeActionElement {
  dataset: Record<string, string>;

  constructor(action: string, value?: string) {
    this.dataset = {
      labAction: action,
      ...(value === undefined ? {} : { labValue: value }),
    };
  }

  closest(selector: string): FakeActionElement | null {
    if (selector === "[data-lab-stage]") {
      return null;
    }
    if (selector === "[data-lab-action]") {
      return this;
    }
    return null;
  }
}

class FakeControllerDocument {
  listeners = new Map<string, (event: Event) => void>();

  addEventListener(type: string, listener: EventListenerOrEventListenerObject): void {
    this.listeners.set(
      type,
      typeof listener === "function"
        ? (listener as (event: Event) => void)
        : (event: Event) => listener.handleEvent(event)
    );
  }
}

class FakeMediaElement {
  currentTime = 0;
  duration = 0;
  readyState = 1;
  muted = false;
  paused = true;
  volume = 1;
  playCalls = 0;
  pauseCalls = 0;
  failPlay = false;
  private listeners = new Map<string, Set<(event: Event) => void>>();

  addEventListener(type: string, listener: EventListenerOrEventListenerObject): void {
    const handler =
      typeof listener === "function"
        ? (listener as (event: Event) => void)
        : (event: Event) => listener.handleEvent(event);
    const existing = this.listeners.get(type) || new Set<(event: Event) => void>();
    existing.add(handler);
    this.listeners.set(type, existing);
  }

  removeEventListener(type: string, listener: EventListenerOrEventListenerObject): void {
    const existing = this.listeners.get(type);
    if (!existing) {
      return;
    }
    const handler =
      typeof listener === "function"
        ? (listener as (event: Event) => void)
        : (event: Event) => listener.handleEvent(event);
    existing.delete(handler);
  }

  play() {
    this.paused = false;
    this.playCalls += 1;
    if (this.failPlay) {
      this.paused = true;
      return Promise.reject(new Error("Autoplay blocked"));
    }
    this.dispatch("play");
    return Promise.resolve();
  }

  pause() {
    this.paused = true;
    this.pauseCalls += 1;
    this.dispatch("pause");
  }

  dispatch(type: string) {
    const handlers = Array.from(this.listeners.get(type) || []);
    handlers.forEach(function (handler) {
      handler({ type } as Event);
    });
  }
}

class FakeRangeElement {
  constructor(
    public value: string,
    public max = "0"
  ) {}
}

class FakeTextElement {
  constructor(public textContent: string | null = null) {}
}

class FakeDualPreviewDocument extends FakeControllerDocument {
  constructor(
    private readonly queryMap: Map<string, unknown>,
    private readonly mediaElements: unknown[] = []
  ) {
    super();
  }

  querySelector(selector: string) {
    return this.queryMap.get(selector) || null;
  }

  querySelectorAll(selector: string) {
    if (selector === ".labx-preview-media") {
      return this.mediaElements as HTMLMediaElement[];
    }
    return [] as HTMLMediaElement[];
  }
}

function createDualPreviewSnapshot(startOffsetMs = 0) {
  return {
    ready: true,
    featureId: "media-analysis",
    activeProjectId: "project-dual-preview",
    projects: [{ id: "project-dual-preview", name: "lab-demo.mp4", hasSource: true }],
    activeProject: {
      id: "project-dual-preview",
      name: "lab-demo.mp4",
      createdAt: "2026-04-23T19:00:00.000Z",
      source: {
        status: "ready",
        kind: "video",
        mode: "local",
        previewUrl: "file:///tmp/lab-demo.mp4",
        storedFileName: "lab-demo.mp4",
        storedPath: "/tmp/lab-demo.mp4",
        routeLabel: "Local Copy",
        metadata: {
          durationSeconds: 6,
          sizeBytes: 2048,
        },
        drafts: {},
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
      assets: [
        {
          id: "source-active",
          type: "source",
          name: "lab-demo.mp4",
          localPath: "/tmp/lab-demo.mp4",
          createdAt: 100,
          sourceId: "source-active",
          metadata: {
            storedFileName: "lab-demo.mp4",
          },
        },
        {
          id: "asset-audio-linked",
          type: "audio",
          name: "audio.wav",
          localPath: "/tmp/audio.wav",
          createdAt: 200,
          sourceId: "source-active",
          derivedFromAssetId: "source-active",
          derivedFromSourceId: "source-active",
          metadata: {
            durationMs: 6000,
            startOffsetMs,
          },
        },
      ],
    },
    workbench: {
      activeModuleId: "media-analysis",
      availableModuleIds: ["media-analysis"],
      selectedModuleIds: ["media-analysis"],
    },
    sourceProbeStatus: "completed",
    profileModels: [],
    reports: {
      user: null,
      ai: null,
      emptyReason: "Rapor henüz üretilmedi.",
    },
    activityFeed: [],
  };
}

test("laboratory process output parser translates known ffmpeg and download lines", () => {
  const blackdetectEvent = parseProcessOutput("blackdetect=duration:0.42");
  const frameEvent = parseProcessOutput("frame= 248 fps=24");
  const downloadEvent = parseProcessOutput("[download] 42.1% of 12.31MiB");
  const subtitleEvent = parseProcessOutput("subtitle stream has 12 entries");
  const mergeEvent = parseProcessOutput('Merging formats into "clip.mp4"');

  assert.equal(blackdetectEvent?.message, "Siyah sahne tespiti calisiyor");
  assert.equal(blackdetectEvent?.moduleId, "motion");
  assert.equal(frameEvent?.detail, "248 kare incelendi");
  assert.equal(downloadEvent?.message, "Kaynak indiriliyor");
  assert.equal(downloadEvent?.scope, "global");
  assert.equal(subtitleEvent?.message, "Altyazi girdisi taraniyor");
  assert.equal(mergeEvent?.message, "Kaynak birlestiriliyor");
});

test("laboratory process output parser leaves unknown lines in raw-log only flow", () => {
  const unknownEvent = parseProcessOutput("totally unknown tool output");
  assert.equal(unknownEvent, null);
});

test("laboratory finding engine derives findings from semantic events and stays quiet on thin runs", () => {
  const anomalyFindings = extractFindings([
    {
      id: "evt-1",
      kind: "activity",
      severity: "info",
      message: "Siyah sahne segmenti bulundu",
      detail: "black_start:12.5",
      timestamp: Date.now(),
      source: "host",
      action: "process-run",
      stage: "stdout",
      scope: "run",
      moduleId: "motion",
      rawLine: "black_start:12.5",
    },
    {
      id: "evt-2",
      kind: "activity",
      severity: "info",
      message: "Freeze segmenti bulundu",
      detail: "freeze_duration:1.2",
      timestamp: Date.now(),
      source: "host",
      action: "process-run",
      stage: "stdout",
      scope: "run",
      moduleId: "motion",
      rawLine: "freeze_duration:1.2",
    },
  ]);

  assert.equal(anomalyFindings.length >= 2, true);
  assert.equal(
    anomalyFindings.some((entry) => entry.title.includes("Siyah sahne")),
    true
  );
  assert.equal(
    anomalyFindings.some((entry) => entry.title.includes("Freeze")),
    true
  );

  const noAnomalyFindings = extractFindings([
    {
      id: "evt-coverage",
      kind: "activity",
      severity: "info",
      message: "Kare analizi aktif",
      detail: "248 kare incelendi",
      timestamp: Date.now(),
      source: "host",
      action: "process-run",
      stage: "stdout",
      scope: "run",
      moduleId: "motion",
      rawLine: "frame=248",
    },
    {
      id: "evt-3",
      kind: "activity",
      severity: "success",
      message: "Analiz tamamlandi",
      detail: null,
      timestamp: Date.now(),
      source: "host",
      action: "process-run",
      stage: "completed",
      scope: "run",
      moduleId: null,
      rawLine: null,
    },
  ]);

  assert.equal(noAnomalyFindings.length, 1);
  assert.equal(noAnomalyFindings[0]?.title, "Belirgin anomali tespit edilmedi");

  const thinRunFindings = extractFindings([
    {
      id: "evt-4",
      kind: "activity",
      severity: "success",
      message: "Analiz tamamlandi",
      detail: null,
      timestamp: Date.now(),
      source: "host",
      action: "process-run",
      stage: "completed",
      scope: "run",
      moduleId: null,
      rawLine: null,
    },
  ]);

  assert.equal(thinRunFindings.length, 0);
});

test("laboratory bridge forwards only canonical lab events into the store", () => {
  const emitted: string[] = [];
  const bridge = createLabHostBridge({
    emit(event) {
      emitted.push(event.type);
    },
  });

  bridge.handleHostMessage({
    type: "media-job",
    payload: {
      action: "process-run",
      stage: "queued",
      toolId: "ffmpeg",
      featureStage: "process",
    },
  });

  bridge.handleHostMessage({
    type: "lab-event",
    payload: {
      id: "evt-run-1",
      kind: "activity",
      severity: "info",
      message: "Analiz basladi",
      detail: null,
      timestamp: Date.now(),
      source: "host",
      action: "process-run",
      stage: "queued",
      scope: "run",
      moduleId: null,
      rawLine: null,
    },
  });

  assert.deepEqual(emitted, ["host-event-received"]);
});

test("laboratory store derives run state from canonical events without inventing modules", () => {
  const store = createLabStore();
  store.dispatch({
    type: "host-event-received",
    event: {
      id: "evt-run",
      kind: "activity",
      severity: "info",
      message: "Analiz basladi",
      detail: null,
      timestamp: Date.now(),
      source: "host",
      action: "process-run",
      stage: "running",
      scope: "run",
      moduleId: null,
      rawLine: null,
    },
  });

  const state = store.getState();
  assert.equal(state.run?.state, "running");
  assert.deepEqual(state.run?.moduleOrder, []);
});

test("laboratory store keeps export user actions separate from analysis run state", () => {
  const store = createLabStore();

  store.dispatch({
    type: "user-action-added",
    actionEvent: {
      id: "user-action-1",
      type: "export-clip",
      label: "Klip çıkarılıyor",
      status: "running",
      startedAt: Date.now() - 1000,
      projectId: "project-1",
      requestId: "req-export-1",
      sourceAction: "export-timeline-clip",
    },
  });
  store.dispatch({
    type: "host-event-received",
    event: {
      id: "evt-export",
      kind: "activity",
      severity: "success",
      message: "Klip çıkarılıyor tamamlandı",
      detail: null,
      timestamp: Date.now(),
      source: "host",
      action: "export-timeline-clip",
      stage: "completed",
      scope: "global",
      moduleId: null,
      rawLine: null,
      requestId: "req-export-1",
      jobId: "job-export-1",
      projectId: "project-1",
      resultAssetIds: ["asset-clip-export-1"],
    },
  });
  store.dispatch({
    type: "host-event-received",
    event: {
      id: "evt-run",
      kind: "activity",
      severity: "info",
      message: "Analiz basladi",
      detail: null,
      timestamp: Date.now(),
      source: "host",
      action: "process-run",
      stage: "running",
      scope: "run",
      moduleId: null,
      rawLine: null,
    },
  });

  const state = store.getState();
  assert.equal(state.userActions[0]?.status, "success");
  assert.equal(state.userActions[0]?.message, "Klip hazır");
  assert.deepEqual(state.userActions[0]?.resultAssetIds, ["asset-clip-export-1"]);
  assert.equal(state.run?.state, "running");
  assert.equal(state.run?.events.length, 1);
  assert.equal(state.run?.events[0]?.action, "process-run");
});

test("laboratory store hydrates project assets and selectors keep registry lookups scoped", () => {
  const store = createLabStore();

  store.dispatch({
    type: "snapshot-received",
    payload: {
      ready: true,
      featureId: "media-analysis",
      activeProjectId: "project-asset-1",
      projects: [],
      activeProject: {
        id: "project-asset-1",
        source: {
          status: "ready",
          kind: "video",
          mode: "local",
          storedPath: "/tmp/source.mp4",
          drafts: {},
        },
        edit: {},
        profile: {},
        process: {
          records: {},
        },
        report: {
          records: {},
        },
        assets: [
          {
            id: "asset-source-1",
            type: "source",
            name: "source.mp4",
            localPath: "/tmp/source.mp4",
            createdAt: 100,
            sourceId: "source-1",
          },
          {
            id: "asset-clip-1",
            type: "clip",
            name: "clip_01.mp4",
            localPath: "/tmp/clip_01.mp4",
            createdAt: 200,
            sourceId: "source-1",
            runId: "run-1",
          },
          {
            id: "asset-frame-1",
            type: "frame",
            name: "frame_001.png",
            localPath: "/tmp/frame_001.png",
            createdAt: 300,
            sourceId: "source-1",
            runId: "run-2",
          },
        ],
      },
    },
  });

  const state = store.getState();
  const assets = getAssets(state);
  assert.equal(assets.length, 3);
  assets.pop();
  assert.equal(getAssets(store.getState()).length, 3);
  assert.deepEqual(
    getAssetsByType(state, "clip").map((asset) => asset.id),
    ["asset-clip-1"]
  );
  assert.deepEqual(
    getAssetsBySource(state, "source-1").map((asset) => asset.id),
    ["asset-source-1", "asset-clip-1", "asset-frame-1"]
  );
  assert.deepEqual(
    getAssetsByRun(state, "run-1").map((asset) => asset.id),
    ["asset-clip-1"]
  );

  store.dispatch({
    type: "asset-updated",
    id: "asset-clip-1",
    patch: {
      name: "clip_renamed.mp4",
    },
  });
  assert.equal(getAssetsByType(store.getState(), "clip")[0]?.name, "clip_renamed.mp4");

  store.dispatch({ type: "asset-removed", id: "asset-frame-1" });
  assert.deepEqual(
    getAssets(store.getState()).map((asset) => asset.id),
    ["asset-source-1", "asset-clip-1"]
  );
  assert.equal(getAssetById(store.getState(), "asset-clip-1")?.name, "clip_renamed.mp4");
  assert.equal(getAssetById(store.getState(), "asset-missing"), null);
});

test("laboratory action output selector resolves linked assets and ignores stale ids", () => {
  const store = createLabStore();

  store.dispatch({
    type: "asset-added",
    asset: {
      id: "asset-frame-result",
      type: "frame",
      name: "frame_01.png",
      localPath: "/tmp/frame_01.png",
      createdAt: 200,
    },
  });
  store.dispatch({
    type: "asset-added",
    asset: {
      id: "asset-report-result",
      type: "report",
      name: "report.md",
      localPath: "/tmp/report.md",
      createdAt: 300,
    },
  });
  store.dispatch({
    type: "user-action-added",
    actionEvent: {
      id: "user-action-result",
      type: "grab-frame",
      label: "Frame alınıyor",
      status: "success",
      startedAt: Date.now() - 1000,
      finishedAt: Date.now(),
      message: "Frame alındı",
      requestId: "req-frame-result",
      projectId: null,
      resultAssetIds: ["asset-frame-result", "asset-missing", "asset-report-result"],
      sourceAction: "export-frame-grab",
    },
  });

  assert.deepEqual(
    getActionOutputs(store.getState(), "user-action-result").map((asset) => asset.id),
    ["asset-frame-result", "asset-report-result"]
  );
  assert.deepEqual(getActionOutputs(store.getState(), "user-action-missing"), []);
});

test("laboratory lineage selectors resolve current source, linked audio, and parent assets", () => {
  const store = createLabStore();

  store.dispatch({
    type: "snapshot-received",
    payload: {
      ready: true,
      featureId: "media-analysis",
      activeProjectId: "project-lineage",
      projects: [],
      activeProject: {
        id: "project-lineage",
        source: {
          status: "ready",
          kind: "video",
          mode: "local",
          storedPath: "/tmp/source-active.mp4",
          storedFileName: "source-active.mp4",
          drafts: {},
        },
        edit: {},
        profile: {},
        process: {
          records: {},
        },
        report: {
          records: {},
        },
        assets: [
          {
            id: "source-old",
            type: "source",
            name: "source-old.mp4",
            localPath: "/tmp/source-old.mp4",
            createdAt: 100,
            sourceId: "source-old",
          },
          {
            id: "source-active",
            type: "source",
            name: "source-active.mp4",
            localPath: "/tmp/source-active.mp4",
            createdAt: 200,
            sourceId: "source-active",
            metadata: {
              storedFileName: "source-active.mp4",
            },
          },
          {
            id: "asset-audio-linked",
            type: "audio",
            name: "audio.wav",
            localPath: "/tmp/audio.wav",
            createdAt: 300,
            sourceId: "source-active",
            derivedFromAssetId: "source-active",
            derivedFromSourceId: "source-active",
            metadata: {
              durationMs: 1400,
              startOffsetMs: 0,
            },
          },
          {
            id: "asset-audio-stale",
            type: "audio",
            name: "stale.wav",
            localPath: "/tmp/stale.wav",
            createdAt: 400,
            sourceId: "source-active",
            derivedFromAssetId: "asset-missing",
            derivedFromSourceId: "source-missing",
          },
        ],
      },
    },
  });

  const state = store.getState();
  assert.equal(getCurrentSourceAsset(state)?.id, "source-active");
  assert.deepEqual(
    getLinkedAudioAssets(state, "source-active").map((asset) => asset.id),
    ["asset-audio-linked"]
  );
  assert.equal(getParentSourceForAsset(state, "asset-audio-linked")?.id, "source-active");
  assert.equal(getParentSourceForAsset(state, "asset-audio-stale"), null);
  assert.equal(isDualPreviewAvailable(state), true);
  assert.equal(isDualPreviewActive(state), false);
  assert.equal(getSelectedDualPreviewAudioAsset(state)?.id, "asset-audio-linked");
  assert.equal(getDualPreviewVolume(state), 1);

  store.dispatch({
    type: "asset-updated",
    id: "asset-audio-linked",
    patch: {
      name: "audio-linked.wav",
    },
  });
  assert.equal(
    getAssetById(store.getState(), "asset-audio-linked")?.derivedFromAssetId,
    "source-active"
  );
  assert.equal(
    getAssetById(store.getState(), "asset-audio-linked")?.derivedFromSourceId,
    "source-active"
  );
});

test("laboratory workspace dual preview state heals across source churn and stale selections", () => {
  const store = createLabStore();

  store.dispatch({
    type: "snapshot-received",
    payload: createDualPreviewSnapshot(),
  });
  store.dispatch({
    type: "workspace-dual-preview-toggled",
    force: true,
    audioAssetId: "asset-missing",
  });

  assert.equal(isDualPreviewActive(store.getState()), true);
  assert.equal(getSelectedDualPreviewAudioAsset(store.getState())?.id, "asset-audio-linked");

  store.dispatch({
    type: "source-config-patched",
    patch: {
      kind: "image",
      status: "idle",
      storedPath: null,
      previewUrl: null,
    },
  });

  assert.equal(isDualPreviewAvailable(store.getState()), false);
  assert.equal(isDualPreviewActive(store.getState()), false);
  assert.equal(getSelectedDualPreviewAudioAsset(store.getState()), null);
});

test("laboratory hydrate restores dual preview workspace fields with valid linked audio fallback", () => {
  const store = createLabStore();

  store.dispatch({
    type: "hydrate",
    payload: {
      currentStage: "source",
      featureId: "media-analysis",
      projectIndex: {
        activeProjectId: "project-dual-preview",
        projects: [{ id: "project-dual-preview", name: "lab-demo.mp4", hasSource: true }],
      },
      workbench: {
        activeModuleId: "media-analysis",
        availableModuleIds: ["media-analysis"],
        selectedModuleIds: ["media-analysis"],
      },
      source: {
        status: "ready",
        kind: "video",
        mode: "local",
        previewUrl: "file:///tmp/lab-demo.mp4",
        storedFileName: "lab-demo.mp4",
        storedPath: "/tmp/lab-demo.mp4",
        routeLabel: "Local Copy",
      },
      sourceProbeStatus: "completed",
      assets: [
        {
          id: "source-active",
          type: "source",
          name: "lab-demo.mp4",
          localPath: "/tmp/lab-demo.mp4",
          createdAt: 100,
          sourceId: "source-active",
          metadata: {
            storedFileName: "lab-demo.mp4",
          },
        },
        {
          id: "asset-audio-linked",
          type: "audio",
          name: "audio.wav",
          localPath: "/tmp/audio.wav",
          createdAt: 200,
          sourceId: "source-active",
          derivedFromAssetId: "source-active",
          derivedFromSourceId: "source-active",
          metadata: {
            durationMs: 6000,
            startOffsetMs: 0,
          },
        },
      ],
      reports: {
        user: null,
        ai: null,
        emptyReason: "Rapor henüz üretilmedi.",
      },
      activityFeed: [],
      workspace: {
        dualPreviewEnabled: true,
        dualPreviewAudioAssetId: "asset-missing",
        dualPreviewVolume: 0.35,
      },
    },
  });

  assert.equal(isDualPreviewActive(store.getState()), true);
  assert.equal(getSelectedDualPreviewAudioAsset(store.getState())?.id, "asset-audio-linked");
  assert.equal(getDualPreviewVolume(store.getState()), 0.35);
});

test("laboratory intent output selectors map expected outputs and filter actual assets", () => {
  const store = createLabStore();

  store.dispatch({
    type: "snapshot-received",
    payload: {
      ready: true,
      featureId: "media-analysis",
      activeProjectId: "project-output-trace",
      projects: [],
      activeProject: {
        id: "project-output-trace",
        source: {
          status: "ready",
          kind: "video",
          mode: "local",
          storedPath: "/tmp/source.mp4",
          drafts: {},
        },
        edit: {},
        profile: {},
        process: {
          records: {},
        },
        report: {
          records: {},
        },
        assets: [
          {
            id: "asset-source-tagged",
            type: "source",
            name: "source.mp4",
            localPath: "/tmp/source.mp4",
            createdAt: 100,
            intentIds: ["visual-inspection"],
          },
          {
            id: "asset-frame-visual",
            type: "frame",
            name: "frame_01.png",
            localPath: "/tmp/frame_01.png",
            createdAt: 200,
            intentIds: ["visual-inspection"],
          },
          {
            id: "asset-audio",
            type: "audio",
            name: "audio.wav",
            localPath: "/tmp/audio.wav",
            createdAt: 300,
            intentIds: ["audio-investigation"],
          },
          {
            id: "asset-unscoped",
            type: "artifact",
            name: "unscoped.json",
            localPath: "/tmp/unscoped.json",
            createdAt: 400,
          },
        ],
      },
    },
  });

  const visualExpected = getExpectedOutputs("visual-inspection");
  const audioExpected = getExpectedOutputs("audio-investigation");
  const visualActual = getActualOutputs(store.getState(), "visual-inspection");

  assert.deepEqual(
    visualExpected.map((entry) => entry.label),
    ["Frame çıktıları", "Anomali verileri"]
  );
  assert.deepEqual(audioExpected, [
    {
      intentId: "audio-investigation",
      label: "Ses çıktısı",
      assetTypes: ["audio"],
    },
  ]);
  assert.deepEqual(getExpectedOutputs("detail-enhancement"), []);
  assert.deepEqual(
    visualActual.map((asset) => asset.id),
    ["asset-source-tagged", "asset-frame-visual"]
  );
  assert.equal(isExpectedOutputMatched(visualExpected[0]!, visualActual), true);
  assert.equal(isExpectedOutputMatched(visualExpected[1]!, visualActual), false);
  assert.deepEqual(
    getActualOutputs(store.getState(), "audio-investigation").map((asset) => asset.id),
    ["asset-audio"]
  );
});

test("laboratory run controller dismisses successful user actions from the topbar after the success window", () => {
  const timerMock = installTimerMock();

  try {
    const eventBus = createLabEventBus();
    const store = createLabStore();
    eventBus.subscribe(function (event) {
      store.dispatch(event);
    });
    createLabRunController({
      documentRef: {} as Document,
      eventBus,
      store,
      windowRef: {} as Window,
    });

    eventBus.emit({
      type: "user-action-added",
      actionEvent: {
        id: "user-action-success",
        type: "export-clip",
        label: "Klip çıkarılıyor",
        status: "running",
        startedAt: Date.now() - 1000,
        dismissedFromHubAt: null,
        projectId: "project-1",
        requestId: "req-export-1",
        sourceAction: "export-timeline-clip",
      },
    });

    assert.equal(timerMock.scheduled.length, 0);

    eventBus.emit({
      type: "user-action-updated",
      id: "user-action-success",
      patch: {
        status: "success",
        finishedAt: Date.now(),
        message: "Klip hazır",
      },
    });

    assert.equal(timerMock.scheduled.length, 1);
    assert.equal(timerMock.scheduled[0]?.delay, LAB_USER_ACTION_HUB_SUCCESS_WINDOW_MS);
    assert.equal(store.getState().userActions[0]?.dismissedFromHubAt, null);

    timerMock.scheduled[0]?.fn();

    assert.equal(typeof store.getState().userActions[0]?.dismissedFromHubAt, "number");
  } finally {
    timerMock.restore();
  }
});

test("laboratory run controller waits for linked assets before dismissing success chips", () => {
  const timerMock = installTimerMock();

  try {
    const eventBus = createLabEventBus();
    const store = createLabStore();
    eventBus.subscribe(function (event) {
      store.dispatch(event);
    });
    createLabRunController({
      documentRef: {} as Document,
      eventBus,
      store,
      windowRef: {} as Window,
    });

    eventBus.emit({
      type: "user-action-added",
      actionEvent: {
        id: "user-action-success-pending-output",
        type: "grab-frame",
        label: "Frame alınıyor",
        status: "success",
        startedAt: Date.now() - 3000,
        finishedAt: Date.now() - 1000,
        message: "Frame alındı",
        requestId: "req-frame-success",
        resultAssetIds: ["asset-frame-result"],
        sourceAction: "export-frame-grab",
      },
    });

    assert.equal(timerMock.scheduled.length, 0);

    eventBus.emit({
      type: "asset-added",
      asset: {
        id: "asset-frame-result",
        type: "frame",
        name: "frame_01.png",
        localPath: "/tmp/frame_01.png",
        createdAt: Date.now(),
      },
    });

    assert.equal(timerMock.scheduled.length, 1);
    assert.equal(timerMock.scheduled[0]?.delay, LAB_USER_ACTION_HUB_SUCCESS_WINDOW_MS);
  } finally {
    timerMock.restore();
  }
});

test("laboratory run controller threads frozen run intent ids into tracked export actions", () => {
  const originalElement = globalThis.Element;
  const sentEvents: Array<{ eventName: string; payload: Record<string, unknown> }> = [];
  const documentRef = new FakeControllerDocument();
  const eventBus = createLabEventBus();
  const store = createLabStore();

  class TestElement extends FakeActionElement {}

  Object.defineProperty(globalThis, "Element", {
    configurable: true,
    value: TestElement,
  });

  try {
    eventBus.subscribe(function (event) {
      store.dispatch(event);
    });

    const controller = createLabRunController({
      documentRef: documentRef as unknown as Document,
      eventBus,
      store,
      windowRef: {
        roomAPI: {
          sendEvent(eventName: string, payload: Record<string, unknown>) {
            sentEvents.push({ eventName, payload });
          },
        },
        addEventListener() {},
      } as unknown as Window,
    });
    controller.attach();

    const state = store.getState() as ReturnType<typeof store.getState> & {
      run: Record<string, unknown>;
    };
    state.run = {
      id: "run-controller-intents",
      state: "running",
      startedAt: Date.now() - 1000,
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
    state.ui.workspace.roiRegions = [
      {
        id: "face",
        label: "Face",
        x: 8,
        y: 12,
        width: 120,
        height: 80,
      },
    ];
    state.ui.workspace.timelineStartMs = 1200;
    state.ui.workspace.timelineEndMs = 2400;

    const clickListener = documentRef.listeners.get("click");
    assert.ok(clickListener);

    clickListener?.({ target: new TestElement("workspace-roi-export", "face") } as Event);
    clickListener?.({ target: new TestElement("timeline-export-clip") } as Event);
    clickListener?.({ target: new TestElement("timeline-grab-frame") } as Event);
    clickListener?.({ target: new TestElement("timeline-extract-audio") } as Event);

    const mediaActions = sentEvents.filter(function (entry) {
      return entry.eventName === "media-action";
    });
    assert.equal(mediaActions.length, 4);
    assert.deepEqual(
      mediaActions.map(function (entry) {
        return (entry.payload["action"] as string) || null;
      }),
      ["export-roi-image", "export-timeline-clip", "export-frame-grab", "export-audio-track"]
    );
    mediaActions.forEach(function (entry) {
      const payload = entry.payload["payload"] as Record<string, unknown>;
      assert.deepEqual(payload["intentIds"], ["visual-inspection"]);
    });
  } finally {
    if (originalElement === undefined) {
      delete (globalThis as Record<string, unknown>).Element;
    } else {
      Object.defineProperty(globalThis, "Element", {
        configurable: true,
        value: originalElement,
      });
    }
  }
});

test("laboratory run controller previews action-linked output assets through asset-preview clicks", () => {
  const originalElement = globalThis.Element;
  const openedUrls: string[] = [];
  const documentRef = new FakeControllerDocument();
  const eventBus = createLabEventBus();
  const store = createLabStore();

  class TestElement extends FakeActionElement {}

  Object.defineProperty(globalThis, "Element", {
    configurable: true,
    value: TestElement,
  });

  try {
    eventBus.subscribe(function (event) {
      store.dispatch(event);
    });

    store.dispatch({
      type: "asset-added",
      asset: {
        id: "asset-frame-result",
        type: "frame",
        name: "frame_01.png",
        localPath: "/tmp/frame_01.png",
        createdAt: Date.now(),
      },
    });

    const controller = createLabRunController({
      documentRef: documentRef as unknown as Document,
      eventBus,
      store,
      windowRef: {
        open(url: string) {
          openedUrls.push(url);
          return null;
        },
        roomAPI: {
          sendEvent() {},
        },
        addEventListener() {},
      } as unknown as Window,
    });
    controller.attach();

    const clickListener = documentRef.listeners.get("click");
    assert.ok(clickListener);

    clickListener?.({ target: new TestElement("asset-preview", "asset-frame-result") } as Event);

    assert.deepEqual(openedUrls, ["/tmp/frame_01.png"]);
  } finally {
    if (originalElement === undefined) {
      delete (globalThis as Record<string, unknown>).Element;
    } else {
      Object.defineProperty(globalThis, "Element", {
        configurable: true,
        value: originalElement,
      });
    }
  }
});

test("laboratory run controller focuses the source preview through explicit source-preview actions", () => {
  const originalElement = globalThis.Element;
  const previewCalls: string[] = [];
  const previewElement = {
    scrollIntoView() {
      previewCalls.push("scroll");
    },
    focus() {
      previewCalls.push("focus");
    },
  };
  const documentRef = {
    listeners: new Map<string, (event: Event) => void>(),
    addEventListener(type: string, listener: EventListenerOrEventListenerObject) {
      this.listeners.set(
        type,
        typeof listener === "function"
          ? (listener as (event: Event) => void)
          : (event: Event) => listener.handleEvent(event)
      );
    },
    querySelector(selector: string) {
      return selector === "#lab-workspace-preview" ? previewElement : null;
    },
  };
  const eventBus = createLabEventBus();
  const store = createLabStore();

  class TestElement extends FakeActionElement {}

  Object.defineProperty(globalThis, "Element", {
    configurable: true,
    value: TestElement,
  });

  try {
    eventBus.subscribe(function (event) {
      store.dispatch(event);
    });

    const controller = createLabRunController({
      documentRef: documentRef as unknown as Document,
      eventBus,
      store,
      windowRef: {
        roomAPI: {
          sendEvent() {},
        },
        addEventListener() {},
      } as unknown as Window,
    });
    controller.attach();

    const clickListener = documentRef.listeners.get("click");
    assert.ok(clickListener);

    clickListener?.({ target: new TestElement("focus-source-preview", "source-active") } as Event);

    assert.deepEqual(previewCalls, ["scroll", "focus"]);
  } finally {
    if (originalElement === undefined) {
      delete (globalThis as Record<string, unknown>).Element;
    } else {
      Object.defineProperty(globalThis, "Element", {
        configurable: true,
        value: originalElement,
      });
    }
  }
});

test("laboratory run controller keeps dual preview media in sync and timeline seeks honor audio offset", async () => {
  const originalElement = globalThis.Element;
  const master = new FakeMediaElement();
  const slave = new FakeMediaElement();
  const progress = new FakeRangeElement("0", "6000");
  const volume = new FakeRangeElement("1", "1");
  const playLabel = new FakeTextElement("▶");
  const timeLabel = new FakeTextElement("00:00 / 00:06");
  const documentRef = new FakeDualPreviewDocument(
    new Map<string, unknown>([
      ['[data-lab-role="dual-preview-master"]', master],
      ['[data-lab-role="dual-preview-slave"]', slave],
      ['[data-lab-role="dual-preview-progress"]', progress],
      ['[data-lab-role="dual-preview-volume"]', volume],
      ['[data-lab-role="dual-preview-play-label"]', playLabel],
      ['[data-lab-role="dual-preview-time"]', timeLabel],
    ]),
    [master, slave]
  );
  const eventBus = createLabEventBus();
  const store = createLabStore();

  class TestElement extends FakeActionElement {}

  Object.defineProperty(globalThis, "Element", {
    configurable: true,
    value: TestElement,
  });

  try {
    master.duration = 6;
    slave.duration = 8;

    eventBus.subscribe(function (event) {
      store.dispatch(event);
    });

    const controller = createLabRunController({
      documentRef: documentRef as unknown as Document,
      eventBus,
      store,
      windowRef: {
        roomAPI: {
          sendEvent() {},
        },
        addEventListener() {},
      } as unknown as Window,
    });
    controller.attach();

    store.dispatch({
      type: "snapshot-received",
      payload: createDualPreviewSnapshot(250),
    });
    store.dispatch({
      type: "workspace-dual-preview-toggled",
      force: true,
      audioAssetId: "asset-audio-linked",
    });

    await Promise.resolve();

    assert.equal(master.muted, true);
    assert.equal(slave.volume, 1);
    assert.equal(slave.currentTime, 0.25);

    master.currentTime = 1;
    await master.play();
    assert.equal(slave.playCalls > 0, true);
    assert.equal(slave.currentTime, 1.25);

    store.dispatch({
      type: "workspace-dual-preview-volume-updated",
      volume: 0.4,
    });
    assert.equal(slave.volume, 0.4);

    const clickListener = documentRef.listeners.get("click");
    assert.ok(clickListener);
    clickListener?.({ target: new TestElement("timeline-seek", "2000") } as Event);

    assert.equal(master.currentTime, 2);
    assert.equal(slave.currentTime, 2.25);
    assert.equal(progress.value, "2000");
    assert.match(timeLabel.textContent || "", /00:02 \/ 00:06/);

    master.pause();
    assert.equal(slave.pauseCalls > 0, true);
    assert.equal(playLabel.textContent, "▶");
  } finally {
    if (originalElement === undefined) {
      delete (globalThis as Record<string, unknown>).Element;
    } else {
      Object.defineProperty(globalThis, "Element", {
        configurable: true,
        value: originalElement,
      });
    }
  }
});

test("laboratory run controller fences legacy timeline seek fallback while dual preview is active", () => {
  const originalElement = globalThis.Element;
  const standaloneMedia = new FakeMediaElement();
  const documentRef = new FakeDualPreviewDocument(new Map<string, unknown>(), [standaloneMedia]);
  const eventBus = createLabEventBus();
  const store = createLabStore();

  class TestElement extends FakeActionElement {}

  Object.defineProperty(globalThis, "Element", {
    configurable: true,
    value: TestElement,
  });

  try {
    eventBus.subscribe(function (event) {
      store.dispatch(event);
    });

    const controller = createLabRunController({
      documentRef: documentRef as unknown as Document,
      eventBus,
      store,
      windowRef: {
        roomAPI: {
          sendEvent() {},
        },
        addEventListener() {},
      } as unknown as Window,
    });
    controller.attach();

    store.dispatch({
      type: "snapshot-received",
      payload: createDualPreviewSnapshot(),
    });
    store.dispatch({
      type: "workspace-dual-preview-toggled",
      force: true,
      audioAssetId: "asset-audio-linked",
    });

    const clickListener = documentRef.listeners.get("click");
    assert.ok(clickListener);

    clickListener?.({ target: new TestElement("timeline-seek", "2000") } as Event);

    assert.equal(standaloneMedia.currentTime, 0);
    assert.equal(
      store.getState().activityFeed.some((entry) =>
        entry.message.includes("Dual preview seek is unavailable")
      ),
      true
    );
  } finally {
    if (originalElement === undefined) {
      delete (globalThis as Record<string, unknown>).Element;
    } else {
      Object.defineProperty(globalThis, "Element", {
        configurable: true,
        value: originalElement,
      });
    }
  }
});

test("laboratory run controller waits for slave metadata before applying dual preview seeks", async () => {
  const originalElement = globalThis.Element;
  const master = new FakeMediaElement();
  const slave = new FakeMediaElement();
  slave.readyState = 0;
  const documentRef = new FakeDualPreviewDocument(
    new Map<string, unknown>([
      ['[data-lab-role="dual-preview-master"]', master],
      ['[data-lab-role="dual-preview-slave"]', slave],
    ]),
    [master, slave]
  );
  const eventBus = createLabEventBus();
  const store = createLabStore();

  class TestElement extends FakeActionElement {}

  Object.defineProperty(globalThis, "Element", {
    configurable: true,
    value: TestElement,
  });

  try {
    master.duration = 6;
    slave.duration = 8;

    eventBus.subscribe(function (event) {
      store.dispatch(event);
    });

    const controller = createLabRunController({
      documentRef: documentRef as unknown as Document,
      eventBus,
      store,
      windowRef: {
        roomAPI: {
          sendEvent() {},
        },
        addEventListener() {},
      } as unknown as Window,
    });
    controller.attach();

    store.dispatch({
      type: "snapshot-received",
      payload: createDualPreviewSnapshot(500),
    });
    store.dispatch({
      type: "workspace-dual-preview-toggled",
      force: true,
      audioAssetId: "asset-audio-linked",
    });

    master.currentTime = 2;
    master.dispatch("seeked");
    assert.equal(slave.currentTime, 0);

    slave.readyState = 1;
    slave.dispatch("loadedmetadata");
    await Promise.resolve();

    assert.equal(slave.currentTime, 2.5);
  } finally {
    if (originalElement === undefined) {
      delete (globalThis as Record<string, unknown>).Element;
    } else {
      Object.defineProperty(globalThis, "Element", {
        configurable: true,
        value: originalElement,
      });
    }
  }
});

test("laboratory run controller pauses the master if the dual preview slave ends early", () => {
  const originalElement = globalThis.Element;
  const master = new FakeMediaElement();
  const slave = new FakeMediaElement();
  const documentRef = new FakeDualPreviewDocument(
    new Map<string, unknown>([
      ['[data-lab-role="dual-preview-master"]', master],
      ['[data-lab-role="dual-preview-slave"]', slave],
    ]),
    [master, slave]
  );
  const eventBus = createLabEventBus();
  const store = createLabStore();

  Object.defineProperty(globalThis, "Element", {
    configurable: true,
    value: FakeActionElement,
  });

  try {
    master.duration = 6;
    slave.duration = 3;

    eventBus.subscribe(function (event) {
      store.dispatch(event);
    });

    const controller = createLabRunController({
      documentRef: documentRef as unknown as Document,
      eventBus,
      store,
      windowRef: {
        roomAPI: {
          sendEvent() {},
        },
        addEventListener() {},
      } as unknown as Window,
    });
    controller.attach();

    store.dispatch({
      type: "snapshot-received",
      payload: createDualPreviewSnapshot(),
    });
    store.dispatch({
      type: "workspace-dual-preview-toggled",
      force: true,
      audioAssetId: "asset-audio-linked",
    });

    master.paused = false;
    slave.dispatch("ended");

    assert.equal(master.pauseCalls > 0, true);
    assert.equal(master.paused, true);
  } finally {
    if (originalElement === undefined) {
      delete (globalThis as Record<string, unknown>).Element;
    } else {
      Object.defineProperty(globalThis, "Element", {
        configurable: true,
        value: originalElement,
      });
    }
  }
});

test("laboratory run controller does not spam slave autoplay retries after a blocked attempt", async () => {
  const originalElement = globalThis.Element;
  const master = new FakeMediaElement();
  const slave = new FakeMediaElement();
  slave.failPlay = true;
  const documentRef = new FakeDualPreviewDocument(
    new Map<string, unknown>([
      ['[data-lab-role="dual-preview-master"]', master],
      ['[data-lab-role="dual-preview-slave"]', slave],
    ]),
    [master, slave]
  );
  const eventBus = createLabEventBus();
  const store = createLabStore();

  Object.defineProperty(globalThis, "Element", {
    configurable: true,
    value: FakeActionElement,
  });

  try {
    master.duration = 6;
    slave.duration = 6;

    eventBus.subscribe(function (event) {
      store.dispatch(event);
    });

    const controller = createLabRunController({
      documentRef: documentRef as unknown as Document,
      eventBus,
      store,
      windowRef: {
        roomAPI: {
          sendEvent() {},
        },
        addEventListener() {},
      } as unknown as Window,
    });
    controller.attach();

    store.dispatch({
      type: "snapshot-received",
      payload: createDualPreviewSnapshot(),
    });
    store.dispatch({
      type: "workspace-dual-preview-toggled",
      force: true,
      audioAssetId: "asset-audio-linked",
    });

    await master.play();
    await Promise.resolve();
    const firstPlayCalls = slave.playCalls;

    master.dispatch("timeupdate");
    await Promise.resolve();
    assert.equal(slave.playCalls, firstPlayCalls);

    slave.failPlay = false;
    master.pause();
    await master.play();
    await Promise.resolve();
    assert.equal(slave.playCalls > firstPlayCalls, true);
  } finally {
    if (originalElement === undefined) {
      delete (globalThis as Record<string, unknown>).Element;
    } else {
      Object.defineProperty(globalThis, "Element", {
        configurable: true,
        value: originalElement,
      });
    }
  }
});

test("laboratory store wires live findings and preview artifacts from custom runtime events", () => {
  const store = createLabStore();
  const eventTimestamp = Date.now();
  store.dispatch({
    type: "host-event-received",
    event: {
      id: "evt-scope",
      kind: "analysis-scope-updated",
      severity: "info",
      message: "Analysis scope locked",
      detail: "Visual ROI active",
      timestamp: eventTimestamp,
      source: "host",
      action: "process-run",
      stage: "running",
      scope: "run",
      moduleId: null,
      rawLine: null,
      analysisScope: {
        focus: "visual",
        hypothesis: "gorunmeyen obje olabilir",
        region: {
          x: 12,
          y: 18,
          width: 160,
          height: 90,
        },
      },
    },
  });
  store.dispatch({
    type: "host-event-received",
    event: {
      id: "evt-live",
      kind: "live-finding",
      severity: "warning",
      message: "Live finding emitted",
      detail: "Edge cluster batched",
      timestamp: eventTimestamp + 1,
      source: "host",
      action: "process-run",
      stage: "running",
      scope: "run",
      moduleId: "motion",
      rawLine: null,
      finding: {
        id: "finding-live-1",
        moduleId: "motion",
        title: "Edge cluster anomaly",
        detail: "Contrast window exposed a hidden contour.",
        level: "medium",
        confidence: "medium",
        kind: "derived",
        evidenceCount: 3,
        artifactIds: ["preview-live-1"],
        frameRange: {
          startFrame: 12,
          endFrame: 24,
        },
      },
      moduleTrace: {
        id: "trace-live-1",
        moduleId: "motion",
        stage: "process",
        status: "finding",
        timestamp: new Date(eventTimestamp + 1).toISOString(),
        message: "Live finding emitted",
        detail: "Edge cluster batched",
      },
      throttleWindow: "motion-module-batch",
    },
  });
  store.dispatch({
    type: "host-event-received",
    event: {
      id: "evt-preview",
      kind: "preview-artifact",
      severity: "info",
      message: "Preview artifact ready",
      detail: "Frame preview",
      timestamp: eventTimestamp + 2,
      source: "host",
      action: "process-run",
      stage: "running",
      scope: "run",
      moduleId: "motion",
      rawLine: null,
      artifact: {
        id: "preview-live-1",
        moduleId: "motion",
        kind: "frame-preview",
        label: "Frame preview",
        path: "/tmp/frame-preview.png",
        fileName: "frame-preview.png",
        previewUrl: "file:///tmp/frame-preview.png",
        createdAt: new Date(eventTimestamp + 2).toISOString(),
        active: true,
      },
    },
  });

  const state = store.getState();
  assert.equal(state.run?.analysisScope?.focus, "visual");
  assert.equal(state.run?.analysisScope?.hypothesis, "gorunmeyen obje olabilir");
  assert.equal(state.run?.liveFindings[0]?.id, "finding-live-1");
  assert.equal(state.run?.liveFindings[0]?.windowKey, "motion-module-batch");
  assert.equal(state.run?.previewArtifacts[0]?.id, "preview-live-1");
  assert.equal(state.ui.activePreviewArtifactId, "preview-live-1");
  assert.equal(
    state.run?.moduleTrace.some(function (entry) {
      return entry.id === "trace-live-1";
    }),
    true
  );
});

test("laboratory store hydration normalizes live runs into safe persisted summaries", () => {
  const store = createLabStore();
  store.dispatch({
    type: "hydrate",
    payload: {
      currentStage: "process",
      featureId: "media-analysis",
      projectIndex: {
        activeProjectId: "project-1",
        projects: [],
      },
      workbench: {},
      sourceProbeStatus: "idle",
      reports: {
        user: null,
        ai: null,
        emptyReason: "Rapor yok.",
      },
      activityFeed: [],
      lastRun: {
        id: "run-1",
        state: "running",
        startedAt: Date.now() - 1000,
        modules: {
          motion: {
            id: "motion",
            status: "running",
            progress: null,
            progressMode: "none",
            message: "Analiz suruyor",
          },
        },
        moduleOrder: ["motion"],
        events: [
          {
            id: "evt-persisted",
            kind: "activity",
            severity: "info",
            message: "Analiz basladi",
            detail: null,
            timestamp: Date.now() - 900,
            source: "host",
            action: "process-run",
            stage: "running",
            scope: "run",
            moduleId: null,
            rawLine: null,
          },
          {
            id: "evt-raw",
            kind: "raw-log",
            severity: "info",
            message: "frame= 24",
            detail: null,
            timestamp: Date.now() - 800,
            source: "host",
            action: "process-run",
            stage: "stdout",
            scope: "run",
            moduleId: "motion",
            rawLine: "frame= 24",
          },
        ],
        rawLog: [
          {
            id: "evt-raw",
            kind: "raw-log",
            severity: "info",
            message: "frame= 24",
            detail: null,
            timestamp: Date.now() - 800,
            source: "host",
            action: "process-run",
            stage: "stdout",
            scope: "run",
            moduleId: "motion",
            rawLine: "frame= 24",
          },
        ],
        artifacts: [],
        findings: [],
        liveFindings: [
          {
            id: "live-1",
            moduleId: "motion",
            title: "Scope-local anomaly",
            detail: "Frame window highlighted an unstable edge cluster.",
            level: "medium",
            severity: "warning",
            confidence: "medium",
            kind: "derived",
            evidenceCount: 2,
            artifactIds: [],
            emittedAt: Date.now() - 850,
            windowKey: "frame-window-1",
            streamId: "media-analysis",
            frameRange: {
              startFrame: 24,
              endFrame: 48,
            },
          },
        ],
        warnings: [],
        error: null,
        targetLabel: null,
        progress: null,
        emptyReason: null,
        analysisScope: {
          frameRange: {
            startFrame: 24,
            endFrame: 48,
          },
          focus: "visual",
          hypothesis: "Gorunmeyen obje olabilir",
        },
        previewArtifacts: [
          {
            id: "preview-1",
            moduleId: "motion",
            kind: "frame-preview",
            label: "Frame preview",
            path: "/tmp/frame-preview.png",
            fileName: "frame-preview.png",
            previewUrl: "file:///tmp/frame-preview.png",
            createdAt: new Date(Date.now() - 750).toISOString(),
            status: "ready",
            active: true,
            region: {
              x: 10,
              y: 20,
              width: 120,
              height: 90,
            },
          },
        ],
        confidence: "medium",
        moduleTrace: [
          {
            id: "trace-1",
            moduleId: "motion",
            stage: "process",
            status: "running",
            timestamp: new Date(Date.now() - 950).toISOString(),
            message: "Frame batch analyzed",
            detail: "Window aggregation active",
            eventId: "evt-persisted",
          },
        ],
        comparisonVariants: [
          {
            id: "variant-1",
            kind: "gamma-scan",
            label: "Gamma Scan",
            status: "ready",
            summary: "Mid-band emphasis",
            artifactIds: ["preview-1"],
          },
        ],
        hypothesisSummary: "Gorunmeyen obje olabilir",
      },
    },
  });

  const state = store.getState();
  assert.equal(state.run?.state, "cancelled");
  assert.equal(state.run?.modules["motion"]?.status, "cancelled");
  assert.equal(state.run?.events.length, 1);
  assert.equal(state.run?.events[0]?.kind, "activity");
  assert.equal(state.run?.rawLog.length, 1);
  assert.equal(state.run?.analysisScope?.focus, "visual");
  assert.equal(state.run?.analysisScope?.lifecycle?.mutable, false);
  assert.equal(state.run?.liveFindings[0]?.windowKey, "frame-window-1");
  assert.equal(state.run?.previewArtifacts[0]?.kind, "frame-preview");
  assert.equal(state.run?.comparisonVariants[0]?.kind, "gamma-scan");
  assert.equal(state.run?.hypothesisSummary, "Gorunmeyen obje olabilir");
});

test("laboratory selectors expose frozen snapshot summary and live workspace drift separately", () => {
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
      workspace: {
        ...baseWorkspace,
        timelineStartMs: 2400,
        timelineEndMs: 5600,
        hypothesis: "live workspace clue",
        selectedIntents: ["visual-inspection"],
      },
      reports: {
        user: {
          summary: "ready",
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
      activityFeed: [],
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

  const state = store.getState();
  assert.deepEqual(getRunSnapshotSummary(state), {
    focus: "visual",
    timelineStartMs: 1200,
    timelineEndMs: 5400,
    hypothesis: "frozen clue",
    intentIds: ["visual-inspection", "anomaly-detection"],
  });
  assert.deepEqual(getIntentDirtyMap(state), {
    "visual-inspection": {
      intentId: "visual-inspection",
      inSnapshot: true,
      inWorkspace: true,
      dirty: true,
      changedKeys: ["timeline", "hypothesis"],
    },
    "anomaly-detection": {
      intentId: "anomaly-detection",
      inSnapshot: true,
      inWorkspace: false,
      dirty: true,
      changedKeys: ["selection", "timeline", "hypothesis"],
    },
  });
  assert.deepEqual(getWorkspaceDiff(state), {
    timelineChanged: true,
    hypothesisChanged: true,
    intentsChanged: true,
    workspaceDirty: true,
    changedKeys: ["timeline", "hypothesis", "intents"],
  });
  assert.deepEqual(getReportFreshness(state), {
    state: "current",
    workspaceDirty: true,
  });
  assert.deepEqual(state.run?.analysisScope?.intentIds, ["visual-inspection", "anomaly-detection"]);
  assert.deepEqual(state.ui.workspace.selectedIntents, ["visual-inspection"]);
});
