import test from "node:test";
import assert from "node:assert/strict";
import { createMediaExportActionRuntime } from "../../rooms/laboratory/features/media-analysis/host/action-handlers-export.ts";
import { createLaboratoryJobStateRuntime } from "../../rooms/laboratory/shared/host/job-state.ts";
import { syncSourceLabAssetForProject } from "../../rooms/laboratory/shared/host/lab-assets.ts";

describe("comparison finding and frame export", () => {
  void test("laboratory comparison finding saves independent primary and reference ROI context", async () => {
    const primaryRoi = { x: 0.1, y: 0.2, width: 0.3, height: 0.4 };
    const referenceRoi = { x: 0.2, y: 0.1, width: 0.25, height: 0.35 };
    let activeProject: Record<string, unknown> = {
      id: "project-comparison-roi",
      source: {
        kind: "image",
        storedPath: "/tmp/current-source.png",
        metadata: {
          kind: "image",
        },
      },
      process: {
        records: {
          "media-analysis": {
            runId: "run-comparison-roi",
          },
        },
      },
      workbench: {},
      assets: [
        {
          id: "asset-primary",
          type: "image",
          name: "primary.png",
          localPath: "/tmp/primary.png",
          createdAt: 10,
          metadata: { kind: "image" },
        },
        {
          id: "asset-reference",
          type: "image",
          name: "reference.png",
          localPath: "/tmp/reference.png",
          createdAt: 11,
          metadata: { kind: "image" },
        },
      ],
    };
    const toolRuns: Array<Record<string, unknown>> = [];
    const writes: Array<{ data: string; path: string }> = [];
    const jobState = createLaboratoryJobStateRuntime({
      roomId: "laboratory",
      cancelRoomTool: async function (_roomId, _jobId, _requestId) {},
    });
    const exportRuntime = createMediaExportActionRuntime({
      asNonEmptyString(value: unknown) {
        return typeof value === "string" && value.trim() !== "" ? value : null;
      },
      asNumber(value: unknown) {
        return typeof value === "number" && Number.isFinite(value) ? value : null;
      },
      callRoomTools: async (payload) => {
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
      async patchActiveProject(_runtime, patcher) {
        const nextProject = patcher(activeProject);
        activeProject = {
          ...nextProject,
          assets: syncSourceLabAssetForProject(nextProject, nextProject["assets"]),
        };
      },
      pushJobState() {},
      registerJob: jobState.registerJob as unknown as (
        runtime: Record<string, unknown>,
        job: Record<string, unknown>
      ) => void,
      clearJob: jobState.clearJob as unknown as (
        runtime: Record<string, unknown>,
        jobId: string
      ) => void,
      cancelJobsForProject: jobState.cancelJobsForProject as unknown as (
        runtime: Record<string, unknown>,
        projectId: string,
        requestId: string,
        options?: { actionIds?: string[] }
      ) => Promise<unknown>,
      toRecord(value: unknown) {
        return value !== null && typeof value === "object" && Array.isArray(value) === false
          ? (value as Record<string, unknown>)
          : {};
      },
    });
    const originalWindowDescriptor = Object.getOwnPropertyDescriptor(globalThis, "window");
    Object.defineProperty(globalThis, "window", {
      configurable: true,
      value: {
        electronAPI: {
          fmWriteFileAtomic(payload: { data: string; path: string }) {
            writes.push(payload);
            return { path: payload.path, success: true };
          },
          openPath() {
            return { success: true };
          },
          readDirectoryFiles() {
            return [];
          },
          readFile() {
            return null;
          },
          roomToolsCall() {
            return { success: true };
          },
          roomToolsCancel() {
            return { success: true };
          },
        },
      },
    });

    try {
      await exportRuntime.saveComparisonFinding(
        {},
        {
          roomId: "laboratory",
          jobs: {},
        },
        "req-comparison-roi",
        {
          captureKind: "finding",
          comparisonReferenceAssetId: "asset-reference",
          comparisonRoiActiveSide: "reference",
          comparisonRois: {
            activeSide: "reference",
            primary: primaryRoi,
            reference: referenceRoi,
          },
          comparisonViewMode: "roi-detail",
          findingNote: "Reference glow shifted",
          normalizedRoi: referenceRoi,
          operationSettings: {
            format: "png",
            includeRoiDetail: true,
            layout: "side-by-side",
          },
          primaryNormalizedRoi: primaryRoi,
          referenceNormalizedRoi: referenceRoi,
          workspaceTargetAssetId: "asset-primary",
        }
      );
    } finally {
      if (originalWindowDescriptor) {
        Object.defineProperty(globalThis, "window", originalWindowDescriptor);
      } else {
        delete (globalThis as Record<string, unknown>)["window"];
      }
    }

    const renderRun = toolRuns.find(function (run) {
      return run["operation"] === "tool-run";
    });
    const args = (renderRun?.["args"] ?? []) as string[];
    const filterGraph = args[args.indexOf("-filter_complex") + 1] ?? "";
    assert.match(filterGraph, /\[0:v\]crop=iw\*0\.3:ih\*0\.4:iw\*0\.1:ih\*0\.2\[r0src\]/);
    assert.match(filterGraph, /\[1:v\]crop=iw\*0\.25:ih\*0\.35:iw\*0\.2:ih\*0\.1\[r1src\]/);

    const outputAsset = (activeProject["assets"] as Array<Record<string, unknown>>).find(
      function (asset) {
        return (
          asset["type"] === "image" &&
          (asset["metadata"] as Record<string, unknown> | undefined)?.["requestId"] ===
            "req-comparison-roi"
        );
      }
    );
    const metadata = (outputAsset?.["metadata"] ?? {}) as Record<string, unknown>;
    const captureContext = (metadata["captureContext"] ?? {}) as Record<string, unknown>;
    assert.equal(outputAsset?.["derivedFromAssetId"], "asset-primary");
    assert.equal(captureContext["comparisonRoiActiveSide"], "reference");
    assert.deepEqual(captureContext["primaryNormalizedRoi"], primaryRoi);
    assert.deepEqual(captureContext["referenceNormalizedRoi"], referenceRoi);
    assert.deepEqual(captureContext["comparisonRois"], {
      activeSide: "reference",
      primary: primaryRoi,
      reference: referenceRoi,
    });
    assert.equal(writes.length, 1);
    const manifestPayload = JSON.parse(writes[0]?.data ?? "{}") as Record<string, unknown>;
    assert.deepEqual(manifestPayload["comparisonRois"], {
      activeSide: "reference",
      primary: primaryRoi,
      reference: referenceRoi,
    });
    assert.equal(
      manifestPayload["roiSummary"],
      "Primary ROI x=10%, y=20%, w=30%, h=40%; Reference ROI x=20%, y=10%, w=25%, h=35%; active=reference"
    );
    const manifestAsset = (activeProject["assets"] as Array<Record<string, unknown>>).find(
      function (asset) {
        return asset["type"] === "artifact";
      }
    );
    const manifestMetadata = (manifestAsset?.["metadata"] ?? {}) as Record<string, unknown>;
    assert.equal(manifestMetadata["roiSummary"], manifestPayload["roiSummary"]);
    assert.deepEqual(manifestMetadata["comparisonRois"], manifestPayload["comparisonRois"]);
  });

  void test("laboratory frame export settings drive burst and preview filter arguments", async () => {
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
    const cancelledJobIds: string[] = [];
    const toolRuns: Array<Record<string, unknown>> = [];
    const jobState = createLaboratoryJobStateRuntime({
      roomId: "laboratory",
      cancelRoomTool: async function (_roomId, jobId, _requestId) {
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
      callRoomTools: async (payload) => {
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
      async patchActiveProject(_runtime, patcher) {
        const nextProject = patcher(activeProject);
        activeProject = {
          ...nextProject,
          assets: syncSourceLabAssetForProject(nextProject, nextProject["assets"]),
        };
      },
      pushJobState() {},
      registerJob: jobState.registerJob as unknown as (
        runtime: Record<string, unknown>,
        job: Record<string, unknown>
      ) => void,
      clearJob: jobState.clearJob as unknown as (
        runtime: Record<string, unknown>,
        jobId: string
      ) => void,
      cancelJobsForProject: jobState.cancelJobsForProject as unknown as (
        runtime: Record<string, unknown>,
        projectId: string,
        requestId: string,
        options?: { actionIds?: string[] }
      ) => Promise<unknown>,
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
    const burstAssets = (activeProject["assets"] as Array<Record<string, unknown>>).filter(
      function (asset) {
        return asset["type"] === "frame";
      }
    );
    assert.equal(burstAssets.length, 3);

    toolRuns.length = 0;
    await exportRuntime.exportEnhancedFrame(
      {},
      {
        jobs: {
          "old-enhanced-frame-job": {
            action: "export-enhanced-frame",
            featureStage: "edit",
            jobId: "old-enhanced-frame-job",
            projectId: "project-frame-settings",
            requestId: "req-old-enhanced-frame",
            stage: "queued",
            toolId: "ffmpeg",
          },
        },
        roomId: "laboratory",
      },
      "req-enhanced-preview",
      {
        allowParallelWorkspaceOperation: true,
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
        workspaceOperationBatchId: "enhanced-frame-batch",
        workspaceOperationBatchSize: 2,
        workspaceResultMode: "replace-workspace-media",
        workspaceResultTargetSide: "reference",
      }
    );

    assert.deepEqual(cancelledJobIds, []);
    const enhancedArgs = toolRuns[0]?.["args"] as string[];
    const filterGraph = enhancedArgs[enhancedArgs.indexOf("-filter:v") + 1] ?? "";
    assert.match(filterGraph, /colorchannelmixer/);
    assert.match(filterGraph, /edgedetect/);
    assert.match(filterGraph, /negate/);
    const enhancedAsset = (activeProject["assets"] as Array<Record<string, unknown>>).find(
      function (asset) {
        return (
          asset["type"] === "frame" &&
          (typeof asset["name"] === "string" ? asset["name"] : "").includes(
            "enhanced-frame-reference"
          )
        );
      }
    );
    const enhancedMetadata = (enhancedAsset?.["metadata"] ?? {}) as Record<string, unknown>;
    assert.equal(
      (enhancedMetadata["settingsUsed"] as Record<string, unknown>)["applyPreviewSettings"],
      true
    );
    assert.equal(enhancedMetadata["workspaceResultMode"], "replace-workspace-media");
    assert.equal(enhancedMetadata["workspaceResultTargetSide"], "reference");
    assert.equal(enhancedMetadata["workspaceOperationBatchId"], "enhanced-frame-batch");
    assert.equal(enhancedMetadata["workspaceOperationBatchSize"], 2);
  });
});
