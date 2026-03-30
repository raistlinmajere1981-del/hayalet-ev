type LaboratoryRecord = Record<string, unknown>

type LaboratoryProfileModelRecord = LaboratoryRecord & {
  binarySupported?: unknown
  busy?: unknown
  checksumValid?: unknown
  cleanupPolicy?: unknown
  compatibilityReason?: unknown
  expectedBytes?: unknown
  installed?: unknown
  labelKey?: unknown
  language?: unknown
  lastError?: unknown
  modelId?: unknown
  quantization?: unknown
  ready?: unknown
  runtimeCompatible?: unknown
  sizeBytes?: unknown
  summaryKey?: unknown
  supportedPlatforms?: unknown
}

type LaboratoryToolStateRecord = LaboratoryRecord & {
  installed?: unknown
}

type LaboratorySettingsProfileModelRuntimeDeps = {
  escapeHtml: (value: string) => string
  formatBytes: (value: unknown) => string
  formatCleanupPolicy: (value: unknown) => string
  formatPlatformList: (value: unknown) => string
  getToolEntry: (toolId: string) => LaboratoryToolStateRecord
  renderPreviewMetaRow: (label: string, value: unknown) => string
  text: (path: string[]) => string
  textFromKey: (key: string) => string
  toRecord: (value: unknown) => LaboratoryRecord
}

export function createLaboratorySettingsProfileModelRuntime(
  deps: LaboratorySettingsProfileModelRuntimeDeps
) {
  const {
    escapeHtml,
    formatBytes,
    formatCleanupPolicy,
    formatPlatformList,
    getToolEntry,
    renderPreviewMetaRow,
    text,
    textFromKey,
    toRecord,
  } = deps

  function toModelRecord(value: unknown): LaboratoryProfileModelRecord {
    return toRecord(value)
  }

  function toToolStateRecord(value: unknown): LaboratoryToolStateRecord {
    return toRecord(value)
  }

  function toString(value: unknown, fallback = ""): string {
    return typeof value === "string" ? value : fallback
  }

  function renderProfileModelCard(entry: LaboratoryProfileModelRecord) {
    const model = toModelRecord(entry)
    const whisperTool = toToolStateRecord(getToolEntry("whisper.cpp"))
    const busy = model.busy === true
    const canInstall =
      model.binarySupported === true &&
      whisperTool.installed === true &&
      model.runtimeCompatible !== false
    const statusLabel =
      model.ready === true
        ? text(["mediaAnalysis", "settings", "status", "ready"])
        : model.installed === true
          ? text(["mediaAnalysis", "settings", "status", "installed"])
          : text(["mediaAnalysis", "settings", "status", "missing"])
    const modelId = toString(model.modelId)
    const label = textFromKey(toString(model.labelKey)) || modelId || "--"

    return `
      <article class="lab-tool-card">
        <div class="lab-tool-card__head">
          <div>
            <strong>${escapeHtml(label)}</strong>
            <span>${escapeHtml(statusLabel)}</span>
          </div>
          ${
            model.installed === true
              ? `
                <button
                  class="lab-button lab-button--ghost lab-button--tight"
                  type="button"
                  data-action="profile-model-remove"
                  data-value="${escapeHtml(modelId)}"
                  ${busy ? "disabled" : ""}
                >
                  ${escapeHtml(text(["mediaAnalysis", "profile", "modelActions", "remove"]))}
                </button>
              `
              : `
                <button
                  class="lab-button lab-button--primary lab-button--tight"
                  type="button"
                  data-action="profile-model-install"
                  data-value="${escapeHtml(modelId)}"
                  ${busy || canInstall !== true ? "disabled" : ""}
                >
                  ${escapeHtml(text(["mediaAnalysis", "profile", "modelActions", "install"]))}
                </button>
              `
          }
        </div>
        <ul class="lab-summary-list">
          ${renderPreviewMetaRow(
            text(["mediaAnalysis", "profile", "modelSummary", "size"]),
            formatBytes(model.sizeBytes || model.expectedBytes)
          )}
          ${renderPreviewMetaRow(
            text(["mediaAnalysis", "profile", "modelSummary", "quantization"]),
            toString(model.quantization, "--")
          )}
          ${renderPreviewMetaRow(
            text(["mediaAnalysis", "profile", "modelSummary", "language"]),
            toString(model.language, "--")
          )}
          ${renderPreviewMetaRow(
            text(["mediaAnalysis", "profile", "modelSummary", "platforms"]),
            formatPlatformList(model.supportedPlatforms)
          )}
          ${renderPreviewMetaRow(
            text(["mediaAnalysis", "profile", "modelSummary", "cleanup"]),
            formatCleanupPolicy(model.cleanupPolicy)
          )}
          ${renderPreviewMetaRow(
            text(["mediaAnalysis", "profile", "modelSummary", "integrity"]),
            model.checksumValid === true
              ? text(["mediaAnalysis", "settings", "status", "ready"])
              : model.installed === true
                ? text(["mediaAnalysis", "settings", "status", "installed"])
                : "--"
          )}
        </ul>
        ${
          toString(model.summaryKey).trim()
            ? `<p class="lab-panel__hint">${escapeHtml(textFromKey(toString(model.summaryKey)))}</p>`
            : ""
        }
        ${
          canInstall !== true
            ? `<p class="lab-panel__hint">${escapeHtml(
                text(["mediaAnalysis", "profile", "modelUnavailable"])
              )}</p>`
            : ""
        }
        ${
          toString(model.compatibilityReason).trim()
            ? `<p class="lab-panel__hint">${escapeHtml(toString(model.compatibilityReason))}</p>`
            : ""
        }
        ${
          toString(model.lastError).trim()
            ? `<p class="lab-panel__hint lab-panel__hint--danger">${escapeHtml(
                toString(model.lastError)
              )}</p>`
            : ""
        }
      </article>
    `
  }

  return {
    renderProfileModelCard,
  }
}
