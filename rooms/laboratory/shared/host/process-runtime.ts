import { createLaboratoryManagedProcessRunnersRuntime } from "./process-managed-runners.js";
import { extractFindings } from "../../services/finding-engine.js";
import { freezeAnalysisScope } from "../types/analysis-scope.js";
import { createLabOutputAsset, upsertLabAsset } from "./lab-assets.js";
import { normalizeLabAnalysisSettingsMap } from "../../models/lab-types.js";

interface LaboratoryProcessDeps {
  appendProcessEvent: (
    record: Record<string, unknown>,
    event: Record<string, unknown>
  ) => Record<string, unknown>;
  asNonEmptyString: (value: unknown) => string | null;
  buildAudioAnalysisModules: (
    runtime: Record<string, unknown>,
    project: Record<string, unknown>,
    target: Record<string, unknown>
  ) => unknown[];
  buildMediaProcessModules: (
    runtime: Record<string, unknown>,
    project: Record<string, unknown>,
    target: Record<string, unknown>
  ) => unknown[];
  cancelProcessJobsForProject: (
    api: Record<string, unknown>,
    runtime: Record<string, unknown>,
    projectId: string,
    requestId: string,
    action?: string
  ) => Promise<void>;
  clearJob: (runtime: Record<string, unknown>, jobId: string) => void;
  clone: <T>(value: T) => T;
  composeFeatureReport: (
    runtime: Record<string, unknown>,
    project: Record<string, unknown>,
    featureId: string
  ) => unknown;
  createEmptyFeatureProcessRecord: (featureId: string) => Record<string, unknown>;
  createEmptyProcessRun: (featureId: string) => Record<string, unknown>;
  ensureEditToolReady: (runtime: Record<string, unknown>) => void;
  ensureProcessJobSlotAvailable: (
    runtime: Record<string, unknown>,
    projectId: string,
    action: string
  ) => void;
  ensureProjectDirectories: (
    runtime: Record<string, unknown>,
    project: Record<string, unknown>,
    requestId: string
  ) => Promise<void>;
  getActiveProject: (runtime: Record<string, unknown>) => Record<string, unknown> | null;
  getFeatureProcessDir: (
    runtime: Record<string, unknown>,
    project: Record<string, unknown>,
    featureId: string
  ) => string;
  getFeatureProcessJobAction: (featureId: string) => string;
  getFeatureProcessRecord: (
    project: Record<string, unknown>,
    featureId: string
  ) => Record<string, unknown>;
  patchActiveProject: (
    runtime: Record<string, unknown>,
    fn: (project: Record<string, unknown>) => Record<string, unknown>
  ) => Promise<void>;
  pushJobState: (api: Record<string, unknown>, state: Record<string, unknown>) => void;
  registerJob: (runtime: Record<string, unknown>, job: Record<string, unknown>) => void;
  resolveProcessRunFeatureIds: (
    project: Record<string, unknown>,
    featureId: string,
    workbenchSource?: unknown
  ) => string[];
  resolveProcessWorkbench: (
    project: Record<string, unknown>,
    featureId: string,
    workbenchSource?: unknown
  ) => Record<string, unknown>;
  resolveProcessTarget: (
    project: Record<string, unknown>,
    featureId: string
  ) => Record<string, unknown>;
  sanitizeFileSegment: (value: string, kind: string) => string;
  setFeatureProcessRecord: (
    project: Record<string, unknown>,
    featureId: string,
    record: Record<string, unknown>
  ) => void;
  setFeatureReportRecord: (
    project: Record<string, unknown>,
    featureId: string,
    report: unknown
  ) => void;
  toRecord: (value: unknown) => Record<string, unknown>;
  updateProcessRecordPercent: (record: Record<string, unknown>) => void;
  markFeatureReportStale: (
    project: Record<string, unknown>,
    featureId: string,
    reason: string
  ) => void;
  audioFeatureId: string;
  [key: string]: unknown;
}

type LaboratoryManagedProcessRunnersRuntimeDeps = Parameters<
  typeof createLaboratoryManagedProcessRunnersRuntime
>[0];

const PROCESS_CANCELLATION_STATE_KEY = "__laboratoryProcessCancellationRequests";
const PROCESS_CANCELLED_MESSAGE = "Calisma kullanici tarafindan iptal edildi.";

class LaboratoryProcessCancelledError extends Error {
  constructor() {
    super(PROCESS_CANCELLED_MESSAGE);
    this.name = "LaboratoryProcessCancelledError";
  }
}

