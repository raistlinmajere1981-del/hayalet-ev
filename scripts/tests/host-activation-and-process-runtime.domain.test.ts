import test from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { createRoomBuiltArtifact, createRoomInstalledCopy } from "./helpers/room-installed-copy.ts";
import { createLaboratoryHostActivation } from "../../rooms/laboratory/shared/host/activation.ts";
import { createLaboratoryProjectLifecycleRuntime } from "../../rooms/laboratory/shared/host/project-lifecycle.ts";
import { createMediaExportActionRuntime } from "../../rooms/laboratory/features/media-analysis/host/action-handlers-export.ts";
import { createAudioAnalysisProbeRuntime } from "../../rooms/laboratory/features/audio-analysis/host/analysis-probes.ts";
import { createMediaLocalSourceIntakeRuntime } from "../../rooms/laboratory/features/media-analysis/host/source-intake-local.ts";
import { createLaboratoryJobStateRuntime } from "../../rooms/laboratory/shared/host/job-state.ts";
import { createLaboratoryProcessRuntime } from "../../rooms/laboratory/shared/host/process-runtime.ts";
import { syncSourceLabAssetForProject } from "../../rooms/laboratory/shared/host/lab-assets.ts";
import { createLaboratoryReportExportRuntime } from "../../rooms/laboratory/shared/host/reporting-export.ts";
import {
  createLaboratoryHostUtils,
  sanitizeLaboratoryFileSegment,
  toLaboratoryFfmpegTimestamp,
} from "../../rooms/laboratory/shared/host/host-utils.ts";

