import { asLabRecord, asNonEmptyString, escapeHtml } from "../domain/lab-types.js";
import type { LabEditConfig, LabStoreState } from "../domain/lab-types.js";
import type { LabI18n } from "./lab-i18n.js";
import { renderWorkspaceMotionImpactSummaries } from "./workspace-motion-impact-summary.js";
import { renderWorkspaceStressTestSummaries } from "./workspace-stress-test-summary.js";
import { renderWorkspaceVisualResponseSummaries } from "./workspace-visual-response-summary.js";

type StressTestRecord = Record<string, unknown>;
type TransformPreviewMode = "source" | "transform" | "difference";

const CONTROL_KINDS = [
  "noise",
  "blur",
  "sharpen",
  "denoise",
  "gamma",
  "black-crush",
  "highlight-clipping",
  "chroma-suppression",
  "low-light",
  "recompression",
] as const;
const MOTION_HISTORY_KINDS = new Set([
  "motion-reference-lock",
  "motion-vector-probe",
  "impact-window-compare",
]);
const RESPONSE_HISTORY_KINDS = new Set([
  "visibility-response",
  "appearance-transition",
  "recompression-ladder",
]);

function readHistory(state: LabStoreState): StressTestRecord[] {
  const history = asLabRecord(state.editConfig)["temporalStressTests"];
  if (!Array.isArray(history)) return [];
  return history.map((entry: unknown) => asLabRecord(entry));
}

function isMotionHistoryEntry(entry: StressTestRecord) {
  return MOTION_HISTORY_KINDS.has(asNonEmptyString(entry["kind"]) || "");
}

function isResponseHistoryEntry(entry: StressTestRecord) {
  return RESPONSE_HISTORY_KINDS.has(asNonEmptyString(entry["kind"]) || "");
}

function buildLegacyStressSummaryEditConfig(
  editConfig: LabEditConfig | null
): LabEditConfig | null {
  if (editConfig === null) return null;
  const history = asLabRecord(editConfig)["temporalStressTests"];
  return {
    ...editConfig,
    temporalStressTests: Array.isArray(history)
      ? history.filter(function (entry) {
          const record = asLabRecord(entry);
          return !isMotionHistoryEntry(record) && !isResponseHistoryEntry(record);
        })
      : [],
  };
}

