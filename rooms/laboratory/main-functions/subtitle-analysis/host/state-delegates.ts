// @ts-nocheck
export function createSubtitleStateDelegatesRuntime(deps) {
  const { subtitleStateRuntime } = deps;

  function getDefaultSubtitleEditPresetId(runtime) {
    return subtitleStateRuntime.getDefaultSubtitleEditPresetId(runtime);
  }

  function getDefaultSubtitleEditRecipe(runtime, presetId) {
    return subtitleStateRuntime.getDefaultSubtitleEditRecipe(runtime, presetId);
  }

  function createEmptySubtitleDiscoveryState() {
    return subtitleStateRuntime.createEmptySubtitleDiscoveryState();
  }

  function createEmptySubtitleAnalysisState(runtime) {
    return subtitleStateRuntime.createEmptySubtitleAnalysisState(runtime);
  }

  function normalizeSubtitleAnalysisState(rawValue, runtime) {
    return subtitleStateRuntime.normalizeSubtitleAnalysisState(rawValue, runtime);
  }

  function getSubtitleMimeType(fileName) {
    return subtitleStateRuntime.getSubtitleMimeType(fileName);
  }

  function isSubtitleFileName(runtime, fileName) {
    return subtitleStateRuntime.isSubtitleFileName(runtime, fileName);
  }

  function normalizeSubtitleEntryRecord(rawValue, index) {
    return subtitleStateRuntime.normalizeSubtitleEntryRecord(rawValue, index);
  }

  function normalizeSubtitleOutputRecord(rawValue, index) {
    return subtitleStateRuntime.normalizeSubtitleOutputRecord(rawValue, index);
  }

  function normalizeSubtitleDiscoveryItem(rawValue, index) {
    return subtitleStateRuntime.normalizeSubtitleDiscoveryItem(rawValue, index);
  }

  function getSubtitleEntries(project) {
    return subtitleStateRuntime.getSubtitleEntries(project);
  }

  function getSubtitleEntryById(project, entryId) {
    return subtitleStateRuntime.getSubtitleEntryById(project, entryId);
  }

  function getActiveSubtitleEntry(project) {
    return subtitleStateRuntime.getActiveSubtitleEntry(project);
  }

  function getSubtitleSelectedEntries(project) {
    return subtitleStateRuntime.getSubtitleSelectedEntries(project);
  }

  function createSubtitleEntryRecord(filePath, options) {
    return subtitleStateRuntime.createSubtitleEntryRecord(filePath, options);
  }

  function resetSubtitleFeatureState(runtime, project, reason) {
    return subtitleStateRuntime.resetSubtitleFeatureState(runtime, project, reason);
  }

  function resetSubtitleDiscovery(runtime, project) {
    return subtitleStateRuntime.resetSubtitleDiscovery(runtime, project);
  }

  function upsertSubtitleEntries(runtime, project, incomingEntries, options) {
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
