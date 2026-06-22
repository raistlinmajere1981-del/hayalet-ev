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
