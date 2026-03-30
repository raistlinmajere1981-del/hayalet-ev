export function createSubtitleStateDelegatesRuntime(deps: { subtitleStateRuntime: any }) {
  const { subtitleStateRuntime } = deps;

  function getDefaultSubtitleEditPresetId(runtime: any) {
    return subtitleStateRuntime.getDefaultSubtitleEditPresetId(runtime);
  }

  function getDefaultSubtitleEditRecipe(runtime: any, presetId: string) {
    return subtitleStateRuntime.getDefaultSubtitleEditRecipe(runtime, presetId);
  }

  function createEmptySubtitleDiscoveryState() {
    return subtitleStateRuntime.createEmptySubtitleDiscoveryState();
  }

  function createEmptySubtitleAnalysisState(runtime: any) {
    return subtitleStateRuntime.createEmptySubtitleAnalysisState(runtime);
  }

  function normalizeSubtitleAnalysisState(rawValue: unknown, runtime: any) {
    return subtitleStateRuntime.normalizeSubtitleAnalysisState(rawValue, runtime);
  }

  function getSubtitleMimeType(fileName: string) {
    return subtitleStateRuntime.getSubtitleMimeType(fileName);
  }

  function isSubtitleFileName(runtime: any, fileName: string) {
    return subtitleStateRuntime.isSubtitleFileName(runtime, fileName);
  }

  function normalizeSubtitleEntryRecord(rawValue: unknown, index: number) {
    return subtitleStateRuntime.normalizeSubtitleEntryRecord(rawValue, index);
  }

  function normalizeSubtitleOutputRecord(rawValue: unknown, index: number) {
    return subtitleStateRuntime.normalizeSubtitleOutputRecord(rawValue, index);
  }

  function normalizeSubtitleDiscoveryItem(rawValue: unknown, index: number) {
    return subtitleStateRuntime.normalizeSubtitleDiscoveryItem(rawValue, index);
  }

  function getSubtitleEntries(project: any) {
    return subtitleStateRuntime.getSubtitleEntries(project);
  }

  function getSubtitleEntryById(project: any, entryId: string) {
    return subtitleStateRuntime.getSubtitleEntryById(project, entryId);
  }

  function getActiveSubtitleEntry(project: any) {
    return subtitleStateRuntime.getActiveSubtitleEntry(project);
  }

  function getSubtitleSelectedEntries(project: any) {
    return subtitleStateRuntime.getSubtitleSelectedEntries(project);
  }

  function createSubtitleEntryRecord(filePath: string, options: any) {
    return subtitleStateRuntime.createSubtitleEntryRecord(filePath, options);
  }

  function resetSubtitleFeatureState(runtime: any, project: any, reason: string) {
    return subtitleStateRuntime.resetSubtitleFeatureState(runtime, project, reason);
  }

  function resetSubtitleDiscovery(runtime: any, project: any) {
    return subtitleStateRuntime.resetSubtitleDiscovery(runtime, project);
  }

  function upsertSubtitleEntries(runtime: any, project: any, incomingEntries: any[], options: any) {
    return subtitleStateRuntime.upsertSubtitleEntries(runtime, project, incomingEntries, options);
  }

  return {
    createEmptySubtitleAnalysisState,
    createEmptySubtitleDiscoveryState,
    createSubtitleEntryRecord,
    getActiveSubtitleEntry,
    getDefaultSubtitleEditPresetId,
    getDefaultSubtitleEditRecipe,
    getSubtitleEntries,
    getSubtitleEntryById,
    getSubtitleMimeType,
    getSubtitleSelectedEntries,
    isSubtitleFileName,
    normalizeSubtitleAnalysisState,
    normalizeSubtitleDiscoveryItem,
    normalizeSubtitleEntryRecord,
    normalizeSubtitleOutputRecord,
    resetSubtitleDiscovery,
    resetSubtitleFeatureState,
    upsertSubtitleEntries,
  };
}
