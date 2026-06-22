import type { LabStoreEvent } from "../../rooms/laboratory/domain/lab-types.ts";
import {
  assert,
  createAudioVisualizer,
  createLabStore,
  createTestAudioFocusSettings,
  FakeCanvasElement,
  FakeMediaElement,
  FakeVisualizerAudioContext,
  FakeVisualizerDocument,
  FakeVisualizerWindow,
  flushVisualizerWork,
  getAudioVisualizationArtifact,
  renderWorkspaceAudioFocus,
  test,
} from "./laboratory-runtime-truth.helpers.ts";


describe("audio visualization selector prefers renderable current-run artifacts by mode", () => {
void test("audio visualization selector prefers renderable current-run artifacts by mode", () => {
  const store = createLabStore();
  const state = store.getState();
  state.run = {
    id: "run-audio-visualization",
    state: "completed",
    startedAt: Date.now() - 1000,
    endedAt: Date.now(),
    modules: {},
    moduleOrder: [],
    events: [],
    rawLog: [],
    artifacts: [
      {
        id: "artifact-waveform-final",
        kind: "waveform",
        previewUrl: "file:///tmp/final-waveform.png",
        path: "/tmp/final-waveform.png",
        fileName: null,
        createdAt: new Date(Date.now() - 4000).toISOString(),
        active: false,
      },
      {
        id: "artifact-spectrogram-file-url",
        kind: "spectrogram",
        previewUrl: "file:///tmp/file-url-spectrogram.png",
        path: "/tmp/file-url-spectrogram.png",
        fileName: null,
        createdAt: new Date(Date.now() - 500).toISOString(),
        active: true,
      },
      {
        id: "artifact-spectrogram-raw-path-only",
        kind: "spectrogram",
        previewUrl: null,
        path: "/tmp/raw-path-only-spectrogram.png",
        fileName: null,
        createdAt: new Date(Date.now() - 50).toISOString(),
        active: true,
      },
    ],
    findings: [],
    liveFindings: [],
    warnings: [],
    error: null,
    targetLabel: null,
    progress: null,
    emptyReason: null,
    analysisScope: null,
    previewArtifacts: [
      {
        id: "artifact-waveform-preview",
        kind: "waveform",
        previewUrl: "file:///tmp/preview-waveform.png",
        path: "/tmp/preview-waveform.png",
        fileName: null,
        createdAt: new Date(Date.now() - 100).toISOString(),
        active: true,
        status: "ready",
        variantId: null,
        reference: null,
        metadata: {},
      },
      {
        id: "artifact-spectrogram-preview",
        kind: "spectrogram",
        previewUrl: "file:///tmp/preview-spectrogram.png",
        path: "/tmp/preview-spectrogram.png",
        fileName: null,
        createdAt: new Date(Date.now() - 200).toISOString(),
        active: true,
        status: "ready",
        variantId: null,
        reference: null,
        metadata: {},
      },
    ],
    confidence: null,
    moduleTrace: [],
    comparisonVariants: [],
    hypothesisSummary: null,
  };

  state.ui.workspace.audioFocus.visualizationMode = "waveform";
  assert.equal(getAudioVisualizationArtifact(store.getState())?.id, "artifact-waveform-final");

  state.ui.workspace.audioFocus.visualizationMode = "spectrum";
  assert.equal(
    getAudioVisualizationArtifact(store.getState())?.id,
    "artifact-spectrogram-file-url"
  );

  state.ui.workspace.audioFocus.visualizationMode = "none";
  assert.equal(getAudioVisualizationArtifact(store.getState())?.id, "artifact-waveform-final");
});
void test("audio visualization selector keeps stable input order when artifact priority ties", () => {
  const store = createLabStore();
  const state = store.getState();
  const sharedCreatedAt = new Date().toISOString();
  state.run = {
    id: "run-audio-visualization-stable-order",
    state: "completed",
    startedAt: Date.now() - 1000,
    endedAt: Date.now(),
    modules: {},
    moduleOrder: [],
    events: [],
    rawLog: [],
    artifacts: [
      {
        id: "artifact-waveform-second-by-id",
        kind: "waveform",
        previewUrl: "file:///tmp/waveform-second.png",
        path: "/tmp/waveform-second.png",
        fileName: null,
        createdAt: sharedCreatedAt,
        active: false,
      },
      {
        id: "artifact-waveform-first-by-id",
        kind: "waveform",
        previewUrl: "file:///tmp/waveform-first.png",
        path: "/tmp/waveform-first.png",
        fileName: null,
        createdAt: sharedCreatedAt,
        active: false,
      },
    ],
    findings: [],
    liveFindings: [],
    warnings: [],
    error: null,
    targetLabel: null,
    progress: null,
    emptyReason: null,
    analysisScope: null,
    previewArtifacts: [],
    confidence: null,
    moduleTrace: [],
    comparisonVariants: [],
    hypothesisSummary: null,
  };

  state.ui.workspace.audioFocus.visualizationMode = "waveform";
  assert.equal(
    getAudioVisualizationArtifact(store.getState())?.id,
    "artifact-waveform-second-by-id"
  );
});
void test("workspace audio focus leaves transport controls on the unified waveform timeline", () => {
  const markup = renderWorkspaceAudioFocus(
    createTestAudioFocusSettings({
      gain: 1,
      filterType: "none",
      filterFrequency: 1000,
      filterQ: 1,
      visualizationMode: "spectrum",
      eqBands: [
        { frequency: 60, gain: 0, Q: 1, type: "lowshelf" },
        { frequency: 250, gain: 0, Q: 1, type: "peaking" },
        { frequency: 1000, gain: 0, Q: 1, type: "peaking" },
        { frequency: 4000, gain: 0, Q: 1, type: "peaking" },
        { frequency: 12000, gain: 0, Q: 1, type: "highshelf" },
      ],
    }),
    {
      previewTarget: "audio",
      temporalControlsEnabled: true,
    } as Parameters<typeof renderWorkspaceAudioFocus>[1]
  );

  assert.match(markup, /data-lab-action="workspace-reset-audio-focus"/);
  assert.match(markup, /data-lab-action="workspace-setting-adjust"/);
  assert.match(markup, /workspace\.audioFocus\.gain/);
  assert.match(markup, /workspace\.audioFocus\.eqBands\.0\.gain/);
  assert.doesNotMatch(markup, /labx-audio-focus__header|AUDIO FOCUS/);
  assert.doesNotMatch(markup, /workspace\.audioFocus\.playbackRate/);
  assert.doesNotMatch(markup, /workspace\.audioFocus\.preservePitch/);
  assert.doesNotMatch(markup, /ANALYSIS AID/);
  assert.doesNotMatch(markup, /workspace\.audioFocus\.visualizationMode/);
  assert.doesNotMatch(markup, /lab-audio-viz/);
});
});
