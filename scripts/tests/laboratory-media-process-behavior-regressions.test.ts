import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

test("laboratory project schema persists process and report branches", () => {
  const schema = JSON.parse(readFileSync("rooms/laboratory/tools/project-schema.json", "utf8"));

  assert.equal(Array.isArray(schema.project?.required), true);
  assert.equal(schema.project.required.includes("process"), true);
  assert.equal(schema.project.required.includes("report"), true);
  assert.deepEqual(schema.process, undefined);
  assert.equal(Array.isArray(schema.project?.process?.records?.["media-analysis"]?.required), true);
  assert.equal(Array.isArray(schema.project?.report?.records?.["media-analysis"]?.required), true);
  assert.equal(schema.files?.processDir, "derived/process");
  assert.equal(schema.files?.processManifest, "derived/process/manifest.json");
  assert.equal(schema.files?.reportDir, "reports");
  assert.equal(schema.files?.reportManifest, "reports/manifest.json");
});

test("laboratory host keeps process orchestration on the shared room-managed contract", () => {
  const hostSource = readFileSync("rooms/laboratory/host/index.js", "utf8");

  assert.match(hostSource, /function createEmptyProcessState\(\)/);
  assert.match(hostSource, /function getProjectProcessDir\(runtime, project\)/);
  assert.match(hostSource, /function buildProcessManifest\(project\)/);
  assert.match(hostSource, /function runManagedProcess\(runtime, project, requestId, jobId, featureId\)/);
  assert.match(hostSource, /function runFeatureProcess\(api, runtime, requestId, featureId\)/);
  assert.match(hostSource, /function cancelFeatureProcess\(api, runtime, requestId, featureId\)/);
  assert.match(hostSource, /function markCloseoutAsStale\(project, reason, featureIds\)/);
  assert.match(hostSource, /case "process-run":/);
  assert.match(hostSource, /case "audio-process-run":/);
  assert.match(hostSource, /case "process-cancel":/);
  assert.match(hostSource, /case "audio-process-cancel":/);
  assert.match(hostSource, /setFeatureProcessRecord\(nextProject, featureId/);
});

test("laboratory UI renders the process stage from host-backed state and honest stage tools", () => {
  const uiSource = readFileSync("rooms/laboratory/ui/index.js", "utf8");
  const toolchain = JSON.parse(readFileSync("rooms/laboratory/tools/toolchain.manifest.json", "utf8"));

  assert.match(uiSource, /function renderProcessStage\(\)/);
  assert.match(uiSource, /function getCurrentFeatureProcessRecord\(\)/);
  assert.match(uiSource, /function getProcessJobs\(\)/);
  assert.match(uiSource, /data-action="restart-process"/);
  assert.match(uiSource, /data-action="process-cancel"/);
  assert.match(uiSource, /data-action="open-report"/);
  assert.match(uiSource, /currentStageToolIds = getStageToolIds\(stageId\);/);
  assert.match(uiSource, /text\(\["mediaAnalysis", "settings", "noStageTools"\]\)/);
  assert.doesNotMatch(uiSource, /return stageToolIds\.length > 0 \? stageToolIds : allToolIds;/);
  assert.equal(toolchain.tools.ffmpeg.stageSupport.process, "required");
  assert.equal(toolchain.tools["whisper.cpp"].stageSupport.process, "optional");
  assert.equal(toolchain.tools["yt-dlp"].stageSupport.process, "unsupported");
});
