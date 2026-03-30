type LaboratoryRecord = Record<string, unknown>;

interface ProfileHelperRecord extends Record<string, unknown> {
  artifactPreferences?: unknown;
  audioCodec?: unknown;
  codec?: unknown;
  compatible?: unknown;
  displayName?: unknown;
  duration?: unknown;
  durationSeconds?: unknown;
  formatName?: unknown;
  frameDensityModes?: unknown;
  height?: unknown;
  id?: unknown;
  kind?: unknown;
  labelKey?: unknown;
  laneId?: unknown;
  laneSelection?: unknown;
  lanes?: unknown;
  level?: unknown;
  mediaKinds?: unknown;
  metadata?: unknown;
  optionalTools?: unknown;
  previewUrl?: unknown;
  ready?: unknown;
  removeOnChecksumMismatch?: unknown;
  removeOnDescriptorChange?: unknown;
  requiredTools?: unknown;
  sampling?: unknown;
  supportLevel?: unknown;
  title?: unknown;
  toolId?: unknown;
  transcriptSampleSeconds?: unknown;
  url?: unknown;
  videoCodec?: unknown;
  width?: unknown;
}

type ProfileArtifactPreferenceParams = {
  currentSourceKind: string;
  profileCapabilities: ProfileHelperRecord;
  projectProfile: ProfileHelperRecord;
  toRecord: (value: unknown) => ProfileHelperRecord;
};

type ProfileFrameDensityParams = {
  profileCapabilities: ProfileHelperRecord;
  toRecord: (value: unknown) => ProfileHelperRecord;
};

type ProfileTranscriptSampleParams = {
  profileCapabilities: ProfileHelperRecord;
  toRecord: (value: unknown) => ProfileHelperRecord;
};

type ProfileLaneCardParams = {
  currentSourceKind: string;
  getMediaKindLabel: (kind: string) => string;
  getToolDisplayName: (toolId: string) => string;
  getToolEntry: (toolId: string) => ProfileHelperRecord;
  laneId: string;
  profileLaneMap: ProfileHelperRecord;
  profileReadiness: ProfileHelperRecord;
  projectProfile: ProfileHelperRecord;
  text: (keys: string[]) => string;
  toRecord: (value: unknown) => ProfileHelperRecord;
};

export function getProfileArtifactPreferenceEntries(params: ProfileArtifactPreferenceParams) {
  const { currentSourceKind, profileCapabilities, projectProfile, toRecord } = params;
  const preferenceMap = toRecord(profileCapabilities.artifactPreferences);
  const selected = toRecord(projectProfile.artifactPreferences);

  return Object.keys(preferenceMap)
    .map(function (artifactId: string) {
      const descriptor = toRecord(preferenceMap[artifactId]);
      const mediaKinds = Array.isArray(descriptor.mediaKinds) ? descriptor.mediaKinds : [];
      const compatible = mediaKinds.length === 0 || mediaKinds.includes(currentSourceKind);
      return {
        artifactId: artifactId,
        labelKey: descriptor.labelKey,
        compatible: compatible,
        enabled: compatible && selected[artifactId] === true,
      };
    })
    .filter(function (entry: ProfileHelperRecord) {
      return entry.compatible === true;
    });
}

export function getProfileFrameDensityOptions(params: ProfileFrameDensityParams) {
  const { profileCapabilities, toRecord } = params;
  const densityModes = toRecord(toRecord(profileCapabilities.sampling).frameDensityModes);

  return Object.keys(densityModes).map(function (densityId: string) {
    return {
      densityId: densityId,
      labelKey: toRecord(densityModes[densityId]).labelKey,
    };
  });
}

export function getProfileTranscriptSampleConfig(params: ProfileTranscriptSampleParams) {
  const { profileCapabilities, toRecord } = params;
  return toRecord(toRecord(profileCapabilities.sampling).transcriptSampleSeconds);
}

export function sortProfileSignals(
  signals: unknown[],
  toRecord: (v: unknown) => ProfileHelperRecord
) {
  const levelOrder: Record<string, number> = { high: 0, medium: 1, low: 2 };
  const kindOrder: Record<string, number> = { measured: 0, heuristic: 1, derived: 2 };
  const normalizedSignals: LaboratoryRecord[] = Array.isArray(signals)
    ? signals.map(function (entry: unknown) {
        return toRecord(entry) as LaboratoryRecord;
      })
    : [];

  return normalizedSignals.sort(function (left: ProfileHelperRecord, right: ProfileHelperRecord) {
    const levelDelta =
      (levelOrder[String(left.level || "low")] ?? 99) -
      (levelOrder[String(right.level || "low")] ?? 99);
    if (levelDelta !== 0) {
      return levelDelta;
    }
    const kindDelta =
      (kindOrder[String(left.kind || "derived")] ?? 99) -
      (kindOrder[String(right.kind || "derived")] ?? 99);
    if (kindDelta !== 0) {
      return kindDelta;
    }
    return String(left.id || left.title || "").localeCompare(String(right.id || right.title || ""));
  });
}

