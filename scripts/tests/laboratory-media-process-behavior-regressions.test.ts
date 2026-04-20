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
  assert.equal(Array.isArray(schema.project?.workbench?.optional), true);
  assert.equal(schema.project?.workbench?.optional?.includes("analysisScope"), true);
  assert.equal(
    schema.project?.process?.records?.["media-analysis"]?.optional?.includes("analysisScope"),
    true
  );
  assert.equal(
    schema.project?.report?.records?.["media-analysis"]?.optional?.includes("previewArtifacts"),
    true
  );
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
  assert.match(
    runtimePrimitivesSource,
    /export function getLaboratoryProjectProcessDir\(\s*runtime(?::[\s\S]+?)?,\s*project(?::[\s\S]+?)?\s*\)/
  );
  assert.match(
    runtimePrimitivesSource,
    /export function getLaboratoryFeatureProcessDir\(\s*runtime(?::[\s\S]+?)?,\s*project(?::[\s\S]+?)?,\s*featureId(?::[\s\S]+?)?\s*\)/
  );
  assert.match(
    runtimePrimitivesSource,
    /export function getLaboratoryFeatureReportDir\(\s*runtime(?::[\s\S]+?)?,\s*project(?::[\s\S]+?)?,\s*featureId(?::[\s\S]+?)?\s*\)/
  );
  assert.match(hostCompositionSource, /shared\/host\/snapshot-composition\.js/);
  assert.match(
    projectManifestSource,
    /function buildProcessManifest\(\s*project(?::[\s\S]+?)?\s*\)/
  );
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
    /export function createLaboratoryHostStateCompositionRuntime\(\s*deps(?::[\s\S]+?)?\s*\)/
  );
  assert.match(processCompositionSource, /from "\.\/process-coordination\.js"/);
  assert.match(processCompositionSource, /from "\.\/process-runtime\.js"/);
  assert.match(processCompositionSource, /from "\.\/process-targeting\.js"/);
  assert.match(processCompositionSource, /from "\.\/process-delegates\.js"/);
  assert.match(processCompositionSource, /from "\.\/reporting\.js"/);
  assert.match(processCompositionSource, /main-functions\/audio-analysis\/host\/runtime\.js/);
  assert.match(processCoordinationSource, /export function createLaboratoryProcessCoordinationRuntime/);
  assert.match(
    processCoordinationSource,
    /return \(processRuntime\["runManagedProcess"\] as UnknownFn\)\(\s*runtime,\s*project,\s*requestId,\s*jobId,\s*featureId\s*\);/
  );
  assert.match(processRuntimeSource, /export function createLaboratoryProcessRuntime/);
  assert.match(processRuntimeSource, /from "\.\/process-managed-runners\.js"/);
  assert.match(
    processRuntimeSource,
    /const laboratoryManagedProcessRunnersRuntime = createLaboratoryManagedProcessRunnersRuntime\(/
  );
  assert.match(
    processManagedRunnersSource,
    /export function createLaboratoryManagedProcessRunnersRuntime\(\s*deps(?::[\s\S]+?)?\s*\)/
  );
  assert.match(processManagedRunnersSource, /from "\.\/process-managed-audio-runner\.js"/);
  assert.match(processManagedRunnersSource, /from "\.\/process-managed-media-runner\.js"/);
  assert.match(processManagedRunnersSource, /from "\.\/process-managed-subtitle-runner\.js"/);
  assert.match(
    processManagedAudioRunnerSource,
    /export function createLaboratoryManagedAudioRunnerRuntime\(\s*deps(?::[\s\S]+?)?\s*\)/
  );
  assert.match(processManagedAudioRunnerSource, /async function runAudioManagedProcess/);
  assert.match(
    processManagedMediaRunnerSource,
    /export function createLaboratoryManagedMediaRunnerRuntime\(\s*deps(?::[\s\S]+?)?\s*\)/
  );
  assert.match(processManagedMediaRunnerSource, /async function runMediaManagedProcess/);
  assert.match(
    processManagedSubtitleRunnerSource,
    /export function createLaboratoryManagedSubtitleRunnerRuntime\(\s*deps(?::[\s\S]+?)?\s*\)/
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
  assert.match(
    processTargetingSource,
    /function resolveProcessRunFeatureIds\(\s*project(?::[\s\S]+?)?,\s*featureId(?::[\s\S]+?)?,\s*workbenchSource(?::[\s\S]+?)?\s*=\s*\{\}\s*\)/
  );
  assert.match(
    processTargetingSource,
    /function resolveProcessWorkbench\(\s*project(?::[\s\S]+?)?,\s*featureId(?::[\s\S]+?)?,\s*workbenchSource(?::[\s\S]+?)?\s*=\s*\{\}\s*\)/
  );
  assert.match(
    processTargetingSource,
    /function buildProcessSpeechAvailability\(\s*runtime(?::[\s\S]+?)?,\s*project(?::[\s\S]+?)?\s*\)/
  );
  assert.match(roomToolsProgressSource, /export function createLaboratoryRoomToolsProgressRuntime/);
  assert.match(
    roomToolsProgressSource,
    /function updateJobFromProgress\(\s*runtime\??(?::[\s\S]+?)?,\s*eventPayload\??(?::[\s\S]+?)?\s*\)(?::[\s\S]+?)?/
  );
  assert.match(processRuntimeSource, /async function runManagedProcess/);
  assert.match(processRuntimeSource, /async function runFeatureProcess/);
  assert.match(processRuntimeSource, /async function runSingleFeatureProcess/);
  assert.match(
    processRuntimeSource,
    /const runFeatureIds = resolveProcessRunFeatureIds\(project,\s*featureId,\s*workbenchSource\)/
  );
  assert.match(
    processRuntimeSource,
    /await runSingleFeatureProcess\(api,\s*runtime,\s*requestId,\s*nextFeatureId,\s*workbench\)/
  );
  assert.match(
    processRuntimeSource,
    /await cancelProcessJobsForProject\(api,\s*runtime,\s*project\["id"\] as string,\s*requestId\)/
  );
  assert.match(processRuntimeSource, /getFeatureProcessDir\(runtime, project, featureId\)/);
  assert.match(processDelegatesSource, /export function createLaboratoryProcessDelegatesRuntime/);
  assert.match(
    processDelegatesSource,
    /function runManagedProcess\(\s*runtime(?::[\s\S]+?)?,\s*project(?::[\s\S]+?)?,\s*requestId(?::[\s\S]+?)?,\s*jobId(?::[\s\S]+?)?,\s*featureId(?::[\s\S]+?)?\s*\)/
  );
  assert.match(
    processDelegatesSource,
    /function runFeatureProcess\(\s*api(?::[\s\S]+?)?,\s*runtime(?::[\s\S]+?)?,\s*requestId(?::[\s\S]+?)?,\s*featureId(?::[\s\S]+?)?,\s*workbenchSource\?(?::[\s\S]+?)?\s*\)/
  );
  assert.match(
    processDelegatesSource,
    /function cancelFeatureProcess\(\s*api(?::[\s\S]+?)?,\s*runtime(?::[\s\S]+?)?,\s*requestId(?::[\s\S]+?)?,\s*featureId(?::[\s\S]+?)?,\s*workbenchSource\?(?::[\s\S]+?)?\s*\)/
  );
  assert.match(
    processCompositionSource,
    /composeFeatureReport\(\s*\.\.\.args(?::[\s\S]+?)?\s*\)\s*\{/
  );
  assert.match(
    actionCompositionSource,
    /export function createLaboratoryActionCompositionRuntime\(\s*deps(?::[\s\S]+?)?\s*\)/
  );
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
    /export function createLaboratoryAudioAnalysisHostRuntime\(\s*deps(?::[\s\S]+?)?\s*\)/
  );
  assert.match(
    audioAnalysisHostRuntimeSource,
    /const laboratoryAudioProcessDelegatesRuntime = createLaboratoryAudioProcessDelegatesRuntime\(/
  );
  assert.match(audioProcessDelegatesSource, /export function createLaboratoryAudioProcessDelegatesRuntime/);
  assert.match(
    audioProcessDelegatesSource,
    /getAudioAnalysisModuleProcessDir:\s*audioAnalysisProcessRuntime\.getModuleProcessDir/
  );
  assert.match(
    audioProcessDelegatesSource,
    /getAudioAnalysisModuleRunner:\s*audioAnalysisProcessRuntime\.getModuleRunner/
  );
  assert.match(
    audioProcessDelegatesSource,
    /generateProcessSpectrogram:\s*audioAnalysisProcessRuntime\.generateProcessSpectrogram/
  );
  assert.match(
    hostFeatureSource,
    /generateProcessMetadataArtifact:\s*projectRuntimes\.analysisArtifact\.generateProcessMetadataArtifact,/
  );
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
  const settingsToolCardSource = readFileSync(
    "rooms/laboratory/shared/ui/settings-tool-card.ts",
    "utf8"
  );
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
  assert.match(processStageSource, /class="lab-process-panel__body"/);
  assert.match(settingsOverlaySource, /currentStageToolIds = getStageToolIds\(stageId\);/);
  assert.match(settingsOverlaySource, /lab-overlay--center/);
  assert.match(settingsOverlaySource, /aria-modal="true"/);
  assert.match(settingsOverlaySource, /lab-overlay__scrim/);
  assert.match(settingsOverlaySource, /text\(\["workbench", "dependencyOverview"\]\)/);
  assert.match(settingsOverlaySource, /text\(\["workbench", "toolGridTitle"\]\)/);
  assert.match(settingsToolCardSource, /const stageUnsupported = stageSupport === "unsupported";/);
  assert.match(settingsToolCardSource, /const unsupportedActionMarkup = `[\s\S]*support", "unsupported"/);
  assert.doesNotMatch(uiSource, /return stageToolIds\.length > 0 \? stageToolIds : allToolIds;/);
  assert.equal(toolchain.tools.ffmpeg.stageSupport.process, "required");
  assert.equal(toolchain.tools["whisper.cpp"].stageSupport.process, "optional");
  assert.equal(toolchain.tools["whisper.cpp"].systemCommand.executableName, "whisper-cli");
  assert.equal(
    toolchain.tools["whisper.cpp"].systemCommand.envVarNames.includes(
      "HAYALET_EV_TRANSCRIPT_WHISPER_BIN"
    ),
    true
  );
  assert.equal(
    toolchain.tools["whisper.cpp"].systemCommand.candidatePaths.includes(
      "${dataDir}/transcript/whisper.cpp-build/bin/whisper-cli"
    ),
    true
  );
  assert.equal(toolchain.tools["yt-dlp"].stageSupport.process, "unsupported");
});

test("laboratory dependency refresh guards missing metadata before reading duration fields", () => {
  const projectManifestSource = readFileSync(
    "rooms/laboratory/shared/host/project-manifests.ts",
    "utf8"
  );
  const profileProjectionSource = readFileSync(
    "rooms/laboratory/main-functions/media-analysis/host/profile-projection.ts",
    "utf8"
  );

  assert.match(
    projectManifestSource,
    /const metadata = toRecord\(normalizeSourceMetadata\(sourceRecord\.metadata\)\);/
  );
  assert.match(
    projectManifestSource,
    /const metadata = toRecord\(normalizeSourceMetadata\(entry\.metadata\)\);/
  );
  assert.match(
    profileProjectionSource,
    /const targetMetadata = toRecord\(normalizeSourceMetadata\(readiness\.target\.metadata\)\);/
  );
});
