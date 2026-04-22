import { asLabRecord, asNonEmptyString, escapeHtml } from "../models/lab-types.js";
import { renderStatusChip } from "./components/status-chip.js";
import { getToolRelevanceFilter, getWorkspaceMode } from "../runtime/lab-selectors.js";
const STAGE_LABELS = {
  source: "Kaynak",
  edit: "Düzene",
  profile: "Profil",
  process: "İşlem",
  report: "Rapor"
};
function toToolDescriptorRecord(value) {
  return asLabRecord(value);
}
function toToolEntryRecord(value) {
  return asLabRecord(value);
}
function toStringArray(value) {
  if (!Array.isArray(value)) {
    return [];
  }
  return value.map(function(entry) {
    return asNonEmptyString(entry);
  }).filter((entry) => entry !== null);
}
function getToolRegistry(state) {
  const snapshot = asLabRecord(state.snapshot);
  const registry = Array.isArray(snapshot["toolRegistry"]) ? snapshot["toolRegistry"].map(toToolDescriptorRecord) : [];
  if (registry.length > 0) {
    return registry.slice().sort(function(left, right) {
      const leftLabel = asNonEmptyString(left.displayName) || asNonEmptyString(left.toolId) || "";
      const rightLabel = asNonEmptyString(right.displayName) || asNonEmptyString(right.toolId) || "";
      return leftLabel.localeCompare(rightLabel, "tr");
    });
  }
  const tools = asLabRecord(asLabRecord(state.toolState)["tools"]);
  return Object.keys(tools).map(function(toolId) {
    return {
      toolId,
      displayName: toolId
    };
  }).sort(function(left, right) {
    const leftLabel = asNonEmptyString(left.displayName) || asNonEmptyString(left.toolId) || "";
    const rightLabel = asNonEmptyString(right.displayName) || asNonEmptyString(right.toolId) || "";
    return leftLabel.localeCompare(rightLabel, "tr");
  });
}
function getToolEntry(state, toolId) {
  const tools = asLabRecord(asLabRecord(state.toolState)["tools"]);
  return {
    installed: false,
    version: null,
    latestVersion: null,
    latestReleaseName: null,
    binaryPath: null,
    installDir: null,
    updateAvailable: false,
    busy: false,
    lastError: null,
    ...toToolEntryRecord(tools[toolId]),
    toolId
  };
}
function getInstallStrategy(descriptor) {
  const strategy = asNonEmptyString(descriptor.installStrategy);
  if (strategy !== null) {
    return strategy;
  }
  const availability = asNonEmptyString(descriptor.availability) || "installable";
  if (availability === "planned") {
    return "planned";
  }
  if (availability === "system-command") {
    return "manual";
  }
  return "automatic";
}
function getSupportLevel(descriptor, stageId) {
  return asNonEmptyString(asLabRecord(descriptor.stageSupport)[stageId]) || "unsupported";
}
function getSupportLabel(supportLevel, stageId) {
  const stageLabel = STAGE_LABELS[stageId] || stageId;
  switch (supportLevel) {
    case "required":
      return `${stageLabel} için zorunlu`;
    case "optional":
      return `${stageLabel} için opsiyonel`;
    default:
      return "Oda geneli";
  }
}
function getStatusChip(descriptor, entry, stageId) {
  const availability = asNonEmptyString(descriptor.availability) || "installable";
  const installStrategy = getInstallStrategy(descriptor);
  const supportLevel = getSupportLevel(descriptor, stageId);
  const chips = [
    supportLevel !== "unsupported" ? renderStatusChip(
      getSupportLabel(supportLevel, stageId),
      supportLevel === "required" ? "running" : "neutral"
    ) : "",
    entry.busy === true ? renderStatusChip("Çalışıyor", "running") : entry.installed === true ? renderStatusChip(
      entry.updateAvailable === true ? "Güncelleme var" : "Kurulu",
      entry.updateAvailable === true ? "warning" : "success"
    ) : availability === "planned" ? renderStatusChip("Planlı", "neutral") : installStrategy === "manual" ? renderStatusChip("Manuel kurulum", "neutral") : renderStatusChip("Hazır değil", "neutral")
  ].filter(function(entryMarkup) {
    return entryMarkup !== "";
  });
  return chips.join("");
}
function getLifecycleHint(descriptor, entry) {
  if (typeof entry.lastError === "string" && entry.lastError.trim() !== "") {
    return `Son hata: ${entry.lastError.trim()}`;
  }
  if (typeof descriptor.readinessImpact === "string" && descriptor.readinessImpact.trim() !== "") {
    return descriptor.readinessImpact.trim();
  }
  if (typeof descriptor.manualHint === "string" && descriptor.manualHint.trim() !== "") {
    return descriptor.manualHint.trim();
  }
  if (typeof descriptor.plannedReason === "string" && descriptor.plannedReason.trim() !== "") {
    return descriptor.plannedReason.trim();
  }
  return "Araç durumu room-local registry üzerinden izlenir.";
}
function getInstallStrategyLabel(descriptor) {
  switch (getInstallStrategy(descriptor)) {
    case "manual":
      return "Manuel kurulum";
    case "planned":
      return "Planlı";
    case "automatic":
    default:
      return "Uygulama içi kurulum";
  }
}
function renderToolActions(descriptor, entry) {
  const toolId = asNonEmptyString(descriptor.toolId) || asNonEmptyString(entry.toolId) || "";
  if (toolId === "") {
    return "";
  }
  const availability = asNonEmptyString(descriptor.availability) || "installable";
  const installStrategy = getInstallStrategy(descriptor);
  const disabled = entry.busy === true ? "disabled" : "";
  if (availability === "planned") {
    return `
      <button class="labx-inline-action" type="button" disabled>
        Planlı
      </button>
    `;
  }
  if (entry.installed === true) {
    return `
      <button class="labx-inline-action" type="button" data-lab-action="tool-check-updates" data-lab-value="${escapeHtml(toolId)}" ${disabled}>
        Güncelleme kontrolü
      </button>
      ${entry.updateAvailable === true ? `<button class="labx-inline-action" type="button" data-lab-action="tool-update" data-lab-value="${escapeHtml(toolId)}" ${disabled}>Güncelle</button>` : ""}
    `;
  }
  if (installStrategy === "automatic") {
    return `
      <button class="labx-inline-action" type="button" data-lab-action="tool-install" data-lab-value="${escapeHtml(toolId)}" ${disabled}>
        Kur
      </button>
    `;
  }
  return `
    <button class="labx-inline-action" type="button" disabled>
      Manuel kurulum
    </button>
  `;
}
function renderUsedBy(descriptor) {
  const usedBy = toStringArray(descriptor.usedBy);
  if (usedBy.length === 0) {
    return "";
  }
  return `
    <div class="labx-selection-strip">
      ${usedBy.map(function(entry) {
    return `<span class="labx-selection-badge">${escapeHtml(entry)}</span>`;
  }).join("")}
    </div>
  `;
}
function renderToolCard(state, descriptor, stageId) {
  const toolId = asNonEmptyString(descriptor.toolId);
  if (toolId === null) {
    return "";
  }
  const entry = getToolEntry(state, toolId);
  const displayName = asNonEmptyString(descriptor.displayName) || toolId;
  const supportLevel = getSupportLevel(descriptor, stageId);
  const versionLabel = asNonEmptyString(entry.version) || "--";
  const latestLabel = asNonEmptyString(entry.latestVersion) || asNonEmptyString(entry.latestReleaseName) || "--";
  const locationLabel = asNonEmptyString(entry.binaryPath) || asNonEmptyString(entry.installDir) || "--";
  return `
    <article class="labx-module-card" data-selected="${entry.installed === true ? "true" : "false"}" data-active="${supportLevel === "required" ? "true" : "false"}">
      <div class="labx-module-card__head">
        <div>
          <strong>${escapeHtml(displayName)}</strong>
          <span>${escapeHtml(getInstallStrategyLabel(descriptor))}</span>
        </div>
        <div class="labx-chip-row">
          ${getStatusChip(descriptor, entry, stageId)}
        </div>
      </div>
      <p class="labx-panel-hint">${escapeHtml(getLifecycleHint(descriptor, entry))}</p>
      ${renderUsedBy(descriptor)}
      <div class="labx-summary-list">
        <div><span>Aşama desteği</span><strong>${escapeHtml(getSupportLabel(supportLevel, stageId))}</strong></div>
        <div><span>Kurulu sürüm</span><strong>${escapeHtml(versionLabel)}</strong></div>
        <div><span>Son sürüm</span><strong>${escapeHtml(latestLabel)}</strong></div>
        <div><span>Konum</span><strong>${escapeHtml(locationLabel)}</strong></div>
      </div>
      <div class="labx-module-card__actions">
        ${renderToolActions(descriptor, entry)}
      </div>
    </article>
  `;
}
function renderToolSection(state, stageId, eyebrow, title, hint, descriptors) {
  return `
    <section class="labx-list-stack">
      <div>
        <p class="labx-card__eyebrow">${escapeHtml(eyebrow)}</p>
        <h3 class="labx-card__title">${escapeHtml(title)}</h3>
        <p class="labx-panel-hint">${escapeHtml(hint)}</p>
      </div>
      ${descriptors.length > 0 ? `<div class="labx-module-catalog">${descriptors.map(function(descriptor) {
    return renderToolCard(state, descriptor, stageId);
  }).join("")}</div>` : `
            <div class="labx-empty-state">
              <strong class="labx-empty-state__title">Bu alan için ek araç gerekmiyor</strong>
              <p class="labx-empty-state__description">Aktif aşamada room-local bir araç zorunluluğu görünmüyor.</p>
            </div>
          `}
    </section>
  `;
}
export function renderToolManagementOverlay(state) {
  const isOpen = state.ui.toolManagerOpen === true;
  const descriptors = getToolRegistry(state);
  const relevance = getToolRelevanceFilter(state);
  const requiredToolSet = new Set(relevance.requiredToolIds);
  const stageId = state.currentStage;
  const relevantTools = descriptors.filter(function(descriptor) {
    const toolId = asNonEmptyString(descriptor.toolId);
    return toolId !== null && requiredToolSet.has(toolId);
  });
  const otherTools = descriptors.filter(function(descriptor) {
    const toolId = asNonEmptyString(descriptor.toolId);
    return toolId === null || !requiredToolSet.has(toolId);
  });
  const installedCount = descriptors.filter(function(descriptor) {
    const toolId = asNonEmptyString(descriptor.toolId);
    return toolId !== null && getToolEntry(state, toolId).installed === true;
  }).length;
  const updateCount = descriptors.filter(function(descriptor) {
    const toolId = asNonEmptyString(descriptor.toolId);
    return toolId !== null && getToolEntry(state, toolId).updateAvailable === true;
  }).length;
  const busyCount = descriptors.filter(function(descriptor) {
    const toolId = asNonEmptyString(descriptor.toolId);
    return toolId !== null && getToolEntry(state, toolId).busy === true;
  }).length;
  const wsMode = getWorkspaceMode(state);
  const modeLabel = wsMode === "analyzing" ? "Analiz" : wsMode === "complete" ? "Tamamlandı" : "Çalışma Alanı";
  return `
    <div class="labx-overlay-root" data-open="${isOpen ? "true" : "false"}">
      ${isOpen ? `
            <button
              class="labx-overlay-backdrop"
              type="button"
              aria-label="Araç yönetimini kapat"
              data-lab-action="dismiss-tool-manager"
            ></button>
            <section class="labx-module-overlay" role="dialog" aria-modal="true" aria-label="Araç Yönetimi">
              <div class="labx-module-overlay__header">
                <div>
                  <p class="labx-card__eyebrow">Çalışma Tezgahı</p>
                  <h2 class="labx-module-overlay__title">Araç Yönetimi</h2>
                  <p class="labx-panel-hint">
                    yt-dlp, FFmpeg ve diğer oda araçlarını aynı panelden kur, güncelle ve yeniden doğrula.
                  </p>
                </div>
                <div class="labx-inline-actions">
                  <button
                    class="labx-inline-action"
                    type="button"
                    data-lab-action="tool-update-all"
                    ${installedCount === 0 || busyCount > 0 ? "disabled" : ""}
                  >
                    Toplu güncelle
                  </button>
                  <button
                    class="labx-inline-action"
                    type="button"
                    data-lab-action="tools-refresh"
                    ${busyCount > 0 ? "disabled" : ""}
                  >
                    Yenile
                  </button>
                  <button class="labx-inline-action" type="button" data-lab-action="close-tool-manager">
                    Kapat
                  </button>
                </div>
              </div>
              <div class="labx-module-overlay__summary">
                <article class="labx-overlay-stat">
                  <span>İlgili araçlar</span>
                  <strong>${escapeHtml(String(relevantTools.length))}</strong>
                </article>
                <article class="labx-overlay-stat">
                  <span>Kurulu araç</span>
                  <strong>${escapeHtml(String(installedCount))}</strong>
                </article>
                <article class="labx-overlay-stat">
                  <span>Güncelleme bekleyen</span>
                  <strong>${escapeHtml(String(updateCount))}</strong>
                </article>
              </div>
              ${renderToolSection(
    state,
    stageId,
    modeLabel,
    "İlgili araçlar",
    "Seçili intent ve yetenek aileleri için gerekli araçlar önce listelenir.",
    relevantTools
  )}
              ${renderToolSection(
    state,
    stageId,
    "Oda geneli",
    "Diğer araçlar",
    "Diğer modül ve kapasitelere ait araçlar burada tutulur.",
    otherTools
  )}
            </section>
          ` : ""}
    </div>
  `;
}
