import {
  escapeHtml,
  formatBytes,
  formatDurationSeconds,
  formatStatusLabel,
} from "../../models/lab-types.js";
import type { LabStageSurface, LabStoreState } from "../../models/lab-types.js";
import {
  getAvailableCapabilities,
  getCapabilityWorkflowSummary,
  getProjectSource,
  getProjects,
  getSourceKind,
  getSourceMetadata,
  getSourceMode,
  getSourceProbeStatus,
  getSourceStatus,
  getToolState,
} from "../../runtime/lab-selectors.js";
import { renderCompactCard } from "../components/compact-card.js";
import { renderPrimaryCTA } from "../components/primary-cta.js";
import { renderStageHeader } from "../components/stage-header.js";
import { renderStatusChip } from "../components/status-chip.js";
import { asLabRecord, asNonEmptyString } from "../../models/lab-types.js";

type SourceStageRenderDeps = {
  primaryDetail?: string | null;
  primaryDisabled?: boolean;
  primaryLabel: string;
  state: LabStoreState;
};

function renderProjectOptions(
  projects: ReturnType<typeof getProjects>,
  activeProjectId: string | null
) {
  return projects
    .map(function (project) {
      const id = typeof project["id"] === "string" ? project["id"] : "";
      const name = typeof project["name"] === "string" ? project["name"] : "Adsız Proje";
      return `<option value="${escapeHtml(id)}" ${id === activeProjectId ? "selected" : ""}>${escapeHtml(name)}</option>`;
    })
    .join("");
}

function getSourceKindLabel(kind: string) {
  switch (kind) {
    case "audio":
      return "Ses";
    case "image":
      return "Görsel";
    case "video":
      return "Video";
    default:
      return kind;
  }
}

function getSourceModeLabel(mode: string) {
  switch (mode) {
    case "local":
      return "Yerel dosya";
    case "url":
      return "URL indir";
    case "youtube":
      return "YouTube";
    default:
      return mode;
  }
}

function renderPreviewMedia(sourceKind: string, previewUrl: string | null) {
  if (previewUrl === null) {
    return `
      <div class="labx-empty-state">
        <strong class="labx-empty-state__title">Önizleme hazır değil</strong>
        <p class="labx-empty-state__description">Kaynağı hazırladığında medya önizlemesi bu alanda görünür.</p>
      </div>
    `;
  }

  if (sourceKind === "image") {
    return `<img class="labx-preview-media labx-preview-media--image" src="${escapeHtml(previewUrl)}" alt="Kaynak önizleme" />`;
  }
  if (sourceKind === "audio") {
    return `<audio class="labx-preview-media labx-preview-media--audio" src="${escapeHtml(previewUrl)}" controls preload="metadata"></audio>`;
  }
  return `<video class="labx-preview-media labx-preview-media--video" src="${escapeHtml(previewUrl)}" controls preload="metadata" playsinline></video>`;
}

function renderPreviewRow(label: string, value: string) {
  return `
    <div class="labx-preview-row">
      <span>${escapeHtml(label)}</span>
      <strong>${escapeHtml(value)}</strong>
    </div>
  `;
}

function getReadinessTone(readiness: string) {
  switch (readiness) {
    case "ready":
      return "success";
    case "optional":
      return "warning";
    case "blocked":
      return "error";
    default:
      return "neutral";
  }
}

function getReadinessLabel(readiness: string) {
  switch (readiness) {
    case "ready":
      return "Hazır";
    case "optional":
      return "Opsiyonel";
    case "blocked":
      return "Bloklu";
    default:
      return readiness;
  }
}

