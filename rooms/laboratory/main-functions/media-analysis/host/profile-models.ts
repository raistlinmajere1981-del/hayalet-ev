type LaboratoryRecord = Record<string, unknown>;

type LaboratoryMediaProfileRuntime = LaboratoryRecord & {
  profileModelState?: unknown;
  toolState?: unknown;
};

type LaboratoryProjectRecord = LaboratoryRecord & {
  id?: unknown;
  profile?: unknown;
  source?: unknown;
};

type LaboratoryProjectSourceRecord = LaboratoryRecord & {
  kind?: unknown;
};

type LaboratoryToolDetailsRecord = LaboratoryRecord & {
  platformKey?: unknown;
  platformSupported?: unknown;
  supportError?: unknown;
};

type LaboratoryToolRecord = LaboratoryRecord & {
  binaryPath?: unknown;
  busy?: unknown;
  details?: unknown;
  installed?: unknown;
  lastError?: unknown;
  version?: unknown;
};

type LaboratoryProfileModelStateRecord = LaboratoryRecord & {
  activeLanguage?: unknown;
  activeModelId?: unknown;
  activeVariant?: unknown;
  models?: unknown;
  updatedAt?: unknown;
};

type LaboratoryProfileModelEntryRecord = LaboratoryRecord & {
  busy?: unknown;
  checksumSha1?: unknown;
  checksumValid?: unknown;
  expectedBytes?: unknown;
  expectedSha1?: unknown;
  fileName?: unknown;
  installed?: unknown;
  lastError?: unknown;
  lastVerifiedAt?: unknown;
  path?: unknown;
  sizeBytes?: unknown;
};

type LaboratoryProfileModelDescriptorRecord = LaboratoryRecord & {
  cleanupPolicy?: unknown;
  downloadUrl?: unknown;
  expectedBytes?: unknown;
  expectedSha1?: unknown;
  fileName?: unknown;
  labelKey?: unknown;
  language?: unknown;
  mediaKinds?: unknown;
  quantization?: unknown;
  runtimeCompatibility?: unknown;
  summaryKey?: unknown;
};

type LaboratoryRuntimeCompatibilityRecord = LaboratoryRecord & {
  platforms?: unknown;
  requiresBinarySupport?: unknown;
};

type LaboratorySharedTranscriptModelStatusRecord = LaboratoryRecord & {
  checksumValid?: unknown;
  expectedBytes?: unknown;
  expectedSha1?: unknown;
  fileName?: unknown;
  installed?: unknown;
  lastError?: unknown;
  modelId?: unknown;
  path?: unknown;
  ready?: unknown;
  sizeBytes?: unknown;
};

type LaboratoryProfileToolSummary = {
  binaryPath: string | null;
  busy: boolean;
  displayName: string;
  installed: boolean;
  lastError: string | null;
  platformSupported: boolean;
  ready: boolean;
  supportLevel: string;
  toolId: string;
  version: string | null;
};

type LaboratoryProfileModelCompatibility = {
  cleanupPolicy: LaboratoryRecord;
  compatibilityReason: string | null;
  runtimeCompatible: boolean;
  runtimePlatformKey: string | null;
  supportedPlatforms: string[];
};

type LaboratoryProfileModelSummary = {
  binaryReady: boolean;
  binarySupported: boolean;
  busy: boolean;
  checksumSha1: string | null;
  checksumValid: boolean;
  cleanupPolicy: LaboratoryRecord;
  compatibilityReason: string | null;
  expectedBytes: number | null;
  expectedSha1: string | null;
  fileName: string | null;
  installed: boolean;
  labelKey: string | null;
  language: string;
  lastError: string | null;
  lastVerifiedAt: string | null;
  modelId: string;
  path: string | null;
  quantization: string;
  ready: boolean;
  runtimeCompatible: boolean;
  runtimePlatformKey: string | null;
  selected: boolean;
  sizeBytes: number | null;
  summaryKey: string | null;
  supportedPlatforms: string[];
};

