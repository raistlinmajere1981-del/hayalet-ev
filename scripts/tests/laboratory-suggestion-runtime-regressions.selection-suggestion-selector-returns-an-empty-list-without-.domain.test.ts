import { assert, createLabStore, getActiveSuggestionPreview, getEffectiveActiveSelection, getSelectionSuggestions, getWaveformTimelineModel, renderWorkspaceSurface, test } from "./laboratory-runtime-truth.helpers.ts";


function collectPersistedKeys(value: unknown, keys: string[] = []) {
  if (value === null || typeof value !== "object") {
    return keys;
  }
  if (Array.isArray(value)) {
    for (const item of value) {
      collectPersistedKeys(item, keys);
    }
    return keys;
  }
  for (const [key, child] of Object.entries(value)) {
    keys.push(key);
    collectPersistedKeys(child, keys);
  }
  return keys;
}

function hydrateReadySource(
  store: ReturnType<typeof createLabStore>,
  source: {
    kind: "audio" | "video" | "image";
    metadata?: Record<string, unknown>;
    path: string;
  }
) {
  store.dispatch({
    type: "hydrate",
    payload: {
      featureId: "media-analysis",
      projectIndex: {
        activeProjectId: `project-default-${source.kind}`,
        projects: [],
      },
      workbench: {},
      source: {
        status: "ready",
        kind: source.kind,
        mode: "local",
        routeLabel: "Local Copy",
        storedPath: source.path,
        metadata: source.metadata ?? {},
      },
      sourceProbeStatus: "completed",
      workspace: {},
      reports: {
        user: null,
        ai: null,
        emptyReason: null,
      },
      activityFeed: [],
      lastRun: null,
    },
  });
}


