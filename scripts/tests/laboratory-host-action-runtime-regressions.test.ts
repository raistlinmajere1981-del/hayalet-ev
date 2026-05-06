import test from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { createRoomBuiltArtifact, createRoomInstalledCopy } from "./helpers/room-installed-copy.ts";
import { createLaboratoryHostActivation } from "../../rooms/laboratory/shared/host/activation.ts";
import { createMediaExportActionRuntime } from "../../rooms/laboratory/main-functions/media-analysis/host/action-handlers-export.ts";
import { createMediaLocalSourceIntakeRuntime } from "../../rooms/laboratory/main-functions/media-analysis/host/source-intake-local.ts";
import { createLaboratoryJobStateRuntime } from "../../rooms/laboratory/shared/host/job-state.ts";
import { createLaboratoryProcessRuntime } from "../../rooms/laboratory/shared/host/process-runtime.ts";
import { syncSourceLabAssetForProject } from "../../rooms/laboratory/shared/host/lab-assets.ts";
import { createLaboratoryReportExportRuntime } from "../../rooms/laboratory/shared/host/reporting-export.ts";
import {
  createLaboratoryHostUtils,
  sanitizeLaboratoryFileSegment,
  toLaboratoryFfmpegTimestamp,
} from "../../rooms/laboratory/shared/host/host-utils.ts";

test("laboratory host utility helpers preserve file, timestamp, and clamp golden cases", () => {
  const hostUtils = createLaboratoryHostUtils({
    audioFeatureId: "audio-analysis",
    getDefaultSourceType() {
      return "media";
    },
    toRecord(value) {
      return value !== null && typeof value === "object" && Array.isArray(value) === false
        ? (value as Record<string, unknown>)
        : {};
    },
  });

  assert.equal(
    sanitizeLaboratoryFileSegment(" Clip 01 / Final!.mp4 ", "artifact"),
    "clip-01-final-mp4"
  );
  assert.equal(sanitizeLaboratoryFileSegment("", "fallback-name"), "fallback-name");
  assert.equal(toLaboratoryFfmpegTimestamp(1.23456, null), "1.235");
  assert.equal(toLaboratoryFfmpegTimestamp(-1, null), "0");
  assert.equal(toLaboratoryFfmpegTimestamp("bad", "2.000"), "2.000");
  assert.equal(hostUtils.clampNumber("3.5", 0, 2, 1), 2);
  assert.equal(hostUtils.clampNumber("bad", 0, 2, 1), 1);
});

