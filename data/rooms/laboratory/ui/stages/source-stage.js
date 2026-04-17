import {
  LAB_FEATURES,
  escapeHtml,
  formatBytes,
  formatDurationSeconds,
  formatStatusLabel
} from "../../models/lab-types.js";
import {
  getCurrentFeatureMeta,
  getProjectSource,
  getProjects,
  getSourceKind,
  getSourceMetadata,
  getSourceMode,
  getSourceProbeStatus,
  getSourceStatus,
  getWorkbench
} from "../../runtime/lab-selectors.js";
import { renderCompactCard } from "../components/compact-card.js";
import { renderPrimaryCTA } from "../components/primary-cta.js";
import { renderStageHeader } from "../components/stage-header.js";
import { renderStatusChip } from "../components/status-chip.js";
function renderProjectOptions(projects, activeProjectId) {
  return projects.map(function(project) {
    const id = typeof project["id"] === "string" ? project["id"] : "";
    const name = typeof project["name"] === "string" ? project["name"] : "Adsız Proje";
    return `<option value="${escapeHtml(id)}" ${id === activeProjectId ? "selected" : ""}>${escapeHtml(name)}</option>`;
  }).join("");
}
function getSourceKindLabel(kind) {
  switch (kind) {
    case "audio":
      return "Ses";
    case "image":
      return "Görsel";
    case "video":
      return "Video";
    default:
      return kind;
  }
}
function getSourceModeLabel(mode) {
  switch (mode) {
    case "local":
      return "Yerel dosya";
    case "url":
      return "URL indir";
    case "youtube":
      return "YouTube";
    default:
      return mode;
  }
}
function renderPreviewMedia(sourceKind, previewUrl) {
  if (previewUrl === null) {
    return `
      <div class="labx-empty-state">
        <strong class="labx-empty-state__title">Önizleme hazır değil</strong>
        <p class="labx-empty-state__description">Kaynağı hazırladığında medya önizlemesi bu alanda görünür.</p>
      </div>
    `;
  }
  if (sourceKind === "image") {
    return `<img class="labx-preview-media labx-preview-media--image" src="${escapeHtml(previewUrl)}" alt="Kaynak önizleme" />`;
  }
  if (sourceKind === "audio") {
    return `<audio class="labx-preview-media labx-preview-media--audio" src="${escapeHtml(previewUrl)}" controls preload="metadata"></audio>`;
  }
  return `<video class="labx-preview-media labx-preview-media--video" src="${escapeHtml(previewUrl)}" controls preload="metadata" playsinline></video>`;
}
function renderPreviewRow(label, value) {
  return `
    <div class="labx-preview-row">
      <span>${escapeHtml(label)}</span>
      <strong>${escapeHtml(value)}</strong>
    </div>
  `;
}
export function renderSourceStage(deps) {
  const feature = getCurrentFeatureMeta(deps.state);
  const projects = getProjects(deps.state);
  const activeProjectId = deps.state.projectIndex.activeProjectId;
  const sourceProbeStatus = getSourceProbeStatus(deps.state);
  const sourceStatus = getSourceStatus(deps.state);
  const sourceMode = getSourceMode(deps.state);
  const sourceKind = getSourceKind(deps.state);
  const metadata = getSourceMetadata(deps.state);
  const source = getProjectSource(deps.state);
  const workbench = getWorkbench(deps.state);
  const availableModuleIds = Array.isArray(workbench["availableModuleIds"]) ? workbench["availableModuleIds"].filter(
    (entry) => typeof entry === "string"
  ) : LAB_FEATURES.map((entry) => entry.id);
  const selectedModuleIds = Array.isArray(workbench["selectedModuleIds"]) ? workbench["selectedModuleIds"].filter(
    (entry) => typeof entry === "string"
  ) : [feature.id];
  const activeModuleId = typeof workbench["activeModuleId"] === "string" ? workbench["activeModuleId"] : feature.id;
  const sourceDrafts = deps.state.ui.sourceDrafts;
  const sourceStatusLabel = formatStatusLabel(sourceStatus);
  const sourceProbeLabel = formatStatusLabel(sourceProbeStatus);
  const previewUrl = typeof source["previewUrl"] === "string" ? source["previewUrl"] : null;
  const routeLabel = typeof source["routeLabel"] === "string" && source["routeLabel"].trim() !== "" ? source["routeLabel"] : getSourceModeLabel(sourceMode);
  const storedFileName = typeof source["storedFileName"] === "string" && source["storedFileName"].trim() !== "" ? source["storedFileName"] : sourceDrafts.fileNameHint || "--";
  const statusTone = sourceProbeStatus === "completed" ? "success" : sourceProbeStatus === "failed" ? "error" : sourceProbeStatus === "running" ? "running" : "neutral";
  const main = `
    ${renderStageHeader({
    eyebrow: "Aşama 01 · Kaynak",
    stageIndex: 1,
    stageTotal: 5,
    statusLabel: sourceProbeLabel,
    statusTone,
    subtitle: "Kaynak, erişim modu ve modül kapsamı aynı ekranda kilitlenir. Önce giriş yapısını netleştir, sonra sonraki aşamaları güvenle besle.",
    title: "Kaynak"
  })}
    <div class="labx-grid labx-grid--source">
      ${renderCompactCard({
    eyebrow: "Proje",
    title: "Kaynak Seçimi",
    body: `
          <label class="labx-field">
            <span>Aktif Proje</span>
            <select class="labx-select" data-lab-field="project.id">
              ${renderProjectOptions(projects, activeProjectId)}
            </select>
          </label>
          <div class="labx-inline-grid">
            <label class="labx-field">
              <span>Kaynak Türü</span>
              <select class="labx-select" data-lab-field="source.kind">
                ${["video", "audio", "image"].map(function(entry) {
      return `<option value="${entry}" ${entry === sourceKind ? "selected" : ""}>${escapeHtml(getSourceKindLabel(entry))}</option>`;
    }).join("")}
              </select>
            </label>
            <label class="labx-field">
              <span>Erişim Modu</span>
              <select class="labx-select" data-lab-field="source.mode">
                ${["local", "url", "youtube"].map(function(entry) {
      return `<option value="${entry}" ${entry === sourceMode ? "selected" : ""}>${escapeHtml(getSourceModeLabel(entry))}</option>`;
    }).join("")}
              </select>
            </label>
          </div>
          <div class="labx-selection-strip">
            <span class="labx-selection-badge">Seçili akış: ${escapeHtml(getSourceKindLabel(sourceKind))}</span>
            <span class="labx-selection-badge">Erişim: ${escapeHtml(getSourceModeLabel(sourceMode))}</span>
            <span class="labx-selection-badge">Durum: ${escapeHtml(sourceStatusLabel)}</span>
          </div>
          <label class="labx-field">
            <span>Kaynak Takma Adı</span>
            <input class="labx-input" data-lab-field="source.fileNameHint" value="${escapeHtml(sourceDrafts.fileNameHint)}" placeholder="project-shot-01" />
          </label>
          ${sourceMode === "url" ? `
                <label class="labx-field">
                  <span>Kaynak URL</span>
                  <input class="labx-input" data-lab-field="source.urlInput" value="${escapeHtml(sourceDrafts.urlInput)}" placeholder="https://..." />
                </label>
                <p class="labx-panel-hint">Uzak bir kaynağı indirip çalışma alanına sabitlemek için tam bağlantı ver.</p>
              ` : sourceMode === "youtube" ? `
                  <label class="labx-field">
                    <span>YouTube URL</span>
                    <input class="labx-input" data-lab-field="source.youtubeUrl" value="${escapeHtml(sourceDrafts.youtubeUrl)}" placeholder="https://youtube.com/watch?v=..." />
                  </label>
                  <p class="labx-panel-hint">YouTube kaynağı indirildiğinde önizleme ve metadata sağ panelde görünür.</p>
                ` : `<p class="labx-panel-hint">Yerel dosya modu seçili. Birincil aksiyon doğrudan dosya seçiciyi açar.</p>`}
        `,
    footer: renderPrimaryCTA({
      action: "primary-action",
      detail: deps.primaryDetail || null,
      disabled: deps.primaryDisabled,
      label: deps.primaryLabel
    }),
    tone: "accent"
  })}
      ${renderCompactCard({
    eyebrow: "Kapsam",
    title: "Modül Kapsamı",
    body: `
          <div class="labx-stat-grid">
            <article>
              <span>Aktif modül</span>
              <strong>${escapeHtml(feature.label)}</strong>
            </article>
            <article>
              <span>Seçili modül</span>
              <strong>${escapeHtml(String(selectedModuleIds.length))}</strong>
            </article>
            <article>
              <span>Kullanılabilir</span>
              <strong>${escapeHtml(String(availableModuleIds.length))}</strong>
            </article>
          </div>
          <div class="labx-module-grid">
            ${availableModuleIds.map(function(moduleId) {
      const moduleMeta = LAB_FEATURES.find(function(entry) {
        return entry.id === moduleId;
      }) || feature;
      const selected = selectedModuleIds.includes(moduleId);
      const active = moduleId === activeModuleId;
      return `
                  <article class="labx-module-card" data-selected="${selected ? "true" : "false"}" data-active="${active ? "true" : "false"}">
                    <div class="labx-module-card__head">
                      <div>
                        <strong>${escapeHtml(moduleMeta.label)}</strong>
                        <span>${escapeHtml(moduleMeta.shortLabel)}</span>
                      </div>
                      ${active ? renderStatusChip("Aktif", "running") : ""}
                    </div>
                    <p class="labx-panel-hint">${escapeHtml(moduleMeta.description)}</p>
                    <div class="labx-module-card__actions">
                      <button
                        class="labx-inline-action"
                        type="button"
                        data-lab-action="feature-toggle"
                        data-lab-value="${escapeHtml(moduleId)}"
                      >
                        ${selected ? "Seçimden çıkar" : "Modül ekle"}
                      </button>
                      <button
                        class="labx-inline-action"
                        type="button"
                        data-lab-action="feature-activate"
                        data-lab-value="${escapeHtml(moduleId)}"
                        ${selected ? "" : "disabled"}
                      >
                        ${active ? "Aktif modül" : "Aktif yap"}
                      </button>
                    </div>
                  </article>
                `;
    }).join("")}
          </div>
          <p class="labx-panel-hint">Hızlı modül seçimi burada yapılır. Ayrıntılı yönetim için sol üstteki Modül Yönetimi düğmesini kullan.</p>
        `
  })}
    </div>
  `;
  const side = [
    renderCompactCard({
      eyebrow: "Önizleme",
      title: "Kaynak Önizleme",
      body: `
        <div class="labx-preview-card">
          <div class="labx-preview-frame">
            ${renderPreviewMedia(sourceKind, previewUrl)}
          </div>
          <div class="labx-preview-meta">
            ${renderPreviewRow("Kaynak", storedFileName)}
            ${renderPreviewRow("Giriş yolu", routeLabel)}
            ${renderPreviewRow("Durum", sourceStatusLabel)}
            ${renderPreviewRow("Tür", getSourceKindLabel(sourceKind))}
            ${renderPreviewRow("Erişim", getSourceModeLabel(sourceMode))}
            ${typeof source["sourceUrl"] === "string" && source["sourceUrl"].trim() !== "" ? renderPreviewRow("Bağlantı", source["sourceUrl"]) : ""}
          </div>
        </div>
      `,
      tone: "accent"
    }),
    renderCompactCard({
      eyebrow: "Durum",
      title: feature.label,
      body: `
        <div class="labx-summary-list">
          <div><span>Probe</span>${renderStatusChip(sourceProbeLabel, statusTone)}</div>
          <div><span>Kaynak</span><strong>${escapeHtml(sourceStatusLabel)}</strong></div>
          <div><span>Tür</span><strong>${escapeHtml(getSourceKindLabel(sourceKind))}</strong></div>
          <div><span>Mod</span><strong>${escapeHtml(getSourceModeLabel(sourceMode))}</strong></div>
          <div><span>Çerçeve</span><strong>${escapeHtml(
        typeof metadata["width"] === "number" && typeof metadata["height"] === "number" ? `${String(metadata["width"])} × ${String(metadata["height"])}` : "--"
      )}</strong></div>
          <div><span>Süre</span><strong>${escapeHtml(formatDurationSeconds(metadata["durationSeconds"]))}</strong></div>
          <div><span>Boyut</span><strong>${escapeHtml(formatBytes(metadata["sizeBytes"]))}</strong></div>
        </div>
      `
    }),
    renderCompactCard({
      eyebrow: "Rehber",
      title: "Geçiş Kuralı",
      body: `
        <p class="labx-panel-hint">Bir sonraki aşama probe tamamlandığında açılır. Bu panel artık sadece metadata değil, eklenen medyanın gerçek önizlemesini de gösterir.</p>
      `
    })
  ].join("");
  return { main, side };
}
