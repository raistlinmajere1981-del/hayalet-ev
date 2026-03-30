export function createLaboratoryRuntimeBootstrap(deps: any) {
  const defaultFeatureId = deps.defaultFeatureId;
  const normalizeLocale = deps.normalizeLocale;
  const roomId = deps.roomId;
  const toRecord = deps.toRecord;

  function normalizeUiScale(value: any): number {
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

  function sanitizeContext(payload: any, api: any) {
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
          typeof room.name === "string" && room.name.trim() !== ""
            ? room.name.trim()
            : "Laboratory",
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

  function loadContext(api: any) {
    return sanitizeContext(api.getState("context"), api);
  }

  function saveContext(api: any, payload: any) {
    const nextContext = sanitizeContext(payload, api);
    api.setState("context", nextContext);
    return nextContext;
  }

  function getFeatureIdFromContext(context: any) {
    const featureId =
      typeof toRecord(context).featureId === "string" && toRecord(context).featureId.trim() !== ""
        ? toRecord(context).featureId.trim()
        : null;
    return featureId || defaultFeatureId;
  }

  function createDefaultToolEntry(toolId: string) {
    return {
      toolId: toolId,
      installed: false,
      version: null as string | null,
      binaryPath: null as string | null,
      releaseTag: null as string | null,
      releaseName: null as string | null,
      installDir: null as string | null,
      companionPaths: {},
      latestVersion: null as string | null,
      latestReleaseTag: null as string | null,
      latestReleaseName: null as string | null,
      releaseUrl: null as string | null,
      updateAvailable: false,
      busy: false,
      lastCheckedAt: null as number | null,
      lastError: null as string | null,
    };
  }

  function createDefaultToolState(toolIds: unknown) {
    const ids = Array.isArray(toolIds) ? toolIds : [];
    const tools: Record<string, ReturnType<typeof createDefaultToolEntry>> = {};
    ids.forEach(function (toolId: unknown) {
      const id = typeof toolId === "string" ? toolId : "";
      if (id !== "") {
        tools[id] = createDefaultToolEntry(id);
      }
    });

    return {
      schemaVersion: 1,
      updatedAt: null as number | null,
      tools: tools,
    };
  }

  function createDefaultProfileModelEntry(modelId: string) {
    return {
      modelId: modelId,
      installed: false,
      fileName: null as string | null,
      path: null as string | null,
      sizeBytes: null as number | null,
      checksumSha1: null as string | null,
      checksumValid: false,
      expectedBytes: null as number | null,
      expectedSha1: null as string | null,
      busy: false,
      lastVerifiedAt: null as number | null,
      lastError: null as string | null,
    };
  }

  function getToolManifestMap(runtime: any) {
    return toRecord(toRecord(runtime.toolchainManifest).tools);
  }

  function getRuntimeToolIds(runtime: any) {
    return Object.keys(getToolManifestMap(runtime));
  }

  function getToolManifest(runtime: any, toolId: string) {
    return toRecord(getToolManifestMap(runtime)[toolId]);
  }

  function getStageSupport(toolManifest: any, stageId: string) {
    const value = toRecord(toolManifest).stageSupport?.[stageId];
    return typeof value === "string" && value.trim() !== "" ? value.trim() : "unsupported";
  }

  function createRuntimeState() {
    return {
      hydrated: false,
      hydrating: null as unknown,
      paths: null as unknown,
      packageToolsDir: null as unknown,
      toolchainManifest: null as unknown,
      sourcePresets: null as unknown,
      projectSchema: null as unknown,
      ytDlpForm: null as unknown,
      editPresets: null as unknown,
      editCapabilities: null as unknown,
      profilePresets: null as unknown,
      profileCapabilities: null as unknown,
      profileModels: null as unknown,
      subtitleSourcePresets: null as unknown,
      subtitleYoutubeForm: null as unknown,
      subtitleEditPresets: null as unknown,
      subtitleAnalysisCatalog: null as unknown,
      subtitleAnalysisCapabilities: null as unknown,
      subtitleAnalysisProviders: null as unknown,
      audioAnalysisCatalog: null as unknown,
      audioAnalysisCapabilities: null as unknown,
      audioAnalysisPresets: null as unknown,
      audioAnalysisProviders: null as unknown,
      projects: [] as unknown[],
      activeProjectId: null as string | null,
      toolState: createDefaultToolState([]),
      profileModelState: {
        schemaVersion: 1,
        updatedAt: null as number | null,
        models: {} as Record<string, unknown>,
      },
      jobs: {} as Record<string, unknown>,
      roomToolsSubscribed: false,
      roomToolsProgressHandler: null as unknown,
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
