import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import {
  LAB_ANALYSIS_MODULE_SETTINGS_DEFAULTS,
  LAB_ANALYSIS_MODULE_SETTINGS_FIELDS,
} from "../../rooms/laboratory/domain/lab-capabilities.ts";
import { ensureAdvancedAudioAnalysisSettingsRegistered } from "../../rooms/laboratory/domain/lab-advanced-audio-settings.ts";
import type { LabAudioFocusSettings } from "../../rooms/laboratory/domain/lab-types.ts";
import { createAdvancedAudioForensicsRunners } from "../../rooms/laboratory/features/audio-analysis/host/process-advanced-forensics-runners.ts";
import { renderWorkspaceAudioFocus } from "../../rooms/laboratory/ui/workspace-audio-focus.ts";

type TestRecord = Record<string, unknown>;

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

function createSpectralHarness() {
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
    async generateFilteredAudioArtifact() {
      throw new Error("Audition-only audio variants must not be needed for spectral-map tests.");
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
    profileToolCalls,
    runners,
  };
}

function createAudioFocus(overrides: Partial<LabAudioFocusSettings> = {}): LabAudioFocusSettings {
  return {
    gain: 1,
    filterType: "none",
    filterFrequency: 1000,
    filterQ: 1,
    playbackRate: 1,
    preservePitch: true,
    visualizationMode: "waveform",
    eqBands: [
      { frequency: 60, gain: 0, Q: 1, type: "lowshelf" },
      { frequency: 250, gain: 0, Q: 1, type: "peaking" },
      { frequency: 1000, gain: 0, Q: 1, type: "peaking" },
      { frequency: 4000, gain: 0, Q: 1, type: "peaking" },
      { frequency: 12000, gain: 0, Q: 1, type: "highshelf" },
    ],
    ...overrides,
  };
}

test("advanced analysis settings keep only evidence-producing spectral controls", function () {
  assert.equal(LAB_ANALYSIS_MODULE_SETTINGS_DEFAULTS["spectral-artifacts"]?.["subsonicMap"], true);
  assert.equal(
    LAB_ANALYSIS_MODULE_SETTINGS_DEFAULTS["spectral-artifacts"]?.["inverseSpectrumMap"],
    true
  );
  assert.equal(
    LAB_ANALYSIS_MODULE_SETTINGS_DEFAULTS["spectrogram-guided-recovery"]?.[
      "slowPlaybackMode"
    ],
    undefined
  );
  assert.equal(
    LAB_ANALYSIS_MODULE_SETTINGS_DEFAULTS["frequency-shift-reversal"]?.["pitchShiftMode"],
    undefined
  );

  const spectralFieldIds = (LAB_ANALYSIS_MODULE_SETTINGS_FIELDS["spectral-artifacts"] || []).map(
    (field) => field.id
  );
  assert.equal(spectralFieldIds.includes("subsonicMap"), true);
  assert.equal(spectralFieldIds.includes("inverseSpectrumMap"), true);

  const pitchFieldIds = (
    LAB_ANALYSIS_MODULE_SETTINGS_FIELDS["frequency-shift-reversal"] || []
  ).map((field) => field.id);
  assert.equal(pitchFieldIds.includes("pitchShiftMode"), false);
  assert.equal(pitchFieldIds.includes("pitchSemitones"), false);
});

test("spectral inspection maps can be disabled independently from the base spectral analysis", async () => {
  const harness = createSpectralHarness();
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

test("analysis runtime no longer wires slow-playback or pitch ladders into report modules", function () {
  const source = readFileSync(
    new URL(
      "../../rooms/laboratory/features/audio-analysis/host/process-runners.ts",
      import.meta.url
    ),
    "utf8"
  );

  assert.match(source, /augmentSpectralArtifacts\(runSpectralArtifactsAudioAnalyzer\)/);
  assert.doesNotMatch(source, /augmentFrequencyShiftReversal\(/);
  assert.doesNotMatch(source, /augmentSpectrogramGuidedRecovery\(/);
  assert.match(source, /"frequency-shift-reversal": runFrequencyShiftReversalAudioAnalyzer/);
  assert.match(source, /"spectrogram-guided-recovery": runSpectrogramGuidedRecoveryAudioAnalyzer/);
});

test("audio focus exposes live speed and pitch-lock audition controls in the icon-rail panel", function () {
  const audioFocus = createAudioFocus({ playbackRate: 0.5, preservePitch: false });
  const markup = renderWorkspaceAudioFocus(audioFocus, {
    previewTarget: "video",
    temporalAudioFocus: audioFocus,
  });

  assert.match(markup, /data-lab-live-audio-audition="true"/);
  assert.match(markup, /data-lab-field="workspace\.audioFocus\.playbackRate"/);
  assert.match(markup, /data-lab-field="workspace\.audioFocus\.preservePitch"/);
  assert.match(markup, /data-lab-reset-value="0\.25"/);
  assert.match(markup, /data-lab-reset-value="0\.707107"/);
  assert.match(markup, /data-lab-reset-value="1\.414214"/);
  assert.match(markup, /-12 st/);
  assert.match(markup, /\+12 st/);
  assert.match(markup, /Tape pitch/);
});

test("pitch-preserved live audition hides tape-pitch presets but keeps speed controls", function () {
  const audioFocus = createAudioFocus({ playbackRate: 0.5, preservePitch: true });
  const markup = renderWorkspaceAudioFocus(audioFocus, {
    previewTarget: "video",
    temporalAudioFocus: audioFocus,
  });

  assert.match(markup, /data-lab-field="workspace\.audioFocus\.playbackRate"/);
  assert.match(markup, /data-lab-field="workspace\.audioFocus\.preservePitch"/);
  assert.doesNotMatch(markup, /-12 st/);
  assert.match(markup, /Pitch korunuyor/);
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
