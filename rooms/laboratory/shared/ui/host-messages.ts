import type { createLaboratoryUiBootstrapStateRuntime } from "../../ui/bootstrap-state-runtime.js";

type LaboratoryRecord = Record<string, unknown>;
type LaboratoryUiState = ReturnType<typeof createLaboratoryUiBootstrapStateRuntime>["state"];
type LaboratoryUiContext = LaboratoryUiState["context"];
type LaboratorySourceSnapshot = LaboratoryUiState["sourceSnapshot"];
type LaboratoryUiBootstrapOverlayState = LaboratoryUiState["ui"]["bootstrap"];
type LaboratoryUiBootstrapOverlayStep = LaboratoryUiBootstrapOverlayState["steps"][number];

type LaboratoryHostMessageRecord = LaboratoryRecord & {
  payload?: unknown;
  type?: unknown;
};

type LaboratoryHostPayloadRecord = LaboratoryRecord & {
  action?: unknown;
  error?: unknown;
  locale?: unknown;
  message?: unknown;
  presentation?: unknown;
  requestId?: unknown;
  snapshot?: unknown;
  success?: unknown;
  translations?: unknown;
};

type LaboratoryBootstrapSnapshotRecord = LaboratoryRecord & {
  currentStep?: unknown;
  currentStepId?: unknown;
  error?: unknown;
  message?: unknown;
  status?: unknown;
  steps?: unknown;
  totalSteps?: unknown;
};

type LaboratoryBootstrapSnapshotStepRecord = LaboratoryRecord & {
  id?: unknown;
  status?: unknown;
};

type LaboratoryHostMessageRuntimeDeps = {
  applyLocale: (locale: unknown) => unknown;
  applyPresentationMode: (presentation: unknown) => unknown;
  normalizeContext: (message: unknown) => LaboratoryUiContext;
  render: () => unknown;
  setActivityStatus: (
    message: string,
    detail?: string | null,
    source?: "host" | "request" | "system" | "ui"
  ) => unknown;
  setBlockingStatus: (
    message: string,
    detail?: string | null,
    source?: "host" | "request" | "system" | "ui"
  ) => unknown;
  setLastAction: (message: string) => unknown;
  setResultStatus: (
    message: string,
    detail?: string | null,
    source?: "host" | "request" | "system" | "ui"
  ) => unknown;
  shouldIgnoreCorrelatedPayload: (requestId: unknown, action: unknown) => boolean;
  state: LaboratoryUiState;
  text: (path: string[]) => string;
  toRecord: (value: unknown) => LaboratoryRecord;
};

