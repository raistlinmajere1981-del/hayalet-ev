export function createLaboratoryProjectRecordsRuntime(deps) {
  const {
    asNonEmptyString,
    buildProjectName,
    buildProjectSlug,
    createDefaultEditState,
    createDefaultProfileState,
    createEmptyAudioAnalysisState,
    createEmptyProcessState,
    createEmptyReportState,
    createEmptySubtitleAnalysisState,
    createEmptySourceDrafts,
    getDefaultMode,
    getDefaultSourceType,
    getDefaultYoutubePreset,
    getPreferredFeatureSourceKind,
    getPresetDefaultCustomValues,
    normalizeEditState,
    normalizeAudioAnalysisState,
    normalizeProfileState,
    normalizeProcessState,
    normalizeReportState,
    normalizeSourceMetadata,
    normalizeSubtitleAnalysisState,
    projectSchemaVersion,
    toRecord,
  } = deps;

  function createProjectRecord(
    sourcePresets,
    editPresets,
    profilePresets,
    profileModels,
    profileCapabilities,
    subtitleRuntime,
    featureId
  ) {
    const now = new Date().toISOString();
    const kind = getPreferredFeatureSourceKind(featureId, sourcePresets);
    const mode = getDefaultMode(sourcePresets, kind);
    const slug = buildProjectSlug(now);

    return {
      schemaVersion: projectSchemaVersion,
      id: slug,
      slug: slug,
      name: buildProjectName(now),
      createdAt: now,
      updatedAt: now,
      source: {
        kind: kind,
        mode: mode,
        status: "idle",
        storedPath: null,
        storedFileName: null,
        sourceUrl: null,
        mimeType: null,
        routeLabel: null,
        lastError: null,
        metadata: null,
        metadataError: null,
        drafts: createEmptySourceDrafts(sourcePresets),
      },
      edit: createDefaultEditState(editPresets, kind),
      profile: createDefaultProfileState(profilePresets, profileModels, profileCapabilities, kind),
      audioAnalysis: createEmptyAudioAnalysisState(),
      subtitleAnalysis: createEmptySubtitleAnalysisState(subtitleRuntime || {}),
      process: createEmptyProcessState(),
      report: createEmptyReportState(),
    };
  }

  function normalizeProject(
    rawValue,
    sourcePresets,
    editPresets,
    profilePresets,
    profileModels,
    profileCapabilities,
    runtime
  ) {
    const source = toRecord(toRecord(rawValue).source);
    const kind = asNonEmptyString(source.kind) || getDefaultSourceType(sourcePresets);
    const mode = asNonEmptyString(source.mode) || getDefaultMode(sourcePresets, kind);
    const drafts = toRecord(source.drafts);
    const defaultPreset = getDefaultYoutubePreset(sourcePresets);
    const youtubePreset = asNonEmptyString(drafts.youtubePreset) || defaultPreset;
    const currentTimestamp = new Date().toISOString();

    return {
      schemaVersion:
        typeof toRecord(rawValue).schemaVersion === "number"
          ? toRecord(rawValue).schemaVersion
          : projectSchemaVersion,
      id:
        asNonEmptyString(toRecord(rawValue).id) ||
        asNonEmptyString(toRecord(rawValue).slug) ||
        buildProjectSlug(currentTimestamp),
      slug:
        asNonEmptyString(toRecord(rawValue).slug) ||
        asNonEmptyString(toRecord(rawValue).id) ||
        buildProjectSlug(currentTimestamp),
      name: asNonEmptyString(toRecord(rawValue).name) || buildProjectName(currentTimestamp),
      createdAt: asNonEmptyString(toRecord(rawValue).createdAt) || currentTimestamp,
      updatedAt: asNonEmptyString(toRecord(rawValue).updatedAt) || currentTimestamp,
      source: {
        kind: kind,
        mode: mode,
        status: asNonEmptyString(source.status) || "idle",
        storedPath: asNonEmptyString(source.storedPath),
        storedFileName: asNonEmptyString(source.storedFileName),
        sourceUrl: asNonEmptyString(source.sourceUrl),
        mimeType: asNonEmptyString(source.mimeType),
        routeLabel: asNonEmptyString(source.routeLabel),
        lastError: asNonEmptyString(source.lastError),
        metadata: normalizeSourceMetadata(source.metadata),
        metadataError: asNonEmptyString(source.metadataError),
        drafts: {
          urlInput: asNonEmptyString(drafts.urlInput) || "",
          youtubeUrl: asNonEmptyString(drafts.youtubeUrl) || "",
          fileNameHint: asNonEmptyString(drafts.fileNameHint) || "",
          youtubePreset: youtubePreset,
          youtubeCustom: {
            ...getPresetDefaultCustomValues(sourcePresets, youtubePreset),
            ...toRecord(drafts.youtubeCustom),
          },
        },
      },
      edit: normalizeEditState(toRecord(rawValue).edit, editPresets, kind),
      profile: normalizeProfileState(
        toRecord(rawValue).profile,
        profilePresets,
        profileModels,
        profileCapabilities,
        kind
      ),
      audioAnalysis: normalizeAudioAnalysisState(toRecord(rawValue).audioAnalysis, runtime || {}),
      subtitleAnalysis: normalizeSubtitleAnalysisState(
        toRecord(rawValue).subtitleAnalysis,
        runtime || {}
      ),
      process: normalizeProcessState(toRecord(rawValue).process),
      report: normalizeReportState(toRecord(rawValue).report),
    };
  }

  function updateProjectTimestamps(project) {
    project.updatedAt = new Date().toISOString();
    return project;
  }

  function findProject(runtime, projectId) {
    return runtime.projects.find(function (project) {
      return project.id === projectId;
    });
  }

  function getActiveProject(runtime) {
    return findProject(runtime, runtime.activeProjectId) || null;
  }

  return {
    createProjectRecord,
    findProject,
    getActiveProject,
    normalizeProject,
    updateProjectTimestamps,
  };
}
