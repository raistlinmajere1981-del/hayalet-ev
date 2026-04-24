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
    if (!deps.hasActivePreview() || isTargetInsideSelectionPanel(target)) {
      return;
    }
    deps.emit({
      type: "workspace-selection-suggestion-preview-cleared"
    });
  }
  function handleKeydown(event) {
    if (!deps.hasActivePreview()) {
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
