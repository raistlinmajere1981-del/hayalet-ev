type LaboratoryRecord = Record<string, unknown>

type LaboratoryToolDetailsRecord = LaboratoryRecord & {
  availability?: unknown
  plannedReason?: unknown
  setupHint?: unknown
}

type LaboratoryToolStateRecord = LaboratoryRecord & {
  binaryPath?: unknown
  busy?: unknown
  details?: unknown
  installed?: unknown
  lastError?: unknown
  latestReleaseName?: unknown
  latestVersion?: unknown
  updateAvailable?: unknown
  version?: unknown
}

type LaboratoryToolDescriptorRecord = LaboratoryRecord & {
  availability?: unknown
  displayName?: unknown
  plannedReason?: unknown
  setupHint?: unknown
  stageSupport?: unknown
  toolId?: unknown
}

type LaboratorySettingsToolCardRuntimeDeps = {
  escapeHtml: (value: string) => string
  getToolEntry: (toolId: string) => LaboratoryToolStateRecord
  getToolRegistry: () => LaboratoryToolDescriptorRecord[]
  renderPreviewMetaRow: (label: string, value: unknown) => string
  text: (path: string[]) => string
  toRecord: (value: unknown) => LaboratoryRecord
}

export function createLaboratorySettingsToolCardRuntime(
  deps: LaboratorySettingsToolCardRuntimeDeps
) {
  const { escapeHtml, getToolEntry, getToolRegistry, renderPreviewMetaRow, text, toRecord } = deps

  function toToolStateRecord(value: unknown): LaboratoryToolStateRecord {
    return toRecord(value)
  }

  function toToolDetailsRecord(value: unknown): LaboratoryToolDetailsRecord {
    return toRecord(value)
  }

  function toString(value: unknown, fallback = ""): string {
    return typeof value === "string" ? value : fallback
  }

  function getDescriptor(toolId: string): LaboratoryToolDescriptorRecord | null {
    return (
      getToolRegistry().find(function (entry) {
        return toString(entry.toolId) === toolId
      }) || null
    )
  }

  function getAvailability(
    details: LaboratoryToolDetailsRecord,
    descriptor: LaboratoryToolDescriptorRecord | null
  ): string {
    return (
      toString(details.availability).trim() ||
      toString(descriptor?.availability).trim() ||
      "installable"
    )
  }

  function readStageSupport(
    descriptor: LaboratoryToolDescriptorRecord | null,
    stageId: string
  ): string {
    const stageSupport = toRecord(descriptor?.stageSupport)
    return toString(stageSupport[stageId], "unsupported")
  }

  function renderToolCard(toolId: string, stageId: string) {
    const tool = toToolStateRecord(getToolEntry(toolId))
    const descriptor = getDescriptor(toolId)
    const details = toToolDetailsRecord(tool.details)
    const busy = tool.busy === true
    const updateAvailable = tool.updateAvailable === true
    const availability = getAvailability(details, descriptor)
    const stageSupport = readStageSupport(descriptor, stageId)
    const planned = availability === "planned"
    const systemCommand = availability === "system-command"
    const plannedReason = toString(details.plannedReason).trim() || toString(descriptor?.plannedReason).trim()
    const setupHint = toString(details.setupHint).trim() || toString(descriptor?.setupHint).trim()
    const statusLabel = planned
      ? text(["mediaAnalysis", "settings", "status", "planned"])
      : systemCommand
        ? tool.installed === true
          ? text(["mediaAnalysis", "settings", "status", "manualReady"])
          : text(["mediaAnalysis", "settings", "status", "manualSetup"])
        : tool.installed === true
          ? updateAvailable
            ? text(["mediaAnalysis", "settings", "status", "updateAvailable"])
            : text(["mediaAnalysis", "settings", "status", "installed"])
          : text(["mediaAnalysis", "settings", "status", "missing"])
    const actionMarkup = planned
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
              `

    return `
      <article class="lab-tool-card">
        <div class="lab-tool-card__head">
          <div>
            <strong>${escapeHtml(
              text(["mediaAnalysis", "settings", "tools", toolId]) ||
                toString(descriptor?.displayName) ||
                toolId
            )}</strong>
            <span>${escapeHtml(statusLabel)}</span>
          </div>
          ${actionMarkup}
        </div>
        <ul class="lab-summary-list">
          ${renderPreviewMetaRow(
            text(["mediaAnalysis", "settings", "stageSupportLabel"]),
            text(["mediaAnalysis", "settings", "support", stageSupport])
          )}
          ${renderPreviewMetaRow(text(["mediaAnalysis", "settings", "versionLabel"]), toString(tool.version, "--"))}
          ${renderPreviewMetaRow(
            text(["mediaAnalysis", "settings", "latestLabel"]),
            toString(tool.latestVersion) || toString(tool.latestReleaseName) || "--"
          )}
          ${renderPreviewMetaRow(
            text(["mediaAnalysis", "settings", "pathLabel"]),
            toString(tool.binaryPath, "--")
          )}
        </ul>
        ${
          busy
            ? `<p class="lab-panel__hint">${escapeHtml(text(["mediaAnalysis", "settings", "busyHint"]))}</p>`
            : ""
        }
        ${plannedReason ? `<p class="lab-panel__hint">${escapeHtml(plannedReason)}</p>` : ""}
        ${setupHint ? `<p class="lab-panel__hint">${escapeHtml(setupHint)}</p>` : ""}
        ${
          toString(tool.lastError).trim()
            ? `<p class="lab-panel__hint lab-panel__hint--danger">${escapeHtml(
                toString(tool.lastError)
              )}</p>`
            : ""
        }
      </article>
    `
  }

  return {
    renderToolCard,
  }
}
