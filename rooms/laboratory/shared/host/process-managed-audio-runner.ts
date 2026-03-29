export function createLaboratoryManagedAudioRunnerRuntime(deps) {
  const {
    asNonEmptyString,
    getAudioAnalysisModuleProcessDir,
    getAudioAnalysisModuleRunner,
    normalizeProcessArtifact,
    normalizeProcessFinding,
    sanitizeFileSegment,
    toRecord,
    updateProcessModule,
  } = deps;

  async function runAudioManagedProcess(
    runtime,
    project,
    requestId,
    jobId,
    target,
    artifactBase,
    processRecord
  ) {
    const findings = [];
    const artifacts = [];
    const warnings = [];

    for (let index = 0; index < processRecord.modules.length; index += 1) {
      const moduleEntry = toRecord(processRecord.modules[index]);
      const moduleId = asNonEmptyString(moduleEntry.id) || `audio-module-${index}`;
      const moduleStatus = asNonEmptyString(moduleEntry.status) || "queued";
      if (["planned", "gated", "blocked", "skipped"].includes(moduleStatus)) {
        continue;
      }

      updateProcessModule(processRecord, moduleId, {
        status: "running",
        percent: 30,
        startedAt: new Date().toISOString(),
      });

      const moduleRunner = getAudioAnalysisModuleRunner(moduleId);
      if (typeof moduleRunner !== "function") {
        updateProcessModule(processRecord, moduleId, {
          status: "skipped",
          percent: 100,
          completedAt: new Date().toISOString(),
          summary: "A generic audio runner is not registered for this module yet.",
        });
        continue;
      }

      const moduleOutputDir = getAudioAnalysisModuleProcessDir(runtime, project, moduleId);
      const moduleResult = await moduleRunner(
        runtime,
        project,
        requestId,
        jobId,
        target,
        sanitizeFileSegment(`${artifactBase}-${moduleId}`, moduleId),
        moduleOutputDir,
        moduleId
      );

      (Array.isArray(moduleResult.findings) ? moduleResult.findings : []).forEach(function (finding) {
        findings.push(normalizeProcessFinding(finding));
      });
      (Array.isArray(moduleResult.artifacts) ? moduleResult.artifacts : []).forEach(function (artifact) {
        artifacts.push(normalizeProcessArtifact(artifact));
      });
      (Array.isArray(moduleResult.warnings) ? moduleResult.warnings : []).forEach(function (warning) {
        warnings.push(String(warning));
      });

      updateProcessModule(processRecord, moduleId, {
        status: asNonEmptyString(moduleResult.status) || "ready",
        percent: 100,
        completedAt: new Date().toISOString(),
        summary: asNonEmptyString(moduleResult.summary) || "",
        artifactIds: (Array.isArray(moduleResult.artifacts) ? moduleResult.artifacts : [])
          .map(function (artifact) {
            return asNonEmptyString(toRecord(artifact).id);
          })
          .filter(Boolean),
      });
    }

    return {
      findings: findings,
      artifacts: artifacts,
      warnings: warnings,
    };
  }

  return {
    runAudioManagedProcess,
  };
}
