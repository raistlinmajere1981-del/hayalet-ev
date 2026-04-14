import {
  getLaboratoryShellRegions,
  renderLaboratoryShell,
  renderLaboratoryStageContent,
} from "./shell-render.js";
import type { LaboratoryStageSurface } from "../types/room-shell-contracts.js";
import type { createLaboratoryUiBootstrapStateRuntime } from "../../ui/bootstrap-state-runtime.js";

type LaboratoryUiState = ReturnType<typeof createLaboratoryUiBootstrapStateRuntime>["state"];

type LaboratoryUiShellRuntimeDeps = {
  bindAudioAnalysis: () => void;
  bindPreviewMetrics: () => void;
  captureScrollState: (root: Element) => void;
  documentRef: Document;
  escapeHtml: (value: string) => string;
  renderBootstrap: () => string;
  renderEditStage: () => LaboratoryStageSurface;
  renderProcessStage: () => LaboratoryStageSurface;
  renderProfileStage: () => LaboratoryStageSurface;
  renderReportStage: () => LaboratoryStageSurface;
  renderSettingsOverlay: () => string;
  renderSourceStage: () => LaboratoryStageSurface;
  renderStageRail: () => string;
  restoreScrollState: (root: Element) => void;
  state: LaboratoryUiState;
  text: (path: string[]) => string;
};

type LaboratoryShellMarkupCache = {
  eventLogMarkup: string;
  inspectorClassName: string;
  inspectorMarkup: string;
  overlayMarkup: string;
  railMarkup: string;
  stageHasInspector: boolean;
  stageMainClassName: string;
  stageMainMarkup: string;
  statusMarkup: string;
};

type LaboratoryShellRegionSelector =
  | "#lab-shell-rail"
  | "#lab-shell-main"
  | "#lab-shell-inspector"
  | "#lab-shell-status"
  | "#lab-shell-log"
  | "#lab-shell-overlay";

type LaboratoryFocusSnapshot = {
  regionSelector: LaboratoryShellRegionSelector;
  selectionEnd: number | null;
  selectionStart: number | null;
  targetSelector: string;
};

const focusRegionSelectors: LaboratoryShellRegionSelector[] = [
  "#lab-shell-rail",
  "#lab-shell-main",
  "#lab-shell-inspector",
  "#lab-shell-status",
  "#lab-shell-log",
  "#lab-shell-overlay",
];

