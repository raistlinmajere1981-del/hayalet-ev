import test from "node:test";
import assert from "node:assert/strict";

import { createLabEventBus } from "../../rooms/laboratory/runtime/lab-event-bus.ts";
import { createLabRunController } from "../../rooms/laboratory/runtime/lab-run-controller.ts";
import { createLabStore } from "../../rooms/laboratory/runtime/lab-store.ts";
import { createAudioAnalysisLocalProcessRunners } from "../../rooms/laboratory/features/audio-analysis/host/process-local-runners.ts";
import { createLaboratoryManagedAudioRunnerRuntime } from "../../rooms/laboratory/shared/host/process-managed-audio-runner.ts";
import { createLaboratoryManagedMediaRunnerRuntime } from "../../rooms/laboratory/shared/host/process-managed-media-runner.ts";
import { createLaboratoryProcessTargetingRuntime } from "../../rooms/laboratory/shared/host/process-targeting.ts";

class FakeSettingsDocument {
  private listenerSets = new Map<string, Set<(event: Event) => void>>();
  listeners = new Map<string, (event: Event) => void>();

  addEventListener(type: string, listener: EventListenerOrEventListenerObject): void {
    const handler =
      typeof listener === "function"
        ? (listener)
        : (event: Event) => { listener.handleEvent(event); };
    const listeners = this.listenerSets.get(type) ?? new Set<(event: Event) => void>();
    listeners.add(handler);
    this.listenerSets.set(type, listeners);
    this.listeners.set(type, (event: Event) => {
      Array.from(this.listenerSets.get(type) ?? []).forEach(function (candidate) {
        candidate(event);
      });
    });
  }

  querySelector(): null {
    return null;
  }
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
    return selector === "[data-lab-action]" ? this : null;
  }

  getAttribute(name: string): string | null {
    if (name === "data-lab-action") {
      return this.dataset["labAction"] ?? null;
    }
    if (name === "data-lab-value") {
      return this.dataset["labValue"] ?? null;
    }
    return null;
  }
}

class FakeInputElement {
  checked: boolean;
  dataset: Record<string, string>;

  constructor(
    field: string,
    public value: string,
    public type = "text",
    checked = false
  ) {
    this.checked = checked;
    this.dataset = {
      labField: field,
    };
  }
}

class FakeSelectElement {
  dataset: Record<string, string>;

  constructor(
    field: string,
    public value: string
  ) {
    this.dataset = {
      labField: field,
    };
  }
}

class FakeTextAreaElement {}

function asRecord(value: unknown): Record<string, unknown> {
  return value !== null && typeof value === "object" ? (value as Record<string, unknown>) : {};
}

function updateProcessModule(
  processRecord: Record<string, unknown>,
  moduleId: string,
  patch: Record<string, unknown>
) {
  const modules = Array.isArray(processRecord["modules"])
    ? (processRecord["modules"] as Array<Record<string, unknown>>)
    : [];
  processRecord["modules"] = modules.map(function (entry) {
    return entry["id"] === moduleId ? { ...entry, ...patch } : entry;
  });
  return processRecord;
}


