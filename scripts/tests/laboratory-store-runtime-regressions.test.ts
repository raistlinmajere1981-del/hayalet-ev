import {
  assert,
  createDualPreviewSnapshot,
  createLabHostBridge,
  createLabStore,
  extractFindings,
  getActionOutputs,
  getActualOutputs,
  getAssetById,
  getAssets,
  getAssetsByRun,
  getAssetsBySource,
  getAssetsByType,
  getCurrentSourceAsset,
  getDualPreviewVolume,
  getExpectedOutputs,
  getLinkedAudioAssets,
  getParentSourceForAsset,
  getSelectedDualPreviewAudioAsset,
  getSelectionIntent,
  isDualPreviewActive,
  isDualPreviewAvailable,
  isExpectedOutputMatched,
  parseProcessOutput,
  test,
} from "./laboratory-runtime-truth.helpers.ts";

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

test("laboratory hydrate reconstructs an active selection from a valid persisted primitive range", () => {
  const store = createLabStore();

  store.dispatch({
    type: "hydrate",
    payload: {
      currentStage: "source",
      featureId: "media-analysis",
      projectIndex: {
        activeProjectId: null,
        projects: [],
      },
      workbench: {},
      sourceProbeStatus: "idle",
      reports: {
        user: null,
        ai: null,
        emptyReason: "Rapor henüz üretilmedi.",
      },
      activityFeed: [],
      workspace: {
        timelineStartMs: 2400,
        timelineEndMs: 5600,
        activeSelection: {
          id: "selection-persisted",
          startMs: 2400,
          endMs: 5600,
          type: "focus",
          label: "Door latch",
          roi: {
            x: 0.1,
            y: 0.2,
            width: 0.35,
            height: 0.4,
          },
          createdAt: 1700000000000,
        },
      },
    },
  });

  assert.deepEqual(store.getState().ui.workspace.activeSelection, {
    id: "selection-persisted",
    startMs: 2400,
    endMs: 5600,
    type: "focus",
    intent: "general",
    label: "Door latch",
    roi: {
      x: 0.1,
      y: 0.2,
      width: 0.35,
      height: 0.4,
    },
    createdAt: 1700000000000,
  });
});

test("laboratory hydrate drops legacy pixel-like persisted selection roi values", () => {
  const store = createLabStore();

  store.dispatch({
    type: "hydrate",
    payload: {
      currentStage: "source",
      featureId: "media-analysis",
      projectIndex: {
        activeProjectId: null,
        projects: [],
      },
      workbench: {},
      sourceProbeStatus: "idle",
      reports: {
        user: null,
        ai: null,
        emptyReason: "Rapor henüz üretilmedi.",
      },
      activityFeed: [],
      workspace: {
        timelineStartMs: 2400,
        timelineEndMs: 5600,
        activeSelection: {
          id: "selection-persisted",
          startMs: 2400,
          endMs: 5600,
          type: "focus",
          roi: {
            x: 10,
            y: 20,
            width: 80,
            height: 60,
          },
          createdAt: 1700000000000,
        },
      },
    },
  });

  assert.equal(store.getState().ui.workspace.activeSelection?.roi, undefined);
});

test("laboratory hydrate rebuilds selection identity from the primitive bridge on rehydrate", () => {
  const store = createLabStore();
  const originalDateNow = Date.now;

  try {
    Date.now = () => 1700000000000;
    store.dispatch({
      type: "workspace-timeline-updated",
      startMs: 1000,
      endMs: 3000,
    });

    const initialSelection = store.getState().ui.workspace.activeSelection;
    assert.ok(initialSelection);

    Date.now = () => 1700000005000;
    store.dispatch({
      type: "hydrate",
      payload: {
        currentStage: "source",
        featureId: "media-analysis",
        projectIndex: {
          activeProjectId: null,
          projects: [],
        },
        workbench: {},
        sourceProbeStatus: "idle",
        reports: {
          user: null,
          ai: null,
          emptyReason: "Rapor henüz üretilmedi.",
        },
        activityFeed: [],
        workspace: {
          timelineStartMs: 2400,
          timelineEndMs: 5600,
        },
      },
    });

    const rehydratedSelection = store.getState().ui.workspace.activeSelection;
    assert.ok(rehydratedSelection);
    assert.equal(rehydratedSelection?.startMs, 2400);
    assert.equal(rehydratedSelection?.endMs, 5600);
    assert.equal(rehydratedSelection?.type, "clip");
    assert.equal(rehydratedSelection?.intent, "general");
    assert.notEqual(rehydratedSelection?.id, initialSelection?.id);
    assert.equal(rehydratedSelection?.createdAt, 1700000005000);
  } finally {
    Date.now = originalDateNow;
  }
});

test("laboratory hydrate normalizes malformed persisted selection intent to general", () => {
  const store = createLabStore();

  store.dispatch({
    type: "hydrate",
    payload: {
      currentStage: "source",
      featureId: "media-analysis",
      projectIndex: {
        activeProjectId: null,
        projects: [],
      },
      workbench: {},
      sourceProbeStatus: "idle",
      reports: {
        user: null,
        ai: null,
        emptyReason: "Rapor henüz üretilmedi.",
      },
      activityFeed: [],
      workspace: {
        timelineStartMs: 1500,
        timelineEndMs: 3600,
        activeSelection: {
          id: "selection-persisted-invalid-intent",
          startMs: 1500,
          endMs: 3600,
          type: "inspect",
          intent: "not-real",
          createdAt: 1700000000042,
        },
      },
    },
  });

  assert.equal(store.getState().ui.workspace.activeSelection?.intent, "general");
  assert.equal(getSelectionIntent(store.getState()), "general");
});

test("laboratory hydrate suppresses persisted selection entities when the primitive range is invalid", () => {
  const store = createLabStore();

  store.dispatch({
    type: "hydrate",
    payload: {
      currentStage: "source",
      featureId: "media-analysis",
      projectIndex: {
        activeProjectId: null,
        projects: [],
      },
      workbench: {},
      sourceProbeStatus: "idle",
      reports: {
        user: null,
        ai: null,
        emptyReason: "Rapor henüz üretilmedi.",
      },
      activityFeed: [],
      workspace: {
        timelineStartMs: 5600,
        timelineEndMs: 2400,
        activeSelection: {
          id: "selection-invalid",
          startMs: 5600,
          endMs: 2400,
          type: "inspect",
          createdAt: 1700000000001,
        },
      },
    },
  });

  assert.equal(store.getState().ui.workspace.timelineStartMs, 5600);
  assert.equal(store.getState().ui.workspace.timelineEndMs, null);
  assert.equal(store.getState().ui.workspace.activeSelection, null);
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
