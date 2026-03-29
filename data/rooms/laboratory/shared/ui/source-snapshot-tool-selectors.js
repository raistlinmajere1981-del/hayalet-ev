export function createLaboratorySnapshotToolSelectors(deps) {
  const toRecord = deps.toRecord;
  const getSourceSnapshot = deps.getSourceSnapshot;
  const getToolRegistry = deps.getToolRegistry;
  const getEditCapabilities = deps.getEditCapabilities;
  const getToolEntry = function getToolEntry2(toolId) {
    const tools = toRecord(toRecord(getSourceSnapshot().toolState).tools);
    return toRecord(tools[toolId]);
  };
  const getStageToolIds = function getStageToolIds2(stageId) {
    return getToolRegistry().filter(function(entry) {
      const toolEntry = toRecord(entry);
      const supportLevel = toRecord(toolEntry.stageSupport)[stageId];
      return typeof supportLevel === "string" && supportLevel.trim() !== "" && supportLevel !== "unsupported";
    }).map(function(entry) {
      const toolEntry = toRecord(entry);
      return typeof toolEntry.toolId === "string" && toolEntry.toolId.trim() !== "" ? toolEntry.toolId : null;
    }).filter(function(entry) {
      return entry !== null;
    });
  };
  const getWorkspaceCapabilities = function getWorkspaceCapabilities2(kind) {
    return toRecord(toRecord(getEditCapabilities().workspace)[kind]);
  };
  return {
    getToolEntry,
    getStageToolIds,
    getWorkspaceCapabilities
  };
}
