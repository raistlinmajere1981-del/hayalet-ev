import test from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";

test("subtitle YouTube descriptor exposes discovery-first filters", () => {
  const form = JSON.parse(readFileSync("rooms/laboratory/tools/subtitle-youtube.form.json", "utf8"));
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

  assert.match(hostSource, /function createEmptySubtitleDiscoveryState\(\)/);
  assert.match(hostSource, /selectedCandidateIds/);
  assert.match(hostSource, /function handleSubtitleYoutubeDiscovery\(api, runtime, requestId\)/);
  assert.match(hostSource, /Run discovery and select at least one video before downloading subtitles\./);
  assert.match(hostSource, /function resolveSubtitleOutputFormat\(sourceFormat, outputFormatValue\)/);
  assert.match(hostSource, /function serializeSubtitleCueModel\(cues, format\)/);
  assert.match(hostSource, /outputFormat: "source"/);
});

test("subtitle UI renders discovery table controls and output format selection", () => {
  const uiSource = readFileSync("rooms/laboratory/ui/index.js", "utf8");

  assert.match(uiSource, /function subtitleText\(path, trFallback, enFallback\)/);
  assert.match(uiSource, /function renderSubtitleDiscoveryPanel\(\)/);
  assert.match(uiSource, /function getSubtitleProcessModuleLabel\(entry\)/);
  assert.match(uiSource, /function getSubtitleProviderLabel\(entry\)/);
  assert.match(uiSource, /data-action="subtitle-source-select-all-discovery"/);
  assert.match(uiSource, /data-action="subtitle-source-clear-discovery-selection"/);
  assert.match(uiSource, /data-action="subtitle-source-toggle-discovery"/);
  assert.match(uiSource, /Candidate Table/);
  assert.match(uiSource, /renderEditSelectField\("outputFormat"/);
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
