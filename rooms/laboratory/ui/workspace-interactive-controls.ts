import { asLabRecord, escapeHtml } from "../domain/lab-types.js";
import type { LabEditConfig, LabInteractiveSettings } from "../domain/lab-types.js";
import { readLaboratoryTransformStackRenderContext } from "../shared/transform-stack-render-context.js";
import { LAB_FALLBACK_I18N } from "./lab-i18n.js";
import type { LabI18n } from "./lab-i18n.js";
import { renderWorkspaceTransformStack } from "./workspace-transform-stack.js";

function renderSlider(
  label: string,
  field: string,
  value: number,
  min: number,
  max: number,
  step: number,
  unit: string,
  resetValue: number
) {
  const fullField = `workspace.interactive.${field}`;
  const escapedLabel = escapeHtml(label);
  return `
    <div class="labx-control-row">
      <span class="labx-control-row__label">${escapedLabel}</span>
      <input
        class="labx-range"
        type="range"
        min="${String(min)}"
        max="${String(max)}"
        step="${String(step)}"
        value="${String(value)}"
        data-lab-field="${escapeHtml(fullField)}"
      />
      <span class="labx-control-row__value">${String(value)}${unit}</span>
      <div class="labx-control-stepper" aria-label="${escapedLabel}">
        <button class="labx-control-stepper__btn" type="button" data-lab-action="workspace-setting-adjust" data-lab-field="${escapeHtml(fullField)}" data-lab-delta="-${String(step)}" data-lab-min="${String(min)}" data-lab-max="${String(max)}" data-lab-step="${String(step)}" data-lab-reset-value="${String(resetValue)}" title="Decrease ${escapedLabel}">-</button>
        <button class="labx-control-stepper__btn" type="button" data-lab-action="workspace-setting-adjust" data-lab-field="${escapeHtml(fullField)}" data-lab-reset="true" data-lab-min="${String(min)}" data-lab-max="${String(max)}" data-lab-step="${String(step)}" data-lab-reset-value="${String(resetValue)}" title="Reset ${escapedLabel}">R</button>
        <button class="labx-control-stepper__btn" type="button" data-lab-action="workspace-setting-adjust" data-lab-field="${escapeHtml(fullField)}" data-lab-delta="${String(step)}" data-lab-min="${String(min)}" data-lab-max="${String(max)}" data-lab-step="${String(step)}" data-lab-reset-value="${String(resetValue)}" title="Increase ${escapedLabel}">+</button>
      </div>
    </div>
  `;
}

function renderToggle(label: string, field: string, active: boolean) {
  return `
    <label class="labx-control-toggle">
      <input
        type="checkbox"
        ${active ? "checked" : ""}
        data-lab-field="workspace.interactive.${field}"
      />
      <span>${escapeHtml(label)}</span>
    </label>
  `;
}

