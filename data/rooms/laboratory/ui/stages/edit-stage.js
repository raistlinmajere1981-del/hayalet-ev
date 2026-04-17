import { escapeHtml } from "../../models/lab-types.js";
import {
  getActiveEditOutput,
  getEditOutputs,
  getEditPreview,
  getProjectEdit,
  getSourceProbeStatus
} from "../../runtime/lab-selectors.js";
import { renderCompactCard } from "../components/compact-card.js";
import { renderEmptyState } from "../components/empty-state.js";
import { renderPrimaryCTA } from "../components/primary-cta.js";
import { renderStageHeader } from "../components/stage-header.js";
import { renderStatusChip } from "../components/status-chip.js";
function getEditAdvancedControlsVisible(editMode, advancedOpen) {
  return editMode === "advanced" || advancedOpen;
}
function getActiveOutputLabel(activeOutput) {
  if (!activeOutput) {
    return "source";
  }
  const fileName = typeof activeOutput["fileName"] === "string" ? activeOutput["fileName"] : null;
  const outputId = typeof activeOutput["id"] === "string" ? activeOutput["id"] : null;
  return fileName || outputId || "derived";
}
export function renderEditStage(deps) {
  const editConfig = getProjectEdit(deps.state);
  const preview = getEditPreview(deps.state);
  const outputs = getEditOutputs(deps.state);
  const activeOutput = getActiveEditOutput(deps.state);
  const sourceReady = getSourceProbeStatus(deps.state) === "completed";
  const drafts = deps.state.ui.editDrafts;
  const editMode = typeof editConfig["mode"] === "string" ? editConfig["mode"] : "beginner";
  const handoffMode = typeof editConfig["handoffMode"] === "string" ? editConfig["handoffMode"] : "source";
  const previewStatus = typeof preview["status"] === "string" ? preview["status"] : "idle";
  const advancedControlsVisible = getEditAdvancedControlsVisible(editMode, drafts.advancedOpen);
  const activeOutputLabel = getActiveOutputLabel(activeOutput);
  const main = `
    ${renderStageHeader({
    eyebrow: "Stage 02 · Edit",
    stageIndex: 2,
    stageTotal: 5,
    statusLabel: previewStatus,
    statusTone: previewStatus === "ready" ? "success" : previewStatus === "failed" ? "error" : "neutral",
    subtitle: "Çekirdek kontrolleri öne al. Preview gerçeği dışında hiçbir şeyi tamamlandı gibi gösterme.",
    title: "Düzene"
  })}
    ${sourceReady !== true ? renderEmptyState({
    title: "Kaynak hazır değil",
    description: "Önce source stage içinde gerçek bir kaynak probe tamamlanmalı.",
    hint: "Edit preview aksiyonu kaynak olmadan açılmaz."
  }) : `
          <div class="labx-grid labx-grid--edit">
            ${renderCompactCard({
    eyebrow: "Operator Mode",
    title: "Operatör Modu",
    body: `
                <div class="labx-chip-row">
                  ${["beginner", "advanced"].map(function(entry) {
      return `
                        <button
                          class="labx-chip-button"
                          type="button"
                          data-lab-action="edit-mode"
                          data-lab-value="${entry}"
                          data-selected="${entry === editMode ? "true" : "false"}"
                        >
                          ${escapeHtml(entry)}
                        </button>
                      `;
    }).join("")}
                </div>
                <label class="labx-field">
                  <span>Output Alias</span>
                  <input class="labx-input" data-lab-field="edit.outputNameHint" value="${escapeHtml(drafts.outputNameHint)}" placeholder="edit-pass-a" />
                </label>
                <label class="labx-field">
                  <span>Notes</span>
                  <textarea class="labx-textarea" data-lab-field="edit.notes" placeholder="Operator notes">${escapeHtml(drafts.notes)}</textarea>
                </label>
              `
  })}
            ${renderCompactCard({
    eyebrow: "Source Ref",
    title: "Aktif Handoff",
    body: `
                <div class="labx-summary-list">
                  <div><span>Handoff</span><strong>${escapeHtml(handoffMode)}</strong></div>
                  <div><span>Preview Ref</span><strong>${escapeHtml(drafts.activeSourceRef)}</strong></div>
                  <div><span>Aktif Output</span><strong>${escapeHtml(activeOutputLabel)}</strong></div>
                </div>
                ${advancedControlsVisible ? `
                      <div class="labx-inline-grid">
                        <label class="labx-field">
                          <span>Handoff</span>
                          <select class="labx-select" data-lab-field="edit.handoffMode">
                            ${["source", "derived"].map(function(entry) {
      return `<option value="${entry}" ${entry === handoffMode ? "selected" : ""}>${escapeHtml(entry)}</option>`;
    }).join("")}
                          </select>
                        </label>
                        <label class="labx-field">
                          <span>Preview Referansı</span>
                          <select class="labx-select" data-lab-field="edit.activeSourceRef">
                            ${["original", "preview"].map(function(entry) {
      return `<option value="${entry}" ${entry === drafts.activeSourceRef ? "selected" : ""}>${escapeHtml(entry)}</option>`;
    }).join("")}
                          </select>
                        </label>
                      </div>
                      <div class="labx-list-stack">
                        ${outputs.length > 0 ? outputs.map(function(output) {
      const outputId = typeof output["id"] === "string" ? output["id"] : "";
      return `
                                    <label class="labx-choice-row">
                                      <input type="radio" name="edit-output" data-lab-field="edit.activeOutputId" value="${escapeHtml(outputId)}" ${activeOutput === output ? "checked" : ""} />
                                      <span>${escapeHtml(
        typeof output["fileName"] === "string" ? output["fileName"] : outputId
      )}</span>
                                    </label>
                                  `;
    }).join("") : `<p class="labx-panel-hint">Henüz derived output üretilmedi.</p>`}
                      </div>
                    ` : `<p class="labx-panel-hint">Gelişmiş görünümü açarak handoff ve output seçimlerini düzenleyin.</p>`}
              `,
    footer: renderPrimaryCTA({
      action: "primary-action",
      detail: deps.primaryDetail || null,
      disabled: deps.primaryDisabled,
      label: deps.primaryLabel
    })
  })}
          </div>
        `}
  `;
  const side = [
    renderCompactCard({
      eyebrow: "Preview",
      title: "Kaydedilmiş Önizleme",
      body: previewStatus === "ready" ? `
            <div class="labx-summary-list">
              <div><span>Durum</span>${renderStatusChip("ready", "success")}</div>
              <div><span>Dosya</span><strong>${escapeHtml(
        typeof preview["fileName"] === "string" ? preview["fileName"] : "--"
      )}</strong></div>
              <div><span>Path</span><strong>${escapeHtml(
        typeof preview["path"] === "string" ? preview["path"] : "--"
      )}</strong></div>
            </div>
          ` : renderEmptyState({
        title: "Preview yok",
        description: "Edit stage gerçek preview üretmeden derived kaynağa geçmez.",
        hint: "Primary CTA preview job başlatır."
      })
    }),
    renderCompactCard({
      eyebrow: "Advanced",
      title: "İleri Kontroller",
      body: `
        <label class="labx-choice-row">
          <input type="checkbox" data-lab-field="edit.advancedOpen" ${drafts.advancedOpen ? "checked" : ""} />
          <span>Advanced section açık</span>
        </label>
        <p class="labx-panel-hint">${advancedControlsVisible ? "Handoff, preview referansı ve output seçimleri görünür durumda." : "İleri kontroller kapalı. İlk ekranda yalnız çekirdek kontroller görünür."}</p>
        ${editMode === "advanced" ? `<p class="labx-panel-hint">Operatör modu advanced seçildiği için gelişmiş bölüm açık tutulur.</p>` : ""}
      `
    })
  ].join("");
  return { main, side };
}
