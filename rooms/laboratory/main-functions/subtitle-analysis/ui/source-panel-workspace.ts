import { createSubtitleAnalysisSourcePanelPrimitives } from "./source-panel-primitives.js";

export function createSubtitleAnalysisSourceWorkspacePanels(deps) {
  const escapeHtml = deps.escapeHtml;
  const subtitleText = deps.subtitleText;
  const formatStatusLabel = deps.formatStatusLabel;
  const formatDuration = deps.formatDuration;
  const renderSummaryRows = deps.renderSummaryRows;
  const getSubtitleWorkspace = deps.getSubtitleWorkspace;
  const getActiveSubtitleEntry = deps.getActiveSubtitleEntry;
  const getSubtitleSelectedEntryIds = deps.getSubtitleSelectedEntryIds;
  const getSubtitleDiscoveryState = deps.getSubtitleDiscoveryState;
  const getSubtitleDiscoveryItems = deps.getSubtitleDiscoveryItems;
  const getSubtitleSelectedCandidateIds = deps.getSubtitleSelectedCandidateIds;
  const getSubtitleEntries = deps.getSubtitleEntries;
  const primitives = createSubtitleAnalysisSourcePanelPrimitives(deps);

  function renderSubtitleSourceWorkspacePanel() {
    const workspace = getSubtitleWorkspace();
    const discovery = getSubtitleDiscoveryState();
    const activeEntry = getActiveSubtitleEntry();
    const selectedCount = getSubtitleSelectedEntryIds().length;
    const candidateCount = getSubtitleDiscoveryItems().length;
    return `
      <section class="lab-panel lab-preview-panel">
        <div class="lab-panel__header">
          <div>
            <p class="lab-panel__eyebrow">${escapeHtml(subtitleText(["source", "summary", "eyebrow"], "Kaynak Ozet", "Source Summary"))}</p>
            <h2 class="lab-panel__title">${escapeHtml(
              activeEntry
                ? activeEntry.fileName || activeEntry.id || "--"
                : subtitleText(["source", "summary", "emptyTitle"], "Altyazi secilmedi", "No subtitle selected")
            )}</h2>
            <p class="lab-panel__subtitle">${escapeHtml(
              activeEntry
                ? subtitleText(
                    ["source", "summary", "activeSubtitle"],
                    "Aktif altyazi girisi ve secili batch durumu.",
                    "Active subtitle entry and current batch selection."
                  )
                : subtitleText(
                    ["source", "summary", "prepareHint"],
                    "Source asamasindan bir altyazi girisi hazirla.",
                    "Prepare a subtitle entry from the source stage."
                  )
            )}</p>
          </div>
        </div>
        ${renderSummaryRows([
          [subtitleText(["source", "summary", "labels", "workspaceMode"], "Calisma modu", "Workspace mode"), primitives.getSubtitleSourceModeLabel(primitives.getCurrentSubtitleSourceMode())],
          [subtitleText(["source", "summary", "labels", "selectedEntries"], "Secili giris", "Selected entries"), String(selectedCount || (activeEntry ? 1 : 0))],
          [subtitleText(["source", "summary", "labels", "discoveryCandidates"], "Kesif adayi", "Discovery candidates"), String(candidateCount)],
          [subtitleText(["source", "summary", "labels", "format"], "Format", "Format"), activeEntry ? String(activeEntry.format || "--").toUpperCase() : "--"],
          [subtitleText(["source", "summary", "labels", "language"], "Dil", "Language"), activeEntry ? activeEntry.language || "--" : "--"],
          [subtitleText(["source", "summary", "labels", "published"], "Yayin", "Published"), activeEntry ? activeEntry.publishedAt || "--" : "--"],
          [subtitleText(["source", "summary", "labels", "discovery"], "Kesif", "Discovery"), formatStatusLabel(discovery.status || "idle")],
          [subtitleText(["source", "summary", "labels", "status"], "Durum", "Status"), formatStatusLabel(workspace.lastError ? "error" : "ready")],
        ])}
        ${
          typeof workspace.lastError === "string" && workspace.lastError.trim() !== ""
            ? `<div class="lab-notice">${escapeHtml(workspace.lastError)}</div>`
            : ""
        }
      </section>
    `;
  }

  function renderSubtitleEntryPanel() {
    const entries = getSubtitleEntries();
    const activeEntry = getActiveSubtitleEntry();
    const selectedIds = getSubtitleSelectedEntryIds();

    return `
      <section class="lab-panel">
        <div class="lab-panel__header">
          <div>
            <p class="lab-panel__eyebrow">${escapeHtml(subtitleText(["source", "entries", "eyebrow"], "Girisler", "Entries"))}</p>
            <h2 class="lab-panel__title">${escapeHtml(subtitleText(["source", "entries", "title"], "Altyazi Listesi", "Subtitle List"))}</h2>
          </div>
        </div>
        <div class="lab-output-list">
          ${
            entries.length > 0
              ? entries
                  .map(function (entry) {
                    return `
                      <article class="lab-output-card" data-selected="${
                        activeEntry && activeEntry.id === entry.id ? "true" : "false"
                      }">
                        <div>
                          <strong>${escapeHtml(entry.fileName || entry.id || "--")}</strong>
                          <span>${escapeHtml(
                            [String(entry.format || "--").toUpperCase(), entry.language || "--", entry.sourceType || "--"]
                              .filter(Boolean)
                              .join(" · ")
                          )}</span>
                        </div>
                        <div class="lab-action-stack">
                          <button
                            class="lab-button lab-button--ghost lab-button--tight"
                            type="button"
                            data-action="subtitle-source-select-entry"
                            data-value="${escapeHtml(entry.id || "")}"
                          >
                            ${escapeHtml(subtitleText(["source", "entries", "actions", "makeActive"], "Aktif yap", "Make active"))}
                          </button>
                          <button
                            class="lab-button lab-button--ghost lab-button--tight"
                            type="button"
                            data-action="subtitle-source-toggle-selection"
                            data-value="${escapeHtml(entry.id || "")}"
                          >
                            ${escapeHtml(
                              selectedIds.includes(entry.id)
                                ? subtitleText(["source", "entries", "actions", "removeFromBatch"], "Batchten cikar", "Remove from batch")
                                : subtitleText(["source", "entries", "actions", "addToBatch"], "Batche ekle", "Add to batch")
                            )}
                          </button>
                        </div>
                      </article>
                    `;
                  })
                  .join("")
              : `<p class="lab-panel__hint">${escapeHtml(subtitleText(["source", "entries", "empty"], "Henuz altyazi girisi yok.", "No subtitle entries yet."))}</p>`
          }
        </div>
      </section>
    `;
  }

  function renderSubtitleDiscoveryPanel() {
    const discovery = getSubtitleDiscoveryState();
    const items = getSubtitleDiscoveryItems();
    const selectedCandidateIds = getSubtitleSelectedCandidateIds();

    return `
      <section class="lab-panel">
        <div class="lab-panel__header">
          <div>
            <p class="lab-panel__eyebrow">${escapeHtml(subtitleText(["source", "discovery", "eyebrow"], "YouTube Kesfi", "YouTube Discovery"))}</p>
            <h2 class="lab-panel__title">${escapeHtml(subtitleText(["source", "discovery", "title"], "Aday Tablosu", "Candidate Table"))}</h2>
            <p class="lab-panel__subtitle">${escapeHtml(
              subtitleText(
                ["source", "discovery", "subtitle"],
                "Filtreye uyan videolari once inceleyip sonra secili altyazilari indirebilirsin.",
                "Inspect matching videos first, then download subtitles only for the selected rows."
              )
            )}</p>
          </div>
        </div>
        ${renderSummaryRows([
          [subtitleText(["source", "discovery", "labels", "status"], "Durum", "Status"), formatStatusLabel(discovery.status || "idle")],
          [subtitleText(["source", "discovery", "labels", "totalCandidates"], "Toplam aday", "Total candidates"), String(discovery.totalCandidateCount || items.length)],
          [subtitleText(["source", "discovery", "labels", "matched"], "Eslesen", "Matched"), String(items.length)],
          [subtitleText(["source", "discovery", "labels", "selected"], "Secili", "Selected"), String(selectedCandidateIds.length)],
        ])}
        ${
          typeof discovery.lastError === "string" && discovery.lastError.trim() !== ""
            ? `<div class="lab-notice">${escapeHtml(discovery.lastError)}</div>`
            : ""
        }
        ${
          items.length > 0
            ? `
              <div class="lab-action-stack lab-action-stack--inline">
                <button class="lab-button lab-button--ghost" type="button" data-action="subtitle-source-select-all-discovery">
                  ${escapeHtml(subtitleText(["source", "discovery", "actions", "selectAll"], "Tumunu sec", "Select all"))}
                </button>
                <button class="lab-button lab-button--ghost" type="button" data-action="subtitle-source-clear-discovery-selection">
                  ${escapeHtml(subtitleText(["source", "discovery", "actions", "clearSelection"], "Secimi temizle", "Clear selection"))}
                </button>
              </div>
              <div class="lab-discovery-table-wrap">
                <table class="lab-discovery-table">
                  <thead>
                    <tr>
                      <th>${escapeHtml(subtitleText(["source", "discovery", "headers", "select"], "Sec", "Select"))}</th>
                      <th>${escapeHtml(subtitleText(["source", "discovery", "headers", "title"], "Baslik", "Title"))}</th>
                      <th>${escapeHtml(subtitleText(["source", "discovery", "headers", "published"], "Yayin", "Published"))}</th>
                      <th>${escapeHtml(subtitleText(["source", "discovery", "headers", "duration"], "Sure", "Duration"))}</th>
                      <th>${escapeHtml(subtitleText(["source", "discovery", "headers", "languages"], "Dil", "Languages"))}</th>
                      <th>${escapeHtml(subtitleText(["source", "discovery", "headers", "live"], "Canli", "Live"))}</th>
                    </tr>
                  </thead>
                  <tbody>
                    ${items
                      .map(function (entry) {
                        const languageList = Array.isArray(entry.subtitleLanguages) ? entry.subtitleLanguages.slice(0, 4) : [];
                        return `
                          <tr data-selected="${selectedCandidateIds.includes(entry.id) ? "true" : "false"}">
                            <td>
                              <button
                                class="lab-button lab-button--ghost lab-button--tight"
                                type="button"
                                data-action="subtitle-source-toggle-discovery"
                                data-value="${escapeHtml(entry.id || "")}"
                              >
                                ${escapeHtml(
                                  selectedCandidateIds.includes(entry.id)
                                    ? subtitleText(["source", "discovery", "actions", "remove"], "Cikar", "Remove")
                                    : subtitleText(["source", "discovery", "actions", "select"], "Sec", "Select")
                                )}
                              </button>
                            </td>
                            <td>
                              <div class="lab-discovery-table__title">${escapeHtml(entry.title || "--")}</div>
                              <div class="lab-discovery-table__meta">${escapeHtml(entry.channelTitle || entry.videoId || "--")}</div>
                            </td>
                            <td>${escapeHtml(entry.publishedAt || "--")}</td>
                            <td>${escapeHtml(formatDuration(entry.durationSeconds))}</td>
                            <td>${escapeHtml(languageList.length > 0 ? languageList.join(", ") : "--")}</td>
                            <td>${escapeHtml(formatStatusLabel(entry.liveStatus || "offline"))}</td>
                          </tr>
                        `;
                      })
                      .join("")}
                  </tbody>
                </table>
              </div>
            `
            : `<p class="lab-panel__hint">${escapeHtml(
                subtitleText(
                  ["source", "discovery", "empty"],
                  "YouTube modunda aday tablosunu doldurmak icin kesif calistir.",
                  "Run discovery in a YouTube mode to populate the candidate table."
                )
              )}</p>`
        }
      </section>
    `;
  }

  return {
    renderSubtitleSourceWorkspacePanel,
    renderSubtitleEntryPanel,
    renderSubtitleDiscoveryPanel,
  };
}
