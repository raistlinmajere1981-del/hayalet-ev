type LaboratoryRecord = Record<string, unknown>;

type LaboratoryExportActionRuntimeDeps = {
  asNonEmptyString: (value: unknown) => string | null;
  asNumber: (value: unknown) => number | null;
  callRoomTools: (payload: LaboratoryRecord) => Promise<unknown>;
  getActiveProject: (runtime: LaboratoryRecord) => LaboratoryRecord | null;
  getProjectEditOutputDir: (runtime: LaboratoryRecord, project: LaboratoryRecord) => string;
  pushJobState: (api: unknown, payload: LaboratoryRecord) => void;
  registerJob: (runtime: LaboratoryRecord, job: LaboratoryRecord) => void;
  clearJob: (runtime: LaboratoryRecord, jobId: string) => void;
  cancelJobsForProject: (
    runtime: LaboratoryRecord,
    projectId: string,
    requestId: string
  ) => Promise<unknown>;
  toRecord: (value: unknown) => LaboratoryRecord;
};

export function createMediaExportActionRuntime(deps: LaboratoryExportActionRuntimeDeps) {
  const {
    asNonEmptyString,
    asNumber,
    callRoomTools,
    getActiveProject,
    getProjectEditOutputDir,
    pushJobState,
    registerJob,
    clearJob,
    cancelJobsForProject,
    toRecord,
  } = deps;

  function getProjectId(project: LaboratoryRecord): string {
    return asNonEmptyString(project["id"]) || "";
  }

  function getSourceRecord(project: LaboratoryRecord): LaboratoryRecord {
    return toRecord(project["source"]);
  }

  async function exportROIImage(
    api: unknown,
    runtime: LaboratoryRecord,
    requestId: string,
    payload: LaboratoryRecord
  ) {
    const project = getActiveProject(runtime);
    if (project === null) {
      throw new Error("No active project for ROI export.");
    }

    const projectId = getProjectId(project);
    const source = getSourceRecord(project);
    const storedPath = asNonEmptyString(source["storedPath"]);
    if (storedPath === null) {
      throw new Error("No source file available for ROI export.");
    }

    const regionId = asNonEmptyString(payload["regionId"]) || "unknown";
    const cropX = asNumber(payload["x"]) || 0;
    const cropY = asNumber(payload["y"]) || 0;
    const cropW = asNumber(payload["width"]) || 100;
    const cropH = asNumber(payload["height"]) || 100;
    const sourceKind = asNonEmptyString(source["kind"]) || "video";

    await cancelJobsForProject(runtime, projectId, requestId);

    const jobId = `export-roi-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    registerJob(runtime, {
      action: "export-roi-image",
      featureStage: "edit",
      jobId,
      projectId,
      requestId,
      toolId: "ffmpeg",
    });

    pushJobState(api, {
      action: "export-roi-image",
      featureStage: "edit",
      jobId,
      projectId,
      requestId,
      stage: "queued",
      toolId: "ffmpeg",
    });

    try {
      const outputDir = getProjectEditOutputDir(runtime, project);
      const outputFileName = `roi-${regionId}-${Date.now()}.png`;
      const outputPath = `${outputDir}/${outputFileName}`;

      const args: string[] = ["-y"];

      if (sourceKind === "video") {
        const seekMs = asNumber(payload["seekMs"]);
        if (seekMs !== null && seekMs > 0) {
          args.push("-ss", String(seekMs / 1000));
        }
        args.push("-i", storedPath, "-frames:v", "1");
      } else {
        args.push("-i", storedPath);
      }

      args.push(
        "-filter:v",
        `crop=${String(cropW)}:${String(cropH)}:${String(cropX)}:${String(cropY)}`,
        outputPath
      );

      const runResult = toRecord(
        await callRoomTools({
          args,
          cwd: outputDir,
          jobId,
          operation: "tool-run",
          requestId,
          roomId: asNonEmptyString(runtime["roomId"]) || "laboratory",
          timeoutMs: 30 * 1000,
          toolId: "ffmpeg",
        })
      );

      const runPayload = toRecord(runResult["run"]);
      const exitCode = typeof runPayload["exitCode"] === "number" ? runPayload["exitCode"] : 0;
      if (runPayload["cancelled"] === true || exitCode !== 0) {
        throw new Error(asNonEmptyString(runPayload["stderr"]) || "ffmpeg ROI export failed.");
      }

      pushJobState(api, {
        action: "export-roi-image",
        jobId,
        percent: 100,
        projectId,
        requestId,
        stage: "completed",
        toolId: "ffmpeg",
      });

      return {
        outputPath,
        outputFileName,
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      pushJobState(api, {
        action: "export-roi-image",
        jobId,
        message: errorMessage,
        projectId,
        requestId,
        stage: "failed",
        toolId: "ffmpeg",
      });
      throw error;
    } finally {
      clearJob(runtime, jobId);
    }
  }

  async function exportFrameGrab(
    api: unknown,
    runtime: LaboratoryRecord,
    requestId: string,
    payload: LaboratoryRecord
  ) {
    const project = getActiveProject(runtime);
    if (project === null) {
      throw new Error("No active project for frame export.");
    }

    const projectId = getProjectId(project);
    const source = getSourceRecord(project);
    const storedPath = asNonEmptyString(source["storedPath"]);
    if (storedPath === null) {
      throw new Error("No source file available for frame export.");
    }

    const sourceKind = asNonEmptyString(source["kind"]) || "video";
    if (sourceKind !== "video") {
      throw new Error("Frame export is only available for video sources.");
    }

    const seekMs = asNumber(payload["seekMs"]) || 0;

    await cancelJobsForProject(runtime, projectId, requestId);

    const jobId = `export-frame-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    registerJob(runtime, {
      action: "export-frame-grab",
      featureStage: "edit",
      jobId,
      projectId,
      requestId,
      toolId: "ffmpeg",
    });

    pushJobState(api, {
      action: "export-frame-grab",
      featureStage: "edit",
      jobId,
      projectId,
      requestId,
      stage: "queued",
      toolId: "ffmpeg",
    });

    try {
      const outputDir = getProjectEditOutputDir(runtime, project);
      const outputFileName = `frame-${String(Math.round(seekMs))}ms-${Date.now()}.png`;
      const outputPath = `${outputDir}/${outputFileName}`;

      const args = [
        "-y",
        "-ss",
        String(seekMs / 1000),
        "-i",
        storedPath,
        "-frames:v",
        "1",
        "-q:v",
        "2",
        outputPath,
      ];

      const runResult = toRecord(
        await callRoomTools({
          args,
          cwd: outputDir,
          jobId,
          operation: "tool-run",
          requestId,
          roomId: asNonEmptyString(runtime["roomId"]) || "laboratory",
          timeoutMs: 30 * 1000,
          toolId: "ffmpeg",
        })
      );

      const runPayload = toRecord(runResult["run"]);
      const exitCode = typeof runPayload["exitCode"] === "number" ? runPayload["exitCode"] : 0;
      if (runPayload["cancelled"] === true || exitCode !== 0) {
        throw new Error(asNonEmptyString(runPayload["stderr"]) || "ffmpeg frame grab failed.");
      }

      pushJobState(api, {
        action: "export-frame-grab",
        jobId,
        percent: 100,
        projectId,
        requestId,
        stage: "completed",
        toolId: "ffmpeg",
      });

      return {
        outputPath,
        outputFileName,
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      pushJobState(api, {
        action: "export-frame-grab",
        jobId,
        message: errorMessage,
        projectId,
        requestId,
        stage: "failed",
        toolId: "ffmpeg",
      });
      throw error;
    } finally {
      clearJob(runtime, jobId);
    }
  }

  async function exportTimelineClip(
    api: unknown,
    runtime: LaboratoryRecord,
    requestId: string,
    payload: LaboratoryRecord
  ) {
    const project = getActiveProject(runtime);
    if (project === null) {
      throw new Error("No active project for clip export.");
    }

    const projectId = getProjectId(project);
    const source = getSourceRecord(project);
    const storedPath = asNonEmptyString(source["storedPath"]);
    if (storedPath === null) {
      throw new Error("No source file available for clip export.");
    }

    const sourceKind = asNonEmptyString(source["kind"]) || "video";
    if (sourceKind !== "video") {
      throw new Error("Clip export is only available for video sources.");
    }

    const startMs = asNumber(payload["startMs"]) || 0;
    const endMs = asNumber(payload["endMs"]);
    if (endMs === null || endMs <= startMs) {
      throw new Error("Invalid timeline selection for clip export.");
    }
    const durationSec = (endMs - startMs) / 1000;

    const cropRegion = payload["cropRegion"] as LaboratoryRecord | undefined;
    const hasCrop =
      cropRegion &&
      typeof cropRegion["width"] === "number" &&
      typeof cropRegion["height"] === "number" &&
      cropRegion["width"] > 0 &&
      cropRegion["height"] > 0;

    await cancelJobsForProject(runtime, projectId, requestId);

    const jobId = `export-clip-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    registerJob(runtime, {
      action: "export-timeline-clip",
      featureStage: "edit",
      jobId,
      projectId,
      requestId,
      toolId: "ffmpeg",
    });

    pushJobState(api, {
      action: "export-timeline-clip",
      featureStage: "edit",
      jobId,
      projectId,
      requestId,
      stage: "queued",
      toolId: "ffmpeg",
    });

    try {
      const outputDir = getProjectEditOutputDir(runtime, project);
      const outputFileName = `clip-${String(Math.round(startMs))}-${String(Math.round(endMs))}ms-${Date.now()}.mp4`;
      const outputPath = `${outputDir}/${outputFileName}`;

      const args: string[] = [
        "-y",
        "-ss",
        String(startMs / 1000),
        "-i",
        storedPath,
        "-t",
        String(durationSec),
      ];

      if (hasCrop) {
        const cx = Number(cropRegion["x"]);
        const cy = Number(cropRegion["y"]);
        const cw = Number(cropRegion["width"]);
        const ch = Number(cropRegion["height"]);
        args.push("-filter:v", `crop=${String(cw)}:${String(ch)}:${String(cx)}:${String(cy)}`);
      }

      args.push("-c:v", "libx264", "-c:a", "aac", outputPath);

      const runResult = toRecord(
        await callRoomTools({
          args,
          cwd: outputDir,
          jobId,
          operation: "tool-run",
          requestId,
          roomId: asNonEmptyString(runtime["roomId"]) || "laboratory",
          timeoutMs: 5 * 60 * 1000,
          toolId: "ffmpeg",
        })
      );

      const runPayload = toRecord(runResult["run"]);
      const exitCode = typeof runPayload["exitCode"] === "number" ? runPayload["exitCode"] : 0;
      if (runPayload["cancelled"] === true || exitCode !== 0) {
        throw new Error(asNonEmptyString(runPayload["stderr"]) || "ffmpeg clip export failed.");
      }

      pushJobState(api, {
        action: "export-timeline-clip",
        jobId,
        percent: 100,
        projectId,
        requestId,
        stage: "completed",
        toolId: "ffmpeg",
      });

      return {
        outputPath,
        outputFileName,
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      pushJobState(api, {
        action: "export-timeline-clip",
        jobId,
        message: errorMessage,
        projectId,
        requestId,
        stage: "failed",
        toolId: "ffmpeg",
      });
      throw error;
    } finally {
      clearJob(runtime, jobId);
    }
  }

  return {
    exportROIImage,
    exportFrameGrab,
    exportTimelineClip,
  };
}
