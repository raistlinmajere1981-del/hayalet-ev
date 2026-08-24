import { asLabRecord, escapeHtml } from "../domain/lab-types.js";
import type { LabEditConfig, LabFeatureId } from "../domain/lab-types.js";
import { getLaboratoryControlInjectionDefinitions } from "../shared/control-injection-model.js";
import type { LaboratoryControlInjectionKind } from "../shared/control-injection-model.js";
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

function getScopeRecipeSection(input: WorkspaceTransformStackInput) {
  if (input.scope === "audio") {
    return "audio";
  }
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
      </label>
    `;
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
    </label>
  `;
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
    <article
      class="labx-card labx-transform-stage"
      data-lab-transform-stage="${escapeHtml(stage.id)}"
      data-enabled="${stage.enabled ? "true" : "false"}"
    >
      <div class="labx-card__body">
        <div class="labx-transform-stage__header">
          <label class="labx-control-toggle">
            <input
              type="checkbox"
              ${stage.enabled ? "checked" : ""}
              data-lab-transform-scope="${escapeHtml(scope)}"
              data-lab-transform-stage-id="${escapeHtml(stage.id)}"
              data-lab-transform-stage-enabled="true"
              ${locked ? "disabled" : ""}
            />
            <span>${escapeHtml(`${index + 1}. ${definition.label}`)}</span>
          </label>
          <div class="labx-control-stepper" aria-label="Transform order">
            <button
              class="labx-control-stepper__btn"
              type="button"
              data-lab-action="workspace-transform-stage-move"
              data-lab-transform-scope="${escapeHtml(scope)}"
              data-lab-transform-stage-id="${escapeHtml(stage.id)}"
              data-lab-transform-direction="up"
              ${locked || index === 0 ? "disabled" : ""}
              title="Move up"
            >↑</button>
            <button
              class="labx-control-stepper__btn"
              type="button"
              data-lab-action="workspace-transform-stage-move"
              data-lab-transform-scope="${escapeHtml(scope)}"
              data-lab-transform-stage-id="${escapeHtml(stage.id)}"
              data-lab-transform-direction="down"
              ${locked || index === stageCount - 1 ? "disabled" : ""}
              title="Move down"
            >↓</button>
            <button
              class="labx-control-stepper__btn"
              type="button"
              data-lab-action="workspace-transform-stage-remove"
              data-lab-transform-scope="${escapeHtml(scope)}"
              data-lab-transform-stage-id="${escapeHtml(stage.id)}"
              ${locked ? "disabled" : ""}
              title="Remove stage"
            >×</button>
          </div>
        </div>
        ${definition.parameters
          .map((parameter) => renderParameterControl(stage, parameter, scope, locked))
          .join("")}
      </div>
    </article>
  `;
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
  if (input.scope !== "visual") {
    return "";
  }
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
    <section
      class="labx-card labx-transform-comparison"
      data-lab-transform-comparison="true"
      data-lab-transform-preview-mode="${escapeHtml(mode)}"
      data-lab-transform-preview-status="${escapeHtml(previewStatus)}"
    >
      <div class="labx-card__body">
        <div class="labx-control-row labx-control-row--select">
          <span class="labx-control-row__label">Source / Transform / Difference</span>
          <select
            class="labx-select labx-select--compact"
            data-lab-field="workspace.comparison.viewMode"
            ${input.locked ? "disabled" : ""}
          >
            <option value="side-by-side" ${selectedValue === "side-by-side" ? "selected" : ""}>${escapeHtml(sourceLabel)}</option>
            <option value="stacked" ${selectedValue === "stacked" ? "selected" : ""}>${escapeHtml(transformLabel)}</option>
            <option value="difference" ${selectedValue === "difference" ? "selected" : ""}>${escapeHtml(differenceLabel)}</option>
          </select>
          <span class="labx-control-row__value">${previewCurrent ? "current" : escapeHtml(previewStatus)}</span>
        </div>
        <p class="labx-card__meta">${escapeHtml(
          copy.locale === "tr"
            ? "Source baseline aynı temel edit tarifini kullanır fakat stress-transform aşamalarını uygulamaz; Difference yalnız bu iki hizalı çıktı arasındaki piksel farkıdır."
            : "Source baseline uses the same base edit recipe without stress-transform stages; Difference is the pixel difference between those aligned outputs."
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
    </section>
  `;
}

function renderTemporalScanControl(input: WorkspaceTransformStackInput, copy: LabI18n) {
  if (input.scope !== "visual" || input.sourceKind !== "video") {
    return "";
  }
  const request = input.temporalRequest ?? null;
  const disabled = input.locked === true || request === null;
  const hint =
    request === null
      ? copy.locale === "tr"
        ? "Önce timeline üzerinde bir zaman aralığı seçin. Tarama en fazla 6 saniyeyi ve varsa seçili ROI'yi ölçer."
        : "Select a timeline range first. The scan measures at most six seconds and uses the selected ROI when present."
      : copy.locale === "tr"
        ? `${request.startSeconds.toFixed(2)}–${request.endSeconds.toFixed(2)} sn · ${request.roi === null ? "tam kare" : "ROI"} · ${request.sampleFps} fps`
        : `${request.startSeconds.toFixed(2)}–${request.endSeconds.toFixed(2)} s · ${request.roi === null ? "full frame" : "ROI"} · ${request.sampleFps} fps`;
  return `
    <div class="labx-transform-stack__temporal" data-lab-temporal-scan="true">
      <button
        class="labx-inline-action"
        type="button"
        data-lab-action="workspace-transform-temporal-scan"
        ${disabled ? "disabled" : ""}
      >Temporal Scan</button>
      <p class="labx-card__meta">${escapeHtml(hint)}</p>
    </div>
  `;
}

