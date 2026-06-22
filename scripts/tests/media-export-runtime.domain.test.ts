import test from "node:test";
import assert from "node:assert/strict";
import { createMediaExportActionRuntime } from "../../rooms/laboratory/features/media-analysis/host/action-handlers-export.ts";
import { createLaboratoryJobStateRuntime } from "../../rooms/laboratory/shared/host/job-state.ts";
import { syncSourceLabAssetForProject } from "../../rooms/laboratory/shared/host/lab-assets.ts";

describe("media export runtime", () => {
  void test("laboratory media export runtime cancels only prior export jobs for every export handler", async () => {
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
        workbench: {},
        assets: [],
      };
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
        callRoomTools: async (_payload) => ({
          run: {
            exitCode: 0,
          },
        }),
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

      const assets = activeProject["assets"] as Array<Record<string, unknown>>;
      assert.equal(assets.length, 2);
      assert.equal(
        assets.some((asset) => asset["type"] === "source"),
        true
      );
      const outputAsset = assets.find(function (asset) {
        return asset["type"] === expectedAssetType;
      });
      const metadata = (outputAsset?.["metadata"] ?? {}) as Record<string, unknown>;
      assert.equal(outputAsset?.["runId"], "run-1");
      assert.equal(typeof outputAsset["sourceId"], "string");
      assert.equal(outputAsset["derivedFromAssetId"], outputAsset["sourceId"]);
      assert.equal(outputAsset["derivedFromSourceId"], outputAsset["sourceId"]);
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
        }) ?? null;
      assert.deepEqual(
        (completedPayload as NonNullable<typeof completedPayload>)["resultAssetIds"],
        [outputAsset["id"]]
      );
    }

    await runExportCase("image", async function (exportRuntime, runtime) {
      return await exportRuntime.exportROIImage({}, runtime, "req-export-roi-new", {
        regionId: "face",
        x: 8,
        y: 12,
        width: 120,
        height: 80,
        seekMs: 1200,
      });
    });
    await runExportCase("frame", async function (exportRuntime, runtime) {
      return await exportRuntime.exportFrameGrab({}, runtime, "req-export-frame-new", {
        seekMs: 1200,
      });
    });
    await runExportCase("clip", async function (exportRuntime, runtime) {
      return await exportRuntime.exportTimelineClip({}, runtime, "req-export-clip-new", {
        startMs: 1000,
        endMs: 2400,
      });
    });
    await runExportCase("audio", async function (exportRuntime, runtime) {
      return await exportRuntime.exportAudioTrack({}, runtime, "req-export-audio-new", {});
    });
  });

  void test("laboratory media export runtime reports cancelled tool runs without leaking ffmpeg output", async () => {
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
      cancelRoomTool: async function (_roomId, _jobId, _requestId) {},
    });
    const exportRuntime = createMediaExportActionRuntime({
      asNonEmptyString(value: unknown) {
        return typeof value === "string" && value.trim() !== "" ? value : null;
      },
      asNumber(value: unknown) {
        return typeof value === "number" && Number.isFinite(value) ? value : null;
      },
      callRoomTools: async (_payload) => ({
        run: {
          cancelled: true,
          stderr: "ffmpeg version n6.1 -i /tmp/lab-demo.mp4 leaked command output",
        },
      }),
      getActiveProject() {
        return activeProject;
      },
      getProjectEditOutputDir() {
        return "/tmp";
      },
      async patchActiveProject(_runtime, patcher) {
        activeProject = patcher(activeProject);
      },
      pushJobState(_api, payload) {
        pushedJobStates.push({ ...payload });
      },
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
      }) ?? null;
    assert.equal(cancelledPayload?.["message"], "İşlem iptal edildi.");
    assert.doesNotMatch(String(cancelledPayload["message"]), /ffmpeg|-i/);
    assert.equal(
      pushedJobStates.some(function (payload) {
        return payload["stage"] === "failed";
      }),
      false
    );
    assert.deepEqual(Object.keys(runtime.jobs), []);
  });

  void test("laboratory audio variant exports preserve filter and lineage metadata", async () => {
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
        workbench: {},
        assets: [],
      };
      const pushedJobStates: Array<Record<string, unknown>> = [];
      const toolRuns: Array<Record<string, unknown>> = [];
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
        pushJobState(_api, payload) {
          pushedJobStates.push({ ...payload });
        },
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

      if (action === "clean") {
        await exportRuntime.exportCleanAudio(
          {},
          { roomId: "laboratory", jobs: {} },
          "req-clean",
          {}
        );
      } else {
        await exportRuntime.exportBandPassVoice(
          {},
          { roomId: "laboratory", jobs: {} },
          "req-voice",
          {}
        );
      }

      const outputAsset = (activeProject["assets"] as Array<Record<string, unknown>>).find(
        function (asset) {
          return asset["type"] === "audio";
        }
      );
      return {
        args: toolRuns[0]?.["args"] as string[],
        completedPayload:
          pushedJobStates.find(function (payload) {
            return payload["stage"] === "completed";
          }) ?? null,
        metadata: (outputAsset?.["metadata"] ?? {}) as Record<string, unknown>,
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

  void test("laboratory ROI exports normalize crop pixels and preserve operation lineage metadata", async () => {
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
      workbench: {},
      assets: [],
    };
    const toolRuns: Array<Record<string, unknown>> = [];
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
    const assets = activeProject["assets"] as Array<Record<string, unknown>>;
    const outputAsset = assets.find(function (asset) {
      return asset["type"] === "image";
    });
    const metadata = (outputAsset?.["metadata"] ?? {}) as Record<string, unknown>;
    assert.equal(outputAsset?.["runId"], "run-roi-lineage");
    assert.equal(outputAsset["derivedFromAssetId"], outputAsset["sourceId"]);
    assert.equal(metadata["operationId"], "roi-crop");
    assert.equal(metadata["flowKind"], "operation-result");
    assert.equal(metadata["evidenceRole"], "derived");
    assert.equal(metadata["filterPreset"], "roi-crop");
    assert.deepEqual(metadata["cropPixels"], { height: 180, width: 320, x: 64, y: 36 });
    assert.deepEqual(metadata["sourceDimensions"], { height: 360, width: 640 });
    assert.deepEqual(metadata["sourceRange"], { endMs: 1500, startMs: 1500 });

    activeProject = {
      ...activeProject,
      assets: [
        ...(activeProject["assets"] as Array<Record<string, unknown>>),
        {
          id: "asset-image-target",
          type: "image",
          name: "target.png",
          localPath: "/tmp/target.png",
          createdAt: 10,
          derivedFromAssetId: "asset-analysis-artifact",
          metadata: {
            height: 240,
            kind: "image",
            width: 320,
          },
        },
      ],
    };

    await exportRuntime.exportROIImage(
      {},
      {
        roomId: "laboratory",
        jobs: {},
      },
      "req-roi-selected-asset",
      {
        normalizedRoi: {
          height: 0.5,
          width: 0.5,
          x: 0.1,
          y: 0.1,
        },
        regionId: "selected-asset",
        workspaceTargetAssetId: "asset-image-target",
      }
    );

    const selectedArgs = toolRuns[1]?.["args"] as string[];
    assert.equal(selectedArgs.includes("/tmp/target.png"), true);
    assert.equal(selectedArgs.includes("-ss"), false);
    const selectedOutputAsset = (activeProject["assets"] as Array<Record<string, unknown>>).find(
      function (asset) {
        return (
          asset["type"] === "image" &&
          (asset["metadata"] as Record<string, unknown> | undefined)?.["requestId"] ===
            "req-roi-selected-asset"
        );
      }
    );
    const selectedMetadata = (selectedOutputAsset?.["metadata"] ?? {}) as Record<string, unknown>;
    assert.equal(selectedOutputAsset?.["derivedFromAssetId"], "asset-image-target");
    assert.notEqual(selectedOutputAsset["sourceId"], "asset-analysis-artifact");
    assert.equal(selectedOutputAsset["derivedFromSourceId"], undefined);
    assert.deepEqual(selectedMetadata["sourceDimensions"], { height: 240, width: 320 });

    activeProject = {
      ...activeProject,
      assets: [
        ...(activeProject["assets"] as Array<Record<string, unknown>>),
        {
          id: "asset-remote-target",
          type: "clip",
          name: "remote.mp4",
          url: "https://example.test/remote.mp4",
          createdAt: 11,
        },
      ],
    };

    await assert.rejects(
      exportRuntime.exportROIImage(
        {},
        {
          roomId: "laboratory",
          jobs: {},
        },
        "req-roi-remote-target",
        {
          height: 10,
          regionId: "remote-target",
          width: 10,
          workspaceTargetAssetId: "asset-remote-target",
          x: 0,
          y: 0,
        }
      ),
      /not available as a local operation target/
    );
  });
});