describe("laboratory audio settings drive local analyzers and frozen process snapshots", () => {
void test("laboratory audio settings drive local analyzers and frozen process snapshots", async () => {
  const filteredAudioCalls: Array<Record<string, unknown>> = [];
  const spectrogramTargets: string[] = [];
  const openSmileTargets: string[] = [];
  const localRunners = createAudioAnalysisLocalProcessRunners({
    buildEmotionHeuristicFromProsody() {
      return {};
    },
    buildProcessSpeechAvailability() {
      return { ready: true };
    },
    clone(value) {
      return structuredClone(value);
    },
    createProcessArtifact(moduleId, artifactKind, path, label, metadata) {
      return {
        artifactKind,
        id: `${moduleId}-${artifactKind}-${filteredAudioCalls.length}`,
        label,
        metadata,
        moduleId,
        path,
      };
    },
    createProcessFinding(
      moduleId,
      kind,
      level,
      confidence,
      title,
      detail,
      evidenceCount,
      artifactIds
    ) {
      return { artifactIds, confidence, detail, evidenceCount, kind, level, moduleId, title };
    },
    async ensureProcessRuntimeDirectories() {},
    async generateFilteredAudioArtifact(
      _runtime,
      _project,
      _requestId,
      _jobId,
      _target,
      artifactBase,
      _outputDir,
      moduleId,
      filterGraph,
      label,
      metadata
    ) {
      const path = `/tmp/${artifactBase}.wav`;
      filteredAudioCalls.push({ filterGraph, label, metadata, moduleId, path });
      return { id: `${moduleId}-${artifactBase}`, label, metadata, moduleId, path };
    },
    async generateProcessSpectrogram(_runtime, _project, _requestId, _jobId, target) {
      spectrogramTargets.push((asRecord(target)["path"] as string | undefined) ?? "");
      return { id: "spectrogram", moduleId: "spectral-artifacts", path: "/tmp/spectrogram.png" };
    },
    async generateProcessSpectrogramFromInputPath() {
      return null;
    },
    async generateProcessWaveform() {
      return { id: "waveform", moduleId: "spectral-artifacts", path: "/tmp/waveform.png" };
    },
    async generateSpectralDescriptorArtifact() {
      return { id: "descriptor", moduleId: "spectral-artifacts", path: "/tmp/descriptor.json" };
    },
    async maybeRunTranscriptProfileSample() {
      return null;
    },
    normalizeProcessArtifact(value) {
      return asRecord(value);
    },
    resolveOpenSmileProsodyRuntime() {
      return {};
    },
    async runAudioStructureProbe() {
      return {
        silence: { count: 0 },
        volume: { meanVolumeDb: -50 },
      };
    },
    async runOpenSmileProsodyExtraction(_runtime, _project, _requestId, _jobId, target) {
      openSmileTargets.push((asRecord(target)["path"] as string | undefined) ?? "");
      return {
        contourPath: "/tmp/prosody.csv",
        prosodySummary: {
          estimatedPauseCount: 2,
          frameCount: 12,
          meanF0Hz: 155,
        },
      };
    },
    toRecord: asRecord,
    async writeJsonFile() {},
  });
  const project = {
    workbench: {
      analysisSettings: {
        modules: {
          prosody: {
            silenceThresholdDb: -42,
            windowSeconds: 5,
          },
          "signal-health": {
            sampleWindowSeconds: 120,
            sensitivity: "high",
            silenceThresholdDb: -45,
          },
          "spectral-artifacts": {
            sampleWindowSeconds: 30,
            sensitivity: "high",
          },
        },
      },
    },
  };

  const signalResult = await localRunners.runSignalHealthAudioAnalyzer(
    {},
    project,
    "req-signal",
    "job-signal",
    { path: "/tmp/source.wav" },
    "artifact",
    "/tmp",
    "signal-health"
  );
  assert.match(String(signalResult.summary), /120s/);
  assert.match((asRecord(signalResult.findings[0])["detail"] as string | undefined) ?? "", /-45 dB/);

  await localRunners.runSpectralArtifactsAudioAnalyzer(
    {},
    project,
    "req-spectral",
    "job-spectral",
    { path: "/tmp/source.wav" },
    "artifact",
    "/tmp",
    "spectral-artifacts"
  );
  assert.equal(filteredAudioCalls[0]?.["filterGraph"], "atrim=0:30,asetpts=N/SR/TB");
  assert.equal(spectrogramTargets[0], "/tmp/artifact-window.wav");

  await localRunners.runProsodyAudioAnalyzer(
    {},
    project,
    "req-prosody",
    "job-prosody",
    { path: "/tmp/source.wav" },
    "artifact",
    "/tmp",
    "prosody"
  );
  assert.match((filteredAudioCalls[1]?.["filterGraph"] as string | undefined) ?? "", /stop_duration=5/);
  assert.match((filteredAudioCalls[1]?.["filterGraph"] as string | undefined) ?? "", /stop_threshold=-42dB/);
  assert.equal(openSmileTargets[0], "/tmp/artifact-prosody-focus.wav");

  let observedFrozenSettings: Record<string, unknown> = {};
  const managedAudio = createLaboratoryManagedAudioRunnerRuntime({
    asNonEmptyString(value: unknown) {
      return typeof value === "string" && value.trim() !== "" ? value : null;
    },
    getAudioAnalysisModuleProcessDir() {
      return "/tmp";
    },
    getAudioAnalysisModuleRunner(_moduleId: string) {
      return async function (_runtime, runnerProject) {
        observedFrozenSettings = asRecord(
          asRecord(asRecord(asRecord(runnerProject["workbench"])["analysisSettings"])["modules"])[
            "sound-events"
          ]
        );
        return { artifacts: [], findings: [], status: "ready", summary: "done", warnings: [] };
      };
    },
    normalizeProcessArtifact(value) {
      return asRecord(value);
    },
    normalizeProcessFinding(value) {
      return asRecord(value);
    },
    sanitizeFileSegment(value) {
      return value;
    },
    toRecord: asRecord,
    updateProcessModule,
  });
  await managedAudio.runAudioManagedProcess(
    {},
    {
      workbench: {
        analysisSettings: {
          modules: {
            "sound-events": {
              threshold: 0.9,
            },
          },
        },
      },
    },
    "req-managed-audio",
    "job-managed-audio",
    { path: "/tmp/source.wav" },
    "artifact",
    {
      analysisSettings: {
        modules: {
          "sound-events": {
            threshold: 0.42,
          },
        },
      },
      modules: [{ id: "sound-events", status: "queued" }],
    }
  );
  assert.equal(observedFrozenSettings["threshold"], 0.42);
});
});