export function getTopProfileSignals(
  signals: unknown[],
  limit: number,
  toRecord: (v: unknown) => ProfileHelperRecord
) {
  return sortProfileSignals(signals, toRecord).slice(0, Math.max(0, Number(limit) || 0));
}

export function getProfileSignalKindLabel(text: (keys: string[]) => string, kind: string) {
  return text([
    "mediaAnalysis",
    "profile",
    "signalKinds",
    typeof kind === "string" ? kind : "derived",
  ]);
}

export function getProfileConfidenceLabel(text: (keys: string[]) => string, confidence: string) {
  return text([
    "mediaAnalysis",
    "profile",
    "confidenceLevels",
    typeof confidence === "string" ? confidence : "low",
  ]);
}

export function formatPlatformList(platforms: string[]) {
  return Array.isArray(platforms) && platforms.length > 0 ? platforms.join(", ") : "--";
}

export function formatCleanupPolicy(
  policy: unknown,
  toRecord: (v: unknown) => ProfileHelperRecord,
  text: (keys: string[]) => string
) {
  const source = toRecord(policy);
  const labels = [];
  if (source.removeOnChecksumMismatch === true) {
    labels.push(text(["mediaAnalysis", "profile", "cleanupPolicy", "checksumMismatch"]));
  }
  if (source.removeOnDescriptorChange === true) {
    labels.push(text(["mediaAnalysis", "profile", "cleanupPolicy", "descriptorChange"]));
  }
  return labels.length > 0 ? labels.join(", ") : "--";
}

export function getPreferredSourceDuration(
  sourceMetadata: ProfileHelperRecord,
  previewMetrics: ProfileHelperRecord,
  previewUrl: string
) {
  if (typeof sourceMetadata.durationSeconds === "number" && sourceMetadata.durationSeconds > 0) {
    return sourceMetadata.durationSeconds;
  }
  return previewMetrics.url === previewUrl ? previewMetrics.duration : null;
}

export function getPreferredSourceResolution(
  sourceMetadata: ProfileHelperRecord,
  previewMetrics: ProfileHelperRecord,
  previewUrl: string
) {
  const width =
    typeof sourceMetadata.width === "number" && sourceMetadata.width > 0
      ? sourceMetadata.width
      : previewMetrics.url === previewUrl
        ? previewMetrics.width
        : null;
  const height =
    typeof sourceMetadata.height === "number" && sourceMetadata.height > 0
      ? sourceMetadata.height
      : previewMetrics.url === previewUrl
        ? previewMetrics.height
        : null;

  if (typeof width === "number" && typeof height === "number") {
    return `${width} x ${height}`;
  }

  return "--";
}

export function getPreferredSourceCodec(sourceMetadata: ProfileHelperRecord) {
  return (
    (typeof sourceMetadata.codec === "string" &&
      sourceMetadata.codec.trim() !== "" &&
      sourceMetadata.codec) ||
    (typeof sourceMetadata.videoCodec === "string" &&
      sourceMetadata.videoCodec.trim() !== "" &&
      sourceMetadata.videoCodec) ||
    (typeof sourceMetadata.audioCodec === "string" &&
      sourceMetadata.audioCodec.trim() !== "" &&
      sourceMetadata.audioCodec) ||
    "--"
  );
}

export function getPreferredAssetDuration(
  asset: unknown,
  previewMetrics: ProfileHelperRecord,
  toRecord: (v: unknown) => ProfileHelperRecord
) {
  const metadata = toRecord(toRecord(asset).metadata);
  if (typeof metadata.durationSeconds === "number" && metadata.durationSeconds > 0) {
    return metadata.durationSeconds;
  }
  const previewUrl =
    typeof toRecord(asset).previewUrl === "string" ? toRecord(asset).previewUrl : null;
  return previewMetrics.url === previewUrl ? previewMetrics.duration : null;
}

export function getPreferredAssetResolution(
  asset: unknown,
  previewMetrics: ProfileHelperRecord,
  toRecord: (v: unknown) => ProfileHelperRecord
) {
  const metadata = toRecord(toRecord(asset).metadata);
  const previewUrl =
    typeof toRecord(asset).previewUrl === "string" ? toRecord(asset).previewUrl : null;
  const width =
    typeof metadata.width === "number" && metadata.width > 0
      ? metadata.width
      : previewMetrics.url === previewUrl
        ? previewMetrics.width
        : null;
  const height =
    typeof metadata.height === "number" && metadata.height > 0
      ? metadata.height
      : previewMetrics.url === previewUrl
        ? previewMetrics.height
        : null;

  if (typeof width === "number" && typeof height === "number") {
    return `${width} x ${height}`;
  }

  return "--";
}