test("laboratory host activation unwraps host-context room-event payloads before saving context", () => {
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
      analysisScope: {
        intentIds: ["audio-investigation"],
      },
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
      analysisScope: {
        intentIds: ["visual-inspection"],
      },
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

test("laboratory process runtime keeps cancelled runs cancelled after the active module resolves", async () => {
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
        intentIds: ["audio-investigation"],
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
      return asNonEmptyString(value.replace(/[^a-z0-9-]+/gi, "-").toLowerCase()) || fallbackValue;
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
    createProcessArtifact(moduleId, kind, path, title, metadata) {
      return { id: `${moduleId}-${kind}`, moduleId, kind, path, title, metadata };
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
      return {
        id: `${moduleId}-${kind}`,
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
    async generateProcessFramePreviewArtifact() {
      return null;
    },
    async generateProcessMetadataArtifact() {
      return null;
    },
    async generateProcessSpectrogram() {
      return null;
    },
    async generateProcessVisualTransformArtifact() {
      return null;
    },
    getAudioAnalysisModuleProcessDir() {
      return "/tmp";
    },
    getAudioAnalysisModuleRunner() {
      return async function () {
        resolveRunnerStarted?.();
        return runnerOutput;
      };
    },
    async maybeRunWhisperProfileSample() {
      return null;
    },
    normalizeProcessArtifact(rawValue) {
      return toRecord(rawValue);
    },
    normalizeProcessFinding(rawValue) {
      return toRecord(rawValue);
    },
    partitionVisualAnalysisModuleIds() {
      return {};
    },
    resolveEnabledVisualAnalysisModuleIds() {
      return [];
    },
    async runAudioStructureProbe() {
      return null;
    },
    async runVideoStructureProbe() {
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
  releaseCancelJobs?.();
  await cancelJobsBlocked;
  await Promise.resolve();
  resolveRunner?.({ status: "ready", summary: "late success", findings: [], artifacts: [] });
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

test("laboratory process runtime registers generated artifacts as project assets", async () => {
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
        intentIds: ["visual-inspection"],
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
      return asNonEmptyString(value.replace(/[^a-z0-9-]+/gi, "-").toLowerCase()) || fallbackValue;
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
    createProcessArtifact(moduleId, kind, path, title, metadata) {
      return {
        id: `${moduleId}-${kind}`,
        moduleId,
        kind,
        path,
        fileName: "metadata.json",
        title,
        metadata,
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
      return {
        id: `${moduleId}-${kind}`,
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
    async generateProcessFramePreviewArtifact() {
      return null;
    },
    async generateProcessMetadataArtifact() {
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
    async generateProcessSpectrogram() {
      return null;
    },
    async generateProcessVisualTransformArtifact() {
      return null;
    },
    getAudioAnalysisModuleProcessDir() {
      return "/tmp";
    },
    getAudioAnalysisModuleRunner() {
      return async function () {
        return { findings: [], artifacts: [], warnings: [] };
      };
    },
    async maybeRunWhisperProfileSample() {
      return null;
    },
    normalizeProcessArtifact(rawValue) {
      return toRecord(rawValue);
    },
    normalizeProcessFinding(rawValue) {
      return toRecord(rawValue);
    },
    partitionVisualAnalysisModuleIds() {
      return {};
    },
    resolveEnabledVisualAnalysisModuleIds() {
      return [];
    },
    async runAudioStructureProbe() {
      return null;
    },
    async runVideoStructureProbe() {
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
  assert.equal(artifactAsset?.["name"], "source-metadata.json");
  assert.equal(artifactAsset?.["localPath"], "/tmp/process/source-metadata.json");
  assert.equal(toRecord(artifactAsset?.["metadata"])["processArtifactId"], "artifact-metadata-1");
  assert.equal(toRecord(artifactAsset?.["metadata"])["featureId"], "media-analysis");
  assert.deepEqual(artifactAsset?.["intentIds"], ["visual-inspection"]);

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

test("laboratory host action composition is extracted into a shared host boundary", async () => {
  const workspaceHostSource = readFileSync("rooms/laboratory/host/index.ts", "utf8");
  const workspaceHostRuntimeSource = readFileSync("rooms/laboratory/host/runtime.ts", "utf8");
  const workspaceHostFoundationSource = readFileSync(
    "rooms/laboratory/host/foundation-runtimes.ts",
    "utf8"
  );
  const workspaceHostProjectSource = readFileSync(
    "rooms/laboratory/host/project-runtimes.ts",
    "utf8"
  );
  const workspaceHostFeatureSource = readFileSync(
    "rooms/laboratory/host/feature-runtimes.ts",
    "utf8"
  );
  const workspaceActionCompositionSource = readFileSync(
    "rooms/laboratory/shared/host/action-composition.ts",
    "utf8"
  );
  const workspaceActionRuntimeSource = readFileSync(
    "rooms/laboratory/shared/host/action-runtime.ts",
    "utf8"
  );
  const workspaceActionRouterSource = readFileSync(
    "rooms/laboratory/shared/host/action-router.ts",
    "utf8"
  );
  const workspaceFeatureAdaptersSource = readFileSync(
    "rooms/laboratory/host/feature-adapters.ts",
    "utf8"
  );

  assert.equal(existsSync("rooms/laboratory/shared/host/action-composition.ts"), true);
  assert.equal(existsSync("rooms/laboratory/shared/host/action-runtime.ts"), true);
  assert.equal(existsSync("rooms/laboratory/host/foundation-runtimes.ts"), true);
  assert.equal(existsSync("rooms/laboratory/host/project-runtimes.ts"), true);
  assert.equal(existsSync("rooms/laboratory/host/feature-runtimes.ts"), true);
  assert.equal(existsSync("rooms/laboratory/host/feature-adapters.ts"), true);
  assert.equal(existsSync("rooms/laboratory/host/runtime.ts"), true);
  assert.match(workspaceHostSource, /\.\/runtime\.js/);
  assert.match(workspaceHostRuntimeSource, /from "\.\/foundation-runtimes\.js"/);
  assert.match(workspaceHostRuntimeSource, /from "\.\/project-runtimes\.js"/);
  assert.match(workspaceHostRuntimeSource, /from "\.\/feature-runtimes\.js"/);
  assert.match(
    workspaceHostFoundationSource,
    /export function createLaboratoryHostFoundation\(\s*deps(?::[\s\S]+?)?\s*\)/
  );
  assert.match(
    workspaceHostProjectSource,
    /export function createLaboratoryHostProjectRuntimes\(\s*deps(?::[\s\S]+?)?\s*\)/
  );
  assert.match(
    workspaceHostFeatureSource,
    /export function createLaboratoryHostFeatureRuntimes\(\s*deps(?::[\s\S]+?)?\s*\)/
  );
  assert.doesNotMatch(workspaceHostSource, /shared\/host\/action-composition\.js/);
  assert.match(
    workspaceActionRuntimeSource,
    /export function createLaboratoryHostActionRuntime\(\s*deps(?::[\s\S]+?)?\s*\)/
  );
  assert.match(workspaceActionRuntimeSource, /function getActionRouter\(\)/);
  assert.match(
    workspaceActionRuntimeSource,
    /function handleToolMutation\(\s*api\??(?::[\s\S]+?)?,\s*runtime\??(?::[\s\S]+?)?,\s*requestId\??(?::[\s\S]+?)?,\s*action\??(?::[\s\S]+?)?,\s*toolId\??(?::[\s\S]+?)?,\s*featureStage\??(?::[\s\S]+?)?\s*\)(?::[\s\S]+?)?/
  );
  assert.match(
    workspaceActionRuntimeSource,
    /function handleMediaAction\(\s*api\??(?::[\s\S]+?)?,\s*runtime\??(?::[\s\S]+?)?,\s*payload\??(?::[\s\S]+?)?\s*\)(?::[\s\S]+?)?/
  );
  assert.match(workspaceActionRuntimeSource, /from "\.\/action-router\.js"/);
  assert.match(
    workspaceActionCompositionSource,
    /export function createLaboratoryActionCompositionRuntime\(\s*deps(?::[\s\S]+?)?\s*\)/
  );
  assert.match(workspaceActionCompositionSource, /from "\.\/action-runtime\.js"/);
  assert.match(workspaceActionCompositionSource, /from "\.\/tool-mutations\.js"/);
  assert.match(
    workspaceActionCompositionSource,
    /from "\.\.\/\.\.\/main-functions\/media-analysis\/host\/action-handlers\.js"/
  );
  assert.match(
    workspaceActionRouterSource,
    /export function createLaboratoryActionRouter\(\s*deps(?::[\s\S]+?)?\s*\)/
  );
  assert.match(
    workspaceFeatureAdaptersSource,
    /export function createLaboratoryFeatureAdapters\(\s*deps(?::[\s\S]+?)?\s*\)/
  );
  assert.match(
    workspaceHostFeatureSource,
    /deleteProject:\s*projectRuntimes\.lifecycle\.deleteProject,/
  );
  assert.match(workspaceFeatureAdaptersSource, /from "\.\.\/shared\/host\/action-composition\.js"/);
  assert.doesNotMatch(workspaceFeatureAdaptersSource, /main-functions\/[^"]+\/host\/runtime\.js/);
  assert.match(workspaceHostFeatureSource, /from "\.\/feature-adapters\.js"/);
  assert.doesNotMatch(
    workspaceHostRuntimeSource,
    /from "\.\.\/shared\/host\/action-composition\.js"/
  );
  assert.doesNotMatch(workspaceHostRuntimeSource, /from "\.\.\/shared\/host\/action-runtime\.js"/);

  const installedCopy = await createRoomInstalledCopy("laboratory");
  const buildArtifact = await createRoomBuiltArtifact("laboratory");

  try {
    const builtHostSource = readFileSync(`${buildArtifact.rootDir}/host/index.js`, "utf8");
    const builtHostRuntimeSource = readFileSync(`${buildArtifact.rootDir}/host/runtime.js`, "utf8");
    const builtHostFoundationSource = readFileSync(
      `${buildArtifact.rootDir}/host/foundation-runtimes.js`,
      "utf8"
    );
    const builtHostProjectSource = readFileSync(
      `${buildArtifact.rootDir}/host/project-runtimes.js`,
      "utf8"
    );
    const builtHostFeatureSource = readFileSync(
      `${buildArtifact.rootDir}/host/feature-runtimes.js`,
      "utf8"
    );
    const builtActionCompositionSource = readFileSync(
      `${buildArtifact.rootDir}/shared/host/action-composition.js`,
      "utf8"
    );
    const builtActionRuntimeSource = readFileSync(
      `${buildArtifact.rootDir}/shared/host/action-runtime.js`,
      "utf8"
    );
    const builtFeatureAdaptersSource = readFileSync(
      `${buildArtifact.rootDir}/host/feature-adapters.js`,
      "utf8"
    );
    const installedHostSource = readFileSync(`${installedCopy.rootDir}/host/index.js`, "utf8");
    const installedHostRuntimeSource = readFileSync(
      `${installedCopy.rootDir}/host/runtime.js`,
      "utf8"
    );
    const installedHostFoundationSource = readFileSync(
      `${installedCopy.rootDir}/host/foundation-runtimes.js`,
      "utf8"
    );
    const installedHostProjectSource = readFileSync(
      `${installedCopy.rootDir}/host/project-runtimes.js`,
      "utf8"
    );
    const installedHostFeatureSource = readFileSync(
      `${installedCopy.rootDir}/host/feature-runtimes.js`,
      "utf8"
    );
    const installedActionCompositionSource = readFileSync(
      `${installedCopy.rootDir}/shared/host/action-composition.js`,
      "utf8"
    );
    const installedActionRuntimeSource = readFileSync(
      `${installedCopy.rootDir}/shared/host/action-runtime.js`,
      "utf8"
    );
    const installedFeatureAdaptersSource = readFileSync(
      `${installedCopy.rootDir}/host/feature-adapters.js`,
      "utf8"
    );

    assert.equal(existsSync(`${installedCopy.rootDir}/shared/host/action-composition.js`), true);
    assert.equal(existsSync(`${installedCopy.rootDir}/shared/host/action-runtime.js`), true);
    assert.equal(existsSync(`${installedCopy.rootDir}/host/foundation-runtimes.js`), true);
    assert.equal(existsSync(`${installedCopy.rootDir}/host/project-runtimes.js`), true);
    assert.equal(existsSync(`${installedCopy.rootDir}/host/feature-runtimes.js`), true);
    assert.equal(existsSync(`${installedCopy.rootDir}/host/feature-adapters.js`), true);
    assert.equal(existsSync(`${installedCopy.rootDir}/host/runtime.js`), true);
    assert.equal(installedHostSource, builtHostSource);
    assert.equal(installedHostRuntimeSource, builtHostRuntimeSource);
    assert.equal(installedHostFoundationSource, builtHostFoundationSource);
    assert.equal(installedHostProjectSource, builtHostProjectSource);
    assert.equal(installedHostFeatureSource, builtHostFeatureSource);
    assert.equal(installedActionCompositionSource, builtActionCompositionSource);
    assert.equal(installedActionRuntimeSource, builtActionRuntimeSource);
    assert.equal(installedFeatureAdaptersSource, builtFeatureAdaptersSource);
  } finally {
    await buildArtifact.cleanup();
    await installedCopy.cleanup();
  }
});

test("laboratory media export runtime cancels only prior export jobs for every export handler", async () => {
  async function runExportCase(
    expectedAssetType: string,
    runExport: (
      exportRuntime: ReturnType<typeof createMediaExportActionRuntime>,
      runtime: { roomId: string; jobs: Record<string, Record<string, unknown>> }
    ) => Promise<unknown>
  ) {
    const cancelledJobIds: string[] = [];
    const pushedJobStates: Array<Record<string, unknown>> = [];
    const sourceActivationAssetIds: string[] = [];
    let activeProject: Record<string, unknown> = {
      id: "project-1",
      source: {
        kind: "video",
        storedPath: "/tmp/lab-demo.mp4",
        metadata: {
          durationSeconds: 1.4,
        },
      },
      process: {
        records: {
          "media-analysis": {
            runId: "run-1",
          },
        },
      },
      workbench: {
        analysisScope: {
          intentIds: ["visual-inspection"],
        },
      },
      assets: [],
    };
    const jobState = createLaboratoryJobStateRuntime({
      roomId: "laboratory",
      cancelRoomTool: async function (_roomId, jobId) {
        cancelledJobIds.push(jobId);
      },
    });

    const exportRuntime = createMediaExportActionRuntime({
      asNonEmptyString(value: unknown) {
        return typeof value === "string" && value.trim() !== "" ? value : null;
      },
      asNumber(value: unknown) {
        return typeof value === "number" && Number.isFinite(value) ? value : null;
      },
      async callRoomTools() {
        return {
          run: {
            exitCode: 0,
          },
        };
      },
      getActiveProject() {
        return activeProject;
      },
      getProjectEditOutputDir() {
        return "/tmp";
      },
      async handleAssetAsSource(_api, _runtime, _requestId, assetId) {
        sourceActivationAssetIds.push(assetId);
      },
      async patchActiveProject(_runtime, patcher) {
        const nextProject = patcher(activeProject);
        activeProject = {
          ...nextProject,
          assets: syncSourceLabAssetForProject(nextProject, nextProject["assets"]),
        };
      },
      pushJobState(_api, payload) {
        pushedJobStates.push({ ...payload });
      },
      registerJob: jobState.registerJob,
      clearJob: jobState.clearJob,
      cancelJobsForProject: jobState.cancelJobsForProject,
      toRecord(value: unknown) {
        return value !== null && typeof value === "object" && Array.isArray(value) === false
          ? (value as Record<string, unknown>)
          : {};
      },
    });

    const runtime = {
      roomId: "laboratory",
      jobs: {
        "process-job": {
          requestId: "req-process-1",
          action: "process-run",
          projectId: "project-1",
          toolId: "ffmpeg",
          featureStage: "process",
          operation: "tool-run",
          stage: "queued",
          percent: null,
          bytesReceived: null,
          bytesTotal: null,
          message: null,
        },
        "old-roi-job": {
          requestId: "req-export-roi-old",
          action: "export-roi-image",
          projectId: "project-1",
          toolId: "ffmpeg",
          featureStage: "edit",
          operation: "tool-run",
          stage: "queued",
          percent: null,
          bytesReceived: null,
          bytesTotal: null,
          message: null,
        },
        "old-frame-job": {
          requestId: "req-export-frame-old",
          action: "export-frame-grab",
          projectId: "project-1",
          toolId: "ffmpeg",
          featureStage: "edit",
          operation: "tool-run",
          stage: "queued",
          percent: null,
          bytesReceived: null,
          bytesTotal: null,
          message: null,
        },
        "old-clip-job": {
          requestId: "req-export-clip-old",
          action: "export-timeline-clip",
          projectId: "project-1",
          toolId: "ffmpeg",
          featureStage: "edit",
          operation: "tool-run",
          stage: "queued",
          percent: null,
          bytesReceived: null,
          bytesTotal: null,
          message: null,
        },
        "old-audio-job": {
          requestId: "req-export-audio-old",
          action: "export-audio-track",
          projectId: "project-1",
          toolId: "ffmpeg",
          featureStage: "edit",
          operation: "tool-run",
          stage: "queued",
          percent: null,
          bytesReceived: null,
          bytesTotal: null,
          message: null,
        },
        "old-clean-audio-job": {
          requestId: "req-export-clean-audio-old",
          action: "export-clean-audio",
          projectId: "project-1",
          toolId: "ffmpeg",
          featureStage: "edit",
          operation: "tool-run",
          stage: "queued",
          percent: null,
          bytesReceived: null,
          bytesTotal: null,
          message: null,
        },
        "old-band-pass-job": {
          requestId: "req-export-band-pass-old",
          action: "export-band-pass-voice",
          projectId: "project-1",
          toolId: "ffmpeg",
          featureStage: "edit",
          operation: "tool-run",
          stage: "queued",
          percent: null,
          bytesReceived: null,
          bytesTotal: null,
          message: null,
        },
      } as Record<string, Record<string, unknown>>,
    };

    await runExport(exportRuntime, runtime);

    assert.deepEqual(cancelledJobIds, [
      "old-roi-job",
      "old-frame-job",
      "old-clip-job",
      "old-audio-job",
      "old-clean-audio-job",
      "old-band-pass-job",
    ]);
    assert.equal(Boolean(runtime.jobs["process-job"]), true);
    assert.deepEqual(Object.keys(runtime.jobs), ["process-job"]);

    const assets = activeProject.assets as Array<Record<string, unknown>>;
    assert.equal(assets.length, 2);
    assert.equal(
      assets.some((asset) => asset["type"] === "source"),
      true
    );
    const outputAsset = assets.find(function (asset) {
      return asset["type"] === expectedAssetType;
    });
    const metadata = (outputAsset?.["metadata"] || {}) as Record<string, unknown>;
    assert.equal(outputAsset?.["runId"], "run-1");
    assert.deepEqual(outputAsset?.["intentIds"], ["visual-inspection"]);
    assert.equal(typeof outputAsset?.["sourceId"], "string");
    assert.equal(outputAsset?.["derivedFromAssetId"], outputAsset?.["sourceId"]);
    assert.equal(outputAsset?.["derivedFromSourceId"], outputAsset?.["sourceId"]);
    assert.equal(metadata["flowKind"], "operation-result");
    assert.equal(metadata["evidenceRole"], "derived");
    if (expectedAssetType === "audio") {
      assert.equal(metadata["operationId"], "audio-extract");
      assert.equal(metadata["filterPreset"], "audio-extract");
      assert.equal(metadata["durationMs"], 1400);
      assert.deepEqual(metadata["sourceRange"], { endMs: 1400, startMs: 0 });
      assert.equal(metadata["startOffsetMs"], 0);
    } else if (expectedAssetType === "clip") {
      assert.equal(metadata["operationId"], "clip-export");
      assert.equal(metadata["filterPreset"], "clip-export");
      assert.deepEqual(metadata["sourceRange"], { endMs: 2400, startMs: 1000 });
    } else if (expectedAssetType === "frame") {
      assert.equal(metadata["operationId"], "frame-grab");
      assert.equal(metadata["filterPreset"], "frame-grab");
      assert.deepEqual(metadata["sourceRange"], { endMs: 1200, startMs: 1200 });
    } else {
      assert.equal(metadata["operationId"], "roi-crop");
      assert.equal(metadata["filterPreset"], "roi-crop");
    }
    const completedPayload =
      pushedJobStates.find(function (payload) {
        return payload["stage"] === "completed";
      }) || null;
    assert.deepEqual(completedPayload?.["resultAssetIds"], [outputAsset?.["id"]]);
    assert.deepEqual(sourceActivationAssetIds, [outputAsset?.["id"]]);
  }

  await runExportCase("image", function (exportRuntime, runtime) {
    return exportRuntime.exportROIImage({}, runtime, "req-export-roi-new", {
      regionId: "face",
      x: 8,
      y: 12,
      width: 120,
      height: 80,
      seekMs: 1200,
    });
  });
  await runExportCase("frame", function (exportRuntime, runtime) {
    return exportRuntime.exportFrameGrab({}, runtime, "req-export-frame-new", {
      seekMs: 1200,
    });
  });
  await runExportCase("clip", function (exportRuntime, runtime) {
    return exportRuntime.exportTimelineClip({}, runtime, "req-export-clip-new", {
      startMs: 1000,
      endMs: 2400,
    });
  });
  await runExportCase("audio", function (exportRuntime, runtime) {
    return exportRuntime.exportAudioTrack({}, runtime, "req-export-audio-new", {});
  });
});

test("laboratory media export runtime reports cancelled tool runs without leaking ffmpeg output", async () => {
  const pushedJobStates: Array<Record<string, unknown>> = [];
  let activeProject: Record<string, unknown> = {
    id: "project-1",
    source: {
      kind: "video",
      storedPath: "/tmp/lab-demo.mp4",
      metadata: {
        durationSeconds: 8,
        height: 360,
        width: 640,
      },
    },
    process: {
      records: {},
    },
    workbench: {
      analysisScope: {},
    },
    assets: [],
  };
  const jobState = createLaboratoryJobStateRuntime({
    roomId: "laboratory",
    cancelRoomTool: async function () {},
  });
  const exportRuntime = createMediaExportActionRuntime({
    asNonEmptyString(value: unknown) {
      return typeof value === "string" && value.trim() !== "" ? value : null;
    },
    asNumber(value: unknown) {
      return typeof value === "number" && Number.isFinite(value) ? value : null;
    },
    async callRoomTools() {
      return {
        run: {
          cancelled: true,
          stderr: "ffmpeg version n6.1 -i /tmp/lab-demo.mp4 leaked command output",
        },
      };
    },
    getActiveProject() {
      return activeProject;
    },
    getProjectEditOutputDir() {
      return "/tmp";
    },
    async handleAssetAsSource() {},
    async patchActiveProject(_runtime, patcher) {
      activeProject = patcher(activeProject);
    },
    pushJobState(_api, payload) {
      pushedJobStates.push({ ...payload });
    },
    registerJob: jobState.registerJob,
    clearJob: jobState.clearJob,
    cancelJobsForProject: jobState.cancelJobsForProject,
    toRecord(value: unknown) {
      return value !== null && typeof value === "object" && Array.isArray(value) === false
        ? (value as Record<string, unknown>)
        : {};
    },
  });
  const runtime = {
    roomId: "laboratory",
    jobs: {},
  };

  const result = (await exportRuntime.exportTimelineClip({}, runtime, "req-export-cancel", {
    endMs: 1200,
    startMs: 0,
  })) as Record<string, unknown>;

  assert.equal(result["cancelled"], true);
  const cancelledPayload =
    pushedJobStates.find(function (payload) {
      return payload["stage"] === "cancelled";
    }) || null;
  assert.equal(cancelledPayload?.["message"], "İşlem iptal edildi.");
  assert.doesNotMatch(String(cancelledPayload?.["message"] || ""), /ffmpeg|-i/);
  assert.equal(
    pushedJobStates.some(function (payload) {
      return payload["stage"] === "failed";
    }),
    false
  );
  assert.deepEqual(Object.keys(runtime.jobs), []);
});

test("laboratory media export runtime preserves payload intent ids before workbench fallback", async () => {
  async function runExportCase(
    assetType: string,
    payloadFactory: (intentIds?: unknown) => Record<string, unknown>
  ) {
    async function runWithIntentIds(intentIds?: unknown) {
      let activeProject: Record<string, unknown> = {
        id: "project-intent-drift",
        source: {
          kind: "video",
          storedPath: "/tmp/lab-demo.mp4",
        },
        process: {
          records: {
            "media-analysis": {
              runId: "run-frozen",
            },
          },
        },
        workbench: {
          analysisScope: {
            intentIds: ["audio-investigation"],
          },
        },
        assets: [],
      };
      const jobState = createLaboratoryJobStateRuntime({
        roomId: "laboratory",
        cancelRoomTool: async function () {},
      });

      const exportRuntime = createMediaExportActionRuntime({
        asNonEmptyString(value: unknown) {
          return typeof value === "string" && value.trim() !== "" ? value : null;
        },
        asNumber(value: unknown) {
          return typeof value === "number" && Number.isFinite(value) ? value : null;
        },
        async callRoomTools() {
          return {
            run: {
              exitCode: 0,
            },
          };
        },
        getActiveProject() {
          return activeProject;
        },
        getProjectEditOutputDir() {
          return "/tmp";
        },
        async handleAssetAsSource() {},
        async patchActiveProject(_runtime, patcher) {
          const nextProject = patcher(activeProject);
          activeProject = {
            ...nextProject,
            assets: syncSourceLabAssetForProject(nextProject, nextProject["assets"]),
          };
        },
        pushJobState() {},
        registerJob: jobState.registerJob,
        clearJob: jobState.clearJob,
        cancelJobsForProject: jobState.cancelJobsForProject,
        toRecord(value: unknown) {
          return value !== null && typeof value === "object" && Array.isArray(value) === false
            ? (value as Record<string, unknown>)
            : {};
        },
      });

      const payload = payloadFactory(intentIds);
      const runtime = {
        roomId: "laboratory",
        jobs: {},
      };

      if (assetType === "image") {
        await exportRuntime.exportROIImage({}, runtime, "req-export-roi-intent", payload);
      } else if (assetType === "clip") {
        await exportRuntime.exportTimelineClip({}, runtime, "req-export-clip-intent", payload);
      } else if (assetType === "audio") {
        await exportRuntime.exportAudioTrack({}, runtime, "req-export-audio-intent", payload);
      } else {
        await exportRuntime.exportFrameGrab({}, runtime, "req-export-frame-intent", payload);
      }

      const assets = activeProject.assets as Array<Record<string, unknown>>;
      return assets.find(function (asset) {
        return asset["type"] === assetType;
      })?.["intentIds"];
    }

    assert.deepEqual(await runWithIntentIds(["visual-inspection"]), ["visual-inspection"]);
    assert.deepEqual(await runWithIntentIds([]), ["audio-investigation"]);
    assert.deepEqual(await runWithIntentIds(), ["audio-investigation"]);
  }

  await runExportCase("frame", function (intentIds?: unknown) {
    return {
      seekMs: 1200,
      ...(intentIds === undefined ? {} : { intentIds }),
    };
  });
  await runExportCase("image", function (intentIds?: unknown) {
    return {
      regionId: "face",
      x: 8,
      y: 12,
      width: 120,
      height: 80,
      seekMs: 1200,
      ...(intentIds === undefined ? {} : { intentIds }),
    };
  });
  await runExportCase("clip", function (intentIds?: unknown) {
    return {
      startMs: 1000,
      endMs: 2400,
      ...(intentIds === undefined ? {} : { intentIds }),
    };
  });
  await runExportCase("audio", function (intentIds?: unknown) {
    return intentIds === undefined ? {} : { intentIds };
  });
});

test("laboratory audio variant exports preserve filter and lineage metadata", async () => {
  async function runAudioVariant(action: "clean" | "voice"): Promise<{
    args: string[];
    completedPayload: Record<string, unknown> | null;
    metadata: Record<string, unknown>;
    outputAssetId: unknown;
  }> {
    const sourceKind = action === "voice" ? "audio" : "video";
    let activeProject: Record<string, unknown> = {
      id: `project-audio-${action}`,
      source: {
        kind: sourceKind,
        storedPath: "/tmp/lab-demo.mp4",
        metadata: {
          audioCodec: "aac",
          durationSeconds: 2.5,
        },
      },
      process: {
        records: {
          "media-analysis": {
            runId: "run-audio-variant",
          },
        },
      },
      workbench: {
        analysisScope: {
          intentIds: ["audio-investigation"],
        },
      },
      assets: [],
    };
    const pushedJobStates: Array<Record<string, unknown>> = [];
    const toolRuns: Array<Record<string, unknown>> = [];
    const jobState = createLaboratoryJobStateRuntime({
      roomId: "laboratory",
      cancelRoomTool: async function () {},
    });
    const exportRuntime = createMediaExportActionRuntime({
      asNonEmptyString(value: unknown) {
        return typeof value === "string" && value.trim() !== "" ? value : null;
      },
      asNumber(value: unknown) {
        return typeof value === "number" && Number.isFinite(value) ? value : null;
      },
      async callRoomTools(payload) {
        toolRuns.push({ ...payload });
        return {
          run: {
            exitCode: 0,
          },
        };
      },
      getActiveProject() {
        return activeProject;
      },
      getProjectEditOutputDir() {
        return "/tmp";
      },
      async handleAssetAsSource() {},
      async patchActiveProject(_runtime, patcher) {
        const nextProject = patcher(activeProject);
        activeProject = {
          ...nextProject,
          assets: syncSourceLabAssetForProject(nextProject, nextProject["assets"]),
        };
      },
      pushJobState(_api, payload) {
        pushedJobStates.push({ ...payload });
      },
      registerJob: jobState.registerJob,
      clearJob: jobState.clearJob,
      cancelJobsForProject: jobState.cancelJobsForProject,
      toRecord(value: unknown) {
        return value !== null && typeof value === "object" && Array.isArray(value) === false
          ? (value as Record<string, unknown>)
          : {};
      },
    });

    if (action === "clean") {
      await exportRuntime.exportCleanAudio({}, { roomId: "laboratory", jobs: {} }, "req-clean", {});
    } else {
      await exportRuntime.exportBandPassVoice(
        {},
        { roomId: "laboratory", jobs: {} },
        "req-voice",
        {}
      );
    }

    const outputAsset = (activeProject.assets as Array<Record<string, unknown>>).find(
      function (asset) {
        return asset["type"] === "audio";
      }
    );
    return {
      args: toolRuns[0]?.["args"] as string[],
      completedPayload:
        pushedJobStates.find(function (payload) {
          return payload["stage"] === "completed";
        }) || null,
      metadata: (outputAsset?.["metadata"] || {}) as Record<string, unknown>,
      outputAssetId: outputAsset?.["id"],
    };
  }

  const clean = await runAudioVariant("clean");
  assert.equal(clean.metadata["operationId"], "audio-cleanup");
  assert.equal(clean.metadata["filterPreset"], "cleanup-basic");
  assert.deepEqual(clean.metadata["sourceRange"], { endMs: 2500, startMs: 0 });
  assert.deepEqual(clean.completedPayload?.["resultAssetIds"], [clean.outputAssetId]);
  assert.equal(
    clean.args.some((arg) => arg.includes("afftdn=nf=-25")),
    true
  );

  const voice = await runAudioVariant("voice");
  assert.equal(voice.metadata["operationId"], "band-pass-voice");
  assert.equal(voice.metadata["filterPreset"], "voice-band-pass");
  assert.deepEqual(voice.completedPayload?.["resultAssetIds"], [voice.outputAssetId]);
  assert.equal(
    voice.args.some(function (arg) {
      return (
        arg.includes("highpass=f=120,lowpass=f=3800") &&
        arg.includes("equalizer=f=1960:t=q:w=1:g=6") &&
        arg.includes("dynaudnorm=f=150:g=12")
      );
    }),
    true
  );
  assert.equal(voice.args[voice.args.indexOf("-ac") + 1], "1");
});

test("laboratory ROI exports normalize crop pixels and preserve operation lineage metadata", async () => {
  let activeProject: Record<string, unknown> = {
    id: "project-roi-lineage",
    source: {
      kind: "video",
      storedPath: "/tmp/lab-demo.mp4",
      metadata: {
        durationSeconds: 8,
        height: 360,
        width: 640,
      },
    },
    process: {
      records: {
        "media-analysis": {
          runId: "run-roi-lineage",
        },
      },
    },
    workbench: {
      analysisScope: {
        intentIds: ["visual-inspection"],
      },
    },
    assets: [],
  };
  const toolRuns: Array<Record<string, unknown>> = [];
  const jobState = createLaboratoryJobStateRuntime({
    roomId: "laboratory",
    cancelRoomTool: async function () {},
  });
  const exportRuntime = createMediaExportActionRuntime({
    asNonEmptyString(value: unknown) {
      return typeof value === "string" && value.trim() !== "" ? value : null;
    },
    asNumber(value: unknown) {
      return typeof value === "number" && Number.isFinite(value) ? value : null;
    },
    async callRoomTools(payload) {
      toolRuns.push({ ...payload });
      return {
        run: {
          exitCode: 0,
        },
      };
    },
    getActiveProject() {
      return activeProject;
    },
    getProjectEditOutputDir() {
      return "/tmp";
    },
    async handleAssetAsSource() {},
    async patchActiveProject(_runtime, patcher) {
      const nextProject = patcher(activeProject);
      activeProject = {
        ...nextProject,
        assets: syncSourceLabAssetForProject(nextProject, nextProject["assets"]),
      };
    },
    pushJobState() {},
    registerJob: jobState.registerJob,
    clearJob: jobState.clearJob,
    cancelJobsForProject: jobState.cancelJobsForProject,
    toRecord(value: unknown) {
      return value !== null && typeof value === "object" && Array.isArray(value) === false
        ? (value as Record<string, unknown>)
        : {};
    },
  });

  await exportRuntime.exportROIImage(
    {},
    {
      roomId: "laboratory",
      jobs: {},
    },
    "req-roi-lineage",
    {
      normalizedRoi: {
        height: 0.5,
        width: 0.5,
        x: 0.1,
        y: 0.1,
      },
      regionId: "selection",
      seekMs: 1500,
    }
  );

  const args = toolRuns[0]?.["args"] as string[];
  assert.equal(args.includes("crop=320:180:64:36"), true);
  const assets = activeProject.assets as Array<Record<string, unknown>>;
  const outputAsset = assets.find(function (asset) {
    return asset["type"] === "image";
  });
  const metadata = (outputAsset?.["metadata"] || {}) as Record<string, unknown>;
  assert.equal(outputAsset?.["runId"], "run-roi-lineage");
  assert.equal(outputAsset?.["derivedFromAssetId"], outputAsset?.["sourceId"]);
  assert.equal(metadata["operationId"], "roi-crop");
  assert.equal(metadata["flowKind"], "operation-result");
  assert.equal(metadata["evidenceRole"], "derived");
  assert.equal(metadata["filterPreset"], "roi-crop");
  assert.deepEqual(metadata["cropPixels"], { height: 180, width: 320, x: 64, y: 36 });
  assert.deepEqual(metadata["sourceDimensions"], { height: 360, width: 640 });
  assert.deepEqual(metadata["sourceRange"], { endMs: 1500, startMs: 1500 });
});

test("laboratory frame export settings drive burst and preview filter arguments", async () => {
  let activeProject: Record<string, unknown> = {
    id: "project-frame-settings",
    source: {
      kind: "video",
      storedPath: "/tmp/lab-demo.mp4",
      metadata: {
        durationSeconds: 4,
        height: 360,
        width: 640,
      },
    },
    process: {
      records: {
        "media-analysis": {
          runId: "run-frame-settings",
        },
      },
    },
    workbench: {},
    assets: [],
  };
  const toolRuns: Array<Record<string, unknown>> = [];
  const jobState = createLaboratoryJobStateRuntime({
    roomId: "laboratory",
    cancelRoomTool: async function () {},
  });
  const exportRuntime = createMediaExportActionRuntime({
    asNonEmptyString(value: unknown) {
      return typeof value === "string" && value.trim() !== "" ? value : null;
    },
    asNumber(value: unknown) {
      return typeof value === "number" && Number.isFinite(value) ? value : null;
    },
    async callRoomTools(payload) {
      toolRuns.push({ ...payload });
      return {
        run: {
          exitCode: 0,
        },
      };
    },
    getActiveProject() {
      return activeProject;
    },
    getProjectEditOutputDir() {
      return "/tmp";
    },
    async handleAssetAsSource() {},
    async patchActiveProject(_runtime, patcher) {
      const nextProject = patcher(activeProject);
      activeProject = {
        ...nextProject,
        assets: syncSourceLabAssetForProject(nextProject, nextProject["assets"]),
      };
    },
    pushJobState() {},
    registerJob: jobState.registerJob,
    clearJob: jobState.clearJob,
    cancelJobsForProject: jobState.cancelJobsForProject,
    toRecord(value: unknown) {
      return value !== null && typeof value === "object" && Array.isArray(value) === false
        ? (value as Record<string, unknown>)
        : {};
    },
  });

  await exportRuntime.exportFrameGrab(
    {},
    {
      jobs: {},
      roomId: "laboratory",
    },
    "req-frame-burst",
    {
      endMs: 2000,
      operationSettings: {
        burstCount: 3,
        frameMode: "burst",
        format: "jpg",
        timestampLabel: true,
      },
      seekMs: 1000,
      startMs: 1000,
    }
  );

  assert.equal(toolRuns.length, 3);
  assert.deepEqual(
    toolRuns.map(function (run) {
      const args = run["args"] as string[];
      return args[args.indexOf("-ss") + 1];
    }),
    ["1", "1.5", "2"]
  );
  assert.equal(
    toolRuns.every(function (run) {
      return (run["args"] as string[]).some(function (arg) {
        return arg.includes("drawtext=");
      });
    }),
    true
  );
  const burstAssets = (activeProject.assets as Array<Record<string, unknown>>).filter(function (
    asset
  ) {
    return asset["type"] === "frame";
  });
  assert.equal(burstAssets.length, 3);

  toolRuns.length = 0;
  await exportRuntime.exportEnhancedFrame(
    {},
    {
      jobs: {},
      roomId: "laboratory",
    },
    "req-enhanced-preview",
    {
      operationSettings: {
        applyPreviewSettings: true,
        preset: "clarity",
      },
      previewSettings: {
        brightness: 130,
        channelB: false,
        channelG: true,
        channelR: true,
        contrast: 120,
        edgeHighlight: true,
        gamma: 1.2,
        hueRotate: 15,
        invert: true,
        saturation: 90,
        sharpness: 130,
      },
      seekMs: 1200,
    }
  );

  const enhancedArgs = toolRuns[0]?.["args"] as string[];
  const filterGraph = enhancedArgs[enhancedArgs.indexOf("-filter:v") + 1] || "";
  assert.match(filterGraph, /colorchannelmixer/);
  assert.match(filterGraph, /edgedetect/);
  assert.match(filterGraph, /negate/);
  const enhancedAsset = (activeProject.assets as Array<Record<string, unknown>>).find(function (
    asset
  ) {
    return asset["type"] === "frame" && String(asset["name"] || "").includes("enhanced-frame");
  });
  assert.equal(
    ((enhancedAsset?.["metadata"] as Record<string, unknown>)["settingsUsed"] as Record<
      string,
      unknown
    >)["applyPreviewSettings"],
    true
  );
});

test("laboratory source intake resolves use-as-source from registered local asset ids only", async () => {
  let activeProject = {
    id: "project-asset-source",
    source: {
      kind: "video",
      status: "ready",
      storedPath: "/tmp/source.mp4",
    },
    assets: [
      {
        id: "asset-local-clip",
        type: "clip",
        name: "clip_01.mp4",
        localPath: "/tmp/clip_01.mp4",
        createdAt: 100,
        sourceId: "source-1",
        runId: "run-1",
      },
      {
        id: "asset-url-clip",
        type: "clip",
        name: "remote_clip.mp4",
        url: "https://example.test/remote_clip.mp4",
        createdAt: 200,
      },
    ],
  } as Record<string, unknown> & { source: Record<string, unknown> };
  const copiedPaths: string[] = [];
  let editResetCount = 0;
  let profileResetCount = 0;

  const sourceRuntime = createMediaLocalSourceIntakeRuntime({
    asNonEmptyString(value: unknown) {
      return typeof value === "string" && value.trim() !== "" ? value : null;
    },
    getActiveProject() {
      return activeProject;
    },
    getElectronApi() {
      return {
        async copyFileTo(sourcePath: string, destinationDir: string) {
          copiedPaths.push(`${sourcePath}->${destinationDir}`);
          return {
            success: true,
            path: `${destinationDir}/clip_01.mp4`,
            name: "clip_01.mp4",
          };
        },
        async showOpenDialog() {
          return { canceled: true, filePaths: [] };
        },
      };
    },
    getProjectSourceDir() {
      return "/tmp/project/source";
    },
    getSourceConfig() {
      return {};
    },
    normalizeMimeType(_fileName: unknown, kind: string) {
      return kind === "audio" ? "audio/wav" : kind === "image" ? "image/png" : "video/mp4";
    },
    async patchActiveProject(_runtime, updater) {
      activeProject = updater(activeProject);
    },
    resetEditForCurrentSource() {
      editResetCount += 1;
    },
    resetProfileForCurrentSource() {
      profileResetCount += 1;
    },
    async resolvePreparedSource(_runtime, _project, options) {
      return {
        metadata: {
          durationSeconds: 1.4,
        },
        metadataError: null,
        mimeType: options["mimeType"] as string,
        storedFileName: options["storedFileName"] as string,
        storedPath: options["storedPath"] as string,
      };
    },
  });

  await assert.rejects(
    sourceRuntime.handleAssetAsSource({}, {}, "req-missing", "asset-missing"),
    /not registered/
  );
  await assert.rejects(
    sourceRuntime.handleAssetAsSource({}, {}, "req-url", "asset-url-clip"),
    /Only local project assets/
  );
  assert.deepEqual(copiedPaths, []);

  await sourceRuntime.handleAssetAsSource({}, {}, "req-local", "asset-local-clip");

  assert.deepEqual(copiedPaths, []);
  assert.equal(activeProject.source["storedPath"], "/tmp/clip_01.mp4");
  assert.equal(activeProject.source["routeLabel"], "Asset reuse");
  assert.equal(activeProject.source["mimeType"], "video/mp4");
  const metadata = activeProject.source["metadata"] as Record<string, unknown>;
  assert.equal(metadata["originAssetId"], "asset-local-clip");
  assert.equal(metadata["derivedFromSourceId"], "source-1");
  assert.equal(metadata["derivedFromRunId"], "run-1");
  const syncedAssets = syncSourceLabAssetForProject(activeProject, activeProject["assets"]);
  const sourceAsset = syncedAssets.find(function (asset) {
    return asset.id === asset.sourceId;
  });
  assert.equal(sourceAsset, undefined);
  assert.equal(metadata["originAssetId"], "asset-local-clip");
  assert.equal(editResetCount, 1);
  assert.equal(profileResetCount, 1);
});

test("laboratory local source picker uses requested import kind filters", async () => {
  let activeProject = {
    id: "project-local-source",
    source: {
      kind: "video",
      status: "idle",
    },
  } as Record<string, unknown> & { source: Record<string, unknown> };
  const requestedKinds: unknown[] = [];
  const dialogFilters: unknown[] = [];
  const selectedPaths = ["/tmp/sound.wav", "/tmp/frame.png"];

  const sourceRuntime = createMediaLocalSourceIntakeRuntime({
    asNonEmptyString(value: unknown) {
      return typeof value === "string" && value.trim() !== "" ? value : null;
    },
    getActiveProject() {
      return activeProject;
    },
    getElectronApi() {
      return {
        async copyFileTo(sourcePath: string, destinationDir: string) {
          const fileName = sourcePath.split(/[\\/]/).pop() || "source.bin";
          return {
            success: true,
            path: `${destinationDir}/${fileName}`,
            name: fileName,
          };
        },
        async showOpenDialog(options: Record<string, unknown>) {
          dialogFilters.push(options["filters"]);
          return {
            canceled: false,
            filePaths: [selectedPaths[dialogFilters.length - 1]],
          };
        },
      };
    },
    getProjectSourceDir() {
      return "/tmp/project/source";
    },
    getSourceConfig(_sourcePresets, sourceKind) {
      requestedKinds.push(sourceKind);
      if (sourceKind === "audio") {
        return { fileDialogFilters: [{ name: "Audio", extensions: ["wav"] }] };
      }
      if (sourceKind === "image") {
        return { fileDialogFilters: [{ name: "Images", extensions: ["png"] }] };
      }
      return { fileDialogFilters: [{ name: "Video", extensions: ["mp4"] }] };
    },
    normalizeMimeType(_fileName: unknown, kind: string) {
      return kind === "audio" ? "audio/wav" : kind === "image" ? "image/png" : "video/mp4";
    },
    async patchActiveProject(_runtime, updater) {
      activeProject = updater(activeProject);
    },
    resetEditForCurrentSource() {},
    resetProfileForCurrentSource() {},
    async resolvePreparedSource(_runtime, _project, options) {
      return {
        metadata: null,
        metadataError: null,
        mimeType: options["mimeType"] as string,
        storedFileName: options["storedFileName"] as string,
        storedPath: options["storedPath"] as string,
      };
    },
  });

  await sourceRuntime.handleLocalPick({}, {}, "req-audio", { kind: "audio" });
  await sourceRuntime.handleLocalPick({}, {}, "req-image", { kind: "image" });

  assert.deepEqual(requestedKinds, ["audio", "image"]);
  assert.deepEqual(dialogFilters, [
    [{ name: "Audio", extensions: ["wav"] }],
    [{ name: "Images", extensions: ["png"] }],
  ]);
  assert.equal(activeProject.source["kind"], "image");
  assert.equal(activeProject.source["storedFileName"], "frame.png");
  assert.equal(activeProject.source["mimeType"], "image/png");
});

test("laboratory local source picker validates auto-detected image sources as images", async () => {
  let activeProject = {
    id: "project-auto-image-source",
    source: {
      kind: "video",
      status: "idle",
    },
  } as Record<string, unknown> & { source: Record<string, unknown> };
  const preparedKinds: unknown[] = [];

  const sourceRuntime = createMediaLocalSourceIntakeRuntime({
    asNonEmptyString(value: unknown) {
      return typeof value === "string" && value.trim() !== "" ? value : null;
    },
    getActiveProject() {
      return activeProject;
    },
    getElectronApi() {
      return {
        async copyFileTo() {
          return {
            success: true,
            path: "/tmp/project/source/frame.png",
            name: "frame.png",
          };
        },
        async showOpenDialog() {
          return {
            canceled: false,
            filePaths: ["/tmp/frame.png"],
          };
        },
      };
    },
    getProjectSourceDir() {
      return "/tmp/project/source";
    },
    getSourceConfig(_sourcePresets, sourceKind) {
      if (sourceKind === "image") {
        return { fileDialogFilters: [{ name: "Images", extensions: ["png"] }] };
      }
      if (sourceKind === "audio") {
        return { fileDialogFilters: [{ name: "Audio", extensions: ["wav"] }] };
      }
      return { fileDialogFilters: [{ name: "Video", extensions: ["mp4"] }] };
    },
    normalizeMimeType(_fileName: unknown, kind: string) {
      return kind === "image" ? "image/png" : "video/mp4";
    },
    async patchActiveProject(_runtime, updater) {
      activeProject = updater(activeProject);
    },
    resetEditForCurrentSource() {},
    resetProfileForCurrentSource() {},
    async resolvePreparedSource(_runtime, project, options) {
      preparedKinds.push(project.source["kind"]);
      return {
        metadata: null,
        metadataError: null,
        mimeType: options["mimeType"] as string,
        storedFileName: options["storedFileName"] as string,
        storedPath: options["storedPath"] as string,
      };
    },
  });

  await sourceRuntime.handleLocalPick({}, {}, "req-auto-image", { kind: "auto" });

  assert.deepEqual(preparedKinds, ["image"]);
  assert.equal(activeProject.source["kind"], "image");
  assert.equal(activeProject.source["mimeType"], "image/png");
});

test("laboratory report export registers user and ai report assets", async () => {
  let activeProject = {
    id: "project-report-1",
    slug: "project-report",
    source: {
      kind: "video",
      storedPath: "/tmp/source.mp4",
    },
    report: {
      records: {
        "media-analysis": {
          status: "ready",
          sourceRunId: "run-report-1",
          exports: [],
          aiReport: {
            manifest: {},
          },
          userReport: {
            summary: "Ready",
          },
        },
      },
    },
    assets: [],
  } as Record<string, unknown>;
  const writtenPaths: string[] = [];
  const jobStages: string[] = [];
  const pushedJobStates: Array<Record<string, unknown>> = [];

  function getReportRecord(project: Record<string, unknown>, featureId: string) {
    return (((project["report"] as Record<string, unknown>)["records"] as Record<string, unknown>)[
      featureId
    ] || {}) as Record<string, unknown>;
  }

  const reportRuntime = createLaboratoryReportExportRuntime({
    buildReportMarkdown() {
      return "# Report";
    },
    clearJob() {},
    composeFeatureReport(_runtime, project, featureId) {
      return getReportRecord(project, featureId);
    },
    async ensureProjectDirectories() {},
    ensureReportJobSlotAvailable() {},
    getActiveProject() {
      return activeProject as Record<string, unknown> & { id: string; slug: string };
    },
    getFeatureReportDir() {
      return "/tmp/project/report";
    },
    getFeatureReportExportAction() {
      return "report-export";
    },
    getFeatureReportRecord: getReportRecord,
    normalizeReportExport(value) {
      return value !== null && typeof value === "object" && Array.isArray(value) === false
        ? (value as Record<string, unknown>)
        : {};
    },
    async patchActiveProject(_runtime, patcher) {
      activeProject = patcher(
        activeProject as Record<string, unknown> & { id: string; slug: string }
      );
    },
    pushJobState(_api, payload) {
      pushedJobStates.push({ ...payload });
      if (typeof payload["stage"] === "string") {
        jobStages.push(payload["stage"]);
      }
    },
    registerJob() {},
    sanitizeFileSegment(value, fallback) {
      return typeof value === "string" && value.trim() !== "" ? value : fallback;
    },
    setFeatureReportRecord(project, featureId, record) {
      const report = project["report"] as Record<string, unknown>;
      const records = report["records"] as Record<string, unknown>;
      records[featureId] = record;
    },
    async writeTextFile(filePath) {
      writtenPaths.push(filePath);
    },
  });

  await reportRuntime.exportFeatureReport({}, {}, "req-report", "media-analysis");

  assert.deepEqual(jobStages, ["queued", "completed"]);
  assert.equal(writtenPaths.length, 2);
  const assets = activeProject["assets"] as Array<Record<string, unknown>>;
  assert.equal(assets.length, 2);
  assert.deepEqual(
    assets.map((asset) => asset["type"]),
    ["report", "report"]
  );
  assert.deepEqual(
    assets.map((asset) => asset["runId"]),
    ["run-report-1", "run-report-1"]
  );
  assert.deepEqual(
    assets.map((asset) => (asset["metadata"] as Record<string, unknown>)["format"]).sort(),
    ["json", "md"]
  );
  const completedPayload =
    pushedJobStates.find(function (payload) {
      return payload["stage"] === "completed";
    }) || null;
  assert.deepEqual(
    completedPayload?.["resultAssetIds"],
    assets.map(function (asset) {
      return asset["id"];
    })
  );
});
