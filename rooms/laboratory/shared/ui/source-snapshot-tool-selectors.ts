type LaboratorySnapshotRecord = Record<string, unknown>;

type LaboratorySnapshotToolSelectorsDeps = {
  toRecord: (value: unknown) => LaboratorySnapshotRecord;
  getSourceSnapshot: () => LaboratorySnapshotRecord;
  getToolRegistry: () => unknown[];
  getEditCapabilities: () => LaboratorySnapshotRecord;
};

export function createLaboratorySnapshotToolSelectors(deps: LaboratorySnapshotToolSelectorsDeps) {
  const toRecord = deps.toRecord;
  const getSourceSnapshot = deps.getSourceSnapshot;
  const getToolRegistry = deps.getToolRegistry;
  const getEditCapabilities = deps.getEditCapabilities;

  const getToolEntry: (toolId: string) => LaboratorySnapshotRecord = function getToolEntry(
    toolId: string
  ) {
    const tools = toRecord(toRecord(getSourceSnapshot()["toolState"])["tools"]);
    return toRecord(tools[toolId]);
  };

  const getStageToolIds: (stageId: string) => string[] = function getStageToolIds(stageId: string) {
    return getToolRegistry()
      .filter(function (entry: unknown) {
        const toolEntry = toRecord(entry);
        const supportLevel = toRecord(toolEntry["stageSupport"])[stageId];
        return (
          typeof supportLevel === "string" &&
          supportLevel.trim() !== "" &&
          supportLevel !== "unsupported"
        );
      })
      .map(function (entry: unknown) {
        const toolEntry = toRecord(entry);
        return typeof toolEntry["toolId"] === "string" && toolEntry["toolId"].trim() !== ""
          ? toolEntry["toolId"]
          : null;
      })
      .filter(function (entry): entry is string {
        return entry !== null;
      });
  };

  const getWorkspaceCapabilities: (kind: string) => LaboratorySnapshotRecord =
    function getWorkspaceCapabilities(kind: string) {
      return toRecord(toRecord(getEditCapabilities()["workspace"])[kind]);
    };

  return {
    getToolEntry,
    getStageToolIds,
    getWorkspaceCapabilities,
  };
}
