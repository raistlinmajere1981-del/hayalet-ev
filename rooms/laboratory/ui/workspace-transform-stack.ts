import { asLabRecord, escapeHtml } from "../domain/lab-types.js";
import type { LabEditConfig, LabFeatureId } from "../domain/lab-types.js";
import { getLaboratoryControlInjectionDefinitions } from "../shared/control-injection-model.js";
import type {
  LaboratoryControlInjectionDefinition,
  LaboratoryControlInjectionKind,
} from "../shared/control-injection-model.js";
import type { LaboratoryTemporalStressTestRequest } from "../shared/temporal-stress-test-model.js";
import {
  getLaboratoryTransformStageDefinition,
  getLaboratoryTransformStageDefinitions,
  normalizeLaboratoryTransformStages,
} from "../shared/transform-stress-test-model.js";
import type {
  LaboratoryTransformStage,
  LaboratoryTransformStageParameter,
  LaboratoryTransformStageScope,
} from "../shared/transform-stress-test-model.js";
import type {
  LaboratoryTransformPreviewMode,
  LaboratoryTransformStackSourceKind,
} from "../shared/transform-stack-render-context.js";
import { resolveLaboratoryTrackingPreviewCache } from "../shared/tracking-preview-model.js";
import { LAB_FALLBACK_I18N } from "./lab-i18n.js";
import type { LabI18n } from "./lab-i18n.js";

type WorkspaceTransformStackInput = {
  baselinePreviewUrl?: string | null;
  differencePreviewUrl?: string | null;
  editConfig: LabEditConfig | null;
  featureId?: LabFeatureId;
  locked?: boolean;
  previewStatus?: string;
  showPreview?: boolean;
  sourceKind: LaboratoryTransformStackSourceKind;
  sourcePreviewUrl?: string | null;
  scope: LaboratoryTransformStageScope;
  temporalRequest?: LaboratoryTemporalStressTestRequest | null;
  transformPreviewMode?: LaboratoryTransformPreviewMode;
  transformPreviewUrl?: string | null;
};

function renderActionFeedbackAttributes(copy: LabI18n) {
  return [
    'data-lab-action-feedback="true"',
    `data-lab-feedback-running="${escapeHtml(copy.t("mediaAnalysis.transformStressTest.actionStatus.running", "Working…"))}"`,
    `data-lab-feedback-success="${escapeHtml(copy.t("mediaAnalysis.transformStressTest.actionStatus.success", "Completed"))}"`,
    `data-lab-feedback-error="${escapeHtml(copy.t("mediaAnalysis.transformStressTest.actionStatus.error", "Failed"))}"`,
    'aria-live="polite"',
  ].join(" ");
}

function readTransformStages(input: WorkspaceTransformStackInput) {
  const recipe = asLabRecord(input.editConfig?.recipe);
  if (input.scope === "audio") {
    return normalizeLaboratoryTransformStages(
      asLabRecord(recipe["audio"])["transformStages"],
      "audio"
    );
  }
  const visualRecipe =
    input.sourceKind === "image" ? asLabRecord(recipe["image"]) : asLabRecord(recipe["video"]);
  return normalizeLaboratoryTransformStages(visualRecipe["transformStages"], "visual");
}

function readLatestCameraTrackingCache(input: WorkspaceTransformStackInput) {
  return resolveLaboratoryTrackingPreviewCache(input.editConfig);
}

function getScopeRecipeSection(input: WorkspaceTransformStackInput) {
  if (input.scope === "audio") return "audio";
  return input.sourceKind === "image" ? "image" : "video";
}

