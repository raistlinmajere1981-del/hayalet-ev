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
  function buildEditManifest(project) {
    const edit = toRecord(project.edit);
    const preview = toRecord(edit.preview);
    const outputs = Array.isArray(edit.outputs) ? edit.outputs.map(normalizeEditOutput) : [];
    return {
      schemaVersion: projectSchemaVersion,
      projectId: project.id,
      updatedAt: project.updatedAt,
      sourceKind: project.source.kind,
      handoffMode: asNonEmptyString(edit.handoffMode) || "source",
      activeOutputId: asNonEmptyString(edit.activeOutputId),
      preview: {
        status: asNonEmptyString(preview.status) || "idle",
        path: asNonEmptyString(preview.path),
        fileName: asNonEmptyString(preview.fileName),
        recipeSignature: asNonEmptyString(preview.recipeSignature),
        metadata: normalizeSourceMetadata(preview.metadata),
        artifacts: Array.isArray(preview.artifacts) ? preview.artifacts.map(toRecord) : [],
        updatedAt: asNonEmptyString(preview.updatedAt)
      },
      outputs: outputs.map(function(entry) {
        return {
          id: entry.id,
          path: entry.path,
          fileName: entry.fileName,
          kind: entry.kind,
          label: entry.label,
          recipeSignature: entry.recipeSignature,
          createdAt: entry.createdAt,
          metadata: normalizeSourceMetadata(entry.metadata),
          artifacts: Array.isArray(entry.artifacts) ? entry.artifacts.map(toRecord) : []
        };
      })
    };
  }
  function buildProfileManifest(project) {
    const profile = toRecord(project.profile);
    return {
      schemaVersion: projectSchemaVersion,
      projectId: project.id,
      updatedAt: project.updatedAt,
      targetAssetMode: asNonEmptyString(profile.targetAssetMode) || "source",
      targetOutputId: asNonEmptyString(profile.targetOutputId),
      targetAssetSignature: asNonEmptyString(profile.targetAssetSignature),
      depth: asNonEmptyString(profile.depth) || "balanced",
      sensitivity: asNumber(profile.sensitivity),
      frameSampleDensity: asNonEmptyString(profile.frameSampleDensity) || "balanced",
      transcriptSampleSeconds: asNumber(profile.transcriptSampleSeconds),
      activePresetId: asNonEmptyString(profile.activePresetId),
      artifactPreferences: clone(toRecord(profile.artifactPreferences)),
      preflight: clone(toRecord(profile.preflight)),
      signals: Array.isArray(profile.signals) ? profile.signals.map(normalizeProfileSignal) : [],
      artifacts: Array.isArray(profile.artifacts) ? profile.artifacts.map(normalizeProfileArtifact) : []
    };
  }
  function buildProcessManifest(project) {
    return {
      schemaVersion: projectSchemaVersion,
      projectId: project.id,
      updatedAt: project.updatedAt,
      process: normalizeProcessState(project.process)
    };
  }
  function buildReportManifest(project) {
    return {
      schemaVersion: projectSchemaVersion,
      projectId: project.id,
      updatedAt: project.updatedAt,
      report: normalizeReportState(project.report)
    };
  }
  function buildSourceTargetSignature(project) {
    const source = toRecord(project.source);
    const metadata = normalizeSourceMetadata(source.metadata);
    return JSON.stringify({
      mode: "source",
      kind: asNonEmptyString(source.kind) || "video",
      path: asNonEmptyString(source.storedPath),
      fileName: asNonEmptyString(source.storedFileName),
      mimeType: asNonEmptyString(source.mimeType),
      durationSeconds: asNumber(toRecord(metadata).durationSeconds),
      sizeBytes: asNumber(toRecord(metadata).sizeBytes),
      updatedAt: asNonEmptyString(project.updatedAt)
    });
  }
  function buildDerivedTargetSignature(output) {
    const entry = normalizeEditOutput(output);
    const metadata = normalizeSourceMetadata(entry.metadata);
    return JSON.stringify({
      mode: "derived",
      outputId: entry.id,
      path: asNonEmptyString(entry.path),
      fileName: asNonEmptyString(entry.fileName),
      mimeType: asNonEmptyString(entry.mimeType),
      recipeSignature: asNonEmptyString(entry.recipeSignature),
      durationSeconds: asNumber(toRecord(metadata).durationSeconds),
      sizeBytes: asNumber(toRecord(metadata).sizeBytes),
      createdAt: asNonEmptyString(entry.createdAt)
    });
  }
  function findEditOutputById(project, outputId) {
    const targetId = asNonEmptyString(outputId);
    if (targetId === null) {
      return null;
    }
    return (Array.isArray(toRecord(project.edit).outputs) ? project.edit.outputs : []).find(function(entry) {
      return asNonEmptyString(toRecord(entry).id) === targetId;
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
