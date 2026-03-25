import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

test("laboratory host composes and exports report artifacts from persisted process state", () => {
  const hostSource = readFileSync("rooms/laboratory/host/index.js", "utf8");

  assert.match(hostSource, /function createEmptyReportState\(\)/);
  assert.match(hostSource, /function getProjectReportDir\(runtime, project\)/);
  assert.match(hostSource, /function buildReportManifest\(project\)/);
  assert.match(hostSource, /function composeFeatureReport\(runtime, project, featureId\)/);
  assert.match(hostSource, /function buildReportMarkdown\(runtime, project, featureId, reportRecord\)/);
  assert.match(hostSource, /function exportFeatureReport\(api, runtime, requestId, featureId\)/);
  assert.match(hostSource, /case "report-export":/);
  assert.match(hostSource, /case "audio-report-export":/);
  assert.match(hostSource, /setFeatureReportRecord\(nextProject, featureId/);
});

test("laboratory UI renders report findings and export history from room-managed snapshots", () => {
  const uiSource = readFileSync("rooms/laboratory/ui/index.js", "utf8");

  assert.match(uiSource, /function renderReportStage\(\)/);
  assert.match(uiSource, /function getCurrentFeatureReportRecord\(\)/);
  assert.match(uiSource, /function getReportJobs\(\)/);
  assert.match(uiSource, /function getReportExports\(\)/);
  assert.match(uiSource, /function renderReportFinding\(signal\)/);
  assert.match(uiSource, /data-action="export-report"/);
  assert.match(uiSource, /featureText\(\["report", "actions", "export"\]\)/);
  assert.match(uiSource, /featureText\(\["report", "stagedHint"\]\)/);
});

test("laboratory translations and tool metadata describe the closeout report stage honestly", () => {
  const english = JSON.parse(readFileSync("rooms/laboratory/i18n/en.json", "utf8"));
  const turkish = JSON.parse(readFileSync("rooms/laboratory/i18n/tr.json", "utf8"));
  const toolchain = JSON.parse(readFileSync("rooms/laboratory/tools/toolchain.manifest.json", "utf8"));

  assert.equal(english.mediaAnalysis.settings.noStageTools, "This stage does not require a dedicated room-managed tool.");
  assert.equal(turkish.mediaAnalysis.settings.noStageTools, "Bu asama icin ayrica yonetilen bir arac gerekmiyor.");
  assert.match(String(english.mediaAnalysis.report.subtitle || ""), /process results/i);
  assert.match(String(turkish.mediaAnalysis.report.subtitle || ""), /islem sonucunu/i);
  assert.equal(toolchain.tools.ffmpeg.stageSupport.report, "unsupported");
  assert.equal(toolchain.tools["whisper.cpp"].stageSupport.report, "unsupported");
  assert.equal(toolchain.tools["yt-dlp"].stageSupport.report, "unsupported");
});
