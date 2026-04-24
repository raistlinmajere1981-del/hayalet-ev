import type { LabSelectionIntent, LabStoreEvent } from "../models/lab-types.js";

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

function isClosestCapableTarget(
  value: EventTarget | null
): value is EventTarget & {
  closest: (selector: string) => { getAttribute: (name: string) => string | null } | null;
} {
  return typeof value === "object" && value !== null && "closest" in value;
}

export function bindLabSelectionIntentClicks(deps: SelectionIntentBinderDeps) {
  function handleClick(event: Event) {
    const target = event.target;
    if (!isClosestCapableTarget(target)) {
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

  deps.documentRef.addEventListener("click", handleClick);

  return function unbind() {
    deps.documentRef.removeEventListener("click", handleClick);
  };
}
