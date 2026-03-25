import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

test("subtitle host composes richer report summary cards and markdown exports", () => {
  const hostSource = readFileSync("rooms/laboratory/host/index.js", "utf8");

  assert.match(hostSource, /function composeSubtitleAnalysisReport\(runtime, project\)/);
  assert.match(hostSource, /subtitleAnalysis\.report\.summaryCards\.target/);
  assert.match(hostSource, /subtitleAnalysis\.report\.summaryCards\.cues/);
  assert.match(hostSource, /subtitleAnalysis\.report\.summaryCards\.topTerm/);
  assert.match(hostSource, /## Warnings/);
  assert.match(hostSource, /## Exports/);
});

test("subtitle UI renders report module rollup and export history panels", () => {
  const uiSource = readFileSync("rooms/laboratory/ui/index.js", "utf8");

  assert.match(uiSource, /function renderSubtitleReportModuleGrid\(\)/);
  assert.match(uiSource, /function renderSubtitleReportExportHistoryPanel\(\)/);
  assert.match(uiSource, /function getReportOverviewRows\(reportRecord, findings, asset\)/);
  assert.match(uiSource, /featureText\(\["report", "moduleRollupTitle"\]\)/);
  assert.match(uiSource, /featureText\(\["report", "exportHistoryTitle"\]\)/);
});

test("subtitle translations describe the richer report stage", () => {
  const english = JSON.parse(readFileSync("rooms/laboratory/i18n/en.json", "utf8"));
  const turkish = JSON.parse(readFileSync("rooms/laboratory/i18n/tr.json", "utf8"));

  assert.equal(english.subtitleAnalysis.report.overviewTitle, "Subtitle Report Overview");
  assert.equal(turkish.subtitleAnalysis.report.overviewTitle, "Altyazi Raporu Ozeti");
  assert.equal(english.subtitleAnalysis.report.moduleRollupTitle, "Subtitle module status");
  assert.equal(turkish.subtitleAnalysis.report.moduleRollupTitle, "Altyazi modul durumu");
  assert.equal(english.subtitleAnalysis.report.exportHistoryTitle, "Generated report files");
  assert.equal(turkish.subtitleAnalysis.report.exportHistoryTitle, "Uretilen rapor dosyalari");
});
