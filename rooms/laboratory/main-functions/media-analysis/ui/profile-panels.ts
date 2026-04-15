type LaboratoryRecord = Record<string, unknown>;

type LaboratoryProfileStateRecord = LaboratoryRecord & {
  activePresetId?: unknown;
  depth?: unknown;
  frameSampleDensity?: unknown;
  sensitivity?: unknown;
  transcriptSampleSeconds?: unknown;
};

type LaboratoryProfilePresetRecord = LaboratoryRecord & {
  id?: unknown;
  labelKey?: unknown;
  paceKey?: unknown;
  summaryKey?: unknown;
};

type LaboratoryProfileModelEntryRecord = LaboratoryRecord & {
  labelKey?: unknown;
  modelId?: unknown;
};

type LaboratoryProfileCapabilitiesRecord = LaboratoryRecord & {
  depthModes?: unknown;
};

type LaboratoryProfileDepthModeRecord = LaboratoryRecord & {
  labelKey?: unknown;
};

type LaboratoryFrameDensityOptionRecord = LaboratoryRecord & {
  densityId?: unknown;
  labelKey?: unknown;
};

type LaboratoryArtifactPreferenceEntryRecord = LaboratoryRecord & {
  artifactId?: unknown;
  enabled?: unknown;
  labelKey?: unknown;
};

type LaboratoryTranscriptSampleConfigRecord = LaboratoryRecord & {
  defaultValue?: unknown;
  max?: unknown;
  min?: unknown;
  step?: unknown;
};

type LaboratoryProfileLaneRecord = LaboratoryRecord & {
  labelKey?: unknown;
  summaryKey?: unknown;
};

type LaboratoryProfileLaneCardStateRecord = LaboratoryRecord & {
  compatible?: unknown;
  enabled?: unknown;
  lane?: unknown;
  mediaKinds?: unknown;
  note?: unknown;
  optionalTools?: unknown;
  requiredTools?: unknown;
  supportLevel?: unknown;
};

type LaboratoryProfilePanelsDeps = {
  escapeHtml: (value: string) => string;
  getCurrentSourceKind: () => unknown;
  getProfileArtifactPreferenceEntries: () => unknown;
  getProfileCapabilities: () => unknown;
  getProfileFrameDensityOptions: () => unknown;
  getProfileLaneCardState: (laneId: string) => unknown;
  getProfileLaneMap: () => unknown;
  getProfileModelEntries: () => unknown;
  getProfilePresetOptions: () => unknown;
  getProfileSelectedModel: () => unknown;
  getProfileTranscriptSampleConfig: () => unknown;
  getProjectProfile: () => unknown;
  text: (path: string[]) => string;
  textFromKey: (key: string) => string;
  toRecord: (value: unknown) => LaboratoryRecord;
};

