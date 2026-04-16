type LaboratoryRecord = Record<string, unknown>;

type LaboratoryProcessRecord = LaboratoryRecord & {
  modules?: unknown;
};

type LaboratoryProcessModuleRecord = LaboratoryRecord & {
  id?: unknown;
  status?: unknown;
};

type LaboratoryProcessArtifactRecord = LaboratoryRecord & {
  id?: unknown;
  moduleId?: unknown;
};

type LaboratoryProcessFindingRecord = LaboratoryRecord;

type LaboratoryAudioModuleRunnerResult = LaboratoryRecord & {
  artifacts?: unknown;
  findings?: unknown;
  status?: unknown;
  summary?: unknown;
  warnings?: unknown;
};

type LaboratoryAudioModuleRunner = (
  runtime: LaboratoryRecord,
  project: LaboratoryRecord,
  requestId: string,
  jobId: string,
  target: LaboratoryRecord,
  artifactBase: string,
  outputDir: string,
  moduleId: string
) => Promise<LaboratoryAudioModuleRunnerResult>;

type LaboratoryManagedAudioRunnerResult = {
  artifacts: LaboratoryProcessArtifactRecord[];
  findings: LaboratoryProcessFindingRecord[];
  warnings: string[];
};

type LaboratoryManagedAudioRunnerDeps = {
  asNonEmptyString: (value: unknown) => string | null;
  getAudioAnalysisModuleProcessDir: (
    runtime: LaboratoryRecord,
    project: LaboratoryRecord,
    moduleId: string
  ) => string;
  getAudioAnalysisModuleRunner: (moduleId: string) => LaboratoryAudioModuleRunner | null;
  normalizeProcessArtifact: (rawValue: unknown) => LaboratoryProcessArtifactRecord;
  normalizeProcessFinding: (rawValue: unknown) => LaboratoryProcessFindingRecord;
  sanitizeFileSegment: (value: string, fallbackValue: string) => string;
  toRecord: (value: unknown) => LaboratoryRecord;
  updateProcessModule: (
    processRecord: LaboratoryProcessRecord,
    moduleId: string,
    patch: LaboratoryRecord
  ) => LaboratoryProcessRecord;
};

export function createLaboratoryManagedAudioRunnerRuntime(deps: LaboratoryManagedAudioRunnerDeps) {
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

  function toProcessModuleRecord(value: unknown): LaboratoryProcessModuleRecord {
    return toRecord(value);
  }

  function toRunnerResult(value: unknown): LaboratoryAudioModuleRunnerResult {
    return toRecord(value);
  }

  function toArtifactRecord(value: unknown): LaboratoryProcessArtifactRecord {
    return toRecord(value);
  }

  async function runAudioManagedProcess(
    runtime: LaboratoryRecord,
    project: LaboratoryRecord,
    requestId: string,
    jobId: string,
    target: LaboratoryRecord,
    artifactBase: string,
    processRecord: LaboratoryProcessRecord
  ): Promise<LaboratoryManagedAudioRunnerResult> {
    const findings: LaboratoryProcessFindingRecord[] = [];
    const artifacts: LaboratoryProcessArtifactRecord[] = [];
    const warnings: string[] = [];
    const modules = Array.isArray(processRecord.modules)
      ? processRecord.modules.map(toProcessModuleRecord)
      : [];

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
        startedAt: new Date().toISOString(),
      });

      const moduleRunner = getAudioAnalysisModuleRunner(moduleId);
      if (typeof moduleRunner !== "function") {
        updateProcessModule(processRecord, moduleId, {
          status: "skipped",
          completedAt: new Date().toISOString(),
          summary: "A generic audio runner is not registered for this module yet.",
        });
        continue;
      }

      const moduleOutputDir = getAudioAnalysisModuleProcessDir(runtime, project, moduleId);
      // eslint-disable-next-line no-await-in-loop -- NOTE: module progress updates are emitted in execution order.
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
      moduleFindings.forEach(function (finding) {
        findings.push(normalizeProcessFinding(finding));
      });

      const moduleArtifacts = Array.isArray(moduleResult.artifacts) ? moduleResult.artifacts : [];
      moduleArtifacts.forEach(function (artifact) {
        artifacts.push(normalizeProcessArtifact(artifact));
      });

      const moduleWarnings = Array.isArray(moduleResult.warnings) ? moduleResult.warnings : [];
      moduleWarnings.forEach(function (warning) {
        warnings.push(String(warning));
      });

      updateProcessModule(processRecord, moduleId, {
        status: asNonEmptyString(moduleResult.status) || "ready",
        completedAt: new Date().toISOString(),
        summary: asNonEmptyString(moduleResult.summary) || "",
        artifactIds: moduleArtifacts
          .map(function (artifact) {
            return asNonEmptyString(toArtifactRecord(artifact).id);
          })
          .filter((artifactId): artifactId is string => artifactId !== null),
      });
    }

    return {
      findings,
      artifacts,
      warnings,
    };
  }

  return {
    runAudioManagedProcess,
  };
}
