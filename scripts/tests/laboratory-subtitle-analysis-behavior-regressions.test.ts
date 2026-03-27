import test from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";

test("subtitle YouTube descriptor exposes discovery-first filters", () => {
  const form = JSON.parse(readFileSync("rooms/laboratory/shared/data/tools/subtitle-youtube.form.json", "utf8"));
  const fields = Array.isArray(form.fields) ? form.fields.map((entry) => entry.id) : [];

  assert.deepEqual(
    ["youtubeUrl", "subtitleMode", "subtitlesLang", "publishedAfter", "publishedBefore", "weekdays"].every((id) =>
      fields.includes(id)
    ),
    true
  );
  assert.equal(fields.includes("liveMode"), true);
  assert.equal(fields.includes("titleInclude"), true);
  assert.equal(fields.includes("titleExclude"), true);
});

test("subtitle host keeps discovery and explicit export format plumbing", () => {
  const hostSource = readFileSync("rooms/laboratory/host/index.js", "utf8");
  const hostRuntimeSource = readFileSync("rooms/laboratory/host/runtime.js", "utf8");
  const stateCompositionSource = readFileSync(
    "rooms/laboratory/shared/host/state-composition.js",
    "utf8"
  );
  const subtitleRuntimeSource = readFileSync(
    "rooms/laboratory/main-functions/subtitle-analysis/host/runtime.js",
    "utf8"
  );
  const subtitleDocumentSource = readFileSync(
    "rooms/laboratory/main-functions/subtitle-analysis/host/document-runtime.js",
    "utf8"
  );
  const subtitleStateDelegatesSource = readFileSync(
    "rooms/laboratory/main-functions/subtitle-analysis/host/state-delegates.js",
    "utf8"
  );
  const subtitleStateSource = readFileSync(
    "rooms/laboratory/main-functions/subtitle-analysis/host/state.js",
    "utf8"
  );
  const subtitleYoutubeHostSource = readFileSync(
    "rooms/laboratory/main-functions/subtitle-analysis/host/youtube-source.js",
    "utf8"
  );

  assert.match(subtitleStateDelegatesSource, /function createEmptySubtitleDiscoveryState\(\)/);
  assert.match(subtitleStateSource, /selectedCandidateIds/);
  assert.match(hostSource, /\.\/runtime\.js/);
  assert.match(hostRuntimeSource, /main-functions\/subtitle-analysis\/host\/runtime\.js/);
  assert.match(hostRuntimeSource, /main-functions\/subtitle-analysis\/host\/document-runtime\.js/);
  assert.match(hostRuntimeSource, /shared\/host\/state-composition\.js/);
  assert.match(
    stateCompositionSource,
    /main-functions\/subtitle-analysis\/host\/state-delegates\.js/
  );
  assert.match(stateCompositionSource, /main-functions\/subtitle-analysis\/host\/state\.js/);
  assert.match(
    subtitleRuntimeSource,
    /handleSubtitleYoutubeDiscovery: subtitleYoutubeSourceRuntime\.handleYoutubeDiscovery/
  );
  assert.match(subtitleYoutubeHostSource, /Run discovery and select at least one video before downloading subtitles\./);
  assert.match(subtitleYoutubeHostSource, /toolId: "yt-dlp"/);
  assert.match(subtitleDocumentSource, /function resolveSubtitleOutputFormat\(sourceFormat, outputFormatValue\)/);
  assert.match(subtitleDocumentSource, /function serializeSubtitleCueModel\(cues, format\)/);
  assert.match(subtitleStateSource, /outputFormat: "source"/);
});

test("subtitle UI renders discovery table controls and output format selection", () => {
  const uiSource = readFileSync("rooms/laboratory/ui/laboratory-ui-runtime.js", "utf8");
  const copyRuntimeSource = readFileSync("rooms/laboratory/shared/ui/copy-runtime.js", "utf8");
  const subtitleAnalysisUiRuntimeSource = readFileSync(
    "rooms/laboratory/main-functions/subtitle-analysis/ui/runtime.js",
    "utf8"
  );
  const subtitleModuleSource = readFileSync(
    "rooms/laboratory/main-functions/subtitle-analysis/ui/module.js",
    "utf8"
  );

  assert.match(uiSource, /shared\/ui\/copy-runtime\.js/);
  assert.match(copyRuntimeSource, /function subtitleText\(path, trFallback, enFallback\)/);
  assert.match(uiSource, /main-functions\/subtitle-analysis\/ui\/runtime\.js/);
  assert.match(uiSource, /\.\/view-bindings-runtime\.js/);
  assert.match(subtitleAnalysisUiRuntimeSource, /\.\.\/\.\.\/\.\.\/ui\/subtitle-panel-runtime\.js/);
  assert.match(subtitleAnalysisUiRuntimeSource, /function renderSubtitleDiscoveryPanel\(\)/);
  assert.match(subtitleAnalysisUiRuntimeSource, /function renderSubtitleEditStage\(\)/);
  assert.match(subtitleModuleSource, /data-action="subtitle-source-select-all-discovery"/);
  assert.match(subtitleModuleSource, /data-action="subtitle-source-clear-discovery-selection"/);
  assert.match(subtitleModuleSource, /data-action="subtitle-source-toggle-discovery"/);
  assert.match(subtitleModuleSource, /Candidate Table/);
  assert.match(subtitleModuleSource, /renderEditSelectField\("outputFormat"/);
});

test("subtitle locale catalogs keep stage, source, and edit copy in room-local i18n", () => {
  const english = JSON.parse(readFileSync("rooms/laboratory/i18n/en.json", "utf8"));
  const turkish = JSON.parse(readFileSync("rooms/laboratory/i18n/tr.json", "utf8"));

  assert.equal(english.subtitleAnalysis.stages.source.title, "Subtitle Source");
  assert.equal(turkish.subtitleAnalysis.stages.source.title, "Altyazi Kaynagi");
  assert.equal(english.subtitleAnalysis.source.entries.title, "Subtitle List");
  assert.equal(turkish.subtitleAnalysis.source.entries.title, "Altyazi Listesi");
  assert.equal(english.subtitleAnalysis.edit.actions.apply, "Apply cleanup");
  assert.equal(turkish.subtitleAnalysis.edit.actions.apply, "Temizlemeyi uygula");
  assert.equal(english.subtitleAnalysis.process.catalog.modules["format-qc"].label, "Format QC");
  assert.equal(turkish.subtitleAnalysis.process.catalog.modules["format-qc"].label, "Format QC");
  assert.equal(english.subtitleAnalysis.process.providers.items["native-subtitle-qc"].label, "Native subtitle QC");
  assert.equal(turkish.subtitleAnalysis.process.providers.items["native-subtitle-qc"].label, "Yerel altyazi QC");
});

test("subtitle smoke docs exist for operators", () => {
  assert.equal(existsSync(".rovo/laboratory-subtitle-analysis-smoke.md"), true);
  assert.equal(existsSync(".rovo/laboratory-subtitle-analysis-source-matrix.md"), true);
});
