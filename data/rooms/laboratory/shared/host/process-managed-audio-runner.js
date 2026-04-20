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
  async function runAudioManagedProcess(runtime, project, requestId, jobId, target, artifactBase, processRecord, emitRuntimeUpdate = null) {
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
      emitRuntimeUpdate?.({
        kind: "module-progress",
        moduleId,
        message: `${moduleId} module started`,
        detail: null,
        moduleTrace: {
          id: `${moduleId}-running-${Date.now()}`,
          moduleId,
          stage: "process",
          status: "running",
          timestamp: (/* @__PURE__ */ new Date()).toISOString(),
          message: `${moduleId} module started`,
          detail: null
        }
      });
      const moduleRunner = getAudioAnalysisModuleRunner(moduleId);
      if (typeof moduleRunner !== "function") {
        updateProcessModule(processRecord, moduleId, {
          status: "skipped",
          completedAt: (/* @__PURE__ */ new Date()).toISOString(),
          summary: "A generic audio runner is not registered for this module yet."
        });
        emitRuntimeUpdate?.({
          kind: "module-warning",
          moduleId,
          message: `${moduleId} module skipped`,
          detail: "A generic audio runner is not registered for this module yet.",
          moduleTrace: {
            id: `${moduleId}-skipped-${Date.now()}`,
            moduleId,
            stage: "process",
            status: "skipped",
            timestamp: (/* @__PURE__ */ new Date()).toISOString(),
            message: `${moduleId} module skipped`,
            detail: "A generic audio runner is not registered for this module yet."
          }
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
      if (moduleFindings.length > 0) {
        emitRuntimeUpdate?.({
          kind: "live-finding",
          moduleId,
          message: `${moduleId} findings updated`,
          detail: moduleFindings.length > 1 ? `${moduleFindings.length} audio findings were aggregated for this module.` : asNonEmptyString(toRecord(moduleFindings[0])["detail"]) || asNonEmptyString(toRecord(moduleFindings[0])["title"]) || "Audio finding emitted.",
          finding: moduleFindings[0],
          moduleTrace: {
            id: `${moduleId}-finding-${Date.now()}`,
            moduleId,
            stage: "process",
            status: "finding",
            timestamp: (/* @__PURE__ */ new Date()).toISOString(),
            message: `${moduleId} findings updated`,
            detail: moduleFindings.length > 1 ? `${moduleFindings.length} audio findings were aggregated for this module.` : asNonEmptyString(toRecord(moduleFindings[0])["detail"]) || asNonEmptyString(toRecord(moduleFindings[0])["title"]) || "Audio finding emitted."
          },
          throttleWindow: `${moduleId}-module-batch`
        });
      }
      const primaryArtifact = moduleArtifacts[0] ? normalizeProcessArtifact(moduleArtifacts[0]) : null;
      if (primaryArtifact) {
        emitRuntimeUpdate?.({
          kind: "preview-artifact",
          moduleId,
          message: `${moduleId} preview artifact ready`,
          detail: asNonEmptyString(toRecord(primaryArtifact)["label"]),
          artifact: primaryArtifact,
          moduleTrace: {
            id: `${moduleId}-preview-${Date.now()}`,
            moduleId,
            stage: "process",
            status: "preview-ready",
            timestamp: (/* @__PURE__ */ new Date()).toISOString(),
            message: `${moduleId} preview artifact ready`,
            detail: asNonEmptyString(toRecord(primaryArtifact)["label"])
          },
          throttleWindow: `${moduleId}-module-batch`
        });
        emitRuntimeUpdate?.({
          kind: "module-artifact",
          moduleId,
          message: `${moduleId} artifact recorded`,
          detail: asNonEmptyString(toRecord(primaryArtifact)["label"]),
          artifact: primaryArtifact,
          throttleWindow: `${moduleId}-module-batch`
        });
      }
      if (moduleWarnings.length > 0) {
        emitRuntimeUpdate?.({
          kind: "module-warning",
          moduleId,
          message: `${moduleId} module warning`,
          detail: moduleWarnings.join(" | "),
          moduleTrace: {
            id: `${moduleId}-warning-${Date.now()}`,
            moduleId,
            stage: "process",
            status: "warning",
            timestamp: (/* @__PURE__ */ new Date()).toISOString(),
            message: `${moduleId} module warning`,
            detail: moduleWarnings.join(" | ")
          },
          throttleWindow: `${moduleId}-module-batch`
        });
      }
      emitRuntimeUpdate?.({
        kind: "module-progress",
        moduleId,
        message: `${moduleId} module completed`,
        detail: asNonEmptyString(moduleResult.summary) || null,
        moduleTrace: {
          id: `${moduleId}-completed-${Date.now()}`,
          moduleId,
          stage: "process",
          status: asNonEmptyString(moduleResult.status) || "ready",
          timestamp: (/* @__PURE__ */ new Date()).toISOString(),
          message: `${moduleId} module completed`,
          detail: asNonEmptyString(moduleResult.summary) || null
        },
        throttleWindow: `${moduleId}-module-batch`
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
