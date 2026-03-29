export function createLaboratoryProjectToolStatusRuntime(deps) {
  const {
    callRoomTools,
    createDefaultToolEntry,
    getRuntimeToolIds,
    persistToolState,
    roomId,
    toRecord
  } = deps;
  async function refreshToolStatus(runtime, options) {
    const checkUpdates = options && options.checkUpdates === true;
    const toolIds = getRuntimeToolIds(runtime);
    for (let index = 0; index < toolIds.length; index += 1) {
      const toolId = toolIds[index];
      const currentEntry = runtime.toolState.tools[toolId] || createDefaultToolEntry(toolId);
      try {
        const probeResult = await callRoomTools({
          operation: "tool-probe",
          roomId,
          toolId
        });
        const probeTool = toRecord(probeResult.tool);
        runtime.toolState.tools[toolId] = {
          ...currentEntry,
          ...probeTool,
          toolId,
          busy: false,
          lastError: null,
          lastCheckedAt: (/* @__PURE__ */ new Date()).toISOString()
        };
        if (checkUpdates && toRecord(toRecord(runtime.toolState.tools[toolId]).details).platformSupported !== false) {
          const installedEntry = toRecord(runtime.toolState.tools[toolId]);
          const updateResult = await callRoomTools({
            operation: "tool-check-for-updates",
            roomId,
            toolId,
            installedVersion: installedEntry.version,
            installedReleaseTag: installedEntry.releaseTag,
            installedReleaseName: installedEntry.releaseName
          });
          const update = toRecord(updateResult.update);
          runtime.toolState.tools[toolId] = {
            ...runtime.toolState.tools[toolId],
            latestVersion: typeof update.latestVersion === "string" ? update.latestVersion : null,
            latestReleaseTag: typeof update.latestReleaseTag === "string" ? update.latestReleaseTag : null,
            latestReleaseName: typeof update.latestReleaseName === "string" ? update.latestReleaseName : null,
            releaseUrl: typeof update.releaseUrl === "string" ? update.releaseUrl : null,
            updateAvailable: update.updateAvailable === true
          };
        }
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        runtime.toolState.tools[toolId] = {
          ...currentEntry,
          toolId,
          installed: false,
          busy: false,
          lastError: message,
          lastCheckedAt: (/* @__PURE__ */ new Date()).toISOString(),
          details: {
            ...toRecord(currentEntry.details),
            platformSupported: message.indexOf("does not support") === -1 ? true : false,
            supportError: message
          }
        };
      }
    }
    await persistToolState(runtime);
  }
  return {
    refreshToolStatus
  };
}
