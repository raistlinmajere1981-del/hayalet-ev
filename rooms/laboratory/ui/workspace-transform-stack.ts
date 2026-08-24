import { asLabRecord, escapeHtml } from "../domain/lab-types.js";
import type { LabEditConfig } from "../domain/lab-types.js";
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
import { LAB_FALLBACK_I18N } from "./lab-i18n.js";
import type { LabI18n } from "./lab-i18n.js";

type LaboratoryWorkspaceSourceKind = "video" | "audio" | "image";

type WorkspaceTransformStackInput = {
  editConfig: LabEditConfig | null;
  sourceKind: LaboratoryWorkspaceSourceKind;
  scope: LaboratoryTransformStageScope;
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
  scope: LaboratoryTransformStageScope
) {
  const rawValue = stage.params[parameter.id] ?? parameter.defaultValue;
  const commonAttributes = [
    `data-lab-transform-scope="${escapeHtml(scope)}"`,
    `data-lab-transform-stage-id="${escapeHtml(stage.id)}"`,
    `data-lab-transform-parameter-id="${escapeHtml(parameter.id)}"`,
  ].join(" ");

  if (parameter.kind === "select") {
    return `
      <label class="labx-control-row labx-transform-stage__parameter">
        <span class="labx-control-row__label">${escapeHtml(parameter.label)}</span>
        <select class="labx-select" ${commonAttributes}>
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
        ${commonAttributes}
      />
      ${parameter.unit ? `<span class="labx-control-row__value">${escapeHtml(parameter.unit)}</span>` : ""}
    </label>
  `;
}

function renderStageRow(
  stage: LaboratoryTransformStage,
  index: number,
  stageCount: number,
  scope: LaboratoryTransformStageScope
) {
  const definition = getLaboratoryTransformStageDefinition(stage.kind);
  if (definition === undefined) {
    return "";
  }
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
              ${index === 0 ? "disabled" : ""}
              title="Move up"
            >↑</button>
            <button
              class="labx-control-stepper__btn"
              type="button"
              data-lab-action="workspace-transform-stage-move"
              data-lab-transform-scope="${escapeHtml(scope)}"
              data-lab-transform-stage-id="${escapeHtml(stage.id)}"
              data-lab-transform-direction="down"
              ${index === stageCount - 1 ? "disabled" : ""}
              title="Move down"
            >↓</button>
            <button
              class="labx-control-stepper__btn"
              type="button"
              data-lab-action="workspace-transform-stage-remove"
              data-lab-transform-scope="${escapeHtml(scope)}"
              data-lab-transform-stage-id="${escapeHtml(stage.id)}"
              title="Remove stage"
            >×</button>
          </div>
        </div>
        ${definition.parameters
          .map((parameter) => renderParameterControl(stage, parameter, scope))
          .join("")}
      </div>
    </article>
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
  const title =
    input.scope === "audio"
      ? copy.t("mediaAnalysis.transformStressTest.audioTitle", "Audio Transform Stack")
      : copy.t("mediaAnalysis.transformStressTest.visualTitle", "Visual Transform Stack");

  return `
    <section
      class="labx-card labx-controls-card labx-transform-stack"
      data-lab-transform-stack="${escapeHtml(input.scope)}"
      data-lab-transform-recipe-section="${escapeHtml(recipeSection)}"
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
                  .map((stage, index) => renderStageRow(stage, index, stages.length, input.scope))
                  .join("")
          }
        </div>

        <div class="labx-controls-actions labx-transform-stack__add">
          <select
            class="labx-select"
            data-lab-transform-add-kind="${escapeHtml(input.scope)}"
            aria-label="${escapeHtml(copy.t("mediaAnalysis.transformStressTest.addStage", "Add transform stage"))}"
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
          >${escapeHtml(copy.t("mediaAnalysis.transformStressTest.addAction", "Add Stage"))}</button>
          <button
            class="labx-inline-action"
            type="button"
            data-lab-action="workspace-transform-preview"
            data-lab-transform-scope="${escapeHtml(input.scope)}"
          >${escapeHtml(copy.t("mediaAnalysis.transformStressTest.previewAction", "Preview Stack"))}</button>
        </div>
      </div>
    </section>
  `;
}

export const __testOnlyWorkspaceTransformStack = {
  getScopeRecipeSection,
  readTransformStages,
};
