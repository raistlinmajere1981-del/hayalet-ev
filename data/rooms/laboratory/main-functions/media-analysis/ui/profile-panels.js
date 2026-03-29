export function createMediaAnalysisProfilePanels(deps) {
  const toRecord = deps.toRecord;
  const escapeHtml = deps.escapeHtml;
  const text = deps.text;
  const textFromKey = deps.textFromKey;
  const getProjectProfile = deps.getProjectProfile;
  const getProfilePresetOptions = deps.getProfilePresetOptions;
  const getProfileModelEntries = deps.getProfileModelEntries;
  const getProfileSelectedModel = deps.getProfileSelectedModel;
  const getProfileLaneMap = deps.getProfileLaneMap;
  const getCurrentSourceKind = deps.getCurrentSourceKind;
  const getProfileArtifactPreferenceEntries = deps.getProfileArtifactPreferenceEntries;
  const getProfileTranscriptSampleConfig = deps.getProfileTranscriptSampleConfig;
  const getProfileCapabilities = deps.getProfileCapabilities;
  const getProfileFrameDensityOptions = deps.getProfileFrameDensityOptions;
  const getProfileLaneCardState = deps.getProfileLaneCardState;
  function renderProfilePresetPanel() {
    const profile = getProjectProfile();
    return `
      <section class="lab-panel">
        <div class="lab-panel__header">
          <div>
            <p class="lab-panel__eyebrow">${escapeHtml(text(["mediaAnalysis", "profile", "presetTitle"]))}</p>
            <h2 class="lab-panel__title">${escapeHtml(text(["mediaAnalysis", "profile", "presetSubtitle"]))}</h2>
          </div>
        </div>
        <div class="lab-profile-grid">
          ${getProfilePresetOptions().map(function(preset) {
      return `
                <button
                  class="lab-profile-card"
                  type="button"
                  data-action="profile-preset"
                  data-value="${escapeHtml(preset.id || "")}"
                  data-selected="${preset.id === profile.activePresetId ? "true" : "false"}"
                >
                  <span class="lab-profile-card__title">${escapeHtml(textFromKey(preset.labelKey || ""))}</span>
                  <span class="lab-profile-card__summary">${escapeHtml(textFromKey(preset.summaryKey || ""))}</span>
                  <span class="lab-profile-card__pace">${escapeHtml(textFromKey(preset.paceKey || ""))}</span>
                </button>
              `;
    }).join("")}
        </div>
      </section>
    `;
  }
  function renderProfileAdvancedPanel() {
    const profile = getProjectProfile();
    const modelEntries = getProfileModelEntries();
    const selectedModel = getProfileSelectedModel();
    const laneIds = Object.keys(toRecord(getProfileLaneMap()));
    const sourceKind = getCurrentSourceKind();
    const artifactEntries = getProfileArtifactPreferenceEntries();
    const transcriptConfig = getProfileTranscriptSampleConfig();
    return `
      <section class="lab-panel">
        <div class="lab-panel__header">
          <div>
            <p class="lab-panel__eyebrow">${escapeHtml(text(["mediaAnalysis", "profile", "advancedTitle"]))}</p>
            <h2 class="lab-panel__title">${escapeHtml(text(["mediaAnalysis", "profile", "advancedSubtitle"]))}</h2>
          </div>
        </div>
        <div class="lab-subgrid lab-subgrid--profile-controls">
          <label class="lab-field">
            <span class="lab-field__label">${escapeHtml(text(["mediaAnalysis", "profile", "depthLabel"]))}</span>
            <select class="lab-select" data-profile-field="depth">
              ${Object.keys(toRecord(getProfileCapabilities().depthModes)).map(function(depthId) {
      return `
                    <option value="${escapeHtml(depthId)}" ${depthId === profile.depth ? "selected" : ""}>
                      ${escapeHtml(textFromKey(toRecord(toRecord(getProfileCapabilities().depthModes)[depthId]).labelKey || ""))}
                    </option>
                  `;
    }).join("")}
            </select>
          </label>
          <label class="lab-field">
            <span class="lab-field__label">${escapeHtml(
      `${text(["mediaAnalysis", "profile", "sensitivityLabel"])} ${Math.round((Number(profile.sensitivity) || 0.58) * 100)}%`
    )}</span>
            <input
              type="range"
              min="0.1"
              max="1"
              step="0.02"
              value="${escapeHtml(String(Number(profile.sensitivity) || 0.58))}"
              data-profile-field="sensitivity"
            />
          </label>
          <label class="lab-field">
            <span class="lab-field__label">${escapeHtml(text(["mediaAnalysis", "profile", "frameDensityLabel"]))}</span>
            <select class="lab-select" data-profile-field="frameSampleDensity">
              ${getProfileFrameDensityOptions().map(function(entry) {
      return `
                    <option value="${escapeHtml(entry.densityId)}" ${entry.densityId === profile.frameSampleDensity ? "selected" : ""}>
                      ${escapeHtml(textFromKey(entry.labelKey || "") || entry.densityId)}
                    </option>
                  `;
    }).join("")}
            </select>
          </label>
          ${sourceKind === "video" || sourceKind === "audio" ? `
                <label class="lab-field">
                  <span class="lab-field__label">${escapeHtml(
      `${text(["mediaAnalysis", "profile", "transcriptSampleLabel"])} ${String(
        Number(profile.transcriptSampleSeconds) || Number(transcriptConfig.defaultValue) || 45
      )}s`
    )}</span>
                  <input
                    type="range"
                    min="${escapeHtml(String(Number(transcriptConfig.min) || 15))}"
                    max="${escapeHtml(String(Number(transcriptConfig.max) || 90))}"
                    step="${escapeHtml(String(Number(transcriptConfig.step) || 15))}"
                    value="${escapeHtml(
      String(Number(profile.transcriptSampleSeconds) || Number(transcriptConfig.defaultValue) || 45)
    )}"
                    data-profile-field="transcriptSampleSeconds"
                  />
                </label>
              ` : ""}
        </div>
        ${modelEntries.length > 0 ? `
              <label class="lab-field">
                <span class="lab-field__label">${escapeHtml(text(["mediaAnalysis", "profile", "modelLabel"]))}</span>
                <select class="lab-select" data-profile-field="modelId">
                  <option value="">${escapeHtml(text(["mediaAnalysis", "profile", "modelAuto"]))}</option>
                  ${modelEntries.map(function(entry) {
      return `
                        <option value="${escapeHtml(entry.modelId || "")}" ${selectedModel && selectedModel.modelId === entry.modelId ? "selected" : ""}>
                          ${escapeHtml(textFromKey(entry.labelKey || "") || entry.modelId || "")}
                        </option>
                      `;
    }).join("")}
                </select>
              </label>
            ` : ""}
        ${artifactEntries.length > 0 ? `
              <section class="lab-panel lab-panel--dense">
                <div class="lab-panel__header">
                  <div>
                    <p class="lab-panel__eyebrow">${escapeHtml(text(["mediaAnalysis", "profile", "artifactControlsTitle"]))}</p>
                    <h2 class="lab-panel__title">${escapeHtml(text(["mediaAnalysis", "profile", "artifactControlsSubtitle"]))}</h2>
                  </div>
                </div>
                <div class="lab-toggle-grid">
                  ${artifactEntries.map(function(entry) {
      return `
                        <button
                          class="lab-toggle"
                          type="button"
                          data-profile-artifact-toggle="${entry.artifactId}"
                          data-active="${entry.enabled ? "true" : "false"}"
                        >
                          <span class="lab-toggle__track"><span class="lab-toggle__thumb"></span></span>
                          <span class="lab-toggle__meta">
                            <strong>${escapeHtml(textFromKey(entry.labelKey || "") || entry.artifactId)}</strong>
                          </span>
                        </button>
                      `;
    }).join("")}
                </div>
              </section>
            ` : ""}
        <div class="lab-toggle-grid">
          ${laneIds.map(function(laneId) {
      const laneState = getProfileLaneCardState(laneId);
      const lane = toRecord(laneState.lane);
      return `
                <button
                  class="lab-toggle lab-profile-lane"
                  type="button"
                  data-profile-toggle="${laneId}"
                  data-active="${laneState.enabled ? "true" : "false"}"
                  ${laneState.compatible ? "" : "disabled"}
                >
                  <span class="lab-toggle__track"><span class="lab-toggle__thumb"></span></span>
                  <span class="lab-toggle__meta">
                    <strong>${escapeHtml(textFromKey(lane.labelKey || "") || laneId)}</strong>
                    <span>${escapeHtml(textFromKey(lane.summaryKey || ""))}</span>
                    <em>${escapeHtml(text(["mediaAnalysis", "profile", "laneState", laneState.supportLevel || "ready"]))}</em>
                    <span>${escapeHtml(
        `${text(["mediaAnalysis", "profile", "laneMeta", "requiredTools"])}: ${laneState.requiredTools.join(", ") || "--"}`
      )}</span>
                    <span>${escapeHtml(
        `${text(["mediaAnalysis", "profile", "laneMeta", "mediaKinds"])}: ${laneState.mediaKinds.join(", ") || "--"}`
      )}</span>
                    ${laneState.optionalTools.length > 0 ? `<span>${escapeHtml(
        `${text(["mediaAnalysis", "profile", "laneMeta", "optionalTools"])}: ${laneState.optionalTools.join(", ")}`
      )}</span>` : ""}
                    ${laneState.note ? `<span>${escapeHtml(laneState.note)}</span>` : ""}
                  </span>
                </button>
              `;
    }).join("")}
        </div>
      </section>
    `;
  }
  return {
    renderProfileAdvancedPanel,
    renderProfilePresetPanel
  };
}
