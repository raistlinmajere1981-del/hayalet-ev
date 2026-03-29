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
    toRecord
  } = deps;
  function updateToolBusy(runtime, toolId, busy, lastError) {
    runtime.toolState.tools[toolId] = {
      ...createDefaultToolEntry(toolId),
      ...toRecord(runtime.toolState.tools[toolId]),
      toolId,
      busy: busy === true,
      lastError: lastError || null
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
      jobId,
      requestId,
      action,
      toolId,
      featureStage: featureStage || "source"
    });
    pushJobState(api, {
      requestId,
      jobId,
      action,
      toolId,
      featureStage: featureStage || "source",
      stage: "queued"
    });
    try {
      const result = await callRoomTools({
        operation,
        roomId,
        requestId,
        jobId,
        toolId
      });
      const tool = toRecord(result.tool);
      runtime.toolState.tools[toolId] = {
        ...createDefaultToolEntry(toolId),
        ...toRecord(runtime.toolState.tools[toolId]),
        ...tool,
        toolId,
        busy: false,
        lastError: null,
        updateAvailable: false,
        latestVersion: typeof tool.version === "string" ? tool.version : null,
        latestReleaseTag: typeof tool.releaseTag === "string" ? tool.releaseTag : null,
        latestReleaseName: typeof tool.releaseName === "string" ? tool.releaseName : null,
        lastCheckedAt: (/* @__PURE__ */ new Date()).toISOString()
      };
      await persistToolState(runtime);
      if (toolId === "whisper.cpp") {
        await refreshProfileModelState(runtime);
      }
      pushJobState(api, {
        requestId,
        jobId,
        action,
        toolId,
        featureStage: featureStage || "source",
        stage: "completed",
        percent: 100
      });
      return result.tool;
    } catch (error) {
      updateToolBusy(runtime, toolId, false, error instanceof Error ? error.message : String(error));
      await persistToolState(runtime);
      if (toolId === "whisper.cpp") {
        await refreshProfileModelState(runtime);
      }
      pushJobState(api, {
        requestId,
        jobId,
        action,
        toolId,
        featureStage: featureStage || "source",
        stage: "failed",
        message: error instanceof Error ? error.message : String(error)
      });
      throw error;
    } finally {
      clearJob(runtime, jobId);
    }
  }
  return {
    handleToolMutation,
    updateToolBusy
  };
}
