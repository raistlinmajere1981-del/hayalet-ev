import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

import { createLabStore } from "../../rooms/laboratory/runtime/lab-store.ts";
import { renderLabLeftRail } from "../../rooms/laboratory/ui/lab-left-rail.ts";

function hydrateState(
  overrides: {
    activeProjectId: string | null;
    projects: Array<Record<string, unknown>>;
    source: Record<string, unknown> | null;
    sourceProbeStatus?: "idle" | "running" | "completed" | "failed";
  }
) {
  const store = createLabStore();
  store.dispatch({
    type: "hydrate",
    payload: {
      currentStage: "source",
      featureId: "media-analysis",
      projectIndex: {
        activeProjectId: overrides.activeProjectId,
        projects: overrides.projects,
      },
      workbench: {
        activeModuleId: "media-analysis",
        availableModuleIds: ["media-analysis", "audio-analysis", "subtitle-analysis"],
        selectedModuleIds: ["media-analysis"],
      },
      source:
        overrides.source ||
        ({
          status: "idle",
          kind: "video",
          mode: "local",
          storedFileName: null,
          routeLabel: null,
        } as Record<string, unknown>),
      sourceProbeStatus: overrides.sourceProbeStatus || "idle",
      reports: {
        user: null,
        ai: null,
        emptyReason: "Rapor henüz üretilmedi.",
      },
      activityFeed: [],
    },
  });
  return store.getState();
}

test("laboratory left rail opens in new project mode with passive save and delete controls", () => {
  const html = renderLabLeftRail(
    hydrateState({
      activeProjectId: "draft-1",
      projects: [
        { id: "draft-1", name: "Lab Session 2026-04-21 11:00", hasSource: false },
        { id: "project-1", name: "2026-04-20 18-30 - evidence.mp4", hasSource: true },
      ],
      source: {
        status: "idle",
        kind: "video",
        mode: "local",
        storedFileName: null,
        routeLabel: null,
      },
    })
  );

  assert.match(html, /<option value="new" selected>-- New Project --<\/option>/);
  assert.match(html, /data-lab-action="save-project" disabled/);
  assert.match(html, /data-lab-action="project-delete"[^>]*disabled/);
  assert.doesNotMatch(html, /workspace\.projectName/);
  assert.doesNotMatch(html, /toggle-report-view/);
});

test("laboratory left rail enables save and delete when the active project has a source", () => {
  const html = renderLabLeftRail(
    hydrateState({
      activeProjectId: "project-1",
      projects: [{ id: "project-1", name: "2026-04-20 18-30 - evidence.mp4", hasSource: true }],
      source: {
        status: "ready",
        kind: "video",
        mode: "local",
        storedFileName: "evidence.mp4",
        routeLabel: "Local copy",
      },
      sourceProbeStatus: "completed",
    })
  );

  assert.match(html, /<option value="project-1" selected>/);
  assert.doesNotMatch(html, /data-lab-action="save-project" disabled/);
  assert.doesNotMatch(html, /data-lab-action="project-delete"[^>]*disabled/);
});

test("laboratory controller resets source intake when returning to new project and keeps naming/delete safeguards", () => {
  const source = readFileSync("rooms/laboratory/runtime/lab-run-controller.ts", "utf8");
  const hostSource = readFileSync(
    "rooms/laboratory/main-functions/media-analysis/host/action-handlers-project.ts",
    "utf8"
  );

  assert.match(source, /function buildAutoProjectName\(/);
  assert.match(source, /function buildEmptySourceState\(/);
  assert.match(source, /if \(projectValue === "new"\)/);
  assert.match(source, /const resetSourceState = buildEmptySourceState\(state\);/);
  assert.match(source, /type: "source-config-patched",\s*patch: resetSourceState/);
  assert.match(source, /type: "source-drafts-updated",\s*patch: resetSourceState\.drafts/);
  assert.match(source, /type: "source-drafts-committed"/);
  assert.match(source, /sendMediaAction\("project-create"\)/);
  assert.match(
    source,
    /sendMediaAction\("project-select", \{ projectId: blankProjectId, resetSourceState \}\)/
  );
  assert.match(source, /sendMediaAction\("project-rename", \{\s*name: buildAutoProjectName\(/);
  assert.match(source, /deps\.windowRef\.confirm\(/);
  assert.match(hostSource, /rawResetSourceState = actionPayload\["resetSourceState"\]/);
  assert.match(hostSource, /await patchActiveProject\(runtime, function \(project\) \{/);
  assert.match(hostSource, /source: \{\s*\.\.\.resetSourceState,\s*\}/);
});