function readFiniteNumber(record: StressTestRecord, key: string): number | null {
  const value = record[key];
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function readEdgePersistence(record: StressTestRecord) {
  return (
    readFiniteNumber(record, "spatialEdgePersistenceRatio") ??
    readFiniteNumber(record, "edgePersistenceRatio")
  );
}

function formatSigned(value: number | null, percent = false) {
  if (value === null) return "—";
  const normalized = percent ? Math.round(value * 100) : Number(value.toFixed(3));
  const suffix = percent ? "%" : "";
  return `${normalized >= 0 ? "+" : ""}${String(normalized)}${suffix}`;
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

function renderLiveTransformPreview(state: LabStoreState, copy: LabI18n) {
  const source = asLabRecord(state.source);
  const sourceKind = asNonEmptyString(source["kind"]);
  if (sourceKind !== "video" && sourceKind !== "image") {
    return `<div class="labx-strip-live-empty">${escapeHtml(copy.locale === "tr" ? "Görsel önizleme için video veya resim kaynağı gerekir." : "A video or image source is required for visual preview.")}</div>`;
  }

  const preview = asLabRecord(asLabRecord(state.editConfig)["preview"]);
  const previewStatus = asNonEmptyString(preview["status"]) || "idle";
  const previewReady = previewStatus === "ready";
  const baselineUrl =
    (previewReady ? findPreviewArtifactUrl(preview, "transform-source-baseline") : null) ||
    asNonEmptyString(source["previewUrl"]);
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
      <strong>${escapeHtml(copy.locale === "tr" ? "Dönüşüm Önizlemesi" : "Transform Preview")}</strong>
      <label>
        <span>Source / Transform / Difference</span>
        <select class="labx-select labx-select--compact" data-lab-field="workspace.comparison.viewMode">
          <option value="side-by-side" ${selectedValue === "side-by-side" ? "selected" : ""}>${escapeHtml(sourceLabel)}</option>
          <option value="stacked" ${selectedValue === "stacked" ? "selected" : ""}>${escapeHtml(transformLabel)}</option>
          <option value="difference" ${selectedValue === "difference" ? "selected" : ""}>${escapeHtml(differenceLabel)}</option>
        </select>
      </label>
      <span class="labx-strip-live-preview__status">${escapeHtml(previewReady ? "current" : previewStatus)}</span>
    </div>
    <div class="labx-strip-live-preview__viewport" data-lab-transform-comparison-viewport="true">
      ${modeUrl === null ? `<p>${escapeHtml(unavailable)}</p>` : renderPreviewMedia(sourceKind, modeUrl, modeLabel)}
    </div>
    <p class="labx-strip-live-note">${escapeHtml(
      copy.locale === "tr"
        ? "Source baseline aynı temel edit tarifini stress-transform aşamaları olmadan kullanır; Difference iki hizalı çıktı arasındaki piksel farkıdır."
        : "Source baseline uses the same base edit recipe without stress-transform stages; Difference is the pixel difference between the aligned outputs."
    )}</p>
  `;
}

function getTemporalRequest(entry: StressTestRecord) {
  const request = asLabRecord(entry["request"]);
  return entry["kind"] === "control-injection" ? asLabRecord(request["temporalRequest"]) : request;
}

function selectionKey(entry: StressTestRecord) {
  const request = getTemporalRequest(entry);
  const startSeconds = readFiniteNumber(request, "startSeconds");
  const endSeconds = readFiniteNumber(request, "endSeconds");
  if (startSeconds === null || endSeconds === null) return null;
  return JSON.stringify({
    endSeconds,
    roi: asLabRecord(request["roi"]),
    startSeconds,
  });
}

function localizeControlKind(kind: string, locale: string) {
  if (locale !== "tr") return kind;
  if (kind === "noise") return "Gürültü";
  if (kind === "blur") return "Bulanıklık";
  if (kind === "sharpen") return "Keskinleştirme";
  if (kind === "denoise") return "Gürültü azaltma";
  if (kind === "gamma") return "Gamma";
  if (kind === "black-crush") return "Siyah ezme";
  if (kind === "highlight-clipping") return "Parlak alan kırpma";
  if (kind === "chroma-suppression") return "Kroma bastırma";
  if (kind === "low-light") return "Düşük ışık";
  if (kind === "recompression") return "Yeniden sıkıştırma";
  return kind;
}

function localizeImpact(value: unknown, locale: string) {
  const impact = typeof value === "string" ? value : "unknown";
  if (locale !== "tr") return impact;
  if (impact === "negligible") return "belirsiz / çok küçük";
  if (impact === "small") return "küçük";
  if (impact === "moderate") return "belirgin";
  if (impact === "strong") return "güçlü";
  return "—";
}

function renderControlComparison(state: LabStoreState, copy: LabI18n) {
  const history = readHistory(state);
  const anchor =
    history.find(function (entry) {
      return (
        !isMotionHistoryEntry(entry) &&
        !isResponseHistoryEntry(entry) &&
        entry["kind"] !== "control-injection" &&
        selectionKey(entry) !== null
      );
    }) ||
    history.find(function (entry) {
      return entry["kind"] === "control-injection" && selectionKey(entry) !== null;
    });
  if (anchor === undefined) return "";
  const anchorKey = selectionKey(anchor);
  if (anchorKey === null) return "";

  const latestByKind = new Map<string, StressTestRecord>();
  history.forEach(function (entry) {
    if (entry["kind"] !== "control-injection" || selectionKey(entry) !== anchorKey) return;
    const kind = asNonEmptyString(asLabRecord(entry["request"])["kind"]);
    if (kind !== null && !latestByKind.has(kind)) latestByKind.set(kind, entry);
  });
  if (latestByKind.size === 0) return "";

  const rows = CONTROL_KINDS.map(function (kind) {
    const entry = latestByKind.get(kind);
    if (entry === undefined) {
      return `<tr data-control-kind="${kind}" data-status="missing"><th>${escapeHtml(localizeControlKind(kind, copy.locale))}</th><td>—</td><td>—</td><td>—</td><td>—</td></tr>`;
    }
    const interpretation = asLabRecord(entry["interpretation"]);
    const delta = asLabRecord(entry["delta"]);
    return `<tr data-control-kind="${kind}" data-status="ready">
      <th>${escapeHtml(localizeControlKind(kind, copy.locale))}</th>
      <td>${escapeHtml(localizeImpact(interpretation["overallImpact"], copy.locale))}</td>
      <td>${escapeHtml(formatSigned(readFiniteNumber(delta, "meanFrameDifferenceEnergy")))}</td>
      <td>${escapeHtml(formatSigned(readEdgePersistence(delta), true))}</td>
      <td>${escapeHtml(formatSigned(readFiniteNumber(delta, "lumaRange")))}</td>
    </tr>`;
  }).join("");

  const anchorRequest = getTemporalRequest(anchor);
  const startSeconds = readFiniteNumber(anchorRequest, "startSeconds");
  const endSeconds = readFiniteNumber(anchorRequest, "endSeconds");
  const rangeLabel =
    startSeconds === null || endSeconds === null
      ? ""
      : `${startSeconds.toFixed(2)}–${endSeconds.toFixed(2)} s`;

  return `
    <section class="labx-strip-live-comparison" data-lab-control-comparison="true">
      <div class="labx-strip-live-comparison__header">
        <strong>${escapeHtml(copy.locale === "tr" ? "Aynı Seçimde Control Karşılaştırması" : "Controls on the Same Selection")}</strong>
        <span>${escapeHtml(rangeLabel)}</span>
      </div>
      <div class="labx-strip-live-comparison__table-wrap">
        <table>
          <thead><tr><th>Control</th><th>${escapeHtml(copy.locale === "tr" ? "Etki" : "Impact")}</th><th>Δ Frame</th><th>Δ Edge</th><th>Δ Luma</th></tr></thead>
          <tbody>${rows}</tbody>
        </table>
      </div>
    </section>
  `;
}

export function renderWorkspaceStressTestLiveResults(state: LabStoreState, copy: LabI18n) {
  const history = readHistory(state);
  const legacySummaryConfig = buildLegacyStressSummaryEditConfig(state.editConfig);
  const summaries = renderWorkspaceStressTestSummaries(legacySummaryConfig, copy);
  const motionSummaries = renderWorkspaceMotionImpactSummaries(state.editConfig, copy);
  const visualResponseSummaries = renderWorkspaceVisualResponseSummaries(state.editConfig, copy);
  const comparison = renderControlComparison(state, copy);
  const hasResultContent =
    history.length > 0 ||
    summaries.trim() !== "" ||
    motionSummaries.trim() !== "" ||
    visualResponseSummaries.trim() !== "" ||
    comparison.trim() !== "";

  return `
    <div class="labx-strip-expanded labx-strip-expanded--live" data-lab-process-expanded="true" data-lab-live-results="true">
      <div class="labx-strip-live-column labx-strip-live-column--preview">
        ${renderLiveTransformPreview(state, copy)}
      </div>
      <div class="labx-strip-live-column labx-strip-live-column--results">
        <div class="labx-strip-live-heading">
          <strong>${escapeHtml(copy.locale === "tr" ? "Canlı Sonuçlar" : "Live Results")}</strong>
          <span>${escapeHtml(copy.locale === "tr" ? "Manuel stress-test çıktıları" : "Manual stress-test output")}</span>
        </div>
        <div class="labx-strip-live-results__scroll">
          ${
            hasResultContent
              ? `${summaries}${motionSummaries}${visualResponseSummaries}${comparison}`
              : `<div class="labx-strip-live-empty">${escapeHtml(copy.locale === "tr" ? "Henüz manuel test sonucu yok." : "No manual test result yet.")}</div>`
          }
        </div>
      </div>
    </div>
  `;
}
