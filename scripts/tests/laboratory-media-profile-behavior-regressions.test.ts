import test from "node:test";
import assert from "node:assert/strict";

import { createLaboratoryUiDraftRuntime } from "../../rooms/laboratory/shared/ui/draft-runtime.ts";
import { createLaboratoryRequestRuntime } from "../../rooms/laboratory/shared/ui/request-runtime.ts";
import { createLaboratoryJobRuntime } from "../../rooms/laboratory/shared/host/job-runtime.ts";
import {
  getPreferredAssetCodec,
  getPreferredAssetDuration,
  getPreferredAssetResolution,
} from "../../rooms/laboratory/main-functions/media-analysis/ui/profile-helpers.ts";
import { createMediaProfileProjectionRuntime } from "../../rooms/laboratory/main-functions/media-analysis/host/profile-projection.ts";

function toRecord<T extends Record<string, unknown> = Record<string, unknown>>(value: unknown): T {
  return value && typeof value === "object" && !Array.isArray(value) ? (value as T) : ({} as T);
}

function asNonEmptyString(value: unknown) {
  return typeof value === "string" && value.trim() !== "" ? value.trim() : null;
}

function createRequestState() {
  return {
    context: {
      featureId: "media-analysis",
      workbench: {
        activeModuleId: "media-analysis",
        availableModuleIds: ["media-analysis"],
        selectedModuleIds: ["media-analysis"],
      },
    },
    sourceSnapshot: {
      workbench: {
        activeModuleId: "media-analysis",
        availableModuleIds: ["media-analysis"],
        selectedModuleIds: ["media-analysis"],
      },
    },
    ui: {
      eventLog: [],
      eventLogOpen: false,
      lastRequestId: null,
      latestRequestByDomain: {
        project: 0,
        "source-config": 0,
        "source-acquire": 0,
        "edit-config": 0,
        "edit-preview": 0,
        "edit-apply": 0,
        "edit-preview-cancel": 0,
        "edit-apply-cancel": 0,
        "profile-config": 0,
        "profile-run": 0,
        "profile-cancel": 0,
        "profile-model": 0,
        "process-run": 0,
        "process-cancel": 0,
        "report-export": 0,
        tools: 0,
        misc: 0,
      },
      localDrafts: {
        fileNameHint: "",
        urlInput: "",
        youtubeCustom: {},
        youtubePreset: null,
        youtubeUrl: "",
      },
      localSubtitleDrafts: {},
      requestCounter: 0,
      requestLookup: {},
      settingsAnimateIn: false,
      settingsOpen: false,
      settingsHelperPlatform: "linux",
      settingsHelperToolId: null,
      status: {
        activity: {
          detail: null,
          message: "",
          source: "system",
          sticky: false,
          updatedAt: null,
          visible: false,
        },
        blocking: {
          detail: null,
          message: "",
          source: "system",
          sticky: false,
          updatedAt: null,
          visible: false,
        },
        result: {
          detail: null,
          message: "",
          source: "system",
          sticky: false,
          updatedAt: null,
          visible: false,
        },
      },
    },
  };
}

function createProfileProjectionRuntime(overrides: Partial<Parameters<typeof createMediaProfileProjectionRuntime>[0]> = {}) {
  return createMediaProfileProjectionRuntime({
    asNonEmptyString,
    asNumber(value: unknown) {
      return typeof value === "number" && Number.isFinite(value) ? value : null;
    },
    buildDerivedTargetSignature() {
      return "derived-sig";
    },
    buildProfileModelSummary() {
      return [];
    },
    buildProfileToolSummary(_runtime: Record<string, unknown>, toolId: string) {
      return { toolId, displayName: toolId, ready: true };
    },
    buildSourceTargetSignature() {
      return "source-sig";
    },
    clampProfileTranscriptSampleSeconds() {
      return 30;
    },
    clone(value: unknown) {
      return structuredClone(value);
    },
    createDefaultProfileState() {
      return {};
    },
    createEmptyProfilePreflight() {
      return {};
    },
    findEditOutputById(project: Record<string, unknown>, outputId: string | null) {
      if (!outputId) {
        return null;
      }
      const outputs = Array.isArray(toRecord(project.edit).outputs) ? (toRecord(project.edit).outputs as unknown[]) : [];
      return outputs.find(function (entry) {
        return toRecord(entry).id === outputId;
      }) || null;
    },
    findProfilePreset() {
      return null;
    },
    getCompatibleProfileLaneIds() {
      return [];
    },
    getDefaultProfileModelId() {
      return null;
    },
    getEnabledProfileLaneIds() {
      return [];
    },
    getProfileDepthConfig() {
      return {};
    },
    getProfileFrameDensityRuntimeConfig() {
      return {};
    },
    getProfileLaneMap() {
      return {};
    },
    getProfileModelDescriptorMap() {
      return {};
    },
    getStageSupport() {
      return "required";
    },
    getToolManifest() {
      return {};
    },
    normalizeEditOutput(output: unknown) {
      return toRecord(output);
    },
    normalizeProfileArtifactPreferences() {
      return {};
    },
    normalizeProfileState(profile: unknown) {
      return profile;
    },
    normalizeSourceMetadata(value: unknown) {
      return toRecord(value);
    },
    toRecord,
    ...overrides,
  });
}

