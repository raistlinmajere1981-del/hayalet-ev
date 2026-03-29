import test from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";

import { validateRoomManifest } from "../../src/types/rooms.ts";

const requiredAudioFiles = [
  "rooms/laboratory/host/runtime.ts",
  "rooms/laboratory/host/foundation-runtimes.ts",
  "rooms/laboratory/host/project-runtimes.ts",
  "rooms/laboratory/host/feature-runtimes.ts",
  "rooms/laboratory/main-functions/audio-analysis/host/module-projection.ts",
  "rooms/laboratory/main-functions/audio-analysis/host/projection-catalog.ts",
  "rooms/laboratory/main-functions/audio-analysis/host/projection-results.ts",
  "rooms/laboratory/main-functions/audio-analysis/host/process-local-runners.ts",
  "rooms/laboratory/main-functions/audio-analysis/host/process-model-music-rhythm.ts",
  "rooms/laboratory/main-functions/audio-analysis/host/process-model-sound-events.ts",
  "rooms/laboratory/main-functions/audio-analysis/host/process-model-source-separation.ts",
  "rooms/laboratory/main-functions/audio-analysis/host/process-model-speaker-diarization.ts",
  "rooms/laboratory/main-functions/audio-analysis/host/process-model-runners.ts",
  "rooms/laboratory/main-functions/audio-analysis/host/process-runners.ts",
  "rooms/laboratory/main-functions/audio-analysis/host/process-runner-support.ts",
  "rooms/laboratory/main-functions/audio-analysis/host/analysis-parsers.ts",
  "rooms/laboratory/main-functions/audio-analysis/host/analysis-probes.ts",
  "rooms/laboratory/main-functions/audio-analysis/host/state.ts",
  "rooms/laboratory/main-functions/audio-analysis/host/runtime.ts",
  "rooms/laboratory/shared/host/audio-process-delegates.ts",
  "rooms/laboratory/shared/host/io-runtime.ts",
  "rooms/laboratory/shared/host/project-lifecycle.ts",
  "rooms/laboratory/shared/host/project-config-loader.ts",
  "rooms/laboratory/shared/host/project-records.ts",
  "rooms/laboratory/shared/host/project-storage.ts",
  "rooms/laboratory/shared/host/project-tool-status.ts",
  "rooms/laboratory/shared/host/process-managed-audio-runner.ts",
  "rooms/laboratory/shared/host/process-managed-media-runner.ts",
  "rooms/laboratory/shared/host/process-managed-runners.ts",
  "rooms/laboratory/shared/host/process-managed-subtitle-runner.ts",
  "rooms/laboratory/shared/host/process-report-state.ts",
  "rooms/laboratory/shared/host/process-orchestration.ts",
  "rooms/laboratory/shared/host/runtime-bootstrap.ts",
  "rooms/laboratory/shared/host/process-runtime.ts",
  "rooms/laboratory/shared/host/preset-runtime.ts",
  "rooms/laboratory/shared/host/preset-source-runtime.ts",
  "rooms/laboratory/shared/host/preset-edit-runtime.ts",
  "rooms/laboratory/shared/host/preset-profile-runtime.ts",
  "rooms/laboratory/shared/host/room-snapshot.ts",
  "rooms/laboratory/shared/host/reporting.ts",
  "rooms/laboratory/shared/host/reporting-feature-report.ts",
  "rooms/laboratory/shared/host/reporting-export.ts",
  "rooms/laboratory/shared/host/reporting-audio.ts",
  "rooms/laboratory/shared/host/reporting-subtitle.ts",
  "rooms/laboratory/shared/host/reporting-markdown.ts",
  "rooms/laboratory/shared/host/snapshot-composition.ts",
  "rooms/laboratory/shared/host/state-composition.ts",
  "rooms/laboratory/shared/host/subtitle-projection.ts",
  "rooms/laboratory/main-functions/audio-analysis/ui/module.ts",
  "rooms/laboratory/main-functions/audio-analysis/ui/catalog-runtime.ts",
  "rooms/laboratory/main-functions/audio-analysis/ui/provider-runtime.ts",
  "rooms/laboratory/main-functions/audio-analysis/ui/result-runtime.ts",
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
  const hostSource = readFileSync("rooms/laboratory/host/runtime.ts", "utf8");
  const hostFoundationSource = readFileSync("rooms/laboratory/host/foundation-runtimes.ts", "utf8");
  const hostProjectSource = readFileSync("rooms/laboratory/host/project-runtimes.ts", "utf8");
  const hostFeatureSource = readFileSync("rooms/laboratory/host/feature-runtimes.ts", "utf8");
  const featureAdaptersSource = readFileSync("rooms/laboratory/host/feature-adapters.ts", "utf8");
  const actionRouterSource = readFileSync("rooms/laboratory/shared/host/action-router.ts", "utf8");
  const actionCompositionSource = readFileSync("rooms/laboratory/shared/host/action-composition.ts", "utf8");
  const actionRuntimeSource = readFileSync("rooms/laboratory/shared/host/action-runtime.ts", "utf8");
  const hostUtilsSource = readFileSync("rooms/laboratory/shared/host/host-utils.ts", "utf8");
  const ioRuntimeSource = readFileSync("rooms/laboratory/shared/host/io-runtime.ts", "utf8");
  const processDelegatesSource = readFileSync("rooms/laboratory/shared/host/process-delegates.ts", "utf8");
  const processCompositionSource = readFileSync(
    "rooms/laboratory/shared/host/process-composition.ts",
    "utf8"
  );
  const stateCompositionSource = readFileSync(
    "rooms/laboratory/shared/host/state-composition.ts",
    "utf8"
  );
  const audioRuntimeSource = readFileSync(
    "rooms/laboratory/main-functions/audio-analysis/host/runtime.ts",
    "utf8"
  );
  const audioProjectionSource = readFileSync(
    "rooms/laboratory/main-functions/audio-analysis/host/module-projection.ts",
    "utf8"
  );
  const audioProjectionCatalogSource = readFileSync(
    "rooms/laboratory/main-functions/audio-analysis/host/projection-catalog.ts",
    "utf8"
  );
  const audioProjectionResultsSource = readFileSync(
    "rooms/laboratory/main-functions/audio-analysis/host/projection-results.ts",
    "utf8"
  );
  const lifecycleSource = readFileSync("rooms/laboratory/shared/host/project-lifecycle.ts", "utf8");
  const presetRuntimeSource = readFileSync("rooms/laboratory/shared/host/preset-runtime.ts", "utf8");
  const presetSourceRuntimeSource = readFileSync(
    "rooms/laboratory/shared/host/preset-source-runtime.ts",
    "utf8"
  );
  const presetEditRuntimeSource = readFileSync(
    "rooms/laboratory/shared/host/preset-edit-runtime.ts",
    "utf8"
  );
  const presetProfileRuntimeSource = readFileSync(
    "rooms/laboratory/shared/host/preset-profile-runtime.ts",
    "utf8"
  );
  const projectConfigLoaderSource = readFileSync(
    "rooms/laboratory/shared/host/project-config-loader.ts",
    "utf8"
  );
  const projectStorageSource = readFileSync(
    "rooms/laboratory/shared/host/project-storage.ts",
    "utf8"
  );
  const projectToolStatusSource = readFileSync(
    "rooms/laboratory/shared/host/project-tool-status.ts",
    "utf8"
  );
  const reportingAudioSource = readFileSync(
    "rooms/laboratory/shared/host/reporting-audio.ts",
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
  const runtimeBootstrapSource = readFileSync(
    "rooms/laboratory/shared/host/runtime-bootstrap.ts",
    "utf8"
  );
  const roomSnapshotSource = readFileSync("rooms/laboratory/shared/host/room-snapshot.ts", "utf8");
  const snapshotCompositionSource = readFileSync(
    "rooms/laboratory/shared/host/snapshot-composition.ts",
    "utf8"
  );
  const runtimePrimitivesSource = readFileSync(
    "rooms/laboratory/shared/host/runtime-primitives.ts",
    "utf8"
  );
  const hostCompositionSource = [
    hostSource,
    hostFoundationSource,
    hostProjectSource,
    hostFeatureSource,
    featureAdaptersSource,
  ].join("\n");

  assert.match(hostSource, /shared\/host\/runtime-primitives\.js/);
  assert.match(runtimePrimitivesSource, /export const LABORATORY_AUDIO_FEATURE_ID = "audio-analysis";/);
  assert.match(hostCompositionSource, /shared\/host\/project-lifecycle\.js/);
  assert.match(hostCompositionSource, /shared\/host\/state-composition\.js/);
  assert.match(hostCompositionSource, /shared\/host\/runtime-bootstrap\.js/);
  assert.match(hostFoundationSource, /shared\/host\/preset-runtime\.js/);
  assert.match(presetRuntimeSource, /from "\.\/preset-source-runtime\.js"/);
  assert.match(presetRuntimeSource, /from "\.\/preset-edit-runtime\.js"/);
  assert.match(presetRuntimeSource, /from "\.\/preset-profile-runtime\.js"/);
  assert.match(
    presetSourceRuntimeSource,
    /export function createLaboratoryPresetSourceRuntime\(\s*deps(?::[\s\S]+?)?\s*\)/
  );
  assert.match(
    presetSourceRuntimeSource,
    /function createEmptySourceDrafts\(\s*sourcePresets\??(?::[\s\S]+?)?\s*\)(?::[\s\S]+?)?/
  );
  assert.match(
    presetEditRuntimeSource,
    /export function createLaboratoryPresetEditRuntime\(deps\)/
  );
  assert.match(presetEditRuntimeSource, /function normalizeEditState\(rawValue, editPresets, sourceKind\)/);
  assert.match(
    presetProfileRuntimeSource,
    /export function createLaboratoryPresetProfileRuntime\(\s*deps(?::[\s\S]+?)?\s*\)/
  );
  assert.match(
    presetProfileRuntimeSource,
    /function createEmptyProfilePreflight\(\s*\)(?::[\s\S]+?)?/
  );
  assert.match(lifecycleSource, /from "\.\/project-config-loader\.js"/);
  assert.match(lifecycleSource, /from "\.\/project-storage\.js"/);
  assert.match(lifecycleSource, /from "\.\/project-tool-status\.js"/);
  assert.match(
    projectConfigLoaderSource,
    /export function createLaboratoryProjectConfigLoader\(\s*deps(?::[\s\S]+?)?\s*\)/
  );
  assert.match(
    projectStorageSource,
    /export function createLaboratoryProjectStorageRuntime\(deps\)/
  );
  assert.match(
    projectToolStatusSource,
    /export function createLaboratoryProjectToolStatusRuntime\(\s*deps(?::[\s\S]+?)?\s*\)/
  );
  assert.match(runtimeBootstrapSource, /const activeFeature = toRecord\(source\.activeFeature\);/);
  assert.match(runtimeBootstrapSource, /typeof source\.feature === "string"/);
  assert.match(runtimeBootstrapSource, /packageToolsDir: null,/);
  assert.match(hostCompositionSource, /shared\/host\/process-composition\.js/);
  assert.match(processCompositionSource, /main-functions\/audio-analysis\/host\/runtime\.js/);
  assert.match(projectConfigLoaderSource, /audio-analysis-catalog\.json/);
  assert.match(projectConfigLoaderSource, /audio-analysis-capabilities\.json/);
  assert.match(projectConfigLoaderSource, /audio-analysis-presets\.json/);
  assert.match(projectConfigLoaderSource, /audio-analysis-providers\.json/);
  assert.match(projectConfigLoaderSource, /runtime\.packageToolsDir = baseDir;/);
  assert.match(projectToolStatusSource, /operation: "tool-check-for-updates"/);
  assert.match(hostCompositionSource, /shared\/host\/snapshot-composition\.js/);
  assert.match(snapshotCompositionSource, /from "\.\/project-manifests\.js"/);
  assert.match(snapshotCompositionSource, /from "\.\/room-snapshot\.js"/);
  assert.match(snapshotCompositionSource, /from "\.\/runtime-events\.js"/);
  assert.match(
    snapshotCompositionSource,
    /export function createLaboratorySnapshotCompositionRuntime\(deps\)/
  );
  assert.match(stateCompositionSource, /from "\.\/project-records\.js"/);
  assert.match(stateCompositionSource, /from "\.\/process-report-state\.js"/);
  assert.match(stateCompositionSource, /from "\.\/subtitle-projection\.js"/);
  assert.match(
    stateCompositionSource,
    /export function createLaboratoryHostStateCompositionRuntime\(deps\)/
  );
  assert.match(processCompositionSource, /main-functions\/audio-analysis\/host\/runtime\.js/);
  assert.match(audioRuntimeSource, /import { createLaboratoryAudioProcessDelegatesRuntime }/);
  assert.match(audioRuntimeSource, /import { createAudioAnalysisProjectionRuntime }/);
  assert.match(audioRuntimeSource, /import { createAudioAnalysisProcessRuntime }/);
  assert.match(audioRuntimeSource, /import { createAudioAnalysisStateRuntime }/);
  assert.match(audioRuntimeSource, /export function createLaboratoryAudioAnalysisHostRuntime\(deps\)/);
  assert.match(roomSnapshotSource, /audioAnalysisCatalog: clone\(runtimeRecord\.audioAnalysisCatalog \|\| \{\}\)/);
  assert.match(
    roomSnapshotSource,
    /audioAnalysisCapabilities: clone\(runtimeRecord\.audioAnalysisCapabilities \|\| \{\}\)/
  );
  assert.match(roomSnapshotSource, /audioAnalysisPresets: clone\(runtimeRecord\.audioAnalysisPresets \|\| \{\}\)/);
  assert.match(
    roomSnapshotSource,
    /audioAnalysisProviders: clone\(runtimeRecord\.audioAnalysisProviders \|\| \{\}\)/
  );
  assert.match(audioProjectionSource, /from "\.\/projection-catalog\.js"/);
  assert.match(audioProjectionSource, /from "\.\/projection-results\.js"/);
  assert.match(
    audioProjectionCatalogSource,
    /export function createAudioAnalysisProjectionCatalogRuntime\(deps\)/
  );
  assert.match(audioProjectionCatalogSource, /function buildAudioAnalysisCatalogProjection\(runtime\)/);
  assert.match(audioProjectionResultsSource, /export function createAudioAnalysisProjectionResultsRuntime\(deps\)/);
  assert.match(audioProjectionResultsSource, /function buildAudioAnalysisModuleMetrics\(signals, artifacts\)/);
  assert.match(processDelegatesSource, /function buildAudioAnalysisReportProjection\(runtime, project\)/);
  assert.match(hostCompositionSource, /shared\/host\/host-utils\.js/);
  assert.match(hostUtilsSource, /function getPreferredFeatureSourceKind\(featureId, sourcePresets\)/);
  assert.match(hostCompositionSource, /shared\/host\/action-composition\.js/);
  assert.match(actionCompositionSource, /export function createLaboratoryActionCompositionRuntime\(deps\)/);
  assert.match(
    actionRuntimeSource,
    /export function createLaboratoryHostActionRuntime\(\s*deps(?::[\s\S]+?)?\s*\)/
  );
  assert.match(actionRuntimeSource, /function getActionRouter\(\)/);
  assert.match(actionRuntimeSource, /from "\.\/action-router\.js"/);
  assert.match(actionRouterSource, /case "project-create":/);
});

