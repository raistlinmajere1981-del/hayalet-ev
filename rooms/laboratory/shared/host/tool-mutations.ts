// @ts-nocheck
export function createLaboratoryToolMutationRuntime(deps) {
  const {
    callRoomTools,
    clearJob,
    createDefaultToolEntry,
    getRuntimeToolIds,
    persistToolState,
    pushJobState,
    refreshProfileModelState,
    registerJob,
    roomId,
    toRecord,
  } = deps;

  function updateToolBusy(runtime, toolId, busy, lastError) {
    runtime.toolState.tools[toolId] = {
      ...createDefaultToolEntry(toolId),
      ...toRecord(runtime.toolState.tools[toolId]),
      toolId: toolId,
      busy: busy === true,
      lastError: lastError || null,
    };
  }

  async function handleToolMutation(api, runtime, requestId, action, toolId, featureStage) {
    if (getRuntimeToolIds(runtime).includes(toolId) === false) {
      throw new Error(`Unsupported tool: ${toolId}`);
    }

    const operation = action === "tool-update" ? "tool-update" : "tool-install";
    const jobId = `room-tool-${toolId}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

    updateToolBusy(runtime, toolId, true, null);
    registerJob(runtime, {
      jobId: jobId,
      requestId: requestId,
      action: action,
      toolId: toolId,
      featureStage: featureStage || "source",
    });

    pushJobState(api, {
      requestId: requestId,
      jobId: jobId,
      action: action,
      toolId: toolId,
      featureStage: featureStage || "source",
      stage: "queued",
    });

    try {
      const result = await callRoomTools({
        operation: operation,
        roomId: roomId,
        requestId: requestId,
        jobId: jobId,
        toolId: toolId,
      });

      runtime.toolState.tools[toolId] = {
        ...createDefaultToolEntry(toolId),
        ...toRecord(runtime.toolState.tools[toolId]),
        ...toRecord(result.tool),
        toolId: toolId,
        busy: false,
        lastError: null,
        updateAvailable: false,
        latestVersion: result.tool ? result.tool.version : null,
        latestReleaseTag: result.tool ? result.tool.releaseTag : null,
        latestReleaseName: result.tool ? result.tool.releaseName : null,
        lastCheckedAt: new Date().toISOString(),
      };

      await persistToolState(runtime);
      if (toolId === "whisper.cpp") {
        await refreshProfileModelState(runtime);
      }
      pushJobState(api, {
        requestId: requestId,
        jobId: jobId,
        action: action,
        toolId: toolId,
        featureStage: featureStage || "source",
        stage: "completed",
        percent: 100,
      });
      return result.tool;
    } catch (error) {
      updateToolBusy(runtime, toolId, false, error instanceof Error ? error.message : String(error));
      await persistToolState(runtime);
      if (toolId === "whisper.cpp") {
        await refreshProfileModelState(runtime);
      }
      pushJobState(api, {
        requestId: requestId,
        jobId: jobId,
        action: action,
        toolId: toolId,
        featureStage: featureStage || "source",
        stage: "failed",
        message: error instanceof Error ? error.message : String(error),
      });
      throw error;
    } finally {
      clearJob(runtime, jobId);
    }
  }

  return {
    handleToolMutation,
    updateToolBusy,
  };
}
