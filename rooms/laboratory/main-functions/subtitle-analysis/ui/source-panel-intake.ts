import { createSubtitleAnalysisSourcePanelPrimitives } from "./source-panel-primitives.js";

export function createSubtitleAnalysisSourceIntakePanels(deps: any) {
  const escapeHtml = deps.escapeHtml;
  const featureText = deps.featureText;
  const subtitleText = deps.subtitleText;
  const subtitleTemplate = deps.subtitleTemplate;
  const renderTextField = deps.renderTextField;
  const getCurrentDrafts = deps.getCurrentDrafts;
  const getToolEntry = deps.getToolEntry;
  const getSubtitleDiscoveryItems = deps.getSubtitleDiscoveryItems;
  const getSubtitleSelectedCandidateIds = deps.getSubtitleSelectedCandidateIds;
  const primitives = createSubtitleAnalysisSourcePanelPrimitives(deps);

  function renderSubtitleSourceIntakePanel() {
    const drafts = getCurrentDrafts();
    const currentMode = primitives.getCurrentSubtitleSourceMode();
    const ytDlpInstalled = getToolEntry("yt-dlp").installed === true;
    const discoveryItems = getSubtitleDiscoveryItems();
    const selectedCandidateCount = getSubtitleSelectedCandidateIds().length;
    const body =
      currentMode === "local-file"
        ? `
        <button class="lab-button lab-button--primary" type="button" data-action="subtitle-source-pick-local">
          ${escapeHtml(subtitleText(["source", "actions", "pickLocal"], "Tek altyazi sec", "Pick subtitle file"))}
        </button>
      `
        : currentMode === "local-folder"
          ? `
        <button class="lab-button lab-button--primary" type="button" data-action="subtitle-source-pick-folder">
          ${escapeHtml(subtitleText(["source", "actions", "pickFolder"], "Klasor sec", "Pick subtitle folder"))}
        </button>
      `
          : currentMode === "url"
            ? `
        ${renderTextField(
          "urlInput",
          drafts.urlInput,
          subtitleText(["source", "fields", "subtitleUrl"], "Altyazi URL", "Subtitle URL"),
          subtitleText(
            ["source", "placeholders", "subtitleUrl"],
            "https://example.com/file.vtt",
            "https://example.com/file.vtt"
          )
        )}
        <button class="lab-button lab-button--primary" type="button" data-action="subtitle-source-download-url">
          ${escapeHtml(subtitleText(["source", "actions", "downloadUrl"], "URL indir", "Download URL"))}
        </button>
      `
            : `
        ${
          ytDlpInstalled !== true
            ? `<div class="lab-notice">${escapeHtml(featureText(["source", "youtubeDisabled"]))}</div>`
            : ""
        }
        ${renderTextField(
          "youtubeUrl",
          drafts.youtubeUrl,
          subtitleText(["source", "fields", "youtubeUrl"], "YouTube URL", "YouTube URL"),
          subtitleText(
            ["source", "placeholders", "youtubeUrl"],
            "Kanal, playlist ya da video linki",
            "Channel, playlist, or video URL"
          )
        )}
        <div class="lab-form-grid">
          ${primitives.renderSubtitleDraftSelect(
            "subtitleMode",
            drafts.subtitleMode || "manual",
            subtitleText(["source", "fields", "subtitleMode"], "Altyazi modu", "Subtitle mode"),
            [
              {
                value: "manual",
                label: subtitleText(
                  ["source", "options", "subtitleMode", "manual"],
                  "Manual",
                  "Manual"
                ),
              },
              {
                value: "auto",
                label: subtitleText(
                  ["source", "options", "subtitleMode", "auto"],
                  "Otomatik",
                  "Automatic"
                ),
              },
              {
                value: "both",
                label: subtitleText(
                  ["source", "options", "subtitleMode", "both"],
                  "Ikisi de",
                  "Both"
                ),
              },
            ]
          )}
          ${renderTextField(
            "subtitlesLang",
            drafts.subtitlesLang || "all",
            subtitleText(["source", "fields", "languageFilter"], "Dil filtresi", "Language filter"),
            subtitleText(
              ["source", "placeholders", "languageFilter"],
              "tr,en ya da all",
              "tr,en or all"
            )
          )}
          ${renderTextField(
            "publishedAfter",
            drafts.publishedAfter || "",
            subtitleText(
              ["source", "fields", "publishedAfter"],
              "Yayin tarihi baslangic",
              "Published after"
            ),
            "",
            { type: "date" }
          )}
          ${renderTextField(
            "publishedBefore",
            drafts.publishedBefore || "",
            subtitleText(
              ["source", "fields", "publishedBefore"],
              "Yayin tarihi bitis",
              "Published before"
            ),
            "",
            { type: "date" }
          )}
          ${renderTextField(
            "weekdays",
            drafts.weekdays || "",
            subtitleText(["source", "fields", "weekdays"], "Haftanin gunleri", "Weekdays"),
            subtitleText(["source", "placeholders", "weekdays"], "mon wed fri", "mon wed fri")
          )}
          ${renderTextField(
            "durationMinSeconds",
            drafts.durationMinSeconds == null ? "" : String(drafts.durationMinSeconds),
            subtitleText(["source", "fields", "durationMin"], "Min sure sn", "Min duration sec"),
            "0",
            { type: "number" }
          )}
          ${renderTextField(
            "durationMaxSeconds",
            drafts.durationMaxSeconds == null ? "" : String(drafts.durationMaxSeconds),
            subtitleText(["source", "fields", "durationMax"], "Max sure sn", "Max duration sec"),
            "0",
            { type: "number" }
          )}
          ${primitives.renderSubtitleDraftSelect(
            "shortsMode",
            drafts.shortsMode || "all",
            subtitleText(["source", "fields", "shorts"], "Shorts", "Shorts"),
            [
              {
                value: "all",
                label: subtitleText(["source", "options", "shorts", "all"], "Tum", "All"),
              },
              {
                value: "only",
                label: subtitleText(
                  ["source", "options", "shorts", "only"],
                  "Sadece shorts",
                  "Only shorts"
                ),
              },
              {
                value: "exclude",
                label: subtitleText(
                  ["source", "options", "shorts", "exclude"],
                  "Shorts haric",
                  "Exclude shorts"
                ),
              },
            ]
          )}
          ${primitives.renderSubtitleDraftSelect(
            "liveMode",
            drafts.liveMode || "all",
            subtitleText(["source", "fields", "liveStatus"], "Canli durumu", "Live status"),
            [
              {
                value: "all",
                label: subtitleText(
                  ["source", "options", "liveStatus", "all"],
                  "Tum yuklemeler",
                  "All uploads"
                ),
              },
              {
                value: "exclude-live",
                label: subtitleText(
                  ["source", "options", "liveStatus", "excludeLive"],
                  "Canli haric",
                  "Exclude live"
                ),
              },
              {
                value: "only-live",
                label: subtitleText(
                  ["source", "options", "liveStatus", "onlyLive"],
                  "Sadece canli",
                  "Only live"
                ),
              },
            ]
          )}
          ${renderTextField(
            "titleInclude",
            drafts.titleInclude || "",
            subtitleText(["source", "fields", "titleInclude"], "Baslik dahil", "Title include"),
            subtitleText(
              ["source", "placeholders", "titleInclude"],
              "roportaj, ozet",
              "interview, summary"
            )
          )}
          ${renderTextField(
            "titleExclude",
            drafts.titleExclude || "",
            subtitleText(["source", "fields", "titleExclude"], "Baslik haric", "Title exclude"),
            subtitleText(
              ["source", "placeholders", "titleExclude"],
              "teaser, shorts",
              "teaser, shorts"
            )
          )}
          ${renderTextField(
            "playlistItems",
            drafts.playlistItems || "",
            subtitleText(
              ["source", "fields", "playlistItems"],
              "Playlist araligi",
              "Playlist items"
            ),
            subtitleText(
              ["source", "placeholders", "playlistItems"],
              "1-10 gibi",
              "for example 1-10"
            )
          )}
          ${renderTextField(
            "limitCount",
            drafts.limitCount == null ? "" : String(drafts.limitCount),
            subtitleText(["source", "fields", "limitCount"], "Max video", "Max videos"),
            "0",
            { type: "number" }
          )}
        </div>
        <button
          class="lab-button lab-button--ghost"
          type="button"
          data-action="subtitle-source-discover-youtube"
          ${ytDlpInstalled !== true ? "disabled" : ""}
        >
          ${escapeHtml(subtitleText(["source", "actions", "discoverYoutube"], "Adaylari kesfet", "Discover candidates"))}
        </button>
        <button
          class="lab-button lab-button--primary"
          type="button"
          data-action="subtitle-source-download-youtube"
          ${ytDlpInstalled !== true || discoveryItems.length === 0 || selectedCandidateCount === 0 ? "disabled" : ""}
        >
          ${escapeHtml(subtitleText(["source", "actions", "downloadSelected"], "Secili altyazilari indir", "Download selected subtitles"))}
        </button>
        ${
          discoveryItems.length > 0
            ? `<p class="lab-panel__hint">${escapeHtml(
                subtitleTemplate(
                  ["source", "discovery", "selectionHint"],
                  { count: selectedCandidateCount },
                  `${selectedCandidateCount} secili aday indirilmeye hazir.`,
                  `${selectedCandidateCount} selected candidate(s) are ready for download.`
                )
              )}</p>`
            : ""
        }
      `;

    return `
      <section class="lab-panel">
        <div class="lab-panel__header">
          <div>
            <p class="lab-panel__eyebrow">${escapeHtml(featureText(["source", "modeLabel"]))}</p>
            <h2 class="lab-panel__title">${escapeHtml(featureText(["source", "intakeTitle"]))}</h2>
          </div>
        </div>
        <div class="lab-segmented lab-segmented--subtitle-source">
          ${primitives
            .getSubtitleSourceModeOptions()
            .map(function (modeId: any) {
              const disabled = modeId.indexOf("youtube-") === 0 && ytDlpInstalled !== true;
              return `
                <button
                  class="lab-segmented__button"
                  type="button"
                  data-action="subtitle-source-mode"
                  data-value="${escapeHtml(modeId)}"
                  data-selected="${modeId === currentMode ? "true" : "false"}"
                  ${disabled ? "disabled" : ""}
                >
                  ${escapeHtml(primitives.getSubtitleSourceModeLabel(modeId))}
                </button>
              `;
            })
            .join("")}
        </div>
        <div class="lab-form-stack">${body}</div>
      </section>
    `;
  }

  return {
    renderSubtitleSourceIntakePanel,
  };
}
