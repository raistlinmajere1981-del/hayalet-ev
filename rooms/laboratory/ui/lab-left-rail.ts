import { escapeHtml, asNonEmptyString } from "../models/lab-types.js";
import type { LabStoreState } from "../models/lab-types.js";
import {
  getProjectSource,
  getWorkspaceMode,
  getSelectedIntents,
  getAvailableIntents,
} from "../runtime/lab-selectors.js";
import { renderStatusChip } from "./components/status-chip.js";

export function renderLabLeftRail(state: LabStoreState) {
  const workspaceMode = getWorkspaceMode(state);
  const source = getProjectSource(state);
  const selectedIntents = getSelectedIntents(state);
  const intents = getAvailableIntents(state);
  const storedFileName =
    asNonEmptyString(source["storedFileName"]) || asNonEmptyString(source["routeLabel"]) || null;
  const hasSource = storedFileName !== null;
  const projectSummaries = state.projectIndex.projects.map(function (project) {
    return project as Record<string, unknown>;
  });
  const activeProjectSummary = projectSummaries.find(function (project) {
    return String(project["id"] || "") === String(state.projectIndex.activeProjectId || "");
  });
  const newProjectSelected =
    activeProjectSummary?.["hasSource"] === false || state.projectIndex.activeProjectId === null;
  const listedProjects = projectSummaries.filter(function (project) {
    return project["hasSource"] !== false;
  });
  const disableDelete = newProjectSelected || state.projectIndex.activeProjectId === null;
  const saveButtonAttrs = !hasSource ? 'disabled style="opacity: 0.5; cursor: not-allowed;"' : "";
  const deleteButtonAttrs = disableDelete
    ? 'style="opacity: 0.5; cursor: not-allowed; color: var(--color-error)" disabled'
    : 'style="color: var(--color-error)"';

  const modeLabel =
    workspaceMode === "loading"
      ? "Loading"
      : workspaceMode === "analyzing"
        ? "Analyzing"
        : workspaceMode === "complete"
          ? "Complete"
          : "Workspace";

  const modeTone =
    workspaceMode === "analyzing"
      ? "running"
      : workspaceMode === "complete"
        ? "success"
        : "neutral";

  return `
    <aside class="labx-left-rail">
      <div class="labx-brand">
        <span class="labx-brand__mark">A3</span>
        <div>
          <strong>Laboratory</strong>
          <p>Media workspace</p>
        </div>
      </div>
      <div class="labx-rail-status">
        ${renderStatusChip(modeLabel, modeTone)}
      </div>

      <section class="labx-rail-section">
        <p class="labx-rail-title">PROJECT</p>
        <div class="labx-rail-stack" style="gap: 12px; margin-bottom: 12px; margin-top: 8px;">
          <select class="labx-select" data-lab-field="project.id" style="width: 100%; font-size: 1rem; padding: 4px;">
            <option value="new" ${newProjectSelected ? "selected" : ""}>-- New Project --</option>
            ${listedProjects
              .map(function (p) {
                return `<option value="${escapeHtml(String(p["id"]))}" ${
                  !newProjectSelected && p["id"] === state.projectIndex.activeProjectId
                    ? "selected"
                    : ""
                }>
                ${escapeHtml(String(p["name"] || p["id"]))}
              </option>`;
              })
              .join("")}
          </select>
          <div class="labx-rail-actions">
            <button class="labx-inline-action labx-inline-action--rail" type="button" data-lab-action="save-project" ${saveButtonAttrs}>Save</button>
            <button class="labx-inline-action labx-inline-action--rail" type="button" data-lab-action="project-delete" ${deleteButtonAttrs}>Delete</button>
          </div>
        </div>
      </section>

      <button
        class="labx-manager-link"
        type="button"
        data-lab-action="toggle-tool-manager"
        data-active="${state.ui.toolManagerOpen ? "true" : "false"}"
      >
        <strong>Tool Management</strong>
        <small>Install, update, and refresh local analysis tools</small>
      </button>


      <section class="labx-rail-section">
        <p class="labx-rail-title">INTENTS</p>
        <div class="labx-rail-stack">
          ${intents
            .map(function (intent) {
              return `
              <button
                class="labx-module-link"
                type="button"
                data-lab-action="workspace-intent-toggle"
                data-lab-value="${escapeHtml(intent.id)}"
                data-active="${intent.selected ? "true" : "false"}"
                ${intent.readiness === "blocked" ? 'data-blocked="true"' : ""}
                title="${intent.blockReason ? escapeHtml(intent.blockReason) : escapeHtml(intent.description)}"
              >
                <div class="labx-module-link__head">
                  <strong>${escapeHtml(intent.label)}</strong>
                  ${renderStatusChip(
                    intent.readiness === "ready"
                      ? "OK"
                      : intent.readiness === "optional"
                        ? "△"
                        : "✕",
                    intent.readiness === "ready"
                      ? "success"
                      : intent.readiness === "optional"
                        ? "warning"
                        : "error"
                  )}
                </div>
                <small>${intent.selected ? "Selected" : intent.readiness === "blocked" ? escapeHtml(intent.blockReason || "Unavailable") : "Available"}</small>
              </button>
            `;
            })
            .join("")}
        </div>
      </section>

      <section class="labx-rail-section">
        <p class="labx-rail-title">STATUS</p>
        <div class="labx-rail-note">
          <strong>${escapeHtml(String(selectedIntents.length))} intent${selectedIntents.length !== 1 ? "s" : ""} selected</strong>
          <p>${
            intents.filter(function (i) {
              return i.readiness === "ready" && i.selected;
            }).length
          } ready</p>
        </div>
      </section>
    </aside>
  `;
}
