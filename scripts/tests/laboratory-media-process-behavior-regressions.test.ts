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
  const hostSource = readFileSync("rooms/laboratory/host/index.ts", "utf8");
  const hostRuntimeSource = readFileSync("rooms/laboratory/host/runtime.ts", "utf8");
  const hostFoundationSource = readFileSync("rooms/laboratory/host/foundation-runtimes.ts", "utf8");
  const hostProjectSource = readFileSync("rooms/laboratory/host/project-runtimes.ts", "utf8");
  const hostFeatureSource = readFileSync("rooms/laboratory/host/feature-runtimes.ts", "utf8");
  const featureAdaptersSource = readFileSync("rooms/laboratory/host/feature-adapters.ts", "utf8");
  const actionRouterSource = readFileSync("rooms/laboratory/shared/host/action-router.ts", "utf8");
  const actionCompositionSource = readFileSync("rooms/laboratory/shared/host/action-composition.ts", "utf8");
  const actionRuntimeSource = readFileSync("rooms/laboratory/shared/host/action-runtime.ts", "utf8");
  const projectManifestSource = readFileSync(
    "rooms/laboratory/shared/host/project-manifests.ts",
    "utf8"
  );
  const snapshotCompositionSource = readFileSync(
    "rooms/laboratory/shared/host/snapshot-composition.ts",
    "utf8"
  );
  const stateCompositionSource = readFileSync(
    "rooms/laboratory/shared/host/state-composition.ts",
    "utf8"
  );
  const processReportStateSource = readFileSync(
    "rooms/laboratory/shared/host/process-report-state.ts",
    "utf8"
  );
  const closeoutStalenessSource = readFileSync(
    "rooms/laboratory/shared/host/closeout-staleness.ts",
    "utf8"
  );
  const processCoordinationSource = readFileSync(
    "rooms/laboratory/shared/host/process-coordination.ts",
    "utf8"
  );
  const processManagedRunnersSource = readFileSync(
    "rooms/laboratory/shared/host/process-managed-runners.ts",
    "utf8"
  );
  const processManagedAudioRunnerSource = readFileSync(
    "rooms/laboratory/shared/host/process-managed-audio-runner.ts",
    "utf8"
  );
  const processManagedMediaRunnerSource = readFileSync(
    "rooms/laboratory/shared/host/process-managed-media-runner.ts",
    "utf8"
  );
  const processManagedSubtitleRunnerSource = readFileSync(
    "rooms/laboratory/shared/host/process-managed-subtitle-runner.ts",
    "utf8"
  );
  const processRuntimeSource = readFileSync("rooms/laboratory/shared/host/process-runtime.ts", "utf8");
  const processTargetingSource = readFileSync("rooms/laboratory/shared/host/process-targeting.ts", "utf8");
  const roomToolsProgressSource = readFileSync("rooms/laboratory/shared/host/room-tools-progress.ts", "utf8");
  const processDelegatesSource = readFileSync("rooms/laboratory/shared/host/process-delegates.ts", "utf8");
  const processCompositionSource = readFileSync(
    "rooms/laboratory/shared/host/process-composition.ts",
    "utf8"
  );
  const runtimePrimitivesSource = readFileSync(
    "rooms/laboratory/shared/host/runtime-primitives.ts",
    "utf8"
  );
  const audioAnalysisHostRuntimeSource = readFileSync(
    "rooms/laboratory/main-functions/audio-analysis/host/runtime.ts",
    "utf8"
  );
  const audioProcessDelegatesSource = readFileSync(
    "rooms/laboratory/shared/host/audio-process-delegates.ts",
    "utf8"
  );
  const reportingSource = readFileSync("rooms/laboratory/shared/host/reporting.ts", "utf8");
  const reportingExportSource = readFileSync(
    "rooms/laboratory/shared/host/reporting-export.ts",
    "utf8"
  );
  const hostCompositionSource = [
    hostRuntimeSource,
    hostFoundationSource,
    hostProjectSource,
    hostFeatureSource,
    featureAdaptersSource,
  ].join("\n");

  assert.match(processReportStateSource, /function createEmptyProcessState\(\)/);
  assert.match(hostSource, /\.\/runtime\.js/);
  assert.match(hostRuntimeSource, /shared\/host\/runtime-primitives\.js/);
  assert.match(runtimePrimitivesSource, /export function getLaboratoryProjectProcessDir\(runtime, project\)/);
  assert.match(runtimePrimitivesSource, /export function getLaboratoryFeatureProcessDir\(runtime, project, featureId\)/);
  assert.match(runtimePrimitivesSource, /export function getLaboratoryFeatureReportDir\(runtime, project, featureId\)/);
  assert.match(hostCompositionSource, /shared\/host\/snapshot-composition\.js/);
  assert.match(projectManifestSource, /function buildProcessManifest\(project\)/);
  assert.match(snapshotCompositionSource, /from "\.\/project-manifests\.js"/);
  assert.match(snapshotCompositionSource, /from "\.\/room-snapshot\.js"/);
  assert.match(snapshotCompositionSource, /from "\.\/runtime-events\.js"/);
  assert.match(hostCompositionSource, /shared\/host\/state-composition\.js/);
  assert.match(hostCompositionSource, /shared\/host\/action-composition\.js/);
  assert.match(hostCompositionSource, /shared\/host\/process-composition\.js/);
  assert.match(hostCompositionSource, /shared\/host\/room-tools-progress\.js/);
  assert.match(stateCompositionSource, /from "\.\/closeout-staleness\.js"/);
  assert.match(stateCompositionSource, /from "\.\/process-report-state\.js"/);
  assert.match(
    stateCompositionSource,
    /export function createLaboratoryHostStateCompositionRuntime\(deps\)/
  );
  assert.match(processCompositionSource, /from "\.\/process-coordination\.js"/);
  assert.match(processCompositionSource, /from "\.\/process-runtime\.js"/);
  assert.match(processCompositionSource, /from "\.\/process-targeting\.js"/);
  assert.match(processCompositionSource, /from "\.\/process-delegates\.js"/);
  assert.match(processCompositionSource, /from "\.\/reporting\.js"/);
  assert.match(processCompositionSource, /main-functions\/audio-analysis\/host\/runtime\.js/);
  assert.match(processCoordinationSource, /export function createLaboratoryProcessCoordinationRuntime/);
  assert.match(processCoordinationSource, /return processRuntime\.runManagedProcess\(runtime, project, requestId, jobId, featureId\);/);
  assert.match(processRuntimeSource, /export function createLaboratoryProcessRuntime/);
  assert.match(processRuntimeSource, /from "\.\/process-managed-runners\.js"/);
  assert.match(
    processRuntimeSource,
    /const laboratoryManagedProcessRunnersRuntime = createLaboratoryManagedProcessRunnersRuntime\(/
  );
  assert.match(
    processManagedRunnersSource,
    /export function createLaboratoryManagedProcessRunnersRuntime\(deps\)/
  );
  assert.match(processManagedRunnersSource, /from "\.\/process-managed-audio-runner\.js"/);
  assert.match(processManagedRunnersSource, /from "\.\/process-managed-media-runner\.js"/);
  assert.match(processManagedRunnersSource, /from "\.\/process-managed-subtitle-runner\.js"/);
  assert.match(
    processManagedAudioRunnerSource,
    /export function createLaboratoryManagedAudioRunnerRuntime\(deps\)/
  );
  assert.match(processManagedAudioRunnerSource, /async function runAudioManagedProcess/);
  assert.match(
    processManagedMediaRunnerSource,
    /export function createLaboratoryManagedMediaRunnerRuntime\(deps\)/
  );
  assert.match(processManagedMediaRunnerSource, /async function runMediaManagedProcess/);
  assert.match(
    processManagedSubtitleRunnerSource,
    /export function createLaboratoryManagedSubtitleRunnerRuntime\(deps\)/
  );
  assert.match(processManagedSubtitleRunnerSource, /async function runSubtitleManagedProcess/);
  assert.match(
    closeoutStalenessSource,
    /export function createLaboratoryCloseoutStalenessRuntime\(\s*deps(?::[\s\S]+?)?\s*\)/
  );
  assert.match(
    closeoutStalenessSource,
    /function markFeatureProcessStale\(\s*project\??(?::[\s\S]+?)?,\s*featureId\??(?::[\s\S]+?)?,\s*reason\??(?::[\s\S]+?)?\s*\)(?::[\s\S]+?)?/
  );
  assert.match(
    closeoutStalenessSource,
    /function markFeatureReportStale\(\s*project\??(?::[\s\S]+?)?,\s*featureId\??(?::[\s\S]+?)?,\s*reason\??(?::[\s\S]+?)?\s*\)(?::[\s\S]+?)?/
  );
  assert.match(processTargetingSource, /export function createLaboratoryProcessTargetingRuntime/);
  assert.match(processTargetingSource, /function buildProcessSpeechAvailability\(runtime, project\)/);
  assert.match(roomToolsProgressSource, /export function createLaboratoryRoomToolsProgressRuntime/);
  assert.match(
    roomToolsProgressSource,
    /function updateJobFromProgress\(\s*runtime\??(?::[\s\S]+?)?,\s*eventPayload\??(?::[\s\S]+?)?\s*\)(?::[\s\S]+?)?/
  );
  assert.match(processRuntimeSource, /async function runManagedProcess/);
  assert.match(processRuntimeSource, /async function runFeatureProcess/);
  assert.match(processRuntimeSource, /getFeatureProcessDir\(runtime, project, featureId\)/);
  assert.match(processDelegatesSource, /export function createLaboratoryProcessDelegatesRuntime/);
  assert.match(processDelegatesSource, /function runManagedProcess\(runtime, project, requestId, jobId, featureId\)/);
  assert.match(processDelegatesSource, /function runFeatureProcess\(api, runtime, requestId, featureId\)/);
  assert.match(processDelegatesSource, /function cancelFeatureProcess\(api, runtime, requestId, featureId\)/);
  assert.match(processCompositionSource, /composeFeatureReport\(\.\.\.args\) \{/);
  assert.match(actionCompositionSource, /export function createLaboratoryActionCompositionRuntime\(deps\)/);
  assert.match(actionCompositionSource, /from "\.\/action-runtime\.js"/);
  assert.match(actionCompositionSource, /from "\.\/tool-mutations\.js"/);
  assert.match(
    actionRuntimeSource,
    /export function createLaboratoryHostActionRuntime\(\s*deps(?::[\s\S]+?)?\s*\)/
  );
  assert.match(
    actionRuntimeSource,
    /function handleMediaAction\(\s*api\??(?::[\s\S]+?)?,\s*runtime\??(?::[\s\S]+?)?,\s*payload\??(?::[\s\S]+?)?\s*\)(?::[\s\S]+?)?/
  );
  assert.match(actionRuntimeSource, /from "\.\/action-router\.js"/);
  assert.match(audioAnalysisHostRuntimeSource, /shared\/host\/audio-process-delegates\.js/);
  assert.match(
    audioAnalysisHostRuntimeSource,
    /export function createLaboratoryAudioAnalysisHostRuntime\(deps\)/
  );
  assert.match(
    audioAnalysisHostRuntimeSource,
    /const laboratoryAudioProcessDelegatesRuntime = createLaboratoryAudioProcessDelegatesRuntime\(/
  );
  assert.match(audioProcessDelegatesSource, /export function createLaboratoryAudioProcessDelegatesRuntime/);
  assert.match(
    audioProcessDelegatesSource,
    /function getAudioAnalysisModuleProcessDir\(\s*runtime,\s*project,\s*moduleId,?\s*\)/
  );
  assert.match(audioProcessDelegatesSource, /function getAudioAnalysisModuleRunner\(moduleId\)/);
  assert.match(audioProcessDelegatesSource, /async function generateProcessSpectrogram\(/);
  assert.match(
    reportingExportSource,
    /const outputPath = `\$\{getFeatureReportDir\(runtime, project, featureId\)\}\/\$\{fileName\}`;/
  );
  assert.match(actionRouterSource, /case "process-run":/);
  assert.match(actionRouterSource, /case "audio-process-run":/);
  assert.match(actionRouterSource, /case "process-cancel":/);
  assert.match(actionRouterSource, /case "audio-process-cancel":/);
  assert.match(processRuntimeSource, /setFeatureProcessRecord\(nextProject, featureId/);
});

test("laboratory UI renders the process stage from host-backed state and honest stage tools", () => {
  const uiSource = readFileSync("rooms/laboratory/ui/laboratory-ui-runtime.ts", "utf8");
  const shellCompositionSource = readFileSync("rooms/laboratory/ui/shell-composition.ts", "utf8");
  const processStageSource = readFileSync("rooms/laboratory/shared/ui/process-stage.ts", "utf8");
  const settingsOverlaySource = readFileSync("rooms/laboratory/shared/ui/settings-overlay.ts", "utf8");
  const toolchain = JSON.parse(readFileSync("rooms/laboratory/shared/data/tools/toolchain.manifest.json", "utf8"));

  assert.match(uiSource, /shared\/ui\/process-stage\.js/);
  assert.match(uiSource, /shared\/ui\/shell-runtime\.js/);
  assert.match(uiSource, /\.\/shell-composition\.js/);
  assert.match(
    shellCompositionSource,
    /renderProcessStage: laboratoryStageShellDelegates\.renderProcessStage,/
  );
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
