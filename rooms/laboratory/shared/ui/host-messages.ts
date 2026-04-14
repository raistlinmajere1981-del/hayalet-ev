import type { createLaboratoryUiBootstrapStateRuntime } from "../../ui/bootstrap-state-runtime.js";

type LaboratoryRecord = Record<string, unknown>;
type LaboratoryUiState = ReturnType<typeof createLaboratoryUiBootstrapStateRuntime>["state"];
type LaboratoryUiContext = LaboratoryUiState["context"];
type LaboratorySourceSnapshot = LaboratoryUiState["sourceSnapshot"];

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

type LaboratoryHostMessageRuntimeDeps = {
  applyLocale: (locale: unknown) => unknown;
  applyPresentationMode: (presentation: unknown) => unknown;
  normalizeContext: (message: unknown) => LaboratoryUiContext;
  render: () => unknown;
  setLastAction: (message: string) => unknown;
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
    setLastAction,
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

  function scheduleRender() {
    if (renderTimerId !== null) {
      clearTimeout(renderTimerId);
    }
    renderTimerId = setTimeout(function () {
      renderTimerId = null;
      render();
    }, 80);
  }

  function toMessageRecord(value: unknown): LaboratoryHostMessageRecord {
    return toRecord(value);
  }

  function toPayloadRecord(value: unknown): LaboratoryHostPayloadRecord {
    return toRecord(value);
  }

  function toSourceSnapshot(value: unknown): LaboratorySourceSnapshot {
    return toRecord(value) as LaboratorySourceSnapshot;
  }

  function toString(value: unknown): string | null {
    return typeof value === "string" && value.trim() !== "" ? value.trim() : null;
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

  function shouldHideInlineActionResult(actionId: string | null, succeeded: boolean): boolean {
    if (succeeded !== true) {
      return false;
    }

    return [
      "profile-run-preflight",
      "profile-cancel-preflight",
      "process-run",
      "audio-process-run",
      "process-cancel",
      "audio-process-cancel",
    ].includes(actionId || "");
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
      scheduleRender();
      return;
    }

    if (messageType === "media-action-result" || messageType === "source-action-result") {
      if (shouldIgnoreCorrelatedPayload(payload.requestId, payload.action)) {
        return;
      }
      const actionMessage = formatActionResultMessage(payload);
      if (actionMessage !== null) {
        setLastAction(actionMessage);
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
        setLastAction(jobMessage);
      }
      scheduleRender();
    }
  }

  return {
    handleHostMessage,
  };
}
