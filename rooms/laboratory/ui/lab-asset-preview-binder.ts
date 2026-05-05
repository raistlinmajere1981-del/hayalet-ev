import { asNonEmptyString } from "../models/lab-types.js";
import type { LabStoreEvent } from "../models/lab-types.js";
import {
  bindLabDocumentEvents,
  consumeLabEvent,
  isClosestCapableTarget,
} from "./lab-dom-events.js";

type AssetPreviewBinderDeps = {
  documentRef: Pick<Document, "addEventListener" | "removeEventListener">;
  emit: (event: LabStoreEvent) => void;
  resolveHref: (assetId: string) => string | null;
};

type AssetPreviewTrigger = {
  getAttribute: (name: string) => string | null;
};

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
    if (!isClosestCapableTarget<AssetPreviewTrigger>(target)) {
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
    consumeLabEvent(event);
    if (deps.resolveHref(assetId) === null) {
      emitPreviewWarning(deps, "Asset preview is unavailable.");
      return;
    }
    deps.emit({ type: "asset-preview-opened", assetId });
  }

  return bindLabDocumentEvents(deps.documentRef, [{ type: "click", listener: handleClick }]);
}
