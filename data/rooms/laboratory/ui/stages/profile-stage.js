import { escapeHtml, formatDurationSeconds } from "../../models/lab-types.js";
import {
  getActiveEditOutput,
  getCurrentPreflight,
  getProfileModelCatalog,
  getProjectProfile,
  getSelectedProfileModel
} from "../../runtime/lab-selectors.js";
import { renderCompactCard } from "../components/compact-card.js";
import { renderPrimaryCTA } from "../components/primary-cta.js";
import { renderStageHeader } from "../components/stage-header.js";
import { renderStatusChip } from "../components/status-chip.js";
function getProfileAdvancedControlsVisible(mode) {
  return mode === "advanced";
}
function getSelectedProfileModelLabel(selectedModel) {
  if (!selectedModel) {
    return "default";
  }
  const label = typeof selectedModel["label"] === "string" ? selectedModel["label"] : null;
  const modelId = typeof selectedModel["id"] === "string" ? selectedModel["id"] : null;
  return label || modelId || "default";
}
export function renderProfileStage(deps) {
  const profileConfig = getProjectProfile(deps.state);
  const preflight = getCurrentPreflight(deps.state);
  const models = getProfileModelCatalog(deps.state);
  const selectedModel = getSelectedProfileModel(deps.state);
  const activeOutput = getActiveEditOutput(deps.state);
  const targetMode = typeof profileConfig["targetAssetMode"] === "string" ? profileConfig["targetAssetMode"] : "source";
  const mode = typeof profileConfig["mode"] === "string" ? profileConfig["mode"] : "beginner";
  const drafts = deps.state.ui.profileDrafts;
  const tone = preflight.status === "ready" ? "success" : preflight.status === "warning" ? "warning" : "error";
  const advancedControlsVisible = getProfileAdvancedControlsVisible(mode);
  const selectedModelLabel = getSelectedProfileModelLabel(selectedModel);
  const main = `
    ${renderStageHeader({
    eyebrow: "Stage 03 · Profile",
    stageIndex: 3,
    stageTotal: 5,
    statusLabel: preflight.status,
    statusTone: tone,
    subtitle: "Preflight banner doğrudan runtime sonucuna bağlanır. Yorum yok, string guessing yok.",
    title: "Profil"
  })}
    <div class="labx-grid labx-grid--profile">
      ${renderCompactCard({
    eyebrow: "Profile Mode",
    title: "Koşu Yapılandırması",
    body: `
          <div class="labx-chip-row">
            ${["beginner", "advanced"].map(function(entry) {
      return `
                  <button
                    class="labx-chip-button"
                    type="button"
                    data-lab-action="profile-mode"
                    data-lab-value="${entry}"
                    data-selected="${entry === mode ? "true" : "false"}"
                  >
                    ${escapeHtml(entry)}
                  </button>
                `;
    }).join("")}
          </div>
          <div class="labx-inline-grid">
            <label class="labx-field">
              <span>Target Asset</span>
              <select class="labx-select" data-lab-field="profile.targetMode">
                ${["source", "derived"].map(function(entry) {
      return `<option value="${entry}" ${entry === targetMode ? "selected" : ""}>${escapeHtml(entry)}</option>`;
    }).join("")}
              </select>
            </label>
            <label class="labx-field">
              <span>Derived Output</span>
              <select class="labx-select" data-lab-field="profile.targetOutputId" ${targetMode !== "derived" ? "disabled" : ""}>
                <option value="">source</option>
                ${activeOutput ? `<option value="${escapeHtml(typeof activeOutput["id"] === "string" ? activeOutput["id"] : "")}" selected>${escapeHtml(
      typeof activeOutput["fileName"] === "string" ? activeOutput["fileName"] : "derived"
    )}</option>` : ""}
              </select>
            </label>
          </div>
          ${advancedControlsVisible ? `
                <div class="labx-inline-grid">
                  <label class="labx-field">
                    <span>Depth</span>
                    <select class="labx-select" data-lab-field="profile.depth">
                      ${["quick", "balanced", "deep"].map(function(entry) {
      return `<option value="${entry}" ${entry === drafts.depth ? "selected" : ""}>${escapeHtml(entry)}</option>`;
    }).join("")}
                    </select>
                  </label>
                  <label class="labx-field">
                    <span>Frame Density</span>
                    <select class="labx-select" data-lab-field="profile.frameSampleDensity">
                      ${["sparse", "balanced", "dense"].map(function(entry) {
      return `<option value="${entry}" ${entry === drafts.frameSampleDensity ? "selected" : ""}>${escapeHtml(entry)}</option>`;
    }).join("")}
                    </select>
                  </label>
                </div>
                <div class="labx-inline-grid">
                  <label class="labx-field">
                    <span>Sensitivity</span>
                    <input class="labx-input" type="number" step="0.01" min="0.1" max="1" data-lab-field="profile.sensitivity" value="${escapeHtml(String(drafts.sensitivity ?? ""))}" />
                  </label>
                  <label class="labx-field">
                    <span>Transcript Sample</span>
                    <input class="labx-input" type="number" min="5" max="600" data-lab-field="profile.transcriptSampleSeconds" value="${escapeHtml(String(drafts.transcriptSampleSeconds ?? ""))}" />
                  </label>
                </div>
                <label class="labx-field">
                  <span>Speech Model</span>
                  <select class="labx-select" data-lab-field="profile.modelId">
                    <option value="">default</option>
                    ${models.map(function(entry) {
      const id = typeof entry["id"] === "string" ? entry["id"] : "";
      const label = typeof entry["label"] === "string" ? entry["label"] : id;
      return `<option value="${escapeHtml(id)}" ${selectedModel === entry ? "selected" : ""}>${escapeHtml(label)}</option>`;
    }).join("")}
                  </select>
                </label>
                <p class="labx-panel-hint">Gelişmiş profil görünümü aktif. Tarama ve transkript parametreleri düzenlenebilir.</p>
              ` : `
                <div class="labx-summary-list">
                  <div><span>Depth</span><strong>${escapeHtml(drafts.depth)}</strong></div>
                  <div><span>Frame Density</span><strong>${escapeHtml(drafts.frameSampleDensity)}</strong></div>
                  <div><span>Sensitivity</span><strong>${escapeHtml(String(drafts.sensitivity ?? "--"))}</strong></div>
                  <div><span>Transcript Sample</span><strong>${escapeHtml(String(drafts.transcriptSampleSeconds ?? "--"))}</strong></div>
                  <div><span>Speech Model</span><strong>${escapeHtml(selectedModelLabel)}</strong></div>
                </div>
                <p class="labx-panel-hint">Beginner görünümünde preset özeti görünür. Gelişmiş moda geçerek tarama derinliği, hassasiyet ve model seçimini düzenleyin.</p>
              `}
        `,
    footer: renderPrimaryCTA({
      action: "primary-action",
      detail: deps.primaryDetail || null,
      disabled: deps.primaryDisabled,
      label: deps.primaryLabel
    })
  })}
    </div>
  `;
  const side = [
    renderCompactCard({
      eyebrow: "Preflight",
      title: "Hazırlık Sonucu",
      tone: preflight.status === "blocked" ? "error" : preflight.status === "warning" ? "warning" : "accent",
      body: `
        <div class="labx-summary-list">
          <div><span>Durum</span>${renderStatusChip(preflight.status, tone)}</div>
          <div><span>Runtime</span><strong>${escapeHtml(formatDurationSeconds(preflight.estimatedRuntime))}</strong></div>
          <div><span>Enabled</span><strong>${escapeHtml(String(preflight.enabledModules.length))}</strong></div>
        </div>
        ${preflight.missingDependencies.length > 0 ? `<div class="labx-bullet-list">${preflight.missingDependencies.map(function(entry) {
        return `<span>${escapeHtml(entry)}</span>`;
      }).join("")}</div>` : `<p class="labx-panel-hint">Eksik dependency görünmüyor.</p>`}
      `
    }),
    renderCompactCard({
      eyebrow: "Warnings",
      title: "Preflight Uyarıları",
      body: preflight.warnings.length > 0 ? `<div class="labx-bullet-list">${preflight.warnings.map(function(entry) {
        return `<span>${escapeHtml(entry)}</span>`;
      }).join("")}</div>` : `<p class="labx-panel-hint">Bloklayıcı olmayan uyarı kaydı yok.</p>`
    })
  ].join("");
  return { main, side };
}
