import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

import { createMediaUrlSourceIntakeRuntime } from "../../rooms/laboratory/features/media-analysis/host/source-intake-url.ts";
import { createMediaYoutubeSourceIntakeRuntime } from "../../rooms/laboratory/features/media-analysis/host/source-intake-youtube.ts";
import { createLabStore } from "../../rooms/laboratory/runtime/lab-store.ts";
import { resolveDrawerMode } from "../../rooms/laboratory/runtime/lab-selectors.ts";
import { renderLabSourcePanel } from "../../rooms/laboratory/ui/lab-source-panel.ts";
import { renderWorkspaceSurface } from "../../rooms/laboratory/ui/workspace-surface.ts";

const sourcePresets = JSON.parse(
  readFileSync("rooms/laboratory/tools/source-presets.json", "utf8")
) as Record<string, unknown>;
const ytDlpForm = JSON.parse(
  readFileSync("rooms/laboratory/tools/yt-dlp.form.json", "utf8")
) as Record<string, unknown>;

function toRecord(value: unknown): Record<string, unknown> {
  return value !== null && typeof value === "object" && Array.isArray(value) === false
    ? (value as Record<string, unknown>)
    : {};
}

function asNonEmptyString(value: unknown) {
  return typeof value === "string" && value.trim() !== "" ? value.trim() : null;
}

function createYoutubeArgsRuntime() {
  return createMediaYoutubeSourceIntakeRuntime({
    asNonEmptyString,
    callRoomTools: async function () {
      return {};
    },
    cancelJobsForProject: async function () {
      return null;
    },
    clearJob: function () {
      return undefined;
    },
    getActiveProject: function () {
      return null;
    },
    getPresetDefaultCustomValues: function (presetsValue, presetId) {
      return toRecord(
        toRecord(toRecord(toRecord(presetsValue)["youtubePresets"])[presetId])[
          "defaultCustomValues"
        ]
      );
    },
    getProjectSourceDir: function () {
      return "/tmp/lab-youtube-source";
    },
    normalizeMimeType: function () {
      return "video/mp4";
    },
    patchActiveProject: async function () {
      return null;
    },
    pushJobState: function () {
      return undefined;
    },
    registerJob: function () {
      return undefined;
    },
    resetEditForCurrentSource: function () {
      return undefined;
    },
    resetProfileForCurrentSource: function () {
      return undefined;
    },
    resolvePreparedSource: async function () {
      return {
        metadata: {},
        metadataError: null,
        mimeType: "video/mp4",
        storedFileName: "clip.mp4",
        storedPath: "/tmp/lab-youtube-source/clip.mp4",
      };
    },
    roomId: "laboratory",
    toRecord,
  });
}

function assertArgPair(args: string[], flag: string, value: string) {
  const flagIndex = args.indexOf(flag);
  assert.notEqual(flagIndex, -1);
  assert.equal(args[flagIndex + 1], value);
}


describe("laboratory controller keeps project import draft and add wiring on the active so", () => {
void test("laboratory controller keeps project import draft and add wiring on the active source flow", () => {
  const formActionControllerSource = readFileSync(
    "rooms/laboratory/runtime/controller/lab-form-action-controller.ts",
    "utf8"
  );
  const sourceDraftControllerSource = readFileSync(
    "rooms/laboratory/runtime/controller/lab-source-draft-controller.ts",
    "utf8"
  );
  const sourceActionControllerSource = readFileSync(
    "rooms/laboratory/runtime/controller/lab-source-action-controller.ts",
    "utf8"
  );

  assert.match(sourceDraftControllerSource, /function buildProjectImportDraftPatch/);
  assert.equal(formActionControllerSource.includes("project-import." + "file" + "NameHint"), false);
  assert.match(formActionControllerSource, /case "project-import\.urlInput":/);
  assert.match(formActionControllerSource, /case "project-import\.youtubeCaptureMode":/);
  assert.match(formActionControllerSource, /case "project-import\.youtubeVideoFormat":/);
  assert.match(formActionControllerSource, /case "project-import\.youtubeAudioFormat":/);
  assert.match(
    sourceActionControllerSource,
    /function selectProjectByValue[\s\S]*type: "project-import-reset"[\s\S]*sendMediaAction\("project-select"/
  );
  assert.match(
    formActionControllerSource,
    /case "project\.id":[\s\S]*selectProjectByValue\(String\(targetValue \|\| ""\)\)/
  );
  assert.match(
    formActionControllerSource,
    /field\.startsWith\("project-import\.youtubeCustom\."\)/
  );
  assert.match(formActionControllerSource, /type: "project-import-draft-updated"/);
  assert.match(formActionControllerSource, /type: "youtube-import-format-selected"/);
  assert.match(sourceActionControllerSource, /type: "project-import-reset"/);
  assert.match(sourceActionControllerSource, /function runProjectImportAdd/);
  assert.match(
    sourceActionControllerSource,
    /buildProjectImportHostAction\(deps\.store\.getState\(\)\)/
  );
  assert.match(sourceActionControllerSource, /buildProjectImportLocalHostAction/);
  assert.match(sourceActionControllerSource, /buildProjectImportUrlCheckAction/);
  assert.match(
    sourceActionControllerSource,
    /deps\.sendMediaAction\(importAction\.action, \{ fields: importAction\.fields \}\)/
  );
  assert.match(sourceActionControllerSource, /case "project-import-local-add":/);
  assert.match(sourceActionControllerSource, /case "project-import-check-url":/);
  assert.match(sourceActionControllerSource, /case "project-import-url-add":/);
  assert.match(sourceActionControllerSource, /case "project-import-add":/);
  assert.match(sourceActionControllerSource, /case "project-import-clear":/);
  assert.match(sourceActionControllerSource, /youtubeCustom: sourceDrafts\.youtubeCustom/);
  assert.match(sourceActionControllerSource, /case "source-youtube-preset":/);
  assert.match(formActionControllerSource, /field\.startsWith\("source\.youtubeCustom\."\)/);
  assert.match(formActionControllerSource, /mode: getDefaultSourceMode\(state, targetValue\)/);
  assert.match(formActionControllerSource, /case "source\.mode":/);
  assert.match(formActionControllerSource, /deps\.sendMediaAction\("source-set-mode"/);
  assert.doesNotMatch(formActionControllerSource, /enter-youtube-import-mode/);
  assert.match(
    sourceActionControllerSource,
    /sendMediaAction\("source-update-draft", \{\s*fields: mergeSourceDrafts\(state, patch\)/
  );
});
void test("laboratory YouTube import progress hides tool command streams", () => {
  const roomToolService = readFileSync("electron/room-tool-service.ts", "utf8");
  const progressRuntime = readFileSync(
    "rooms/laboratory/shared/host/room-tools-progress.ts",
    "utf8"
  );
  const runtimeEvents = readFileSync("rooms/laboratory/shared/host/runtime-events.ts", "utf8");

  assert.match(roomToolService, /message: "Tool run started\."/);
  assert.doesNotMatch(roomToolService, /message:\s*\(request\.args \?\? \[\]\)\.join/);
  assert.match(progressRuntime, /job\.action !== "source-download-youtube"/);
  assert.match(progressRuntime, /phaseLabel/);
  assert.match(runtimeEvents, /percent: typeof throttledPayload\["percent"\]/);
});
});
