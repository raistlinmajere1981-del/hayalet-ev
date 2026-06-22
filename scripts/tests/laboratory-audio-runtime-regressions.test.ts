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