export function createMediaAnalysisProfilePanels(deps: LaboratoryProfilePanelsDeps) {
  const {
    escapeHtml,
    getCurrentSourceKind,
    getProfileArtifactPreferenceEntries,
    getProfileCapabilities,
    getProfileFrameDensityOptions,
    getProfileLaneCardState,
    getProfileLaneMap,
    getProfileModelEntries,
    getProfilePresetOptions,
    getProfileSelectedModel,
    getProfileTranscriptSampleConfig,
    getProjectProfile,
    text,
    textFromKey,
    toRecord,
  } = deps;

  function toProfileStateRecord(value: unknown): LaboratoryProfileStateRecord {
    return toRecord(value);
  }

  function toPresetRecord(value: unknown): LaboratoryProfilePresetRecord {
    return toRecord(value);
  }

  function toModelEntryRecord(value: unknown): LaboratoryProfileModelEntryRecord {
    return toRecord(value);
  }

  function toProfileCapabilitiesRecord(value: unknown): LaboratoryProfileCapabilitiesRecord {
    return toRecord(value);
  }

  function toDepthModeRecord(value: unknown): LaboratoryProfileDepthModeRecord {
    return toRecord(value);
  }

  function toFrameDensityOptionRecord(value: unknown): LaboratoryFrameDensityOptionRecord {
    return toRecord(value);
  }

  function toArtifactPreferenceEntryRecord(
    value: unknown
  ): LaboratoryArtifactPreferenceEntryRecord {
    return toRecord(value);
  }

  function toTranscriptSampleConfigRecord(value: unknown): LaboratoryTranscriptSampleConfigRecord {
    return toRecord(value);
  }

  function toLaneRecord(value: unknown): LaboratoryProfileLaneRecord {
    return toRecord(value);
  }

  function toLaneCardStateRecord(value: unknown): LaboratoryProfileLaneCardStateRecord {
    return toRecord(value);
  }

  function toString(value: unknown, fallback = ""): string {
    return typeof value === "string" ? value : fallback;
  }

  function toNumber(value: unknown, fallback: number): number {
    return typeof value === "number" && Number.isFinite(value) ? value : fallback;
  }

  function toStringArray(value: unknown): string[] {
    if (!Array.isArray(value)) {
      return [];
    }
    return value
      .map(function (entry) {
        return typeof entry === "string" && entry.trim() !== "" ? entry : null;
      })
      .filter((entry): entry is string => entry !== null);
  }

  function getPresetOptions(): LaboratoryProfilePresetRecord[] {
    const presetOptions = getProfilePresetOptions();
    return Array.isArray(presetOptions) ? presetOptions.map(toPresetRecord) : [];
  }

  function getModelEntries(): LaboratoryProfileModelEntryRecord[] {
    const modelEntries = getProfileModelEntries();
    return Array.isArray(modelEntries) ? modelEntries.map(toModelEntryRecord) : [];
  }

  function getArtifactEntries(): LaboratoryArtifactPreferenceEntryRecord[] {
    const artifactEntries = getProfileArtifactPreferenceEntries();
    return Array.isArray(artifactEntries)
      ? artifactEntries.map(toArtifactPreferenceEntryRecord)
      : [];
  }

  function getFrameDensityOptions(): LaboratoryFrameDensityOptionRecord[] {
    const densityOptions = getProfileFrameDensityOptions();
    return Array.isArray(densityOptions) ? densityOptions.map(toFrameDensityOptionRecord) : [];
  }

  function getDepthModeMap(): Record<string, LaboratoryProfileDepthModeRecord> {
    return toRecord(toProfileCapabilitiesRecord(getProfileCapabilities()).depthModes) as Record<
      string,
      LaboratoryProfileDepthModeRecord
    >;
  }

  function getSelectedModelEntry(): LaboratoryProfileModelEntryRecord | null {
    const selectedModel = getProfileSelectedModel();
    return selectedModel ? toModelEntryRecord(selectedModel) : null;
  }

  function renderProfilePresetPanel() {
    const profile = toProfileStateRecord(getProjectProfile());
    const activePresetId = toString(profile.activePresetId);
    return `
      <section class="lab-panel lab-panel--primary-canvas">
        <div class="lab-panel__header">
          <div>
            <h2 class="lab-panel__title">${escapeHtml(text(["mediaAnalysis", "profile", "presetTitle"]))}</h2>
            <p class="lab-panel__hint">${escapeHtml(text(["mediaAnalysis", "profile", "presetSubtitle"]))}</p>
          </div>
        </div>
        <div class="lab-profile-grid">
          ${getPresetOptions()
            .map(function (preset) {
              const presetId = toString(preset.id);
              return `
                <button
                  class="lab-profile-card"
                  type="button"
                  data-action="profile-preset"
                  data-value="${escapeHtml(presetId)}"
                  data-selected="${presetId === activePresetId ? "true" : "false"}"
                >
                  <span class="lab-profile-card__title">${escapeHtml(textFromKey(toString(preset.labelKey)))}</span>
                  <span class="lab-profile-card__summary">${escapeHtml(textFromKey(toString(preset.summaryKey)))}</span>
                  <span class="lab-profile-card__pace">${escapeHtml(textFromKey(toString(preset.paceKey)))}</span>
                </button>
              `;
            })
            .join("")}
        </div>
      </section>
    `;
  }

  function renderProfileAdvancedPanel() {
    const profile = toProfileStateRecord(getProjectProfile());
    const selectedModel = getSelectedModelEntry();
    const laneIds = Object.keys(toRecord(getProfileLaneMap()));
    const sourceKind = toString(getCurrentSourceKind(), "video");
    const transcriptConfig = toTranscriptSampleConfigRecord(getProfileTranscriptSampleConfig());
    const depthModes = getDepthModeMap();
    const sensitivity = toNumber(profile.sensitivity, 0.58);
    const transcriptSampleSeconds = toNumber(
      profile.transcriptSampleSeconds,
      toNumber(transcriptConfig.defaultValue, 45)
    );
    const modelMarkup =
      getModelEntries().length > 0
        ? `
            <label class="lab-field">
              <span class="lab-field__label">${escapeHtml(text(["mediaAnalysis", "profile", "modelLabel"]))}</span>
              <select class="lab-select" data-profile-field="modelId">
                <option value="">${escapeHtml(text(["mediaAnalysis", "profile", "modelAuto"]))}</option>
                ${getModelEntries()
                  .map(function (entry) {
                    const modelId = toString(entry.modelId);
                    return `
                      <option value="${escapeHtml(modelId)}" ${
                        selectedModel !== null && toString(selectedModel.modelId) === modelId
                          ? "selected"
                          : ""
                      }>
                        ${escapeHtml(textFromKey(toString(entry.labelKey)) || modelId)}
                      </option>
                    `;
                  })
                  .join("")}
              </select>
            </label>
          `
        : "";
    const artifactMarkup =
      getArtifactEntries().length > 0
        ? `
            <div class="lab-toggle-grid lab-toggle-grid--profile-artifacts">
              ${getArtifactEntries()
                .map(function (entry) {
                  const artifactId = toString(entry.artifactId);
                  return `
                    <button
                      class="lab-toggle"
                      type="button"
                      data-profile-artifact-toggle="${artifactId}"
                      data-active="${entry.enabled === true ? "true" : "false"}"
                    >
                      <span class="lab-toggle__track"><span class="lab-toggle__thumb"></span></span>
                      <span class="lab-toggle__meta">
                        <strong>${escapeHtml(textFromKey(toString(entry.labelKey)) || artifactId)}</strong>
                      </span>
                    </button>
                  `;
                })
                .join("")}
            </div>
          `
        : "";
    const laneMarkup = laneIds
      .map(function (laneId) {
        const laneState = toLaneCardStateRecord(getProfileLaneCardState(laneId));
        const lane = toLaneRecord(laneState.lane);
        const requiredTools = toStringArray(laneState.requiredTools);
        const mediaKinds = toStringArray(laneState.mediaKinds);
        const optionalTools = toStringArray(laneState.optionalTools);
        return `
          <button
            class="lab-toggle lab-profile-lane"
            type="button"
            data-profile-toggle="${laneId}"
            data-active="${laneState.enabled === true ? "true" : "false"}"
            ${laneState.compatible === true ? "" : "disabled"}
          >
            <span class="lab-toggle__track"><span class="lab-toggle__thumb"></span></span>
            <span class="lab-toggle__meta">
              <strong>${escapeHtml(textFromKey(toString(lane.labelKey)) || laneId)}</strong>
              <span>${escapeHtml(textFromKey(toString(lane.summaryKey)))}</span>
              <em>${escapeHtml(
                text([
                  "mediaAnalysis",
                  "profile",
                  "laneState",
                  toString(laneState.supportLevel, "ready"),
                ])
              )}</em>
              <span>${escapeHtml(
                `${text(["mediaAnalysis", "profile", "laneMeta", "requiredTools"])}: ${
                  requiredTools.join(", ") || "--"
                }`
              )}</span>
              <span>${escapeHtml(
                `${text(["mediaAnalysis", "profile", "laneMeta", "mediaKinds"])}: ${
                  mediaKinds.join(", ") || "--"
                }`
              )}</span>
              ${
                optionalTools.length > 0
                  ? `<span>${escapeHtml(
                      `${text(["mediaAnalysis", "profile", "laneMeta", "optionalTools"])}: ${optionalTools.join(", ")}`
                    )}</span>`
                  : ""
              }
              ${toString(laneState.note) !== "" ? `<span>${escapeHtml(toString(laneState.note))}</span>` : ""}
            </span>
          </button>
        `;
      })
      .join("");
    return `
      <section class="lab-panel lab-panel--primary-canvas">
        <div class="lab-panel__header">
          <div>
            <h2 class="lab-panel__title">${escapeHtml(text(["mediaAnalysis", "profile", "advancedTitle"]))}</h2>
            <p class="lab-panel__hint">${escapeHtml(text(["mediaAnalysis", "profile", "advancedSubtitle"]))}</p>
          </div>
        </div>
        <div class="lab-profile-config-grid">
          <section class="lab-profile-group">
            <div class="lab-profile-group__head">
              <strong>${escapeHtml(text(["mediaAnalysis", "profile", "advancedGroups", "scanTitle"]))}</strong>
              <p class="lab-panel__hint">${escapeHtml(
                text(["mediaAnalysis", "profile", "advancedGroups", "scanSubtitle"])
              )}</p>
            </div>
            <div class="lab-subgrid lab-subgrid--profile-controls">
              <label class="lab-field">
                <span class="lab-field__label">${escapeHtml(text(["mediaAnalysis", "profile", "depthLabel"]))}</span>
                <select class="lab-select" data-profile-field="depth">
                  ${Object.keys(depthModes)
                    .map(function (depthId) {
                      const depthMode = toDepthModeRecord(depthModes[depthId]);
                      return `
                        <option value="${escapeHtml(depthId)}" ${depthId === toString(profile.depth, "balanced") ? "selected" : ""}>
                          ${escapeHtml(textFromKey(toString(depthMode.labelKey)))}
                        </option>
                      `;
                    })
                    .join("")}
                </select>
              </label>
              <label class="lab-field">
                <span class="lab-field__label">${escapeHtml(
                  `${text(["mediaAnalysis", "profile", "sensitivityLabel"])} ${Math.round(sensitivity * 100)}%`
                )}</span>
                <input
                  type="range"
                  min="0.1"
                  max="1"
                  step="0.02"
                  value="${escapeHtml(String(sensitivity))}"
                  data-profile-field="sensitivity"
                />
              </label>
              <label class="lab-field">
                <span class="lab-field__label">${escapeHtml(text(["mediaAnalysis", "profile", "frameDensityLabel"]))}</span>
                <select class="lab-select" data-profile-field="frameSampleDensity">
                  ${getFrameDensityOptions()
                    .map(function (entry) {
                      const densityId = toString(entry.densityId);
                      return `
                        <option value="${escapeHtml(densityId)}" ${
                          densityId === toString(profile.frameSampleDensity, "balanced")
                            ? "selected"
                            : ""
                        }>
                          ${escapeHtml(textFromKey(toString(entry.labelKey)) || densityId)}
                        </option>
                      `;
                    })
                    .join("")}
                </select>
              </label>
              ${
                sourceKind === "video" || sourceKind === "audio"
                  ? `
                    <label class="lab-field">
                      <span class="lab-field__label">${escapeHtml(
                        `${text(["mediaAnalysis", "profile", "transcriptSampleLabel"])} ${String(transcriptSampleSeconds)}s`
                      )}</span>
                      <input
                        type="range"
                        min="${escapeHtml(String(toNumber(transcriptConfig.min, 15)))}"
                        max="${escapeHtml(String(toNumber(transcriptConfig.max, 90)))}"
                        step="${escapeHtml(String(toNumber(transcriptConfig.step, 15)))}"
                        value="${escapeHtml(String(transcriptSampleSeconds))}"
                        data-profile-field="transcriptSampleSeconds"
                      />
                    </label>
                  `
                  : ""
              }
            </div>
          </section>
          <section class="lab-profile-group">
            <div class="lab-profile-group__head">
              <strong>${escapeHtml(text(["mediaAnalysis", "profile", "advancedGroups", "artifactsTitle"]))}</strong>
              <p class="lab-panel__hint">${escapeHtml(
                text(["mediaAnalysis", "profile", "advancedGroups", "artifactsSubtitle"])
              )}</p>
            </div>
            ${modelMarkup}
            ${artifactMarkup}
          </section>
        </div>
        <section class="lab-profile-group lab-profile-group--full">
          <div class="lab-profile-group__head">
            <strong>${escapeHtml(text(["mediaAnalysis", "profile", "advancedGroups", "lanesTitle"]))}</strong>
            <p class="lab-panel__hint">${escapeHtml(
              text(["mediaAnalysis", "profile", "advancedGroups", "lanesSubtitle"])
            )}</p>
          </div>
          <div class="lab-toggle-grid lab-toggle-grid--profile-lanes">
            ${laneMarkup}
          </div>
        </section>
      </section>
    `;
  }

  return {
    renderProfileAdvancedPanel: renderProfileAdvancedPanel,
    renderProfilePresetPanel: renderProfilePresetPanel,
  };
}