type MediaProfileModelRuntimeDeps = {
  asNonEmptyString: (value: unknown) => string | null;
  asNumber: (value: unknown) => number | null;
  createDefaultProfileModelEntry: (modelId: string) => LaboratoryRecord;
  getProfileModelDescriptor: (runtime: LaboratoryMediaProfileRuntime, modelId: string) => unknown;
  getProfileModelDescriptorMap: (runtime: LaboratoryMediaProfileRuntime) => LaboratoryRecord;
  getStageSupport: (manifest: unknown, stageId: string) => string;
  getToolManifest: (runtime: LaboratoryMediaProfileRuntime, toolId: string) => unknown;
  listSharedTranscriptModels: () => Promise<unknown[]>;
  persistProfileModelState: (runtime: LaboratoryMediaProfileRuntime) => Promise<unknown>;
  readSharedTranscriptStatus: () => Promise<unknown>;
  toRecord: (value: unknown) => LaboratoryRecord;
  updateProfileModelEntry: (
    runtime: LaboratoryMediaProfileRuntime,
    modelId: string,
    patch: LaboratoryRecord
  ) => LaboratoryProfileModelEntryRecord;
};

export function createMediaProfileModelRuntime(deps: MediaProfileModelRuntimeDeps) {
  const {
    asNonEmptyString,
    asNumber,
    createDefaultProfileModelEntry,
    getProfileModelDescriptor,
    getProfileModelDescriptorMap,
    getStageSupport,
    getToolManifest,
    listSharedTranscriptModels,
    persistProfileModelState,
    readSharedTranscriptStatus,
    toRecord,
    updateProfileModelEntry,
  } = deps;

  function toProjectSourceRecord(value: unknown): LaboratoryProjectSourceRecord {
    return toRecord(value);
  }

  function toToolRecord(value: unknown): LaboratoryToolRecord {
    return toRecord(value);
  }

  function toToolDetailsRecord(value: unknown): LaboratoryToolDetailsRecord {
    return toRecord(value);
  }

  function toProfileModelStateRecord(value: unknown): LaboratoryProfileModelStateRecord {
    return toRecord(value);
  }

  function toProfileModelEntryRecord(value: unknown): LaboratoryProfileModelEntryRecord {
    return toRecord(value);
  }

  function toProfileModelDescriptorRecord(value: unknown): LaboratoryProfileModelDescriptorRecord {
    return toRecord(value);
  }

  function toRuntimeCompatibilityRecord(value: unknown): LaboratoryRuntimeCompatibilityRecord {
    return toRecord(value);
  }

  function toSharedTranscriptModelStatusRecord(
    value: unknown
  ): LaboratorySharedTranscriptModelStatusRecord {
    return toRecord(value);
  }

  function getToolMap(
    runtime: LaboratoryMediaProfileRuntime
  ): Record<string, LaboratoryToolRecord> {
    return toRecord(toRecord(runtime.toolState)["tools"]) as Record<string, LaboratoryToolRecord>;
  }

  function getToolRecord(
    runtime: LaboratoryMediaProfileRuntime,
    toolId: string
  ): LaboratoryToolRecord {
    return toToolRecord(getToolMap(runtime)[toolId]);
  }

  function getProfileModelStateMap(
    runtime: LaboratoryMediaProfileRuntime
  ): Record<string, LaboratoryProfileModelEntryRecord> {
    return toRecord(toProfileModelStateRecord(runtime.profileModelState).models) as Record<
      string,
      LaboratoryProfileModelEntryRecord
    >;
  }

  function getProfileModelDescriptorRecord(
    runtime: LaboratoryMediaProfileRuntime,
    modelId: string
  ): LaboratoryProfileModelDescriptorRecord {
    return toProfileModelDescriptorRecord(getProfileModelDescriptor(runtime, modelId));
  }

  function getSharedTranscriptModelMap(
    entries: unknown
  ): Record<string, LaboratorySharedTranscriptModelStatusRecord> {
    if (!Array.isArray(entries)) {
      return {};
    }

    return entries.reduce<Record<string, LaboratorySharedTranscriptModelStatusRecord>>(function (
      accumulator,
      entry
    ) {
      const model = toSharedTranscriptModelStatusRecord(entry);
      const modelId = asNonEmptyString(model.modelId);
      if (modelId !== null) {
        accumulator[modelId] = model;
      }
      return accumulator;
    }, {});
  }

  function toStringArray(value: unknown): string[] {
    if (!Array.isArray(value)) {
      return [];
    }
    return value
      .map(function (entry) {
        return asNonEmptyString(entry);
      })
      .filter((entry): entry is string => entry !== null);
  }

  function getCurrentRuntimePlatformKey(runtime: LaboratoryMediaProfileRuntime) {
    const preferredToolIds = ["whisper.cpp", "ffmpeg", "yt-dlp"];

    for (let index = 0; index < preferredToolIds.length; index += 1) {
      const toolId = preferredToolIds[index];
      if (!toolId) {
        continue;
      }
      const details = toToolDetailsRecord(getToolRecord(runtime, toolId).details);
      const platformKey = asNonEmptyString(details.platformKey);
      if (platformKey !== null) {
        return platformKey;
      }
    }

    return null;
  }

  function evaluateProfileModelCompatibility(
    runtime: LaboratoryMediaProfileRuntime,
    descriptor: LaboratoryProfileModelDescriptorRecord,
    whisperSummary: LaboratoryProfileToolSummary
  ): LaboratoryProfileModelCompatibility {
    const runtimeCompatibility = toRuntimeCompatibilityRecord(descriptor.runtimeCompatibility);
    const supportedPlatforms = toStringArray(runtimeCompatibility.platforms);
    const runtimePlatformKey = getCurrentRuntimePlatformKey(runtime);
    const requiresBinarySupport = runtimeCompatibility.requiresBinarySupport === true;
    let runtimeCompatible = true;
    let compatibilityReason: string | null = null;

    if (supportedPlatforms.length > 0) {
      if (runtimePlatformKey === null) {
        runtimeCompatible = false;
        compatibilityReason = "Runtime platform could not be resolved yet.";
      } else if (!supportedPlatforms.includes(runtimePlatformKey)) {
        runtimeCompatible = false;
        compatibilityReason = `This model is not declared for ${runtimePlatformKey}.`;
      }
    }

    if (runtimeCompatible && requiresBinarySupport && whisperSummary.platformSupported !== true) {
      runtimeCompatible = false;
      compatibilityReason = "Whisper.cpp is unavailable on this runtime platform.";
    }

    return {
      cleanupPolicy: toRecord(descriptor.cleanupPolicy),
      compatibilityReason,
      runtimeCompatible,
      runtimePlatformKey,
      supportedPlatforms,
    };
  }

  function buildProfileToolSummary(
    runtime: LaboratoryMediaProfileRuntime,
    toolId: string,
    supportLevel: string
  ): LaboratoryProfileToolSummary {
    const tool = getToolRecord(runtime, toolId);
    const manifest = getToolManifest(runtime, toolId);
    const details = toToolDetailsRecord(tool.details);
    const displayName = asNonEmptyString(toRecord(manifest)["displayName"]) || toolId;
    const platformSupported = details.platformSupported !== false;
    const installed = tool.installed === true;

    return {
      binaryPath: asNonEmptyString(tool.binaryPath),
      busy: tool.busy === true,
      displayName,
      installed,
      lastError:
        asNonEmptyString(tool.lastError) ||
        (platformSupported === false ? asNonEmptyString(details.supportError) : null),
      platformSupported,
      ready: supportLevel === "unsupported" ? false : platformSupported && installed,
      supportLevel: supportLevel || "unsupported",
      toolId,
      version: asNonEmptyString(tool.version),
    };
  }

  function buildProfileModelSummary(
    runtime: LaboratoryMediaProfileRuntime,
    project: LaboratoryProjectRecord
  ): LaboratoryProfileModelSummary[] {
    const source = toProjectSourceRecord(project.source);
    const sourceKind = asNonEmptyString(source.kind) || "video";
    const selectedModelId = asNonEmptyString(
      toProfileModelStateRecord(runtime.profileModelState).activeModelId
    );
    const whisperManifest = getToolManifest(runtime, "whisper.cpp");
    const whisperSupport = getStageSupport(whisperManifest, "profile");
    const whisperSummary = buildProfileToolSummary(runtime, "whisper.cpp", whisperSupport);
    const storedModels = getProfileModelStateMap(runtime);

    return Object.keys(getProfileModelDescriptorMap(runtime))
      .filter(function (modelId) {
        const descriptor = getProfileModelDescriptorRecord(runtime, modelId);
        const mediaKinds = toStringArray(descriptor.mediaKinds);
        return mediaKinds.length === 0 || mediaKinds.includes(sourceKind);
      })
      .map(function (modelId) {
        const descriptor = getProfileModelDescriptorRecord(runtime, modelId);
        const stored = toProfileModelEntryRecord(storedModels[modelId]);
        const expectedBytes = asNumber(descriptor.expectedBytes);
        const sizeBytes = asNumber(stored.sizeBytes);
        const checksumValid = stored.installed === true && stored.checksumValid === true;
        const compatibility = evaluateProfileModelCompatibility(
          runtime,
          descriptor,
          whisperSummary
        );

        return {
          binaryReady: whisperSummary.ready,
          binarySupported: whisperSummary.platformSupported,
          busy: stored.busy === true,
          checksumSha1: asNonEmptyString(stored.checksumSha1),
          checksumValid,
          cleanupPolicy: compatibility.cleanupPolicy,
          compatibilityReason: compatibility.compatibilityReason,
          expectedBytes,
          expectedSha1: asNonEmptyString(descriptor.expectedSha1),
          fileName: asNonEmptyString(descriptor.fileName),
          installed: stored.installed === true,
          labelKey: asNonEmptyString(descriptor.labelKey),
          language: asNonEmptyString(descriptor.language) || "en",
          lastError: asNonEmptyString(stored.lastError),
          lastVerifiedAt: asNonEmptyString(stored.lastVerifiedAt),
          modelId,
          path: asNonEmptyString(stored.path),
          quantization: asNonEmptyString(descriptor.quantization) || "f16",
          ready: whisperSummary.ready && checksumValid && compatibility.runtimeCompatible,
          runtimeCompatible: compatibility.runtimeCompatible,
          runtimePlatformKey: compatibility.runtimePlatformKey,
          selected: modelId === selectedModelId,
          sizeBytes,
          summaryKey: asNonEmptyString(descriptor.summaryKey),
          supportedPlatforms: compatibility.supportedPlatforms,
        };
      });
  }

  async function verifyProfileModel(runtime: LaboratoryMediaProfileRuntime, modelId: string) {
    const sharedModelMap = getSharedTranscriptModelMap(await listSharedTranscriptModels());
    const sharedModel = toSharedTranscriptModelStatusRecord(sharedModelMap[modelId]);
    const descriptor = getProfileModelDescriptorRecord(runtime, modelId);
    const fileName =
      asNonEmptyString(sharedModel.fileName) || asNonEmptyString(descriptor.fileName);
    const filePath = asNonEmptyString(sharedModel.path);
    const checksumValid = sharedModel.checksumValid === true;

    const nextEntry = updateProfileModelEntry(runtime, modelId, {
      checksumSha1: null,
      checksumValid,
      expectedBytes: asNumber(sharedModel.expectedBytes) ?? asNumber(descriptor.expectedBytes),
      expectedSha1:
        asNonEmptyString(sharedModel.expectedSha1) ?? asNonEmptyString(descriptor.expectedSha1),
      fileName,
      installed: sharedModel.installed === true,
      lastError:
        asNonEmptyString(sharedModel.lastError) ||
        (checksumValid ? null : "Downloaded model failed checksum verification."),
      lastVerifiedAt: new Date().toISOString(),
      path: filePath,
      sizeBytes: asNumber(sharedModel.sizeBytes),
    });

    await persistProfileModelState(runtime);
    if (nextEntry.installed !== true) {
      throw new Error(
        `Profile model ${modelId} is not installed on the shared transcript runtime.`
      );
    }
    if (checksumValid !== true) {
      throw new Error("Downloaded model failed checksum verification.");
    }

    return nextEntry;
  }

  async function installProfileModel(
    api: unknown,
    runtime: LaboratoryMediaProfileRuntime,
    requestId: string,
    modelId: string
  ) {
    void api;
    void runtime;
    void requestId;
    void modelId;
    throw new Error("Transcript model installs moved to Settings > User > Speech Runtime.");
  }

  async function removeProfileModel(
    runtime: LaboratoryMediaProfileRuntime,
    requestId: string,
    modelId: string
  ) {
    void runtime;
    void requestId;
    void modelId;
    throw new Error("Transcript model removal moved to Settings > User > Speech Runtime.");
  }

  async function refreshProfileModelStateWithStorage(runtime: LaboratoryMediaProfileRuntime) {
    const sharedStatusMap = getSharedTranscriptModelMap(await listSharedTranscriptModels());
    const sharedStatus = toRecord(await readSharedTranscriptStatus());
    const currentState = toProfileModelStateRecord(runtime.profileModelState);
    const storedModels = getProfileModelStateMap(runtime);
    const nextModels: Record<string, LaboratoryProfileModelEntryRecord> = {};

    Object.keys(getProfileModelDescriptorMap(runtime)).forEach(function (modelId) {
      const descriptor = getProfileModelDescriptorRecord(runtime, modelId);
      const current = toProfileModelEntryRecord(storedModels[modelId]);
      const sharedModel = toSharedTranscriptModelStatusRecord(sharedStatusMap[modelId]);
      const fileName =
        asNonEmptyString(sharedModel.fileName) || asNonEmptyString(descriptor.fileName);
      const installed = sharedModel.installed === true;
      const lastError = asNonEmptyString(sharedModel.lastError);

      nextModels[modelId] = {
        ...createDefaultProfileModelEntry(modelId),
        ...current,
        busy: false,
        checksumSha1: installed ? asNonEmptyString(current.checksumSha1) : null,
        checksumValid: installed && sharedModel.checksumValid === true,
        expectedBytes: asNumber(sharedModel.expectedBytes) ?? asNumber(descriptor.expectedBytes),
        expectedSha1:
          asNonEmptyString(sharedModel.expectedSha1) ?? asNonEmptyString(descriptor.expectedSha1),
        fileName,
        installed,
        lastError: installed ? lastError : null,
        lastVerifiedAt: installed ? asNonEmptyString(current.lastVerifiedAt) : null,
        modelId,
        path: installed ? asNonEmptyString(sharedModel.path) : null,
        sizeBytes: installed ? asNumber(sharedModel.sizeBytes) : null,
      };
    });

    runtime.profileModelState = {
      activeLanguage: asNonEmptyString(sharedStatus["activeLanguage"]),
      activeModelId: asNonEmptyString(sharedStatus["modelId"]),
      activeVariant: asNonEmptyString(sharedStatus["activeVariant"]),
      models: nextModels,
      schemaVersion: 1,
      updatedAt: currentState.updatedAt,
    };
    await persistProfileModelState(runtime);
  }

  return {
    buildProfileModelSummary,
    buildProfileToolSummary,
    evaluateProfileModelCompatibility,
    getCurrentRuntimePlatformKey,
    installProfileModel,
    refreshProfileModelStateWithStorage,
    removeProfileModel,
    verifyProfileModel,
  };
}