export function createLaboratoryProcessRuntime(deps: LaboratoryProcessDeps) {
  const {
    appendProcessEvent,
    asNonEmptyString,
    buildAudioAnalysisModules,
    buildMediaProcessModules,
    cancelProcessJobsForProject,
    clearJob,
    clone,
    composeFeatureReport,
    createEmptyProcessRun,
    ensureEditToolReady,
    ensureProcessJobSlotAvailable,
    ensureProjectDirectories,
    getActiveProject,
    getFeatureProcessDir,
    getFeatureProcessJobAction,
    getFeatureProcessRecord,
    patchActiveProject,
    pushJobState,
    registerJob,
    resolveProcessRunFeatureIds,
    resolveProcessWorkbench,
    resolveProcessTarget,
    sanitizeFileSegment,
    setFeatureProcessRecord,
    setFeatureReportRecord,
    toRecord,
    updateProcessRecordPercent,
    markFeatureReportStale,
    audioFeatureId,
  } = deps;

  function shouldPersistProcessWorkbench(workbenchSource: unknown) {
    void workbenchSource;
    return true;
  }

  const managedProcessRunnersDeps = {
    asNonEmptyString: deps["asNonEmptyString"],
    buildProcessSpeechAvailability: deps["buildProcessSpeechAvailability"],
    clampProfileTranscriptSampleSeconds: deps["clampProfileTranscriptSampleSeconds"],
    clone: deps["clone"],
    createProcessArtifact: deps["createProcessArtifact"],
    createProcessFinding: deps["createProcessFinding"],
    generateProcessFramePreviewArtifact: deps["generateProcessFramePreviewArtifact"],
    generateProcessMetadataArtifact: deps["generateProcessMetadataArtifact"],
    generateProcessSpectrogram: deps["generateProcessSpectrogram"],
    generateProcessVisualTransformArtifact: deps["generateProcessVisualTransformArtifact"],
    getAudioAnalysisModuleProcessDir: deps["getAudioAnalysisModuleProcessDir"],
    getAudioAnalysisModuleRunner: deps["getAudioAnalysisModuleRunner"],
    maybeRunWhisperProfileSample: deps["maybeRunWhisperProfileSample"],
    normalizeProcessArtifact: deps["normalizeProcessArtifact"],
    normalizeProcessFinding: deps["normalizeProcessFinding"],
    partitionVisualAnalysisModuleIds: deps["partitionVisualAnalysisModuleIds"],
    resolveEnabledVisualAnalysisModuleIds: deps["resolveEnabledVisualAnalysisModuleIds"],
    runAudioStructureProbe: deps["runAudioStructureProbe"],
    runVideoStructureProbe: deps["runVideoStructureProbe"],
    sanitizeFileSegment: deps["sanitizeFileSegment"],
    toRecord: deps["toRecord"],
    updateProcessModule: deps["updateProcessModule"],
    writeJsonFile: deps["writeJsonFile"],
    writeTextFile: deps["writeTextFile"],
  };
  const laboratoryManagedProcessRunnersRuntime = createLaboratoryManagedProcessRunnersRuntime(
    managedProcessRunnersDeps as unknown as LaboratoryManagedProcessRunnersRuntimeDeps
  );

  function appendRunLifecycleEvent(
    record: Record<string, unknown>,
    action: string,
    stage: "running" | "completed" | "failed" | "cancelled",
    detail: string | null,
    options: {
      kind?: "activity" | "request-result";
      message?: string;
      severity?: "info" | "success" | "warning" | "error";
    } = {}
  ) {
    return appendProcessEvent(record, {
      kind: options.kind || "activity",
      severity:
        options.severity ||
        (stage === "completed"
          ? "success"
          : stage === "failed"
            ? "error"
            : stage === "cancelled"
              ? "warning"
              : "info"),
      message:
        options.message ||
        (stage === "completed"
          ? "Analiz tamamlandi"
          : stage === "failed"
            ? "Analiz hata verdi"
            : stage === "cancelled"
              ? "Analiz iptal edildi"
              : "Analiz basladi"),
      detail,
      action,
      stage,
      scope: "run",
    });
  }

  function getProjectId(project: Record<string, unknown>) {
    return asNonEmptyString(project["id"]) || String(project["id"] || "");
  }

  function getProcessCancellationState(runtime: Record<string, unknown>) {
    const current = runtime[PROCESS_CANCELLATION_STATE_KEY];
    if (current !== null && typeof current === "object" && Array.isArray(current) === false) {
      return current as Record<string, Record<string, unknown>>;
    }

    const nextState: Record<string, Record<string, unknown>> = {};
    runtime[PROCESS_CANCELLATION_STATE_KEY] = nextState;
    return nextState;
  }

  function getProcessCancellationKey(projectId: string, featureId: string) {
    return `${projectId}:${featureId}`;
  }

  function requestProcessCancellation(
    runtime: Record<string, unknown>,
    projectId: string,
    featureId: string,
    requestId: string
  ) {
    if (projectId === "" || featureId === "") {
      return;
    }

    getProcessCancellationState(runtime)[getProcessCancellationKey(projectId, featureId)] = {
      requestId,
      projectId,
      featureId,
      cancelledAt: new Date().toISOString(),
    };
  }

  function clearProcessCancellation(
    runtime: Record<string, unknown>,
    projectId: string,
    featureId: string
  ) {
    delete getProcessCancellationState(runtime)[getProcessCancellationKey(projectId, featureId)];
  }

  function isProcessCancellationRequested(
    runtime: Record<string, unknown>,
    projectId: string,
    featureId: string
  ) {
    return (
      getProcessCancellationState(runtime)[getProcessCancellationKey(projectId, featureId)] !==
      undefined
    );
  }

  function throwIfProcessCancellationRequested(
    runtime: Record<string, unknown>,
    projectId: string,
    featureId: string
  ) {
    if (isProcessCancellationRequested(runtime, projectId, featureId)) {
      throw new LaboratoryProcessCancelledError();
    }
  }

  function isProcessCancelledError(error: unknown) {
    return error instanceof Error && error.name === "LaboratoryProcessCancelledError";
  }

  function logCancellationWarning(api: Record<string, unknown>, error: unknown) {
    const log = api["log"];
    if (typeof log !== "function") {
      return;
    }
    const message = error instanceof Error ? error.message : String(error);
    (log as (level: string, message: string) => void)(
      "warn",
      `Laboratory process cancellation cleanup failed: ${message}`
    );
  }

  function collectCancellableProcessFeatureIds(
    project: Record<string, unknown>,
    fallbackFeatureId: string
  ) {
    const records = toRecord(toRecord(project["process"])["records"]);
    const featureIds = Object.keys(records).filter(function (recordFeatureId) {
      const status = String(toRecord(records[recordFeatureId])["status"] || "");
      return status === "running" || status === "queued";
    });
    if (fallbackFeatureId !== "" && featureIds.includes(fallbackFeatureId) !== true) {
      featureIds.push(fallbackFeatureId);
    }
    return featureIds;
  }

  function cancelProcessRecord(record: Record<string, unknown>, action: string) {
    const cancelledRecord = {
      ...record,
      status: "cancelled",
      jobId: null,
      requestId: null,
      error: null,
    };
    appendRunLifecycleEvent(cancelledRecord, action, "cancelled", PROCESS_CANCELLED_MESSAGE, {
      message: "Analiz iptal edildi",
      severity: "warning",
    });
    appendRunLifecycleEvent(cancelledRecord, action, "cancelled", PROCESS_CANCELLED_MESSAGE, {
      kind: "request-result",
      message: "Analiz istegi iptal edildi",
      severity: "warning",
    });
    return cancelledRecord;
  }

  function getProcessIntentIds(processRecord: Record<string, unknown>) {
    const scope = toRecord(processRecord["analysisScope"]);
    const intentIds = Array.isArray(scope["intentIds"]) ? (scope["intentIds"] as unknown[]) : [];
    return intentIds
      .map(function (entry) {
        return asNonEmptyString(entry);
      })
      .filter((entry): entry is string => entry !== null);
  }

  function formatProcessOutputFeatureLabel(featureId: string) {
    return featureId
      .split(/[-_]/)
      .filter(Boolean)
      .map(function (segment) {
        return segment.charAt(0).toUpperCase() + segment.slice(1);
      })
      .join(" ");
  }

  function getReportFindingCount(reportRecord: Record<string, unknown>) {
    const findings = Array.isArray(reportRecord["findings"]) ? reportRecord["findings"] : [];
    if (findings.length > 0) {
      return findings.length;
    }
    const userReport = toRecord(reportRecord["userReport"]);
    return Array.isArray(userReport["topFindings"]) ? userReport["topFindings"].length : 0;
  }

  function syncReportAssetsToProjectAssets(
    project: Record<string, unknown>,
    featureId: string,
    processRecord: Record<string, unknown>,
    reportRecord: Record<string, unknown>,
    assetsValue: unknown
  ) {
    if (asNonEmptyString(reportRecord["status"]) !== "ready") {
      return assetsValue;
    }

    const runId =
      asNonEmptyString(processRecord["runId"]) || asNonEmptyString(reportRecord["sourceRunId"]);
    const reportRunKey = runId || "latest";
    const featureLabel = formatProcessOutputFeatureLabel(featureId);
    const findingCount = getReportFindingCount(reportRecord);
    const generatedAt = asNonEmptyString(reportRecord["generatedAt"]) || new Date().toISOString();
    const intentIds = getProcessIntentIds(processRecord);
    const reportViews = [
      { view: "user", label: `${featureLabel} User Report` },
      { view: "ai", label: `${featureLabel} AI Report` },
    ];

    return reportViews.reduce<unknown>(function (assets, reportView) {
      return upsertLabAsset(
        assets,
        createLabOutputAsset(project, {
          id: `process-report-${featureId}-${reportRunKey}-${reportView.view}`,
          type: "report",
          name: reportView.label,
          runId,
          intentIds,
          metadata: {
            featureId,
            findingCount,
            format: "inline",
            generatedAt,
            reportView: reportView.view,
            sourceRunId: runId,
            status: "ready",
          },
        })
      );
    }, assetsValue);
  }

  function syncProcessOutputsToProjectAssets(
    project: Record<string, unknown>,
    featureId: string,
    processRecord: Record<string, unknown>,
    reportRecord: Record<string, unknown>
  ) {
    const processArtifacts = Array.isArray(processRecord["artifacts"])
      ? (processRecord["artifacts"] as unknown[]).map(toRecord)
      : [];
    let nextAssets: unknown = project["assets"];
    if (processArtifacts.length === 0) {
      return syncReportAssetsToProjectAssets(
        project,
        featureId,
        processRecord,
        reportRecord,
        Array.isArray(nextAssets) ? nextAssets : []
      );
    }

    const runId = asNonEmptyString(processRecord["runId"]);
    const intentIds = getProcessIntentIds(processRecord);
    nextAssets = processArtifacts.reduce<unknown>(function (assets, artifact) {
      const artifactPath = asNonEmptyString(artifact["path"]);
      if (artifactPath === null) {
        return assets;
      }

      const artifactId = asNonEmptyString(artifact["id"]);
      const artifactKind = asNonEmptyString(artifact["kind"]);
      const artifactName =
        asNonEmptyString(artifact["fileName"]) ||
        asNonEmptyString(artifact["label"]) ||
        artifactPath.split(/[\\/]/).pop() ||
        null;
      const artifactAsset = createLabOutputAsset(project, {
        type: "artifact",
        name: artifactName,
        localPath: artifactPath,
        runId,
        intentIds,
        ...(artifactId === null ? {} : { id: `process-artifact-${artifactId}` }),
        metadata: {
          ...toRecord(artifact["metadata"]),
          featureId,
          moduleId: asNonEmptyString(artifact["moduleId"]),
          kind: artifactKind,
          label: asNonEmptyString(artifact["label"]),
          processArtifactId: artifactId,
          status: asNonEmptyString(artifact["status"]) || "ready",
          variantId: asNonEmptyString(artifact["variantId"]),
        },
      });
      return upsertLabAsset(assets, artifactAsset);
    }, project["assets"]);
    return syncReportAssetsToProjectAssets(
      project,
      featureId,
      processRecord,
      reportRecord,
      nextAssets
    );
  }

  function deriveProcessEmptyReason(featureId: string, processRecord: Record<string, unknown>) {
    const semanticEventCount = Array.isArray(processRecord["events"])
      ? processRecord["events"].length
      : 0;
    const rawLogCount = Array.isArray(processRecord["rawLog"]) ? processRecord["rawLog"].length : 0;

    if (semanticEventCount === 0 && rawLogCount === 0) {
      return featureId === audioFeatureId
        ? "Ses analizi tamamlandi ancak okunabilir is izi uretilmedigi icin rapor bos kaldi."
        : "Analiz tamamlandi ancak araclardan anlamli cikti gelmedigi icin rapor bos kaldi.";
    }

    return featureId === audioFeatureId
      ? "Ses modulleri raporlanabilir bir sinyal veya artefakt uretmedi."
      : "Analiz akisi tamamlandi ancak raporlanabilir bulgu veya artefakt cikmadi.";
  }

  async function runManagedProcess(
    api: Record<string, unknown>,
    runtime: Record<string, unknown>,
    project: Record<string, unknown>,
    requestId: string,
    jobId: string,
    featureId: string,
    outputDir: string
  ) {
    const target = resolveProcessTarget(project, featureId);
    const action = getFeatureProcessJobAction(featureId);
    const projectId = getProjectId(project);
    throwIfProcessCancellationRequested(runtime, projectId, featureId);
    if (target["path"] === null) {
      throw new Error("Prepare a valid target before starting the process stage.");
    }

    const artifactBase = sanitizeFileSegment(
      `${project["slug"]}-${featureId}-${Date.now()}`,
      featureId === audioFeatureId ? "audio-process" : "media-process"
    );
    const processRecord = createEmptyProcessRun(featureId);
    processRecord["status"] = "running";
    processRecord["requestId"] = requestId;
    processRecord["jobId"] = jobId;
    processRecord["runId"] = `${featureId}-run-${Date.now()}`;
    processRecord["startedAt"] = new Date().toISOString();
    processRecord["events"] = [];
    processRecord["rawLog"] = [];
    processRecord["emptyReason"] = null;
    processRecord["liveFindings"] = [];
    processRecord["previewArtifacts"] = [];
    processRecord["moduleTrace"] = [];
    processRecord["comparisonVariants"] = [];
    processRecord["confidence"] = null;
    processRecord["targetSummary"] = {
      requestedMode: target["requestedMode"],
      mode: target["mode"],
      outputId: target["outputId"],
      signature: target["signature"],
      label: target["label"],
      fileName: target["fileName"],
      mimeType: target["mimeType"],
      path: target["path"],
      entryCount: Array.isArray(target["entries"]) ? target["entries"].length : null,
    };
    processRecord["analysisScope"] = freezeAnalysisScope(
      toRecord(toRecord(project["workbench"])["analysisScope"]),
      processRecord["runId"] as string,
      processRecord["startedAt"] as string
    );
    processRecord["analysisSettings"] = normalizeLabAnalysisSettingsMap(
      toRecord(toRecord(project["workbench"])["analysisSettings"])
    );
    processRecord["hypothesisSummary"] = asNonEmptyString(
      toRecord(toRecord(processRecord["analysisScope"]))["hypothesis"]
    );
    processRecord["modules"] =
      featureId === audioFeatureId
        ? buildAudioAnalysisModules(runtime, project, target)
        : buildMediaProcessModules(runtime, project, target);
    function appendProcessCollection(
      key: string,
      entry: Record<string, unknown>,
      limit: number,
      dedupeKey: string = "id"
    ) {
      const entries = Array.isArray(processRecord[key])
        ? (processRecord[key] as unknown[]).map(function (value) {
            return toRecord(value);
          })
        : [];
      const nextKey = asNonEmptyString(entry[dedupeKey]);
      const filteredEntries =
        nextKey === null
          ? entries
          : entries.filter(function (value) {
              return asNonEmptyString(toRecord(value)[dedupeKey]) !== nextKey;
            });
      filteredEntries.unshift(entry);
      processRecord[key] = filteredEntries.slice(0, limit);
    }

    function emitManagedRuntimeUpdate(payload: Record<string, unknown>) {
      throwIfProcessCancellationRequested(runtime, projectId, featureId);
      const kind = asNonEmptyString(payload["kind"]) || "module-progress";
      const detail = asNonEmptyString(payload["detail"]);
      if (kind === "live-finding") {
        const finding = toRecord(payload["finding"]);
        if (Object.keys(finding).length > 0) {
          appendProcessCollection(
            "liveFindings",
            {
              ...finding,
              emittedAt: Date.now(),
              windowKey: asNonEmptyString(payload["throttleWindow"]),
              streamId: featureId,
              hypothesis:
                asNonEmptyString(finding["hypothesis"]) ||
                asNonEmptyString(processRecord["hypothesisSummary"]),
            },
            80
          );
        }
      }
      if (kind === "preview-artifact") {
        const artifact = toRecord(payload["artifact"]);
        if (Object.keys(artifact).length > 0) {
          appendProcessCollection(
            "previewArtifacts",
            {
              ...artifact,
              active: artifact["active"] !== false,
              status: asNonEmptyString(artifact["status"]) || "ready",
              variantId: asNonEmptyString(toRecord(payload["comparisonVariant"])["id"]) || null,
            },
            48
          );
        }
      }
      if (kind === "module-warning" && detail !== null) {
        const warningList = Array.isArray(processRecord["warnings"])
          ? (processRecord["warnings"] as unknown[]).map(String)
          : [];
        processRecord["warnings"] = Array.from(new Set(warningList.concat(detail)));
      }
      const moduleTrace = toRecord(payload["moduleTrace"]);
      if (Object.keys(moduleTrace).length > 0) {
        appendProcessCollection("moduleTrace", moduleTrace, 120);
      }
      const comparisonVariant = toRecord(payload["comparisonVariant"]);
      if (Object.keys(comparisonVariant).length > 0) {
        appendProcessCollection("comparisonVariants", comparisonVariant, 32);
      }
      if (Array.isArray(payload["comparisonVariants"])) {
        (payload["comparisonVariants"] as unknown[]).forEach(function (entry) {
          const nextVariant = toRecord(entry);
          if (Object.keys(nextVariant).length > 0) {
            appendProcessCollection("comparisonVariants", nextVariant, 32);
          }
        });
      }
      pushJobState(api, {
        requestId: requestId,
        jobId: jobId,
        action: action,
        projectId: project["id"],
        toolId: "ffmpeg",
        featureStage: "process",
        stage: asNonEmptyString(payload["stage"]) || "running",
        ...payload,
        analysisScope: processRecord["analysisScope"],
      });
    }
    appendRunLifecycleEvent(
      processRecord,
      action,
      "running",
      typeof processRecord["targetSummary"] === "object" && processRecord["targetSummary"] !== null
        ? asNonEmptyString(toRecord(processRecord["targetSummary"])["label"])
        : null
    );
    emitManagedRuntimeUpdate({
      kind: "analysis-scope-updated",
      message: "Analysis scope locked for the current run.",
      detail: asNonEmptyString(processRecord["hypothesisSummary"]),
      analysisScope: processRecord["analysisScope"],
      moduleTrace: {
        id: `scope-${Date.now()}`,
        moduleId: null,
        stage: "process",
        status: "scope-frozen",
        timestamp: new Date().toISOString(),
        message: "Analysis scope locked for the current run.",
        detail: asNonEmptyString(processRecord["hypothesisSummary"]),
      },
      throttleWindow: `${featureId}-scope`,
    });
    const runtimeJobs = toRecord(runtime["jobs"]);
    const jobRecord = toRecord(runtimeJobs[jobId]);
    if (Object.keys(jobRecord).length > 0) {
      jobRecord["processRecordRef"] = processRecord;
    }

    const results =
      featureId === audioFeatureId
        ? await laboratoryManagedProcessRunnersRuntime.runAudioManagedProcess(
            runtime,
            project,
            requestId,
            jobId,
            target,
            artifactBase,
            processRecord,
            emitManagedRuntimeUpdate
          )
        : await laboratoryManagedProcessRunnersRuntime.runMediaManagedProcess(
            runtime,
            project,
            requestId,
            jobId,
            target,
            artifactBase,
            outputDir,
            processRecord,
            emitManagedRuntimeUpdate
          );

    throwIfProcessCancellationRequested(runtime, projectId, featureId);

    const collectedFindings = Array.isArray(results["findings"]) ? results["findings"] : [];
    const derivedFindings = extractFindings(
      (Array.isArray(processRecord["events"]) ? processRecord["events"] : []).map(function (entry) {
        return toRecord(entry);
      }) as never[]
    );
    const derivedFindingRecords = derivedFindings
      .filter(function (candidate) {
        return (
          collectedFindings.some(function (finding) {
            return toRecord(finding)["title"] === candidate.title;
          }) === false
        );
      })
      .map(function (candidate) {
        return {
          id: candidate.id,
          moduleId: candidate.moduleId,
          title: candidate.title,
          detail: candidate.detail,
          level: candidate.level,
          confidence: candidate.confidence,
          kind: candidate.kind,
          evidenceCount: candidate.evidenceCount,
          artifactIds: candidate.artifactIds,
        };
      });
    processRecord["findings"] = collectedFindings.concat(derivedFindingRecords);
    processRecord["artifacts"] = results["artifacts"];
    processRecord["warnings"] = results["warnings"];
    processRecord["status"] = "ready";
    processRecord["completedAt"] = new Date().toISOString();
    processRecord["emptyReason"] =
      Array.isArray(processRecord["findings"]) &&
      processRecord["findings"].length === 0 &&
      Array.isArray(processRecord["artifacts"]) &&
      processRecord["artifacts"].length === 0
        ? deriveProcessEmptyReason(featureId, processRecord)
        : null;
    appendRunLifecycleEvent(
      processRecord,
      action,
      "completed",
      processRecord["emptyReason"] as string | null,
      {
        message: "Analiz tamamlandi",
        severity: "success",
      }
    );
    appendRunLifecycleEvent(processRecord, action, "completed", null, {
      kind: "request-result",
      message: "Analiz istegi tamamlandi",
      severity: "success",
    });
    updateProcessRecordPercent(processRecord);
    return processRecord;
  }

  async function runSingleFeatureProcess(
    api: Record<string, unknown>,
    runtime: Record<string, unknown>,
    requestId: string,
    featureId: string,
    workbenchSource: unknown = {}
  ) {
    const project = getActiveProject(runtime);
    if (project === null) {
      throw new Error("Active project is missing.");
    }

    const workbench = resolveProcessWorkbench(project, featureId, workbenchSource);
    const persistProcessWorkbench = shouldPersistProcessWorkbench(workbenchSource);
    const projectId = getProjectId(project);

    ensureEditToolReady(runtime);
    throwIfProcessCancellationRequested(runtime, projectId, featureId);
    await ensureProjectDirectories(runtime, project, requestId);
    const action = getFeatureProcessJobAction(featureId);
    ensureProcessJobSlotAvailable(runtime, project["id"] as string, action);
    const jobId = `room-process-${featureId}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

    registerJob(runtime, {
      jobId: jobId,
      requestId: requestId,
      action: action,
      projectId: project["id"],
      toolId: "ffmpeg",
      featureStage: "process",
    });
    pushJobState(api, {
      requestId: requestId,
      jobId: jobId,
      action: action,
      projectId: project["id"],
      featureStage: "process",
      stage: "queued",
    });

    await patchActiveProject(runtime, function (nextProject: Record<string, unknown>) {
      if (persistProcessWorkbench) {
        nextProject["workbench"] = workbench;
      }
      setFeatureProcessRecord(nextProject, featureId, {
        ...createEmptyProcessRun(featureId),
        featureId: featureId,
        status: "running",
        jobId: jobId,
        requestId: requestId,
        percent: null,
      });
      markFeatureReportStale(nextProject, featureId, "A new process run is now in progress.");
      return nextProject;
    });

    try {
      const pendingFollowUp = { workbench: null as Record<string, unknown> | null };
      const nextProcessRecord = await runManagedProcess(
        api,
        runtime,
        {
          ...clone(project),
          workbench,
        },
        requestId,
        jobId,
        featureId,
        getFeatureProcessDir(runtime, project, featureId)
      );
      throwIfProcessCancellationRequested(runtime, projectId, featureId);
      await patchActiveProject(runtime, function (nextProject: Record<string, unknown>) {
        const existingRecord = toRecord(getFeatureProcessRecord(nextProject, featureId));
        if (
          isProcessCancellationRequested(runtime, projectId, featureId) ||
          String(existingRecord["status"] || "") === "cancelled"
        ) {
          return nextProject;
        }
        const queuedProcessInstance = toRecord(existingRecord["queuedProcessInstance"]);
        setFeatureProcessRecord(nextProject, featureId, {
          ...nextProcessRecord,
          queuedProcessInstance: null,
        });
        if (Object.keys(queuedProcessInstance).length > 0) {
          pendingFollowUp.workbench = {
            ...workbench,
            analysisScope: toRecord(queuedProcessInstance["analysisScope"]),
            moduleToggles: toRecord(queuedProcessInstance["moduleToggles"]),
          };
          if (persistProcessWorkbench) {
            nextProject["workbench"] = pendingFollowUp.workbench;
          }
        }
        const nextReportRecord = toRecord(composeFeatureReport(runtime, nextProject, featureId));
        setFeatureReportRecord(nextProject, featureId, nextReportRecord);
        return {
          ...nextProject,
          assets: syncProcessOutputsToProjectAssets(
            nextProject,
            featureId,
            nextProcessRecord,
            nextReportRecord
          ),
        };
      });
      const latestProject = getActiveProject(runtime);
      const latestRecord =
        latestProject === null ? {} : getFeatureProcessRecord(latestProject, featureId);
      if (
        isProcessCancellationRequested(runtime, projectId, featureId) ||
        String(latestRecord["status"] || "") === "cancelled"
      ) {
        throw new LaboratoryProcessCancelledError();
      }
      pushJobState(api, {
        requestId: requestId,
        jobId: jobId,
        action: action,
        projectId: project["id"],
        toolId: "ffmpeg",
        featureStage: "process",
        stage: "completed",
      });
      if (pendingFollowUp.workbench !== null) {
        await runSingleFeatureProcess(
          api,
          runtime,
          `${requestId}-queued-${Date.now()}`,
          featureId,
          pendingFollowUp.workbench
        );
      }
    } catch (error) {
      const currentProject = getActiveProject(runtime);
      const currentRecord =
        currentProject === null ? {} : getFeatureProcessRecord(currentProject, featureId);
      const wasCancelled =
        isProcessCancelledError(error) ||
        isProcessCancellationRequested(runtime, projectId, featureId) ||
        String(currentRecord["status"] || "") === "cancelled";
      await patchActiveProject(runtime, function (nextProject: Record<string, unknown>) {
        const existingRecord = getFeatureProcessRecord(nextProject, featureId);
        if (wasCancelled || String(existingRecord["status"] || "") === "cancelled") {
          setFeatureProcessRecord(
            nextProject,
            featureId,
            cancelProcessRecord(existingRecord, action)
          );
          return nextProject;
        }
        const failedRecord = {
          ...existingRecord,
          status: "failed",
          jobId: null,
          requestId: null,
          error: error instanceof Error ? error.message : String(error),
        };
        appendRunLifecycleEvent(
          failedRecord,
          action,
          "failed",
          error instanceof Error ? error.message : String(error),
          {
            message: "Analiz hata verdi",
            severity: "error",
          }
        );
        appendRunLifecycleEvent(
          failedRecord,
          action,
          "failed",
          error instanceof Error ? error.message : String(error),
          {
            kind: "request-result",
            message: "Analiz istegi hata verdi",
            severity: "error",
          }
        );
        setFeatureProcessRecord(nextProject, featureId, failedRecord);
        return nextProject;
      });
      pushJobState(api, {
        requestId: requestId,
        jobId: jobId,
        action: action,
        projectId: project["id"],
        featureStage: "process",
        stage: wasCancelled ? "cancelled" : "failed",
        message: wasCancelled
          ? PROCESS_CANCELLED_MESSAGE
          : error instanceof Error
            ? error.message
            : String(error),
      });
      throw wasCancelled ? new LaboratoryProcessCancelledError() : error;
    } finally {
      clearJob(runtime, jobId);
    }
  }

  async function runFeatureProcess(
    api: Record<string, unknown>,
    runtime: Record<string, unknown>,
    requestId: string,
    featureId: string,
    workbenchSource: unknown = {}
  ) {
    const project = getActiveProject(runtime);
    if (project === null) {
      throw new Error("Active project is missing.");
    }

    const workbench = resolveProcessWorkbench(project, featureId, workbenchSource);
    const runFeatureIds = resolveProcessRunFeatureIds(project, featureId, workbenchSource);
    const persistProcessWorkbench = shouldPersistProcessWorkbench(workbenchSource);
    const projectId = getProjectId(project);
    if (runFeatureIds.length === 0) {
      throw new Error("Select at least one analysis module before starting the process stage.");
    }
    runFeatureIds.forEach(function (runFeatureId) {
      clearProcessCancellation(runtime, projectId, runFeatureId);
    });

    await patchActiveProject(runtime, function (nextProject: Record<string, unknown>) {
      if (persistProcessWorkbench) {
        nextProject["workbench"] = workbench;
      }
      runFeatureIds.slice(1).forEach(function (queuedFeatureId) {
        setFeatureProcessRecord(nextProject, queuedFeatureId, {
          ...createEmptyProcessRun(queuedFeatureId),
          featureId: queuedFeatureId,
          status: "queued",
          requestId: requestId,
          percent: null,
        });
        markFeatureReportStale(
          nextProject,
          queuedFeatureId,
          "A new process run is now in progress."
        );
      });
      return nextProject;
    });

    const errors: Error[] = [];
    const cancelled = await runFeatureIds.reduce(async function (
      previousRun,
      nextFeatureId
    ): Promise<boolean> {
      const previousCancelled = await previousRun;
      if (previousCancelled || isProcessCancellationRequested(runtime, projectId, nextFeatureId)) {
        return true;
      }
      try {
        await runSingleFeatureProcess(api, runtime, requestId, nextFeatureId, workbench);
        return false;
      } catch (error) {
        if (
          isProcessCancelledError(error) ||
          isProcessCancellationRequested(runtime, projectId, nextFeatureId)
        ) {
          return true;
        }
        errors.push(
          error instanceof Error
            ? error
            : new Error(typeof error === "string" ? error : "Process run failed.")
        );
        return false;
      }
    }, Promise.resolve(false));

    if (cancelled) {
      return { cancelled: true };
    }

    if (errors.length === runFeatureIds.length) {
      const firstError = errors[0];
      throw firstError instanceof Error ? firstError : new Error("Process run failed.");
    }

    if (errors.length > 0) {
      await patchActiveProject(runtime, function (nextProject: Record<string, unknown>) {
        nextProject["process"] = {
          ...toRecord(nextProject["process"]),
          lastError: errors
            .map(function (entry) {
              return entry.message;
            })
            .join(" | "),
          lastActionAt: new Date().toISOString(),
        };
        return nextProject;
      });
    }

    return null;
  }

  async function cancelFeatureProcess(
    api: Record<string, unknown>,
    runtime: Record<string, unknown>,
    requestId: string,
    featureId: string,
    workbenchSource: unknown = {}
  ) {
    const project = getActiveProject(runtime);
    if (project === null) {
      throw new Error("Active project is missing.");
    }

    const workbench = resolveProcessWorkbench(project, featureId, workbenchSource);
    const persistProcessWorkbench = shouldPersistProcessWorkbench(workbenchSource);
    const projectId = getProjectId(project);
    const cancellableFeatureIds = collectCancellableProcessFeatureIds(
      project,
      asNonEmptyString(featureId) || ""
    );
    cancellableFeatureIds.forEach(function (cancelledFeatureId) {
      requestProcessCancellation(runtime, projectId, cancelledFeatureId, requestId);
    });
    await patchActiveProject(runtime, function (nextProject: Record<string, unknown>) {
      if (persistProcessWorkbench) {
        nextProject["workbench"] = workbench;
      }
      const records = toRecord(toRecord(nextProject["process"])["records"]);
      Object.keys(records).forEach(function (recordFeatureId) {
        const existingRecord = getFeatureProcessRecord(nextProject, recordFeatureId);
        if (!["running", "queued"].includes(String(existingRecord["status"] || ""))) {
          return;
        }
        requestProcessCancellation(runtime, projectId, recordFeatureId, requestId);
        setFeatureProcessRecord(
          nextProject,
          recordFeatureId,
          cancelProcessRecord(existingRecord, getFeatureProcessJobAction(recordFeatureId))
        );
      });
      return nextProject;
    });
    void cancelProcessJobsForProject(api, runtime, projectId, requestId).catch(function (error) {
      logCancellationWarning(api, error);
    });
    return { cancelled: true };
  }

  return {
    cancelFeatureProcess,
    runFeatureProcess,
    runManagedProcess,
    runSingleFeatureProcess,
  };
}
