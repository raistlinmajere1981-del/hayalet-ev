import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

test("laboratory host composes and exports report artifacts from persisted process state", () => {
  const hostSource = readFileSync("rooms/laboratory/host/index.js", "utf8");
  const actionRouterSource = readFileSync("rooms/laboratory/shared/host/action-router.js", "utf8");
  const processReportStateSource = readFileSync(
    "rooms/laboratory/shared/host/process-report-state.js",
    "utf8"
  );
  const processRuntimeSource = readFileSync("rooms/laboratory/shared/host/process-runtime.js", "utf8");
  const reportingSource = readFileSync("rooms/laboratory/shared/host/reporting.js", "utf8");

  assert.match(processReportStateSource, /function createEmptyReportState\(\)/);
  assert.match(hostSource, /function getProjectReportDir\(runtime, project\)/);
  assert.match(hostSource, /function buildReportManifest\(project\)/);
  assert.match(hostSource, /function composeFeatureReport\(runtime, project, featureId\)/);
  assert.match(hostSource, /function buildReportMarkdown\(runtime, project, featureId, reportRecord\)/);
  assert.match(hostSource, /function exportFeatureReport\(api, runtime, requestId, featureId\)/);
  assert.match(hostSource, /shared\/host\/action-router\.js/);
  assert.match(hostSource, /shared\/host\/process-report-state\.js/);
  assert.match(hostSource, /shared\/host\/process-runtime\.js/);
  assert.match(hostSource, /shared\/host\/reporting\.js/);
  assert.match(hostSource, /const laboratoryReportingRuntime = createLaboratoryReportingRuntime\(/);
  assert.match(hostSource, /const laboratoryActionRouter = createLaboratoryActionRouter\(/);
  assert.match(processRuntimeSource, /setFeatureReportRecord\(nextProject, featureId/);
  assert.match(reportingSource, /function composeFeatureReport\(runtime, project, featureId\)/);
  assert.match(reportingSource, /function buildReportMarkdown\(runtime, project, featureId, reportRecord\)/);
  assert.match(reportingSource, /async function exportFeatureReport\(api, runtime, requestId, featureId\)/);
  assert.match(actionRouterSource, /case "report-export":/);
  assert.match(actionRouterSource, /case "audio-report-export":/);
  assert.match(processRuntimeSource, /setFeatureReportRecord\(nextProject, featureId/);
});

test("laboratory UI renders report findings and export history from room-managed snapshots", () => {
  const uiSource = readFileSync("rooms/laboratory/ui/index.js", "utf8");
  const reportStageSource = readFileSync("rooms/laboratory/shared/ui/report-stage.js", "utf8");

  assert.match(uiSource, /function renderReportStage\(\)/);
  assert.match(uiSource, /shared\/ui\/report-stage\.js/);
  assert.match(uiSource, /function getCurrentFeatureReportRecord\(\)/);
  assert.match(uiSource, /function getReportJobs\(\)/);
  assert.match(uiSource, /function getReportExports\(\)/);
  assert.match(uiSource, /function renderReportFinding\(signal\)/);
  assert.match(reportStageSource, /data-action="export-report"/);
  assert.match(reportStageSource, /featureText\(\["report", "actions", "export"\]\)/);
  assert.match(reportStageSource, /featureText\(\["report", "stagedHint"\]\)/);
});

test("laboratory translations and tool metadata describe the closeout report stage honestly", () => {
  const english = JSON.parse(readFileSync("rooms/laboratory/i18n/en.json", "utf8"));
  const turkish = JSON.parse(readFileSync("rooms/laboratory/i18n/tr.json", "utf8"));
  const toolchain = JSON.parse(readFileSync("rooms/laboratory/shared/data/tools/toolchain.manifest.json", "utf8"));

  assert.equal(english.mediaAnalysis.settings.noStageTools, "This stage does not require a dedicated room-managed tool.");
  assert.equal(turkish.mediaAnalysis.settings.noStageTools, "Bu asama icin ayrica yonetilen bir arac gerekmiyor.");
  assert.match(String(english.mediaAnalysis.report.subtitle || ""), /process results/i);
  assert.match(String(turkish.mediaAnalysis.report.subtitle || ""), /islem sonucunu/i);
  assert.equal(toolchain.tools.ffmpeg.stageSupport.report, "unsupported");
  assert.equal(toolchain.tools["whisper.cpp"].stageSupport.report, "unsupported");
  assert.equal(toolchain.tools["yt-dlp"].stageSupport.report, "unsupported");
});
