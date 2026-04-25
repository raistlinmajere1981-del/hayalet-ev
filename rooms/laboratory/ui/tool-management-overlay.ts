import { asLabRecord, asNonEmptyString, escapeHtml } from "../models/lab-types.js";
import type { LabRecord, LabStoreState } from "../models/lab-types.js";
import { renderStatusChip } from "./components/status-chip.js";
import { getToolRelevanceFilter, getWorkspaceMode } from "../runtime/lab-selectors.js";
import { LAB_FALLBACK_I18N } from "./lab-i18n.js";
import type { LabI18n } from "./lab-i18n.js";

type LabToolDescriptorRecord = LabRecord & {
  availability?: unknown;
  displayName?: unknown;
  installStrategy?: unknown;
  installerType?: unknown;
  manualHint?: unknown;
  plannedReason?: unknown;
  readinessImpact?: unknown;
  stageSupport?: unknown;
  toolId?: unknown;
  usedBy?: unknown;
};

type LabToolEntryRecord = LabRecord & {
  binaryPath?: unknown;
  busy?: unknown;
  installDir?: unknown;
  installed?: unknown;
  lastError?: unknown;
  latestReleaseName?: unknown;
  latestVersion?: unknown;
  toolId?: unknown;
  updateAvailable?: unknown;
  version?: unknown;
};

const STAGE_LABELS: Record<string, string> = {
  source: "Kaynak",
  edit: "Düzene",
  profile: "Profil",
  process: "İşlem",
  report: "Rapor",
};

function isSettingsManagedTool(toolId: string | null): boolean {
  return toolId === "whisper.cpp";
}

function toToolDescriptorRecord(value: unknown): LabToolDescriptorRecord {
  return asLabRecord(value);
}

function toToolEntryRecord(value: unknown): LabToolEntryRecord {
  return asLabRecord(value);
}

function toStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .map(function (entry) {
      return asNonEmptyString(entry);
    })
    .filter((entry): entry is string => entry !== null);
}

function toToolCopyKeyPart(value: string | null): string | null {
  if (value === null) {
    return null;
  }
  const normalized = value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return normalized === "" ? null : normalized;
}

function translateToolDescriptorText(
  toolId: string | null,
  field: "manualHint" | "plannedReason" | "readinessImpact",
  fallback: string,
  copy: LabI18n
): string {
  const toolKey = toToolCopyKeyPart(toolId);
  if (toolKey === null) {
    return fallback;
  }
  return copy.t(`mediaAnalysis.toolManager.toolDetails.${toolKey}.${field}`, fallback);
}

function translateUsedByLabel(entry: string, copy: LabI18n): string {
  const key = toToolCopyKeyPart(entry);
  if (key === null) {
    return entry;
  }
  return copy.t(`mediaAnalysis.toolManager.usedBy.${key}`, entry);
}

function getToolRegistry(state: LabStoreState): LabToolDescriptorRecord[] {
  const snapshot = asLabRecord(state.snapshot);
  const registry = Array.isArray(snapshot["toolRegistry"])
    ? (snapshot["toolRegistry"] as unknown[]).map(toToolDescriptorRecord)
    : [];

  if (registry.length > 0) {
    return registry.slice().sort(function (left, right) {
      const leftLabel = asNonEmptyString(left.displayName) || asNonEmptyString(left.toolId) || "";
      const rightLabel =
        asNonEmptyString(right.displayName) || asNonEmptyString(right.toolId) || "";
      return leftLabel.localeCompare(rightLabel, "tr");
    });
  }

  const tools = asLabRecord(asLabRecord(state.toolState)["tools"]);
  return Object.keys(tools)
    .map(function (toolId) {
      return {
        toolId,
        displayName: toolId,
      };
    })
    .sort(function (left, right) {
      const leftLabel = asNonEmptyString(left.displayName) || asNonEmptyString(left.toolId) || "";
      const rightLabel =
        asNonEmptyString(right.displayName) || asNonEmptyString(right.toolId) || "";
      return leftLabel.localeCompare(rightLabel, "tr");
    });
}

function getToolEntry(state: LabStoreState, toolId: string): LabToolEntryRecord {
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
    toolId,
  };
}

