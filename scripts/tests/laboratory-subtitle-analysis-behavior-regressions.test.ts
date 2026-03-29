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
  const hostSource = readFileSync("rooms/laboratory/host/index.ts", "utf8");
  const hostRuntimeSource = readFileSync("rooms/laboratory/host/runtime.ts", "utf8");
  const hostFoundationSource = readFileSync("rooms/laboratory/host/foundation-runtimes.ts", "utf8");
  const hostProjectSource = readFileSync("rooms/laboratory/host/project-runtimes.ts", "utf8");
  const hostFeatureSource = readFileSync("rooms/laboratory/host/feature-runtimes.ts", "utf8");
  const featureAdaptersSource = readFileSync("rooms/laboratory/host/feature-adapters.ts", "utf8");
  const stateCompositionSource = readFileSync(
    "rooms/laboratory/shared/host/state-composition.ts",
    "utf8"
  );
  const subtitleRuntimeSource = readFileSync(
    "rooms/laboratory/main-functions/subtitle-analysis/host/runtime.ts",
    "utf8"
  );
  const subtitleDocumentSource = readFileSync(
    "rooms/laboratory/main-functions/subtitle-analysis/host/document-runtime.ts",
    "utf8"
  );
  const subtitleStateDelegatesSource = readFileSync(
    "rooms/laboratory/main-functions/subtitle-analysis/host/state-delegates.ts",
    "utf8"
  );
  const subtitleStateSource = readFileSync(
    "rooms/laboratory/main-functions/subtitle-analysis/host/state.ts",
    "utf8"
  );
  const subtitleStateDefaultsSource = readFileSync(
    "rooms/laboratory/main-functions/subtitle-analysis/host/state-defaults.ts",
    "utf8"
  );
  const subtitleStateNormalizationSource = readFileSync(
    "rooms/laboratory/main-functions/subtitle-analysis/host/state-normalization.ts",
    "utf8"
  );
  const subtitleStateProjectsSource = readFileSync(
    "rooms/laboratory/main-functions/subtitle-analysis/host/state-projects.ts",
    "utf8"
  );
  const subtitleYoutubeHostSource = readFileSync(
    "rooms/laboratory/main-functions/subtitle-analysis/host/youtube-source.ts",
    "utf8"
  );
  const subtitleYoutubeDiscoverySource = readFileSync(
    "rooms/laboratory/main-functions/subtitle-analysis/host/youtube-discovery.ts",
    "utf8"
  );
  const subtitleYoutubeFiltersSource = readFileSync(
    "rooms/laboratory/main-functions/subtitle-analysis/host/youtube-filters.ts",
    "utf8"
  );
  const hostCompositionSource = [
    hostRuntimeSource,
    hostFoundationSource,
    hostProjectSource,
    hostFeatureSource,
    featureAdaptersSource,
  ].join("\n");

  assert.match(subtitleStateDelegatesSource, /function createEmptySubtitleDiscoveryState\(\)/);
  assert.match(subtitleStateSource, /from "\.\/state-defaults\.js"/);
  assert.match(subtitleStateSource, /from "\.\/state-normalization\.js"/);
  assert.match(subtitleStateSource, /from "\.\/state-projects\.js"/);
  assert.match(
    subtitleStateDefaultsSource,
    /export function createSubtitleStateDefaultsRuntime\(deps\)/
  );
  assert.match(subtitleStateNormalizationSource, /selectedCandidateIds/);
  assert.match(
    subtitleStateProjectsSource,
    /function upsertSubtitleEntries\(runtime, project, incomingEntries, options\)/
  );
  assert.match(hostSource, /\.\/runtime\.js/);
  assert.match(hostCompositionSource, /main-functions\/subtitle-analysis\/host\/runtime\.js/);
  assert.match(hostCompositionSource, /main-functions\/subtitle-analysis\/host\/document-runtime\.js/);
  assert.match(hostCompositionSource, /shared\/host\/state-composition\.js/);
  assert.match(
    stateCompositionSource,
    /main-functions\/subtitle-analysis\/host\/state-delegates\.js/
  );
  assert.match(stateCompositionSource, /main-functions\/subtitle-analysis\/host\/state\.js/);
  assert.match(
    subtitleRuntimeSource,
    /handleSubtitleYoutubeDiscovery: subtitleYoutubeSourceRuntime\.handleYoutubeDiscovery/
  );
  assert.match(subtitleYoutubeHostSource, /from "\.\/youtube-discovery\.js"/);
  assert.match(subtitleYoutubeHostSource, /from "\.\/youtube-filters\.js"/);
  assert.match(subtitleYoutubeHostSource, /Run discovery and select at least one video before downloading subtitles\./);
  assert.match(subtitleYoutubeHostSource, /needsMetadataFiltering: needsSubtitleYoutubeMetadataFiltering/);
  assert.match(subtitleYoutubeDiscoverySource, /toolId: "yt-dlp"/);
  assert.match(
    subtitleYoutubeDiscoverySource,
    /function buildSubtitleYoutubeDownloadArgs\(runtime, drafts, sourceDir, urlValue, scopeId\)/
  );
  assert.match(subtitleYoutubeFiltersSource, /function matchesSubtitleLanguageAvailability\(metadata, drafts\)/);
  assert.match(subtitleYoutubeFiltersSource, /function parseSubtitleWeekdayFilter\(value\)/);
  assert.match(subtitleDocumentSource, /function resolveSubtitleOutputFormat\(sourceFormat, outputFormatValue\)/);
  assert.match(subtitleDocumentSource, /function serializeSubtitleCueModel\(cues, format\)/);
  assert.match(subtitleStateDefaultsSource, /outputFormat: "source"/);
});

