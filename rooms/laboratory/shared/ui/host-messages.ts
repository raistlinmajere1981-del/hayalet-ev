export function createLaboratoryHostMessageRuntime(deps) {
  const state = deps.state;
  const toRecord = deps.toRecord;
  const text = deps.text;
  const render = deps.render;
  const applyPresentationMode = deps.applyPresentationMode;
  const applyLocale = deps.applyLocale;
  const normalizeContext = deps.normalizeContext;
  const shouldIgnoreCorrelatedPayload = deps.shouldIgnoreCorrelatedPayload;
  const setLastAction = deps.setLastAction;

  function handleHostMessage(message) {
    if (!message || typeof message !== "object" || Array.isArray(message)) {
      return;
    }

    const payload =
      message.payload && typeof message.payload === "object" && Array.isArray(message.payload) === false
        ? message.payload
        : message;

    if (message.type === "host-context") {
      const presentation = toRecord(payload.presentation);
      applyPresentationMode(presentation.mode);
      if (typeof payload.locale === "string") {
        applyLocale(payload.locale);
      }
      if (
        payload.translations &&
        typeof payload.translations === "object" &&
        Array.isArray(payload.translations) === false
      ) {
        state.translations = payload.translations;
      }
      state.context = normalizeContext(payload);
      render();
      return;
    }

    if (message.type === "media-state" || message.type === "source-state") {
      if (shouldIgnoreCorrelatedPayload(payload.requestId, payload.action)) {
        return;
      }
      const snapshot =
        payload.snapshot && typeof payload.snapshot === "object" && Array.isArray(payload.snapshot) === false
          ? payload.snapshot
          : {};
      if (typeof snapshot.featureId === "string" && snapshot.featureId.trim() !== "") {
        state.context = {
          ...toRecord(state.context),
          featureId: snapshot.featureId.trim(),
        };
      }
      state.sourceSnapshot = snapshot;
      render();
      return;
    }

    if (message.type === "media-action-result" || message.type === "source-action-result") {
      if (shouldIgnoreCorrelatedPayload(payload.requestId, payload.action)) {
        return;
      }
      if (payload.success === true) {
        setLastAction(text(["mediaAnalysis", "messages", payload.action]) || payload.action || "");
      } else if (typeof payload.error === "string" && payload.error.trim() !== "") {
        setLastAction(payload.error);
      }
      render();
      return;
    }

    if (message.type === "media-job" || message.type === "source-job") {
      if (shouldIgnoreCorrelatedPayload(payload.requestId, payload.action)) {
        return;
      }
      if (typeof payload.message === "string" && payload.message.trim() !== "") {
        setLastAction(payload.message);
      }
      render();
    }
  }

  return {
    handleHostMessage: handleHostMessage,
  };
}