function renderParameterControl(
  stage: LaboratoryTransformStage,
  parameter: LaboratoryTransformStageParameter,
  scope: LaboratoryTransformStageScope,
  locked: boolean
) {
  const rawValue = stage.params[parameter.id] ?? parameter.defaultValue;
  const commonAttributes = [
    `data-lab-transform-scope="${escapeHtml(scope)}"`,
    `data-lab-transform-stage-id="${escapeHtml(stage.id)}"`,
    `data-lab-transform-parameter-id="${escapeHtml(parameter.id)}"`,
  ].join(" ");
  const disabledAttribute = locked ? " disabled" : "";

  if (parameter.kind === "select") {
    return `
      <label class="labx-control-row labx-transform-stage__parameter">
        <span class="labx-control-row__label">${escapeHtml(parameter.label)}</span>
        <select class="labx-select" ${commonAttributes}${disabledAttribute}>
          ${(parameter.options || [])
            .map(function (option) {
              return `<option value="${escapeHtml(option.value)}" ${String(rawValue) === option.value ? "selected" : ""}>${escapeHtml(option.label)}</option>`;
            })
            .join("")}
        </select>
      </label>`;
  }

  return `
    <label class="labx-control-row labx-transform-stage__parameter">
      <span class="labx-control-row__label">${escapeHtml(parameter.label)}</span>
      <input
        class="labx-number"
        type="number"
        value="${escapeHtml(String(rawValue))}"
        ${parameter.min === undefined ? "" : `min="${String(parameter.min)}"`}
        ${parameter.max === undefined ? "" : `max="${String(parameter.max)}"`}
        ${parameter.step === undefined ? "" : `step="${String(parameter.step)}"`}
        ${commonAttributes}${disabledAttribute}
      />
      ${parameter.unit ? `<span class="labx-control-row__value">${escapeHtml(parameter.unit)}</span>` : ""}
    </label>`;
}

function renderStageRow(
  stage: LaboratoryTransformStage,
  index: number,
  stageCount: number,
  scope: LaboratoryTransformStageScope,
  locked: boolean
) {
  const definition = getLaboratoryTransformStageDefinition(stage.kind);
  return `
    <article class="labx-card labx-transform-stage" data-lab-transform-stage="${escapeHtml(stage.id)}" data-enabled="${stage.enabled ? "true" : "false"}">
      <div class="labx-card__body">
        <div class="labx-transform-stage__header">
          <label class="labx-control-toggle">
            <input type="checkbox" ${stage.enabled ? "checked" : ""}
              data-lab-transform-scope="${escapeHtml(scope)}"
              data-lab-transform-stage-id="${escapeHtml(stage.id)}"
              data-lab-transform-stage-enabled="true" ${locked ? "disabled" : ""} />
            <span>${escapeHtml(`${index + 1}. ${definition.label}`)}</span>
          </label>
          <div class="labx-control-stepper" aria-label="Transform order">
            <button class="labx-control-stepper__btn" type="button" data-lab-action="workspace-transform-stage-move"
              data-lab-transform-scope="${escapeHtml(scope)}" data-lab-transform-stage-id="${escapeHtml(stage.id)}"
              data-lab-transform-direction="up" ${locked || index === 0 ? "disabled" : ""} title="Move up">↑</button>
            <button class="labx-control-stepper__btn" type="button" data-lab-action="workspace-transform-stage-move"
              data-lab-transform-scope="${escapeHtml(scope)}" data-lab-transform-stage-id="${escapeHtml(stage.id)}"
              data-lab-transform-direction="down" ${locked || index === stageCount - 1 ? "disabled" : ""} title="Move down">↓</button>
            <button class="labx-control-stepper__btn" type="button" data-lab-action="workspace-transform-stage-remove"
              data-lab-transform-scope="${escapeHtml(scope)}" data-lab-transform-stage-id="${escapeHtml(stage.id)}"
              ${locked ? "disabled" : ""} title="Remove stage">×</button>
          </div>
        </div>
        ${definition.parameters
          .map((parameter) => renderParameterControl(stage, parameter, scope, locked))
          .join("")}
      </div>
    </article>`;
}

function renderTransformPreviewMedia(
  sourceKind: LaboratoryTransformStackSourceKind,
  url: string,
  label: string
) {
  if (sourceKind === "video") {
    return `<video class="labx-preview-media" controls preload="metadata" src="${escapeHtml(url)}" aria-label="${escapeHtml(label)}"></video>`;
  }
  return `<img class="labx-preview-media" src="${escapeHtml(url)}" alt="${escapeHtml(label)}" />`;
}

