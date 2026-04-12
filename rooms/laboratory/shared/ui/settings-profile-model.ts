type LaboratoryRecord = Record<string, unknown>;

type LaboratoryProfileModelRecord = LaboratoryRecord & {
  binarySupported?: unknown;
  busy?: unknown;
  checksumValid?: unknown;
  cleanupPolicy?: unknown;
  compatibilityReason?: unknown;
  expectedBytes?: unknown;
  installed?: unknown;
  labelKey?: unknown;
  language?: unknown;
  lastError?: unknown;
  modelId?: unknown;
  quantization?: unknown;
  ready?: unknown;
  runtimeCompatible?: unknown;
  sizeBytes?: unknown;
  summaryKey?: unknown;
  supportedPlatforms?: unknown;
};

type LaboratoryToolDescriptorRecord = LaboratoryRecord & {
  installStrategy?: unknown;
  manualHint?: unknown;
  readinessImpact?: unknown;
  setupHint?: unknown;
  testImpact?: unknown;
  toolId?: unknown;
  usedBy?: unknown;
};

type LaboratoryToolStateRecord = LaboratoryRecord & {
  installed?: unknown;
};

type LaboratorySettingsProfileModelRuntimeDeps = {
  escapeHtml: (value: string) => string;
  formatBytes: (value: unknown) => string;
  formatCleanupPolicy: (value: unknown) => string;
  formatPlatformList: (value: unknown) => string;
  getToolEntry: (toolId: string) => LaboratoryToolStateRecord;
  getToolRegistry: () => LaboratoryToolDescriptorRecord[];
  renderPreviewMetaRow: (label: string, value: unknown) => string;
  text: (path: string[]) => string;
  textFromKey: (key: string) => string;
  toRecord: (value: unknown) => LaboratoryRecord;
};

export function createLaboratorySettingsProfileModelRuntime(
  deps: LaboratorySettingsProfileModelRuntimeDeps
) {
  const {
    escapeHtml,
    formatBytes,
    formatCleanupPolicy,
    formatPlatformList,
    getToolEntry,
    getToolRegistry,
    renderPreviewMetaRow,
    text,
    textFromKey,
    toRecord,
  } = deps;

  function toModelRecord(value: unknown): LaboratoryProfileModelRecord {
    return toRecord(value);
  }

  function toToolStateRecord(value: unknown): LaboratoryToolStateRecord {
    return toRecord(value);
  }

  function toToolDescriptorRecord(value: unknown): LaboratoryToolDescriptorRecord {
    return toRecord(value);
  }

  function toString(value: unknown, fallback = ""): string {
    return typeof value === "string" ? value : fallback;
  }

  function getDescriptor(toolId: string): LaboratoryToolDescriptorRecord | null {
    return (
      getToolRegistry().find(function (entry) {
        return toString(toToolDescriptorRecord(entry).toolId) === toolId;
      }) || null
    );
  }

  function renderProfileModelCard(entry: LaboratoryProfileModelRecord) {
    const model = toModelRecord(entry);
    const whisperTool = toToolStateRecord(getToolEntry("whisper.cpp"));
    const whisperDescriptor = getDescriptor("whisper.cpp");
    const whisperDescriptorRecord =
      whisperDescriptor === null ? ({} as LaboratoryToolDescriptorRecord) : whisperDescriptor;
    const busy = model.busy === true;
    const canInstall =
      model.binarySupported === true &&
      whisperTool.installed === true &&
      model.runtimeCompatible !== false;
    const statusLabel =
      model.ready === true
        ? text(["mediaAnalysis", "settings", "status", "ready"])
        : model.installed === true
          ? text(["mediaAnalysis", "settings", "status", "installed"])
          : text(["mediaAnalysis", "settings", "status", "missing"]);
    const modelId = toString(model.modelId);
    const label = textFromKey(toString(model.labelKey)) || modelId || "--";
    const usedBy = Array.isArray(whisperDescriptorRecord.usedBy)
      ? (whisperDescriptorRecord.usedBy as unknown[]).map(function (item) {
          return String(item);
        })
      : [];
    const testImpact = Array.isArray(whisperDescriptorRecord.testImpact)
      ? (whisperDescriptorRecord.testImpact as unknown[]).map(function (item) {
          return String(item);
        })
      : [];
    const installStrategy = toString(whisperDescriptorRecord.installStrategy, "--");
    const setupHint =
      toString(whisperDescriptorRecord.manualHint).trim() ||
      toString(whisperDescriptorRecord.setupHint).trim();
    const readinessImpact = toString(whisperDescriptorRecord.readinessImpact).trim();

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
          ${renderPreviewMetaRow(text(["workbench", "dependency", "strategy"]), installStrategy)}
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
          usedBy.length > 0
            ? `<p class="lab-panel__hint">${escapeHtml(
                `${text(["workbench", "dependency", "usedBy"])}: ${usedBy.join(", ")}`
              )}</p>`
            : ""
        }
        ${
          testImpact.length > 0
            ? `<p class="lab-panel__hint">${escapeHtml(
                `${text(["workbench", "dependency", "tests"])}: ${testImpact.join(", ")}`
              )}</p>`
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
          canInstall !== true && setupHint
            ? `<p class="lab-panel__hint">${escapeHtml(setupHint)}</p>`
            : ""
        }
        ${
          canInstall !== true
            ? `<p class="lab-panel__hint">${escapeHtml(
                text(["mediaAnalysis", "profile", "modelVerificationHint"])
              )}</p>`
            : ""
        }
        ${
          canInstall !== true && readinessImpact
            ? `<p class="lab-panel__hint">${escapeHtml(readinessImpact)}</p>`
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
    `;
  }

  return {
    renderProfileModelCard,
  };
}
