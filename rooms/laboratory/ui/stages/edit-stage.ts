import { asLabRecord, escapeHtml, formatDurationSeconds } from "../../models/lab-types.js";
import type { LabStageSurface, LabStoreState } from "../../models/lab-types.js";
import {
  getCurrentPreflight,
  getEditPreview,
  getProjectEdit,
  getProjectSource,
  getSelectedProfileModel,
  getSourceKind,
  getSourceMetadata,
  getSourceProbeStatus,
  getProcessAnalysisScope,
} from "../../runtime/lab-selectors.js";
import { renderAnalysisScopeSummary } from "../components/analysis-scope-summary.js";
import { renderCompactCard } from "../components/compact-card.js";
import { renderEmptyState } from "../components/empty-state.js";
import { renderPrimaryCTA } from "../components/primary-cta.js";
import { renderStageHeader } from "../components/stage-header.js";
import { renderStatusChip } from "../components/status-chip.js";

type EditStageRenderDeps = {
  primaryDetail?: string | null;
  primaryDisabled?: boolean;
  primaryLabel: string;
  state: LabStoreState;
};

function getInputValue(value: unknown) {
  return typeof value === "number" && Number.isFinite(value) ? String(value) : "";
}

function getPreviewMedia(sourceKind: string, previewUrl: string | null) {
  if (!previewUrl) {
    return `
      <div class="labx-empty-state">
        <strong class="labx-empty-state__title">Aktif yüzey yok</strong>
        <p class="labx-empty-state__description">Kaynak veya türetilmiş önizleme hazır olduğunda burada görünür.</p>
      </div>
    `;
  }
  if (sourceKind === "image") {
    return `<img class="labx-preview-media labx-preview-media--image" src="${escapeHtml(previewUrl)}" alt="Edit preview" />`;
  }
  if (sourceKind === "audio") {
    return `<audio class="labx-preview-media labx-preview-media--audio" src="${escapeHtml(previewUrl)}" controls preload="metadata"></audio>`;
  }
  return `<video class="labx-preview-media labx-preview-media--video" src="${escapeHtml(previewUrl)}" controls preload="metadata" playsinline></video>`;
}

