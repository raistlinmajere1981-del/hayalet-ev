import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

test("subtitle host composes richer report summary cards and markdown exports", () => {
  const hostSource = readFileSync("rooms/laboratory/host/index.js", "utf8");
  const hostRuntimeSource = readFileSync("rooms/laboratory/host/runtime.js", "utf8");
  const processCompositionSource = readFileSync(
    "rooms/laboratory/shared/host/process-composition.js",
    "utf8"
  );
  const processDelegatesSource = readFileSync("rooms/laboratory/shared/host/process-delegates.js", "utf8");
  const reportingSource = readFileSync("rooms/laboratory/shared/host/reporting.js", "utf8");

  assert.match(hostSource, /\.\/runtime\.js/);
  assert.match(hostRuntimeSource, /shared\/host\/process-composition\.js/);
  assert.match(processCompositionSource, /from "\.\/process-delegates\.js"/);
  assert.match(processCompositionSource, /from "\.\/reporting\.js"/);
  assert.match(processDelegatesSource, /function composeSubtitleAnalysisReport\(runtime, project\)/);
  assert.match(reportingSource, /subtitleAnalysis\.report\.summaryCards\.target/);
  assert.match(reportingSource, /subtitleAnalysis\.report\.summaryCards\.cues/);
  assert.match(reportingSource, /subtitleAnalysis\.report\.summaryCards\.topTerm/);
  assert.match(reportingSource, /## Warnings/);
  assert.match(reportingSource, /## Exports/);
});

test("subtitle UI renders report module rollup and export history panels", () => {
  const uiSource = readFileSync("rooms/laboratory/ui/laboratory-ui-runtime.js", "utf8");
  const reportStageSource = readFileSync("rooms/laboratory/shared/ui/report-stage.js", "utf8");

  assert.match(uiSource, /shared\/ui\/report-stage\.js/);
  assert.match(reportStageSource, /function renderSubtitleReportModuleGrid\(\)/);
  assert.match(reportStageSource, /function renderSubtitleReportExportHistoryPanel\(\)/);
  assert.match(reportStageSource, /function getReportOverviewRows\(reportRecord, findings, asset\)/);
  assert.match(reportStageSource, /featureText\(\["report", "moduleRollupTitle"\]\)/);
  assert.match(reportStageSource, /featureText\(\["report", "exportHistoryTitle"\]\)/);
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
