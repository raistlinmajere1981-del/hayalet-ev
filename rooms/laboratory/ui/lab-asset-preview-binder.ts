import { asNonEmptyString } from "../models/lab-types.js";
import type { LabStoreEvent } from "../models/lab-types.js";

type AssetPreviewBinderDeps = {
  documentRef: Pick<Document, "addEventListener" | "removeEventListener">;
  emit: (event: LabStoreEvent) => void;
  resolveHref: (assetId: string) => string | null;
  windowRef: Pick<Window, "open"> & {
    electronAPI?: {
      openPath?: (path: string) => Promise<{
        error?: string;
        message?: string;
        success?: boolean;
      }>;
    };
  };
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

async function openAssetPreviewTarget(deps: AssetPreviewBinderDeps, href: string) {
  const electronApi = deps.windowRef.electronAPI;
  const openPath =
    electronApi && typeof electronApi["openPath"] === "function"
      ? electronApi["openPath"].bind(electronApi)
      : null;
  if (openPath !== null) {
    const result = await openPath(href);
    if (result.success === true) {
      return;
    }
    emitPreviewWarning(
      deps,
      asNonEmptyString(result.error) ||
        asNonEmptyString(result.message) ||
        "Asset preview is unavailable."
    );
    return;
  }

  if (typeof deps.windowRef.open === "function") {
    deps.windowRef.open(href, "_blank", "noopener,noreferrer");
    return;
  }

  emitPreviewWarning(deps, "Asset preview is unavailable.");
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
    const href = deps.resolveHref(assetId);
    if (href === null) {
      return;
    }
    preventAction(event);
    void openAssetPreviewTarget(deps, href);
  }

  deps.documentRef.addEventListener("click", handleClick);

  return function unbind() {
    deps.documentRef.removeEventListener("click", handleClick);
  };
}
