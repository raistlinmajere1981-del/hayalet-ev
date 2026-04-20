export function getMediaAnalysisProfileTargetAsset(deps) {
  const getCurrentSourceKind = deps.getCurrentSourceKind;
  const getCurrentSourceLabel = deps.getCurrentSourceLabel;
  const getEditOutputs = deps.getEditOutputs;
  const getProfileTargetSummary = deps.getProfileTargetSummary;
  const getProjectSource = deps.getProjectSource;
  const toRecord = deps.toRecord;
  const source = getProjectSource();
  const target = getProfileTargetSummary();
  if (target.mode === "derived") {
    const output = getEditOutputs().find(function(entry) {
      return entry.id === target.outputId;
    });
    if (output) {
      return {
        kind: getCurrentSourceKind(),
        label: output.label || output.fileName || output.id,
        previewUrl: output.previewUrl || null,
        path: output.path || null,
        mimeType: output.mimeType || null,
        metadata: toRecord(output.metadata)
      };
    }
  }
  return {
    kind: getCurrentSourceKind(),
    label: target.label || source.storedFileName || getCurrentSourceLabel(),
    previewUrl: source.previewUrl || null,
    path: target.path || source.storedPath || null,
    mimeType: target.mimeType || source.mimeType || null,
    metadata: toRecord(target.metadata)
  };
}
