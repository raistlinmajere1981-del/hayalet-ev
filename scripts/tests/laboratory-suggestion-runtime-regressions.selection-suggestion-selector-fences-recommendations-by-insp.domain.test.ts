import { assert, buildSuggestionPreview, createLabStore, getActiveSuggestionPreview, getSelectionSuggestions, getWaveformTimelineModel, test } from "./laboratory-runtime-truth.helpers.ts";

import type { LabActionSuggestion, LabSelection } from "./laboratory-runtime-truth.helpers.ts";

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


describe("selection suggestion selector fences recommendations by inspection mode and medi", () => {
void test("selection suggestion selector fences recommendations by inspection mode and media kind", () => {
  const audioStore = createLabStore();
  audioStore.dispatch({
    type: "source-config-patched",
    patch: {
      kind: "audio",
      mode: "local",
      storedPath: "/tmp/source.wav",
    },
  });
  audioStore.dispatch({
    type: "workspace-timeline-updated",
    startMs: 1000,
    endMs: 3000,
  });
  audioStore.dispatch({
    type: "selection-inspection-mode-updated",
    mode: "audio",
  });

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
      confidence: 0.93,
    },
  ]);

  const imageStore = createLabStore();
  imageStore.dispatch({
    type: "source-config-patched",
    patch: {
      kind: "image",
      mode: "local",
      storedPath: "/tmp/source.png",
    },
  });
  imageStore.dispatch({
    type: "workspace-timeline-updated",
    startMs: 1000,
    endMs: 3000,
  });
  imageStore.dispatch({
    type: "selection-inspection-mode-updated",
    mode: "audio",
  });

  assert.deepEqual(getSelectionSuggestions(imageStore.getState()), [
    {
      id: "analyze-anomaly",
      label: "Anomaliyi analiz et",
      actionType: "analyze-segment",
      confidence: 0.9,
    },
    {
      id: "enhance-visual",
      label: "Goruntuyu iyilestir",
      actionType: "enhance-visual",
      confidence: 0.8,
    },
    {
      id: "focus-region",
      label: "Bolgeye odaklan",
      actionType: "focus-region",
      confidence: 0.58,
    },
  ]);

  imageStore.dispatch({
    type: "selection-inspection-mode-updated",
    mode: "none",
  });

  assert.deepEqual(getSelectionSuggestions(imageStore.getState()), [
    {
      id: "analyze-anomaly",
      label: "Anomaliyi analiz et",
      actionType: "analyze-segment",
      confidence: 0.9,
    },
    {
      id: "enhance-visual",
      label: "Goruntuyu iyilestir",
      actionType: "enhance-visual",
      confidence: 0.8,
    },
    {
      id: "focus-region",
      label: "Bolgeye odaklan",
      actionType: "focus-region",
      confidence: 0.58,
    },
  ]);

  imageStore.dispatch({
    type: "selection-inspection-mode-updated",
    mode: "none",
  });

  assert.deepEqual(getSelectionSuggestions(imageStore.getState()), [
    {
      id: "analyze-anomaly",
      label: "Anomaliyi analiz et",
      actionType: "analyze-segment",
      confidence: 0.9,
    },
    {
      id: "enhance-visual",
      label: "Goruntuyu iyilestir",
      actionType: "enhance-visual",
      confidence: 0.8,
    },
    {
      id: "focus-region",
      label: "Bolgeye odaklan",
      actionType: "focus-region",
      confidence: 0.58,
    },
  ]);

  imageStore.dispatch({
    type: "selection-inspection-mode-updated",
    mode: "visual",
  });

  assert.deepEqual(getSelectionSuggestions(imageStore.getState()), [
    {
      id: "analyze-anomaly",
      label: "Anomaliyi analiz et",
      actionType: "analyze-segment",
      confidence: 0.9,
    },
    {
      id: "enhance-visual",
      label: "Goruntuyu iyilestir",
      actionType: "enhance-visual",
      confidence: 0.86,
    },
    {
      id: "focus-region",
      label: "Bolgeye odaklan",
      actionType: "focus-region",
      confidence: 0.58,
    },
  ]);
});
void test("selection suggestion selector boosts region-aware visual and motion guidance", () => {
  const videoStore = createLabStore();
  videoStore.dispatch({
    type: "source-config-patched",
    patch: {
      kind: "video",
      mode: "local",
      storedPath: "/tmp/source.mp4",
    },
  });
  videoStore.dispatch({
    type: "workspace-timeline-updated",
    startMs: 1000,
    endMs: 3000,
  });
  videoStore.dispatch({
    type: "selection-inspection-mode-updated",
    mode: "motion",
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
      confidence: 0.92,
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

  videoStore.dispatch({
    type: "selection-roi-updated",
    roi: {
      x: 0.25,
      y: 0.2,
      width: 0.2,
      height: 0.25,
    },
  });
  videoStore.dispatch({
    type: "selection-inspection-mode-updated",
    mode: "motion",
  });

  assert.deepEqual(getSelectionSuggestions(videoStore.getState()), [
    {
      id: "analyze-anomaly",
      label: "Anomaliyi analiz et",
      actionType: "analyze-segment",
      confidence: 0.94,
    },
    {
      id: "motion-check",
      label: "Hareket tutarliligini incele",
      toolHint: "Inspect motion",
      actionType: "analyze-segment",
      confidence: 0.92,
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
      toolHint: "Enhance clarity",
      actionType: "enhance-visual",
      confidence: 0.86,
    },
    {
      id: "inspect-region",
      label: "Secili bolgeyi incele",
      toolHint: "Focus region",
      actionType: "focus-region",
      confidence: 0.88,
    },
    {
      id: "stabilize-region",
      label: "Segmenti stabilize et",
      toolHint: "Stabilize segment",
      actionType: "stabilize-segment",
      confidence: 0.72,
    },
    {
      id: "extract-clip",
      label: "Bu bolumu kes",
      actionType: "extract-clip",
      confidence: 0.6,
    },
  ]);
});
void test("suggestion preview builder returns a dry-run plan for supported actions", () => {
  const selection: LabSelection = {
    id: "selection-preview",
    startMs: 1200,
    endMs: 7800,
    type: "clip",
    createdAt: 1700000000000,
  };
  const fallbackSuggestion = {
    id: "custom-fallback",
    label: "Custom fallback",
    actionType: "unknown-action" as LabActionSuggestion["actionType"],
    confidence: 0.2,
  };

  assert.deepEqual(
    buildSuggestionPreview(
      {
        id: "analyze-anomaly",
        label: "Anomaliyi analiz et",
        actionType: "analyze-segment",
        confidence: 0.9,
      },
      selection
    ),
    {
      suggestionId: "analyze-anomaly",
      title: "Segment analiz edilecek",
      steps: [
        "6.6s secim hazirlanacak",
        "Gorsel ve/veya ses sinyalleri ayristirilacak",
        "Anomali veya tutarsizlik incelemesi hazirlanacak",
      ],
      expectedOutputs: [
        "Analiz raporu",
        "Tespit edilen bulgular",
        "Ilgili frame veya segment referanslari",
      ],
      estimatedCost: "medium",
    }
  );

  assert.deepEqual(
    buildSuggestionPreview(
      {
        id: "audio-inspect",
        label: "Ses detaylarini incele",
        actionType: "inspect-audio",
        confidence: 0.9,
      },
      selection
    ),
    {
      suggestionId: "audio-inspect",
      title: "Ses analizi yapilacak",
      steps: [
        "6.6s secim hazirlanacak",
        "Ses track izole edilecek",
        "Frekans ve yogunluk taramasi hazirlanacak",
        "Ani degisim noktalarina bakilacak",
      ],
      expectedOutputs: ["Ses analizi raporu", "Olasi anomali noktalari"],
      estimatedCost: "low",
    }
  );

  assert.deepEqual(
    buildSuggestionPreview(
      {
        id: "extract-clip",
        label: "Bu bolumu kes",
        actionType: "extract-clip",
        confidence: 0.68,
      },
      selection
    ),
    {
      suggestionId: "extract-clip",
      title: "Clip olusturulacak",
      steps: ["6.6s secim hazirlanacak", "Secilen segment yeni bir clip olarak hazirlanacak"],
      expectedOutputs: ["Video clip"],
      estimatedCost: "low",
    }
  );

  assert.deepEqual(
    buildSuggestionPreview(
      {
        id: "focus-region",
        label: "Bolgeye odaklan",
        actionType: "focus-region",
        confidence: 0.66,
      },
      selection
    ),
    {
      suggestionId: "focus-region",
      title: "Bolge incelemesi hazirlanacak",
      steps: [
        "6.6s secim hazirlanacak",
        "Secili goruntu bolgesi izole edilecek",
        "Bolgeye odakli gorsel inceleme hazirlanacak",
      ],
      expectedOutputs: ["Bolge odakli notlar", "Ilgili goruntu referanslari"],
      estimatedCost: "low",
    }
  );

  assert.deepEqual(
    buildSuggestionPreview(
      {
        id: "enhance-visual",
        label: "Goruntuyu iyilestir",
        actionType: "enhance-visual",
        confidence: 0.8,
      },
      selection
    ),
    {
      suggestionId: "enhance-visual",
      title: "Islem hazirlaniyor",
      steps: ["Bu islem icin detayli plan henuz tanimli degil"],
      expectedOutputs: [],
      estimatedCost: "low",
    }
  );

  assert.deepEqual(buildSuggestionPreview(fallbackSuggestion, selection), {
    suggestionId: "custom-fallback",
    title: "Islem hazirlaniyor",
    steps: ["Bu islem icin detayli plan henuz tanimli degil"],
    expectedOutputs: [],
    estimatedCost: "low",
  });
});
void test("selection preview is derived from the active preview id and current suggestion set", () => {
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
  store.dispatch({
    type: "selection-inspection-mode-updated",
    mode: "audio",
  });
  store.dispatch({
    type: "workspace-selection-suggestion-preview-set",
    suggestionId: "audio-inspect",
  });

  assert.equal(store.getState().ui.activeSuggestionPreviewId, "audio-inspect");
  assert.deepEqual(getActiveSuggestionPreview(store.getState()), {
    suggestionId: "audio-inspect",
    title: "Ses analizi yapilacak",
    steps: [
      "2.0s secim hazirlanacak",
      "Ses track izole edilecek",
      "Frekans ve yogunluk taramasi hazirlanacak",
      "Ani degisim noktalarina bakilacak",
    ],
    expectedOutputs: ["Ses analizi raporu", "Olasi anomali noktalari"],
    estimatedCost: "low",
  });
  assert.deepEqual(getWaveformTimelineModel(store.getState()).activeSuggestionPreview, {
    suggestionId: "audio-inspect",
    title: "Ses analizi yapilacak",
    steps: [
      "2.0s secim hazirlanacak",
      "Ses track izole edilecek",
      "Frekans ve yogunluk taramasi hazirlanacak",
      "Ani degisim noktalarina bakilacak",
    ],
    expectedOutputs: ["Ses analizi raporu", "Olasi anomali noktalari"],
    estimatedCost: "low",
  });
});
});
