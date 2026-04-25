import { asLabRecord, asNonEmptyString } from "../models/lab-types.js";
import type { LabStageSurface, LabStoreState } from "../models/lab-types.js";
import { createLabEventBus } from "../runtime/lab-event-bus.js";
import { createLabHostBridge } from "../runtime/lab-host-bridge.js";
import { loadLabPersistedState, saveLabPersistedState } from "../runtime/lab-persistence.js";
import { createLabStore } from "../runtime/lab-store.js";
import { renderLabCenterPanel } from "./lab-center-panel.js";
import { renderLabLayout } from "./lab-layout.js";
import { renderLabLeftRail } from "./lab-left-rail.js";
import { renderLabRightPanel } from "./lab-right-panel.js";
import { bindLabAssetPreviewClicks } from "./lab-asset-preview-binder.js";
import { bindLabPreviewInspectionInteractions } from "./lab-preview-inspection-binder.js";
import { createLabPreviewInspectionController } from "./lab-preview-inspection-controller.js";
import { bindLabSelectionIntentClicks } from "./lab-selection-intent-binder.js";
import { bindLabSelectionRoiInteractions } from "./lab-selection-roi-binder.js";
import { bindLabSelectionSuggestionClicks } from "./lab-selection-suggestion-binder.js";
import { renderWorkspaceSurface } from "./workspace-surface.js";
import { createLabRunController } from "../runtime/lab-run-controller.js";
import { renderToolManagementOverlay } from "./tool-management-overlay.js";
import { renderReportOverlay } from "./report-overlay.js";
import { renderLabAssetPreviewOverlay } from "./lab-asset-preview-overlay.js";
import {
  getActiveSelection,
  getActiveInspectionSnapshot,
  getActiveSuggestionPreviewId,
  getRoiFocusActive,
  getSelectionSuggestions,
  getWorkspaceMode,
} from "../runtime/lab-selectors.js";

type RootWindow = Window & {
  roomAPI?: {
    onHostMessage?: (listener: (message: unknown) => void) => void;
    ready?: (payload: { feature: string; room: string; stage: string }) => void;
  };
};

function createRenderedElement(documentRef: Document, markup: string) {
  const template = documentRef.createElement("template");
  template.innerHTML = markup.trim();
  return template.content.firstElementChild;
}

function readPreservedMediaKey(element: Element) {
  const key = element.getAttribute("data-lab-preserve-media");
  return typeof key === "string" && key.trim() !== "" ? key : null;
}

function readElementSource(element: Element) {
  const source = element.getAttribute("src");
  return typeof source === "string" && source.trim() !== "" ? source : null;
}

function canReuseElement(currentElement: Element, nextElement: Element) {
  if (currentElement.tagName !== nextElement.tagName) {
    return false;
  }

  const preserveKey = readPreservedMediaKey(currentElement) || readPreservedMediaKey(nextElement);
  if (!preserveKey) {
    return true;
  }

  return (
    readPreservedMediaKey(currentElement) === readPreservedMediaKey(nextElement) &&
    readElementSource(currentElement) === readElementSource(nextElement)
  );
}

function syncFormState(currentElement: Element, nextElement: Element) {
  if (
    typeof HTMLInputElement !== "undefined" &&
    currentElement instanceof HTMLInputElement &&
    nextElement instanceof HTMLInputElement
  ) {
    if (currentElement.type === "checkbox" || currentElement.type === "radio") {
      currentElement.checked = nextElement.checked;
      return;
    }
    if (currentElement.value !== nextElement.value) {
      currentElement.value = nextElement.value;
    }
    return;
  }

  if (
    typeof HTMLTextAreaElement !== "undefined" &&
    currentElement instanceof HTMLTextAreaElement &&
    nextElement instanceof HTMLTextAreaElement
  ) {
    if (currentElement.value !== nextElement.value) {
      currentElement.value = nextElement.value;
    }
    return;
  }

  if (
    typeof HTMLSelectElement !== "undefined" &&
    currentElement instanceof HTMLSelectElement &&
    nextElement instanceof HTMLSelectElement &&
    currentElement.value !== nextElement.value
  ) {
    currentElement.value = nextElement.value;
  }
}