test("laboratory UI keeps audio-analysis on the shared settings overlay with feature-aware defaults", () => {
  const uiSource = readFileSync("rooms/laboratory/ui/laboratory-ui-runtime.ts", "utf8");
  const viewBindingsRuntimeSource = readFileSync(
    "rooms/laboratory/ui/view-bindings-runtime.ts",
    "utf8"
  );
  const runtimeCompositionSource = readFileSync(
    "rooms/laboratory/ui/runtime-composition.ts",
    "utf8"
  );
  const viewAccessorsRuntimeSource = readFileSync(
    "rooms/laboratory/ui/view-accessors-runtime.ts",
    "utf8"
  );
  const copyRuntimeSource = readFileSync("rooms/laboratory/shared/ui/copy-runtime.ts", "utf8");
  const requestRuntimeSource = readFileSync(
    "rooms/laboratory/shared/ui/request-runtime.ts",
    "utf8"
  );
  const audioModuleSource = readFileSync(
    "rooms/laboratory/main-functions/audio-analysis/ui/module.ts",
    "utf8"
  );
  const audioCatalogRuntimeSource = readFileSync(
    "rooms/laboratory/main-functions/audio-analysis/ui/catalog-runtime.ts",
    "utf8"
  );
  const audioProviderRuntimeSource = readFileSync(
    "rooms/laboratory/main-functions/audio-analysis/ui/provider-runtime.ts",
    "utf8"
  );

  assert.match(uiSource, /const AUDIO_FEATURE_ID = "audio-analysis";/);
  assert.match(uiSource, /featureId: FEATURE_ID,/);
  assert.match(uiSource, /const FEATURE_NAMESPACES = \{/);
  assert.match(uiSource, /\[AUDIO_FEATURE_ID\]: "audioAnalysis"/);
  assert.match(uiSource, /\[SUBTITLE_FEATURE_ID\]: "subtitleAnalysis"/);
  assert.match(viewAccessorsRuntimeSource, /function getAudioAnalysisCapabilities\(\)/);
  assert.match(viewAccessorsRuntimeSource, /function getAudioAnalysisPresets\(\)/);
  assert.match(viewAccessorsRuntimeSource, /function getAudioAnalysisProviders\(\)/);
  assert.match(uiSource, /\.\/view-bindings-runtime\.js/);
  assert.match(viewBindingsRuntimeSource, /export function createLaboratoryViewBindingsRuntime\(deps\)/);
  assert.match(viewBindingsRuntimeSource, /createLaboratoryViewAccessorsRuntime\(/);
  assert.match(viewAccessorsRuntimeSource, /function getAudioAnalysisProviderEntries\(\)/);
  assert.match(audioModuleSource, /\.\/catalog-runtime\.js/);
  assert.match(audioModuleSource, /\.\/provider-runtime\.js/);
  assert.match(audioModuleSource, /\.\/result-runtime\.js/);
  assert.match(audioCatalogRuntimeSource, /export function createAudioAnalysisCatalogRuntime\(deps\)/);
  assert.match(audioProviderRuntimeSource, /export function createAudioAnalysisProviderRuntime\(deps\)/);
  assert.match(audioCatalogRuntimeSource, /featureText\(\["settings", "title"\]\)/);
  assert.match(uiSource, /renderAudioAnalysisCatalogPanel/);
  assert.match(uiSource, /renderAudioAnalysisProviderPanel/);
  assert.match(uiSource, /renderAudioAnalysisNoticePanel/);
  assert.match(uiSource, /shared\/ui\/copy-runtime\.js/);
  assert.match(copyRuntimeSource, /return filteredFormats\.length > 0 \? filteredFormats : \["audio", "video"\];/);
  assert.match(uiSource, /shared\/ui\/request-runtime\.js/);
  assert.match(requestRuntimeSource, /featureId: getActiveFeatureId\(\),/);
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
  const hostSource = readFileSync("rooms/laboratory/host/runtime.ts", "utf8");
  const hostFoundationSource = readFileSync("rooms/laboratory/host/foundation-runtimes.ts", "utf8");
  const hostProjectSource = readFileSync("rooms/laboratory/host/project-runtimes.ts", "utf8");
  const hostFeatureSource = readFileSync("rooms/laboratory/host/feature-runtimes.ts", "utf8");
  const featureAdaptersSource = readFileSync("rooms/laboratory/host/feature-adapters.ts", "utf8");
  const reportingSource = readFileSync("rooms/laboratory/shared/host/reporting.ts", "utf8");
  const reportingFeatureSource = readFileSync(
    "rooms/laboratory/shared/host/reporting-feature-report.ts",
    "utf8"
  );
  const reportingExportSource = readFileSync(
    "rooms/laboratory/shared/host/reporting-export.ts",
    "utf8"
  );
  const reportingAudioSource = readFileSync(
    "rooms/laboratory/shared/host/reporting-audio.ts",
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
  const roomSnapshotSource = readFileSync("rooms/laboratory/shared/host/room-snapshot.ts", "utf8");
  const audioProjectionSource = readFileSync(
    "rooms/laboratory/main-functions/audio-analysis/host/module-projection.ts",
    "utf8"
  );
  const audioProjectionCatalogSource = readFileSync(
    "rooms/laboratory/main-functions/audio-analysis/host/projection-catalog.ts",
    "utf8"
  );
  const audioProjectionResultsSource = readFileSync(
    "rooms/laboratory/main-functions/audio-analysis/host/projection-results.ts",
    "utf8"
  );
  const audioStateSource = readFileSync(
    "rooms/laboratory/main-functions/audio-analysis/host/state.ts",
    "utf8"
  );
  const audioHostModuleSource = readFileSync(
    "rooms/laboratory/main-functions/audio-analysis/host/process-runners.ts",
    "utf8"
  );
  const audioProcessLocalSource = readFileSync(
    "rooms/laboratory/main-functions/audio-analysis/host/process-local-runners.ts",
    "utf8"
  );
  const audioProcessModelSource = readFileSync(
    "rooms/laboratory/main-functions/audio-analysis/host/process-model-runners.ts",
    "utf8"
  );
  const audioProcessModelMusicSource = readFileSync(
    "rooms/laboratory/main-functions/audio-analysis/host/process-model-music-rhythm.ts",
    "utf8"
  );
  const audioProcessModelSoundEventsSource = readFileSync(
    "rooms/laboratory/main-functions/audio-analysis/host/process-model-sound-events.ts",
    "utf8"
  );
  const audioProcessModelSourceSeparationSource = readFileSync(
    "rooms/laboratory/main-functions/audio-analysis/host/process-model-source-separation.ts",
    "utf8"
  );
  const audioProcessModelSpeakerSource = readFileSync(
    "rooms/laboratory/main-functions/audio-analysis/host/process-model-speaker-diarization.ts",
    "utf8"
  );
  const audioProcessSupportSource = readFileSync(
    "rooms/laboratory/main-functions/audio-analysis/host/process-runner-support.ts",
    "utf8"
  );
  const audioUtilitySource = readFileSync(
    "rooms/laboratory/main-functions/audio-analysis/host/analysis-utils.ts",
    "utf8"
  );
  const audioParserSource = readFileSync(
    "rooms/laboratory/main-functions/audio-analysis/host/analysis-parsers.ts",
    "utf8"
  );
  const audioProbeSource = readFileSync(
    "rooms/laboratory/main-functions/audio-analysis/host/analysis-probes.ts",
    "utf8"
  );
  const audioProcessDelegatesSource = readFileSync(
    "rooms/laboratory/shared/host/audio-process-delegates.ts",
    "utf8"
  );
  const audioRuntimeSource = readFileSync(
    "rooms/laboratory/main-functions/audio-analysis/host/runtime.ts",
    "utf8"
  );
  const processCompositionSource = readFileSync(
    "rooms/laboratory/shared/host/process-composition.ts",
    "utf8"
  );
  const projectPathsSource = readFileSync("rooms/laboratory/shared/host/project-paths.ts", "utf8");
  const processDelegatesSource = readFileSync("rooms/laboratory/shared/host/process-delegates.ts", "utf8");
  const processOrchestrationSource = readFileSync(
    "rooms/laboratory/shared/host/process-orchestration.ts",
    "utf8"
  );
  const uiSource = readFileSync("rooms/laboratory/ui/laboratory-ui-runtime.ts", "utf8");
  const viewBindingsRuntimeSource = readFileSync(
    "rooms/laboratory/ui/view-bindings-runtime.ts",
    "utf8"
  );
  const runtimeCompositionSource = readFileSync(
    "rooms/laboratory/ui/runtime-composition.ts",
    "utf8"
  );
  const viewAccessorsRuntimeSource = readFileSync(
    "rooms/laboratory/ui/view-accessors-runtime.ts",
    "utf8"
  );
  const stageAccessorsRuntimeSource = readFileSync(
    "rooms/laboratory/ui/stage-accessors-runtime.ts",
    "utf8"
  );
  const audioUiRuntimeSource = readFileSync(
    "rooms/laboratory/ui/audio-analysis-runtime.ts",
    "utf8"
  );
  const ioRuntimeSource = readFileSync("rooms/laboratory/shared/host/io-runtime.ts", "utf8");
  const reportStageSource = readFileSync("rooms/laboratory/shared/ui/report-stage.ts", "utf8");
  const settingsOverlaySource = readFileSync("rooms/laboratory/shared/ui/settings-overlay.ts", "utf8");
  const settingsToolCardSource = readFileSync(
    "rooms/laboratory/shared/ui/settings-tool-card.ts",
    "utf8"
  );
  const audioModuleSource = readFileSync(
    "rooms/laboratory/main-functions/audio-analysis/ui/module.ts",
    "utf8"
  );
  const audioProviderRuntimeSource = readFileSync(
    "rooms/laboratory/main-functions/audio-analysis/ui/provider-runtime.ts",
    "utf8"
  );
  const audioResultRuntimeSource = readFileSync(
    "rooms/laboratory/main-functions/audio-analysis/ui/result-runtime.ts",
    "utf8"
  );
  const diarizationHelperSource = readFileSync(
    "rooms/laboratory/shared/data/tools/diarization/pyaudioanalysis_diarize.py",
    "utf8"
  );
  const musicHelperSource = readFileSync("rooms/laboratory/shared/data/tools/music/librosa_music_analysis.py", "utf8");
  const hostCompositionSource = [
    hostSource,
    hostFoundationSource,
    hostProjectSource,
    hostFeatureSource,
    featureAdaptersSource,
  ].join("\n");

  assert.match(hostCompositionSource, /shared\/host\/process-composition\.js/);
  assert.match(processCompositionSource, /from "\.\/reporting\.js"/);
  assert.match(processCompositionSource, /const laboratoryReportingRuntime = createLaboratoryReportingRuntime\(/);
  assert.match(audioRuntimeSource, /import { createLaboratoryAudioProcessDelegatesRuntime }/);
  assert.match(audioRuntimeSource, /const laboratoryAudioProcessDelegatesRuntime = createLaboratoryAudioProcessDelegatesRuntime\(/);
  assert.match(processDelegatesSource, /function buildAudioAnalysisReportProjection\(runtime, project\)/);
  assert.match(processOrchestrationSource, /export function createLaboratoryProcessOrchestrationRuntime\(deps\)/);
  assert.match(processOrchestrationSource, /function resolveProcessTarget\(project, featureId\)/);
  assert.match(processOrchestrationSource, /function buildMediaProcessModules\(runtime, project, target\)/);
  assert.match(processOrchestrationSource, /function buildAudioAnalysisModules\(runtime, project, target\)/);
  assert.match(processOrchestrationSource, /function buildProcessSpeechAvailability\(runtime, project\)/);
  assert.match(processDelegatesSource, /function composeAudioAnalysisReport\(runtime, project\)/);
  assert.match(reportingSource, /from "\.\/reporting-feature-report\.js"/);
  assert.match(reportingSource, /from "\.\/reporting-export\.js"/);
  assert.match(reportingFeatureSource, /from "\.\/reporting-audio\.js"/);
  assert.match(reportingFeatureSource, /from "\.\/reporting-markdown\.js"/);
  assert.match(reportingAudioSource, /const orderedResults = orderedIds\.concat\(extraIds\)\.map/);
  assert.match(reportingAudioSource, /function composeAudioAnalysisReport\(runtime, project\)/);
  assert.match(reportingMarkdownSource, /function buildReportMarkdown\(runtime, project, featureId, reportRecord\)/);
  assert.match(
    reportingFeatureSource,
    /function composeFeatureReport\(\s*runtime\??(?::[\s\S]+?)?,\s*project\??(?::[\s\S]+?)?,\s*featureId\??(?::[\s\S]+?)?\s*\)(?::[\s\S]+?)?/
  );
  assert.match(
    reportingExportSource,
    /async function exportFeatureReport\(\s*api\??(?::[\s\S]+?)?,\s*runtime\??(?::[\s\S]+?)?,\s*requestId\??(?::[\s\S]+?)?,\s*featureId\??(?::[\s\S]+?)?\s*\)(?::[\s\S]+?)?/
  );
  assert.match(reportingSubtitleSource, /export function createLaboratorySubtitleReportRuntime\(deps\)/);
  assert.match(audioProjectionSource, /const audioAnalysisProjectionCatalogRuntime = createAudioAnalysisProjectionCatalogRuntime\(/);
  assert.match(audioProjectionSource, /const audioAnalysisProjectionResultsRuntime = createAudioAnalysisProjectionResultsRuntime\(/);
  assert.match(audioProjectionSource, /const providerState = buildAudioAnalysisProviderState\(runtime, project\);/);
  assert.match(audioProjectionSource, /const capabilityState = buildAudioAnalysisCapabilityState\(runtime, project, target, providerState\);/);
  assert.match(audioProjectionCatalogSource, /function resolveAudioFeatureTarget\(project\)/);
  assert.match(audioProjectionCatalogSource, /const missingToolIds = requiredToolIds\.filter/);
  assert.match(audioProjectionResultsSource, /function buildAudioAnalysisModuleMetrics\(signals, artifacts\)/);
  assert.match(audioProjectionResultsSource, /function mapAudioAnalysisResultStatus\(processRecord, moduleEntry, capabilityEntry\)/);
  assert.match(hostCompositionSource, /shared\/host\/io-runtime\.js/);
  assert.match(
    ioRuntimeSource,
    /export function createLaboratoryHostIoRuntime\(\s*deps(?::[\s\S]+?)?\s*\)/
  );
  assert.match(
    ioRuntimeSource,
    /async function ensureRuntimeDirectory\(\s*dirPath\??(?::[\s\S]+?)?,\s*requestId\??(?::[\s\S]+?)?\s*\)(?::[\s\S]+?)?/
  );
  assert.match(
    audioProjectionCatalogSource,
    /function buildAudioAnalysisCapabilityState\(runtime, project, target, providerState\)/
  );
  assert.match(processCompositionSource, /main-functions\/audio-analysis\/host\/runtime\.js/);
  assert.match(audioRuntimeSource, /const audioAnalysisStateRuntime = createAudioAnalysisStateRuntime\(/);
  assert.match(audioRuntimeSource, /const audioAnalysisProjectionRuntime = createAudioAnalysisProjectionRuntime\(/);
  assert.match(audioRuntimeSource, /const audioAnalysisProcessRuntime = createAudioAnalysisProcessRuntime\(/);
  assert.match(audioRuntimeSource, /const laboratoryAudioProcessDelegatesRuntime = createLaboratoryAudioProcessDelegatesRuntime\(/);
  assert.match(
    audioProcessDelegatesSource,
    /function getAudioAnalysisModuleProcessDir\(\s*runtime,\s*project,\s*moduleId,?\s*\)/
  );
  assert.match(audioProcessDelegatesSource, /function getAudioAnalysisModuleRunner\(moduleId\)/);
  assert.match(audioProcessDelegatesSource, /async function generateProcessSpectrogram\(/);
  assert.match(audioRuntimeSource, /function getAudioAnalysisRequiredToolIds\(catalogEntry\)/);
  assert.match(hostCompositionSource, /shared\/host\/project-paths\.js/);
  assert.match(projectPathsSource, /function getAudioAnalysisDiarizationDir\(runtime\)/);
  assert.match(projectPathsSource, /function getAudioAnalysisDiarizationScriptPath\(runtime\)/);
  assert.match(projectPathsSource, /function getAudioAnalysisMusicDir\(runtime\)/);
  assert.match(projectPathsSource, /function getAudioAnalysisMusicScriptPath\(runtime\)/);
  assert.match(audioUtilitySource, /\.\/analysis-parsers\.js/);
  assert.match(audioUtilitySource, /\.\/analysis-probes\.js/);
  assert.match(audioParserSource, /export function createAudioAnalysisParserRuntime\(\)/);
  assert.match(audioProbeSource, /export function createAudioAnalysisProbeRuntime\(deps\)/);
  assert.match(
    audioParserSource,
    /function buildProsodySummaryFromCsv\(rawText(?:: [^)]+)?\)(?:: [^{]+)? \{/
  );
  assert.match(
    audioParserSource,
    /function buildEmotionHeuristicFromProsody\(\s*prosodySummary(?:: [^)]+)?\s*,?\s*\)(?:: [^{]+)? \{/
  );
  assert.match(audioProcessModelSource, /\.\/process-model-music-rhythm\.js/);
  assert.match(audioProcessModelSource, /\.\/process-model-sound-events\.js/);
  assert.match(audioProcessModelSource, /\.\/process-model-source-separation\.js/);
  assert.match(audioProcessModelSource, /\.\/process-model-speaker-diarization\.js/);
  assert.match(audioProcessModelSource, /createAudioAnalysisMusicRhythmModelRunner\(deps\)/);
  assert.match(audioProcessModelSpeakerSource, /async function runSpeakerDiarizationAudioAnalyzer\(/);
  assert.match(audioProcessLocalSource, /async function runProsodyAudioAnalyzer\(/);
  assert.match(audioProcessLocalSource, /async function runEmotionHeuristicAudioAnalyzer\(/);
  assert.match(audioProcessModelSoundEventsSource, /async function runSoundEventsAudioAnalyzer\(/);
  assert.match(audioProcessModelSourceSeparationSource, /async function runSourceSeparationAudioAnalyzer\(/);
  assert.match(audioProcessModelMusicSource, /async function runMusicRhythmAudioAnalyzer\(/);
  assert.match(audioProbeSource, /toolId: "opensmile"/);
  assert.match(audioProcessModelSoundEventsSource, /toolId: "yamnet"/);
  assert.match(audioProcessModelSpeakerSource, /toolId: "pyaudioanalysis"/);
  assert.match(audioProcessModelSourceSeparationSource, /toolId: "demucs"/);
  assert.match(audioProcessModelMusicSource, /toolId: "librosa"/);
  assert.match(audioProcessModelSpeakerSource, /const fallbackApplied = summaryPayload\.fallbackApplied === true;/);
  assert.match(audioProcessModelSpeakerSource, /pyAudioAnalysis HMM smoothing failed for this clip/);
  assert.match(audioHostModuleSource, /"speaker-diarization": runSpeakerDiarizationAudioAnalyzer/);
  assert.match(audioHostModuleSource, /prosody: runProsodyAudioAnalyzer/);
  assert.match(audioHostModuleSource, /emotion: runEmotionHeuristicAudioAnalyzer/);
  assert.match(audioHostModuleSource, /"sound-events": runSoundEventsAudioAnalyzer/);
  assert.match(audioHostModuleSource, /"source-separation": runSourceSeparationAudioAnalyzer/);
  assert.match(audioHostModuleSource, /"music-rhythm-tonal": runMusicRhythmAudioAnalyzer/);
  assert.match(audioStateSource, /providerType: asNonEmptyString\(source\.providerType\)/);
  assert.match(audioStateSource, /requiredToolIds: getAudioAnalysisRequiredToolIds\(catalog\)/);
  assert.match(audioStateSource, /export function createAudioAnalysisStateRuntime/);
  assert.doesNotMatch(hostCompositionSource, /ffmpegReady === true/);
  assert.match(
    audioParserSource,
    /function parseAspectralStatsText\(rawText(?:: [^)]+)?\)(?:: [^{]+)? \{/
  );
  assert.match(audioProcessSupportSource, /function generateSpectralDescriptorArtifact\(/);
  assert.match(audioProcessSupportSource, /aspectralstats=measure=centroid\+rolloff\+flatness\+flux/);
  assert.match(roomSnapshotSource, /availability: asNonEmptyString\(toolManifest\.availability\) \|\| "installable"/);
  assert.match(roomSnapshotSource, /commandName: asNonEmptyString\(systemCommand\.executableName\)/);
  assert.match(roomSnapshotSource, /setupHint: asNonEmptyString\(systemCommand\.setupHint\)/);
  assert.match(viewAccessorsRuntimeSource, /function getProjectAudioAnalysis\(\)/);
  assert.match(viewBindingsRuntimeSource, /getAudioAnalysisProviderEntries: function \(\)/);
  assert.match(diarizationHelperSource, /def should_retry_with_local_fallback/);
  assert.match(diarizationHelperSource, /def run_local_kmeans_diarization/);
  assert.match(diarizationHelperSource, /"fallbackApplied": fallback_applied/);
  assert.match(diarizationHelperSource, /datetime\.now\(dt\.UTC\)/);
  assert.match(musicHelperSource, /def to_scalar_float/);
  assert.match(musicHelperSource, /"tempoBpm": to_scalar_float\(tempo_bpm\)/);
  assert.match(musicHelperSource, /datetime\.now\(dt\.UTC\)/);
  assert.match(viewAccessorsRuntimeSource, /function getAudioAnalysisOrderedResultEntries\(\)/);
  assert.match(uiSource, /\.\/runtime-composition\.js/);
  assert.match(runtimeCompositionSource, /\.\/stage-accessors-runtime\.js/);
  assert.match(uiSource, /\.\/view-bindings-runtime\.js/);
  assert.match(stageAccessorsRuntimeSource, /function getCurrentFeatureTargetLabel\(\)/);
  assert.match(uiSource, /\.\/audio-analysis-runtime\.js/);
  assert.match(
    audioUiRuntimeSource,
    /export function createLaboratoryAudioAnalysisRuntime(?:<[\s\S]+?>)?\s*\(/
  );
  assert.match(audioUiRuntimeSource, /function renderAudioAnalysisModuleGrid\(\)/);
  assert.match(audioModuleSource, /function renderAudioAnalysisResultCard\(moduleEntry\)/);
  assert.match(audioModuleSource, /function renderAudioAnalysisModuleGrid\(\)/);
  assert.match(audioResultRuntimeSource, /export function createAudioAnalysisResultRuntime\(deps\)/);
  assert.match(reportStageSource, /isAudioAnalysisFeature\(\) \? renderAudioAnalysisModuleGrid\(\) : ""/);
  assert.match(audioProviderRuntimeSource, /featureText\(\["settings", "providersTitle"\]\)/);
  assert.match(settingsOverlaySource, /isAudioAnalysisFeature\(\) \? renderAudioAnalysisProviderPanel\(\) : ""/);
  assert.match(settingsOverlaySource, /\.\/settings-tool-card\.js/);
  assert.match(settingsToolCardSource, /const availability =/);
  assert.match(settingsToolCardSource, /const systemCommand = availability === "system-command";/);
  assert.match(settingsToolCardSource, /manualRefreshAction/);
});
