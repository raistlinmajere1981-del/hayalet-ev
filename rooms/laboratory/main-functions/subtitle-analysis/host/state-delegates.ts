import type { createSubtitleStateRuntime } from "./state.js";

type LaboratoryRecord = Record<string, unknown>;
type LaboratorySubtitleEntryRecord = LaboratoryRecord;
type LaboratorySubtitleAnalysisStateRecord = LaboratoryRecord;
type SubtitleStateRuntime = ReturnType<typeof createSubtitleStateRuntime>;

type SubtitleStateDelegatesRuntimeDeps = {
  subtitleStateRuntime: SubtitleStateRuntime;
};

export function createSubtitleStateDelegatesRuntime(deps: SubtitleStateDelegatesRuntimeDeps) {
  const { subtitleStateRuntime } = deps;

  function getDefaultSubtitleEditPresetId(runtime: LaboratoryRecord): string {
    return String(subtitleStateRuntime.getDefaultSubtitleEditPresetId(runtime) || "");
  }

  function getDefaultSubtitleEditRecipe(
    runtime: LaboratoryRecord,
    presetId: string
  ): LaboratoryRecord {
    return subtitleStateRuntime.getDefaultSubtitleEditRecipe(runtime, presetId);
  }

  function createEmptySubtitleDiscoveryState() {
    return subtitleStateRuntime.createEmptySubtitleDiscoveryState();
  }

  function createEmptySubtitleAnalysisState(runtime: LaboratoryRecord) {
    return subtitleStateRuntime.createEmptySubtitleAnalysisState(runtime);
  }

  function normalizeSubtitleAnalysisState(
    rawValue: unknown,
    runtime: LaboratoryRecord
  ): LaboratorySubtitleAnalysisStateRecord {
    return subtitleStateRuntime.normalizeSubtitleAnalysisState(rawValue, runtime);
  }

  function getSubtitleMimeType(fileName: string) {
    return subtitleStateRuntime.getSubtitleMimeType(fileName);
  }

  function isSubtitleFileName(runtime: LaboratoryRecord, fileName: string) {
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

  function getSubtitleEntries(project: LaboratoryRecord): LaboratorySubtitleEntryRecord[] {
    return subtitleStateRuntime.getSubtitleEntries(project);
  }

  function getSubtitleEntryById(project: LaboratoryRecord, entryId: string) {
    return subtitleStateRuntime.getSubtitleEntryById(project, entryId);
  }

  function getActiveSubtitleEntry(project: LaboratoryRecord) {
    return subtitleStateRuntime.getActiveSubtitleEntry(project);
  }

  function getSubtitleSelectedEntries(project: LaboratoryRecord) {
    return subtitleStateRuntime.getSubtitleSelectedEntries(project);
  }

  function createSubtitleEntryRecord(filePath: string, options: LaboratoryRecord) {
    return subtitleStateRuntime.createSubtitleEntryRecord(filePath, options);
  }

  function resetSubtitleFeatureState(
    runtime: LaboratoryRecord,
    project: LaboratoryRecord,
    reason: string
  ): void {
    subtitleStateRuntime.resetSubtitleFeatureState(runtime, project, reason);
  }

  function resetSubtitleDiscovery(runtime: LaboratoryRecord, project: LaboratoryRecord): void {
    subtitleStateRuntime.resetSubtitleDiscovery(runtime, project);
  }

  function upsertSubtitleEntries(
    runtime: LaboratoryRecord,
    project: LaboratoryRecord,
    incomingEntries: LaboratorySubtitleEntryRecord[],
    options: LaboratoryRecord
  ): void {
    subtitleStateRuntime.upsertSubtitleEntries(runtime, project, incomingEntries, options);
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
