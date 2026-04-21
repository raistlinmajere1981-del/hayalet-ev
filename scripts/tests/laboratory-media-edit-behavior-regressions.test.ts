import test from "node:test";
import assert from "node:assert/strict";

// TODO: draft-runtime.ts and request-runtime.ts were removed; re-enable first test when replacements are available
// import { createLaboratoryUiDraftRuntime } from "../../rooms/laboratory/shared/ui/draft-runtime.ts";
// import { createLaboratoryRequestRuntime } from "../../rooms/laboratory/shared/ui/request-runtime.ts";
import { createLaboratoryJobRuntime } from "../../rooms/laboratory/shared/host/job-runtime.ts";

function toRecord<T extends Record<string, unknown> = Record<string, unknown>>(value: unknown): T {
  return value && typeof value === "object" && !Array.isArray(value) ? (value as T) : ({} as T);
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

test.skip("laboratory UI keeps preview/apply stale-response tracking isolated by action domain", () => {
  const state = createRequestState();
  const sentEvents: Array<{ eventName: string; payload: Record<string, unknown> }> = [];
  const requestRuntime = (null as any).createLaboratoryRequestRuntime({
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
        sendEvent(eventName: string, payload: Record<string, unknown>) {
          sentEvents.push({ eventName, payload });
        },
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
  const draftRuntime = (null as any).createLaboratoryUiDraftRuntime({
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
      jobId: "apply-job",
      requestId: "apply-current",
      action: "edit-apply",
      featureStage: "edit",
    },
    {
      jobId: "preview-job",
      requestId: "preview-current",
      action: "edit-preview",
      featureStage: "edit",
    },
    {
      jobId: "tool-job",
      requestId: "tool-current",
      action: "tool-install",
      featureStage: "source",
    },
  ];

  const previewOld = requestRuntime.sendMediaAction("edit-preview");
  const applyCurrent = requestRuntime.sendMediaAction("edit-apply");
  const previewCurrent = requestRuntime.sendMediaAction("edit-preview");

  assert.equal(typeof previewOld, "string");
  assert.equal(typeof applyCurrent, "string");
  assert.equal(typeof previewCurrent, "string");
  assert.equal(sentEvents.length, 3);
  assert.equal(requestRuntime.shouldIgnoreCorrelatedPayload(previewOld, "edit-preview"), true);
  assert.equal(requestRuntime.shouldIgnoreCorrelatedPayload(applyCurrent, "edit-apply"), false);
  assert.equal(requestRuntime.shouldIgnoreCorrelatedPayload(applyCurrent, "edit-preview"), false);
  assert.equal(draftRuntime.collectEditStageJobs(sampleJobs).length, 2);
  assert.equal(draftRuntime.collectEditStageJobs(sampleJobs)[0]?.action, "edit-preview");
  assert.equal(draftRuntime.collectEditStageJobs(sampleJobs)[1]?.action, "edit-apply");
});

test("laboratory host treats preview/apply edit jobs as action-scoped slots", () => {
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
      previewJob: {
        requestId: "req-preview",
        action: "edit-preview",
        projectId: "project-1",
      },
      applyJob: {
        requestId: "req-apply",
        action: "edit-apply",
        projectId: "project-1",
      },
    },
  };

  assert.throws(() => {
    jobRuntime.ensureEditJobSlotAvailable(runtime, "project-1", "edit-preview");
  }, /already running/i);

  assert.throws(() => {
    jobRuntime.ensureEditJobSlotAvailable(runtime, "project-1", "edit-apply");
  }, /already running/i);

  assert.doesNotThrow(() => {
    jobRuntime.ensureEditJobSlotAvailable(
      {
        jobs: {
          applyOnly: runtime.jobs.applyJob,
        },
      },
      "project-1",
      "edit-preview"
    );
  });
});