describe("host activation and process runtime", () => {
  void test("laboratory host activation unwraps host-context room-event payloads before saving context", () => {
    const savedContexts: Array<Record<string, unknown>> = [];
    const emittedEvents: Array<Record<string, unknown>> = [];
    const pushCalls: Array<string | null> = [];

    let currentContext: Record<string, unknown> = {};

    const activation = createLaboratoryHostActivation({
      createRuntimeState() {
        return {};
      },
      emitEvent(_api, payload) {
        emittedEvents.push(payload);
      },
      ensureHydrated: async function () {},
      ensureRoomToolsSubscription: function () {},
      handleMediaAction: async function () {},
      loadContext() {
        return currentContext;
      },
      pushMediaState(_api, _runtime, requestId) {
        pushCalls.push(requestId);
      },
      saveContext(_api, payload) {
        savedContexts.push(payload);
        currentContext = payload;
        return payload;
      },
      tearDownRoomToolsSubscription: function () {},
      toRecord(value) {
        return value !== null && typeof value === "object" && Array.isArray(value) === false
          ? (value as Record<string, unknown>)
          : {};
      },
    });

    const runtime = activation.activate({
      log() {},
    });

    const nestedContext = {
      roomId: "laboratory",
      featureId: "audio-analysis",
      workbench: {
        activeModuleId: "audio-analysis",
        selectedModuleIds: ["audio-analysis"],
        moduleToggles: {
          "audio-analysis": true,
        },
      },
    };
    runtime.onRoomEvent({
      type: "host-context",
      payload: nestedContext,
    });

    assert.deepEqual(savedContexts.at(-1), nestedContext);
    assert.deepEqual(pushCalls, [null]);
    assert.equal(emittedEvents.at(-1)?.["action"], "host-context");
    assert.equal(emittedEvents.at(-1)?.["scope"], "global");

    const directContext = {
      type: "host-context",
      roomId: "laboratory",
      featureId: "media-analysis",
      workbench: {
        activeModuleId: "media-analysis",
        selectedModuleIds: ["media-analysis"],
        moduleToggles: {
          "media-analysis": true,
        },
      },
    };
    runtime.onRoomEvent(directContext);

    assert.deepEqual(savedContexts.at(-1), directContext);
    assert.deepEqual(pushCalls, [null, null]);
    assert.equal(emittedEvents.at(-1)?.["action"], "host-context");
    assert.equal(emittedEvents.at(-1)?.["scope"], "global");
  });

  void test("laboratory process runtime keeps cancelled runs cancelled after the active module resolves", async () => {
    function toRecord(value: unknown): Record<string, unknown> {
      return value !== null && typeof value === "object" && Array.isArray(value) === false
        ? (value as Record<string, unknown>)
        : {};
    }

    function asNonEmptyString(value: unknown) {
      return typeof value === "string" && value.trim() !== "" ? value.trim() : null;
    }

    function updateProcessModule(
      processRecord: Record<string, unknown>,
      moduleId: string,
      patch: Record<string, unknown>
    ) {
      const modules = Array.isArray(processRecord["modules"])
        ? (processRecord["modules"] as Array<Record<string, unknown>>)
        : [];
      const moduleIndex = modules.findIndex(function (entry) {
        return entry["id"] === moduleId;
      });
      const nextModule = {
        ...(moduleIndex >= 0 ? modules[moduleIndex] : { id: moduleId }),
        ...patch,
      };
      if (moduleIndex >= 0) {
        modules[moduleIndex] = nextModule;
      } else {
        modules.push(nextModule);
      }
      processRecord["modules"] = modules;
      return nextModule;
    }

    let activeProject: Record<string, unknown> = {
      id: "project-cancel-process",
      slug: "project-cancel-process",
      source: {
        kind: "audio",
        status: "ready",
        storedPath: "/tmp/lab-audio.wav",
      },
      edit: {},
      process: {
        records: {},
      },
      report: {
        records: {},
      },
      workbench: {
        analysisScope: {
          focus: "audio",
        },
      },
      assets: [],
    };
    const runtime: Record<string, unknown> = {
      jobs: {},
    };
    const pushedJobStates: Array<Record<string, unknown>> = [];
    let resolveRunner: ((value: unknown) => void) | null = null;
    let resolveRunnerStarted: (() => void) | null = null;
    const runnerOutput = new Promise<unknown>(function (resolve) {
      resolveRunner = resolve;
    });
    const runnerStarted = new Promise<void>(function (resolve) {
      resolveRunnerStarted = resolve;
    });
    let releaseCancelJobs: (() => void) | null = null;
    const cancelJobsBlocked = new Promise<void>(function (resolve) {
      releaseCancelJobs = resolve;
    });

    const processRuntime = createLaboratoryProcessRuntime({
      appendProcessEvent(record, event) {
        record["events"] = (Array.isArray(record["events"]) ? record["events"] : []).concat(event);
        return record;
      },
      asNonEmptyString,
      buildAudioAnalysisModules() {
        return [{ id: "audio-core", title: "Audio Core", status: "queued" }];
      },
      buildMediaProcessModules() {
        return [];
      },
      async cancelProcessJobsForProject(_api, runtimeRecord, projectId, requestId) {
        await cancelJobsBlocked;
        const jobs = toRecord(runtimeRecord["jobs"]);
        Object.keys(jobs).forEach(function (jobId) {
          const job = toRecord(jobs[jobId]);
          if (job["projectId"] !== projectId) {
            return;
          }
          pushedJobStates.push({
            requestId,
            jobId,
            action: job["action"],
            projectId,
            featureStage: "process",
            stage: "cancelled",
          });
          delete jobs[jobId];
        });
      },
      clearJob(runtimeRecord, jobId) {
        delete toRecord(runtimeRecord["jobs"])[jobId];
      },
      clone<T>(value: T): T {
        return structuredClone(value);
      },
      composeFeatureReport() {
        return { summary: "report skipped" };
      },
      createEmptyFeatureProcessRecord(featureId) {
        return { featureId, status: "idle", events: [], modules: [] };
      },
      createEmptyProcessRun(featureId) {
        return { featureId, status: "idle", events: [], modules: [] };
      },
      ensureEditToolReady() {},
      ensureProcessJobSlotAvailable() {},
      async ensureProjectDirectories() {},
      getActiveProject() {
        return activeProject;
      },
      getFeatureProcessDir() {
        return "/tmp";
      },
      getFeatureProcessJobAction(featureId) {
        return featureId === "audio-analysis" ? "audio-process-run" : "process-run";
      },
      getFeatureProcessRecord(project, featureId) {
        return toRecord(toRecord(toRecord(project["process"])["records"])[featureId]);
      },
      async patchActiveProject(_runtime, patcher) {
        activeProject = patcher(activeProject);
      },
      pushJobState(_api, payload) {
        pushedJobStates.push({ ...payload });
      },
      registerJob(runtimeRecord, job) {
        toRecord(runtimeRecord["jobs"])[String(job["jobId"])] = job;
      },
      resolveProcessRunFeatureIds() {
        return ["audio-analysis"];
      },
      resolveProcessWorkbench(project) {
        return toRecord(project["workbench"]);
      },
      resolveProcessTarget() {
        return {
          requestedMode: "original",
          mode: "original",
          outputId: null,
          signature: "audio-signature",
          label: "Audio source",
          fileName: "lab-audio.wav",
          mimeType: "audio/wav",
          path: "/tmp/lab-audio.wav",
          entries: [],
        };
      },
      sanitizeFileSegment(value, fallbackValue) {
        return asNonEmptyString(value.replace(/[^a-z0-9-]+/gi, "-").toLowerCase()) ?? fallbackValue;
      },
      setFeatureProcessRecord(project, featureId, record) {
        const processState = toRecord(project["process"]);
        const records = toRecord(processState["records"]);
        records[featureId] = record;
        project["process"] = {
          ...processState,
          records,
        };
      },
      setFeatureReportRecord(project, featureId, report) {
        const reportState = toRecord(project["report"]);
        const records = toRecord(reportState["records"]);
        records[featureId] = report;
        project["report"] = {
          ...reportState,
          records,
        };
      },
      toRecord,
      updateProcessRecordPercent() {},
      markFeatureReportStale() {},
      audioFeatureId: "audio-analysis",
      buildProcessSpeechAvailability() {
        return {};
      },
      clampProfileTranscriptSampleSeconds() {
        return 30;
      },
      createProcessArtifact(
        moduleId: unknown,
        kind: unknown,
        path: unknown,
        title: unknown,
        metadata: unknown
      ) {
        return { id: `${String(moduleId)}-${String(kind)}`, moduleId, kind, path, title, metadata };
      },
      createProcessFinding(
        moduleId: unknown,
        kind: unknown,
        level: unknown,
        confidence: unknown,
        title: unknown,
        detail: unknown,
        evidenceCount: unknown,
        artifactIds: unknown
      ) {
        return {
          id: `${String(moduleId)}-${String(kind)}`,
          moduleId,
          kind,
          level,
          confidence,
          title,
          detail,
          evidenceCount,
          artifactIds,
        };
      },
      generateProcessFramePreviewArtifact() {
        return null;
      },
      generateProcessImageComparisonArtifact() {
        return null;
      },
      generateProcessMetadataArtifact() {
        return null;
      },
      generateProcessSpectrogram() {
        return null;
      },
      generateProcessVisualTransformArtifact() {
        return null;
      },
      getAudioAnalysisModuleProcessDir() {
        return "/tmp";
      },
      getAudioAnalysisModuleRunner() {
        return async function () {
          resolveRunnerStarted?.();
          return await runnerOutput;
        };
      },
      maybeRunTranscriptProfileSample() {
        return null;
      },
      normalizeProcessArtifact(rawValue: unknown) {
        return toRecord(rawValue);
      },
      normalizeProcessFinding(rawValue: unknown) {
        return toRecord(rawValue);
      },
      partitionVisualAnalysisModuleIds() {
        return {};
      },
      resolveEnabledVisualAnalysisModuleIds() {
        return [];
      },
      runAudioStructureProbe() {
        return null;
      },
      runVideoStructureProbe() {
        return null;
      },
      updateProcessModule,
      async writeJsonFile() {},
      async writeTextFile() {},
    });

    const runPromise = processRuntime.runFeatureProcess(
      {},
      runtime,
      "req-process-run",
      "audio-analysis",
      activeProject["workbench"]
    );
    await runnerStarted;

    const cancelPromise = processRuntime.cancelFeatureProcess(
      {},
      runtime,
      "req-process-cancel",
      "audio-analysis",
      activeProject["workbench"]
    );
    const immediateCancelResult = await Promise.race([
      cancelPromise,
      new Promise<string>(function (resolve) {
        setTimeout(function () {
          resolve("blocked");
        }, 0);
      }),
    ]);
    assert.deepEqual(immediateCancelResult, { cancelled: true });
    assert.equal(
      toRecord(toRecord(toRecord(activeProject["process"])["records"])["audio-analysis"])["status"],
      "cancelled"
    );
    (releaseCancelJobs as unknown as () => void)();
    await cancelJobsBlocked;
    await Promise.resolve();
    (resolveRunner as unknown as (value: unknown) => void)({
      status: "ready",
      summary: "late success",
      findings: [],
      artifacts: [],
    });
    const result = await runPromise;

    const processRecord = toRecord(
      toRecord(toRecord(activeProject["process"])["records"])["audio-analysis"]
    );
    assert.deepEqual(result, { cancelled: true });
    assert.equal(processRecord["status"], "cancelled");
    assert.equal(processRecord["jobId"], null);
    assert.equal(processRecord["requestId"], null);
    assert.equal(
      pushedJobStates.some(function (entry) {
        return entry["stage"] === "completed";
      }),
      false
    );
    assert.equal(
      pushedJobStates.some(function (entry) {
        return entry["stage"] === "cancelled" && entry["action"] === "audio-process-run";
      }),
      true
    );
  });

  void test("laboratory process runtime registers generated artifacts as project assets", async () => {
    function toRecord(value: unknown): Record<string, unknown> {
      return value !== null && typeof value === "object" && Array.isArray(value) === false
        ? (value as Record<string, unknown>)
        : {};
    }

    function asNonEmptyString(value: unknown) {
      return typeof value === "string" && value.trim() !== "" ? value.trim() : null;
    }

    function updateProcessModule(
      processRecord: Record<string, unknown>,
      moduleId: string,
      patch: Record<string, unknown>
    ) {
      const modules = Array.isArray(processRecord["modules"])
        ? (processRecord["modules"] as Array<Record<string, unknown>>)
        : [];
      const moduleIndex = modules.findIndex(function (entry) {
        return entry["id"] === moduleId;
      });
      const nextModule = {
        ...(moduleIndex >= 0 ? modules[moduleIndex] : { id: moduleId }),
        ...patch,
      };
      if (moduleIndex >= 0) {
        modules[moduleIndex] = nextModule;
      } else {
        modules.push(nextModule);
      }
      processRecord["modules"] = modules;
      return nextModule;
    }

    let activeProject: Record<string, unknown> = {
      id: "project-artifact-process",
      slug: "project-artifact-process",
      name: "Artifact Process Project",
      source: {
        kind: "video",
        mode: "local",
        status: "ready",
        storedPath: "/tmp/source.mp4",
        metadata: {},
      },
      edit: {},
      process: { records: {} },
      report: { records: {} },
      workbench: {
        analysisScope: {
          hypothesis: "check motion",
        },
      },
      assets: [],
    };
    const runtime: Record<string, unknown> = {
      jobs: {},
    };

    const processRuntime = createLaboratoryProcessRuntime({
      appendProcessEvent(record, event) {
        record["events"] = (Array.isArray(record["events"]) ? record["events"] : []).concat(event);
        return record;
      },
      asNonEmptyString,
      buildAudioAnalysisModules() {
        return [];
      },
      buildMediaProcessModules() {
        return [];
      },
      async cancelProcessJobsForProject() {},
      clearJob(runtimeRecord, jobId) {
        delete toRecord(runtimeRecord["jobs"])[jobId];
      },
      clone<T>(value: T): T {
        return structuredClone(value);
      },
      composeFeatureReport() {
        return { status: "ready" };
      },
      createEmptyFeatureProcessRecord(featureId) {
        return { featureId, status: "idle", events: [], modules: [] };
      },
      createEmptyProcessRun(featureId) {
        return { featureId, status: "idle", events: [], modules: [] };
      },
      ensureEditToolReady() {},
      ensureProcessJobSlotAvailable() {},
      async ensureProjectDirectories() {},
      getActiveProject() {
        return activeProject;
      },
      getFeatureProcessDir() {
        return "/tmp/process";
      },
      getFeatureProcessJobAction() {
        return "process-run";
      },
      getFeatureProcessRecord(project, featureId) {
        return toRecord(toRecord(toRecord(project["process"])["records"])[featureId]);
      },
      async patchActiveProject(_runtime, patcher) {
        activeProject = patcher(activeProject);
      },
      pushJobState() {},
      registerJob(runtimeRecord, job) {
        toRecord(runtimeRecord["jobs"])[String(job["jobId"])] = job;
      },
      resolveProcessRunFeatureIds() {
        return ["media-analysis"];
      },
      resolveProcessWorkbench(project) {
        return toRecord(project["workbench"]);
      },
      resolveProcessTarget() {
        return {
          requestedMode: "original",
          mode: "original",
          outputId: null,
          signature: "video-signature",
          label: "Video source",
          fileName: "source.mp4",
          mimeType: "video/mp4",
          path: "/tmp/source.mp4",
          entries: [],
        };
      },
      sanitizeFileSegment(value, fallbackValue) {
        return asNonEmptyString(value.replace(/[^a-z0-9-]+/gi, "-").toLowerCase()) ?? fallbackValue;
      },
      setFeatureProcessRecord(project, featureId, record) {
        const processState = toRecord(project["process"]);
        const records = toRecord(processState["records"]);
        records[featureId] = record;
        project["process"] = { ...processState, records };
      },
      setFeatureReportRecord(project, featureId, report) {
        const reportState = toRecord(project["report"]);
        const records = toRecord(reportState["records"]);
        records[featureId] = report;
        project["report"] = { ...reportState, records };
      },
      toRecord,
      updateProcessRecordPercent() {},
      markFeatureReportStale() {},
      audioFeatureId: "audio-analysis",
      buildProcessSpeechAvailability() {
        return {};
      },
      clampProfileTranscriptSampleSeconds() {
        return 30;
      },
      createProcessArtifact(
        moduleId: unknown,
        kind: unknown,
        path: unknown,
        title: unknown,
        metadata: unknown
      ) {
        return {
          id: `${String(moduleId)}-${String(kind)}`,
          moduleId,
          kind,
          path,
          fileName: "metadata.json",
          title,
          metadata,
        };
      },
      createProcessFinding(
        moduleId: unknown,
        kind: unknown,
        level: unknown,
        confidence: unknown,
        title: unknown,
        detail: unknown,
        evidenceCount: unknown,
        artifactIds: unknown
      ) {
        return {
          id: `${String(moduleId)}-${String(kind)}`,
          moduleId,
          kind,
          level,
          confidence,
          title,
          detail,
          evidenceCount,
          artifactIds,
        };
      },
      generateProcessFramePreviewArtifact() {
        return null;
      },
      generateProcessImageComparisonArtifact() {
        return null;
      },
      generateProcessMetadataArtifact() {
        return {
          id: "artifact-metadata-1",
          moduleId: "intake",
          kind: "metadata",
          label: "Metadata Snapshot",
          fileName: "source-metadata.json",
          path: "/tmp/process/source-metadata.json",
          status: "ready",
          metadata: { format: "json" },
        };
      },
      generateProcessSpectrogram() {
        return null;
      },
      generateProcessVisualTransformArtifact() {
        return null;
      },
      getAudioAnalysisModuleProcessDir() {
        return "/tmp";
      },
      getAudioAnalysisModuleRunner() {
        return function () {
          return { findings: [], artifacts: [], warnings: [] };
        };
      },
      maybeRunTranscriptProfileSample() {
        return null;
      },
      normalizeProcessArtifact(rawValue: unknown) {
        return toRecord(rawValue);
      },
      normalizeProcessFinding(rawValue: unknown) {
        return toRecord(rawValue);
      },
      partitionVisualAnalysisModuleIds() {
        return {};
      },
      resolveEnabledVisualAnalysisModuleIds() {
        return [];
      },
      runAudioStructureProbe() {
        return null;
      },
      runVideoStructureProbe() {
        return null;
      },
      updateProcessModule,
      async writeJsonFile() {},
      async writeTextFile() {},
    });

    await processRuntime.runFeatureProcess(
      {},
      runtime,
      "req-process-artifact",
      "media-analysis",
      activeProject["workbench"]
    );

    const assets = Array.isArray(activeProject["assets"])
      ? (activeProject["assets"] as Array<Record<string, unknown>>)
      : [];
    const artifactAsset = assets.find(function (asset) {
      return asset["id"] === "process-artifact-artifact-metadata-1";
    });

    assert.equal(artifactAsset?.["type"], "artifact");
    assert.equal(artifactAsset["name"], "source-metadata.json");
    assert.equal(artifactAsset["localPath"], "/tmp/process/source-metadata.json");
    assert.equal(toRecord(artifactAsset["metadata"])["processArtifactId"], "artifact-metadata-1");
    assert.equal(toRecord(artifactAsset["metadata"])["featureId"], "media-analysis");

    const reportAssets = assets.filter(function (asset) {
      return asset["type"] === "report";
    });
    assert.equal(reportAssets.length, 2);
    assert.deepEqual(
      reportAssets.map(function (asset) {
        return asset["name"];
      }),
      ["Media Analysis User Report", "Media Analysis AI Report"]
    );
    assert.equal(toRecord(reportAssets[0]?.["metadata"])["format"], "inline");
    assert.equal(toRecord(reportAssets[0]?.["metadata"])["reportView"], "user");
  });

  void test("laboratory process runtime materializes remote workspace image targets before analysis", async () => {
    function toRecord(value: unknown): Record<string, unknown> {
      return value !== null && typeof value === "object" && Array.isArray(value) === false
        ? (value as Record<string, unknown>)
        : {};
    }

    function asNonEmptyString(value: unknown) {
      return typeof value === "string" && value.trim() !== "" ? value.trim() : null;
    }

    function updateProcessModule(
      processRecord: Record<string, unknown>,
      moduleId: string,
      patch: Record<string, unknown>
    ) {
      const modules = Array.isArray(processRecord["modules"])
        ? (processRecord["modules"] as Array<Record<string, unknown>>)
        : [];
      const moduleIndex = modules.findIndex(function (entry) {
        return entry["id"] === moduleId;
      });
      const nextModule = {
        ...(moduleIndex >= 0 ? modules[moduleIndex] : { id: moduleId }),
        ...patch,
      };
      if (moduleIndex >= 0) {
        modules[moduleIndex] = nextModule;
      } else {
        modules.push(nextModule);
      }
      processRecord["modules"] = modules;
      return nextModule;
    }

    let activeProject: Record<string, unknown> = {
      id: "project-remote-process",
      slug: "project-remote-process",
      name: "Remote Process Project",
      source: {
        kind: "video",
        mode: "local",
        status: "ready",
        storedPath: "/tmp/source.mp4",
        metadata: {},
      },
      edit: {},
      process: { records: {} },
      report: { records: {} },
      workbench: {
        workspaceTargetAssetId: "asset-remote-a",
        comparisonReferenceAssetId: "asset-remote-b",
        analysisScope: {
          comparison: {
            primary: {
              assetId: "asset-remote-a",
              sourceKind: "image",
              url: "https://example.test/a.png",
            },
            reference: {
              assetId: "asset-remote-b",
              sourceKind: "image",
              url: "https://example.test/b.png",
            },
          },
        },
      },
      assets: [
        {
          id: "asset-remote-a",
          type: "image",
          name: "a.png",
          url: "https://example.test/a.png",
          createdAt: 1,
          metadata: { sourceKind: "image" },
        },
        {
          id: "asset-remote-b",
          type: "image",
          name: "b.png",
          url: "https://example.test/b.png",
          createdAt: 2,
          metadata: { sourceKind: "image" },
        },
      ],
    };
    const runtime: Record<string, unknown> = {
      jobs: {},
    };
    const downloads: Array<Record<string, unknown>> = [];
    let resolvedTargetPath: unknown = null;

    const processRuntime = createLaboratoryProcessRuntime({
      appendProcessEvent(record, event) {
        record["events"] = (Array.isArray(record["events"]) ? record["events"] : []).concat(event);
        return record;
      },
      asNonEmptyString,
      buildAudioAnalysisModules() {
        return [];
      },
      buildMediaProcessModules() {
        return [];
      },
      callRoomTools: async (payload) => {
        downloads.push(payload);
        const url = typeof payload["url"] === "string" ? payload["url"] : "";
        const fileName = url.endsWith("b.png") ? "b.png" : "a.png";
        return {
          download: {
            fileName,
            path: `/tmp/project-remote-process/sources/${fileName}`,
          },
        };
      },
      async cancelProcessJobsForProject() {},
      clearJob(runtimeRecord, jobId) {
        delete toRecord(runtimeRecord["jobs"])[jobId];
      },
      clone<T>(value: T): T {
        return structuredClone(value);
      },
      composeFeatureReport() {
        return { status: "ready" };
      },
      createEmptyFeatureProcessRecord(featureId) {
        return { featureId, status: "idle", events: [], modules: [] };
      },
      createEmptyProcessRun(featureId) {
        return { featureId, status: "idle", events: [], modules: [] };
      },
      ensureEditToolReady() {},
      ensureProcessJobSlotAvailable() {},
      async ensureProjectDirectories() {},
      getActiveProject() {
        return activeProject;
      },
      getFeatureProcessDir() {
        return "/tmp/process";
      },
      getFeatureProcessJobAction() {
        return "process-run";
      },
      getFeatureProcessRecord(project, featureId) {
        return toRecord(toRecord(toRecord(project["process"])["records"])[featureId]);
      },
      getProjectSourceDir() {
        return "/tmp/project-remote-process/sources";
      },
      async patchActiveProject(_runtime, patcher) {
        activeProject = patcher(activeProject);
      },
      pushJobState() {},
      registerJob(runtimeRecord, job) {
        toRecord(runtimeRecord["jobs"])[String(job["jobId"])] = job;
      },
      resolveProcessRunFeatureIds() {
        return ["media-analysis"];
      },
      resolveProcessWorkbench(project) {
        return toRecord(project["workbench"]);
      },
      resolveProcessTarget(project) {
        const workbench = toRecord(project["workbench"]);
        const assetId = asNonEmptyString(workbench["workspaceTargetAssetId"]);
        const assets = Array.isArray(project["assets"])
          ? (project["assets"] as Array<Record<string, unknown>>)
          : [];
        const asset =
          assets.find(function (entry) {
            return entry["id"] === assetId;
          }) ?? {};
        resolvedTargetPath = asset["localPath"];
        return {
          requestedMode: "workspace-asset",
          mode: "workspace-asset",
          outputId: assetId,
          signature: `asset:${String(assetId)}`,
          label: asset["name"],
          fileName: asset["name"],
          mimeType: "image/png",
          path: asset["localPath"],
          sourceKind: "image",
        };
      },
      sanitizeFileSegment(value, fallbackValue) {
        return asNonEmptyString(value.replace(/[^a-z0-9-]+/gi, "-").toLowerCase()) ?? fallbackValue;
      },
      setFeatureProcessRecord(project, featureId, record) {
        const processState = toRecord(project["process"]);
        const records = toRecord(processState["records"]);
        records[featureId] = record;
        project["process"] = { ...processState, records };
      },
      setFeatureReportRecord(project, featureId, report) {
        const reportState = toRecord(project["report"]);
        const records = toRecord(reportState["records"]);
        records[featureId] = report;
        project["report"] = { ...reportState, records };
      },
      toRecord,
      updateProcessRecordPercent() {},
      markFeatureReportStale() {},
      audioFeatureId: "audio-analysis",
      buildProcessSpeechAvailability() {
        return {};
      },
      clampProfileTranscriptSampleSeconds() {
        return 30;
      },
      createProcessArtifact(
        moduleId: unknown,
        kind: unknown,
        path: unknown,
        title: unknown,
        metadata: unknown
      ) {
        return { id: `${String(moduleId)}-${String(kind)}`, moduleId, kind, path, title, metadata };
      },
      createProcessFinding(
        moduleId: unknown,
        kind: unknown,
        level: unknown,
        confidence: unknown,
        title: unknown,
        detail: unknown,
        evidenceCount: unknown,
        artifactIds: unknown
      ) {
        return { moduleId, kind, level, confidence, title, detail, evidenceCount, artifactIds };
      },
      generateProcessFramePreviewArtifact() {
        return null;
      },
      generateProcessImageComparisonArtifact() {
        return null;
      },
      generateProcessMetadataArtifact() {
        return null;
      },
      generateProcessSpectrogram() {
        return null;
      },
      generateProcessVisualTransformArtifact() {
        return null;
      },
      getAudioAnalysisModuleProcessDir() {
        return "/tmp";
      },
      getAudioAnalysisModuleRunner() {
        return function () {
          return { findings: [], artifacts: [], warnings: [] };
        };
      },
      maybeRunTranscriptProfileSample() {
        return null;
      },
      normalizeProcessArtifact(rawValue: unknown) {
        return toRecord(rawValue);
      },
      normalizeProcessFinding(rawValue: unknown) {
        return toRecord(rawValue);
      },
      partitionVisualAnalysisModuleIds() {
        return {};
      },
      resolveEnabledVisualAnalysisModuleIds() {
        return [];
      },
      roomId: "laboratory",
      runAudioStructureProbe() {
        return null;
      },
      runVideoStructureProbe() {
        return null;
      },
      updateProcessModule,
      async writeJsonFile() {},
      async writeTextFile() {},
    });

    await processRuntime.runFeatureProcess(
      {},
      runtime,
      "req-remote-process",
      "media-analysis",
      activeProject["workbench"]
    );

    assert.deepEqual(
      downloads.map(function (entry) {
        return entry["url"];
      }),
      ["https://example.test/a.png", "https://example.test/b.png"]
    );
    assert.equal(resolvedTargetPath, "/tmp/project-remote-process/sources/a.png");
    const assets = activeProject["assets"] as Array<Record<string, unknown>>;
    assert.equal(
      assets.some(function (asset) {
        return asset["id"] === "asset-remote-a" && asset["localPath"] === resolvedTargetPath;
      }),
      true
    );
    assert.deepEqual(
      toRecord(toRecord(activeProject["workbench"])["analysisScope"])["comparison"],
      {
        primary: {
          assetId: "asset-remote-a",
          fileName: "a.png",
          label: "a.png",
          localPath: "/tmp/project-remote-process/sources/a.png",
          metadata: {
            sourceKind: "image",
          },
          name: "a.png",
          path: "/tmp/project-remote-process/sources/a.png",
          sourceKind: "image",
          type: "image",
          url: "https://example.test/a.png",
        },
        reference: {
          assetId: "asset-remote-b",
          fileName: "b.png",
          label: "b.png",
          localPath: "/tmp/project-remote-process/sources/b.png",
          metadata: {
            sourceKind: "image",
          },
          name: "b.png",
          path: "/tmp/project-remote-process/sources/b.png",
          sourceKind: "image",
          type: "image",
          url: "https://example.test/b.png",
        },
      }
    );
  });
});