test("subtitle UI renders discovery table controls and output format selection", () => {
  const uiSource = readFileSync("rooms/laboratory/ui/laboratory-ui-runtime.ts", "utf8");
  const copyRuntimeSource = readFileSync("rooms/laboratory/shared/ui/copy-runtime.ts", "utf8");
  const subtitleAnalysisUiRuntimeSource = readFileSync(
    "rooms/laboratory/main-functions/subtitle-analysis/ui/runtime.ts",
    "utf8"
  );
  const subtitleModuleSource = readFileSync(
    "rooms/laboratory/main-functions/subtitle-analysis/ui/module.ts",
    "utf8"
  );
  const subtitleSourcePanelsSource = readFileSync(
    "rooms/laboratory/main-functions/subtitle-analysis/ui/source-panels.ts",
    "utf8"
  );
  const subtitleSourceIntakeSource = readFileSync(
    "rooms/laboratory/main-functions/subtitle-analysis/ui/source-panel-intake.ts",
    "utf8"
  );
  const subtitleSourceWorkspaceSource = readFileSync(
    "rooms/laboratory/main-functions/subtitle-analysis/ui/source-panel-workspace.ts",
    "utf8"
  );
  const subtitleEditPanelsSource = readFileSync(
    "rooms/laboratory/main-functions/subtitle-analysis/ui/edit-panels.ts",
    "utf8"
  );

  assert.match(uiSource, /shared\/ui\/copy-runtime\.js/);
  assert.match(copyRuntimeSource, /function subtitleText\(path, trFallback, enFallback\)/);
  assert.match(uiSource, /main-functions\/subtitle-analysis\/ui\/runtime\.js/);
  assert.match(uiSource, /\.\/view-bindings-runtime\.js/);
  assert.match(subtitleAnalysisUiRuntimeSource, /\.\.\/\.\.\/\.\.\/ui\/subtitle-panel-runtime\.js/);
  assert.match(subtitleAnalysisUiRuntimeSource, /function renderSubtitleDiscoveryPanel\(\)/);
  assert.match(subtitleAnalysisUiRuntimeSource, /function renderSubtitleEditStage\(\)/);
  assert.match(subtitleModuleSource, /from "\.\/source-panels\.js"/);
  assert.match(subtitleModuleSource, /from "\.\/edit-panels\.js"/);
  assert.match(subtitleSourcePanelsSource, /from "\.\/source-panel-intake\.js"/);
  assert.match(subtitleSourcePanelsSource, /from "\.\/source-panel-workspace\.js"/);
  assert.match(subtitleSourceWorkspaceSource, /data-action="subtitle-source-select-all-discovery"/);
  assert.match(subtitleSourceWorkspaceSource, /data-action="subtitle-source-clear-discovery-selection"/);
  assert.match(subtitleSourceWorkspaceSource, /data-action="subtitle-source-toggle-discovery"/);
  assert.match(subtitleSourceWorkspaceSource, /Candidate Table/);
  assert.match(subtitleSourceIntakeSource, /data-action="subtitle-source-download-youtube"/);
  assert.match(subtitleEditPanelsSource, /renderEditSelectField\("outputFormat"/);
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
