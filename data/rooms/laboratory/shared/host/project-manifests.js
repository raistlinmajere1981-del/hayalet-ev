export function createLaboratoryProjectManifestRuntime(deps) {
  const {
    asNonEmptyString,
    asNumber,
    clone,
    normalizeEditOutput,
    normalizeProcessState,
    normalizeProfileArtifact,
    normalizeProfileSignal,
    normalizeReportState,
    normalizeSourceMetadata,
    projectSchemaVersion,
    toRecord
  } = deps;
  function toProjectRecord(value) {
    return toRecord(value);
  }
  function toProjectSourceRecord(value) {
    return toRecord(value);
  }
  function toProjectEditRecord(value) {
    return toRecord(value);
  }
  function toEditPreviewRecord(value) {
    return toRecord(value);
  }
  function toProjectProfileRecord(value) {
    return toRecord(value);
  }
  function toRecordList(value) {
    return Array.isArray(value) ? value.map(toRecord) : [];
  }
  function getEditOutputs(edit) {
    return Array.isArray(edit.outputs) ? edit.outputs.map(normalizeEditOutput) : [];
  }
  function buildEditManifest(project) {
    const projectRecord = toProjectRecord(project);
    const sourceRecord = toProjectSourceRecord(projectRecord.source);
    const editRecord = toProjectEditRecord(projectRecord.edit);
    const previewRecord = toEditPreviewRecord(editRecord.preview);
    const outputs = getEditOutputs(editRecord);
    return {
      schemaVersion: projectSchemaVersion,
      projectId: asNonEmptyString(projectRecord.id),
      updatedAt: asNonEmptyString(projectRecord.updatedAt),
      sourceKind: asNonEmptyString(sourceRecord.kind) || "video",
      handoffMode: asNonEmptyString(editRecord.handoffMode) || "source",
      activeOutputId: asNonEmptyString(editRecord.activeOutputId),
      preview: {
        status: asNonEmptyString(previewRecord.status) || "idle",
        path: asNonEmptyString(previewRecord.path),
        fileName: asNonEmptyString(previewRecord.fileName),
        recipeSignature: asNonEmptyString(previewRecord.recipeSignature),
        metadata: normalizeSourceMetadata(previewRecord.metadata),
        artifacts: toRecordList(previewRecord.artifacts),
        updatedAt: asNonEmptyString(previewRecord.updatedAt)
      },
      outputs: outputs.map(function(entry) {
        return {
          id: asNonEmptyString(entry.id),
          path: asNonEmptyString(entry.path),
          fileName: asNonEmptyString(entry.fileName),
          kind: asNonEmptyString(entry.kind),
          label: asNonEmptyString(entry.label),
          recipeSignature: asNonEmptyString(entry.recipeSignature),
          createdAt: asNonEmptyString(entry.createdAt),
          metadata: normalizeSourceMetadata(entry.metadata),
          artifacts: toRecordList(entry.artifacts)
        };
      })
    };
  }
  function buildProfileManifest(project) {
    const projectRecord = toProjectRecord(project);
    const profileRecord = toProjectProfileRecord(projectRecord.profile);
    return {
      schemaVersion: projectSchemaVersion,
      projectId: asNonEmptyString(projectRecord.id),
      updatedAt: asNonEmptyString(projectRecord.updatedAt),
      targetAssetMode: asNonEmptyString(profileRecord.targetAssetMode) || "source",
      targetOutputId: asNonEmptyString(profileRecord.targetOutputId),
      targetAssetSignature: asNonEmptyString(profileRecord.targetAssetSignature),
      depth: asNonEmptyString(profileRecord.depth) || "balanced",
      sensitivity: asNumber(profileRecord.sensitivity),
      frameSampleDensity: asNonEmptyString(profileRecord.frameSampleDensity) || "balanced",
      transcriptSampleSeconds: asNumber(profileRecord.transcriptSampleSeconds),
      activePresetId: asNonEmptyString(profileRecord.activePresetId),
      artifactPreferences: clone(toRecord(profileRecord.artifactPreferences)),
      preflight: clone(toRecord(profileRecord.preflight)),
      signals: Array.isArray(profileRecord.signals) ? profileRecord.signals.map(normalizeProfileSignal) : [],
      artifacts: Array.isArray(profileRecord.artifacts) ? profileRecord.artifacts.map(normalizeProfileArtifact) : []
    };
  }
  function buildProcessManifest(project) {
    const projectRecord = toProjectRecord(project);
    return {
      schemaVersion: projectSchemaVersion,
      projectId: asNonEmptyString(projectRecord.id),
      updatedAt: asNonEmptyString(projectRecord.updatedAt),
      process: normalizeProcessState(projectRecord.process)
    };
  }
  function buildReportManifest(project) {
    const projectRecord = toProjectRecord(project);
    return {
      schemaVersion: projectSchemaVersion,
      projectId: asNonEmptyString(projectRecord.id),
      updatedAt: asNonEmptyString(projectRecord.updatedAt),
      report: normalizeReportState(projectRecord.report)
    };
  }
  function buildSourceTargetSignature(project) {
    const projectRecord = toProjectRecord(project);
    const sourceRecord = toProjectSourceRecord(projectRecord.source);
    const metadata = normalizeSourceMetadata(sourceRecord.metadata);
    return JSON.stringify({
      mode: "source",
      kind: asNonEmptyString(sourceRecord.kind) || "video",
      path: asNonEmptyString(sourceRecord.storedPath),
      fileName: asNonEmptyString(sourceRecord.storedFileName),
      mimeType: asNonEmptyString(sourceRecord.mimeType),
      durationSeconds: asNumber(metadata.durationSeconds),
      sizeBytes: asNumber(metadata.sizeBytes),
      updatedAt: asNonEmptyString(projectRecord.updatedAt)
    });
  }
  function buildDerivedTargetSignature(output) {
    const entry = normalizeEditOutput(output);
    const metadata = normalizeSourceMetadata(entry.metadata);
    return JSON.stringify({
      mode: "derived",
      outputId: asNonEmptyString(entry.id),
      path: asNonEmptyString(entry.path),
      fileName: asNonEmptyString(entry.fileName),
      mimeType: asNonEmptyString(entry.mimeType),
      recipeSignature: asNonEmptyString(entry.recipeSignature),
      durationSeconds: asNumber(metadata.durationSeconds),
      sizeBytes: asNumber(metadata.sizeBytes),
      createdAt: asNonEmptyString(entry.createdAt)
    });
  }
  function findEditOutputById(project, outputId) {
    const targetId = asNonEmptyString(outputId);
    if (targetId === null) {
      return null;
    }
    const projectRecord = toProjectRecord(project);
    const editRecord = toProjectEditRecord(projectRecord.edit);
    return getEditOutputs(editRecord).find(function(entry) {
      return asNonEmptyString(entry.id) === targetId;
    }) || null;
  }
  return {
    buildDerivedTargetSignature,
    buildEditManifest,
    buildProcessManifest,
    buildProfileManifest,
    buildReportManifest,
    buildSourceTargetSignature,
    findEditOutputById
  };
}
