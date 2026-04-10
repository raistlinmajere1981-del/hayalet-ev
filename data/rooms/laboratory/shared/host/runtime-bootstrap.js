export function createLaboratoryRuntimeBootstrap(deps) {
  const { defaultFeatureId, normalizeLocale, roomId, toRecord } = deps;
  function toContextRecord(value) {
    return toRecord(value);
  }
  function toRoomRecord(value) {
    return toRecord(value);
  }
  function toUserRecord(value) {
    return toRecord(value);
  }
  function toPresentationRecord(value) {
    return toRecord(value);
  }
  function toActiveFeatureRecord(value) {
    return toRecord(value);
  }
  function toToolManifestRecord(value) {
    return toRecord(value);
  }
  function asNonEmptyString(value) {
    return typeof value === "string" && value.trim() !== "" ? value.trim() : null;
  }
  function normalizeUiScale(value) {
    const numeric = typeof value === "number" ? value : typeof value === "string" ? Number.parseInt(value, 10) : Number.NaN;
    if (!Number.isFinite(numeric) || numeric <= 0) {
      return 100;
    }
    return Math.max(70, Math.min(130, Math.round(numeric)));
  }
  function sanitizeContext(payload, api) {
    const source = toContextRecord(payload);
    const room = toRoomRecord(source.room);
    const user = toUserRecord(source.user);
    const presentation = toPresentationRecord(source.presentation);
    const translations = toRecord(source.translations);
    const slots = toRecord(source.slots);
    const activeFeature = toActiveFeatureRecord(source.activeFeature);
    return {
      room: {
        id: roomId,
        name: asNonEmptyString(room.name) || "Laboratory"
      },
      user: {
        nickname: asNonEmptyString(user.nickname) || "Operator"
      },
      presentation: {
        mode: presentation.mode === "scene-view" ? "scene-view" : "classic",
        uiScale: normalizeUiScale(presentation.uiScale)
      },
      locale: normalizeLocale(asNonEmptyString(source.locale) || api.getLocale()),
      translations,
      slots,
      roomId: asNonEmptyString(source.roomId) || roomId,
      featureId: asNonEmptyString(activeFeature.id) || asNonEmptyString(source.featureId) || asNonEmptyString(source.feature) || defaultFeatureId
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
    const featureId = asNonEmptyString(toContextRecord(context).featureId);
    return featureId || defaultFeatureId;
  }
  function createDefaultToolEntry(toolId) {
    return {
      toolId,
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
      lastError: null
    };
  }
  function createDefaultToolState(toolIds) {
    const ids = Array.isArray(toolIds) ? toolIds : [];
    const tools = {};
    ids.forEach(function(toolId) {
      const id = asNonEmptyString(toolId);
      if (id !== null) {
        tools[id] = createDefaultToolEntry(id);
      }
    });
    return {
      schemaVersion: 1,
      updatedAt: null,
      tools
    };
  }
  function createDefaultProfileModelEntry(modelId) {
    return {
      modelId,
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
      lastError: null
    };
  }
  function getToolManifestMap(runtime) {
    const tools = toRecord(toRecord(runtime.toolchainManifest)["tools"]);
    return Object.fromEntries(
      Object.entries(tools).map(function([toolId, manifest]) {
        return [toolId, toToolManifestRecord(manifest)];
      })
    );
  }
  function getRuntimeToolIds(runtime) {
    return Object.keys(getToolManifestMap(runtime));
  }
  function getToolManifest(runtime, toolId) {
    return toToolManifestRecord(getToolManifestMap(runtime)[toolId]);
  }
  function getStageSupport(toolManifest, stageId) {
    const stageSupport = toRecord(toToolManifestRecord(toolManifest).stageSupport);
    return asNonEmptyString(stageSupport[stageId]) || "unsupported";
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
        models: {}
      },
      jobs: {},
      roomToolsSubscribed: false,
      roomToolsProgressHandler: null
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
    saveContext
  };
}
