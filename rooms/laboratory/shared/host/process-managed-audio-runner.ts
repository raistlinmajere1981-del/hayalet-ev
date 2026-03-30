export function createLaboratoryManagedAudioRunnerRuntime(deps: any) {
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
    runtime: any,
    project: any,
    requestId: any,
    jobId: any,
    target: any,
    artifactBase: any,
    processRecord: any
  ) {
    const findings: any[] = [];
    const artifacts: any[] = [];
    const warnings: any[] = [];

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
      // eslint-disable-next-line no-await-in-loop -- NOTE: module progress updates are emitted in execution order.
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

      (Array.isArray(moduleResult.findings) ? moduleResult.findings : []).forEach(
        function (finding: any) {
          findings.push(normalizeProcessFinding(finding));
        }
      );
      (Array.isArray(moduleResult.artifacts) ? moduleResult.artifacts : []).forEach(
        function (artifact: any) {
          artifacts.push(normalizeProcessArtifact(artifact));
        }
      );
      (Array.isArray(moduleResult.warnings) ? moduleResult.warnings : []).forEach(
        function (warning: any) {
          warnings.push(String(warning));
        }
      );

      updateProcessModule(processRecord, moduleId, {
        status: asNonEmptyString(moduleResult.status) || "ready",
        percent: 100,
        completedAt: new Date().toISOString(),
        summary: asNonEmptyString(moduleResult.summary) || "",
        artifactIds: (Array.isArray(moduleResult.artifacts) ? moduleResult.artifacts : [])
          .map(function (artifact: any) {
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
