import { parseProcessOutput } from "../../services/process-output-parser.js";
export function createLaboratoryRoomToolsProgressRuntime(deps) {
  const roomId = deps.roomId;
  const asNonEmptyString = deps.asNonEmptyString;
  const emitEvent = deps.emitEvent;
  const toRecord = deps.toRecord;
  const getElectronApi = deps.getElectronApi;
  const pushJobState = deps.pushJobState;
  const pushSourceState = deps.pushSourceState;
  function resolveEventScope(job) {
    return String(job.action || "").includes("process") ? "run" : "global";
  }
  function trimFeed(entries, limit) {
    return entries.slice(Math.max(0, entries.length - limit));
  }
  function appendProcessFeed(job, key, entry) {
    const processRecord = toRecord(job["processRecordRef"]);
    if (Object.keys(processRecord).length === 0) {
      return;
    }
    const entries = Array.isArray(processRecord[key]) ? processRecord[key].map(toRecord) : [];
    entries.push(entry);
    processRecord[key] = trimFeed(entries, 260);
  }
  function flushBufferedToolLines(api, job, stage, chunk) {
    const buffered = `${job.streamBuffer || ""}${chunk}`.replace(/\r\n/g, "\n");
    const parts = buffered.split("\n");
    job.streamBuffer = parts.pop() || "";
    const scope = resolveEventScope(job);
    parts.map(function(entry) {
      return entry.trim();
    }).filter(Boolean).forEach(function(line) {
      const rawEvent = {
        kind: "raw-log",
        severity: stage === "stderr" ? "warning" : "info",
        message: line,
        detail: null,
        action: job.action,
        stage,
        scope,
        moduleId: asNonEmptyString(job["moduleId"]),
        rawLine: line
      };
      appendProcessFeed(job, "rawLog", rawEvent);
      emitEvent(api, rawEvent);
      const parsedEvent = parseProcessOutput(line, {
        action: job.action,
        moduleId: asNonEmptyString(job["moduleId"]),
        scope,
        stream: stage
      });
      if (parsedEvent) {
        appendProcessFeed(job, "events", {
          ...parsedEvent
        });
        emitEvent(api, {
          ...parsedEvent
        });
      }
    });
  }
  function updateJobFromProgress(runtime, eventPayload) {
    const jobId = asNonEmptyString(eventPayload.jobId);
    if (!jobId || !runtime.jobs[jobId]) {
      return null;
    }
    const job = runtime.jobs[jobId];
    job.stage = asNonEmptyString(eventPayload.stage) || job.stage;
    job.operation = asNonEmptyString(eventPayload.operation) || job.operation;
    if (typeof eventPayload.bytesReceived === "number") {
      job.bytesReceived = eventPayload.bytesReceived;
    }
    if (typeof eventPayload.bytesTotal === "number") {
      job.bytesTotal = eventPayload.bytesTotal;
    }
    if (typeof eventPayload.percent === "number") {
      job.percent = eventPayload.percent;
    } else if (typeof eventPayload.bytesReceived === "number" && typeof eventPayload.bytesTotal === "number" && eventPayload.bytesTotal > 0) {
      job.percent = Math.round(eventPayload.bytesReceived / eventPayload.bytesTotal * 100);
    }
    job.message = asNonEmptyString(eventPayload.message) || job.message;
    if (asNonEmptyString(eventPayload.operation) === "tool-run" && (eventPayload.stage === "stdout" || eventPayload.stage === "stderr")) {
      const chunk = asNonEmptyString(eventPayload.chunk);
      if (chunk) {
        const match = chunk.match(/(\d{1,3}(?:\.\d+)?)%/);
        if (match) {
          job.percent = Number(match[1]);
        }
      }
    }
    return {
      requestId: job.requestId,
      jobId,
      action: job.action,
      projectId: job.projectId,
      toolId: job.toolId,
      featureStage: job.featureStage || null,
      operation: job.operation || null,
      stage: job.stage,
      percent: job.percent,
      bytesReceived: job.bytesReceived,
      bytesTotal: job.bytesTotal,
      message: job.message,
      suppressCanonicalEvent: asNonEmptyString(eventPayload.operation) === "tool-run" && (eventPayload.stage === "stdout" || eventPayload.stage === "stderr")
    };
  }
  function ensureRoomToolsSubscription(api, runtime) {
    const electronApi = getElectronApi();
    if (runtime.roomToolsSubscribed === true || electronApi === null || typeof electronApi.onRoomToolsProgress !== "function") {
      return;
    }
    runtime.roomToolsProgressHandler = function(eventPayload) {
      const payload = toRecord(eventPayload);
      if (!eventPayload || payload.roomId !== roomId) {
        return;
      }
      const nextJobPayload = updateJobFromProgress(runtime, payload);
      if (!nextJobPayload) {
        return;
      }
      if (asNonEmptyString(payload.operation) === "tool-run" && (payload.stage === "stdout" || payload.stage === "stderr")) {
        const streamStage = payload.stage;
        const job = runtime.jobs[nextJobPayload.jobId];
        const chunk = asNonEmptyString(payload.chunk);
        if (job && chunk) {
          flushBufferedToolLines(api, job, streamStage, chunk);
        }
      }
      pushJobState(api, nextJobPayload);
      pushSourceState(api, runtime, nextJobPayload.requestId, nextJobPayload.action);
    };
    electronApi.onRoomToolsProgress(runtime.roomToolsProgressHandler);
    runtime.roomToolsSubscribed = true;
  }
  function tearDownRoomToolsSubscription(runtime) {
    const electronApi = getElectronApi();
    if (runtime.roomToolsSubscribed !== true || electronApi === null || typeof electronApi.offRoomToolsProgress !== "function" || typeof runtime.roomToolsProgressHandler !== "function") {
      return;
    }
    electronApi.offRoomToolsProgress(runtime.roomToolsProgressHandler);
    runtime.roomToolsProgressHandler = null;
    runtime.roomToolsSubscribed = false;
  }
  return {
    ensureRoomToolsSubscription,
    tearDownRoomToolsSubscription,
    updateJobFromProgress
  };
}