export function renderSourceStage(deps: SourceStageRenderDeps): LabStageSurface {
  const projects = getProjects(deps.state);
  const activeProjectId = deps.state.projectIndex.activeProjectId;
  const sourceProbeStatus = getSourceProbeStatus(deps.state);
  const sourceStatus = getSourceStatus(deps.state);
  const sourceMode = getSourceMode(deps.state);
  const sourceKind = getSourceKind(deps.state);
  const metadata = getSourceMetadata(deps.state);
  const source = getProjectSource(deps.state);
  const sourceDrafts = deps.state.ui.sourceDrafts;
  const sourceStatusLabel = formatStatusLabel(sourceStatus);
  const sourceProbeLabel = formatStatusLabel(sourceProbeStatus);
  const previewUrl = typeof source["previewUrl"] === "string" ? source["previewUrl"] : null;
  const routeLabel =
    typeof source["routeLabel"] === "string" && source["routeLabel"].trim() !== ""
      ? source["routeLabel"]
      : getSourceModeLabel(sourceMode);
  const storedFileName =
    typeof source["storedFileName"] === "string" && source["storedFileName"].trim() !== ""
      ? source["storedFileName"]
      : sourceDrafts.fileNameHint || "--";
  const statusTone =
    sourceProbeStatus === "completed"
      ? "success"
      : sourceProbeStatus === "failed"
        ? "error"
        : sourceProbeStatus === "running"
          ? "running"
          : "neutral";

  const capabilities = getAvailableCapabilities(deps.state);
  const workflowSummary = getCapabilityWorkflowSummary(deps.state);
  const toolState = getToolState(deps.state);
  const toolRegistry = asLabRecord(toolState["tools"]);

  const main = `
    ${renderStageHeader({
      eyebrow: "Aşama 01 · Kaynak",
      stageIndex: 1,
      stageTotal: 4,
      statusLabel: sourceProbeLabel,
      statusTone,
      subtitle:
        "Kaynak seçimi, kullanılabilir yetenekler ve araç hazırlığı. Önce giriş yapısını netleştir, sonra çalışma alanına geç.",
      title: "Kaynak",
    })}
    <div class="labx-grid labx-grid--source">
      ${renderCompactCard({
        eyebrow: "Proje",
        title: "Kaynak Seçimi",
        body: `
          <label class="labx-field">
            <span>Aktif Proje</span>
            <select class="labx-select" data-lab-field="project.id">
              ${renderProjectOptions(projects, activeProjectId)}
            </select>
          </label>
          <div class="labx-inline-grid">
            <label class="labx-field">
              <span>Kaynak Türü</span>
              <select class="labx-select" data-lab-field="source.kind">
                ${["video", "audio", "image"]
                  .map(function (entry) {
                    return `<option value="${entry}" ${entry === sourceKind ? "selected" : ""}>${escapeHtml(getSourceKindLabel(entry))}</option>`;
                  })
                  .join("")}
              </select>
            </label>
            <label class="labx-field">
              <span>Erişim Modu</span>
              <select class="labx-select" data-lab-field="source.mode">
                ${["local", "url", "youtube"]
                  .map(function (entry) {
                    return `<option value="${entry}" ${entry === sourceMode ? "selected" : ""}>${escapeHtml(getSourceModeLabel(entry))}</option>`;
                  })
                  .join("")}
              </select>
            </label>
          </div>
          <label class="labx-field">
            <span>Kaynak Takma Adı</span>
            <input class="labx-input" data-lab-field="source.fileNameHint" value="${escapeHtml(sourceDrafts.fileNameHint)}" placeholder="project-shot-01" />
          </label>
          ${
            sourceMode === "url"
              ? `
                <label class="labx-field">
                  <span>Kaynak URL</span>
                  <input class="labx-input" data-lab-field="source.urlInput" value="${escapeHtml(sourceDrafts.urlInput)}" placeholder="https://..." />
                </label>
              `
              : sourceMode === "youtube"
                ? `
                  <label class="labx-field">
                    <span>YouTube URL</span>
                    <input class="labx-input" data-lab-field="source.youtubeUrl" value="${escapeHtml(sourceDrafts.youtubeUrl)}" placeholder="https://youtube.com/watch?v=..." />
                  </label>
                `
                : `<p class="labx-panel-hint">Yerel dosya modu seçili. Birincil aksiyon dosya seçiciyi açar.</p>`
          }
        `,
        footer: renderPrimaryCTA({
          action: "primary-action",
          detail: deps.primaryDetail || null,
          disabled: deps.primaryDisabled,
          label: deps.primaryLabel,
        }),
        tone: "accent",
      })}
      ${renderCompactCard({
        eyebrow: "Yetenekler",
        title: "Kullanılabilir Yetenekler",
        body: `
          <p class="labx-panel-hint">Bu kaynak üzerinde çalıştırılabilecek yetenek aileleri. Seçim yaparak iş akışını belirle.</p>
          <div class="labx-capability-grid">
            ${capabilities
              .map(function (cap) {
                return `
                  <article
                    class="labx-capability-card"
                    data-readiness="${cap.readiness}"
                    data-selected="${cap.selected ? "true" : "false"}"
                  >
                    <div class="labx-capability-card__head">
                      <strong>${escapeHtml(cap.label)}</strong>
                      ${renderStatusChip(getReadinessLabel(cap.readiness), getReadinessTone(cap.readiness))}
                    </div>
                    <div class="labx-capability-card__meta">
                      <small>Araç: ${escapeHtml(cap.primaryTool)}</small>
                    </div>
                    ${cap.blockReason ? `<p class="labx-capability-card__reason">${escapeHtml(cap.blockReason)}</p>` : ""}
                    <button
                      class="labx-inline-action"
                      type="button"
                      data-lab-action="capability-toggle"
                      data-lab-value="${escapeHtml(cap.id)}"
                      ${cap.readiness === "blocked" ? "disabled" : ""}
                    >
                      ${cap.selected ? "Seçimden çıkar" : "Seç"}
                    </button>
                  </article>
                `;
              })
              .join("")}
          </div>
        `,
      })}
    </div>
  `;

  const toolEntries = [
    "ffmpeg",
    "yt-dlp",
    "whisper.cpp",
    "opensmile",
    "pyaudioanalysis",
    "yamnet",
    "demucs",
    "librosa",
  ];

  const side = [
    renderCompactCard({
      eyebrow: "Kaynak Özeti",
      title: storedFileName,
      body: `
        <div class="labx-preview-card">
          <div class="labx-preview-frame">
            ${renderPreviewMedia(sourceKind, previewUrl)}
          </div>
          <div class="labx-preview-meta">
            ${renderPreviewRow("Tür", getSourceKindLabel(sourceKind))}
            ${renderPreviewRow("Erişim", routeLabel)}
            ${renderPreviewRow("Durum", sourceStatusLabel)}
            ${
              typeof metadata["width"] === "number" && typeof metadata["height"] === "number"
                ? renderPreviewRow(
                    "Çözünürlük",
                    `${String(metadata["width"])} × ${String(metadata["height"])}`
                  )
                : ""
            }
            ${renderPreviewRow("Süre", formatDurationSeconds(metadata["durationSeconds"]))}
            ${renderPreviewRow("Boyut", formatBytes(metadata["sizeBytes"]))}
          </div>
        </div>
      `,
      tone: "accent",
    }),
    renderCompactCard({
      eyebrow: "Araç Durumu",
      title: "Araç Hazırlığı",
      body: `
        <div class="labx-summary-list">
          ${toolEntries
            .map(function (toolId) {
              const tool = asLabRecord(toolRegistry[toolId]);
              const installed =
                tool["installed"] === true || asNonEmptyString(tool["status"]) === "installed";
              return `
                <div>
                  <span>${escapeHtml(toolId)}</span>
                  ${renderStatusChip(installed ? "Hazır" : "Eksik", installed ? "success" : "error")}
                </div>
              `;
            })
            .join("")}
        </div>
        <button class="labx-inline-action" type="button" data-lab-action="toggle-tool-manager">Araçları Yönet</button>
      `,
    }),
    renderCompactCard({
      eyebrow: "İş Akışı",
      title: "Seçili Yetenek Özeti",
      body: `
        <div class="labx-summary-list">
          <div><span>Seçili aile</span><strong>${escapeHtml(String(workflowSummary.familyCount))}</strong></div>
          <div><span>Hazır</span><strong>${escapeHtml(String(workflowSummary.readyCount))}</strong></div>
          ${workflowSummary.blockedCount > 0 ? `<div><span>Bloklu</span><strong>${escapeHtml(String(workflowSummary.blockedCount))}</strong></div>` : ""}
        </div>
        ${workflowSummary.familyCount === 0 ? `<p class="labx-panel-hint">Henüz yetenek seçilmedi. Sol panelden en az bir yetenek ailesi seç.</p>` : ""}
      `,
    }),
  ].join("");

  return { main, side };
}
