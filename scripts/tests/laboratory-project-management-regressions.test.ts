import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

import { createLabStore } from "../../rooms/laboratory/runtime/lab-store.ts";
import { renderLabTopBar } from "../../rooms/laboratory/ui/lab-top-bar.ts";

function hydrateState(overrides: {
  activeProjectId: string | null;
  projects: Array<Record<string, unknown>>;
  source: Record<string, unknown> | null;
  sourceProbeStatus?: "idle" | "running" | "completed" | "failed";
}) {
  const store = createLabStore();
  store.dispatch({
    type: "hydrate",
    payload: {
      featureId: "media-analysis",
      projectIndex: {
        activeProjectId: overrides.activeProjectId,
        projects: overrides.projects,
      },
      workbench: {
        activeModuleId: "media-analysis",
        availableModuleIds: ["media-analysis", "audio-analysis"],
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

test("laboratory top bar opens project management without exposing draft names", () => {
  const html = renderLabTopBar(
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

  assert.match(html, /data-lab-action="project-workspace-open"/);
  assert.match(html, /Project Management/);
  assert.doesNotMatch(html, /Lab Session 2026-04-21 11:00/);
  assert.doesNotMatch(html, /data-lab-field="project\.id"/);
  assert.doesNotMatch(html, /<select/);
  assert.doesNotMatch(html, /2026-04-20 18-30 - evidence\.mp4/);
  assert.doesNotMatch(html, /workspace\.projectName/);
  assert.doesNotMatch(html, /toggle-report-view/);
});

test("laboratory top bar keeps active project names out of the management button", () => {
  const html = renderLabTopBar(
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

  assert.match(html, /data-lab-action="project-workspace-open"/);
  assert.match(html, /Project Management/);
  assert.doesNotMatch(html, /2026-04-20 18-30 - evidence\.mp4/);
  assert.doesNotMatch(html, /data-lab-field="project\.id"/);
  assert.match(html, /data-lab-action="toggle-tool-manager"/);
});

test("laboratory controller starts clean projects and keeps naming/delete safeguards", () => {
  const source = readFileSync("rooms/laboratory/runtime/lab-run-controller.ts", "utf8");
  const hostSource = readFileSync(
    "rooms/laboratory/main-functions/media-analysis/host/action-handlers-project.ts",
    "utf8"
  );
  const lifecycleSource = readFileSync(
    "rooms/laboratory/shared/host/project-lifecycle.ts",
    "utf8"
  );

  assert.match(source, /buildAutoProjectName,/);
  assert.match(source, /function buildEmptySourceState\(/);
  assert.match(source, /function startCleanProjectSession\(\)/);
  assert.match(source, /if \(projectValue === "new"\)/);
  assert.match(source, /case "project-create":/);
  assert.match(source, /const resetSourceState = buildEmptySourceState\(state\);/);
  assert.match(source, /type: "source-config-patched",\s*patch: resetSourceState/);
  assert.match(source, /type: "source-drafts-updated",\s*patch: resetSourceState\.drafts/);
  assert.match(source, /type: "source-drafts-committed"/);
  assert.match(source, /sendMediaAction\("project-create"\)/);
  assert.match(source, /function removeAssetsWithConfirmation\(/);
  assert.doesNotMatch(source, /findBlankProjectId/);
  assert.doesNotMatch(source, /hasActiveSource/);
  assert.match(source, /sendMediaAction\("project-rename", \{\s*name: buildAutoProjectName\(/);
  assert.match(source, /deps\.windowRef\.confirm\(/);
  assert.match(hostSource, /rawResetSourceState = actionPayload\["resetSourceState"\]/);
  assert.match(hostSource, /await patchActiveProject\(runtime, function \(project\) \{/);
  assert.match(hostSource, /source: \{\s*\.\.\.resetSourceState,\s*\}/);
  assert.match(lifecycleSource, /function pruneEmptyDraftProjects\(/);
  assert.match(lifecycleSource, /function isEmptyProjectDraft\(/);
  assert.match(lifecycleSource, /operation: "delete-path"/);
  assert.match(lifecycleSource, /recursive: true/);
});