function getLocalizedControlLabel(kind: LaboratoryControlInjectionKind, copy: LabI18n) {
  if (copy.locale !== "tr") {
    return (
      getLaboratoryControlInjectionDefinitions().find((entry) => entry.kind === kind)?.label || kind
    );
  }
  if (kind === "noise") return "Gürültü";
  if (kind === "blur") return "Bulanıklık";
  if (kind === "sharpen") return "Keskinleştirme";
  if (kind === "low-light") return "Düşük ışık";
  return "Yeniden sıkıştırma";
}

function renderControlInjectionPanel(input: WorkspaceTransformStackInput, copy: LabI18n) {
  if (input.scope !== "visual" || input.sourceKind !== "video") {
    return "";
  }
  const request = input.temporalRequest ?? null;
  const disabled = input.locked === true || request === null;
  const definitions = getLaboratoryControlInjectionDefinitions();
  const title = copy.locale === "tr" ? "Destruction Controls" : "Destruction Controls";
  const hint =
    request === null
      ? copy.locale === "tr"
        ? "Control testi için önce gerçek bir timeline aralığı seçin."
        : "Select a real timeline range before running a control test."
      : copy.locale === "tr"
        ? "Her koşu aynı trim/ROI ve codec ailesiyle paired çıktılar üretir; fark yalnız seçilen filtreyi veya recompression için encode kalitesini izole eder."
        : "Each run creates paired outputs with the same trim/ROI and codec family; the delta isolates only the selected filter or, for recompression, encode quality.";
  return `
    <section class="labx-card labx-transform-control-injection" data-lab-control-injection="true">
      <div class="labx-card__body">
        <p class="labx-card__eyebrow">${escapeHtml(title)}</p>
        <div class="labx-controls-actions">
          <select
            class="labx-select"
            data-lab-control-injection-kind="true"
            aria-label="Destruction control"
            ${disabled ? "disabled" : ""}
          >
            ${definitions
              .map(function (definition) {
                return `<option value="${escapeHtml(definition.kind)}">${escapeHtml(getLocalizedControlLabel(definition.kind, copy))}</option>`;
              })
              .join("")}
          </select>
          <button
            class="labx-inline-action"
            type="button"
            data-lab-action="workspace-control-injection-run"
            ${disabled ? "disabled" : ""}
          >${escapeHtml(copy.locale === "tr" ? "Control Çalıştır" : "Run Control")}</button>
        </div>
        <p class="labx-card__meta">${escapeHtml(hint)}</p>
      </div>
    </section>
  `;
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
  const title =
    input.scope === "audio"
      ? copy.t("mediaAnalysis.transformStressTest.audioTitle", "Audio Transform Stack")
      : copy.t("mediaAnalysis.transformStressTest.visualTitle", "Visual Transform Stack");

  return `
    <section
      class="labx-card labx-controls-card labx-transform-stack"
      data-lab-transform-stack="${escapeHtml(input.scope)}"
      data-lab-transform-recipe-section="${escapeHtml(recipeSection)}"
      data-lab-transform-source-kind="${escapeHtml(input.sourceKind)}"
      data-lab-transform-feature-id="${escapeHtml(input.featureId || "media-analysis")}"
      data-lab-transform-locked="${locked ? "true" : "false"}"
      data-lab-transform-stages-json="${escapeHtml(JSON.stringify(stages))}"
      data-lab-temporal-request-json="${escapeHtml(JSON.stringify(input.temporalRequest ?? null))}"
    >
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
          <select
            class="labx-select"
            data-lab-transform-add-kind="${escapeHtml(input.scope)}"
            aria-label="${escapeHtml(copy.t("mediaAnalysis.transformStressTest.addStage", "Add transform stage"))}"
            ${locked ? "disabled" : ""}
          >
            ${definitions
              .map(
                (definition) =>
                  `<option value="${escapeHtml(definition.kind)}">${escapeHtml(definition.label)}</option>`
              )
              .join("")}
          </select>
          <button
            class="labx-inline-action"
            type="button"
            data-lab-action="workspace-transform-stage-add"
            data-lab-transform-scope="${escapeHtml(input.scope)}"
            ${locked ? "disabled" : ""}
          >${escapeHtml(copy.t("mediaAnalysis.transformStressTest.addAction", "Add Stage"))}</button>
          <button
            class="labx-inline-action"
            type="button"
            data-lab-action="workspace-transform-preview"
            data-lab-transform-scope="${escapeHtml(input.scope)}"
            ${locked ? "disabled" : ""}
          >${escapeHtml(copy.t("mediaAnalysis.transformStressTest.previewAction", "Preview Stack"))}</button>
        </div>
      </div>
    </section>
  `;
}