export function getPreferredAssetCodec(
  asset: unknown,
  toRecord: (v: unknown) => ProfileHelperRecord
) {
  const metadata = toRecord(toRecord(asset).metadata);
  return (
    (typeof metadata.codec === "string" && metadata.codec.trim() !== "" && metadata.codec) ||
    (typeof metadata.videoCodec === "string" &&
      metadata.videoCodec.trim() !== "" &&
      metadata.videoCodec) ||
    (typeof metadata.audioCodec === "string" &&
      metadata.audioCodec.trim() !== "" &&
      metadata.audioCodec) ||
    "--"
  );
}

export function getToolDisplayName(
  toolId: string,
  toolRegistry: ProfileHelperRecord[],
  text: (keys: string[]) => string
) {
  const registryEntry =
    toolRegistry.find(function (entry: ProfileHelperRecord) {
      return entry.toolId === toolId;
    }) || {};

  return (
    (typeof registryEntry.displayName === "string" &&
      registryEntry.displayName.trim() !== "" &&
      registryEntry.displayName) ||
    text(["mediaAnalysis", "settings", "tools", toolId]) ||
    toolId
  );
}

export function getMediaKindLabel(kind: string, featureText: (keys: string[]) => string) {
  if (typeof kind !== "string" || kind.trim() === "") {
    return "--";
  }
  return featureText(["source", "formats", kind, "title"]) || kind;
}

export function getProfileLaneCardState(params: ProfileLaneCardParams) {
  const {
    currentSourceKind,
    getMediaKindLabel,
    getToolDisplayName,
    getToolEntry,
    profileLaneMap,
    profileReadiness,
    projectProfile,
    text,
    toRecord,
    laneId,
  } = params;
  const lane = toRecord(profileLaneMap[laneId]);
  const mediaKinds = Array.isArray(lane.mediaKinds) ? lane.mediaKinds : [];
  const compatible = mediaKinds.length === 0 || mediaKinds.includes(currentSourceKind);
  const laneSummaries = Array.isArray(profileReadiness.lanes)
    ? profileReadiness.lanes.map(function (entry: unknown) {
        return toRecord(entry);
      })
    : [];
  const laneSummary =
    laneSummaries.find(function (entry) {
      return toRecord(entry).laneId === laneId;
    }) || ({} as ProfileHelperRecord);
  const requiredTools = Array.isArray(lane.requiredTools) ? lane.requiredTools : [];
  const optionalTools = Array.isArray(lane.optionalTools) ? lane.optionalTools : [];
  const laneSupportLevel = toRecord(laneSummary).supportLevel;
  let supportLevel = compatible ? "ready" : "blocked";
  let note = compatible ? "" : text(["mediaAnalysis", "profile", "laneMeta", "incompatible"]);

  if (compatible) {
    supportLevel = typeof laneSupportLevel === "string" ? laneSupportLevel : "ready";
    if (supportLevel === "degraded" && optionalTools.includes("whisper.cpp")) {
      const whisperReady = getToolEntry("whisper.cpp").ready === true;
      note = whisperReady
        ? text(["mediaAnalysis", "profile", "laneMeta", "speechModelMissing"])
        : text(["mediaAnalysis", "profile", "laneMeta", "speechToolMissing"]);
    }
  }

  return {
    lane: lane,
    compatible: compatible,
    enabled: compatible && toRecord(projectProfile.laneSelection)[laneId] === true,
    supportLevel: supportLevel,
    note: note,
    requiredTools: requiredTools.map(getToolDisplayName),
    optionalTools: optionalTools.map(getToolDisplayName),
    mediaKinds: mediaKinds.map(getMediaKindLabel),
  };
}

export function getPreferredSourceFormat(
  sourceMetadata: ProfileHelperRecord,
  projectSource: ProfileHelperRecord
) {
  return (
    (typeof sourceMetadata["formatName"] === "string" &&
      sourceMetadata["formatName"].trim() !== "" &&
      sourceMetadata["formatName"]) ||
    (typeof projectSource["mimeType"] === "string" &&
      projectSource["mimeType"].trim() !== "" &&
      projectSource["mimeType"]) ||
    "--"
  );
}

export function formatBitRate(bitsPerSecond: number) {
  if (
    typeof bitsPerSecond !== "number" ||
    Number.isFinite(bitsPerSecond) === false ||
    bitsPerSecond <= 0
  ) {
    return "--";
  }

  if (bitsPerSecond >= 1_000_000) {
    return `${(bitsPerSecond / 1_000_000).toFixed(1)} Mbps`;
  }

  return `${Math.round(bitsPerSecond / 1000)} kbps`;
}

export function formatBytes(value: number) {
  if (typeof value !== "number" || Number.isFinite(value) !== true || value <= 0) {
    return "--";
  }
  if (value >= 1_000_000_000) {
    return `${(value / 1_000_000_000).toFixed(1)} GB`;
  }
  if (value >= 1_000_000) {
    return `${(value / 1_000_000).toFixed(1)} MB`;
  }
  if (value >= 1_000) {
    return `${Math.round(value / 1_000)} KB`;
  }
  return `${Math.round(value)} B`;
}
