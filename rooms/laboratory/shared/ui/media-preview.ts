export function createLaboratoryMediaPreviewUi(deps: any) {
  const state = deps.state;
  const render = deps.render;
  const escapeHtml = deps.escapeHtml;
  const text = deps.text;
  const formatDuration = deps.formatDuration;
  const getActiveProject = deps.getActiveProject;
  const getProjectSource = deps.getProjectSource;
  const getCurrentSourceMode = deps.getCurrentSourceMode;
  const getRelevantJobs = deps.getRelevantJobs;
  const getCurrentSourceKind = deps.getCurrentSourceKind;
  const getProjectStatusLabel = deps.getProjectStatusLabel;
  const getCurrentSourceLabel = deps.getCurrentSourceLabel;
  const getPreferredSourceDuration = deps.getPreferredSourceDuration;
  const getPreferredSourceResolution = deps.getPreferredSourceResolution;
  const getPreferredSourceCodec = deps.getPreferredSourceCodec;
  const getPreferredSourceFormat = deps.getPreferredSourceFormat;
  const formatBitRate = deps.formatBitRate;
  const getSourceMetadata = deps.getSourceMetadata;

  function renderPreviewMetaRow(label: any, value: any) {
    return `
      <li>
        <span>${escapeHtml(label)}</span>
        <strong>${escapeHtml(value || "--")}</strong>
      </li>
    `;
  }

  function renderPreviewSurface() {
    const project = getActiveProject();
    const source = getProjectSource();
    const previewUrl =
      typeof source.previewUrl === "string" && source.previewUrl.trim() !== ""
        ? source.previewUrl
        : null;
    const fileName =
      typeof source.storedFileName === "string" && source.storedFileName.trim() !== ""
        ? source.storedFileName
        : "--";
    const sourceMode = getCurrentSourceMode();
    const routeLabel =
      typeof source.routeLabel === "string" && source.routeLabel.trim() !== ""
        ? source.routeLabel
        : text(["mediaAnalysis", "source", "modes", sourceMode]);

    const projectJobs = getRelevantJobs().project;
    const activeJob =
      projectJobs.find(function (entry: any) {
        return entry.featureStage !== "edit";
      }) || null;

    let mediaMarkup = `
      <div class="lab-empty-preview">
        <strong>${escapeHtml(text(["mediaAnalysis", "source", "previewEmptyTitle"]))}</strong>
        <p>${escapeHtml(text(["mediaAnalysis", "source", "previewEmptyBody"]))}</p>
      </div>
    `;

    if (previewUrl !== null) {
      if (getCurrentSourceKind() === "image") {
        mediaMarkup = `<img class="lab-preview-media lab-preview-media--image" data-preview-media="image" src="${previewUrl}" alt="" />`;
      } else if (getCurrentSourceKind() === "audio") {
        mediaMarkup = `<audio class="lab-preview-media lab-preview-media--audio" data-preview-media="audio" src="${previewUrl}" controls preload="metadata"></audio>`;
      } else {
        mediaMarkup = `<video class="lab-preview-media lab-preview-media--video" data-preview-media="video" src="${previewUrl}" controls preload="metadata"></video>`;
      }
    }

    const infoRows = [
      renderPreviewMetaRow(text(["mediaAnalysis", "source", "previewInfo", "route"]), routeLabel),
      renderPreviewMetaRow(text(["mediaAnalysis", "source", "previewInfo", "file"]), fileName),
      renderPreviewMetaRow(
        text(["mediaAnalysis", "source", "previewInfo", "status"]),
        getProjectStatusLabel(source)
      ),
      renderPreviewMetaRow(
        text(["mediaAnalysis", "source", "previewInfo", "source"]),
        typeof source.sourceUrl === "string" && source.sourceUrl.trim() !== ""
          ? source.sourceUrl
          : "--"
      ),
      renderPreviewMetaRow(
        text(["mediaAnalysis", "shared", "duration"]),
        formatDuration(getPreferredSourceDuration(previewUrl))
      ),
      renderPreviewMetaRow(
        text(["mediaAnalysis", "shared", "resolution"]),
        getPreferredSourceResolution(previewUrl)
      ),
      renderPreviewMetaRow(text(["mediaAnalysis", "shared", "codec"]), getPreferredSourceCodec()),
      renderPreviewMetaRow(text(["mediaAnalysis", "shared", "format"]), getPreferredSourceFormat()),
      renderPreviewMetaRow(
        text(["mediaAnalysis", "shared", "bitrate"]),
        formatBitRate(getSourceMetadata().bitRate)
      ),
    ];

    return `
      <section class="lab-panel lab-preview-panel">
        <div class="lab-preview-panel__header">
          <div>
            <p class="lab-panel__subtitle">${escapeHtml(project ? project.name : "--")}</p>
            <h2 class="lab-panel__title">${escapeHtml(getCurrentSourceLabel())}</h2>
          </div>
          <span class="lab-chip">${escapeHtml(getProjectStatusLabel(source))}</span>
        </div>
        <div class="lab-preview-card">
          <div class="lab-preview-frame">
            ${mediaMarkup}
          </div>
          <div class="lab-preview-copy">
            <ul class="lab-meta-list">${infoRows.join("")}</ul>
            ${
              activeJob
                ? `
                  <div class="lab-status-card">
                    <div class="lab-status-card__head">
                      <strong>${escapeHtml(text(["mediaAnalysis", "source", "jobs", "title"]))}</strong>
                      <span>${escapeHtml(
                        typeof activeJob.percent === "number"
                          ? `${Math.round(activeJob.percent)}%`
                          : activeJob.stage || "--"
                      )}</span>
                    </div>
                    <div class="lab-progress-bar">
                      <span style="width:${Math.max(4, Number(activeJob.percent) || 6)}%"></span>
                    </div>
                    <p class="lab-status-card__body">${escapeHtml(activeJob.message || activeJob.stage || "")}</p>
                  </div>
                `
                : ""
            }
          </div>
        </div>
      </section>
    `;
  }

  function bindPreviewMetrics() {
    const media = document.querySelector("[data-preview-media]");
    if (
      !(
        media instanceof HTMLVideoElement ||
        media instanceof HTMLAudioElement ||
        media instanceof HTMLImageElement
      )
    ) {
      state.ui.previewMetrics = {
        url: null,
        duration: null,
        width: null,
        height: null,
      };
      return;
    }

    const nextUrl =
      media instanceof HTMLImageElement
        ? media.currentSrc || media.src
        : media.currentSrc || media.src;

    if (state.ui.previewMetrics.url === nextUrl) {
      return;
    }

    state.ui.previewMetrics = {
      url: nextUrl,
      duration: null,
      width: null,
      height: null,
    };

    if (media instanceof HTMLImageElement) {
      const applyImageMetrics = function () {
        state.ui.previewMetrics.duration = null;
        state.ui.previewMetrics.width = media.naturalWidth || null;
        state.ui.previewMetrics.height = media.naturalHeight || null;
        render();
      };

      if (media.complete) {
        applyImageMetrics();
      } else {
        media.addEventListener("load", applyImageMetrics, { once: true });
      }
      return;
    }

    const applyMediaMetrics = function () {
      state.ui.previewMetrics.duration =
        typeof media.duration === "number" && Number.isFinite(media.duration)
          ? media.duration
          : null;
      state.ui.previewMetrics.width =
        media instanceof HTMLVideoElement && media.videoWidth > 0 ? media.videoWidth : null;
      state.ui.previewMetrics.height =
        media instanceof HTMLVideoElement && media.videoHeight > 0 ? media.videoHeight : null;
      render();
    };

    if (media.readyState >= 1) {
      applyMediaMetrics();
    } else {
      media.addEventListener("loadedmetadata", applyMediaMetrics, { once: true });
    }
  }

  async function decodeAudioBars(url: any) {
    const AudioContextCtor = window.AudioContext || window.webkitAudioContext;
    if (typeof window.fetch !== "function" || typeof AudioContextCtor !== "function") {
      return [];
    }

    const response = await window.fetch(url);
    const arrayBuffer = await response.arrayBuffer();
    const audioContext = new AudioContextCtor();

    try {
      const audioBuffer = await audioContext.decodeAudioData(arrayBuffer.slice(0));
      const samples = audioBuffer.getChannelData(0);
      const bucketCount = 42;
      const bucketSize = Math.max(1, Math.floor(samples.length / bucketCount));
      const bars = [];

      for (let index = 0; index < bucketCount; index += 1) {
        const start = index * bucketSize;
        const end = Math.min(samples.length, start + bucketSize);
        let sum = 0;
        for (let cursor = start; cursor < end; cursor += 1) {
          sum += Math.abs(samples[cursor] || 0);
        }
        const average = end > start ? sum / (end - start) : 0;
        bars.push(Math.max(10, Math.min(84, Math.round(average * 240))));
      }

      return bars;
    } finally {
      await audioContext.close();
    }
  }

  function bindAudioAnalysis() {
    const media = document.querySelector('[data-preview-media="audio"]');
    if (!(media instanceof HTMLAudioElement)) {
      state.ui.audioAnalysis = {
        url: null,
        bars: [],
      };
      return;
    }

    const nextUrl = media.currentSrc || media.src;
    if (typeof nextUrl !== "string" || nextUrl.trim() === "") {
      return;
    }

    if (state.ui.audioAnalysis.url === nextUrl && state.ui.audioAnalysis.bars.length > 0) {
      return;
    }

    state.ui.audioAnalysis = {
      url: nextUrl,
      bars: [],
    };

    void decodeAudioBars(nextUrl)
      .then(function (bars: any) {
        if (state.ui.audioAnalysis.url !== nextUrl) {
          return;
        }
        state.ui.audioAnalysis = {
          url: nextUrl,
          bars: Array.isArray(bars) ? bars : [],
        };
        render();
      })
      .catch(function () {
        if (state.ui.audioAnalysis.url !== nextUrl) {
          return;
        }
        state.ui.audioAnalysis = {
          url: nextUrl,
          bars: [],
        };
        render();
      });
  }

  return {
    bindAudioAnalysis,
    bindPreviewMetrics,
    decodeAudioBars,
    renderPreviewMetaRow,
    renderPreviewSurface,
  };
}