function syncAttributes(currentElement: Element, nextElement: Element) {
  const currentAttributeNames = currentElement.getAttributeNames();
  currentAttributeNames.forEach(function (attributeName) {
    if (nextElement.hasAttribute(attributeName) !== true) {
      currentElement.removeAttribute(attributeName);
    }
  });

  nextElement.getAttributeNames().forEach(function (attributeName) {
    const nextValue = nextElement.getAttribute(attributeName);
    if (currentElement.getAttribute(attributeName) !== nextValue) {
      if (nextValue === null) {
        currentElement.removeAttribute(attributeName);
        return;
      }
      currentElement.setAttribute(attributeName, nextValue);
    }
  });

  syncFormState(currentElement, nextElement);
}

function syncChildNodes(currentElement: Element, nextElement: Element) {
  const currentChildren = Array.from(currentElement.childNodes);
  const nextChildren = Array.from(nextElement.childNodes);
  const childCount = Math.max(currentChildren.length, nextChildren.length);

  for (let index = 0; index < childCount; index += 1) {
    const currentChild = currentChildren[index];
    const nextChild = nextChildren[index];

    if (!currentChild && nextChild) {
      currentElement.appendChild(nextChild.cloneNode(true));
      continue;
    }

    if (currentChild && !nextChild) {
      currentChild.remove();
      continue;
    }

    if (!currentChild || !nextChild) {
      continue;
    }

    if (currentChild.nodeType !== nextChild.nodeType) {
      currentChild.replaceWith(nextChild.cloneNode(true));
      continue;
    }

    if (currentChild.nodeType === 3 || currentChild.nodeType === 8) {
      if (currentChild.textContent !== nextChild.textContent) {
        currentChild.textContent = nextChild.textContent;
      }
      continue;
    }

    const currentChildElement = currentChild as Element;
    const nextChildElement = nextChild as Element;
    if (canReuseElement(currentChildElement, nextChildElement) !== true) {
      currentChildElement.replaceWith(nextChildElement.cloneNode(true));
      continue;
    }

    syncElement(currentChildElement, nextChildElement);
  }
}

function readPreservedDetailsState(currentElement: Element, nextElement: Element) {
  if (
    typeof HTMLDetailsElement !== "undefined" &&
    currentElement instanceof HTMLDetailsElement &&
    nextElement instanceof HTMLDetailsElement &&
    currentElement.hasAttribute("data-lab-interpretation-panel")
  ) {
    return currentElement.open;
  }
  return null;
}

function syncElement(currentElement: Element, nextElement: Element) {
  const preservedDetailsState = readPreservedDetailsState(currentElement, nextElement);
  syncAttributes(currentElement, nextElement);
  if (
    preservedDetailsState !== null &&
    typeof HTMLDetailsElement !== "undefined" &&
    currentElement instanceof HTMLDetailsElement
  ) {
    currentElement.open = preservedDetailsState;
  }
  syncChildNodes(currentElement, nextElement);
}

export const __testOnlyLabRootDomSync = {
  syncElement,
};

export const __testOnlyLabRootPersistence = {
  readPersistableState,
};

function updateRenderedElement(
  documentRef: Document,
  currentElement: HTMLElement,
  markup: string,
  preserveScroll = false
) {
  const scrollTop = preserveScroll ? currentElement.scrollTop : 0;
  const nextElement = createRenderedElement(documentRef, markup);
  if (!nextElement || canReuseElement(currentElement, nextElement) !== true) {
    const parent = currentElement.parentElement;
    currentElement.outerHTML = markup;
    if (preserveScroll && parent) {
      const replaced = parent.querySelector(`.${currentElement.className.split(" ")[0]}`);
      if (replaced instanceof HTMLElement) {
        replaced.scrollTop = scrollTop;
      }
    }
    return;
  }

  syncElement(currentElement, nextElement);
  if (preserveScroll) {
    currentElement.scrollTop = scrollTop;
  }
}