export function createLaboratoryUiShellRuntime(deps: LaboratoryUiShellRuntimeDeps) {
  const {
    bindAudioAnalysis,
    bindPreviewMetrics,
    captureScrollState,
    documentRef,
    escapeHtml,
    renderBootstrap,
    renderEditStage: getEditStageMarkup,
    renderProcessStage: getProcessStageMarkup,
    renderProfileStage: getProfileStageMarkup,
    renderReportStage: getReportStageMarkup,
    renderSettingsOverlay,
    renderSourceStage: getSourceStageMarkup,
    renderStageRail,
    restoreScrollState,
    state,
    text,
  } = deps;
  let markupCache: LaboratoryShellMarkupCache | null = null;

  function renderSourceStage() {
    return getSourceStageMarkup();
  }

  function renderEditStage() {
    return getEditStageMarkup();
  }

  function renderProfileStage() {
    return getProfileStageMarkup();
  }

  function renderProcessStage() {
    return getProcessStageMarkup();
  }

  function renderReportStage() {
    return getReportStageMarkup();
  }

  function renderStageContent() {
    return renderLaboratoryStageContent(state.activeStage, {
      renderEditStage,
      renderProcessStage,
      renderProfileStage,
      renderReportStage,
      renderSourceStage,
    });
  }

  function getRegions(stageSurface: LaboratoryStageSurface) {
    return getLaboratoryShellRegions({
      activeStage: state.activeStage,
      escapeHtml,
      eventLog: state.ui.eventLog,
      eventLogOpen: state.ui.eventLogOpen,
      locale: state.locale,
      renderSettingsOverlay,
      renderStageRail,
      stageSurface,
      status: state.ui.status,
      text,
    });
  }

  function escapeSelectorValue(value: string) {
    return value.replaceAll("\\", "\\\\").replaceAll('"', '\\"');
  }

  function isTextSelectionElement(
    element: Element | null
  ): element is HTMLInputElement | HTMLTextAreaElement {
    return element instanceof HTMLInputElement || element instanceof HTMLTextAreaElement;
  }

  function buildFocusTargetSelector(element: HTMLElement): string | null {
    const tagName = element.tagName.toLowerCase();
    const attributePairs = [
      ["data-draft-field", element.dataset["draftField"]],
      ["data-edit-field", element.dataset["editField"]],
      ["data-profile-field", element.dataset["profileField"]],
      ["data-select", element.dataset["select"]],
      ["data-profile-toggle", element.dataset["profileToggle"]],
      ["data-profile-artifact-toggle", element.dataset["profileArtifactToggle"]],
      ["data-stage-target", element.dataset["stageTarget"]],
      ["data-action", element.dataset["action"]],
      ["id", element.id],
      [
        "name",
        element instanceof HTMLInputElement ||
        element instanceof HTMLSelectElement ||
        element instanceof HTMLTextAreaElement
          ? element.name
          : "",
      ],
    ] as const;

    for (const [attributeName, rawValue] of attributePairs) {
      if (typeof rawValue !== "string" || rawValue.trim() === "") {
        continue;
      }
      const attributeSelector = `${tagName}[${attributeName}="${escapeSelectorValue(rawValue)}"]`;
      if (attributeName === "data-action" && typeof element.dataset["value"] === "string") {
        return `${attributeSelector}[data-value="${escapeSelectorValue(element.dataset["value"] || "")}"]`;
      }
      return attributeSelector;
    }

    return null;
  }

  // NOTE: Region rerenders still replace markup in place, so we keep enough metadata
  // to restore active control focus when draft or profile updates trigger a render.
  function captureFocusSnapshot(root: HTMLElement): LaboratoryFocusSnapshot | null {
    const activeElement = documentRef.activeElement;
    if (!(activeElement instanceof HTMLElement) || root.contains(activeElement) === false) {
      return null;
    }

    const regionSelector =
      focusRegionSelectors.find(function (selector) {
        const region = root.querySelector<HTMLElement>(selector);
        return region?.contains(activeElement) === true;
      }) || null;
    if (regionSelector === null) {
      return null;
    }

    const targetSelector = buildFocusTargetSelector(activeElement);
    if (targetSelector === null) {
      return null;
    }

    return {
      regionSelector,
      selectionEnd: isTextSelectionElement(activeElement) ? activeElement.selectionEnd : null,
      selectionStart: isTextSelectionElement(activeElement) ? activeElement.selectionStart : null,
      targetSelector,
    };
  }

  function restoreFocusSnapshot(
    root: HTMLElement,
    snapshot: LaboratoryFocusSnapshot | null,
    updatedRegions: Set<LaboratoryShellRegionSelector>
  ) {
    if (!snapshot || updatedRegions.has(snapshot.regionSelector) === false) {
      return;
    }

    const region = root.querySelector<HTMLElement>(snapshot.regionSelector);
    if (!region) {
      return;
    }

    const target = region.querySelector<HTMLElement>(snapshot.targetSelector);
    if (!target) {
      return;
    }

    try {
      target.focus({ preventScroll: true });
    } catch {
      target.focus();
    }

    if (isTextSelectionElement(target)) {
      const valueLength = target.value.length;
      const selectionStart = Math.max(0, Math.min(snapshot.selectionStart ?? valueLength, valueLength));
      const selectionEnd = Math.max(selectionStart, Math.min(snapshot.selectionEnd ?? selectionStart, valueLength));
      try {
        target.setSelectionRange(selectionStart, selectionEnd);
      } catch {
        void 0;
      }
    }
  }

  function updateRegionIfChanged(
    root: HTMLElement,
    selector: LaboratoryShellRegionSelector,
    nextMarkup: string,
    previousMarkup: string | null
  ) {
    if (previousMarkup === nextMarkup) {
      return false;
    }
    const element = root.querySelector<HTMLElement>(selector);
    if (!element) {
      return false;
    }
    element.innerHTML = nextMarkup;
    return true;
  }

  function render() {
    const root = documentRef.getElementById("app");
    if (!root) {
      return;
    }

    captureScrollState(root);
    const focusSnapshot = captureFocusSnapshot(root);

    if (state.translations === null) {
      markupCache = null;
      root.innerHTML = renderBootstrap();
      return;
    }

    const stageSurface = renderStageContent();
    const regions = getRegions(stageSurface);

    if (root.querySelector(".lab-shell") === null) {
      root.innerHTML = renderLaboratoryShell({
        activeStage: state.activeStage,
        escapeHtml,
        eventLog: state.ui.eventLog,
        eventLogOpen: state.ui.eventLogOpen,
        locale: state.locale,
        renderSettingsOverlay,
        renderStageRail,
        stageSurface,
        status: state.ui.status,
        text,
      });
      markupCache = regions;
      restoreScrollState(root);
      bindPreviewMetrics();
      bindAudioAnalysis();
      return;
    }

    let shouldRebind = false;
    const updatedRegions = new Set<LaboratoryShellRegionSelector>();
    if (updateRegionIfChanged(root, "#lab-shell-rail", regions.railMarkup, markupCache?.railMarkup ?? null)) {
      updatedRegions.add("#lab-shell-rail");
      shouldRebind = true;
    }
    if (updateRegionIfChanged(root, "#lab-shell-main", regions.stageMainMarkup, markupCache?.stageMainMarkup ?? null)) {
      updatedRegions.add("#lab-shell-main");
      shouldRebind = true;
    }
    if (
      updateRegionIfChanged(
        root,
        "#lab-shell-inspector",
        regions.inspectorMarkup,
        markupCache?.inspectorMarkup ?? null
      )
    ) {
      updatedRegions.add("#lab-shell-inspector");
      shouldRebind = true;
    }
    if (updateRegionIfChanged(root, "#lab-shell-status", regions.statusMarkup, markupCache?.statusMarkup ?? null)) {
      updatedRegions.add("#lab-shell-status");
      shouldRebind = true;
    }
    if (updateRegionIfChanged(root, "#lab-shell-log", regions.eventLogMarkup, markupCache?.eventLogMarkup ?? null)) {
      updatedRegions.add("#lab-shell-log");
      shouldRebind = true;
    }
    if (updateRegionIfChanged(root, "#lab-shell-overlay", regions.overlayMarkup, markupCache?.overlayMarkup ?? null)) {
      updatedRegions.add("#lab-shell-overlay");
      shouldRebind = true;
    }

    const shellElement = root.querySelector<HTMLElement>(".lab-shell");
    if (shellElement) {
      shellElement.dataset["centerOpen"] = regions.overlayMarkup.trim() !== "" ? "true" : "false";
    }

    const workspace = root.querySelector<HTMLElement>(".lab-workspace");
    if (workspace) {
      workspace.dataset["hasInspector"] = regions.stageHasInspector ? "true" : "false";
    }

    const mainRegion = root.querySelector<HTMLElement>("#lab-shell-main");
    if (mainRegion && mainRegion.className !== `lab-workspace__main ${regions.stageMainClassName}`.trim()) {
      mainRegion.className = `lab-workspace__main ${regions.stageMainClassName}`.trim();
    }

    const inspectorRegion = root.querySelector<HTMLElement>("#lab-shell-inspector");
    if (
      inspectorRegion &&
      inspectorRegion.className !== `lab-workspace__inspector ${regions.inspectorClassName}`.trim()
    ) {
      inspectorRegion.className = `lab-workspace__inspector ${regions.inspectorClassName}`.trim();
    }

    markupCache = regions;
    restoreScrollState(root);
    if (shouldRebind) {
      bindPreviewMetrics();
      bindAudioAnalysis();
    }
    restoreFocusSnapshot(root, focusSnapshot, updatedRegions);
  }

  return {
    render,
    renderEditStage,
    renderProcessStage,
    renderProfileStage,
    renderReportStage,
    renderSourceStage,
    renderStageContent,
  };
}

export type LaboratoryUiShellRuntimeApi = ReturnType<typeof createLaboratoryUiShellRuntime>;