describe("selection suggestion selector returns an empty list without a valid selection", () => {
void test("selection suggestion selector returns an empty list without a valid selection", () => {
  const store = createLabStore();

  assert.deepEqual(getSelectionSuggestions(store.getState()), []);
  assert.deepEqual(getWaveformTimelineModel(store.getState()).selectionSuggestions , []);
});
void test("selection suggestion selector falls back to the full source scope without a manual selection", () => {
  const audioStore = createLabStore();
  hydrateReadySource(audioStore, {
    kind: "audio",
    path: "/tmp/source.wav",
    metadata: { durationSeconds: 4 },
  });

  assert.equal(audioStore.getState().ui.workspace.activeSelection, null);
  assert.deepEqual(getSelectionSuggestions(audioStore.getState()), [
    {
      id: "analyze-anomaly",
      label: "Anomaliyi analiz et",
      actionType: "analyze-segment",
      confidence: 0.9,
    },
    {
      id: "audio-inspect",
      label: "Ses detaylarini incele",
      actionType: "inspect-audio",
      confidence: 0.9,
    },
  ]);
  assert.deepEqual(getEffectiveActiveSelection(audioStore.getState()), {
    id: "selection-default:full-audio",
    startMs: 0,
    endMs: 4000,
    type: "clip",
    createdAt: 0,
  });
  assert.equal(
    getWaveformTimelineModel(audioStore.getState()).selectionSuggestions.some(function (
      suggestion
    ) {
      return suggestion.id === "clean-audio";
    }),
    false
  );
  assert.equal(
    getWaveformTimelineModel(audioStore.getState()).selectionSuggestions.some(function (
      suggestion
    ) {
      return suggestion.id === "metadata-audit";
    }),
    true
  );

  const videoStore = createLabStore();
  hydrateReadySource(videoStore, {
    kind: "video",
    path: "/tmp/source.mp4",
    metadata: { durationSeconds: 9 },
  });

  assert.deepEqual(getSelectionSuggestions(videoStore.getState()), [
    {
      id: "analyze-anomaly",
      label: "Anomaliyi analiz et",
      actionType: "analyze-segment",
      confidence: 0.9,
    },
    {
      id: "motion-check",
      label: "Hareket tutarliligini incele",
      actionType: "analyze-segment",
      confidence: 0.85,
    },
    {
      id: "audio-inspect",
      label: "Ses detaylarini incele",
      actionType: "inspect-audio",
      confidence: 0.9,
    },
    {
      id: "enhance-visual",
      label: "Goruntuyu iyilestir",
      actionType: "enhance-visual",
      confidence: 0.8,
    },
    {
      id: "extract-clip",
      label: "Bu bolumu kes",
      actionType: "extract-clip",
      confidence: 0.6,
    },
  ]);
  assert.equal(getEffectiveActiveSelection(videoStore.getState())?.endMs, 9000);
  assert.equal(
    getWaveformTimelineModel(videoStore.getState()).selectionSuggestions.some(function (
      suggestion
    ) {
      return suggestion.id === "detect-scenes";
    }),
    true
  );

  const imageStore = createLabStore();
  hydrateReadySource(imageStore, {
    kind: "image",
    path: "/tmp/source.png",
  });

  assert.deepEqual(getEffectiveActiveSelection(imageStore.getState())?.roi, {
    x: 0,
    y: 0,
    width: 1,
    height: 1,
  });
  assert.deepEqual(getSelectionSuggestions(imageStore.getState()), [
    {
      id: "analyze-anomaly",
      label: "Anomaliyi analiz et",
      actionType: "analyze-segment",
      confidence: 0.94,
    },
    {
      id: "enhance-visual",
      label: "Goruntuyu iyilestir",
      toolHint: "Enhance clarity",
      actionType: "enhance-visual",
      confidence: 0.86,
    },
    {
      id: "inspect-region",
      label: "Secili bolgeyi incele",
      toolHint: "Focus region",
      actionType: "focus-region",
      confidence: 0.82,
    },
  ]);
  assert.equal(
    getWaveformTimelineModel(imageStore.getState()).selectionSuggestions.some(function (
      suggestion
    ) {
      return suggestion.id === "crop-region";
    }),
    false
  );
});
void test("selection tab renders default full-source suggestions without mutating active selection", () => {
  const store = createLabStore();
  hydrateReadySource(store, {
    kind: "audio",
    path: "/tmp/source.wav",
    metadata: { durationSeconds: 5 },
  });

  const surface = renderWorkspaceSurface(store.getState());

  assert.equal(store.getState().ui.workspace.activeSelection, null);
  assert.match(surface.side, /class="lab-selection-panel/);
  assert.match(surface.side, /00:00\.000/);
  assert.match(surface.side, /00:05\.000/);
  assert.match(surface.side, /data-lab-selection-suggestion="audio-inspect"/);
  assert.match(surface.side, /data-lab-selection-suggestion="metadata-audit"/);
  assert.doesNotMatch(surface.side, /data-lab-selection-suggestion="clean-audio"/);

  store.dispatch({
    type: "workspace-selection-suggestion-preview-set",
    suggestionId: "metadata-audit",
  });

  assert.equal(store.getState().ui.activeSuggestionPreviewId, "metadata-audit");
  assert.equal(
    getActiveSuggestionPreview(store.getState())?.title,
    "Metadata kontrolu hazirlanacak"
  );
});
void test("selection suggestion selector provides a general fallback for timeline media", () => {
  const store = createLabStore();

  store.dispatch({
    type: "source-config-patched",
    patch: {
      kind: "audio",
      mode: "local",
      storedPath: "/tmp/source.wav",
    },
  });
  store.dispatch({
    type: "workspace-timeline-updated",
    startMs: 1000,
    endMs: 3000,
  });

  assert.deepEqual(getSelectionSuggestions(store.getState()), [
    {
      id: "analyze-anomaly",
      label: "Anomaliyi analiz et",
      actionType: "analyze-segment",
      confidence: 0.9,
    },
    {
      id: "audio-inspect",
      label: "Ses detaylarini incele",
      actionType: "inspect-audio",
      confidence: 0.9,
    },
  ]);
});
});