function readFiniteMetric(record: Record<string, unknown>, key: string) {
  const value = record[key];
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function formatMetric(value: number | null) {
  return value === null ? "—" : value.toFixed(3);
}

function formatPercent(value: number | null) {
  return value === null ? "—" : `${Math.round(value * 100)}%`;
}

function renderLatestTemporalStressSummary(editConfig: LabEditConfig | null, copy: LabI18n) {
  const edit = asLabRecord(editConfig);
  const history = Array.isArray(edit["temporalStressTests"]) ? edit["temporalStressTests"] : [];
  const latest = asLabRecord(history[0]);
  if (Object.keys(latest).length === 0) {
    return "";
  }
  const request = asLabRecord(latest["request"]);
  const metrics = asLabRecord(latest["metrics"]);
  const summary = asLabRecord(metrics["summary"]);
  const startSeconds = readFiniteMetric(request, "startSeconds");
  const endSeconds = readFiniteMetric(request, "endSeconds");
  const windowLabel =
    startSeconds === null || endSeconds === null
      ? "—"
      : `${startSeconds.toFixed(2)}–${endSeconds.toFixed(2)} s`;
  const meanDifference = readFiniteMetric(summary, "meanFrameDifferenceEnergy");
  const peakDifference = readFiniteMetric(summary, "peakFrameDifferenceEnergy");
  const edgePersistence = readFiniteMetric(summary, "edgePersistenceRatio");
  const lumaRange = readFiniteMetric(summary, "lumaRange");
  const chromaURange = readFiniteMetric(summary, "chromaURange");
  const chromaVRange = readFiniteMetric(summary, "chromaVRange");
  const title = copy.locale === "tr" ? "Son Temporal Tarama" : "Latest Temporal Scan";

  return `
    <section class="labx-card labx-controls-card" data-lab-temporal-stress-summary="true">
      <div class="labx-card__body">
        <p class="labx-card__eyebrow">${escapeHtml(title)}</p>
        <p class="labx-card__meta">${escapeHtml(windowLabel)} · ${asLabRecord(request["roi"])["width"] === undefined ? (copy.locale === "tr" ? "tam kare" : "full frame") : "ROI"}</p>
        <div class="labx-controls-stack">
          <div class="labx-control-row"><span class="labx-control-row__label">Frame Δ mean / peak</span><span class="labx-control-row__value">${escapeHtml(`${formatMetric(meanDifference)} / ${formatMetric(peakDifference)}`)}</span></div>
          <div class="labx-control-row"><span class="labx-control-row__label">Edge persistence</span><span class="labx-control-row__value">${escapeHtml(formatPercent(edgePersistence))}</span></div>
          <div class="labx-control-row"><span class="labx-control-row__label">Luma range</span><span class="labx-control-row__value">${escapeHtml(formatMetric(lumaRange))}</span></div>
          <div class="labx-control-row"><span class="labx-control-row__label">Chroma U / V range</span><span class="labx-control-row__value">${escapeHtml(`${formatMetric(chromaURange)} / ${formatMetric(chromaVRange)}`)}</span></div>
        </div>
      </div>
    </section>
  `;
}

export function renderWorkspaceInteractiveControls(
  settings: LabInteractiveSettings,
  copy: LabI18n = LAB_FALLBACK_I18N
) {
  const transformContext = readLaboratoryTransformStackRenderContext(settings);
  const transformStackMarkup =
    transformContext !== null &&
    (transformContext.sourceKind === "video" || transformContext.sourceKind === "image")
      ? renderWorkspaceTransformStack(
          {
            editConfig: transformContext.editConfig,
            featureId: transformContext.featureId,
            locked: transformContext.locked,
            sourceKind: transformContext.sourceKind,
            scope: "visual",
            ...(transformContext.baselinePreviewUrl === undefined
              ? {}
              : { baselinePreviewUrl: transformContext.baselinePreviewUrl }),
            ...(transformContext.differencePreviewUrl === undefined
              ? {}
              : { differencePreviewUrl: transformContext.differencePreviewUrl }),
            ...(transformContext.previewStatus === undefined
              ? {}
              : { previewStatus: transformContext.previewStatus }),
            ...(transformContext.sourcePreviewUrl === undefined
              ? {}
              : { sourcePreviewUrl: transformContext.sourcePreviewUrl }),
            ...(transformContext.temporalRequest === undefined
              ? {}
              : { temporalRequest: transformContext.temporalRequest }),
            ...(transformContext.transformPreviewMode === undefined
              ? {}
              : { transformPreviewMode: transformContext.transformPreviewMode }),
            ...(transformContext.transformPreviewUrl === undefined
              ? {}
              : { transformPreviewUrl: transformContext.transformPreviewUrl }),
          },
          copy
        )
      : "";
  const temporalSummaryMarkup =
    transformContext?.sourceKind === "video"
      ? renderLatestTemporalStressSummary(transformContext.editConfig, copy)
      : "";

  return `
    <section class="labx-card labx-controls-card labx-workspace-focus-row__panel" data-tone="accent">
      <div class="labx-card__body">
        <p class="labx-card__meta">${escapeHtml(
          copy.t(
            "mediaAnalysis.transformStressTest.liveControlsHint",
            "Live controls affect only the workspace view. Transform Stack below is the reproducible recipe."
          )
        )}</p>
        <div class="labx-controls-stack">
          ${renderSlider(copy.t("mediaAnalysis.interactiveControls.fields.brightness", "Brightness"), "brightness", settings.brightness, 0, 200, 1, "%", 100)}
          ${renderSlider(copy.t("mediaAnalysis.interactiveControls.fields.contrast", "Contrast"), "contrast", settings.contrast, 0, 200, 1, "%", 100)}
          ${renderSlider(copy.t("mediaAnalysis.interactiveControls.fields.gamma", "Gamma"), "gamma", settings.gamma, 0.1, 5.0, 0.1, "", 1)}
          ${renderSlider(copy.t("mediaAnalysis.interactiveControls.fields.saturation", "Saturation"), "saturation", settings.saturation, 0, 200, 1, "%", 100)}
          ${renderSlider(copy.t("mediaAnalysis.interactiveControls.fields.hueRotate", "Hue Rotate"), "hueRotate", settings.hueRotate, 0, 360, 1, "°", 0)}
          ${renderSlider(copy.t("mediaAnalysis.interactiveControls.fields.sharpness", "Sharpness"), "sharpness", settings.sharpness, 0, 200, 1, "%", 100)}
        </div>
        <div class="labx-controls-toggles">
          <p class="labx-card__eyebrow">${escapeHtml(copy.t("mediaAnalysis.interactiveControls.channelTitle", "CHANNEL ISOLATE"))}</p>
          <div class="labx-toggle-row">
            ${renderToggle("R", "channelR", settings.channelR)}
            ${renderToggle("G", "channelG", settings.channelG)}
            ${renderToggle("B", "channelB", settings.channelB)}
          </div>
          ${renderToggle(copy.t("mediaAnalysis.interactiveControls.fields.edgeHighlight", "Edge Highlight"), "edgeHighlight", settings.edgeHighlight)}
          ${renderToggle(copy.t("mediaAnalysis.interactiveControls.fields.invert", "Invert"), "invert", settings.invert)}
        </div>
        <div class="labx-controls-actions">
          <button class="labx-inline-action" type="button" data-lab-action="workspace-reset-controls">${escapeHtml(copy.t("mediaAnalysis.interactiveControls.resetAction", "Reset All"))}</button>
        </div>
      </div>
    </section>
    ${transformStackMarkup}
    ${temporalSummaryMarkup}
  `;
}
