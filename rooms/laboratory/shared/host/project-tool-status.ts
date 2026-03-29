// @ts-nocheck
export function createLaboratoryProjectToolStatusRuntime(deps) {
  const {
    callRoomTools,
    createDefaultToolEntry,
    getRuntimeToolIds,
    persistToolState,
    roomId,
    toRecord,
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
          roomId: roomId,
          toolId: toolId,
        });
        runtime.toolState.tools[toolId] = {
          ...currentEntry,
          ...toRecord(probeResult.tool),
          toolId: toolId,
          busy: false,
          lastError: null,
          lastCheckedAt: new Date().toISOString(),
        };

        if (
          checkUpdates &&
          toRecord(toRecord(runtime.toolState.tools[toolId]).details).platformSupported !== false
        ) {
          const updateResult = await callRoomTools({
            operation: "tool-check-for-updates",
            roomId: roomId,
            toolId: toolId,
            installedVersion: runtime.toolState.tools[toolId].version,
            installedReleaseTag: runtime.toolState.tools[toolId].releaseTag,
            installedReleaseName: runtime.toolState.tools[toolId].releaseName,
          });

          runtime.toolState.tools[toolId] = {
            ...runtime.toolState.tools[toolId],
            latestVersion: updateResult.update ? updateResult.update.latestVersion : null,
            latestReleaseTag: updateResult.update ? updateResult.update.latestReleaseTag : null,
            latestReleaseName: updateResult.update ? updateResult.update.latestReleaseName : null,
            releaseUrl: updateResult.update ? updateResult.update.releaseUrl : null,
            updateAvailable: updateResult.update ? updateResult.update.updateAvailable === true : false,
          };
        }
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        runtime.toolState.tools[toolId] = {
          ...currentEntry,
          toolId: toolId,
          installed: false,
          busy: false,
          lastError: message,
          lastCheckedAt: new Date().toISOString(),
          details: {
            ...toRecord(currentEntry.details),
            platformSupported: message.indexOf("does not support") === -1 ? true : false,
            supportError: message,
          },
        };
      }
    }

    await persistToolState(runtime);
  }

  return {
    refreshToolStatus,
  };
}
