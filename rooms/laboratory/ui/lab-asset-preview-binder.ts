import { asNonEmptyString } from "../models/lab-types.js";
import type { LabStoreEvent } from "../models/lab-types.js";

type AssetPreviewBinderDeps = {
  documentRef: Pick<Document, "addEventListener" | "removeEventListener">;
  emit: (event: LabStoreEvent) => void;
  resolveHref: (assetId: string) => string | null;
};

type ClosestCapableTarget = EventTarget & {
  closest: (selector: string) => {
    getAttribute: (name: string) => string | null;
  } | null;
};

function isClosestCapableTarget(value: EventTarget | null): value is ClosestCapableTarget {
  return typeof value === "object" && value !== null && "closest" in value;
}

function preventAction(event: Event) {
  if (typeof event.preventDefault === "function") {
    event.preventDefault();
  }
  if (typeof event.stopImmediatePropagation === "function") {
    event.stopImmediatePropagation();
    return;
  }
  if (typeof event.stopPropagation === "function") {
    event.stopPropagation();
  }
}

function emitPreviewWarning(deps: AssetPreviewBinderDeps, message: string) {
  deps.emit({
    type: "push-event",
    event: {
      id: `ui-asset-preview-${Date.now()}`,
      kind: "activity",
      severity: "warning",
      message,
      detail: null,
      timestamp: Date.now(),
      source: "ui",
      action: "asset-preview",
      stage: null,
      scope: "global",
      moduleId: null,
      rawLine: null,
    },
  });
}

export function bindLabAssetPreviewClicks(deps: AssetPreviewBinderDeps) {
  function handleClick(event: Event) {
    const target = event.target;
    if (!isClosestCapableTarget(target)) {
      return;
    }
    const trigger = target.closest("[data-lab-action='asset-preview']");
    if (trigger === null || typeof trigger.getAttribute !== "function") {
      return;
    }
    const assetId = asNonEmptyString(trigger.getAttribute("data-lab-value"));
    if (assetId === null) {
      return;
    }
    preventAction(event);
    if (deps.resolveHref(assetId) === null) {
      emitPreviewWarning(deps, "Asset preview is unavailable.");
      return;
    }
    deps.emit({ type: "asset-preview-opened", assetId });
  }

  deps.documentRef.addEventListener("click", handleClick);

  return function unbind() {
    deps.documentRef.removeEventListener("click", handleClick);
  };
}
