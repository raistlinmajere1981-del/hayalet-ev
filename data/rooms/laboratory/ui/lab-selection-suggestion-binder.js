function isClosestCapableTarget(value) {
  return typeof value === "object" && value !== null && "closest" in value;
}
function isTargetInsideSelectionPanel(target) {
  if (!isClosestCapableTarget(target)) {
    return false;
  }
  const panel = target.closest("[data-lab-selection-panel]");
  return panel !== null;
}
export function bindLabSelectionSuggestionClicks(deps) {
  function handleClick(event) {
    const target = event.target;
    if (isClosestCapableTarget(target)) {
      const executionCommitmentSetTrigger = target.closest("[data-lab-execution-commitment-set]");
      if (executionCommitmentSetTrigger && typeof executionCommitmentSetTrigger.getAttribute === "function") {
        const planId = executionCommitmentSetTrigger.getAttribute(
          "data-lab-execution-commitment-set"
        );
        if (typeof planId !== "string" || planId.trim() === "") {
          return;
        }
        event.preventDefault();
        deps.emit({
          type: "workspace-execution-commitment-set",
          planId: planId.trim()
        });
        return;
      }
      const executionCommitmentRevokeTrigger = target.closest(
        "[data-lab-execution-commitment-revoke]"
      );
      if (executionCommitmentRevokeTrigger !== null) {
        event.preventDefault();
        deps.emit({
          type: "workspace-execution-commitment-revoked"
        });
        return;
      }
      const executionIntentAcceptTrigger = target.closest("[data-lab-execution-intent-accept]");
      if (executionIntentAcceptTrigger && typeof executionIntentAcceptTrigger.getAttribute === "function") {
        const suggestionId = executionIntentAcceptTrigger.getAttribute(
          "data-lab-execution-intent-accept"
        );
        if (typeof suggestionId !== "string" || suggestionId.trim() === "") {
          return;
        }
        const normalizedSuggestionId = suggestionId.trim();
        if (deps.getActivePreviewSuggestionId() !== normalizedSuggestionId) {
          return;
        }
        event.preventDefault();
        deps.emit({
          type: "workspace-selection-suggestion-accepted",
          suggestionId: normalizedSuggestionId
        });
        return;
      }
      const executionIntentDismissTrigger = target.closest("[data-lab-execution-intent-dismiss]");
      if (executionIntentDismissTrigger && typeof executionIntentDismissTrigger.getAttribute === "function") {
        const suggestionId = executionIntentDismissTrigger.getAttribute(
          "data-lab-execution-intent-dismiss"
        );
        if (typeof suggestionId !== "string" || suggestionId.trim() === "") {
          return;
        }
        const normalizedSuggestionId = suggestionId.trim();
        if (deps.getActivePreviewSuggestionId() !== normalizedSuggestionId) {
          return;
        }
        event.preventDefault();
        deps.emit({
          type: "workspace-selection-suggestion-dismissed",
          suggestionId: normalizedSuggestionId
        });
        return;
      }
      const executionIntentQueueTrigger = target.closest("[data-lab-execution-intent-queue]");
      if (executionIntentQueueTrigger && typeof executionIntentQueueTrigger.getAttribute === "function") {
        const suggestionId = executionIntentQueueTrigger.getAttribute(
          "data-lab-execution-intent-queue"
        );
        if (typeof suggestionId !== "string" || suggestionId.trim() === "") {
          return;
        }
        const normalizedSuggestionId = suggestionId.trim();
        if (deps.getActivePreviewSuggestionId() !== normalizedSuggestionId) {
          return;
        }
        event.preventDefault();
        deps.emit({
          type: "workspace-selection-suggestion-queued",
          suggestionId: normalizedSuggestionId
        });
        return;
      }
      const executionIntentClearTrigger = target.closest("[data-lab-execution-intent-clear]");
      if (executionIntentClearTrigger !== null) {
        event.preventDefault();
        deps.emit({
          type: "workspace-execution-intent-cleared"
        });
        return;
      }
      const trigger = target.closest("[data-lab-selection-suggestion]");
      if (trigger && typeof trigger.getAttribute === "function") {
        const suggestionId = trigger.getAttribute("data-lab-selection-suggestion");
        if (typeof suggestionId !== "string" || suggestionId.trim() === "") {
          return;
        }
        const normalizedSuggestionId = suggestionId.trim();
        event.preventDefault();
        deps.emit({
          type: "workspace-selection-suggestion-clicked",
          suggestionId: normalizedSuggestionId
        });
        if (!deps.canPreviewSuggestion(normalizedSuggestionId)) {
          return;
        }
        deps.emit({
          type: "workspace-selection-suggestion-preview-set",
          suggestionId: normalizedSuggestionId
        });
        return;
      }
    }
    if (deps.getActivePreviewSuggestionId() === null || isTargetInsideSelectionPanel(target)) {
      return;
    }
    deps.emit({
      type: "workspace-selection-suggestion-preview-cleared"
    });
  }
  function handleKeydown(event) {
    if (deps.getActivePreviewSuggestionId() === null) {
      return;
    }
    const keyboardEvent = event;
    if (keyboardEvent.key !== "Escape") {
      return;
    }
    event.preventDefault();
    deps.emit({
      type: "workspace-selection-suggestion-preview-cleared"
    });
  }
  deps.documentRef.addEventListener("click", handleClick);
  deps.documentRef.addEventListener("keydown", handleKeydown);
  return function unbind() {
    deps.documentRef.removeEventListener("click", handleClick);
    deps.documentRef.removeEventListener("keydown", handleKeydown);
  };
}
