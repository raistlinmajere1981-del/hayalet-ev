// @ts-nocheck
import { createSubtitleStateDefaultsRuntime } from "./state-defaults.js";
import { createSubtitleStateNormalizationRuntime } from "./state-normalization.js";

export function createSubtitleStateProjectRuntime(deps) {
  const {
    asNonEmptyString,
    asNumber,
    markFeatureProcessStale,
    markFeatureReportStale,
    subtitleFeatureId,
    toRecord,
  } = deps;
  const defaultsRuntime = createSubtitleStateDefaultsRuntime(deps);
  const normalizationRuntime = createSubtitleStateNormalizationRuntime(deps);

  function getSubtitleEntries(project) {
    const entries = toRecord(toRecord(project).subtitleAnalysis).entries;
    return Array.isArray(entries)
      ? entries.map(function (entry, index) {
          return normalizationRuntime.normalizeSubtitleEntryRecord(entry, index);
        })
      : [];
  }

  function getSubtitleEntryById(project, entryId) {
    const requestedId = asNonEmptyString(entryId);
    return (
      getSubtitleEntries(project).find(function (entry) {
        return requestedId !== null && entry.id === requestedId;
      }) || null
    );
  }

  function getActiveSubtitleEntry(project) {
    const subtitleState = normalizationRuntime.normalizeSubtitleAnalysisState(
      toRecord(project).subtitleAnalysis,
      {}
    );
    return getSubtitleEntryById(project, subtitleState.activeEntryId) || (getSubtitleEntries(project)[0] || null);
  }

  function getSubtitleSelectedEntries(project) {
    const subtitleState = normalizationRuntime.normalizeSubtitleAnalysisState(
      toRecord(project).subtitleAnalysis,
      {}
    );
    const selectedIds = deps.normalizeStringArray(
      toRecord(toRecord(subtitleState.workspace).selection).selectedEntryIds
    );
    const entries = getSubtitleEntries(project);

    if (selectedIds.length > 0) {
      const selectedEntries = entries.filter(function (entry) {
        return selectedIds.includes(entry.id);
      });
      if (selectedEntries.length > 0) {
        return selectedEntries;
      }
    }

    const activeEntry = getActiveSubtitleEntry(project);
    return activeEntry ? [activeEntry] : [];
  }

  function createSubtitleEntryRecord(filePath, options) {
    const config = toRecord(options);
    const fileName =
      asNonEmptyString(config.fileName) ||
      (asNonEmptyString(filePath) ? String(filePath).split(/[\\/]/).pop() : null) ||
      `subtitle-${Date.now()}.srt`;

    return normalizationRuntime.normalizeSubtitleEntryRecord(
      {
        id: `subtitle-entry-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
        sourceType: asNonEmptyString(config.sourceType) || "local-file",
        status: "ready",
        fileName: fileName,
        path: asNonEmptyString(filePath),
        format:
          asNonEmptyString(config.format) || normalizationRuntime.getSubtitleFileExtension(fileName) || "srt",
        createdAt: new Date().toISOString(),
        sourceUrl: asNonEmptyString(config.sourceUrl),
        language:
          asNonEmptyString(config.language) ||
          normalizationRuntime.inferSubtitleLanguageFromFileName(fileName),
        publishedAt: asNonEmptyString(config.publishedAt),
        durationSeconds: asNumber(config.durationSeconds),
        isShort: typeof config.isShort === "boolean" ? config.isShort : null,
        warnings: Array.isArray(config.warnings) ? config.warnings.map(String) : [],
        metadata: {
          ...toRecord(config.metadata),
          mimeType:
            asNonEmptyString(toRecord(config.metadata).mimeType) ||
            normalizationRuntime.getSubtitleMimeType(fileName),
        },
      },
      0
    );
  }

  function resetSubtitleFeatureState(runtime, project, reason) {
    const subtitleState = normalizationRuntime.normalizeSubtitleAnalysisState(
      toRecord(project).subtitleAnalysis,
      runtime
    );
    const nextPresetId =
      asNonEmptyString(toRecord(subtitleState.edit).presetId) ||
      defaultsRuntime.getDefaultSubtitleEditPresetId(runtime);

    subtitleState.edit = {
      presetId: nextPresetId,
      recipe: defaultsRuntime.getDefaultSubtitleEditRecipe(runtime, nextPresetId),
      preview: {
        status: "idle",
        entryId: null,
        outputText: "",
        warnings: [],
        summary: null,
      },
      outputs: [],
      lastError: null,
      lastActionAt: new Date().toISOString(),
    };
    subtitleState.analysis = {
      ...subtitleState.analysis,
      status: "idle",
      summaryCards: [],
      findings: [],
      warnings: [],
      moduleResults: {},
      lastRunAt: null,
    };
    subtitleState.export = {
      lastGeneratedAt: null,
      items: [],
    };
    project.subtitleAnalysis = subtitleState;
    markFeatureProcessStale(project, subtitleFeatureId, reason);
    markFeatureReportStale(project, subtitleFeatureId, reason);
    return project.subtitleAnalysis;
  }

  function resetSubtitleDiscovery(runtime, project) {
    const subtitleState = normalizationRuntime.normalizeSubtitleAnalysisState(
      toRecord(project).subtitleAnalysis,
      runtime
    );
    subtitleState.discovery = defaultsRuntime.createEmptySubtitleDiscoveryState();
    project.subtitleAnalysis = subtitleState;
    return project.subtitleAnalysis;
  }

  function upsertSubtitleEntries(runtime, project, incomingEntries, options) {
    const config = toRecord(options);
    const subtitleState = normalizationRuntime.normalizeSubtitleAnalysisState(
      toRecord(project).subtitleAnalysis,
      runtime
    );
    const existingEntries = Array.isArray(subtitleState.entries)
      ? subtitleState.entries.map(function (entry, index) {
          return normalizationRuntime.normalizeSubtitleEntryRecord(entry, index);
        })
      : [];
    const existingByPath = existingEntries.reduce(function (accumulator, entry) {
      if (entry.path !== null) {
        accumulator[entry.path] = entry;
      }
      return accumulator;
    }, {});
    const normalizedIncoming = Array.isArray(incomingEntries)
      ? incomingEntries
          .map(function (entry, index) {
            return normalizationRuntime.normalizeSubtitleEntryRecord(entry, index);
          })
          .filter(function (entry) {
            return entry.path !== null;
          })
      : [];
    const mergedEntries =
      config.replaceExisting === true
        ? []
        : existingEntries.filter(function (entry) {
            return (
              normalizedIncoming.some(function (incomingEntry) {
                return incomingEntry.path === entry.path;
              }) === false
            );
          });

    normalizedIncoming.forEach(function (entry) {
      const existingEntry = entry.path !== null ? existingByPath[entry.path] : null;
      mergedEntries.push(
        normalizationRuntime.normalizeSubtitleEntryRecord(
          {
            ...toRecord(existingEntry),
            ...entry,
            id: existingEntry && existingEntry.id ? existingEntry.id : entry.id,
          },
          mergedEntries.length
        )
      );
    });

    subtitleState.entries = mergedEntries;
    subtitleState.activeEntryId =
      asNonEmptyString(config.activeEntryId) ||
      (normalizedIncoming[0] ? normalizedIncoming[0].id : subtitleState.activeEntryId) ||
      (mergedEntries[0] ? mergedEntries[0].id : null);
    subtitleState.workspace.mode = asNonEmptyString(config.mode) || subtitleState.workspace.mode;
    subtitleState.workspace.selection = {
      selectedEntryIds:
        Array.isArray(config.selectedEntryIds) && config.selectedEntryIds.length > 0
          ? deps.normalizeStringArray(config.selectedEntryIds)
          : normalizedIncoming.map(function (entry) {
              return entry.id;
            }),
    };
    subtitleState.workspace.lastError = null;
    subtitleState.workspace.lastActionAt = new Date().toISOString();
    subtitleState.workspace.lastImportAt = new Date().toISOString();
    project.subtitleAnalysis = subtitleState;
    resetSubtitleFeatureState(runtime, project, "Subtitle sources changed; rerun the subtitle analysis.");
    return project.subtitleAnalysis;
  }

  return {
    createSubtitleEntryRecord,
    getActiveSubtitleEntry,
    getSubtitleEntries,
    getSubtitleEntryById,
    getSubtitleSelectedEntries,
    resetSubtitleDiscovery,
    resetSubtitleFeatureState,
    upsertSubtitleEntries,
  };
}
