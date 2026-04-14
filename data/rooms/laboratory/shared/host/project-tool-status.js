export function createLaboratoryProjectToolStatusRuntime(deps) {
  const {
    callRoomTools,
    createDefaultToolEntry,
    getRuntimeToolIds,
    persistToolState,
    roomId,
    toRecord
  } = deps;
  async function refreshToolStatus(runtime) {
    const toolIds = getRuntimeToolIds(runtime);
    for (let index = 0; index < toolIds.length; index += 1) {
      const toolId = toolIds[index];
      if (!toolId) {
        continue;
      }
      const currentEntry = runtime.toolState.tools[toolId] || createDefaultToolEntry(toolId);
      try {
        const probeResult = await callRoomTools({
          operation: "tool-probe",
          roomId,
          toolId
        });
        const probeTool = toRecord(probeResult["tool"]);
        runtime.toolState.tools[toolId] = {
          ...currentEntry,
          ...probeTool,
          toolId,
          busy: false,
          lastError: typeof probeTool["lastError"] === "string" && probeTool["lastError"].trim() !== "" ? probeTool["lastError"] : null,
          lastCheckedAt: (/* @__PURE__ */ new Date()).toISOString()
        };
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
            ...toRecord(currentEntry["details"]),
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
