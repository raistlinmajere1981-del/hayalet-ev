import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import {
  LAB_ANALYSIS_MODULE_SETTINGS_DEFAULTS,
  LAB_ANALYSIS_MODULE_SETTINGS_FIELDS,
  normalizeLabAnalysisModuleSettings,
} from "../../rooms/laboratory/domain/lab-capabilities.ts";
import { ensureAdvancedAudioAnalysisSettingsRegistered } from "../../rooms/laboratory/domain/lab-advanced-audio-settings.ts";
import { createAdvancedAudioForensicsRunners } from "../../rooms/laboratory/features/audio-analysis/host/process-advanced-forensics-runners.ts";

type TestRecord = Record<string, unknown>;

type FilteredAudioCall = {
  filterGraph: string;
  label: string;
  metadata: TestRecord;
};

type ProfileToolCall = {
  args: string[];
};

ensureAdvancedAudioAnalysisSettingsRegistered();

function createProject(moduleId: string, settings: TestRecord): TestRecord {
  return {
    workbench: {
      analysisSettings: {
        modules: {
          [moduleId]: settings,
        },
      },
    },
  };
}

function createHarness() {
  const filteredAudioCalls: FilteredAudioCall[] = [];
  const profileToolCalls: ProfileToolCall[] = [];
  let artifactCounter = 0;
  const runners = createAdvancedAudioForensicsRunners({
    createProcessArtifact(moduleId, artifactKind, filePath, label, metadata) {
      artifactCounter += 1;
      return {
        id: `artifact-${artifactCounter}`,
        moduleId,
        kind: artifactKind,
        path: filePath,
        label,
        metadata,
      };
    },
    createProcessFinding(
      moduleId,
      findingKind,
      level,
      confidence,
      title,
      detail,
      evidenceCount,
      artifactIds
    ) {
      return {
        moduleId,
        kind: findingKind,
        level,
        confidence,
        title,
        detail,
        evidenceCount,
        artifactIds,
      };
    },
    async ensureProcessRuntimeDirectories() {
      await Promise.resolve();
    },
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
      metadata,
      outputExtension
    ) {
      filteredAudioCalls.push({ filterGraph, label, metadata });
      artifactCounter += 1;
      return {
        id: `artifact-${artifactCounter}`,
        moduleId,
        kind: "audio-variant",
        path: `/tmp/${artifactBase}.${outputExtension ?? "wav"}`,
        label,
        metadata,
      };
    },
    async runProfileTool(_runtime, request) {
      profileToolCalls.push({ args: request.args.slice() });
      await Promise.resolve();
    },
    toRecord(value) {
      return value !== null && typeof value === "object" && !Array.isArray(value)
        ? (value as TestRecord)
        : {};
    },
  });

  async function baseRunner() {
    return await Promise.resolve({
      artifacts: [{ id: "base-artifact", kind: "base", path: "/tmp/base.dat" }],
      findings: [],
      status: "ready",
      summary: "Base analysis complete.",
      warnings: [],
    });
  }

  function createArgs(project: TestRecord) {
    return [
      {},
      project,
      "request-configurable-audio",
      "job-configurable-audio",
      { path: "/tmp/source.wav" },
      "configurable-audio",
      "/tmp/configurable-audio",
    ] as const;
  }

  return {
    baseRunner,
    createArgs,
    filteredAudioCalls,
    profileToolCalls,
    runners,
  };
}