function renderTransformComparisonPreview(
  input: WorkspaceTransformStackInput,
  enabledCount: number,
  copy: LabI18n
) {
  if (input.scope !== "visual") return "";
  const mode = input.transformPreviewMode || "source";
  const baselineUrl = input.baselinePreviewUrl || input.sourcePreviewUrl || null;
  const modeUrl =
    mode === "transform"
      ? input.transformPreviewUrl || null
      : mode === "difference"
        ? input.differencePreviewUrl || null
        : baselineUrl;
  const sourceLabel = copy.t("mediaAnalysis.stages.source", "Source");
  const differenceLabel = copy.t(
    "mediaAnalysis.operations.comparison.viewModes.difference",
    "Difference"
  );
  const transformLabel = "Transform";
  const selectedValue =
    mode === "difference" ? "difference" : mode === "transform" ? "stacked" : "side-by-side";
  const previewStatus = input.previewStatus || "idle";
  const previewCurrent = previewStatus === "ready";
  const unavailableHint =
    enabledCount === 0
      ? copy.locale === "tr"
        ? "Difference için en az bir etkin görsel dönüşüm aşaması ekleyin."
        : "Add at least one enabled visual transform stage to produce Difference."
      : previewStatus === "stale"
        ? copy.t(
            "mediaAnalysis.edit.previewStates.stale",
            "Preview is stale. Generate a fresh preview before trusting the current frame."
          )
        : copy.locale === "tr"
          ? "Bu görünüm için önce Zinciri Önizle ile güncel artefaktları üretin."
          : "Generate a current Preview Stack before using this view.";

  return `
    <section class="labx-card labx-transform-comparison" data-lab-transform-comparison="true"
      data-lab-transform-preview-mode="${escapeHtml(mode)}" data-lab-transform-preview-status="${escapeHtml(previewStatus)}">
      <div class="labx-card__body">
        <div class="labx-control-row labx-control-row--select">
          <span class="labx-control-row__label">Source / Transform / Difference</span>
          <select class="labx-select labx-select--compact" data-lab-field="workspace.comparison.viewMode" ${input.locked ? "disabled" : ""}>
            <option value="side-by-side" ${selectedValue === "side-by-side" ? "selected" : ""}>${escapeHtml(sourceLabel)}</option>
            <option value="stacked" ${selectedValue === "stacked" ? "selected" : ""}>${escapeHtml(transformLabel)}</option>
            <option value="difference" ${selectedValue === "difference" ? "selected" : ""}>${escapeHtml(differenceLabel)}</option>
          </select>
          <span class="labx-control-row__value">${previewCurrent ? "current" : escapeHtml(previewStatus)}</span>
        </div>
        <p class="labx-card__meta">${escapeHtml(
          copy.locale === "tr"
            ? "Source baseline aynı temel edit tarifini stress-transform aşamaları olmadan kullanır; Difference iki hizalı çıktı arasındaki piksel farkıdır."
            : "Source baseline uses the same base edit recipe without stress-transform stages; Difference is the pixel difference between the aligned outputs."
        )}</p>
        <div class="labx-transform-comparison__viewport" data-lab-transform-comparison-viewport="true">
          ${
            modeUrl === null
              ? `<div class="labx-empty-state"><p>${escapeHtml(unavailableHint)}</p></div>`
              : renderTransformPreviewMedia(
                  input.sourceKind,
                  modeUrl,
                  mode === "source"
                    ? sourceLabel
                    : mode === "difference"
                      ? differenceLabel
                      : transformLabel
                )
          }
        </div>
      </div>
    </section>`;
}

function renderTemporalScanControl(input: WorkspaceTransformStackInput, copy: LabI18n) {
  if (input.scope !== "visual" || input.sourceKind !== "video") return "";
  const request = input.temporalRequest ?? null;
  const disabled = input.locked === true || request === null;
  const hint =
    request === null
      ? copy.locale === "tr"
        ? "Önce timeline üzerinde bir zaman aralığı seçin. Taramalar en fazla 6 saniyeyi ve varsa seçili ROI'yi ölçer."
        : "Select a timeline range first. Probes measure at most six seconds and use the selected ROI when present."
      : copy.locale === "tr"
        ? `${request.startSeconds.toFixed(2)}–${request.endSeconds.toFixed(2)} sn · ${request.roi === null ? "tam kare" : "ROI"} · ${request.sampleFps} fps`
        : `${request.startSeconds.toFixed(2)}–${request.endSeconds.toFixed(2)} s · ${request.roi === null ? "full frame" : "ROI"} · ${request.sampleFps} fps`;
  return `
    <div class="labx-transform-stack__temporal" data-lab-temporal-scan="true">
      <div class="labx-controls-actions">
        <button class="labx-inline-action labx-transform-action" type="button"
          data-lab-action="workspace-transform-temporal-scan" ${renderActionFeedbackAttributes(copy)} ${disabled ? "disabled" : ""}>Temporal Scan</button>
        <button class="labx-inline-action labx-transform-action" type="button"
          data-lab-action="workspace-photometric-attenuation" ${renderActionFeedbackAttributes(copy)} ${disabled ? "disabled" : ""}>${escapeHtml(copy.locale === "tr" ? "Fotometrik Test" : "Photometric Probe")}</button>
      </div>
      <p class="labx-card__meta">${escapeHtml(hint)}</p>
    </div>`;
}