test("laboratory UI keeps profile stale-response tracking isolated by action domain", () => {
  const state = createRequestState();
  const requestRuntime = createLaboratoryRequestRuntime({
    bootstrapText() {
      return "unavailable";
    },
    buildCurrentDraftPayload() {
      return {};
    },
    getActiveFeatureId() {
      return "media-analysis";
    },
    getRoomApi() {
      return {
        sendEvent() {},
      };
    },
    isSubtitleAnalysisFeature() {
      return false;
    },
    render() {},
    requestOverlayScrollReset() {},
    state: state as never,
    toRecord,
  });
  const draftRuntime = createLaboratoryUiDraftRuntime({
    deepClone<T>(value: T): T {
      return structuredClone(value);
    },
    getActiveProject() {
      return null;
    },
    getEditPresets() {
      return {};
    },
    getProjectEdit() {
      return {};
    },
    getProjectSource() {
      return {};
    },
    getSourceSnapshot() {
      return { activeProjectId: "project-1" };
    },
    getSubtitleEditState() {
      return {};
    },
    getSubtitleWorkspace() {
      return {};
    },
    isSubtitleAnalysisFeature() {
      return false;
    },
    state: { ui: {} } as never,
    toRecord,
  });
  const sampleJobs = [
    {
      jobId: "run-job",
      requestId: "profile-run-current",
      action: "profile-run-preflight",
      featureStage: "profile",
    },
    {
      jobId: "model-job",
      requestId: "profile-model-current",
      action: "profile-model-install",
      featureStage: "profile",
    },
    {
      jobId: "edit-job",
      requestId: "edit-preview-current",
      action: "edit-preview",
      featureStage: "edit",
    },
  ];

  const profileRunOld = requestRuntime.sendMediaAction("profile-run-preflight");
  const profileRunCurrent = requestRuntime.sendMediaAction("profile-run-preflight");
  const profileModelCurrent = requestRuntime.sendMediaAction("profile-model-install");

  assert.equal(requestRuntime.shouldIgnoreCorrelatedPayload(profileRunOld, "profile-run-preflight"), true);
  assert.equal(
    requestRuntime.shouldIgnoreCorrelatedPayload(profileRunCurrent, "profile-run-preflight"),
    false
  );
  assert.equal(
    requestRuntime.shouldIgnoreCorrelatedPayload(profileRunCurrent, "profile-model-install"),
    false
  );
  assert.equal(draftRuntime.collectProfileStageJobs(sampleJobs).length, 2);
  assert.equal(draftRuntime.collectProfileStageJobs(sampleJobs)[0]?.action, "profile-run-preflight");
  assert.equal(
    draftRuntime.collectProfileStageJobs(sampleJobs)[1]?.action,
    "profile-model-install"
  );
});

test("laboratory host treats profile preflight and model jobs as action-scoped slots", () => {
  const jobRuntime = createLaboratoryJobRuntime({
    roomId: "laboratory",
    toRecord,
    async cancelRoomTool() {
      return null;
    },
    clearJob() {},
    pushJobState() {},
  });
  const runtime = {
    jobs: {
      preflightJob: {
        requestId: "req-profile-run",
        action: "profile-run-preflight",
        projectId: "project-1",
      },
      modelJob: {
        requestId: "req-profile-model",
        action: "profile-model-install",
        projectId: "project-1",
      },
    },
  };

  assert.throws(() => {
    jobRuntime.ensureProfileJobSlotAvailable(runtime, "project-1", "profile-run-preflight");
  }, /already running/i);

  assert.throws(() => {
    jobRuntime.ensureProfileJobSlotAvailable(runtime, "project-1", "profile-model-install");
  }, /already running/i);

  assert.doesNotThrow(() => {
    jobRuntime.ensureProfileJobSlotAvailable(
      {
        jobs: {
          modelOnly: runtime.jobs.modelJob,
        },
      },
      "project-1",
      "profile-run-preflight"
    );
  });
});

