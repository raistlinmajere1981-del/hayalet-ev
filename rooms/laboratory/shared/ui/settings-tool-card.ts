export function createLaboratorySettingsToolCardRuntime(deps) {
  const toRecord = deps.toRecord;
  const escapeHtml = deps.escapeHtml;
  const text = deps.text;
  const getToolEntry = deps.getToolEntry;
  const getToolRegistry = deps.getToolRegistry;
  const renderPreviewMetaRow = deps.renderPreviewMetaRow;

  function renderToolCard(toolId, stageId) {
    const tool = getToolEntry(toolId);
    const descriptor =
      getToolRegistry().find(function (entry) {
        return entry.toolId === toolId;
      }) || {};
    const details = toRecord(tool.details);
    const busy = tool.busy === true;
    const updateAvailable = tool.updateAvailable === true;
    const stageSupport = toRecord(descriptor.stageSupport)[stageId] || "unsupported";
    const availability =
      (typeof details.availability === "string" && details.availability.trim() !== ""
        ? details.availability
        : typeof descriptor.availability === "string" && descriptor.availability.trim() !== ""
          ? descriptor.availability
          : "installable");
    const planned = availability === "planned";
    const systemCommand = availability === "system-command";
    const plannedReason =
      (typeof details.plannedReason === "string" && details.plannedReason.trim() !== ""
        ? details.plannedReason
        : typeof descriptor.plannedReason === "string" && descriptor.plannedReason.trim() !== ""
          ? descriptor.plannedReason
          : null);
    const setupHint =
      (typeof details.setupHint === "string" && details.setupHint.trim() !== ""
        ? details.setupHint
        : typeof descriptor.setupHint === "string" && descriptor.setupHint.trim() !== ""
          ? descriptor.setupHint
          : null);
    const statusLabel =
      planned
        ? text(["mediaAnalysis", "settings", "status", "planned"])
        : systemCommand
          ? tool.installed === true
            ? text(["mediaAnalysis", "settings", "status", "manualReady"])
            : text(["mediaAnalysis", "settings", "status", "manualSetup"])
          : tool.installed === true
            ? updateAvailable
              ? text(["mediaAnalysis", "settings", "status", "updateAvailable"])
              : text(["mediaAnalysis", "settings", "status", "installed"])
            : text(["mediaAnalysis", "settings", "status", "missing"]);
    const actionMarkup =
      planned
        ? `
                <button
                  class="lab-button lab-button--ghost lab-button--tight"
                  type="button"
                  disabled
                >
                  ${escapeHtml(text(["mediaAnalysis", "settings", "status", "planned"]))}
                </button>
              `
        : systemCommand
          ? `
                <button
                  class="lab-button lab-button--ghost lab-button--tight"
                  type="button"
                  data-action="${tool.installed === true ? "tool-update" : "tool-install"}"
                  data-value="${toolId}"
                  ${busy ? "disabled" : ""}
                >
                  ${escapeHtml(
                    tool.installed === true
                      ? text(["mediaAnalysis", "settings", "manualRefreshAction"])
                      : text(["mediaAnalysis", "settings", "manualCheckAction"])
                  )}
                </button>
              `
          : tool.installed === true
            ? `
                <button
                  class="lab-button lab-button--ghost lab-button--tight"
                  type="button"
                  data-action="tool-update"
                  data-value="${toolId}"
                  ${busy ? "disabled" : ""}
                >
                  ${escapeHtml(text(["mediaAnalysis", "settings", "updateAction"]))}
                </button>
              `
            : `
                <button
                  class="lab-button lab-button--primary lab-button--tight"
                  type="button"
                  data-action="tool-install"
                  data-value="${toolId}"
                  ${busy ? "disabled" : ""}
                >
                  ${escapeHtml(text(["mediaAnalysis", "settings", "installAction"]))}
                </button>
              `;

    return `
      <article class="lab-tool-card">
        <div class="lab-tool-card__head">
          <div>
            <strong>${escapeHtml(text(["mediaAnalysis", "settings", "tools", toolId]) || descriptor.displayName || toolId)}</strong>
            <span>${escapeHtml(statusLabel)}</span>
          </div>
          ${actionMarkup}
        </div>
        <ul class="lab-summary-list">
          ${renderPreviewMetaRow(
            text(["mediaAnalysis", "settings", "stageSupportLabel"]),
            text(["mediaAnalysis", "settings", "support", stageSupport])
          )}
          ${renderPreviewMetaRow(text(["mediaAnalysis", "settings", "versionLabel"]), tool.version || "--")}
          ${renderPreviewMetaRow(
            text(["mediaAnalysis", "settings", "latestLabel"]),
            tool.latestVersion || tool.latestReleaseName || "--"
          )}
          ${renderPreviewMetaRow(text(["mediaAnalysis", "settings", "pathLabel"]), tool.binaryPath || "--")}
        </ul>
        ${
          busy
            ? `<p class="lab-panel__hint">${escapeHtml(text(["mediaAnalysis", "settings", "busyHint"]))}</p>`
            : ""
        }
        ${
          plannedReason
            ? `<p class="lab-panel__hint">${escapeHtml(plannedReason)}</p>`
            : ""
        }
        ${
          setupHint
            ? `<p class="lab-panel__hint">${escapeHtml(setupHint)}</p>`
            : ""
        }
        ${
          typeof tool.lastError === "string" && tool.lastError.trim() !== ""
            ? `<p class="lab-panel__hint lab-panel__hint--danger">${escapeHtml(tool.lastError)}</p>`
            : ""
        }
      </article>
    `;
  }

  return {
    renderToolCard,
  };
}
