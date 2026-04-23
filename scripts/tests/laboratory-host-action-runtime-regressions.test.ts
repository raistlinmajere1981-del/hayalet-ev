import test from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { createRoomBuiltArtifact, createRoomInstalledCopy } from "./helpers/room-installed-copy.ts";
import { createLaboratoryHostActivation } from "../../rooms/laboratory/shared/host/activation.ts";
import { createMediaExportActionRuntime } from "../../rooms/laboratory/main-functions/media-analysis/host/action-handlers-export.ts";
import { createLaboratoryJobStateRuntime } from "../../rooms/laboratory/shared/host/job-state.ts";

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
  assert.match(workspaceHostFeatureSource, /deleteProject:\s*projectRuntimes\.lifecycle\.deleteProject,/);
  assert.match(workspaceFeatureAdaptersSource, /from "\.\.\/shared\/host\/action-composition\.js"/);
  assert.match(
    workspaceFeatureAdaptersSource,
    /from "\.\.\/main-functions\/subtitle-analysis\/host\/runtime\.js"/
  );
  assert.match(workspaceHostFeatureSource, /from "\.\/feature-adapters\.js"/);
  assert.doesNotMatch(workspaceHostRuntimeSource, /from "\.\.\/shared\/host\/action-composition\.js"/);
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
    const installedHostRuntimeSource = readFileSync(`${installedCopy.rootDir}/host/runtime.js`, "utf8");
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
    const installedActionRuntimeSource = readFileSync(`${installedCopy.rootDir}/shared/host/action-runtime.js`, "utf8");
    const installedFeatureAdaptersSource = readFileSync(`${installedCopy.rootDir}/host/feature-adapters.js`, "utf8");

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
    runExport: (
      exportRuntime: ReturnType<typeof createMediaExportActionRuntime>,
      runtime: { roomId: string; jobs: Record<string, Record<string, unknown>> }
    ) => Promise<unknown>
  ) {
    const cancelledJobIds: string[] = [];
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
        return {
          id: "project-1",
          source: {
            kind: "video",
            storedPath: "/tmp/lab-demo.mp4",
          },
        };
      },
      getProjectEditOutputDir() {
        return "/tmp";
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
      } as Record<string, Record<string, unknown>>,
    };

    await runExport(exportRuntime, runtime);

    assert.deepEqual(cancelledJobIds, ["old-roi-job", "old-frame-job", "old-clip-job"]);
    assert.equal(Boolean(runtime.jobs["process-job"]), true);
    assert.deepEqual(Object.keys(runtime.jobs), ["process-job"]);
  }

  await runExportCase(function (exportRuntime, runtime) {
    return exportRuntime.exportROIImage({}, runtime, "req-export-roi-new", {
      regionId: "face",
      x: 8,
      y: 12,
      width: 120,
      height: 80,
      seekMs: 1200,
    });
  });
  await runExportCase(function (exportRuntime, runtime) {
    return exportRuntime.exportFrameGrab({}, runtime, "req-export-frame-new", {
      seekMs: 1200,
    });
  });
  await runExportCase(function (exportRuntime, runtime) {
    return exportRuntime.exportTimelineClip({}, runtime, "req-export-clip-new", {
      startMs: 1000,
      endMs: 2400,
    });
  });
});
