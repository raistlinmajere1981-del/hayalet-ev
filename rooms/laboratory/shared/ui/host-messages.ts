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
      render();
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
      render();
      return;
    }

    if (messageType === "media-action-result" || messageType === "source-action-result") {
      if (shouldIgnoreCorrelatedPayload(payload.requestId, payload.action)) {
        return;
      }
      if (payload.success === true) {
        const actionId = toString(payload.action) || "";
        setLastAction(text(["mediaAnalysis", "messages", actionId]) || actionId);
      } else {
        const errorMessage = toString(payload.error);
        if (errorMessage !== null) {
          setLastAction(errorMessage);
        }
      }
      render();
      return;
    }

    if (messageType === "media-job" || messageType === "source-job") {
      if (shouldIgnoreCorrelatedPayload(payload.requestId, payload.action)) {
        return;
      }
      const jobMessage = toString(payload.message);
      if (jobMessage !== null) {
        setLastAction(jobMessage);
      }
      render();
    }
  }

  return {
    handleHostMessage,
  };
}