function createBootSurface(state: LabStoreState): LabStageSurface {
  return {
    main: `
      <section class="labx-boot">
        <p class="labx-boot__eyebrow">Hayalet Ev Laboratuvar</p>
        <h1 class="labx-boot__title">Laboratuvar Yükleniyor</h1>
        <p class="labx-boot__body">Çalışma tezgahı, kayıtlı projeler ve yerel analiz hazırlığı yükleniyor.</p>
      </section>
    `,
    side: `
      <section class="labx-card">
        <div class="labx-card__header">
          <div>
            <p class="labx-card__eyebrow">Başlangıç</p>
            <h2 class="labx-card__title">Oda Kontratı</h2>
          </div>
        </div>
        <div class="labx-card__body">
          <p class="labx-panel-hint">Yeni shell hazırlanırken roomAPI.ready payload yapısı korunur.</p>
          <p class="labx-panel-hint">Geçerli aşama: ${state.currentStage}</p>
        </div>
      </section>
    `,
  };
}

function readPersistableState(state: LabStoreState) {
  return {
    schemaVersion: 4,
    artifactRenderCount: state.ui.artifactRenderCount,
    artifactListExpanded: state.ui.artifactListExpanded,
    assets: state.assets,
    activePreviewArtifactId: state.ui.activePreviewArtifactId,
    activityFeed: state.activityFeed.slice(0, 40),
    analysisControlsCollapsed: state.ui.analysisControlsCollapsed,
    currentStage: state.currentStage,
    editDrafts: state.ui.editDrafts,
    editConfig: state.editConfig,
    editSidePanelCollapsed: state.ui.editSidePanelCollapsed,
    eventFeedExpanded: state.ui.eventFeedExpanded,
    eventFeedCursor: state.ui.eventFeedCursor,
    featureId: state.featureId,
    selectedCapabilities: state.selectedCapabilities,
    lastRun: state.run
      ? {
          ...state.run,
          state:
            state.run.state === "running" || state.run.state === "queued"
              ? "cancelled"
              : state.run.state,
          events: [],
          rawLog: [],
        }
      : null,
    profileConfig: state.profileConfig,
    profileDrafts: state.ui.profileDrafts,
    profileModels: state.profileModels,
    preflight: state.preflight,
    projectIndex: state.projectIndex,
    reportExports: state.reportExports,
    reports: state.reports,
    reportView: state.ui.reportView,
    source: state.source,
    sourceDrafts: state.ui.sourceDrafts,
    sourceProbeStatus: state.sourceProbeStatus,
    toolState: state.toolState,
    liveFindingsExpanded: state.ui.liveFindingsExpanded,
    rawLogCollapsed: state.ui.rawLogCollapsed,
    workbench: state.workbench,
    // V2.3 workspace persistence
    workspace: state.ui.workspace,
  };
}

