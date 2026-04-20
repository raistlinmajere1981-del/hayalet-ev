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
  function createJobId(prefix, toolId) {
    return `${prefix}-${toolId}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  }
  function getToolEntry(runtime, toolId) {
    return {
      ...createDefaultToolEntry(toolId),
      ...toRecord(runtime.toolState.tools[toolId]),
      toolId
    };
  }
  async function checkToolUpdates(api, runtime, requestId, toolId, featureStage) {
    if (getRuntimeToolIds(runtime).includes(toolId) === false) {
      throw new Error(`Unsupported tool: ${toolId}`);
    }
    const currentEntry = getToolEntry(runtime, toolId);
    if (currentEntry.busy === true) {
      throw new Error(`Tool operation already running: ${toolId}`);
    }
    if (currentEntry.installed !== true) {
      throw new Error(`Tool is not installed: ${toolId}`);
    }
    updateToolBusy(runtime, toolId, true, null);
    await persistToolState(runtime);
    const jobId = createJobId("room-tool-check", toolId);
    registerJob(runtime, {
      jobId,
      requestId,
      action: "tool-check-updates",
      toolId,
      featureStage: featureStage || "source",
      operation: "tool-check-for-updates"
    });
    pushJobState(api, {
      requestId,
      jobId,
      action: "tool-check-updates",
      toolId,
      featureStage: featureStage || "source",
      operation: "tool-check-for-updates",
      stage: "running"
    });
    try {
      const result = await callRoomTools({
        operation: "tool-check-for-updates",
        roomId,
        toolId,
        requestId,
        installedVersion: typeof currentEntry.version === "string" ? currentEntry.version : null,
        installedReleaseTag: typeof currentEntry.releaseTag === "string" ? currentEntry.releaseTag : null,
        installedReleaseName: typeof currentEntry.releaseName === "string" ? currentEntry.releaseName : null
      });
      const update = toRecord(result["update"]);
      const nextEntry = getToolEntry(runtime, toolId);
      runtime.toolState.tools[toolId] = {
        ...nextEntry,
        busy: false,
        latestVersion: typeof update["latestVersion"] === "string" ? update["latestVersion"] : null,
        latestReleaseTag: typeof update["latestReleaseTag"] === "string" ? update["latestReleaseTag"] : null,
        latestReleaseName: typeof update["latestReleaseName"] === "string" ? update["latestReleaseName"] : null,
        releaseUrl: typeof update["releaseUrl"] === "string" ? update["releaseUrl"] : null,
        updateAvailable: update["updateAvailable"] === true,
        lastError: null,
        lastCheckedAt: (/* @__PURE__ */ new Date()).toISOString()
      };
      await persistToolState(runtime);
      pushJobState(api, {
        requestId,
        jobId,
        action: "tool-check-updates",
        toolId,
        featureStage: featureStage || "source",
        operation: "tool-check-for-updates",
        stage: "completed"
      });
      return update;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      const nextEntry = getToolEntry(runtime, toolId);
      runtime.toolState.tools[toolId] = {
        ...nextEntry,
        busy: false,
        lastError: message
      };
      await persistToolState(runtime);
      pushJobState(api, {
        requestId,
        jobId,
        action: "tool-check-updates",
        toolId,
        featureStage: featureStage || "source",
        operation: "tool-check-for-updates",
        stage: "failed",
        message
      });
      throw error;
    } finally {
      clearJob(runtime, jobId);
    }
  }
  async function handleToolMutation(api, runtime, requestId, action, toolId, featureStage) {
    if (getRuntimeToolIds(runtime).includes(toolId) === false) {
      throw new Error(`Unsupported tool: ${toolId}`);
    }
    if (getToolEntry(runtime, toolId).busy === true) {
      throw new Error(`Tool operation already running: ${toolId}`);
    }
    const operation = action === "tool-update" ? "tool-update" : "tool-install";
    const jobId = `room-tool-${toolId}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    updateToolBusy(runtime, toolId, true, null);
    await persistToolState(runtime);
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
      const tool = toRecord(result["tool"]);
      runtime.toolState.tools[toolId] = {
        ...createDefaultToolEntry(toolId),
        ...toRecord(runtime.toolState.tools[toolId]),
        ...tool,
        toolId,
        busy: false,
        lastError: null,
        updateAvailable: false,
        latestVersion: typeof tool["version"] === "string" ? tool["version"] : null,
        latestReleaseTag: typeof tool["releaseTag"] === "string" ? tool["releaseTag"] : null,
        latestReleaseName: typeof tool["releaseName"] === "string" ? tool["releaseName"] : null,
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
        stage: "completed"
      });
      return result["tool"];
    } catch (error) {
      updateToolBusy(
        runtime,
        toolId,
        false,
        error instanceof Error ? error.message : String(error)
      );
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
  async function updateAllTools(api, runtime, requestId, featureStage) {
    if (getRuntimeToolIds(runtime).some(function(toolId) {
      return getToolEntry(runtime, toolId).busy === true;
    })) {
      throw new Error("A tool operation is already running.");
    }
    const installedToolIds = getRuntimeToolIds(runtime).filter(function(toolId) {
      return getToolEntry(runtime, toolId).installed === true;
    });
    const failedToolIds = [];
    for (let index = 0; index < installedToolIds.length; index += 1) {
      const toolId = installedToolIds[index];
      if (!toolId) {
        continue;
      }
      try {
        await checkToolUpdates(api, runtime, requestId, toolId, featureStage);
        if (getToolEntry(runtime, toolId).updateAvailable === true) {
          await handleToolMutation(api, runtime, requestId, "tool-update", toolId, featureStage);
        }
      } catch {
        failedToolIds.push(toolId);
      }
    }
    if (failedToolIds.length > 0) {
      throw new Error(`Some tools could not be updated: ${failedToolIds.join(", ")}`);
    }
  }
  return {
    checkToolUpdates,
    handleToolMutation,
    updateToolBusy,
    updateAllTools
  };
}
