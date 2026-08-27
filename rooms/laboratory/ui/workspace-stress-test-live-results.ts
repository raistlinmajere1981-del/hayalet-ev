import { asLabRecord, asNonEmptyString, escapeHtml } from "../domain/lab-types.js";
import type { LabStoreState } from "../domain/lab-types.js";
import { resolveLaboratoryTrackingPreviewCache } from "../shared/tracking-preview-model.js";
import type { LabI18n } from "./lab-i18n.js";
import { renderLaboratoryStressReportHistory } from "./workspace-stress-report-history.js";

type StressTestRecord = Record<string, unknown>;
type TransformPreviewMode = "source" | "transform" | "difference";

function finite(value: unknown) {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function findPreviewArtifactUrl(preview: StressTestRecord, kind: string) {
  const artifacts = preview["artifacts"];
  if (!Array.isArray(artifacts)) return null;
  for (const entry of artifacts) {
    const artifact = asLabRecord(entry);
    if (asNonEmptyString(artifact["kind"]) === kind) {
      return asNonEmptyString(artifact["previewUrl"]);
    }
  }
  return null;
}

function getTransformPreviewMode(state: LabStoreState): TransformPreviewMode {
  if (state.ui.workspace.comparisonViewMode === "difference") return "difference";
  if (state.ui.workspace.comparisonViewMode === "stacked") return "transform";
  return "source";
}

function renderPreviewMedia(sourceKind: string, url: string, label: string) {
  if (sourceKind === "video") {
    return `<video class="labx-preview-media" controls preload="metadata" src="${escapeHtml(url)}" aria-label="${escapeHtml(label)}"></video>`;
  }
  return `<img class="labx-preview-media" src="${escapeHtml(url)}" alt="${escapeHtml(label)}" />`;
}

function renderTrackingPreviewSurface(state: LabStoreState, sourceUrl: string | null) {
  const source = asLabRecord(state.source);
  const metadata = asLabRecord(source["metadata"]);
  const sourceWidth = finite(metadata["width"]);
  const sourceHeight = finite(metadata["height"]);
  const cache = resolveLaboratoryTrackingPreviewCache(state.editConfig, {
    sourceHeight,
    sourceWidth,
  });
  const rawRois = {
    target: state.ui.workspace.activeSelection?.roi ?? null,
    control: state.ui.workspace.comparisonRois.primary,
    background: state.ui.workspace.comparisonRois.reference,
  };
  return `
    <div
      class="labx-tracking-preview-surface"
      data-lab-tracking-preview-surface="true"
      data-lab-tracking-preview-cache-json="${escapeHtml(JSON.stringify(cache))}"
      data-lab-tracking-preview-rois-json="${escapeHtml(JSON.stringify(rawRois))}"
      hidden
    >
      ${
        sourceUrl === null
          ? `<div class="labx-strip-live-empty">Tracking Preview için kaynak video önizlemesi bulunamadı.</div>`
          : `<div class="labx-tracking-preview-media-shell" data-lab-tracking-preview-media-shell="true">
              <video
                class="labx-preview-media labx-tracking-preview-media"
                controls
                preload="metadata"
                src="${escapeHtml(sourceUrl)}"
                data-lab-tracking-preview-video="true"
                aria-label="Tracking Preview source"
              ></video>
              <div class="labx-tracking-preview-frame" data-lab-tracking-preview-frame="true" aria-hidden="true"></div>
            </div>`
      }
      <p class="labx-strip-live-note labx-tracking-preview-detail" data-lab-tracking-preview-detail="true"></p>
    </div>
  `;
}

function renderLiveTransformPreview(state: LabStoreState, copy: LabI18n) {
  const source = asLabRecord(state.source);
  const sourceKind = asNonEmptyString(source["kind"]);
  if (sourceKind !== "video" && sourceKind !== "image") {
    return `<div class="labx-strip-live-empty">${escapeHtml(copy.locale === "tr" ? "Görsel önizleme için video veya resim kaynağı gerekir." : "A video or image source is required for visual preview.")}</div>`;
  }

  const preview = asLabRecord(asLabRecord(state.editConfig)["preview"]);
  const previewStatus = asNonEmptyString(preview["status"]) || "idle";
  const previewReady = previewStatus === "ready";
  const sourcePreviewUrl = asNonEmptyString(source["previewUrl"]);
  const baselineUrl =
    (previewReady ? findPreviewArtifactUrl(preview, "transform-source-baseline") : null) ||
    sourcePreviewUrl;
  const transformUrl = previewReady ? asNonEmptyString(preview["previewUrl"]) : null;
  const differenceUrl = previewReady
    ? findPreviewArtifactUrl(preview, "transform-difference")
    : null;
  const mode = getTransformPreviewMode(state);
  const selectedValue =
    mode === "difference" ? "difference" : mode === "transform" ? "stacked" : "side-by-side";
  const sourceLabel = copy.t("mediaAnalysis.stages.source", "Source");
  const transformLabel = "Transform";
  const differenceLabel = copy.t(
    "mediaAnalysis.operations.comparison.viewModes.difference",
    "Difference"
  );
  const modeUrl =
    mode === "difference" ? differenceUrl : mode === "transform" ? transformUrl : baselineUrl;
  const modeLabel =
    mode === "difference" ? differenceLabel : mode === "transform" ? transformLabel : sourceLabel;
  const unavailable =
    previewStatus === "stale"
      ? copy.t(
          "mediaAnalysis.edit.previewStates.stale",
          "Preview is stale. Generate a fresh preview before trusting the current frame."
        )
      : copy.locale === "tr"
        ? "Bu görünüm için önce Zinciri Önizle ile güncel artefaktları üretin."
        : "Generate a current Preview Stack before using this view.";

  return `
    <div class="labx-strip-live-preview__toolbar">
      <strong data-lab-live-preview-title="true">${escapeHtml(copy.locale === "tr" ? "Dönüşüm Önizlemesi" : "Transform Preview")}</strong>
      <label>
        <span>Source / Transform / Difference</span>
        <select class="labx-select labx-select--compact" data-lab-field="workspace.comparison.viewMode" data-lab-live-transform-mode="true">
          <option value="side-by-side" ${selectedValue === "side-by-side" ? "selected" : ""}>${escapeHtml(sourceLabel)}</option>
          <option value="stacked" ${selectedValue === "stacked" ? "selected" : ""}>${escapeHtml(transformLabel)}</option>
          <option value="difference" ${selectedValue === "difference" ? "selected" : ""}>${escapeHtml(differenceLabel)}</option>
        </select>
      </label>
      <span class="labx-strip-live-preview__status" data-lab-live-preview-status="true">${escapeHtml(previewReady ? "current" : previewStatus)}</span>
    </div>
    <div class="labx-strip-live-preview__viewport" data-lab-transform-comparison-viewport="true">
      <div class="labx-strip-live-preview__content" data-lab-transform-preview-content="true">
        ${modeUrl === null ? `<p>${escapeHtml(unavailable)}</p>` : renderPreviewMedia(sourceKind, modeUrl, modeLabel)}
      </div>
      ${sourceKind === "video" ? renderTrackingPreviewSurface(state, sourcePreviewUrl ?? baselineUrl) : ""}
    </div>
    <p class="labx-strip-live-note" data-lab-live-preview-note="true">${escapeHtml(
      copy.locale === "tr"
        ? "Source baseline aynı temel edit tarifini stress-transform aşamaları olmadan kullanır; Difference iki hizalı çıktı arasındaki piksel farkıdır."
        : "Source baseline uses the same base edit recipe without stress-transform stages; Difference is the pixel difference between the aligned outputs."
    )}</p>
  `;
}

export function renderWorkspaceStressTestLiveResults(state: LabStoreState, copy: LabI18n) {
  const reportHistory = renderLaboratoryStressReportHistory(state.editConfig, copy);
  const hasResultContent = reportHistory.trim() !== "";

  return `
    <div class="labx-strip-expanded labx-strip-expanded--live" data-lab-process-expanded="true" data-lab-live-results="true">
      <div class="labx-strip-live-column labx-strip-live-column--preview">
        ${renderLiveTransformPreview(state, copy)}
      </div>
      <div class="labx-strip-live-column labx-strip-live-column--results">
        <div class="labx-strip-live-heading">
          <strong>${escapeHtml(copy.locale === "tr" ? "Rapor Geçmişi" : "Report History")}</strong>
          <span>${escapeHtml(copy.locale === "tr" ? "En yeni rapor üstte · tam içerik Copy / MD Export ile" : "Newest first · full content through Copy / MD Export")}</span>
        </div>
        <div class="labx-strip-live-results__scroll">
          ${
            hasResultContent
              ? reportHistory
              : `<div class="labx-strip-live-empty">${escapeHtml(copy.locale === "tr" ? "Henüz manuel test raporu yok." : "No manual test report yet.")}</div>`
          }
        </div>
      </div>
    </div>
  `;
}