function getInstallStrategy(descriptor: LabToolDescriptorRecord): string {
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

function getSupportLevel(descriptor: LabToolDescriptorRecord, stageId: string): string {
  return asNonEmptyString(asLabRecord(descriptor.stageSupport)[stageId]) || "unsupported";
}

function getStageLabel(stageId: string, copy: LabI18n = LAB_FALLBACK_I18N): string {
  return copy.t(`mediaAnalysis.stages.${stageId}`, STAGE_LABELS[stageId] || stageId);
}

function getSupportLabel(
  supportLevel: string,
  stageId: string,
  copy: LabI18n = LAB_FALLBACK_I18N
): string {
  const stageLabel = getStageLabel(stageId, copy);
  switch (supportLevel) {
    case "required":
      return copy.t("mediaAnalysis.toolManager.support.requiredForStage", "{stage} için zorunlu", {
        stage: stageLabel,
      });
    case "optional":
      return copy.t(
        "mediaAnalysis.toolManager.support.optionalForStage",
        "{stage} için opsiyonel",
        {
          stage: stageLabel,
        }
      );
    default:
      return copy.t("mediaAnalysis.toolManager.support.roomWide", "Oda geneli");
  }
}

function getStatusChip(
  descriptor: LabToolDescriptorRecord,
  entry: LabToolEntryRecord,
  stageId: string,
  copy: LabI18n = LAB_FALLBACK_I18N
) {
  const availability = asNonEmptyString(descriptor.availability) || "installable";
  const installStrategy = getInstallStrategy(descriptor);
  const supportLevel = getSupportLevel(descriptor, stageId);
  const chips = [
    supportLevel !== "unsupported"
      ? renderStatusChip(
          getSupportLabel(supportLevel, stageId, copy),
          supportLevel === "required" ? "running" : "neutral"
        )
      : "",
    entry.busy === true
      ? renderStatusChip(copy.t("mediaAnalysis.toolManager.status.busy", "Çalışıyor"), "running")
      : entry.installed === true
        ? renderStatusChip(
            entry.updateAvailable === true
              ? copy.t("mediaAnalysis.toolManager.status.updateAvailable", "Güncelleme var")
              : copy.t("mediaAnalysis.toolManager.status.installed", "Kurulu"),
            entry.updateAvailable === true ? "warning" : "success"
          )
        : availability === "planned"
          ? renderStatusChip(
              copy.t("mediaAnalysis.toolManager.status.planned", "Planlı"),
              "neutral"
            )
          : installStrategy === "manual"
            ? renderStatusChip(
                copy.t("mediaAnalysis.toolManager.status.manualSetup", "Manuel kurulum"),
                "neutral"
              )
            : renderStatusChip(
                copy.t("mediaAnalysis.toolManager.status.notReady", "Hazır değil"),
                "neutral"
              ),
  ].filter(function (entryMarkup) {
    return entryMarkup !== "";
  });

  return chips.join("");
}

function getLifecycleHint(
  descriptor: LabToolDescriptorRecord,
  entry: LabToolEntryRecord,
  copy: LabI18n = LAB_FALLBACK_I18N
): string {
  const toolId = asNonEmptyString(descriptor.toolId) || asNonEmptyString(entry.toolId);
  if (isSettingsManagedTool(toolId)) {
    return copy.t(
      "mediaAnalysis.toolManager.lifecycle.settingsManaged",
      "Whisper.cpp lifecycle is managed in main Settings. Laboratory only reflects the current runtime probe and active language/model readiness."
    );
  }
  if (typeof entry.lastError === "string" && entry.lastError.trim() !== "") {
    return copy.t("mediaAnalysis.toolManager.lifecycle.lastError", "Son hata: {error}", {
      error: entry.lastError.trim(),
    });
  }
  if (typeof descriptor.readinessImpact === "string" && descriptor.readinessImpact.trim() !== "") {
    return translateToolDescriptorText(
      toolId,
      "readinessImpact",
      descriptor.readinessImpact.trim(),
      copy
    );
  }
  if (typeof descriptor.manualHint === "string" && descriptor.manualHint.trim() !== "") {
    return translateToolDescriptorText(toolId, "manualHint", descriptor.manualHint.trim(), copy);
  }
  if (typeof descriptor.plannedReason === "string" && descriptor.plannedReason.trim() !== "") {
    return translateToolDescriptorText(
      toolId,
      "plannedReason",
      descriptor.plannedReason.trim(),
      copy
    );
  }
  return copy.t(
    "mediaAnalysis.toolManager.lifecycle.default",
    "Araç durumu room-local registry üzerinden izlenir."
  );
}

function getInstallStrategyLabel(
  descriptor: LabToolDescriptorRecord,
  copy: LabI18n = LAB_FALLBACK_I18N
): string {
  if (isSettingsManagedTool(asNonEmptyString(descriptor.toolId))) {
    return copy.t(
      "mediaAnalysis.toolManager.strategy.settingsManaged",
      "Settings üzerinden yönetilir"
    );
  }
  switch (getInstallStrategy(descriptor)) {
    case "manual":
      return copy.t("mediaAnalysis.toolManager.strategy.manual", "Manuel kurulum");
    case "planned":
      return copy.t("mediaAnalysis.toolManager.strategy.planned", "Planlı");
    case "automatic":
    default:
      return copy.t("mediaAnalysis.toolManager.strategy.automatic", "Uygulama içi kurulum");
  }
}

function renderToolActions(
  descriptor: LabToolDescriptorRecord,
  entry: LabToolEntryRecord,
  copy: LabI18n = LAB_FALLBACK_I18N
): string {
  const toolId = asNonEmptyString(descriptor.toolId) || asNonEmptyString(entry.toolId) || "";
  if (toolId === "") {
    return "";
  }

  if (isSettingsManagedTool(toolId)) {
    return `
      <button class="labx-inline-action" type="button" disabled>
        ${escapeHtml(copy.t("mediaAnalysis.toolManager.actions.settingsManaged", "Settings'ten yönetilir"))}
      </button>
    `;
  }

  const availability = asNonEmptyString(descriptor.availability) || "installable";
  const installStrategy = getInstallStrategy(descriptor);
  const disabled = entry.busy === true ? "disabled" : "";

  if (availability === "planned") {
    return `
      <button class="labx-inline-action" type="button" disabled>
        ${escapeHtml(copy.t("mediaAnalysis.toolManager.actions.planned", "Planlı"))}
      </button>
    `;
  }

  if (entry.installed === true) {
    return `
      <button class="labx-inline-action" type="button" data-lab-action="tool-check-updates" data-lab-value="${escapeHtml(toolId)}" ${disabled}>
        ${escapeHtml(copy.t("mediaAnalysis.toolManager.actions.checkUpdates", "Güncelleme kontrolü"))}
      </button>
      ${
        entry.updateAvailable === true
          ? `<button class="labx-inline-action" type="button" data-lab-action="tool-update" data-lab-value="${escapeHtml(toolId)}" ${disabled}>${escapeHtml(copy.t("mediaAnalysis.toolManager.actions.update", "Güncelle"))}</button>`
          : ""
      }
    `;
  }

  if (installStrategy === "automatic") {
    return `
      <button class="labx-inline-action" type="button" data-lab-action="tool-install" data-lab-value="${escapeHtml(toolId)}" ${disabled}>
        ${escapeHtml(copy.t("mediaAnalysis.toolManager.actions.install", "Kur"))}
      </button>
    `;
  }

  return `
    <button class="labx-inline-action" type="button" disabled>
      ${escapeHtml(copy.t("mediaAnalysis.toolManager.actions.manualSetup", "Manuel kurulum"))}
    </button>
  `;
}

function renderUsedBy(descriptor: LabToolDescriptorRecord, copy: LabI18n): string {
  const usedBy = toStringArray(descriptor.usedBy);
  if (usedBy.length === 0) {
    return "";
  }

  return `
    <div class="labx-selection-strip">
	      ${usedBy
          .map(function (entry) {
            return `<span class="labx-selection-badge">${escapeHtml(translateUsedByLabel(entry, copy))}</span>`;
          })
          .join("")}
    </div>
  `;
}

function renderToolCard(
  state: LabStoreState,
  descriptor: LabToolDescriptorRecord,
  stageId: string,
  copy: LabI18n = LAB_FALLBACK_I18N
): string {
  const toolId = asNonEmptyString(descriptor.toolId);
  if (toolId === null) {
    return "";
  }

  const entry = getToolEntry(state, toolId);
  const displayName = asNonEmptyString(descriptor.displayName) || toolId;
  const supportLevel = getSupportLevel(descriptor, stageId);
  const versionLabel = asNonEmptyString(entry.version) || "--";
  const latestLabel =
    asNonEmptyString(entry.latestVersion) || asNonEmptyString(entry.latestReleaseName) || "--";
  const locationLabel =
    asNonEmptyString(entry.binaryPath) || asNonEmptyString(entry.installDir) || "--";

  return `
    <article class="labx-module-card" data-selected="${entry.installed === true ? "true" : "false"}" data-active="${supportLevel === "required" ? "true" : "false"}">
      <div class="labx-module-card__head">
        <div>
          <strong>${escapeHtml(displayName)}</strong>
          <span>${escapeHtml(getInstallStrategyLabel(descriptor, copy))}</span>
        </div>
        <div class="labx-chip-row">
          ${getStatusChip(descriptor, entry, stageId, copy)}
        </div>
      </div>
      <p class="labx-panel-hint">${escapeHtml(getLifecycleHint(descriptor, entry, copy))}</p>
	      ${renderUsedBy(descriptor, copy)}
      <div class="labx-summary-list">
        <div><span>${escapeHtml(copy.t("mediaAnalysis.toolManager.labels.stageSupport", "Aşama desteği"))}</span><strong>${escapeHtml(getSupportLabel(supportLevel, stageId, copy))}</strong></div>
        <div><span>${escapeHtml(copy.t("mediaAnalysis.toolManager.labels.installedVersion", "Kurulu sürüm"))}</span><strong>${escapeHtml(versionLabel)}</strong></div>
        <div><span>${escapeHtml(copy.t("mediaAnalysis.toolManager.labels.latestVersion", "Son sürüm"))}</span><strong>${escapeHtml(latestLabel)}</strong></div>
        <div><span>${escapeHtml(copy.t("mediaAnalysis.toolManager.labels.location", "Konum"))}</span><strong>${escapeHtml(locationLabel)}</strong></div>
      </div>
      <div class="labx-module-card__actions">
        ${renderToolActions(descriptor, entry, copy)}
      </div>
    </article>
  `;
}

function renderToolSection(
  state: LabStoreState,
  stageId: string,
  eyebrow: string,
  title: string,
  hint: string,
  descriptors: LabToolDescriptorRecord[],
  copy: LabI18n = LAB_FALLBACK_I18N
): string {
  return `
    <section class="labx-list-stack">
      <div>
        <p class="labx-card__eyebrow">${escapeHtml(eyebrow)}</p>
        <h3 class="labx-card__title">${escapeHtml(title)}</h3>
        <p class="labx-panel-hint">${escapeHtml(hint)}</p>
      </div>
      ${
        descriptors.length > 0
          ? `<div class="labx-module-catalog">${descriptors
              .map(function (descriptor) {
                return renderToolCard(state, descriptor, stageId, copy);
              })
              .join("")}</div>`
          : `
            <div class="labx-empty-state">
              <strong class="labx-empty-state__title">${escapeHtml(copy.t("mediaAnalysis.toolManager.empty.title", "Bu alan için ek araç gerekmiyor"))}</strong>
              <p class="labx-empty-state__description">${escapeHtml(copy.t("mediaAnalysis.toolManager.empty.body", "Aktif aşamada room-local bir araç zorunluluğu görünmüyor."))}</p>
            </div>
          `
      }
    </section>
  `;
}

export function renderToolManagementOverlay(
  state: LabStoreState,
  copy: LabI18n = LAB_FALLBACK_I18N
) {
  const isOpen = state.ui.toolManagerOpen === true;
  const descriptors = getToolRegistry(state);
  // Relevance-based grouping: tools needed by intent-derived capabilities
  const relevance = getToolRelevanceFilter(state);
  const requiredToolSet = new Set(relevance.requiredToolIds);
  const stageId = state.currentStage; // kept for card-level metadata display only
  const relevantTools = descriptors.filter(function (descriptor) {
    const toolId = asNonEmptyString(descriptor.toolId);
    return toolId !== null && requiredToolSet.has(toolId);
  });
  const otherTools = descriptors.filter(function (descriptor) {
    const toolId = asNonEmptyString(descriptor.toolId);
    return toolId === null || !requiredToolSet.has(toolId);
  });
  const roomManagedDescriptors = descriptors.filter(function (descriptor) {
    return isSettingsManagedTool(asNonEmptyString(descriptor.toolId)) !== true;
  });
  const installedCount = descriptors.filter(function (descriptor) {
    const toolId = asNonEmptyString(descriptor.toolId);
    return toolId !== null && getToolEntry(state, toolId).installed === true;
  }).length;
  const updateCount = roomManagedDescriptors.filter(function (descriptor) {
    const toolId = asNonEmptyString(descriptor.toolId);
    return toolId !== null && getToolEntry(state, toolId).updateAvailable === true;
  }).length;
  const busyCount = descriptors.filter(function (descriptor) {
    const toolId = asNonEmptyString(descriptor.toolId);
    return toolId !== null && getToolEntry(state, toolId).busy === true;
  }).length;
  const roomManagedInstalledCount = roomManagedDescriptors.filter(function (descriptor) {
    const toolId = asNonEmptyString(descriptor.toolId);
    return toolId !== null && getToolEntry(state, toolId).installed === true;
  }).length;
  const wsMode = getWorkspaceMode(state);
  const modeLabel =
    wsMode === "analyzing"
      ? copy.t("mediaAnalysis.toolManager.mode.analyzing", "Analiz")
      : wsMode === "complete"
        ? copy.t("mediaAnalysis.toolManager.mode.complete", "Tamamlandı")
        : copy.t("mediaAnalysis.toolManager.mode.workspace", "Çalışma Alanı");

  return `
    <div class="labx-overlay-root" data-open="${isOpen ? "true" : "false"}">
      ${
        isOpen
          ? `
            <button
              class="labx-overlay-backdrop"
              type="button"
              aria-label="${escapeHtml(copy.t("mediaAnalysis.toolManager.closeAria", "Araç yönetimini kapat"))}"
              data-lab-action="dismiss-tool-manager"
            ></button>
            <section class="labx-module-overlay" role="dialog" aria-modal="true" aria-label="${escapeHtml(copy.t("mediaAnalysis.toolManager.ariaLabel", "Araç Yönetimi"))}">
              <div class="labx-module-overlay__header">
                <div>
                  <p class="labx-card__eyebrow">${escapeHtml(copy.t("mediaAnalysis.toolManager.eyebrow", "Çalışma Tezgahı"))}</p>
                  <h2 class="labx-module-overlay__title">${escapeHtml(copy.t("mediaAnalysis.toolManager.title", "Araç Yönetimi"))}</h2>
                  <p class="labx-panel-hint">
                    ${escapeHtml(copy.t("mediaAnalysis.toolManager.subtitle", "yt-dlp ve FFmpeg gibi oda araçlarını burada yönet; Whisper.cpp ise yalnızca merkezi Settings runtime durumuyla birlikte yansıtılır."))}
                  </p>
                </div>
                <div class="labx-inline-actions">
                  <button
                    class="labx-inline-action"
                    type="button"
                    data-lab-action="tool-update-all"
                    ${roomManagedInstalledCount === 0 || busyCount > 0 ? "disabled" : ""}
                  >
                    ${escapeHtml(copy.t("mediaAnalysis.toolManager.actions.bulkUpdate", "Toplu güncelle"))}
                  </button>
                  <button
                    class="labx-inline-action"
                    type="button"
                    data-lab-action="tools-refresh"
                    ${busyCount > 0 ? "disabled" : ""}
                  >
                    ${escapeHtml(copy.t("mediaAnalysis.toolManager.actions.refresh", "Yenile"))}
                  </button>
                  <button class="labx-inline-action" type="button" data-lab-action="close-tool-manager">
                    ${escapeHtml(copy.t("mediaAnalysis.toolManager.actions.close", "Kapat"))}
                  </button>
                </div>
              </div>
              <div class="labx-module-overlay__summary">
                <article class="labx-overlay-stat">
                  <span>${escapeHtml(copy.t("mediaAnalysis.toolManager.stats.relevant", "İlgili araçlar"))}</span>
                  <strong>${escapeHtml(String(relevantTools.length))}</strong>
                </article>
                <article class="labx-overlay-stat">
                  <span>${escapeHtml(copy.t("mediaAnalysis.toolManager.stats.installed", "Kurulu araç"))}</span>
                  <strong>${escapeHtml(String(installedCount))}</strong>
                </article>
                <article class="labx-overlay-stat">
                  <span>${escapeHtml(copy.t("mediaAnalysis.toolManager.stats.updates", "Güncelleme bekleyen"))}</span>
                  <strong>${escapeHtml(String(updateCount))}</strong>
                </article>
              </div>
              ${renderToolSection(
                state,
                stageId,
                modeLabel,
                copy.t("mediaAnalysis.toolManager.sections.relevant.title", "İlgili araçlar"),
                copy.t(
                  "mediaAnalysis.toolManager.sections.relevant.hint",
                  "Seçili intent ve yetenek aileleri için gerekli araçlar önce listelenir."
                ),
                relevantTools,
                copy
              )}
              ${renderToolSection(
                state,
                stageId,
                copy.t("mediaAnalysis.toolManager.sections.other.eyebrow", "Oda geneli"),
                copy.t("mediaAnalysis.toolManager.sections.other.title", "Diğer araçlar"),
                copy.t(
                  "mediaAnalysis.toolManager.sections.other.hint",
                  "Diğer modül ve kapasitelere ait araçlar burada tutulur."
                ),
                otherTools,
                copy
              )}
            </section>
          `
          : ""
      }
    </div>
  `;
}