test("advanced audio settings register into the existing analysis settings UI contract", function () {
  assert.equal(LAB_ANALYSIS_MODULE_SETTINGS_DEFAULTS["spectral-artifacts"]?.["subsonicMap"], true);
  assert.equal(
    LAB_ANALYSIS_MODULE_SETTINGS_DEFAULTS["spectral-artifacts"]?.["inverseSpectrumMap"],
    true
  );
  assert.equal(
    LAB_ANALYSIS_MODULE_SETTINGS_DEFAULTS["spectrogram-guided-recovery"]?.[
      "slowPlaybackMode"
    ],
    "all"
  );
  assert.equal(
    LAB_ANALYSIS_MODULE_SETTINGS_DEFAULTS["frequency-shift-reversal"]?.["pitchShiftMode"],
    "ladder"
  );

  const spectralFieldIds = (LAB_ANALYSIS_MODULE_SETTINGS_FIELDS["spectral-artifacts"] || []).map(
    (field) => field.id
  );
  assert.equal(spectralFieldIds.includes("subsonicMap"), true);
  assert.equal(spectralFieldIds.includes("inverseSpectrumMap"), true);

  const pitchFieldIds = (
    LAB_ANALYSIS_MODULE_SETTINGS_FIELDS["frequency-shift-reversal"] || []
  ).map((field) => field.id);
  assert.equal(pitchFieldIds.includes("pitchShiftMode"), true);
  assert.equal(pitchFieldIds.includes("pitchSemitones"), true);

  const normalized = normalizeLabAnalysisModuleSettings("frequency-shift-reversal", {
    pitchShiftMode: "single",
    pitchSemitones: -3,
  });
  assert.equal(normalized["pitchShiftMode"], "single");
  assert.equal(normalized["pitchSemitones"], -3);
});

test("spectral inspection maps can be disabled independently from the base spectral analysis", async () => {
  const harness = createHarness();
  const runner = harness.runners.augmentSpectralArtifacts(harness.baseRunner);
  const project = createProject("spectral-artifacts", {
    subsonicMap: false,
    inverseSpectrumMap: false,
  });

  const result = await runner(...harness.createArgs(project), "spectral-artifacts");

  assert.equal(harness.profileToolCalls.length, 0);
  assert.equal(result.artifacts.length, 1);
  assert.match(result.summary, /disabled by module settings/);
});

test("slow playback settings can request only the 0.25x forensic listening variant", async () => {
  const harness = createHarness();
  const runner = harness.runners.augmentSpectrogramGuidedRecovery(harness.baseRunner);
  const project = createProject("spectrogram-guided-recovery", {
    slowPlaybackMode: "slow-0-25",
  });

  const result = await runner(...harness.createArgs(project), "spectrogram-guided-recovery");

  assert.equal(harness.filteredAudioCalls.length, 1);
  assert.equal(harness.filteredAudioCalls[0]?.filterGraph, "atempo=0.5,atempo=0.5");
  assert.equal(harness.filteredAudioCalls[0]?.metadata["tempoScale"], 0.25);
  assert.equal(result.artifacts.length, 2);
});

test("pitch shift settings support a single custom semitone target and clamp extreme values", async () => {
  const harness = createHarness();
  const runner = harness.runners.augmentFrequencyShiftReversal(harness.baseRunner);
  const project = createProject("frequency-shift-reversal", {
    pitchShiftMode: "single",
    pitchSemitones: 99,
  });

  const result = await runner(...harness.createArgs(project), "frequency-shift-reversal");

  assert.equal(harness.filteredAudioCalls.length, 1);
  assert.equal(harness.filteredAudioCalls[0]?.metadata["semitones"], 24);
  assert.match(harness.filteredAudioCalls[0]?.filterGraph ?? "", /asetrate=192000/);
  assert.match(harness.filteredAudioCalls[0]?.filterGraph ?? "", /atempo=0\.5,atempo=0\.5/);
  assert.equal(result.artifacts.length, 2);
});

test("expanded observation view keeps the tall waveform but releases excess control height", function () {
  const css = readFileSync(
    new URL(
      "../../rooms/laboratory/ui/styles/lab-audio-observation.css",
      import.meta.url
    ),
    "utf8"
  );

  assert.match(css, /height:\s*clamp\(13rem, 28vh, 20rem\)/);
  assert.match(css, /\.labx-timeline__track[\s\S]*height:\s*clamp\(8rem, 18vh, 12rem\)/);
  assert.match(css, /\.labx-timeline__controls[\s\S]*min-height:\s*0/);
  assert.match(css, /\.labx-timeline__controls-row[\s\S]*min-height:\s*0/);
});
