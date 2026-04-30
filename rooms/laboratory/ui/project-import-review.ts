import { asLabRecord, asNonEmptyString, escapeHtml } from "../models/lab-types.js";
import type { LabStoreState } from "../models/lab-types.js";
import {
  buildProjectImportHostAction,
  getProjectImportRoute,
  hasProjectImportDraftValue,
} from "../runtime/lab-project-import.js";
import { renderAssetInspector } from "./asset-inspector.js";
import { LAB_FALLBACK_I18N } from "./lab-i18n.js";
import type { LabI18n } from "./lab-i18n.js";

function getKindLabel(kind: string, copy: LabI18n) {
  switch (kind) {
    case "audio":
      return copy.t("mediaAnalysis.projectImport.tabs.audio", "Sound");
    case "image":
      return copy.t("mediaAnalysis.projectImport.tabs.image", "Image");
    case "video":
    default:
      return copy.t("mediaAnalysis.projectImport.tabs.video", "Video");
  }
}

function getMethodLabel(method: string, copy: LabI18n) {
  switch (method) {
    case "youtube":
      return copy.t("mediaAnalysis.projectImport.methods.youtube.label", "YouTube");
    case "url":
      return copy.t("mediaAnalysis.projectImport.methods.url.label", "Direct URL");
    case "local":
    default:
      return copy.t("mediaAnalysis.projectImport.methods.local.label", "Local File");
  }
}

function formatDuration(totalSeconds: unknown) {
  const seconds =
    typeof totalSeconds === "number" && Number.isFinite(totalSeconds) ? totalSeconds : 0;
  if (seconds <= 0) {
    return null;
  }
  const rounded = Math.round(seconds);
  const minutes = Math.floor(rounded / 60);
  const remainder = rounded % 60;
  return `${String(minutes)}:${String(remainder).padStart(2, "0")}`;
}

function isTrackedCurrentImport(state: LabStoreState) {
  const actionState = buildProjectImportHostAction(state);
  return (
    state.ui.projectImport.lastRequestId !== null &&
    state.ui.projectImport.lastAction === actionState.action
  );
}

function canUseCommittedSourceForReview(state: LabStoreState) {
  if (state.sourceProbeStatus !== "completed" || !isTrackedCurrentImport(state)) {
    return false;
  }
  const route = getProjectImportRoute(state);
  const source = asLabRecord(state.source);
  const sourceMode = asNonEmptyString(source["mode"]);
  if (route.method === "youtube") {
    return sourceMode === "youtube";
  }
  return sourceMode === route.method && asNonEmptyString(source["kind"]) === route.kind;
}

function renderPreview(state: LabStoreState, copy: LabI18n) {
  const route = getProjectImportRoute(state);
  if (route.method === "youtube") {
    const preview = state.ui.youtubeImport.preview;
    const title =
      asNonEmptyString(preview?.title) ||
      copy.t("mediaAnalysis.source.youtubeImport.previewFallbackTitle", "Sample Video Title");
    return `
      <div class="labx-import-review__preview">
        <div class="labx-import-review__placeholder">${escapeHtml(getMethodLabel("youtube", copy))}</div>
        <strong>${escapeHtml(title)}</strong>
        ${formatDuration(preview?.duration) ? `<span>${escapeHtml(formatDuration(preview?.duration) || "")}</span>` : ""}
      </div>
    `;
  }
  if (!canUseCommittedSourceForReview(state)) {
    return `
      <div class="labx-import-review__preview">
        <div class="labx-import-review__placeholder">${escapeHtml(getKindLabel(route.kind, copy))}</div>
      </div>
    `;
  }
  const source = asLabRecord(state.source);
  const previewUrl =
    asNonEmptyString(source["previewUrl"]) ||
    asNonEmptyString(source["sourceUrl"]) ||
    asNonEmptyString(source["storedPath"]);
  if ((route.kind === "video" || route.kind === "image") && previewUrl !== null) {
    return `
      <div class="labx-import-review__preview">
        <img class="labx-import-review__media" src="${escapeHtml(previewUrl)}" alt="${escapeHtml(getKindLabel(route.kind, copy))}" />
      </div>
    `;
  }
  if (route.kind === "audio" && previewUrl !== null) {
    return `
      <div class="labx-import-review__preview">
        <audio controls preload="metadata" style="width:100%"><source src="${escapeHtml(previewUrl)}" /></audio>
      </div>
    `;
  }
  return `
    <div class="labx-import-review__preview">
      <div class="labx-import-review__placeholder">${escapeHtml(getKindLabel(route.kind, copy))}</div>
    </div>
  `;
}

function shouldRenderImportReview(state: LabStoreState) {
  if (state.ui.projectWorkspaceSelectedEntityIds.length > 0) {
    return false;
  }
  const focus = state.ui.projectImport.reviewFocus;
  const tracked = isTrackedCurrentImport(state);
  if (focus === "running" || focus === "completed") {
    return tracked;
  }
  if (focus === "draft") {
    return true;
  }
  if (state.sourceProbeStatus === "running") {
    return tracked;
  }
  if (state.sourceProbeStatus === "completed" || state.sourceProbeStatus === "failed") {
    return false;
  }
  if (state.ui.projectImport.lastAction !== buildProjectImportHostAction(state).action) {
    return hasProjectImportDraftValue(state);
  }
  if (state.ui.projectImport.lastRequestId !== null) {
    return true;
  }
  return hasProjectImportDraftValue(state);
}

export function renderProjectImportReview(state: LabStoreState, copy: LabI18n = LAB_FALLBACK_I18N) {
  if (shouldRenderImportReview(state) !== true) {
    return renderAssetInspector(state, copy);
  }
  return `
    <aside class="labx-pw-inspector labx-import-review" aria-label="${escapeHtml(copy.t("mediaAnalysis.projectImport.review.title", "Import Review"))}">
      <div class="labx-pw-inspector__section">
        <div class="labx-pw-inspector__section-title">${escapeHtml(copy.t("mediaAnalysis.projectImport.review.title", "Import Review"))}</div>
        ${renderPreview(state, copy)}
      </div>
    </aside>
  `;
}