test("laboratory UI prefers the active profile target metadata over the source-only summary helpers", () => {
  const previewMetrics = {
    url: "file:///derived-preview.mp4",
    duration: 41,
    width: 1024,
    height: 576,
  };

  assert.equal(
    getPreferredAssetDuration(
      { previewUrl: "file:///derived-preview.mp4", metadata: { durationSeconds: 58 } },
      previewMetrics,
      toRecord
    ),
    58
  );
  assert.equal(
    getPreferredAssetResolution(
      { previewUrl: "file:///derived-preview.mp4", metadata: { width: 1920, height: 1080 } },
      previewMetrics,
      toRecord
    ),
    "1920 x 1080"
  );
  assert.equal(
    getPreferredAssetCodec(
      { previewUrl: "file:///derived-preview.mp4", metadata: { videoCodec: "h264" } },
      toRecord
    ),
    "h264"
  );
});

test("laboratory host resolves derived profile targets with safe fallback when the pin is stale", () => {
  const projectionRuntime = createProfileProjectionRuntime();

  assert.deepEqual(
    projectionRuntime.resolveProfileTarget({
      name: "Project",
      source: {
        storedPath: "/project/source.mp4",
        storedFileName: "source.mp4",
        mimeType: "video/mp4",
        metadata: { durationSeconds: 20 },
      },
      edit: { outputs: [] },
      profile: { targetAssetMode: "derived", targetOutputId: "missing-output" },
    }),
    {
      requestedMode: "derived",
      mode: "source",
      outputId: "missing-output",
      path: "/project/source.mp4",
      fileName: "source.mp4",
      mimeType: "video/mp4",
      metadata: { durationSeconds: 20 },
      signature: "source-sig",
      label: "source.mp4",
      usingFallback: true,
      reason: "Pinned derived output is unavailable. Falling back to the saved source.",
    }
  );
});

test("laboratory host readiness blocks missing targets and surfaces model-compatibility warnings", () => {
  const projectionRuntime = createProfileProjectionRuntime({
    buildProfileModelSummary() {
      return [
        {
          modelId: "tiny.en",
          selected: true,
          ready: false,
          runtimeCompatible: false,
          compatibilityReason: "This model is not declared for linux-x64.",
        },
      ];
    },
    getCompatibleProfileLaneIds() {
      return ["speech-overlay"];
    },
    getProfileLaneMap() {
      return {
        "speech-overlay": {
          labelKey: "lane.speech",
          summaryKey: "lane.summary",
          requiredTools: ["ffmpeg"],
          optionalTools: ["whisper.cpp"],
          artifactKinds: ["transcript"],
        },
      };
    },
    buildProfileToolSummary(_runtime: Record<string, unknown>, toolId: string) {
      if (toolId === "ffmpeg") {
        return { toolId, displayName: "FFmpeg", ready: true };
      }
      return { toolId, displayName: "Whisper.cpp", ready: true };
    },
  });

  const blockedResult = projectionRuntime.buildProfileReadiness(
    { profilePresets: {}, toolState: {}, profileModelState: {}, profileModels: {} },
    {
      source: { kind: "video" },
      profile: { laneSelection: { "speech-overlay": true } },
    }
  );

  assert.equal(blockedResult.stageReady, false);
  assert.match(blockedResult.blockers[0] || "", /Prepare a source or derived output/i);

  const warningResult = projectionRuntime.buildProfileReadiness(
    { profilePresets: {}, toolState: {}, profileModelState: {}, profileModels: {} },
    {
      source: {
        kind: "video",
        storedPath: "/project/source.mp4",
        storedFileName: "source.mp4",
        mimeType: "video/mp4",
        metadata: {},
      },
      edit: { outputs: [] },
      profile: {
        laneSelection: { "speech-overlay": true },
        targetAssetMode: "derived",
        targetOutputId: "stale-output",
      },
    }
  );

  assert.equal(warningResult.stageReady, true);
  assert.ok(
    warningResult.warnings.includes(
      "Pinned derived output is unavailable. Falling back to the saved source."
    )
  );
  assert.ok(warningResult.warnings.includes("This model is not declared for linux-x64."));
});
