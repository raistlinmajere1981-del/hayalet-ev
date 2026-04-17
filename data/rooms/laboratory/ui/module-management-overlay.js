import { LAB_FEATURES, escapeHtml } from "../models/lab-types.js";
import { getWorkbench } from "../runtime/lab-selectors.js";
function getAvailableModuleIds(state) {
  const workbench = getWorkbench(state);
  const availableModuleIds = Array.isArray(workbench["availableModuleIds"]) ? workbench["availableModuleIds"].filter(
    (entry) => typeof entry === "string" && LAB_FEATURES.some((feature) => feature.id === entry)
  ) : [];
  return availableModuleIds.length > 0 ? availableModuleIds : LAB_FEATURES.map((feature) => feature.id);
}
export function renderModuleManagementOverlay(state) {
  const fallbackFeature = LAB_FEATURES[0];
  if (fallbackFeature === void 0) {
    return "";
  }
  const isOpen = state.ui.moduleManagerOpen === true;
  const workbench = getWorkbench(state);
  const availableModuleIds = getAvailableModuleIds(state);
  const selectedModuleIds = Array.isArray(workbench["selectedModuleIds"]) ? workbench["selectedModuleIds"].filter(
    (entry) => typeof entry === "string" && availableModuleIds.includes(entry)
  ) : [state.featureId];
  const activeModuleId = typeof workbench["activeModuleId"] === "string" ? workbench["activeModuleId"] : state.featureId;
  const activeModule = LAB_FEATURES.find(function(feature) {
    return feature.id === activeModuleId;
  }) || fallbackFeature;
  const catalog = availableModuleIds.map(function(moduleId) {
    const feature = LAB_FEATURES.find(function(entry) {
      return entry.id === moduleId;
    }) || fallbackFeature;
    const selected = selectedModuleIds.includes(moduleId);
    const active = activeModuleId === moduleId;
    return `
        <article
          class="labx-module-card"
          data-selected="${selected ? "true" : "false"}"
          data-active="${active ? "true" : "false"}"
        >
          <div class="labx-module-card__head">
            <div>
              <strong>${escapeHtml(feature.label)}</strong>
              <span>${escapeHtml(feature.shortLabel)}</span>
            </div>
            <div class="labx-chip-row">
              ${selected ? `<span class="labx-status-chip" data-tone="success">Seçili</span>` : ""}
              ${active ? `<span class="labx-status-chip" data-tone="running">Aktif</span>` : ""}
            </div>
          </div>
          <p class="labx-panel-hint">${escapeHtml(feature.description)}</p>
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
  }).join("");
  return `
    <div class="labx-overlay-root" data-open="${isOpen ? "true" : "false"}">
      ${isOpen ? `
            <button
              class="labx-overlay-backdrop"
              type="button"
              aria-label="Modül yönetimini kapat"
              data-lab-action="dismiss-module-manager"
            ></button>
            <section class="labx-module-overlay" role="dialog" aria-modal="true" aria-label="Modül Yönetimi">
              <div class="labx-module-overlay__header">
                <div>
                  <p class="labx-card__eyebrow">Çalışma Tezgahı</p>
                  <h2 class="labx-module-overlay__title">Modül Yönetimi</h2>
                  <p class="labx-panel-hint">
                    Kaynak, profil ve işlem aşamalarında birlikte çalışacak modülleri buradan seç.
                  </p>
                </div>
                <button class="labx-inline-action" type="button" data-lab-action="close-module-manager">
                  Kapat
                </button>
              </div>
              <div class="labx-module-overlay__summary">
                <article class="labx-overlay-stat">
                  <span>Aktif modül</span>
                  <strong>${escapeHtml(activeModule.label)}</strong>
                </article>
                <article class="labx-overlay-stat">
                  <span>Seçili modül</span>
                  <strong>${escapeHtml(String(selectedModuleIds.length))}</strong>
                </article>
                <article class="labx-overlay-stat">
                  <span>Kullanılabilir</span>
                  <strong>${escapeHtml(String(availableModuleIds.length))}</strong>
                </article>
              </div>
              <div class="labx-module-catalog">
                ${catalog}
              </div>
            </section>
          ` : ""}
    </div>
  `;
}