export function startLaboratoryLabRoot() {
  const documentRef = document;
  const windowRef = window as RootWindow;
  const root = documentRef.getElementById("app");
  if (!root) {
    return;
  }
  const runtimeRoot = root;

  const eventBus = createLabEventBus();
  const store = createLabStore();
  eventBus.subscribe(store.dispatch);
  const previewInspectionController = createLabPreviewInspectionController({
    documentRef,
    emit: eventBus.emit,
    getActiveSelection() {
      return getActiveSelection(store.getState());
    },
    getActiveSnapshot() {
      return getActiveInspectionSnapshot(store.getState());
    },
    getRoiFocusActive() {
      return getRoiFocusActive(store.getState());
    },
    windowRef,
  });
  bindLabSelectionIntentClicks({
    documentRef,
    emit: eventBus.emit,
  });
  bindLabAssetPreviewClicks({
    documentRef,
    emit: eventBus.emit,
    resolveHref(assetId) {
      const asset = store.getState().assets.find(function (candidate) {
        return candidate.id === assetId;
      });
      return asNonEmptyString(asset?.localPath) || asNonEmptyString(asset?.url) || null;
    },
  });
  bindLabSelectionRoiInteractions({
    documentRef,
    emit: eventBus.emit,
    getActiveSelection() {
      return store.getState().ui.workspace.activeSelection;
    },
    getSourceKind() {
      const sourceKind = asNonEmptyString(asLabRecord(store.getState().source)["kind"]);
      return sourceKind || "video";
    },
  });
  bindLabPreviewInspectionInteractions({
    controller: previewInspectionController,
    documentRef,
  });
  bindLabSelectionSuggestionClicks({
    canPreviewSuggestion(suggestionId) {
      return getSelectionSuggestions(store.getState()).some(function (suggestion) {
        return suggestion.id === suggestionId;
      });
    },
    documentRef,
    emit: eventBus.emit,
    getActivePreviewSuggestionId() {
      return getActiveSuggestionPreviewId(store.getState());
    },
  });

  const controller = createLabRunController({
    documentRef,
    eventBus,
    store,
    windowRef: window,
  });
  const hostBridge = createLabHostBridge({
    emit: eventBus.emit,
  });
  let shellMounted = false;

  function renderSurface(state: LabStoreState) {
    // V2.3: single workspace surface replaces stage routing
    return renderWorkspaceSurface(state);
  }

  function render() {
    const state = store.getState();
    const hasCanonicalState =
      state.bootReady ||
      state.source !== null ||
      state.run !== null ||
      state.reports.user !== null ||
      state.reports.ai !== null ||
      state.projectIndex.projects.length > 0;
    const surface = hasCanonicalState ? renderSurface(state) : createBootSurface(state);
    if (shellMounted !== true) {
      runtimeRoot.innerHTML = renderLabLayout(state, surface);
      shellMounted = true;
      return;
    }

    const shell = runtimeRoot.querySelector(".labx-shell");
    const leftRail = runtimeRoot.querySelector(".labx-left-rail");
    const centerPanel = runtimeRoot.querySelector(".labx-center-panel");
    const rightPanel = runtimeRoot.querySelector(".labx-right-panel");
    const overlayRoot = runtimeRoot.querySelector(".labx-overlay-root");
    const assetPreviewOverlayRoot = runtimeRoot.querySelector("#lab-asset-preview-overlay-root");
    const reportOverlayRoot = runtimeRoot.querySelector("#lab-report-overlay-root");
    if (
      !shell ||
      !leftRail ||
      !centerPanel ||
      !rightPanel ||
      !overlayRoot ||
      !assetPreviewOverlayRoot
    ) {
      runtimeRoot.innerHTML = renderLabLayout(state, surface);
      return;
    }

    if (shell instanceof HTMLElement) {
      shell.dataset["stage"] = state.currentStage;
      shell.dataset["ready"] = state.bootReady ? "true" : "false";
      shell.dataset["workspaceMode"] = getWorkspaceMode(state);
    }
    updateRenderedElement(documentRef, leftRail as HTMLElement, renderLabLeftRail(state));
    updateRenderedElement(
      documentRef,
      centerPanel as HTMLElement,
      renderLabCenterPanel(surface),
      true
    );
    updateRenderedElement(
      documentRef,
      rightPanel as HTMLElement,
      renderLabRightPanel(surface),
      true
    );
    updateRenderedElement(
      documentRef,
      overlayRoot as HTMLElement,
      renderToolManagementOverlay(state)
    );
    updateRenderedElement(
      documentRef,
      assetPreviewOverlayRoot as HTMLElement,
      renderLabAssetPreviewOverlay(state)
    );
    if (reportOverlayRoot) {
      updateRenderedElement(
        documentRef,
        reportOverlayRoot as HTMLElement,
        renderReportOverlay(state)
      );
    }
  }

  store.subscribe(function (state) {
    saveLabPersistedState(window, readPersistableState(state));
    render();
    previewInspectionController.sync();
  });

  const persisted = loadLabPersistedState(window);
  eventBus.emit({
    type: "hydrate",
    payload: persisted,
  });

  controller.attach();

  if (windowRef.roomAPI && typeof windowRef.roomAPI.onHostMessage === "function") {
    windowRef.roomAPI.onHostMessage(function (message: unknown) {
      hostBridge.handleHostMessage(message);
    });
  }

  render();
  previewInspectionController.sync();

  if (windowRef.roomAPI && typeof windowRef.roomAPI.ready === "function") {
    windowRef.roomAPI.ready({
      feature: "media-analysis",
      room: "laboratory",
      stage: "ui-ready",
    });
    eventBus.emit({
      type: "bootstrap-ready-sent",
    });
  }
}

startLaboratoryLabRoot();