export function renderEditStage(deps: EditStageRenderDeps): LabStageSurface {
  const sourceReady = getSourceProbeStatus(deps.state) === "completed";
  const source = getProjectSource(deps.state);
  const editConfig = getProjectEdit(deps.state);
  const preview = getEditPreview(deps.state);
  const metadata = getSourceMetadata(deps.state);
  const sourceKind = getSourceKind(deps.state);
  const scope = getProcessAnalysisScope(deps.state);
  const preflight = getCurrentPreflight(deps.state);
  const selectedModel = getSelectedProfileModel(deps.state);
  const drafts = deps.state.ui.editDrafts;
  const profileDrafts = deps.state.ui.profileDrafts;
  const previewStatus = typeof preview["status"] === "string" ? preview["status"] : "idle";
  const previewUrl =
    (typeof preview["previewUrl"] === "string" ? preview["previewUrl"] : null) ||
    (typeof preview["path"] === "string" ? preview["path"] : null) ||
    (typeof source["previewUrl"] === "string" ? source["previewUrl"] : null);
  const editRecipe = asLabRecord(editConfig["recipe"]);
  const commonRecipe = asLabRecord(editRecipe["common"]);
  const isAudioSource = sourceKind === "audio";
  const isVisualSource = sourceKind === "video" || sourceKind === "image";

  const main = `
    ${renderStageHeader({
      eyebrow: "Aşama 02 · Düzenle",
      stageIndex: 2,
      stageTotal: 4,
      statusLabel: previewStatus,
      statusTone:
        previewStatus === "ready" ? "success" : previewStatus === "failed" ? "error" : "neutral",
      subtitle:
        isAudioSource
          ? "Çalışma yüzeyi burada hazırlanır. Zaman aralığı, odak ve transcript destek kapsamı burada belirlenir."
          : "Çalışma yüzeyi burada hazırlanır. Zaman aralığı, frame aralığı, bölge seçimi ve düşük maliyetli önizleme ayarları burada belirlenir.",
      title: "Edit Workspace",
    })}
    ${
      sourceReady !== true
        ? renderEmptyState({
            title: "Kaynak hazır değil",
            description: "Önce kaynak probe tamamlanmalı.",
            hint: "Kaynak aşamasında gerçek bir medya girdisi hazır olduğunda çalışma alanı açılır.",
          })
        : `
          <section class="labx-workspace-stage">
            <div class="labx-workspace-stage__surface">
              <div class="labx-preview-frame labx-preview-frame--workspace">
                ${getPreviewMedia(sourceKind, previewUrl)}
              </div>
              <div class="labx-workspace-strip">
                <div class="labx-workspace-strip__row">
                  <label class="labx-field">
                    <span>Zaman Başlangıcı (ms)</span>
                    <input class="labx-input" type="number" min="0" data-lab-field="scope.timeStartMs" value="${escapeHtml(getInputValue(scope?.timeRange?.startMs))}" />
                  </label>
                  <label class="labx-field">
                    <span>Zaman Bitişi (ms)</span>
                    <input class="labx-input" type="number" min="0" data-lab-field="scope.timeEndMs" value="${escapeHtml(getInputValue(scope?.timeRange?.endMs))}" />
                  </label>
                  <label class="labx-field">
                    <span>Odak</span>
                    <select class="labx-select" data-lab-field="scope.focus">
                      ${["visual", "audio", "cross-modal"]
                        .map(function (entry) {
                          return `<option value="${entry}" ${(scope?.focus || "visual") === entry ? "selected" : ""}>${escapeHtml(entry)}</option>`;
                        })
                        .join("")}
                    </select>
                  </label>
                </div>
                <div class="labx-workspace-strip__row">
                  ${
                    isVisualSource
                      ? `
                        <label class="labx-field">
                          <span>Frame Başlangıcı</span>
                          <input class="labx-input" type="number" min="0" data-lab-field="scope.frameStart" value="${escapeHtml(getInputValue(scope?.frameRange?.startFrame))}" />
                        </label>
                        <label class="labx-field">
                          <span>Frame Bitişi</span>
                          <input class="labx-input" type="number" min="0" data-lab-field="scope.frameEnd" value="${escapeHtml(getInputValue(scope?.frameRange?.endFrame))}" />
                        </label>
                      `
                      : `
                        <div class="labx-summary-list">
                          <div><span>Transcript</span><strong>Support artifact</strong></div>
                          <div><span>Search</span><strong>Selected ranges</strong></div>
                        </div>
                      `
                  }
                  <label class="labx-field">
                    <span>Not / Hipotez</span>
                    <input class="labx-input" data-lab-field="scope.hypothesis" value="${escapeHtml(scope?.hypothesis || "")}" placeholder="check splice around 01:30" />
                  </label>
                </div>
              </div>
            </div>
            <div class="labx-workspace-stage__tools">
              ${
                isVisualSource
                  ? renderCompactCard({
                      eyebrow: "Frame / ROI",
                      title: "Kapsam Hazırlığı",
                      body: `
                        <div class="labx-inline-grid">
                          <label class="labx-field">
                            <span>ROI X</span>
                            <input class="labx-input" type="number" min="0" data-lab-field="scope.regionX" value="${escapeHtml(getInputValue(scope?.region?.x))}" />
                          </label>
                          <label class="labx-field">
                            <span>ROI Y</span>
                            <input class="labx-input" type="number" min="0" data-lab-field="scope.regionY" value="${escapeHtml(getInputValue(scope?.region?.y))}" />
                          </label>
                          <label class="labx-field">
                            <span>ROI Genişlik</span>
                            <input class="labx-input" type="number" min="1" data-lab-field="scope.regionWidth" value="${escapeHtml(getInputValue(scope?.region?.width))}" />
                          </label>
                          <label class="labx-field">
                            <span>ROI Yükseklik</span>
                            <input class="labx-input" type="number" min="1" data-lab-field="scope.regionHeight" value="${escapeHtml(getInputValue(scope?.region?.height))}" />
                          </label>
                        </div>
                        <p class="labx-panel-hint">Bu değerler process başladığında freeze edilir. Sonradan değişirse yeni run oluşmalıdır.</p>
                      `,
                    })
                  : renderCompactCard({
                      eyebrow: "Audio Range",
                      title: "Ses Kapsamı",
                      body: `
                        <div class="labx-summary-list">
                          <div><span>Odak</span><strong>${escapeHtml(scope?.focus || "audio")}</strong></div>
                          <div><span>Zaman Penceresi</span><strong>${escapeHtml(scope?.timeRange ? `${Math.round(scope.timeRange.startMs / 1000)}s - ${Math.round(scope.timeRange.endMs / 1000)}s` : "--")}</strong></div>
                          <div><span>Transcript</span><strong>Timestamped support</strong></div>
                        </div>
                      `,
                    })
              }
              ${
                isVisualSource
                  ? renderCompactCard({
                      eyebrow: "Visual Controls",
                      title: "Gerçek Zamanlı Hafif Ayarlar",
                      body: `
                        <div class="labx-summary-list">
                          <div><span>Brightness</span><strong>${escapeHtml(String(commonRecipe["brightness"] ?? "default"))}</strong></div>
                          <div><span>Contrast</span><strong>${escapeHtml(String(commonRecipe["contrast"] ?? "default"))}</strong></div>
                          <div><span>Gamma</span><strong>${escapeHtml(String(commonRecipe["gamma"] ?? "default"))}</strong></div>
                        </div>
                        <p class="labx-panel-hint">Bu yüzey düşük maliyetli görsel kontroller için ayrılmıştır. Ağır dönüşümler process içinde job olarak çalışır.</p>
                      `,
                    })
                  : ""
              }
              ${renderCompactCard({
                eyebrow: "Audio Focus",
                title: "Ses Odağı",
                body: `
                  <div class="labx-summary-list">
                    <div><span>Kaynak Süresi</span><strong>${escapeHtml(formatDurationSeconds(metadata["durationSeconds"]))}</strong></div>
                    <div><span>Seçili Odak</span><strong>${escapeHtml(scope?.focus || "visual")}</strong></div>
                    <div><span>Zaman Penceresi</span><strong>${escapeHtml(scope?.timeRange ? `${Math.round(scope.timeRange.startMs / 1000)}s - ${Math.round(scope.timeRange.endMs / 1000)}s` : "--")}</strong></div>
                  </div>
                `,
              })}
            </div>
          </section>
        `
    }
  `;

  const side = [
    renderCompactCard({
      eyebrow: "Scope Snapshot",
      title: "Hazırlanan Kapsam",
      body: renderAnalysisScopeSummary(scope, null),
    }),
    renderCompactCard({
      eyebrow: "Run Configuration",
      title: "Çalıştırma Ayarları",
      body: `
        <div class="labx-inline-actions">
          <button class="labx-inline-action" type="button" data-lab-action="toggle-edit-side-panel">
            ${deps.state.ui.editSidePanelCollapsed ? "Paneli Aç" : "Paneli Daralt"}
          </button>
        </div>
        ${
          deps.state.ui.editSidePanelCollapsed
            ? `<p class="labx-panel-hint">Run configuration şu an gizli.</p>`
            : `
              <div class="labx-list-stack">
                <label class="labx-field">
                  <span>Depth</span>
                  <select class="labx-select" data-lab-field="profile.depth">
                    ${["balanced", "fast", "deep"]
                      .map(function (entry) {
                        return `<option value="${entry}" ${profileDrafts.depth === entry ? "selected" : ""}>${escapeHtml(entry)}</option>`;
                      })
                      .join("")}
                  </select>
                </label>
                <label class="labx-field">
                  <span>Frame Density</span>
                  <select class="labx-select" data-lab-field="profile.frameSampleDensity">
                    ${["balanced", "sparse", "dense"]
                      .map(function (entry) {
                        return `<option value="${entry}" ${profileDrafts.frameSampleDensity === entry ? "selected" : ""}>${escapeHtml(entry)}</option>`;
                      })
                      .join("")}
                  </select>
                </label>
                <label class="labx-field">
                  <span>Sensitivity</span>
                  <input class="labx-input" type="number" min="0.1" max="1" step="0.05" data-lab-field="profile.sensitivity" value="${escapeHtml(String(profileDrafts.sensitivity ?? ""))}" />
                </label>
                <label class="labx-field">
                  <span>Transcript Sample (sn)</span>
                  <input class="labx-input" type="number" min="5" max="600" data-lab-field="profile.transcriptSampleSeconds" value="${escapeHtml(String(profileDrafts.transcriptSampleSeconds ?? ""))}" />
                </label>
                <label class="labx-field">
                  <span>Model</span>
                  <select class="labx-select" data-lab-field="profile.modelId">
                    <option value="">Varsayılan</option>
                    ${deps.state.profileModels
                      .map(function (entry) {
                        const record = asLabRecord(entry);
                        const id = typeof record["id"] === "string" ? record["id"] : "";
                        const label = typeof record["label"] === "string" ? record["label"] : id;
                        return `<option value="${escapeHtml(id)}" ${selectedModel && selectedModel["id"] === id ? "selected" : ""}>${escapeHtml(label)}</option>`;
                      })
                      .join("")}
                  </select>
                </label>
              </div>
            `
        }
      `,
    }),
    renderCompactCard({
      eyebrow: "Edit Output",
      title: "Uygulanan Ayarlar",
      body: `
        <div class="labx-summary-list">
          <div><span>Output Alias</span><strong>${escapeHtml(drafts.outputNameHint || "--")}</strong></div>
          <div><span>Notes</span><strong>${escapeHtml(drafts.notes || "--")}</strong></div>
          <div><span>Preview</span>${renderStatusChip(previewStatus, previewStatus === "ready" ? "success" : "neutral")}</div>
        </div>
      `,
      footer: renderPrimaryCTA({
        action: "primary-action",
        detail: deps.primaryDetail || null,
        disabled: deps.primaryDisabled,
        label: deps.primaryLabel,
      }),
    }),
    renderCompactCard({
      eyebrow: "Preflight",
      title: "Hazırlık Özeti",
      body: `
        <div class="labx-summary-list">
          <div><span>Durum</span>${renderStatusChip(preflight.status, preflight.status === "ready" ? "success" : preflight.status === "warning" ? "warning" : "error")}</div>
          <div><span>Yetenek</span><strong>${escapeHtml(String(preflight.enabledModules.length))}</strong></div>
          <div><span>Tahmini Süre</span><strong>${escapeHtml(formatDurationSeconds(preflight.estimatedRuntime))}</strong></div>
        </div>
        ${preflight.reason ? `<p class="labx-panel-hint">${escapeHtml(preflight.reason)}</p>` : ""}
        ${preflight.warnings.length > 0 ? `<p class="labx-panel-hint">${escapeHtml(preflight.warnings.join(" | "))}</p>` : ""}
      `,
      footer: preflight.stageReady
        ? `<button class="labx-inline-action" type="button" data-lab-stage="process">İşlem Aşamasına Geç</button>`
        : null,
    }),
  ].join("");

  return { main, side };
}
