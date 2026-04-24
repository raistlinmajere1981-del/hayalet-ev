const LAB_SELECTION_INTENT_VALUES = /* @__PURE__ */ new Set([
  "anomaly",
  "motion",
  "audio",
  "visual",
  "general"
]);
function isSelectionIntentValue(value) {
  return LAB_SELECTION_INTENT_VALUES.has(value);
}
function isClosestCapableTarget(value) {
  return typeof value === "object" && value !== null && "closest" in value;
}
export function bindLabSelectionIntentClicks(deps) {
  function handleClick(event) {
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
      intent: nextIntent
    });
  }
  deps.documentRef.addEventListener("click", handleClick);
  return function unbind() {
    deps.documentRef.removeEventListener("click", handleClick);
  };
}
