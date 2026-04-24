import type { LabStoreEvent } from "../models/lab-types.js";

type SelectionSuggestionBinderDeps = {
  canPreviewSuggestion: (suggestionId: string) => boolean;
  documentRef: Pick<Document, "addEventListener" | "removeEventListener">;
  emit: (event: LabStoreEvent) => void;
  hasActivePreview: () => boolean;
};

function isClosestCapableTarget(value: EventTarget | null): value is EventTarget & {
  closest: (selector: string) => { getAttribute: (name: string) => string | null } | null;
} {
  return typeof value === "object" && value !== null && "closest" in value;
}

function isTargetInsideSelectionPanel(target: EventTarget | null) {
  if (!isClosestCapableTarget(target)) {
    return false;
  }
  const panel = target.closest("[data-lab-selection-panel]");
  return panel !== null;
}

export function bindLabSelectionSuggestionClicks(deps: SelectionSuggestionBinderDeps) {
  function handleClick(event: Event) {
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
          suggestionId: normalizedSuggestionId,
        });
        if (!deps.canPreviewSuggestion(normalizedSuggestionId)) {
          return;
        }
        deps.emit({
          type: "workspace-selection-suggestion-preview-set",
          suggestionId: normalizedSuggestionId,
        });
        return;
      }
    }

    if (!deps.hasActivePreview() || isTargetInsideSelectionPanel(target)) {
      return;
    }
    deps.emit({
      type: "workspace-selection-suggestion-preview-cleared",
    });
  }

  function handleKeydown(event: Event) {
    if (!deps.hasActivePreview()) {
      return;
    }
    const keyboardEvent = event as Event & { key?: string };
    if (keyboardEvent.key !== "Escape") {
      return;
    }
    event.preventDefault();
    deps.emit({
      type: "workspace-selection-suggestion-preview-cleared",
    });
  }

  deps.documentRef.addEventListener("click", handleClick);
  deps.documentRef.addEventListener("keydown", handleKeydown);

  return function unbind() {
    deps.documentRef.removeEventListener("click", handleClick);
    deps.documentRef.removeEventListener("keydown", handleKeydown);
  };
}