function renderMotionImpactPanel(input: WorkspaceTransformStackInput, copy: LabI18n) {
  if (input.scope !== "visual" || input.sourceKind !== "video") return "";
  const request = input.temporalRequest ?? null;
  const disabled = input.locked === true || request === null;
  const referenceDisabled = disabled || request.roi === null;
  const hint =
    request === null
      ? copy.locale === "tr"
        ? "Önce timeline aralığı seçin. Referans/Background kilidi için hedefin yanındaki sabit bir ROI seçilebilir."
        : "Select a timeline range first. A stable ROI beside the target can be locked as the Reference/Background region."
      : copy.locale === "tr"
        ? "Bu kilit iki amaç taşır: Motion için kamera referansı; Visibility/Transition testleri için Background ROI. Önce arka planı kilitleyip sonra Target ROI'yi seçin."
        : "The lock has two roles: camera-motion reference for Motion, and Background ROI for Visibility/Transition probes. Lock background first, then select the Target ROI.";
  return `
    <section class="labx-card labx-transform-motion-impact" data-lab-motion-impact="true">
      <div class="labx-card__body">
        <p class="labx-card__eyebrow">Motion / Reference ROI</p>
        <div class="labx-controls-actions">
          <button class="labx-inline-action labx-transform-action" type="button"
            data-lab-action="workspace-motion-reference-lock" ${renderActionFeedbackAttributes(copy)} ${referenceDisabled ? "disabled" : ""}>${escapeHtml(copy.locale === "tr" ? "Referans / Background ROI Kilitle" : "Lock Reference / Background ROI")}</button>
          <button class="labx-inline-action labx-transform-action" type="button"
            data-lab-action="workspace-motion-probe" ${renderActionFeedbackAttributes(copy)} ${disabled ? "disabled" : ""}>Motion Probe</button>
          <button class="labx-inline-action labx-transform-action" type="button"
            data-lab-action="workspace-impact-window-compare" ${renderActionFeedbackAttributes(copy)} ${disabled ? "disabled" : ""}>Impact ±500 ms</button>
        </div>
        <p class="labx-card__meta">${escapeHtml(hint)}</p>
      </div>
    </section>`;
}

function renderTrackingPreviewPanel(input: WorkspaceTransformStackInput, copy: LabI18n) {
  if (input.scope !== "visual" || input.sourceKind !== "video") return "";
  const cache = readLatestCameraTrackingCache(input);
  const quality = cache?.quality ?? null;
  const mode = cache?.mode ?? null;
  const cacheId = cache?.cacheId ?? null;
  const hint =
    cache === null
      ? copy.locale === "tr"
        ? "Henüz Camera Tracking cache yok. Transition veya Visibility Response çalıştırıldığında cache üretilecek."
        : "No Camera Tracking cache yet. A Transition or Visibility Response run will create it."
      : copy.locale === "tr"
        ? `Tracking quality: ${quality?.toUpperCase()} · ${mode} · önizleme timeline'da Mikro Zoom'un yanından açılır.`
        : `Tracking quality: ${quality?.toUpperCase()} · ${mode} · open the preview beside Micro Zoom on the timeline.`;
  return `
    <section class="labx-card labx-tracking-preview-panel" data-lab-tracking-preview-panel="true">
      <div class="labx-card__body">
        <p class="labx-card__eyebrow">ROI Tracking / Stabilization</p>
        <p class="labx-card__meta" data-lab-tracking-preview-status="true">${escapeHtml(hint)}</p>
        ${cacheId === null ? "" : `<span hidden data-lab-tracking-cache-id="${escapeHtml(cacheId)}"></span>`}
      </div>
    </section>`;
}

