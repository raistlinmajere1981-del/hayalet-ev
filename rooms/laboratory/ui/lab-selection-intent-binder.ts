import type { LabSelectionIntent, LabStoreEvent } from "../models/lab-types.js";
import { bindLabDocumentEvents, isClosestCapableTarget } from "./lab-dom-events.js";

type SelectionIntentBinderDeps = {
  documentRef: Pick<Document, "addEventListener" | "removeEventListener">;
  emit: (event: LabStoreEvent) => void;
};

const LAB_SELECTION_INTENT_VALUES = new Set<LabSelectionIntent>([
  "anomaly",
  "motion",
  "audio",
  "visual",
  "general",
]);

function isSelectionIntentValue(value: string): value is Exclude<LabSelectionIntent, "unknown"> {
  return LAB_SELECTION_INTENT_VALUES.has(value as LabSelectionIntent);
}

export function bindLabSelectionIntentClicks(deps: SelectionIntentBinderDeps) {
  function handleClick(event: Event) {
    const target = event.target;
    if (!isClosestCapableTarget<{ getAttribute: (name: string) => string | null }>(target)) {
      return;
    }
    const trigger = target.closest("[data-lab-selection-intent]");
    if (!trigger || typeof trigger.getAttribute !== "function") {
      return;
    }
    const nextIntent = trigger.getAttribute("data-lab-selection-intent");
    if (typeof nextIntent !== "string" || isSelectionIntentValue(nextIntent) !== true) {
      return;
    }
    event.preventDefault();
    deps.emit({
      type: "workspace-selection-intent-updated",
      intent: nextIntent,
    });
  }

  return bindLabDocumentEvents(deps.documentRef, [{ type: "click", listener: handleClick }]);
}
