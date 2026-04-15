export function createLaboratoryHostMessageRuntime(deps) {
  const {
    applyLocale,
    applyPresentationMode,
    normalizeContext,
    render,
    setActivityStatus,
    setBlockingStatus,
    setLastAction,
    setResultStatus,
    shouldIgnoreCorrelatedPayload,
    state,
    text,
    toRecord
  } = deps;
  let renderTimerId = null;
  let bootstrapRevealTimerId = null;
  let bootstrapDismissTimerId = null;
  let bootstrapTargetState = null;
  const bootstrapRevealDelayMs = 95;
  const bootstrapReadyHoldMs = 150;
  function scheduleRender() {
    if (renderTimerId !== null) {
      clearTimeout(renderTimerId);
    }
    renderTimerId = setTimeout(function() {
      renderTimerId = null;
      render();
    }, 80);
  }
  function flushRender() {
    if (renderTimerId !== null) {
      clearTimeout(renderTimerId);
      renderTimerId = null;
    }
    render();
  }
  function toMessageRecord(value) {
    return toRecord(value);
  }
  function toPayloadRecord(value) {
    return toRecord(value);
  }
  function toBootstrapRecord(value) {
    return toRecord(value);
  }
  function toBootstrapStepRecord(value) {
    return toRecord(value);
  }
  function toSourceSnapshot(value) {
    return toRecord(value);
  }
  function toString(value) {
    return typeof value === "string" && value.trim() !== "" ? value.trim() : null;
  }
  function createBootstrapOverlayTarget(snapshot) {
    const bootstrap = toBootstrapRecord(snapshot.bootstrap);
    const steps = Array.isArray(bootstrap.steps) ? bootstrap.steps.map(function(step) {
      const record = toBootstrapStepRecord(step);
      return {
        id: toString(record.id) || "unknown",
        status: toString(record.status) || "pending",
        visible: false
      };
    }) : [];
    const totalSteps = typeof bootstrap.totalSteps === "number" && Number.isFinite(bootstrap.totalSteps) ? bootstrap.totalSteps : steps.length;
    const currentStep = typeof bootstrap.currentStep === "number" && Number.isFinite(bootstrap.currentStep) ? bootstrap.currentStep : 0;
    return {
      currentStep,
      currentStepId: toString(bootstrap.currentStepId),
      error: toString(bootstrap.error),
      message: toString(bootstrap.message),
      readyToDismiss: false,
      status: toString(bootstrap.status) || (snapshot.ready === true ? "ready" : "running"),
      steps,
      totalSteps
    };
  }
  function shouldSyncBootstrapPresentation(snapshot) {
    const bootstrap = toBootstrapRecord(snapshot.bootstrap);
    const bootstrapStatus = toString(bootstrap.status) || (snapshot.ready === true ? "ready" : "running");
    if (snapshot.ready !== true) {
      return true;
    }
    if (bootstrapStatus === "running" || bootstrapStatus === "error") {
      return true;
    }
    return state.ui.bootstrap.readyToDismiss !== true;
  }
  function getBootstrapTargetVisibleCount(target) {
    const totalSteps = Math.max(target.totalSteps, target.steps.length);
    if (target.status === "ready") {
      return totalSteps;
    }
    if (target.status === "error") {
      return Math.max(1, target.currentStep || 0);
    }
    return Math.max(0, Math.min(target.currentStep || 0, totalSteps));
  }
  function buildPresentedBootstrapSteps(target, visibleCount) {
    const clampedVisibleCount = Math.max(0, Math.min(visibleCount, target.steps.length));
    return target.steps.map(function(step, index) {
      if (index >= clampedVisibleCount) {
        return {
          id: step.id,
          status: "pending",
          visible: false
        };
      }
      if (target.status === "error" && index === clampedVisibleCount - 1) {
        return {
          id: step.id,
          status: "error",
          visible: true
        };
      }
      if (target.status === "ready" && clampedVisibleCount >= target.steps.length) {
        return {
          id: step.id,
          status: "done",
          visible: true
        };
      }
      return {
        id: step.id,
        status: index === clampedVisibleCount - 1 ? "active" : "done",
        visible: true
      };
    });
  }
  function applyBootstrapPresentation(target, visibleCount, options) {
    const totalSteps = Math.max(target.totalSteps, target.steps.length);
    const safeVisibleCount = Math.max(0, Math.min(visibleCount, totalSteps));
    const lastVisibleStep = safeVisibleCount > 0 ? target.steps[safeVisibleCount - 1] || null : null;
    state.ui.bootstrap = {
      currentStep: safeVisibleCount,
      currentStepId: lastVisibleStep ? lastVisibleStep.id : null,
      error: options?.status === "error" || target.status === "error" ? target.error : null,
      message: target.message,
      readyToDismiss: options?.readyToDismiss === true,
      status: options?.status || target.status,
      steps: buildPresentedBootstrapSteps(target, safeVisibleCount),
      totalSteps
    };
  }
  function clearBootstrapRevealTimer() {
    if (bootstrapRevealTimerId !== null) {
      clearTimeout(bootstrapRevealTimerId);
      bootstrapRevealTimerId = null;
    }
  }
  function clearBootstrapDismissTimer() {
    if (bootstrapDismissTimerId !== null) {
      clearTimeout(bootstrapDismissTimerId);
      bootstrapDismissTimerId = null;
    }
  }
  function scheduleBootstrapDismiss() {
    clearBootstrapDismissTimer();
    bootstrapDismissTimerId = setTimeout(function() {
      bootstrapDismissTimerId = null;
      if (bootstrapTargetState === null || bootstrapTargetState.status !== "ready") {
        return;
      }
      applyBootstrapPresentation(
        bootstrapTargetState,
        Math.max(bootstrapTargetState.totalSteps, bootstrapTargetState.steps.length, 0),
        {
          readyToDismiss: true,
          status: "ready"
        }
      );
      flushRender();
    }, bootstrapReadyHoldMs);
  }
  function scheduleBootstrapReveal() {
    if (bootstrapRevealTimerId !== null) {
      return;
    }
    bootstrapRevealTimerId = setTimeout(function() {
      bootstrapRevealTimerId = null;
      const target = bootstrapTargetState;
      if (target === null) {
        return;
      }
      const desiredVisibleCount = getBootstrapTargetVisibleCount(target);
      const currentVisibleCount = Math.max(0, state.ui.bootstrap.currentStep || 0);
      if (desiredVisibleCount <= currentVisibleCount) {
        if (target.status === "ready") {
          scheduleBootstrapDismiss();
        }
        return;
      }
      const nextVisibleCount = currentVisibleCount + 1;
      const nextStatus = target.status === "error" && nextVisibleCount >= desiredVisibleCount ? "error" : "running";
      applyBootstrapPresentation(target, nextVisibleCount, {
        readyToDismiss: false,
        status: nextStatus
      });
      flushRender();
      if (nextVisibleCount < desiredVisibleCount) {
        scheduleBootstrapReveal();
        return;
      }
      if (target.status === "ready") {
        scheduleBootstrapDismiss();
      }
    }, bootstrapRevealDelayMs);
  }
  function syncBootstrapPresentation(snapshot) {
    const target = createBootstrapOverlayTarget(snapshot);
    bootstrapTargetState = target;
    clearBootstrapDismissTimer();
    const desiredVisibleCount = getBootstrapTargetVisibleCount(target);
    const isFreshSequence = state.ui.bootstrap.readyToDismiss === true || state.ui.bootstrap.totalSteps === 0 || desiredVisibleCount < state.ui.bootstrap.currentStep;
    const baseVisibleCount = isFreshSequence ? 0 : Math.max(0, state.ui.bootstrap.currentStep || 0);
    const nextVisibleCount = baseVisibleCount === 0 && desiredVisibleCount > 0 ? 1 : Math.min(baseVisibleCount, desiredVisibleCount);
    const nextStatus = target.status === "error" ? "error" : target.status === "ready" && desiredVisibleCount <= nextVisibleCount ? "ready" : "running";
    applyBootstrapPresentation(target, nextVisibleCount, {
      readyToDismiss: false,
      status: nextStatus
    });
    if (target.status === "error") {
      clearBootstrapRevealTimer();
      return;
    }
    if (desiredVisibleCount > nextVisibleCount) {
      scheduleBootstrapReveal();
      return;
    }
    clearBootstrapRevealTimer();
    if (target.status === "ready") {
      scheduleBootstrapDismiss();
    }
  }
  function looksLikeVerboseToolOutput(message) {
    if (message === null) {
      return false;
    }
    return message.length > 180 || message.includes("\n") || /ffmpeg version|configuration:|libav|(^|\s)-i\s|scale=|crop=|--[a-z0-9-]+|aac\b|h264\b/i.test(
      message
    );
  }
  function getEditActionLabel(actionId) {
    switch (actionId) {
      case null:
        return text(["mediaAnalysis", "shared", "status"]);
      case "edit-preview":
        return text(["mediaAnalysis", "edit", "actions", "preview"]);
      case "edit-apply":
        return text(["mediaAnalysis", "edit", "actions", "apply"]);
      case "edit-cancel-preview":
        return text(["mediaAnalysis", "edit", "actions", "cancelPreview"]);
      case "edit-cancel-apply":
        return text(["mediaAnalysis", "edit", "actions", "cancelApply"]);
      default:
        return actionId || text(["mediaAnalysis", "shared", "status"]);
    }
  }
  function getJobStageLabel(stageId) {
    switch (stageId) {
      case null:
        return text(["mediaAnalysis", "shared", "idle"]);
      case "stdout":
      case "stderr":
        return text(["mediaAnalysis", "settings", "stages", "running"]);
      case "queued":
      case "running":
      case "completed":
      case "failed":
      case "cancelled":
        return text(["mediaAnalysis", "settings", "stages", stageId]);
      default:
        return text(["mediaAnalysis", "shared", "idle"]);
    }
  }
  function getSafeInlineMessage(message, fallback) {
    if (message === null || looksLikeVerboseToolOutput(message)) {
      return fallback;
    }
    return message;
  }
  const quietInlineResultActionIds = [
    "profile-run-preflight",
    "profile-cancel-preflight",
    "process-run",
    "audio-process-run",
    "process-cancel",
    "audio-process-cancel"
  ];
  function shouldHideInlinePreflightActionResult(actionId) {
    return actionId === "profile-run-preflight" || actionId === "profile-cancel-preflight";
  }
  function shouldHideInlineActionResult(actionId, succeeded) {
    if (succeeded !== true) {
      return false;
    }
    if (shouldHideInlinePreflightActionResult(actionId)) {
      return true;
    }
    return quietInlineResultActionIds.includes(actionId || "");
  }
  function shouldHideInlineJobProgress(actionId, stageId) {
    return ["profile-run-preflight", "process-run", "audio-process-run"].includes(actionId || "") && stageId !== "failed";
  }
  function formatActionResultMessage(payload) {
    const actionId = toString(payload.action);
    if (shouldHideInlineActionResult(actionId, payload.success === true)) {
      return "";
    }
    if (payload.success === true) {
      return text(["mediaAnalysis", "messages", actionId || ""]) || actionId;
    }
    const fallback = `${getEditActionLabel(actionId)} · ${text(["mediaAnalysis", "settings", "stages", "failed"])}`;
    return getSafeInlineMessage(toString(payload.error), fallback);
  }
  function formatJobProgressMessage(payload) {
    const actionId = toString(payload.action);
    const stageId = toString(payload["stage"]);
    if (shouldHideInlineJobProgress(actionId, stageId)) {
      return "";
    }
    const baseLabel = `${getEditActionLabel(actionId)} · ${getJobStageLabel(stageId)}`;
    return getSafeInlineMessage(toString(payload.message), baseLabel);
  }
  function getPayload(message) {
    const payload = toPayloadRecord(message.payload);
    return Object.keys(payload).length > 0 ? payload : toPayloadRecord(message);
  }
  function handleHostMessage(message) {
    const messageRecord = toMessageRecord(message);
    if (Object.keys(messageRecord).length === 0) {
      return;
    }
    const payload = getPayload(messageRecord);
    const messageType = toString(messageRecord.type) || "";
    if (messageType === "host-context") {
      applyPresentationMode(payload.presentation);
      if (typeof payload.locale === "string") {
        applyLocale(payload.locale);
      }
      if (payload.translations && typeof payload.translations === "object" && Array.isArray(payload.translations) === false) {
        state.translations = toRecord(payload.translations);
      }
      state.context = normalizeContext(payload);
      scheduleRender();
      return;
    }
    if (messageType === "media-state" || messageType === "source-state") {
      if (shouldIgnoreCorrelatedPayload(payload.requestId, payload.action)) {
        return;
      }
      const snapshot = toSourceSnapshot(payload.snapshot);
      const snapshotRecord = toRecord(snapshot);
      state.context = normalizeContext({
        ...state.context,
        featureId: toString(snapshotRecord["featureId"]) || state.context.featureId,
        workbench: toRecord(snapshotRecord["workbench"])
      });
      state.sourceSnapshot = snapshot;
      if (shouldSyncBootstrapPresentation(snapshot)) {
        syncBootstrapPresentation(snapshot);
      }
      scheduleRender();
      return;
    }
    if (messageType === "media-action-result" || messageType === "source-action-result") {
      if (shouldIgnoreCorrelatedPayload(payload.requestId, payload.action)) {
        return;
      }
      const actionMessage = formatActionResultMessage(payload);
      if (actionMessage !== null) {
        if (payload.success === true) {
          setResultStatus(actionMessage, null, "host");
        } else if (actionMessage !== "") {
          setBlockingStatus(actionMessage, toString(payload.error), "host");
        } else {
          setLastAction(actionMessage);
        }
      }
      scheduleRender();
      return;
    }
    if (messageType === "media-job" || messageType === "source-job") {
      if (shouldIgnoreCorrelatedPayload(payload.requestId, payload.action)) {
        return;
      }
      const jobMessage = formatJobProgressMessage(payload);
      if (jobMessage !== null) {
        const stageId = toString(payload["stage"]);
        const jobDetail = toString(payload.message);
        if (stageId === "failed") {
          setBlockingStatus(jobMessage, jobDetail, "host");
        } else if (stageId === "completed" || stageId === "cancelled") {
          setResultStatus(jobMessage, jobDetail, "host");
        } else if (jobMessage !== "") {
          setActivityStatus(jobMessage, jobDetail, "host");
        }
      }
      scheduleRender();
    }
  }
  return {
    handleHostMessage
  };
}
