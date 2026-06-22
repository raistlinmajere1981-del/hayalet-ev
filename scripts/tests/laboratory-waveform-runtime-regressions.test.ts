import {
  assert,
  createDualPreviewSnapshot,
  createLabEventBus,
  createLabRunController,
  createLabStore,
  createLabWaveformTimelineVisualizer,
  createTestAudioFocusSettings,
  FakeCanvasElement,
  FakeControllerDocument,
  FakeMediaElement,
  FakeVisualizerAudioContext,
  FakeVisualizerDocument,
  FakeVisualizerWindow,
  flushVisualizerWork,
  getWaveformTimelineModel,
  renderLabWaveformTimeline,
  test,
} from "./laboratory-runtime-truth.helpers.ts";

import type { LabArtifactProjection } from "./laboratory-runtime-truth.helpers.ts";
import type { LabWaveformTimelineModel } from "../../rooms/laboratory/ui/lab-waveform-timeline-types.ts";
import type { LabBookmark } from "../../rooms/laboratory/domain/lab-types.ts";
