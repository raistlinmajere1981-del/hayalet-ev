import test from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { createRoomBuiltArtifact, createRoomInstalledCopy } from "./helpers/room-installed-copy.ts";
import { createLaboratoryHostActivation } from "../../rooms/laboratory/shared/host/activation.ts";
import { createMediaExportActionRuntime } from "../../rooms/laboratory/main-functions/media-analysis/host/action-handlers-export.ts";
import { createMediaLocalSourceIntakeRuntime } from "../../rooms/laboratory/main-functions/media-analysis/host/source-intake-local.ts";
import { createLaboratoryJobStateRuntime } from "../../rooms/laboratory/shared/host/job-state.ts";
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
  const pushCalls: Array<string | null> = [];

  let currentContext: Record<string, unknown> = {};

  const activation = createLaboratoryHostActivation({
    createRuntimeState() {
      return {};
    },
    emitEvent() {},
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
      selectedModuleIds: ["audio-analysis", "subtitle-analysis"],
    },
  };
  runtime.onRoomEvent({
    type: "host-context",
    payload: nestedContext,
  });

  assert.deepEqual(savedContexts.at(-1), nestedContext);
  assert.deepEqual(pushCalls, [null]);

  const directContext = {
    type: "host-context",
    roomId: "laboratory",
    featureId: "subtitle-analysis",
    workbench: {
      activeModuleId: "subtitle-analysis",
      selectedModuleIds: ["subtitle-analysis"],
    },
  };
  runtime.onRoomEvent(directContext);

  assert.deepEqual(savedContexts.at(-1), directContext);
  assert.deepEqual(pushCalls, [null, null]);
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
  assert.match(workspaceFeatureAdaptersSource, /deleteProject:\s*UnknownFn;/);
  assert.match(workspaceFeatureAdaptersSource, /deleteProject:\s*deps\.deleteProject,/);
  assert.match(
    workspaceHostFeatureSource,
    /deleteProject:\s*projectRuntimes\.lifecycle\.deleteProject,/
  );
  assert.match(workspaceFeatureAdaptersSource, /from "\.\.\/shared\/host\/action-composition\.js"/);
  assert.match(
    workspaceFeatureAdaptersSource,
    /from "\.\.\/main-functions\/subtitle-analysis\/host\/runtime\.js"/
  );
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
      } as Record<string, Record<string, unknown>>,
    };

    await runExport(exportRuntime, runtime);

    assert.deepEqual(cancelledJobIds, [
      "old-roi-job",
      "old-frame-job",
      "old-clip-job",
      "old-audio-job",
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
    assert.equal(outputAsset?.["runId"], "run-1");
    assert.deepEqual(outputAsset?.["intentIds"], ["visual-inspection"]);
    assert.equal(typeof outputAsset?.["sourceId"], "string");
    if (expectedAssetType === "audio") {
      assert.equal(outputAsset?.["derivedFromAssetId"], outputAsset?.["sourceId"]);
      assert.equal(outputAsset?.["derivedFromSourceId"], outputAsset?.["sourceId"]);
      const metadata = (outputAsset?.["metadata"] || {}) as Record<string, unknown>;
      assert.equal(metadata["durationMs"], 1400);
      assert.equal(metadata["startOffsetMs"], 0);
    }
    const completedPayload =
      pushedJobStates.find(function (payload) {
        return payload["stage"] === "completed";
      }) || null;
    assert.deepEqual(completedPayload?.["resultAssetIds"], [outputAsset?.["id"]]);
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

  assert.deepEqual(copiedPaths, ["/tmp/clip_01.mp4->/tmp/project/source"]);
  assert.equal(activeProject.source["storedPath"], "/tmp/project/source/clip_01.mp4");
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
  assert.equal(sourceAsset?.derivedFromAssetId, "asset-local-clip");
  assert.equal(sourceAsset?.derivedFromSourceId, "source-1");
  assert.equal(editResetCount, 1);
  assert.equal(profileResetCount, 1);
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
