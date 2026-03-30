type MediaAnalysisProfileTargetSource = {
  storedFileName?: string | null;
  previewUrl?: string | null;
  storedPath?: string | null;
  mimeType?: string | null;
};

type MediaAnalysisProfileTargetSummary = {
  mode?: string | null;
  outputId?: string | null;
  label?: string | null;
  path?: string | null;
  mimeType?: string | null;
  metadata?: unknown;
};

type MediaAnalysisEditOutput = {
  id?: string | null;
  label?: string | null;
  fileName?: string | null;
  previewUrl?: string | null;
  path?: string | null;
  mimeType?: string | null;
  metadata?: unknown;
};

type MediaAnalysisProfileTargetAssetDeps = {
  getCurrentSourceKind: () => string;
  getCurrentSourceLabel: () => string;
  getEditOutputs: () => MediaAnalysisEditOutput[];
  getProfileTargetSummary: () => MediaAnalysisProfileTargetSummary;
  getProjectSource: () => MediaAnalysisProfileTargetSource;
  toRecord: (value: unknown) => Record<string, unknown>;
};

export function getMediaAnalysisProfileTargetAsset(deps: MediaAnalysisProfileTargetAssetDeps) {
  const getCurrentSourceKind = deps.getCurrentSourceKind;
  const getCurrentSourceLabel = deps.getCurrentSourceLabel;
  const getEditOutputs = deps.getEditOutputs;
  const getProfileTargetSummary = deps.getProfileTargetSummary;
  const getProjectSource = deps.getProjectSource;
  const toRecord = deps.toRecord;

  const source = getProjectSource();
  const target = getProfileTargetSummary();
  if (target.mode === "derived") {
    const output = getEditOutputs().find(function (entry) {
      return entry.id === target.outputId;
    });
    if (output) {
      return {
        kind: getCurrentSourceKind(),
        label: output.label || output.fileName || output.id,
        previewUrl: output.previewUrl || null,
        path: output.path || null,
        mimeType: output.mimeType || null,
        metadata: toRecord(output.metadata),
      };
    }
  }

  return {
    kind: getCurrentSourceKind(),
    label: target.label || source.storedFileName || getCurrentSourceLabel(),
    previewUrl: source.previewUrl || null,
    path: target.path || source.storedPath || null,
    mimeType: target.mimeType || source.mimeType || null,
    metadata: toRecord(target.metadata),
  };
}
