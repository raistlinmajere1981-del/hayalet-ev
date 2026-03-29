import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

test("subtitle host composes richer report summary cards and markdown exports", () => {
  const hostSource = readFileSync("rooms/laboratory/host/index.ts", "utf8");
  const hostRuntimeSource = readFileSync("rooms/laboratory/host/runtime.ts", "utf8");
  const hostFeatureSource = readFileSync("rooms/laboratory/host/feature-runtimes.ts", "utf8");
  const processCompositionSource = readFileSync(
    "rooms/laboratory/shared/host/process-composition.ts",
    "utf8"
  );
  const processDelegatesSource = readFileSync("rooms/laboratory/shared/host/process-delegates.ts", "utf8");
  const reportingSource = readFileSync("rooms/laboratory/shared/host/reporting.ts", "utf8");
  const reportingFeatureSource = readFileSync(
    "rooms/laboratory/shared/host/reporting-feature-report.ts",
    "utf8"
  );
  const reportingSubtitleSource = readFileSync(
    "rooms/laboratory/shared/host/reporting-subtitle.ts",
    "utf8"
  );
  const reportingMarkdownSource = readFileSync(
    "rooms/laboratory/shared/host/reporting-markdown.ts",
    "utf8"
  );

  assert.match(hostSource, /\.\/runtime\.js/);
  assert.match([hostRuntimeSource, hostFeatureSource].join("\n"), /shared\/host\/process-composition\.js/);
  assert.match(processCompositionSource, /from "\.\/process-delegates\.js"/);
  assert.match(processCompositionSource, /from "\.\/reporting\.js"/);
  assert.match(processDelegatesSource, /function composeSubtitleAnalysisReport\(runtime, project\)/);
  assert.match(reportingSource, /from "\.\/reporting-feature-report\.js"/);
  assert.match(reportingFeatureSource, /from "\.\/reporting-subtitle\.js"/);
  assert.match(reportingFeatureSource, /from "\.\/reporting-markdown\.js"/);
  assert.match(reportingSubtitleSource, /subtitleAnalysis\.report\.summaryCards\.target/);
  assert.match(reportingSubtitleSource, /subtitleAnalysis\.report\.summaryCards\.cues/);
  assert.match(reportingSubtitleSource, /subtitleAnalysis\.report\.summaryCards\.topTerm/);
  assert.match(reportingMarkdownSource, /## Warnings/);
  assert.match(reportingMarkdownSource, /## Exports/);
});

test("subtitle UI renders report module rollup and export history panels", () => {
  const uiSource = readFileSync("rooms/laboratory/ui/laboratory-ui-runtime.ts", "utf8");
  const reportStageSource = readFileSync("rooms/laboratory/shared/ui/report-stage.ts", "utf8");
  const reportStageSupportSource = readFileSync(
    "rooms/laboratory/shared/ui/report-stage-support.ts",
    "utf8"
  );
  const reportStageSubtitleSource = readFileSync(
    "rooms/laboratory/shared/ui/report-stage-subtitle.ts",
    "utf8"
  );

  assert.match(uiSource, /shared\/ui\/report-stage\.js/);
  assert.match(reportStageSource, /\.\/report-stage-support\.js/);
  assert.match(reportStageSource, /\.\/report-stage-subtitle\.js/);
  assert.match(reportStageSource, /function renderSubtitleReportModuleGrid\(\)/);
  assert.match(reportStageSource, /function renderSubtitleReportExportHistoryPanel\(\)/);
  assert.match(reportStageSource, /function getReportOverviewRows\(reportRecord, findings, asset\)/);
  assert.match(
    reportStageSupportSource,
    /export function createLaboratoryReportStageSupportRuntime\(deps\)/
  );
  assert.match(
    reportStageSubtitleSource,
    /export function createLaboratorySubtitleReportStageRuntime\(deps\)/
  );
  assert.match(reportStageSubtitleSource, /featureText\(\["report", "moduleRollupTitle"\]\)/);
  assert.match(reportStageSubtitleSource, /featureText\(\["report", "exportHistoryTitle"\]\)/);
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
