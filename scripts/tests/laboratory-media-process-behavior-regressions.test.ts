import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

test("laboratory project schema persists process and report branches", () => {
  const schema = JSON.parse(readFileSync("rooms/laboratory/shared/data/tools/project-schema.json", "utf8"));

  assert.equal(Array.isArray(schema.project?.required), true);
  assert.equal(schema.project.required.includes("process"), true);
  assert.equal(schema.project.required.includes("report"), true);
  assert.deepEqual(schema.process, undefined);
  assert.equal(Array.isArray(schema.project?.process?.records?.["media-analysis"]?.required), true);
  assert.equal(Array.isArray(schema.project?.report?.records?.["media-analysis"]?.required), true);
  assert.equal(schema.files?.processDir, "main-functions/media-analysis/process");
  assert.equal(schema.files?.processManifest, "main-functions/media-analysis/process/manifest.json");
  assert.equal(schema.files?.reportDir, "main-functions/media-analysis/report");
  assert.equal(schema.files?.reportManifest, "main-functions/media-analysis/report/manifest.json");
  assert.equal(schema.files?.mainFunctions?.["audio-analysis"]?.processDir, "main-functions/audio-analysis/process");
  assert.equal(schema.files?.mainFunctions?.["audio-analysis"]?.reportDir, "main-functions/audio-analysis/report");
  assert.equal(schema.files?.mainFunctions?.["subtitle-analysis"]?.editDir, "main-functions/subtitle-analysis/edit");
  assert.equal(schema.files?.legacy?.processDir, "derived/process");
  assert.equal(schema.files?.legacy?.reportDir, "reports");
});

test("laboratory host keeps process orchestration on the shared room-managed contract", () => {
  const hostSource = readFileSync("rooms/laboratory/host/index.js", "utf8");
  const actionRouterSource = readFileSync("rooms/laboratory/shared/host/action-router.js", "utf8");
  const processReportStateSource = readFileSync(
    "rooms/laboratory/shared/host/process-report-state.js",
    "utf8"
  );
  const processRuntimeSource = readFileSync("rooms/laboratory/shared/host/process-runtime.js", "utf8");
  const processTargetingSource = readFileSync("rooms/laboratory/shared/host/process-targeting.js", "utf8");
  const roomToolsProgressSource = readFileSync("rooms/laboratory/shared/host/room-tools-progress.js", "utf8");
  const reportingSource = readFileSync("rooms/laboratory/shared/host/reporting.js", "utf8");

  assert.match(processReportStateSource, /function createEmptyProcessState\(\)/);
  assert.match(hostSource, /function getProjectProcessDir\(runtime, project\)/);
  assert.match(hostSource, /function getFeatureProcessDir\(runtime, project, featureId\)/);
  assert.match(hostSource, /function getFeatureReportDir\(runtime, project, featureId\)/);
  assert.match(hostSource, /function buildProcessManifest\(project\)/);
  assert.match(hostSource, /function runManagedProcess\(runtime, project, requestId, jobId, featureId\)/);
  assert.match(hostSource, /function runFeatureProcess\(api, runtime, requestId, featureId\)/);
  assert.match(hostSource, /function cancelFeatureProcess\(api, runtime, requestId, featureId\)/);
  assert.match(hostSource, /function markCloseoutAsStale\(project, reason, featureIds\)/);
  assert.match(hostSource, /const outputDir = getFeatureProcessDir\(runtime, project, featureId\);/);
  assert.match(hostSource, /shared\/host\/action-router\.js/);
  assert.match(hostSource, /shared\/host\/process-report-state\.js/);
  assert.match(hostSource, /shared\/host\/process-runtime\.js/);
  assert.match(hostSource, /shared\/host\/process-targeting\.js/);
  assert.match(hostSource, /shared\/host\/room-tools-progress\.js/);
  assert.match(hostSource, /shared\/host\/reporting\.js/);
  assert.match(processRuntimeSource, /export function createLaboratoryProcessRuntime/);
  assert.match(processTargetingSource, /export function createLaboratoryProcessTargetingRuntime/);
  assert.match(processTargetingSource, /function buildProcessSpeechAvailability\(runtime, project\)/);
  assert.match(roomToolsProgressSource, /export function createLaboratoryRoomToolsProgressRuntime/);
  assert.match(roomToolsProgressSource, /function updateJobFromProgress\(runtime, eventPayload\)/);
  assert.match(processRuntimeSource, /async function runManagedProcess/);
  assert.match(processRuntimeSource, /async function runFeatureProcess/);
  assert.match(reportingSource, /const outputPath = `\$\{getFeatureReportDir\(runtime, project, featureId\)\}\/\$\{fileName\}`;/);
  assert.match(actionRouterSource, /case "process-run":/);
  assert.match(actionRouterSource, /case "audio-process-run":/);
  assert.match(actionRouterSource, /case "process-cancel":/);
  assert.match(actionRouterSource, /case "audio-process-cancel":/);
  assert.match(processRuntimeSource, /setFeatureProcessRecord\(nextProject, featureId/);
});

test("laboratory UI renders the process stage from host-backed state and honest stage tools", () => {
  const uiSource = readFileSync("rooms/laboratory/ui/index.js", "utf8");
  const processStageSource = readFileSync("rooms/laboratory/shared/ui/process-stage.js", "utf8");
  const settingsOverlaySource = readFileSync("rooms/laboratory/shared/ui/settings-overlay.js", "utf8");
  const toolchain = JSON.parse(readFileSync("rooms/laboratory/shared/data/tools/toolchain.manifest.json", "utf8"));

  assert.match(uiSource, /function renderProcessStage\(\)/);
  assert.match(uiSource, /shared\/ui\/process-stage\.js/);
  assert.match(uiSource, /function getCurrentFeatureProcessRecord\(\)/);
  assert.match(uiSource, /function getProcessJobs\(\)/);
  assert.match(processStageSource, /data-action="restart-process"/);
  assert.match(processStageSource, /data-action="process-cancel"/);
  assert.match(processStageSource, /data-action="open-report"/);
  assert.match(settingsOverlaySource, /currentStageToolIds = getStageToolIds\(stageId\);/);
  assert.match(settingsOverlaySource, /text\(\["mediaAnalysis", "settings", "noStageTools"\]\)/);
  assert.doesNotMatch(uiSource, /return stageToolIds\.length > 0 \? stageToolIds : allToolIds;/);
  assert.equal(toolchain.tools.ffmpeg.stageSupport.process, "required");
  assert.equal(toolchain.tools["whisper.cpp"].stageSupport.process, "optional");
  assert.equal(toolchain.tools["yt-dlp"].stageSupport.process, "unsupported");
});