export function createLaboratoryHostMessageRuntime(deps: LaboratoryHostMessageRuntimeDeps) {
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
    toRecord,
  } = deps;

  // AI: Coalesce rapid-fire host notifications into a single render.
  // Host sends media-state + source-state + media-action-result +
  // source-action-result for every action; without debounce each
  // triggers a full innerHTML rebuild causing visible button flicker.
  // IPC messages arrive in separate event-loop turns (~30ms apart)
  // so microtask batching is insufficient — trailing setTimeout
  // debounce is required.
  let renderTimerId: ReturnType<typeof setTimeout> | null = null;
  let bootstrapRevealTimerId: ReturnType<typeof setTimeout> | null = null;
  let bootstrapDismissTimerId: ReturnType<typeof setTimeout> | null = null;
  let bootstrapTargetState: LaboratoryUiBootstrapOverlayState | null = null;
  const bootstrapRevealDelayMs = 95;
  const bootstrapReadyHoldMs = 150;

  function scheduleRender() {
    if (renderTimerId !== null) {
      clearTimeout(renderTimerId);
    }
    renderTimerId = setTimeout(function () {
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

  function toMessageRecord(value: unknown): LaboratoryHostMessageRecord {
    return toRecord(value);
  }

  function toPayloadRecord(value: unknown): LaboratoryHostPayloadRecord {
    return toRecord(value);
  }

  function toBootstrapRecord(value: unknown): LaboratoryBootstrapSnapshotRecord {
    return toRecord(value) as LaboratoryBootstrapSnapshotRecord;
  }

  function toBootstrapStepRecord(value: unknown): LaboratoryBootstrapSnapshotStepRecord {
    return toRecord(value) as LaboratoryBootstrapSnapshotStepRecord;
  }

  function toSourceSnapshot(value: unknown): LaboratorySourceSnapshot {
    return toRecord(value) as LaboratorySourceSnapshot;
  }

  function toString(value: unknown): string | null {
    return typeof value === "string" && value.trim() !== "" ? value.trim() : null;
  }

  function createBootstrapOverlayTarget(
    snapshot: LaboratorySourceSnapshot
  ): LaboratoryUiBootstrapOverlayState {
    const bootstrap = toBootstrapRecord(snapshot.bootstrap);
    const steps = Array.isArray(bootstrap.steps)
      ? bootstrap.steps.map(function (step): LaboratoryUiBootstrapOverlayStep {
          const record = toBootstrapStepRecord(step);
          return {
            id: toString(record.id) || "unknown",
            status: toString(record.status) || "pending",
            visible: false,
          };
        })
      : [];
    const totalSteps =
      typeof bootstrap.totalSteps === "number" && Number.isFinite(bootstrap.totalSteps)
        ? bootstrap.totalSteps
        : steps.length;
    const currentStep =
      typeof bootstrap.currentStep === "number" && Number.isFinite(bootstrap.currentStep)
        ? bootstrap.currentStep
        : 0;

    return {
      currentStep,
      currentStepId: toString(bootstrap.currentStepId),
      error: toString(bootstrap.error),
      message: toString(bootstrap.message),
      readyToDismiss: false,
      status: toString(bootstrap.status) || (snapshot.ready === true ? "ready" : "running"),
      steps,
      totalSteps,
    };
  }

  function shouldSyncBootstrapPresentation(snapshot: LaboratorySourceSnapshot): boolean {
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

  function getBootstrapTargetVisibleCount(target: LaboratoryUiBootstrapOverlayState): number {
    const totalSteps = Math.max(target.totalSteps, target.steps.length);
    if (target.status === "ready") {
      return totalSteps;
    }
    if (target.status === "error") {
      return Math.max(1, target.currentStep || 0);
    }
    return Math.max(0, Math.min(target.currentStep || 0, totalSteps));
  }

  function buildPresentedBootstrapSteps(
    target: LaboratoryUiBootstrapOverlayState,
    visibleCount: number
  ): LaboratoryUiBootstrapOverlayStep[] {
    const clampedVisibleCount = Math.max(0, Math.min(visibleCount, target.steps.length));
    return target.steps.map(function (step, index): LaboratoryUiBootstrapOverlayStep {
      if (index >= clampedVisibleCount) {
        return {
          id: step.id,
          status: "pending",
          visible: false,
        };
      }

      if (target.status === "error" && index === clampedVisibleCount - 1) {
        return {
          id: step.id,
          status: "error",
          visible: true,
        };
      }

      if (target.status === "ready" && clampedVisibleCount >= target.steps.length) {
        return {
          id: step.id,
          status: "done",
          visible: true,
        };
      }

      return {
        id: step.id,
        status: index === clampedVisibleCount - 1 ? "active" : "done",
        visible: true,
      };
    });
  }

  function applyBootstrapPresentation(
    target: LaboratoryUiBootstrapOverlayState,
    visibleCount: number,
    options?: {
      readyToDismiss?: boolean;
      status?: string;
    }
  ) {
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
      totalSteps,
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
    bootstrapDismissTimerId = setTimeout(function () {
      bootstrapDismissTimerId = null;
      if (bootstrapTargetState === null || bootstrapTargetState.status !== "ready") {
        return;
      }
      applyBootstrapPresentation(
        bootstrapTargetState,
        Math.max(bootstrapTargetState.totalSteps, bootstrapTargetState.steps.length, 0),
        {
          readyToDismiss: true,
          status: "ready",
        }
      );
      flushRender();
    }, bootstrapReadyHoldMs);
  }

  function scheduleBootstrapReveal() {
    if (bootstrapRevealTimerId !== null) {
      return;
    }
    bootstrapRevealTimerId = setTimeout(function () {
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
      const nextStatus =
        target.status === "error" && nextVisibleCount >= desiredVisibleCount ? "error" : "running";
      applyBootstrapPresentation(target, nextVisibleCount, {
        readyToDismiss: false,
        status: nextStatus,
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

  function syncBootstrapPresentation(snapshot: LaboratorySourceSnapshot) {
    const target = createBootstrapOverlayTarget(snapshot);
    bootstrapTargetState = target;

    clearBootstrapDismissTimer();

    const desiredVisibleCount = getBootstrapTargetVisibleCount(target);
    const isFreshSequence =
      state.ui.bootstrap.readyToDismiss === true ||
      state.ui.bootstrap.totalSteps === 0 ||
      desiredVisibleCount < state.ui.bootstrap.currentStep;
    const baseVisibleCount = isFreshSequence ? 0 : Math.max(0, state.ui.bootstrap.currentStep || 0);
    const nextVisibleCount =
      baseVisibleCount === 0 && desiredVisibleCount > 0 ? 1 : Math.min(baseVisibleCount, desiredVisibleCount);
    const nextStatus =
      target.status === "error"
        ? "error"
        : target.status === "ready" && desiredVisibleCount <= nextVisibleCount
          ? "ready"
          : "running";

    applyBootstrapPresentation(target, nextVisibleCount, {
      readyToDismiss: false,
      status: nextStatus,
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

  function looksLikeVerboseToolOutput(message: string | null): boolean {
    if (message === null) {
      return false;
    }

    return (
      message.length > 180 ||
      message.includes("\n") ||
      /ffmpeg version|configuration:|libav|(^|\s)-i\s|scale=|crop=|--[a-z0-9-]+|aac\b|h264\b/i.test(
        message
      )
    );
  }

  function getEditActionLabel(actionId: string | null): string {
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

  function getJobStageLabel(stageId: string | null): string {
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

  function getSafeInlineMessage(message: string | null, fallback: string): string {
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
    "audio-process-cancel",
  ];

  function shouldHideInlinePreflightActionResult(actionId: string | null): boolean {
    return actionId === "profile-run-preflight" || actionId === "profile-cancel-preflight";
  }

  function shouldHideInlineActionResult(actionId: string | null, succeeded: boolean): boolean {
    if (succeeded !== true) {
      return false;
    }

    if (shouldHideInlinePreflightActionResult(actionId)) {
      return true;
    }

    return quietInlineResultActionIds.includes(actionId || "");
  }

  function shouldHideInlineJobProgress(actionId: string | null, stageId: string | null): boolean {
    return (
      ["profile-run-preflight", "process-run", "audio-process-run"].includes(actionId || "") &&
      stageId !== "failed"
    );
  }

  function formatActionResultMessage(payload: LaboratoryHostPayloadRecord): string | null {
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

  function formatJobProgressMessage(payload: LaboratoryHostPayloadRecord): string | null {
    const actionId = toString(payload.action);
    const stageId = toString(payload["stage"]);
    if (shouldHideInlineJobProgress(actionId, stageId)) {
      return "";
    }
    const baseLabel = `${getEditActionLabel(actionId)} · ${getJobStageLabel(stageId)}`;
    return getSafeInlineMessage(toString(payload.message), baseLabel);
  }

  function getPayload(message: LaboratoryHostMessageRecord): LaboratoryHostPayloadRecord {
    const payload = toPayloadRecord(message.payload);
    return Object.keys(payload).length > 0 ? payload : toPayloadRecord(message);
  }

  function handleHostMessage(message: unknown) {
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
      if (
        payload.translations &&
        typeof payload.translations === "object" &&
        Array.isArray(payload.translations) === false
      ) {
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
        workbench: toRecord(snapshotRecord["workbench"]),
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
    handleHostMessage,
  };
}
