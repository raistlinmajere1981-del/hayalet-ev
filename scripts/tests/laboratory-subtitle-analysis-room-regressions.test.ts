import test from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";

import { validateRoomManifest } from "../../src/types/rooms.ts";

const requiredSubtitleFiles = [
  "rooms/laboratory/tools/subtitle-source-presets.json",
  "rooms/laboratory/tools/subtitle-youtube.form.json",
  "rooms/laboratory/tools/subtitle-edit-presets.json",
  "rooms/laboratory/tools/subtitle-analysis-catalog.json",
  "rooms/laboratory/tools/subtitle-analysis-capabilities.json",
  "rooms/laboratory/tools/subtitle-analysis-providers.json",
];

test("laboratory workspace keeps the required subtitle-analysis package files", () => {
  requiredSubtitleFiles.forEach((filePath) => {
    assert.equal(existsSync(filePath), true, filePath);
  });
});

test("laboratory manifest exposes the subtitle-analysis feature beside media and audio", () => {
  const manifest = JSON.parse(readFileSync("rooms/laboratory/manifest.json", "utf8"));
  const validation = validateRoomManifest(manifest);
  const subtitleFeature = validation.manifest?.features.find((feature) => feature.id === "subtitle-analysis");

  assert.equal(validation.valid, true);
  assert.equal(validation.manifest?.features.length, 3);
  assert.equal(subtitleFeature?.name, "Subtitle Analysis");
  assert.equal(subtitleFeature?.scene?.hotspot.id, "laboratory-subtitle-analysis");
  assert.equal(subtitleFeature?.scene?.view.id, "subtitle-analysis-console");
  assert.equal(subtitleFeature?.scene?.view.backgroundSrc, "assets/media-analysis-view.webp");
});

test("laboratory host wires subtitle source, edit, and process actions into the shared room contract", () => {
  const hostSource = readFileSync("rooms/laboratory/host/index.js", "utf8");

  assert.match(hostSource, /const SUBTITLE_FEATURE_ID = "subtitle-analysis";/);
  assert.match(hostSource, /subtitle-source-presets\.json/);
  assert.match(hostSource, /subtitle-youtube\.form\.json/);
  assert.match(hostSource, /subtitle-edit-presets\.json/);
  assert.match(hostSource, /subtitle-analysis-catalog\.json/);
  assert.match(hostSource, /subtitle-analysis-capabilities\.json/);
  assert.match(hostSource, /subtitle-analysis-providers\.json/);
  assert.match(hostSource, /case "subtitle-source-set-mode":/);
  assert.match(hostSource, /case "subtitle-source-pick-local":/);
  assert.match(hostSource, /case "subtitle-source-pick-folder":/);
  assert.match(hostSource, /case "subtitle-source-download-url":/);
  assert.match(hostSource, /case "subtitle-source-discover-youtube":/);
  assert.match(hostSource, /case "subtitle-source-download-youtube":/);
  assert.match(hostSource, /case "subtitle-source-toggle-discovery":/);
  assert.match(hostSource, /case "subtitle-edit-apply-preset":/);
  assert.match(hostSource, /case "subtitle-edit-update-recipe":/);
  assert.match(hostSource, /case "subtitle-edit-preview":/);
  assert.match(hostSource, /case "subtitle-edit-apply":/);
  assert.match(hostSource, /function handleSubtitleYoutubeDiscovery\(api, runtime, requestId\)/);
  assert.match(hostSource, /function buildSubtitleProcessModules\(runtime, target\)/);
  assert.match(hostSource, /function buildSubtitleAnalysisStats\(runtime, project, target\)/);
  assert.match(hostSource, /function composeSubtitleAnalysisReport\(runtime, project\)/);
});

test("laboratory UI renders subtitle source and edit workspaces on the shared shell", () => {
  const uiSource = readFileSync("rooms/laboratory/ui/index.js", "utf8");

  assert.match(uiSource, /const SUBTITLE_FEATURE_ID = "subtitle-analysis";/);
  assert.match(uiSource, /function createSubtitleLocalDrafts\(\)/);
  assert.match(uiSource, /function renderSubtitleDiscoveryPanel\(\)/);
  assert.match(uiSource, /function getSubtitleEntries\(\)/);
  assert.match(uiSource, /function renderSubtitleSourceIntakePanel\(\)/);
  assert.match(uiSource, /function renderSubtitleEntryPanel\(\)/);
  assert.match(uiSource, /function renderSubtitleEditStage\(\)/);
  assert.match(uiSource, /data-action="subtitle-source-discover-youtube"/);
  assert.match(uiSource, /data-action="subtitle-source-download-youtube"/);
  assert.match(uiSource, /data-action="subtitle-edit-preview"/);
  assert.match(uiSource, /data-action="subtitle-edit-apply"/);
  assert.match(uiSource, /function renderSubtitlePreviewBody\(/);
});

test("laboratory subtitle-analysis extends the project schema with subtitle workspace state", () => {
  const schema = JSON.parse(readFileSync("rooms/laboratory/tools/project-schema.json", "utf8"));
  const form = JSON.parse(readFileSync("rooms/laboratory/tools/subtitle-youtube.form.json", "utf8"));
  const catalog = JSON.parse(readFileSync("rooms/laboratory/tools/subtitle-analysis-catalog.json", "utf8"));
  const capabilities = JSON.parse(readFileSync("rooms/laboratory/tools/subtitle-analysis-capabilities.json", "utf8"));

  assert.equal(schema.project.required.includes("subtitleAnalysis"), true);
  assert.equal(Array.isArray(schema.project.subtitleAnalysis.required), true);
  assert.equal(schema.project.subtitleAnalysis.required.includes("workspace"), true);
  assert.equal(schema.project.subtitleAnalysis.required.includes("discovery"), true);
  assert.equal(schema.project.subtitleAnalysis.required.includes("entries"), true);
  assert.equal(schema.project.subtitleAnalysis.required.includes("edit"), true);
  assert.equal(schema.project.subtitleAnalysis.required.includes("analysis"), true);
  assert.equal(schema.project.subtitleAnalysis.required.includes("export"), true);
  assert.equal(Array.isArray(form.fields), true);
  assert.equal(form.fields.some((field) => field.id === "liveMode"), true);
  assert.equal(form.fields.some((field) => field.id === "titleInclude"), true);
  assert.equal(form.fields.some((field) => field.id === "titleExclude"), true);
  assert.equal(Array.isArray(catalog.modules), true);
  assert.equal(capabilities.modules["format-qc"]?.status, "ready");
  assert.equal(capabilities.modules["semantic-search"]?.status, "planned");
});
