import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

test("laboratory host composes and exports report artifacts from persisted process state", () => {
  const uiSource = readFileSync("rooms/laboratory/ui/laboratory-ui-runtime.ts", "utf8");
  const profileProcessReportRuntimeSource = readFileSync(
    "rooms/laboratory/ui/profile-process-report-runtime.ts",
    "utf8"
  );
  const profileProcessReportCompositionSource = readFileSync(
    "rooms/laboratory/ui/profile-process-report-composition.ts",
    "utf8"
  );
  const profileProcessReportCompositionSharedSource = readFileSync(
    "rooms/laboratory/shared/ui/profile-process-report-composition.ts",
    "utf8"
  );
  const reportStageSource = readFileSync("rooms/laboratory/shared/ui/report-stage.ts", "utf8");

  assert.match(uiSource, /shared\/ui\/profile-process-report-composition\.js/);
  assert.match(
    profileProcessReportRuntimeSource,
    /export function createLaboratoryProfileProcessReportRuntime(?:<[\s\S]+?>)?\s*\(/
  );
  assert.match(
    profileProcessReportCompositionSource,
    /export \{ createLaboratoryProfileProcessReportComposition \} from "\.\.\/shared\/ui\/profile-process-report-composition\.js";/
  );
  assert.match(
    profileProcessReportCompositionSharedSource,
    /export function createLaboratoryProfileProcessReportComposition\(deps\)/
  );
  assert.match(reportStageSource, /data-action="export-report"/);
  assert.match(reportStageSource, /featureText\(\["report", "actions", "export"\]\)/);
  assert.match(reportStageSource, /featureText\(\["report", "stagedHint"\]\)/);
});

test("laboratory UI renders report findings and export history from room-managed snapshots", () => {
  const uiSource = readFileSync("rooms/laboratory/ui/laboratory-ui-runtime.ts", "utf8");
  const profileProcessReportRuntimeSource = readFileSync(
    "rooms/laboratory/ui/profile-process-report-runtime.ts",
    "utf8"
  );
  const runtimeCompositionSource = readFileSync(
    "rooms/laboratory/ui/runtime-composition.ts",
    "utf8"
  );
  const stageAccessorsRuntimeSource = readFileSync(
    "rooms/laboratory/ui/stage-accessors-runtime.ts",
    "utf8"
  );
  const viewBindingsRuntimeSource = readFileSync(
    "rooms/laboratory/ui/view-bindings-runtime.ts",
    "utf8"
  );
  const shellCompositionSource = readFileSync("rooms/laboratory/ui/shell-composition.ts", "utf8");
  const viewAccessorsRuntimeSource = readFileSync(
    "rooms/laboratory/ui/view-accessors-runtime.ts",
    "utf8"
  );
  const reportStageSource = readFileSync("rooms/laboratory/shared/ui/report-stage.ts", "utf8");
  assert.match(uiSource, /shared\/ui\/report-stage\.js/);
  assert.match(uiSource, /shared\/ui\/shell-runtime\.js/);
  assert.match(uiSource, /\.\/shell-composition\.js/);
  assert.match(uiSource, /\.\/profile-process-report-runtime\.js/);
  assert.match(uiSource, /\.\/runtime-composition\.js/);
  assert.match(runtimeCompositionSource, /\.\/stage-accessors-runtime\.js/);
  assert.match(uiSource, /\.\/view-bindings-runtime\.js/);
  assert.match(
    shellCompositionSource,
    /renderReportStage: laboratoryStageShellDelegates\.renderReportStage,/
  );
  assert.match(viewAccessorsRuntimeSource, /function getCurrentFeatureReportRecord\(\)/);
  assert.match(viewBindingsRuntimeSource, /getCurrentFeatureReportRecord: function \(\)/);
  assert.match(stageAccessorsRuntimeSource, /function getReportJobs\(\)/);
  assert.match(stageAccessorsRuntimeSource, /function getReportExports\(\)/);
  assert.match(
    profileProcessReportRuntimeSource,
    /export function createLaboratoryProfileProcessReportRuntime(?:<[\s\S]+?>)?\s*\(/
  );
  assert.match(
    profileProcessReportRuntimeSource,
    /function renderReportFinding\(signal(?:: [^)]+)?\)/
  );
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
