import test from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";

import { validateRoomManifest } from "../../src/types/rooms.ts";

const requiredAudioFiles = [
  "rooms/laboratory/main-functions/audio-analysis/host/module-projection.js",
  "rooms/laboratory/main-functions/audio-analysis/host/process-runners.js",
  "rooms/laboratory/main-functions/audio-analysis/host/state.js",
  "rooms/laboratory/shared/host/project-lifecycle.js",
  "rooms/laboratory/shared/host/process-report-state.js",
  "rooms/laboratory/shared/host/runtime-bootstrap.js",
  "rooms/laboratory/shared/host/process-runtime.js",
  "rooms/laboratory/shared/host/room-snapshot.js",
  "rooms/laboratory/shared/host/reporting.js",
  "rooms/laboratory/main-functions/audio-analysis/ui/module.js",
  "rooms/laboratory/shared/data/tools/audio-analysis-catalog.json",
  "rooms/laboratory/shared/data/tools/audio-analysis-capabilities.json",
  "rooms/laboratory/shared/data/tools/audio-analysis-presets.json",
  "rooms/laboratory/shared/data/tools/audio-analysis-providers.json",
  "rooms/laboratory/shared/data/tools/opensmile/prosodyAcf.conf",
  "rooms/laboratory/shared/data/tools/shared/standard_wave_input.conf.inc",
  "rooms/laboratory/shared/data/tools/shared/standard_data_output_lldonly.conf.inc",
  "rooms/laboratory/shared/data/tools/yamnet/yamnet_infer.py",
  "rooms/laboratory/shared/data/tools/music/librosa_music_analysis.py",
  "rooms/laboratory/shared/data/tools/diarization/pyaudioanalysis_diarize.py",
];

test("laboratory workspace keeps the required audio-analysis package files", () => {
  requiredAudioFiles.forEach((filePath) => {
    assert.equal(existsSync(filePath), true, filePath);
  });
});

test("laboratory manifest exposes the audio-analysis feature beside media-analysis", () => {
  const manifest = JSON.parse(readFileSync("rooms/laboratory/manifest.json", "utf8"));
  const validation = validateRoomManifest(manifest);
  const audioFeature = validation.manifest?.features.find((feature) => feature.id === "audio-analysis");
  const subtitleFeature = validation.manifest?.features.find((feature) => feature.id === "subtitle-analysis");

  assert.equal(validation.valid, true);
  assert.equal(validation.manifest?.features.length, 3);
  assert.equal(audioFeature?.name, "Audio Analysis");
  assert.equal(audioFeature?.scene?.hotspot.id, "laboratory-audio-analysis");
  assert.equal(audioFeature?.scene?.view.id, "audio-analysis-console");
  assert.equal(
    audioFeature?.scene?.view.backgroundSrc,
    "main-functions/audio-analysis/assets/sound-analysis.webp"
  );
  assert.equal(subtitleFeature?.name, "Subtitle Analysis");
});

