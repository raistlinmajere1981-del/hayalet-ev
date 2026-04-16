import {
  escapeHtml,
  formatBytes,
  formatDurationSeconds,
} from "../../models/lab-types.js";
import type { LabStageSurface, LabStoreState } from "../../models/lab-types.js";
import {
  getCurrentFeatureMeta,
  getProjects,
  getSourceKind,
  getSourceMetadata,
  getSourceMode,
  getSourceProbeStatus,
  getSourceStatus,
  getWorkbench,
} from "../../runtime/lab-selectors.js";
import { renderCompactCard } from "../components/compact-card.js";
import { renderPrimaryCTA } from "../components/primary-cta.js";
import { renderStageHeader } from "../components/stage-header.js";
import { renderStatusChip } from "../components/status-chip.js";

type SourceStageRenderDeps = {
  primaryDetail?: string | null;
  primaryDisabled?: boolean;
  primaryLabel: string;
  state: LabStoreState;
};

function renderProjectOptions(projects: ReturnType<typeof getProjects>, activeProjectId: string | null) {
  return projects
    .map(function (project) {
      const id = typeof project["id"] === "string" ? project["id"] : "";
      const name = typeof project["name"] === "string" ? project["name"] : "Adsız Proje";
      return `<option value="${escapeHtml(id)}" ${id === activeProjectId ? "selected" : ""}>${escapeHtml(name)}</option>`;
    })
    .join("");
}

export function renderSourceStage(deps: SourceStageRenderDeps): LabStageSurface {
  const feature = getCurrentFeatureMeta(deps.state);
  const projects = getProjects(deps.state);
  const activeProjectId = deps.state.projectIndex.activeProjectId;
  const sourceProbeStatus = getSourceProbeStatus(deps.state);
  const sourceStatus = getSourceStatus(deps.state);
  const sourceMode = getSourceMode(deps.state);
  const sourceKind = getSourceKind(deps.state);
  const metadata = getSourceMetadata(deps.state);
  const workbench = getWorkbench(deps.state);
  const selectedModuleIds = Array.isArray(workbench["selectedModuleIds"])
    ? (workbench["selectedModuleIds"] as unknown[]).filter((entry): entry is string => typeof entry === "string")
    : [feature.id];
  const activeModuleId = typeof workbench["activeModuleId"] === "string" ? workbench["activeModuleId"] : feature.id;
  const sourceDrafts = deps.state.ui.sourceDrafts;
  const statusTone =
    sourceProbeStatus === "completed"
      ? "success"
      : sourceProbeStatus === "failed"
        ? "error"
        : sourceProbeStatus === "running"
          ? "running"
          : "neutral";

  const main = `
    ${renderStageHeader({
      eyebrow: "Stage 01 · Intake",
      stageIndex: 1,
      stageTotal: 5,
      statusLabel: sourceProbeStatus,
      statusTone,
      subtitle: "Kaynak, erişim modu ve modül kapsamı aynı ekranda kilitlenir. Boş alan bırakma, sonraki aşamayı güvenle besle.",
      title: "Kaynak",
    })}
    <div class="labx-grid labx-grid--source">
      ${renderCompactCard({
        eyebrow: "Project",
        title: "Kaynak Seç",
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
                    return `<option value="${entry}" ${entry === sourceKind ? "selected" : ""}>${escapeHtml(entry)}</option>`;
                  })
                  .join("")}
              </select>
            </label>
            <label class="labx-field">
              <span>Erişim Modu</span>
              <select class="labx-select" data-lab-field="source.mode">
                ${["local", "url", "youtube"]
                  .map(function (entry) {
                    const label = entry === "local" ? "local" : entry;
                    return `<option value="${entry}" ${entry === sourceMode ? "selected" : ""}>${escapeHtml(label)}</option>`;
                  })
                  .join("")}
              </select>
            </label>
          </div>
          <label class="labx-field">
            <span>Kaynak Alias</span>
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
                : `<p class="labx-panel-hint">Yerel alım modu seçili. Birincil aksiyon dosya seçiciyi açar.</p>`
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
        eyebrow: "Scope",
        title: "Modül Kapsamı",
        body: `
          <div class="labx-stat-grid">
            <article>
              <span>Aktif</span>
              <strong>${escapeHtml(activeModuleId)}</strong>
            </article>
            <article>
              <span>Seçili</span>
              <strong>${escapeHtml(String(selectedModuleIds.length))}</strong>
            </article>
            <article>
              <span>Feature</span>
              <strong>${escapeHtml(feature.shortLabel)}</strong>
            </article>
          </div>
          <div class="labx-chip-row">
            ${selectedModuleIds
              .map(function (entry) {
                return `
                  <button
                    class="labx-chip-button"
                    type="button"
                    data-lab-action="feature-toggle"
                    data-lab-value="${escapeHtml(entry)}"
                    data-selected="${entry === activeModuleId ? "true" : "false"}"
                  >
                    ${escapeHtml(entry)}
                  </button>
                `;
              })
              .join("")}
          </div>
          <p class="labx-panel-hint">Sol rail ve process sırası aynı workbench seçiminden beslenir.</p>
        `,
      })}
    </div>
  `;

  const side = [
    renderCompactCard({
      eyebrow: "Source State",
      title: feature.label,
      body: `
        <div class="labx-summary-list">
          <div><span>Probe</span>${renderStatusChip(sourceProbeStatus, statusTone)}</div>
          <div><span>Kaynak</span><strong>${escapeHtml(sourceStatus)}</strong></div>
          <div><span>Tür</span><strong>${escapeHtml(sourceKind)}</strong></div>
          <div><span>Mod</span><strong>${escapeHtml(sourceMode)}</strong></div>
          <div><span>Çerçeve</span><strong>${escapeHtml(
            typeof metadata["width"] === "number" && typeof metadata["height"] === "number"
              ? `${String(metadata["width"])} × ${String(metadata["height"])}`
              : "--"
          )}</strong></div>
          <div><span>Süre</span><strong>${escapeHtml(formatDurationSeconds(metadata["durationSeconds"]))}</strong></div>
          <div><span>Boyut</span><strong>${escapeHtml(formatBytes(metadata["sizeBytes"]))}</strong></div>
        </div>
      `,
    }),
    renderCompactCard({
      eyebrow: "Guidance",
      title: "Blocking Rule",
      body: `
        <p class="labx-panel-hint">Bir sonraki aşama ancak probe tamamlandığında açılır. Sağ panel yalnız host kaynak metadata’sını gösterir.</p>
      `,
    }),
  ].join("");

  return { main, side };
}
