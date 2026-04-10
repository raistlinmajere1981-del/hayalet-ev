export function createLaboratoryHostMessageRuntime(deps) {
  const {
    applyLocale,
    applyPresentationMode,
    normalizeContext,
    render,
    setLastAction,
    shouldIgnoreCorrelatedPayload,
    state,
    text,
    toRecord
  } = deps;
  function toMessageRecord(value) {
    return toRecord(value);
  }
  function toPayloadRecord(value) {
    return toRecord(value);
  }
  function toSourceSnapshot(value) {
    return toRecord(value);
  }
  function toString(value) {
    return typeof value === "string" && value.trim() !== "" ? value.trim() : null;
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
      render();
      return;
    }
    if (messageType === "media-state" || messageType === "source-state") {
      if (shouldIgnoreCorrelatedPayload(payload.requestId, payload.action)) {
        return;
      }
      const snapshot = toSourceSnapshot(payload.snapshot);
      const featureId = toString(toRecord(snapshot)["featureId"]);
      if (featureId !== null) {
        state.context = {
          ...state.context,
          featureId
        };
      }
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
    handleHostMessage
  };
}