const TR_CONTROL_LABELS: Partial<Record<LaboratoryControlInjectionKind, string>> = {
  noise: "Gürültü",
  blur: "Bulanıklık",
  sharpen: "Keskinleştirme",
  denoise: "Gürültü Azaltma",
  gamma: "Gamma Stress",
  "black-crush": "Siyah Ezme",
  "highlight-clipping": "Parlak Alan Kırpma",
  "chroma-suppression": "Kroma Bastırma",
  "low-light": "Düşük Işık",
  recompression: "Yeniden Sıkıştırma 18→36",
  "recompression-ladder": "Codec Merdiveni · CRF 18→42",
  "response-exposure": "Response · Exposure",
  "response-gamma": "Response · Gamma",
  "response-brightness": "Response · Brightness",
  "response-black-level": "Response · Black Level",
  "response-contrast": "Response · Contrast",
  "response-local-contrast": "Response · Local Contrast",
  "response-blur": "Response · Blur",
  "response-denoise": "Response · Denoise",
  "response-sharpen": "Response · Sharpen",
  "appearance-transition": "Ortaya Çıkma / Kaybolma Geçişi",
};

function getLocalizedControlLabel(kind: LaboratoryControlInjectionKind, copy: LabI18n) {
  const definition = getLaboratoryControlInjectionDefinitions().find(
    (entry) => entry.kind === kind
  );
  if (copy.locale !== "tr") return definition?.label || kind;
  return TR_CONTROL_LABELS[kind] || definition?.label || kind;
}

function getControlGroupLabel(group: LaboratoryControlInjectionDefinition["group"], copy: LabI18n) {
  if (group === "response") return copy.locale === "tr" ? "Response Curves" : "Response Curves";
  if (group === "transition") return copy.locale === "tr" ? "Geçiş Analizi" : "Transition Analysis";
  return copy.locale === "tr" ? "Sensor / Codec Stress" : "Sensor / Codec Stress";
}

function renderControlOptions(definitions: LaboratoryControlInjectionDefinition[], copy: LabI18n) {
  const groups: Array<NonNullable<LaboratoryControlInjectionDefinition["group"]>> = [
    "destruction",
    "response",
    "transition",
  ];
  return groups
    .map(function (group) {
      const members = definitions.filter(
        (definition) => (definition.group || "destruction") === group
      );
      if (members.length === 0) return "";
      return `<optgroup label="${escapeHtml(getControlGroupLabel(group, copy))}">${members
        .map(
          (definition) =>
            `<option value="${escapeHtml(definition.kind)}">${escapeHtml(getLocalizedControlLabel(definition.kind, copy))}</option>`
        )
        .join("")}</optgroup>`;
    })
    .join("");
}

function renderControlInjectionPanel(input: WorkspaceTransformStackInput, copy: LabI18n) {
  if (input.scope !== "visual" || input.sourceKind !== "video") return "";
  const request = input.temporalRequest ?? null;
  const disabled = input.locked === true || request === null;
  const definitions = getLaboratoryControlInjectionDefinitions();
  const title = copy.locale === "tr" ? "Görsel Stress Probları" : "Visual Stress Probes";
  const hint =
    request === null
      ? copy.locale === "tr"
        ? "Önce gerçek bir timeline aralığı seçin. Diferansiyel testlerde ayrıca Background ROI kilidi gerekir."
        : "Select a real timeline range first. Differential tests also require a locked Background ROI."
      : copy.locale === "tr"
        ? "Sensor/Codec kontrolleri aynı trim/ROI üzerinde paired bozulma üretir. Response Curves, kilitli Background ROI ile seçili Target ROI'yi aynı sweep boyunca paralel ölçer. Transition testi seçim orta noktasını olay anı kabul edip PRE / EVENT / POST pencerelerini karşılaştırır."
        : "Sensor/Codec controls produce paired degradation on the same trim/ROI. Response Curves measure the locked Background ROI and selected Target ROI through the same sweep. Transition treats the selection midpoint as the event and compares PRE / EVENT / POST windows.";
  return `
    <section class="labx-card labx-transform-control-injection" data-lab-control-injection="true">
      <div class="labx-card__body">
        <p class="labx-card__eyebrow">${escapeHtml(title)}</p>
        <div class="labx-controls-actions">
          <select class="labx-select" data-lab-control-injection-kind="true" aria-label="Visual stress probe" ${disabled ? "disabled" : ""}>
            ${renderControlOptions(definitions, copy)}
          </select>
          <button class="labx-inline-action labx-transform-action" type="button"
            data-lab-action="workspace-control-injection-run" ${renderActionFeedbackAttributes(copy)} ${disabled ? "disabled" : ""}>${escapeHtml(copy.locale === "tr" ? "Testi Çalıştır" : "Run Probe")}</button>
        </div>
        <p class="labx-card__meta">${escapeHtml(hint)}</p>
      </div>
    </section>`;
}

