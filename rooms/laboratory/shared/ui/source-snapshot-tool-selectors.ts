// @ts-nocheck
export function createLaboratorySnapshotToolSelectors(deps) {
  const toRecord = deps.toRecord;
  const getSourceSnapshot = deps.getSourceSnapshot;
  const getToolRegistry = deps.getToolRegistry;
  const getEditCapabilities = deps.getEditCapabilities;

  function getToolEntry(toolId) {
    const tools = toRecord(toRecord(getSourceSnapshot().toolState).tools);
    return toRecord(tools[toolId]);
  }

  function getStageToolIds(stageId) {
    return getToolRegistry()
      .filter(function (entry) {
        const supportLevel = toRecord(entry.stageSupport)[stageId];
        return (
          typeof supportLevel === "string" &&
          supportLevel.trim() !== "" &&
          supportLevel !== "unsupported"
        );
      })
      .map(function (entry) {
        return entry.toolId;
      });
  }

  function getWorkspaceCapabilities(kind) {
    return toRecord(toRecord(getEditCapabilities().workspace)[kind]);
  }

  return {
    getToolEntry,
    getStageToolIds,
    getWorkspaceCapabilities,
  };
}