test("laboratory host keeps audio-analysis snapshots on the shared room-tool contract", () => {
  const hostSource = readFileSync("rooms/laboratory/host/index.js", "utf8");
  const actionRouterSource = readFileSync("rooms/laboratory/shared/host/action-router.js", "utf8");
  const audioProjectionSource = readFileSync(
    "rooms/laboratory/main-functions/audio-analysis/host/module-projection.js",
    "utf8"
  );
  const lifecycleSource = readFileSync("rooms/laboratory/shared/host/project-lifecycle.js", "utf8");
  const runtimeBootstrapSource = readFileSync(
    "rooms/laboratory/shared/host/runtime-bootstrap.js",
    "utf8"
  );
  const roomSnapshotSource = readFileSync("rooms/laboratory/shared/host/room-snapshot.js", "utf8");

  assert.match(hostSource, /const AUDIO_FEATURE_ID = "audio-analysis";/);
  assert.match(hostSource, /shared\/host\/project-lifecycle\.js/);
  assert.match(hostSource, /shared\/host\/process-report-state\.js/);
  assert.match(hostSource, /shared\/host\/runtime-bootstrap\.js/);
  assert.match(runtimeBootstrapSource, /const activeFeature = toRecord\(source\.activeFeature\);/);
  assert.match(runtimeBootstrapSource, /typeof source\.feature === "string"/);
  assert.match(runtimeBootstrapSource, /packageToolsDir: null,/);
  assert.match(lifecycleSource, /audio-analysis-catalog\.json/);
  assert.match(lifecycleSource, /audio-analysis-capabilities\.json/);
  assert.match(lifecycleSource, /audio-analysis-presets\.json/);
  assert.match(lifecycleSource, /audio-analysis-providers\.json/);
  assert.match(lifecycleSource, /runtime\.packageToolsDir = baseDir;/);
  assert.match(hostSource, /shared\/host\/room-snapshot\.js/);
  assert.match(hostSource, /main-functions\/audio-analysis\/host\/module-projection\.js/);
  assert.match(hostSource, /main-functions\/audio-analysis\/host\/state\.js/);
  assert.match(hostSource, /const audioAnalysisProjectionRuntime = createAudioAnalysisProjectionRuntime\(/);
  assert.match(roomSnapshotSource, /audioAnalysisCatalog: clone\(runtime\.audioAnalysisCatalog \|\| \{\}\)/);
  assert.match(roomSnapshotSource, /audioAnalysisCapabilities: clone\(runtime\.audioAnalysisCapabilities \|\| \{\}\)/);
  assert.match(roomSnapshotSource, /audioAnalysisPresets: clone\(runtime\.audioAnalysisPresets \|\| \{\}\)/);
  assert.match(roomSnapshotSource, /audioAnalysisProviders: clone\(runtime\.audioAnalysisProviders \|\| \{\}\)/);
  assert.match(audioProjectionSource, /function buildAudioAnalysisCatalogProjection\(runtime\)/);
  assert.match(hostSource, /function getPreferredFeatureSourceKind\(featureId, sourcePresets\)/);
  assert.match(hostSource, /shared\/host\/action-router\.js/);
  assert.match(actionRouterSource, /case "project-create":/);
});

test("laboratory UI keeps audio-analysis on the shared settings overlay with feature-aware defaults", () => {
  const uiSource = readFileSync("rooms/laboratory/ui/index.js", "utf8");
  const audioModuleSource = readFileSync(
    "rooms/laboratory/main-functions/audio-analysis/ui/module.js",
    "utf8"
  );

  assert.match(uiSource, /const AUDIO_FEATURE_ID = "audio-analysis";/);
  assert.match(uiSource, /featureId: FEATURE_ID,/);
  assert.match(uiSource, /const FEATURE_NAMESPACES = \{/);
  assert.match(uiSource, /\[AUDIO_FEATURE_ID\]: "audioAnalysis"/);
  assert.match(uiSource, /\[SUBTITLE_FEATURE_ID\]: "subtitleAnalysis"/);
  assert.match(uiSource, /function getAudioAnalysisCapabilities\(\)/);
  assert.match(uiSource, /function getAudioAnalysisPresets\(\)/);
  assert.match(uiSource, /function getAudioAnalysisProviders\(\)/);
  assert.match(uiSource, /function getAudioAnalysisProviderEntries\(\)/);
  assert.match(audioModuleSource, /featureText\(\["settings", "title"\]\)/);
  assert.match(uiSource, /renderAudioAnalysisCatalogPanel/);
  assert.match(uiSource, /renderAudioAnalysisProviderPanel/);
  assert.match(uiSource, /renderAudioAnalysisNoticePanel/);
  assert.match(uiSource, /return filteredFormats\.length > 0 \? filteredFormats : \["audio", "video"\];/);
  assert.match(uiSource, /featureId: getActiveFeatureId\(\),/);
  assert.match(
    uiSource,
    /\[AUDIO_FEATURE_ID\]: "\.\.\/main-functions\/audio-analysis\/assets\/sound-analysis\.webp"/
  );
});

test("laboratory audio-analysis locks a persistent v2-ready contract and planning docs", () => {
  const schema = JSON.parse(readFileSync("rooms/laboratory/shared/data/tools/project-schema.json", "utf8"));
  const catalog = JSON.parse(readFileSync("rooms/laboratory/shared/data/tools/audio-analysis-catalog.json", "utf8"));
  const providers = JSON.parse(readFileSync("rooms/laboratory/shared/data/tools/audio-analysis-providers.json", "utf8"));
  const toolchain = JSON.parse(readFileSync("rooms/laboratory/shared/data/tools/toolchain.manifest.json", "utf8"));
  const providerMatrix = readFileSync(".rovo/laboratory-audio-analysis-provider-matrix.md", "utf8");
  const smokeMatrix = readFileSync(".rovo/laboratory-audio-analysis-smoke-matrix.md", "utf8");
  const enLocale = readFileSync("rooms/laboratory/i18n/en.json", "utf8");
  const trLocale = readFileSync("rooms/laboratory/i18n/tr.json", "utf8");
  const providerIds = Array.isArray(providers.providers)
    ? providers.providers.map((entry) => entry.id)
    : [];
  const prosodyModule = Array.isArray(catalog.modules)
    ? catalog.modules.find((entry) => entry.id === "prosody")
    : null;
  const emotionModule = Array.isArray(catalog.modules)
    ? catalog.modules.find((entry) => entry.id === "emotion")
    : null;
  const speakerModule = Array.isArray(catalog.modules)
    ? catalog.modules.find((entry) => entry.id === "speaker-diarization")
    : null;
  const soundEventsModule = Array.isArray(catalog.modules)
    ? catalog.modules.find((entry) => entry.id === "sound-events")
    : null;
  const sourceSeparationModule = Array.isArray(catalog.modules)
    ? catalog.modules.find((entry) => entry.id === "source-separation")
    : null;
  const musicRhythmModule = Array.isArray(catalog.modules)
    ? catalog.modules.find((entry) => entry.id === "music-rhythm-tonal")
    : null;
  const prosodyProvider = Array.isArray(providers.providers)
    ? providers.providers.find((entry) => entry.id === "prosody-open-smile")
    : null;
  const emotionProvider = Array.isArray(providers.providers)
    ? providers.providers.find((entry) => entry.id === "emotion-heuristic")
    : null;
  const speakerProvider = Array.isArray(providers.providers)
    ? providers.providers.find((entry) => entry.id === "speaker-timeline")
    : null;
  const soundEventsProvider = Array.isArray(providers.providers)
    ? providers.providers.find((entry) => entry.id === "sound-event-classifier")
    : null;
  const sourceSeparationProvider = Array.isArray(providers.providers)
    ? providers.providers.find((entry) => entry.id === "source-separation-runner")
    : null;
  const musicRhythmProvider = Array.isArray(providers.providers)
    ? providers.providers.find((entry) => entry.id === "music-rhythm-engine")
    : null;
  const musicRhythmFallbackProvider = Array.isArray(providers.providers)
    ? providers.providers.find((entry) => entry.id === "music-rhythm-essentia")
    : null;

  assert.equal(schema.project.required.includes("audioAnalysis"), true);
  assert.equal(Array.isArray(schema.project.audioAnalysis?.required), true);
  assert.equal(schema.project.audioAnalysis.required.includes("providerState"), true);
  assert.equal(schema.project.audioAnalysis.required.includes("capabilityState"), true);
  assert.equal(schema.project.audioAnalysis.required.includes("results"), true);
  assert.equal(schema.project.audioAnalysis.capabilityState.item.optional.includes("requiredToolIds"), true);
  assert.equal(schema.project.audioAnalysis.providerState.item.optional.includes("providerType"), true);
  assert.equal(schema.project.audioAnalysis.providerState.item.optional.includes("installStrategy"), true);
  assert.equal(schema.project.audioAnalysis.providerState.item.optional.includes("expectedArtifacts"), true);
  assert.equal(schema.project.audioAnalysis.results.item.optional.includes("requiredToolIds"), true);
  assert.equal(existsSync(".rovo/laboratory-audio-analysis-provider-matrix.md"), true);
  assert.equal(existsSync(".rovo/laboratory-audio-analysis-smoke-matrix.md"), true);
  assert.match(providerMatrix, /shared room tool manual/);
  assert.match(providerMatrix, /python3/);
  assert.match(providerMatrix, /pyAudioAnalysis/);
  assert.match(smokeMatrix, /music-rhythm-tonal/);
  assert.match(smokeMatrix, /source-separation/);
  assert.match(enLocale, /speaker timeline now runs on a fully local pyAudioAnalysis path/i);
  assert.match(trLocale, /tamamen local pyAudioAnalysis yolu ile calisir/);
  assert.match(enLocale, /dominant pitch-class/);
  assert.match(trLocale, /baskin pitch-class/);
  assert.equal(toolchain.tools.opensmile.availability, "system-command");
  assert.equal(toolchain.tools.yamnet.availability, "system-command");
  assert.equal(toolchain.tools.librosa.availability, "system-command");
  assert.equal(toolchain.tools.demucs.availability, "system-command");
  assert.equal(toolchain.tools.essentia.availability, "system-command");
  assert.equal(toolchain.tools.pyaudioanalysis.availability, "system-command");
  assert.equal(toolchain.tools.opensmile.systemCommand.executableName, "SMILExtract");
  assert.equal(toolchain.tools.yamnet.systemCommand.executableName, "python3");
  assert.equal(toolchain.tools.librosa.systemCommand.executableName, "python3");
  assert.equal(toolchain.tools.demucs.systemCommand.executableName, "python3");
  assert.equal(toolchain.tools.essentia.systemCommand.executableName, "python3");
  assert.equal(toolchain.tools.pyaudioanalysis.systemCommand.executableName, "python3");
  assert.match(toolchain.tools.pyaudioanalysis.systemCommand.setupHint, /pyAudioAnalysis/);
  assert.equal(speakerModule?.status, "implemented");
  assert.equal(prosodyModule?.status, "implemented");
  assert.equal(emotionModule?.status, "implemented");
  assert.equal(soundEventsModule?.status, "implemented");
  assert.equal(sourceSeparationModule?.status, "implemented");
  assert.equal(musicRhythmModule?.status, "implemented");
  assert.deepEqual(speakerModule?.toolIds, ["pyaudioanalysis", "ffmpeg"]);
  assert.deepEqual(speakerModule?.requiredToolIds, ["pyaudioanalysis", "ffmpeg"]);
  assert.equal(speakerProvider?.status, "ready");
  assert.equal(speakerProvider?.toolId, "pyaudioanalysis");
  assert.equal(speakerProvider?.installStrategy, "shared-room-tool-manual");
  assert.equal(prosodyProvider?.status, "ready");
  assert.equal(emotionProvider?.status, "ready");
  assert.equal(soundEventsProvider?.status, "ready");
  assert.equal(sourceSeparationProvider?.status, "ready");
  assert.equal(musicRhythmProvider?.status, "ready");
  assert.equal(musicRhythmFallbackProvider?.status, "planned");
  assert.deepEqual(sourceSeparationModule?.toolIds, ["demucs", "ffmpeg"]);
  assert.deepEqual(musicRhythmModule?.toolIds, ["librosa", "essentia", "ffmpeg"]);
  assert.deepEqual(musicRhythmModule?.requiredToolIds, ["librosa", "ffmpeg"]);
  assert.deepEqual(musicRhythmModule?.providerIds, ["music-rhythm-engine", "music-rhythm-essentia"]);
  assert.equal(sourceSeparationProvider?.toolId, "demucs");
  assert.equal(sourceSeparationProvider?.installStrategy, "shared-room-tool-manual");
  assert.equal(musicRhythmProvider?.toolId, "librosa");
  assert.equal(musicRhythmProvider?.installStrategy, "shared-room-tool-manual");
  assert.deepEqual(musicRhythmProvider?.fallbackProviderIds, ["music-rhythm-essentia"]);
  assert.equal(musicRhythmFallbackProvider?.toolId, "essentia");
  assert.equal(musicRhythmFallbackProvider?.installStrategy, "shared-room-tool-manual");
  assert.equal(toolchain.tools.opensmile.stageSupport.profile, "optional");
  assert.equal(toolchain.tools.yamnet.stageSupport.process, "optional");
  assert.equal(toolchain.tools.librosa.stageSupport.process, "optional");
  assert.equal(toolchain.tools.demucs.stageSupport.process, "optional");
  assert.equal(toolchain.tools.essentia.stageSupport.process, "optional");
  assert.equal(toolchain.tools.pyaudioanalysis.stageSupport.process, "optional");

  catalog.modules
    .filter((entry) => entry.status === "planned")
    .forEach((entry) => {
      assert.equal(Array.isArray(entry.providerIds), true, entry.id);
      entry.providerIds.forEach((providerId) => {
        assert.equal(providerIds.includes(providerId), true, `${entry.id}:${providerId}`);
      });
    });
});

test("laboratory host and UI consume the normalized audioAnalysis result envelope for report rendering", () => {
  const hostSource = readFileSync("rooms/laboratory/host/index.js", "utf8");
  const reportingSource = readFileSync("rooms/laboratory/shared/host/reporting.js", "utf8");
  const roomSnapshotSource = readFileSync("rooms/laboratory/shared/host/room-snapshot.js", "utf8");
  const audioProjectionSource = readFileSync(
    "rooms/laboratory/main-functions/audio-analysis/host/module-projection.js",
    "utf8"
  );
  const audioHostModuleSource = readFileSync(
    "rooms/laboratory/main-functions/audio-analysis/host/process-runners.js",
    "utf8"
  );
  const audioUtilitySource = readFileSync(
    "rooms/laboratory/main-functions/audio-analysis/host/analysis-utils.js",
    "utf8"
  );
  const projectPathsSource = readFileSync("rooms/laboratory/shared/host/project-paths.js", "utf8");
  const uiSource = readFileSync("rooms/laboratory/ui/index.js", "utf8");
  const reportStageSource = readFileSync("rooms/laboratory/shared/ui/report-stage.js", "utf8");
  const settingsOverlaySource = readFileSync("rooms/laboratory/shared/ui/settings-overlay.js", "utf8");
  const audioModuleSource = readFileSync(
    "rooms/laboratory/main-functions/audio-analysis/ui/module.js",
    "utf8"
  );
  const diarizationHelperSource = readFileSync(
    "rooms/laboratory/shared/data/tools/diarization/pyaudioanalysis_diarize.py",
    "utf8"
  );
  const musicHelperSource = readFileSync("rooms/laboratory/shared/data/tools/music/librosa_music_analysis.py", "utf8");

  assert.match(hostSource, /shared\/host\/reporting\.js/);
  assert.match(hostSource, /const laboratoryReportingRuntime = createLaboratoryReportingRuntime\(/);
  assert.match(hostSource, /function buildAudioAnalysisReportProjection\(runtime, project\)/);
  assert.match(hostSource, /function composeAudioAnalysisReport\(runtime, project\)/);
  assert.match(reportingSource, /const orderedResults = orderedIds\.concat\(extraIds\)\.map/);
  assert.match(reportingSource, /function composeFeatureReport\(runtime, project, featureId\)/);
  assert.match(reportingSource, /function buildReportMarkdown\(runtime, project, featureId, reportRecord\)/);
  assert.match(hostSource, /function buildAudioAnalysisModules\(runtime, project, target\)/);
  assert.match(audioProjectionSource, /function resolveAudioFeatureTarget\(project\)/);
  assert.match(audioProjectionSource, /const providerState = buildAudioAnalysisProviderState\(runtime, project\);/);
  assert.match(audioProjectionSource, /const capabilityState = buildAudioAnalysisCapabilityState\(runtime, project, target, providerState\);/);
  assert.match(audioProjectionSource, /const missingToolIds = requiredToolIds\.filter/);
  assert.match(hostSource, /function ensureRuntimeDirectory\(dirPath, requestId\)/);
  assert.match(audioProjectionSource, /function buildAudioAnalysisCapabilityState\(runtime, project, target, providerState\)/);
  assert.match(hostSource, /main-functions\/audio-analysis\/host\/process-runners\.js/);
  assert.match(hostSource, /main-functions\/audio-analysis\/host\/analysis-utils\.js/);
  assert.match(hostSource, /main-functions\/audio-analysis\/host\/module-projection\.js/);
  assert.match(hostSource, /function getAudioAnalysisModuleProcessDir\(runtime, project, moduleId\)/);
  assert.match(hostSource, /function getAudioAnalysisModuleRunner\(moduleId\)/);
  assert.match(hostSource, /const audioAnalysisProjectionRuntime = createAudioAnalysisProjectionRuntime\(/);
  assert.match(hostSource, /const audioAnalysisProcessRuntime = createAudioAnalysisProcessRuntime\(/);
  assert.match(hostSource, /function getAudioAnalysisRequiredToolIds\(catalogEntry\)/);
  assert.match(hostSource, /shared\/host\/project-paths\.js/);
  assert.match(projectPathsSource, /function getAudioAnalysisDiarizationDir\(runtime\)/);
  assert.match(projectPathsSource, /function getAudioAnalysisDiarizationScriptPath\(runtime\)/);
  assert.match(projectPathsSource, /function getAudioAnalysisMusicDir\(runtime\)/);
  assert.match(projectPathsSource, /function getAudioAnalysisMusicScriptPath\(runtime\)/);
  assert.match(audioUtilitySource, /function buildProsodySummaryFromCsv\(rawText\)/);
  assert.match(audioUtilitySource, /function buildEmotionHeuristicFromProsody\(prosodySummary\)/);
  assert.match(audioHostModuleSource, /async function runSpeakerDiarizationAudioAnalyzer\(/);
  assert.match(audioHostModuleSource, /async function runProsodyAudioAnalyzer\(/);
  assert.match(audioHostModuleSource, /async function runEmotionHeuristicAudioAnalyzer\(/);
  assert.match(audioHostModuleSource, /async function runSoundEventsAudioAnalyzer\(/);
  assert.match(audioHostModuleSource, /async function runSourceSeparationAudioAnalyzer\(/);
  assert.match(audioHostModuleSource, /async function runMusicRhythmAudioAnalyzer\(/);
  assert.match(audioUtilitySource, /toolId: "opensmile"/);
  assert.match(audioHostModuleSource, /toolId: "yamnet"/);
  assert.match(audioHostModuleSource, /toolId: "pyaudioanalysis"/);
  assert.match(audioHostModuleSource, /toolId: "demucs"/);
  assert.match(audioHostModuleSource, /toolId: "librosa"/);
  assert.match(audioHostModuleSource, /const fallbackApplied = summaryPayload\.fallbackApplied === true;/);
  assert.match(audioHostModuleSource, /pyAudioAnalysis HMM smoothing failed for this clip/);
  assert.match(audioHostModuleSource, /"speaker-diarization": runSpeakerDiarizationAudioAnalyzer/);
  assert.match(audioHostModuleSource, /prosody: runProsodyAudioAnalyzer/);
  assert.match(audioHostModuleSource, /emotion: runEmotionHeuristicAudioAnalyzer/);
  assert.match(audioHostModuleSource, /"sound-events": runSoundEventsAudioAnalyzer/);
  assert.match(audioHostModuleSource, /"source-separation": runSourceSeparationAudioAnalyzer/);
  assert.match(audioHostModuleSource, /"music-rhythm-tonal": runMusicRhythmAudioAnalyzer/);
  assert.match(hostSource, /providerType: asNonEmptyString\(source\.providerType\)/);
  assert.doesNotMatch(hostSource, /ffmpegReady === true/);
  assert.match(audioUtilitySource, /function parseAspectralStatsText\(rawText\)/);
  assert.match(audioHostModuleSource, /function generateSpectralDescriptorArtifact\(/);
  assert.match(audioHostModuleSource, /aspectralstats=measure=centroid\+rolloff\+flatness\+flux/);
  assert.match(roomSnapshotSource, /availability: asNonEmptyString\(toolManifest\.availability\) \|\| "installable"/);
  assert.match(roomSnapshotSource, /commandName: asNonEmptyString\(systemCommand\.executableName\)/);
  assert.match(roomSnapshotSource, /setupHint: asNonEmptyString\(systemCommand\.setupHint\)/);
  assert.match(uiSource, /function getProjectAudioAnalysis\(\)/);
  assert.match(diarizationHelperSource, /def should_retry_with_local_fallback/);
  assert.match(diarizationHelperSource, /def run_local_kmeans_diarization/);
  assert.match(diarizationHelperSource, /"fallbackApplied": fallback_applied/);
  assert.match(diarizationHelperSource, /datetime\.now\(dt\.UTC\)/);
  assert.match(musicHelperSource, /def to_scalar_float/);
  assert.match(musicHelperSource, /"tempoBpm": to_scalar_float\(tempo_bpm\)/);
  assert.match(musicHelperSource, /datetime\.now\(dt\.UTC\)/);
  assert.match(uiSource, /function getAudioAnalysisOrderedResultEntries\(\)/);
  assert.match(uiSource, /function getCurrentFeatureTargetLabel\(\)/);
  assert.match(uiSource, /function renderAudioAnalysisResultCard\(moduleEntry\)/);
  assert.match(uiSource, /function renderAudioAnalysisModuleGrid\(\)/);
  assert.match(reportStageSource, /isAudioAnalysisFeature\(\) \? renderAudioAnalysisModuleGrid\(\) : ""/);
  assert.match(audioModuleSource, /featureText\(\["settings", "providersTitle"\]\)/);
  assert.match(settingsOverlaySource, /isAudioAnalysisFeature\(\) \? renderAudioAnalysisProviderPanel\(\) : ""/);
  assert.match(settingsOverlaySource, /const availability =/);
  assert.match(settingsOverlaySource, /const systemCommand = availability === "system-command";/);
  assert.match(settingsOverlaySource, /manualRefreshAction/);
});