export function renderWorkspaceTransformStack(
  input: WorkspaceTransformStackInput,
  copy: LabI18n = LAB_FALLBACK_I18N
) {
  const stages = readTransformStages(input);
  const definitions = getLaboratoryTransformStageDefinitions(input.scope);
  const recipeSection = getScopeRecipeSection(input);
  const enabledCount = stages.filter((stage) => stage.enabled).length;
  const locked = input.locked === true;
  const latestTrackingCache = readLatestCameraTrackingCache(input);
  const title =
    input.scope === "audio"
      ? copy.t("mediaAnalysis.transformStressTest.audioTitle", "Audio Transform Stack")
      : copy.t("mediaAnalysis.transformStressTest.visualTitle", "Visual Transform Stack");

  return `
    <section class="labx-card labx-controls-card labx-transform-stack"
      data-lab-transform-stack="${escapeHtml(input.scope)}"
      data-lab-transform-recipe-section="${escapeHtml(recipeSection)}"
      data-lab-transform-source-kind="${escapeHtml(input.sourceKind)}"
      data-lab-transform-feature-id="${escapeHtml(input.featureId || "media-analysis")}"
      data-lab-transform-locked="${locked ? "true" : "false"}"
      data-lab-transform-stages-json="${escapeHtml(JSON.stringify(stages))}"
      data-lab-temporal-request-json="${escapeHtml(JSON.stringify(input.temporalRequest ?? null))}"
      data-lab-camera-tracking-cache-json="${escapeHtml(JSON.stringify(latestTrackingCache))}">
      <div class="labx-card__body">
        <div class="labx-transform-stack__header">
          <div>
            <p class="labx-card__eyebrow">${escapeHtml(title)}</p>
            <p class="labx-card__meta">${escapeHtml(
              copy.t(
                "mediaAnalysis.transformStressTest.orderHint",
                "Order is part of the experiment recipe; changing it changes the result."
              )
            )}</p>
          </div>
          <span class="labx-card__meta">${escapeHtml(`${enabledCount}/${stages.length}`)}</span>
        </div>

        ${input.showPreview === false ? "" : renderTransformComparisonPreview(input, enabledCount, copy)}
        ${renderTemporalScanControl(input, copy)}
        ${renderMotionImpactPanel(input, copy)}
        ${renderTrackingPreviewPanel(input, copy)}
        ${renderControlInjectionPanel(input, copy)}

        <div class="labx-controls-stack" data-lab-transform-stage-list="${escapeHtml(input.scope)}">
          ${
            stages.length === 0
              ? `<p class="labx-card__meta">${escapeHtml(
                  copy.t(
                    "mediaAnalysis.transformStressTest.empty",
                    "No transform stages. Source remains unchanged."
                  )
                )}</p>`
              : stages
                  .map((stage, index) =>
                    renderStageRow(stage, index, stages.length, input.scope, locked)
                  )
                  .join("")
          }
        </div>

        <div class="labx-controls-actions labx-transform-stack__add">
          <select class="labx-select" data-lab-transform-add-kind="${escapeHtml(input.scope)}"
            aria-label="${escapeHtml(copy.t("mediaAnalysis.transformStressTest.addStage", "Add transform stage"))}" ${locked ? "disabled" : ""}>
            ${definitions
              .map(
                (definition) =>
                  `<option value="${escapeHtml(definition.kind)}">${escapeHtml(definition.label)}</option>`
              )
              .join("")}
          </select>
          <button class="labx-inline-action labx-transform-action" type="button"
            data-lab-action="workspace-transform-stage-add" data-lab-transform-scope="${escapeHtml(input.scope)}"
            ${renderActionFeedbackAttributes(copy)} ${locked ? "disabled" : ""}>${escapeHtml(copy.t("mediaAnalysis.transformStressTest.addAction", "Add Stage"))}</button>
          <button class="labx-inline-action labx-transform-action" type="button"
            data-lab-action="workspace-transform-preview" data-lab-transform-scope="${escapeHtml(input.scope)}"
            ${renderActionFeedbackAttributes(copy)} ${locked ? "disabled" : ""}>${escapeHtml(copy.t("mediaAnalysis.transformStressTest.previewAction", "Preview Stack"))}</button>
        </div>
      </div>
    </section>`;
}
