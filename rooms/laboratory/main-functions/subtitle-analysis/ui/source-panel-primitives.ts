type LaboratoryRecord = Record<string, unknown>;

type LaboratorySubtitleSourcePresetsRecord = LaboratoryRecord & {
  modes?: unknown;
};

type LaboratorySubtitleWorkspaceRecord = LaboratoryRecord & {
  mode?: unknown;
};

type SubtitleDraftSelectOption = {
  label: string;
  value: string;
};

type SubtitleAnalysisSourcePanelPrimitivesDeps = {
  escapeHtml: (value: string) => string;
  getSubtitleSourcePresets: () => LaboratorySubtitleSourcePresetsRecord;
  getSubtitleWorkspace: () => LaboratorySubtitleWorkspaceRecord;
  subtitleText: (path: string[], tr: string, en: string) => string;
};

export function createSubtitleAnalysisSourcePanelPrimitives(
  deps: SubtitleAnalysisSourcePanelPrimitivesDeps
) {
  const escapeHtml = deps.escapeHtml;
  const subtitleText = deps.subtitleText;
  const getSubtitleSourcePresets = deps.getSubtitleSourcePresets;
  const getSubtitleWorkspace = deps.getSubtitleWorkspace;

  function getSubtitleSourceModeOptions() {
    const modes = getSubtitleSourcePresets().modes;
    return Array.isArray(modes)
      ? modes.filter(function (entry): entry is string {
          return typeof entry === "string" && entry.trim() !== "";
        })
      : [
          "local-file",
          "local-folder",
          "url",
          "youtube-single",
          "youtube-playlist",
          "youtube-channel",
        ];
  }

  function getCurrentSubtitleSourceMode() {
    const workspace = getSubtitleWorkspace();
    const currentMode = typeof workspace.mode === "string" ? workspace.mode : null;
    const modes = getSubtitleSourceModeOptions();
    const fallbackMode = modes[0] ?? "local-file";
    return currentMode !== null && modes.includes(currentMode) ? currentMode : fallbackMode;
  }

  function getSubtitleSourceModeLabel(modeId: string) {
    switch (modeId) {
      case "local-folder":
        return subtitleText(["source", "modes", "localFolder"], "Klasor", "Folder");
      case "url":
        return "URL";
      case "youtube-single":
        return subtitleText(
          ["source", "modes", "youtubeSingle"],
          "YouTube Tek Video",
          "YouTube Single"
        );
      case "youtube-playlist":
        return subtitleText(
          ["source", "modes", "youtubePlaylist"],
          "YouTube Playlist",
          "YouTube Playlist"
        );
      case "youtube-channel":
        return subtitleText(
          ["source", "modes", "youtubeChannel"],
          "YouTube Kanal",
          "YouTube Channel"
        );
      case "local-file":
      default:
        return subtitleText(["source", "modes", "localFile"], "Tek Altyazi", "Single Subtitle");
    }
  }

  function renderSubtitleDraftSelect(
    fieldId: string,
    value: string,
    label: string,
    options: SubtitleDraftSelectOption[]
  ) {
    return `
      <label class="lab-field">
        <span class="lab-field__label">${escapeHtml(label)}</span>
        <select class="lab-select" data-draft-field="${escapeHtml(fieldId)}">
          ${options
            .map(function (entry) {
              return `
                <option value="${escapeHtml(entry.value)}" ${
                  String(entry.value) === String(value) ? "selected" : ""
                }>
                  ${escapeHtml(entry.label)}
                </option>
              `;
            })
            .join("")}
        </select>
      </label>
    `;
  }

  return {
    getSubtitleSourceModeOptions,
    getCurrentSubtitleSourceMode,
    getSubtitleSourceModeLabel,
    renderSubtitleDraftSelect,
  };
}
