export function createLaboratoryRuntimeBootstrap(deps) {
  const defaultFeatureId = deps.defaultFeatureId;
  const normalizeLocale = deps.normalizeLocale;
  const roomId = deps.roomId;
  const toRecord = deps.toRecord;

  function normalizeUiScale(value) {
    const numeric =
      typeof value === "number"
        ? value
        : typeof value === "string"
          ? Number.parseInt(value, 10)
          : Number.NaN;
    if (!Number.isFinite(numeric) || numeric <= 0) {
      return 100;
    }
    return Math.max(70, Math.min(130, Math.round(numeric)));
  }

  function sanitizeContext(payload, api) {
    const source = toRecord(payload);
    const room = toRecord(source.room);
    const user = toRecord(source.user);
    const presentation = toRecord(source.presentation);
    const translations = toRecord(source.translations);
    const slots = toRecord(source.slots);
    const activeFeature = toRecord(source.activeFeature);

    return {
      room: {
        id: roomId,
        name:
          typeof room.name === "string" && room.name.trim() !== "" ? room.name.trim() : "Laboratory",
      },
      user: {
        nickname:
          typeof user.nickname === "string" && user.nickname.trim() !== ""
            ? user.nickname.trim()
            : "Operator",
      },
      presentation: {
        mode: presentation.mode === "scene-view" ? "scene-view" : "classic",
        uiScale: normalizeUiScale(presentation.uiScale),
      },
      locale:
        typeof source.locale === "string" && source.locale.trim() !== ""
          ? normalizeLocale(source.locale)
          : normalizeLocale(api.getLocale()),
      translations,
      slots,
      roomId:
        typeof source.roomId === "string" && source.roomId.trim() !== ""
          ? source.roomId.trim()
          : roomId,
      featureId:
        (typeof activeFeature.id === "string" && activeFeature.id.trim() !== ""
          ? activeFeature.id.trim()
          : null) ||
        (typeof source.featureId === "string" && source.featureId.trim() !== ""
          ? source.featureId.trim()
          : null) ||
        (typeof source.feature === "string" && source.feature.trim() !== ""
          ? source.feature.trim()
          : null) ||
        defaultFeatureId,
    };
  }

  function loadContext(api) {
    return sanitizeContext(api.getState("context"), api);
  }

  function saveContext(api, payload) {
    const nextContext = sanitizeContext(payload, api);
    api.setState("context", nextContext);
    return nextContext;
  }

  function getFeatureIdFromContext(context) {
    const featureId =
      typeof toRecord(context).featureId === "string" && toRecord(context).featureId.trim() !== ""
        ? toRecord(context).featureId.trim()
        : null;
    return featureId || defaultFeatureId;
  }

  function createDefaultToolEntry(toolId) {
    return {
      toolId: toolId,
      installed: false,
      version: null,
      binaryPath: null,
      releaseTag: null,
      releaseName: null,
      installDir: null,
      companionPaths: {},
      latestVersion: null,
      latestReleaseTag: null,
      latestReleaseName: null,
      releaseUrl: null,
      updateAvailable: false,
      busy: false,
      lastCheckedAt: null,
      lastError: null,
    };
  }

  function createDefaultToolState(toolIds) {
    const ids = Array.isArray(toolIds) ? toolIds : [];
    const tools = {};
    ids.forEach(function (toolId) {
      tools[toolId] = createDefaultToolEntry(toolId);
    });

    return {
      schemaVersion: 1,
      updatedAt: null,
      tools: tools,
    };
  }

  function createDefaultProfileModelEntry(modelId) {
    return {
      modelId: modelId,
      installed: false,
      fileName: null,
      path: null,
      sizeBytes: null,
      checksumSha1: null,
      checksumValid: false,
      expectedBytes: null,
      expectedSha1: null,
      busy: false,
      lastVerifiedAt: null,
      lastError: null,
    };
  }

  function getToolManifestMap(runtime) {
    return toRecord(toRecord(runtime.toolchainManifest).tools);
  }

  function getRuntimeToolIds(runtime) {
    return Object.keys(getToolManifestMap(runtime));
  }

  function getToolManifest(runtime, toolId) {
    return toRecord(getToolManifestMap(runtime)[toolId]);
  }

  function getStageSupport(toolManifest, stageId) {
    const value = toRecord(toolManifest).stageSupport?.[stageId];
    return typeof value === "string" && value.trim() !== "" ? value.trim() : "unsupported";
  }

  function createRuntimeState() {
    return {
      hydrated: false,
      hydrating: null,
      paths: null,
      packageToolsDir: null,
      toolchainManifest: null,
      sourcePresets: null,
      projectSchema: null,
      ytDlpForm: null,
      editPresets: null,
      editCapabilities: null,
      profilePresets: null,
      profileCapabilities: null,
      profileModels: null,
      subtitleSourcePresets: null,
      subtitleYoutubeForm: null,
      subtitleEditPresets: null,
      subtitleAnalysisCatalog: null,
      subtitleAnalysisCapabilities: null,
      subtitleAnalysisProviders: null,
      audioAnalysisCatalog: null,
      audioAnalysisCapabilities: null,
      audioAnalysisPresets: null,
      audioAnalysisProviders: null,
      projects: [],
      activeProjectId: null,
      toolState: createDefaultToolState([]),
      profileModelState: {
        schemaVersion: 1,
        updatedAt: null,
        models: {},
      },
      jobs: {},
      roomToolsSubscribed: false,
      roomToolsProgressHandler: null,
    };
  }

  return {
    createDefaultProfileModelEntry,
    createDefaultToolEntry,
    createDefaultToolState,
    createRuntimeState,
    getFeatureIdFromContext,
    getRuntimeToolIds,
    getStageSupport,
    getToolManifest,
    loadContext,
    sanitizeContext,
    saveContext,
  };
}
