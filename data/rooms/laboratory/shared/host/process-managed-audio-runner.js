export function createLaboratoryManagedAudioRunnerRuntime(deps) {
  const {
    asNonEmptyString,
    getAudioAnalysisModuleProcessDir,
    getAudioAnalysisModuleRunner,
    normalizeProcessArtifact,
    normalizeProcessFinding,
    sanitizeFileSegment,
    toRecord,
    updateProcessModule
  } = deps;
  function toProcessModuleRecord(value) {
    return toRecord(value);
  }
  function toRunnerResult(value) {
    return toRecord(value);
  }
  function toArtifactRecord(value) {
    return toRecord(value);
  }
  async function runAudioManagedProcess(runtime, project, requestId, jobId, target, artifactBase, processRecord) {
    const findings = [];
    const artifacts = [];
    const warnings = [];
    const modules = Array.isArray(processRecord.modules) ? processRecord.modules.map(toProcessModuleRecord) : [];
    for (let index = 0; index < modules.length; index += 1) {
      const moduleEntry = modules[index];
      if (!moduleEntry) {
        continue;
      }
      const moduleId = asNonEmptyString(moduleEntry.id) || `audio-module-${index}`;
      const moduleStatus = asNonEmptyString(moduleEntry.status) || "queued";
      if (["planned", "gated", "blocked", "skipped"].includes(moduleStatus)) {
        continue;
      }
      updateProcessModule(processRecord, moduleId, {
        status: "running",
        startedAt: (/* @__PURE__ */ new Date()).toISOString()
      });
      const moduleRunner = getAudioAnalysisModuleRunner(moduleId);
      if (typeof moduleRunner !== "function") {
        updateProcessModule(processRecord, moduleId, {
          status: "skipped",
          completedAt: (/* @__PURE__ */ new Date()).toISOString(),
          summary: "A generic audio runner is not registered for this module yet."
        });
        continue;
      }
      const moduleOutputDir = getAudioAnalysisModuleProcessDir(runtime, project, moduleId);
      const runnerOutput = await moduleRunner(
        runtime,
        project,
        requestId,
        jobId,
        target,
        sanitizeFileSegment(`${artifactBase}-${moduleId}`, moduleId),
        moduleOutputDir,
        moduleId
      );
      const moduleResult = toRunnerResult(runnerOutput);
      const moduleFindings = Array.isArray(moduleResult.findings) ? moduleResult.findings : [];
      moduleFindings.forEach(function(finding) {
        findings.push(normalizeProcessFinding(finding));
      });
      const moduleArtifacts = Array.isArray(moduleResult.artifacts) ? moduleResult.artifacts : [];
      moduleArtifacts.forEach(function(artifact) {
        artifacts.push(normalizeProcessArtifact(artifact));
      });
      const moduleWarnings = Array.isArray(moduleResult.warnings) ? moduleResult.warnings : [];
      moduleWarnings.forEach(function(warning) {
        warnings.push(String(warning));
      });
      updateProcessModule(processRecord, moduleId, {
        status: asNonEmptyString(moduleResult.status) || "ready",
        completedAt: (/* @__PURE__ */ new Date()).toISOString(),
        summary: asNonEmptyString(moduleResult.summary) || "",
        artifactIds: moduleArtifacts.map(function(artifact) {
          return asNonEmptyString(toArtifactRecord(artifact).id);
        }).filter((artifactId) => artifactId !== null)
      });
    }
    return {
      findings,
      artifacts,
      warnings
    };
  }
  return {
    runAudioManagedProcess
  };
}
