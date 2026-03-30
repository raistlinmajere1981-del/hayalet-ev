type LaboratoryRecord = Record<string, unknown>

type LaboratoryReportFindingRecord = LaboratoryRecord & {
  moduleId?: unknown
}

type LaboratoryProcessModuleRecord = LaboratoryRecord & {
  id?: unknown
  status?: unknown
  summary?: unknown
}

type LaboratoryProcessArtifactRecord = LaboratoryRecord & {
  moduleId?: unknown
}

type LaboratoryReportExportRecord = LaboratoryRecord & {
  createdAt?: unknown
  fileName?: unknown
  format?: unknown
  path?: unknown
  status?: unknown
}

type LaboratorySubtitleReportStageRuntimeDeps = {
  escapeHtml: (value: string) => string
  featureText: (path: string[]) => string
  formatDateTime: (value: unknown) => string
  formatStatusLabel: (value: unknown) => string
  getProcessArtifacts: () => unknown[]
  getProcessModules: () => unknown[]
  getReportExports: () => unknown[]
  getReportFindings: () => unknown[]
  getSubtitleProcessModuleLabel: (module: LaboratoryRecord) => string
  getSubtitleProcessModuleSummary: (module: LaboratoryRecord) => string
  toRecord: (value: unknown) => LaboratoryRecord
}

export function createLaboratorySubtitleReportStageRuntime(
  deps: LaboratorySubtitleReportStageRuntimeDeps
) {
  const {
    escapeHtml,
    featureText,
    formatDateTime,
    formatStatusLabel,
    getProcessArtifacts,
    getProcessModules,
    getReportExports,
    getReportFindings,
    getSubtitleProcessModuleLabel,
    getSubtitleProcessModuleSummary,
    toRecord,
  } = deps

  function toFindingRecord(value: unknown): LaboratoryReportFindingRecord {
    return toRecord(value)
  }

  function toModuleRecord(value: unknown): LaboratoryProcessModuleRecord {
    return toRecord(value)
  }

  function toArtifactRecord(value: unknown): LaboratoryProcessArtifactRecord {
    return toRecord(value)
  }

  function toExportRecord(value: unknown): LaboratoryReportExportRecord {
    return toRecord(value)
  }

  function asString(value: unknown, fallback = ""): string {
    return typeof value === "string" ? value : fallback
  }

  function getSubtitleReportModuleFindingCount(moduleId: string) {
    return getReportFindings()
      .map(toFindingRecord)
      .filter(function (entry) {
        return entry.moduleId === moduleId
      }).length
  }

  function getSubtitleReportModuleArtifactCount(moduleId: string) {
    return getProcessArtifacts()
      .map(toArtifactRecord)
      .filter(function (entry) {
        return entry.moduleId === moduleId
      }).length
  }

  function renderSubtitleReportModuleGrid() {
    const modules = getProcessModules().map(toModuleRecord)
    if (modules.length === 0) {
      return ""
    }

    return `
      <section class="lab-panel">
        <div class="lab-panel__header">
          <div>
            <p class="lab-panel__eyebrow">${escapeHtml(featureText(["report", "moduleRollupEyebrow"]))}</p>
            <h2 class="lab-panel__title">${escapeHtml(featureText(["report", "moduleRollupTitle"]))}</h2>
            <p class="lab-panel__subtitle">${escapeHtml(featureText(["report", "moduleRollupSubtitle"]))}</p>
          </div>
        </div>
        <div class="lab-tool-grid">
          ${modules
            .map(function (moduleEntry) {
              const moduleId = asString(moduleEntry.id)
              const moduleStatus = moduleEntry.status || "idle"
              const moduleSummary =
                asString(moduleEntry.summary) ||
                getSubtitleProcessModuleSummary({ id: moduleId }) ||
                featureText(["report", "emptyBody"])
              return `
                <article class="lab-tool-card">
                  <div class="lab-tool-card__head">
                    <div>
                      <strong>${escapeHtml(getSubtitleProcessModuleLabel({ id: moduleId }))}</strong>
                      <span>${escapeHtml(formatStatusLabel(moduleStatus))}</span>
                    </div>
                    <span class="lab-chip">${escapeHtml(formatStatusLabel(moduleStatus))}</span>
                  </div>
                  <p class="lab-panel__hint">${escapeHtml(moduleSummary)}</p>
                  <ul class="lab-meta-list">
                    <li>
                      <span>${escapeHtml(featureText(["report", "moduleMeta", "status"]))}</span>
                      <strong>${escapeHtml(formatStatusLabel(moduleStatus))}</strong>
                    </li>
                    <li>
                      <span>${escapeHtml(featureText(["report", "moduleMeta", "findings"]))}</span>
                      <strong>${escapeHtml(String(getSubtitleReportModuleFindingCount(moduleId)))}</strong>
                    </li>
                    <li>
                      <span>${escapeHtml(featureText(["report", "moduleMeta", "artifacts"]))}</span>
                      <strong>${escapeHtml(String(getSubtitleReportModuleArtifactCount(moduleId)))}</strong>
                    </li>
                  </ul>
                </article>
              `
            })
            .join("")}
        </div>
      </section>
    `
  }

  function renderSubtitleReportExportHistoryPanel() {
    const exportsList = getReportExports().map(toExportRecord)
    if (exportsList.length === 0) {
      return ""
    }

    return `
      <section class="lab-panel">
        <div class="lab-panel__header">
          <div>
            <p class="lab-panel__eyebrow">${escapeHtml(featureText(["report", "exportHistoryEyebrow"]))}</p>
            <h2 class="lab-panel__title">${escapeHtml(featureText(["report", "exportHistoryTitle"]))}</h2>
            <p class="lab-panel__subtitle">${escapeHtml(featureText(["report", "exportHistorySubtitle"]))}</p>
          </div>
        </div>
        <div class="lab-tool-grid">
          ${exportsList
            .map(function (entry) {
              const fileName = asString(entry.fileName) || asString(entry.path) || "--"
              const format = asString(entry.format, "md").toUpperCase()
              const status = entry.status || "ready"
              return `
                <article class="lab-tool-card">
                  <div class="lab-tool-card__head">
                    <div>
                      <strong>${escapeHtml(fileName)}</strong>
                      <span>${escapeHtml(format)}</span>
                    </div>
                    <span class="lab-chip">${escapeHtml(formatStatusLabel(status))}</span>
                  </div>
                  <ul class="lab-meta-list">
                    <li>
                      <span>${escapeHtml(featureText(["report", "exportMeta", "format"]))}</span>
                      <strong>${escapeHtml(format)}</strong>
                    </li>
                    <li>
                      <span>${escapeHtml(featureText(["report", "exportMeta", "created"]))}</span>
                      <strong>${escapeHtml(formatDateTime(entry.createdAt))}</strong>
                    </li>
                    <li>
                      <span>${escapeHtml(featureText(["report", "exportMeta", "status"]))}</span>
                      <strong>${escapeHtml(formatStatusLabel(status))}</strong>
                    </li>
                  </ul>
                </article>
              `
            })
            .join("")}
        </div>
      </section>
    `
  }

  return {
    renderSubtitleReportExportHistoryPanel,
    renderSubtitleReportModuleGrid,
  }
}
