import assert from "node:assert/strict";
import test from "node:test";
import { createHash } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";

test("android companion keeps Vosk dictation and preview-active session contract wired", () => {
  const sessionSource = readFileSync(
    "android-companion/app/src/main/kotlin/com/hayaletev/androidcompanion/session/CompanionSessionCoordinator.kt",
    "utf8"
  );
  const transportSource = readFileSync(
    "android-companion/app/src/main/kotlin/com/hayaletev/androidcompanion/transport/DesktopBridgeClient.kt",
    "utf8"
  );
  const recorderSource = readFileSync(
    "android-companion/app/src/main/kotlin/com/hayaletev/androidcompanion/transcript/AndroidAudioRecorder.kt",
    "utf8"
  );
  const voskTranscriberSource = readFileSync(
    "android-companion/app/src/main/kotlin/com/hayaletev/androidcompanion/transcript/AndroidVoskTranscriber.kt",
    "utf8"
  );
  const voskProfileSource = readFileSync(
    "android-companion/app/src/main/kotlin/com/hayaletev/androidcompanion/transcript/AndroidVoskModelProfile.kt",
    "utf8"
  );
  const modelManagerSource = readFileSync(
    "android-companion/app/src/main/kotlin/com/hayaletev/androidcompanion/transcript/TranscriptModelManager.kt",
    "utf8"
  );
  const gradleSource = readFileSync("android-companion/app/build.gradle.kts", "utf8");
  const activitySource = readFileSync(
    "android-companion/app/src/main/kotlin/com/hayaletev/androidcompanion/MainActivity.kt",
    "utf8"
  );
  const captureServiceSource = readFileSync("electron/capture-service.ts", "utf8");

  assert.match(sessionSource, /previewActive = cameraController\.isPreviewBound\(\)/);
  assert.match(sessionSource, /cameraController\.stopSession\(\)/);
  assert.match(sessionSource, /applyCommandProfile\(command\.profile\)/);
  assert.match(sessionSource, /"start-dictation"/);
  assert.match(sessionSource, /"stop-dictation"/);
  assert.match(sessionSource, /requestId = command\.requestId \?: command\.id/);
  assert.match(sessionSource, /target = command\.target/);
  assert.match(sessionSource, /"speechBackend"/);
  assert.match(sessionSource, /\$\{modelProfile\.backend\}-android/);
  assert.match(sessionSource, /AndroidVoskTranscriber/);
  assert.match(sessionSource, /requireAndroidVoskModelProfile/);
  assert.doesNotMatch(sessionSource, /AndroidWhisperTranscriber/);
  assert.doesNotMatch(sessionSource, /whisperTranscriber/);
  assert.match(sessionSource, /BRIDGE_OFFLINE_RETRY_MS = 5_000L/);
  assert.match(sessionSource, /DIAGNOSTICS_SYNC_INTERVAL_MS = 15_000L/);
  assert.match(sessionSource, /bridgeConnected\.not\(\) && lastBridgeFailureSignature == null/);
  assert.match(sessionSource, /reportFailureToDiagnostics = false/);
  assert.match(sessionSource, /syncDiagnosticsSnapshotIfDue\(\)/);
  assert.match(sessionSource, /private fun publishUiState/);
  assert.match(
    sessionSource,
    /if \(command\.kind == "start-dictation"\) \{[\s\S]*audioRecorder\.cancel\(\)/
  );
  assert.match(sessionSource, /val dictationStatus: String\? = null/);
  assert.match(sessionSource, /R\.string\.dictation_status_recording/);
  assert.match(sessionSource, /R\.string\.dictation_status_transcribing/);
  assert.match(sessionSource, /R\.string\.dictation_status_done/);
  assert.match(sessionSource, /suspend fun captureManualPhoto\(\): File/);
  assert.match(sessionSource, /cameraController\.ensurePreview\(launchContext\.cameraConfig\)/);
  assert.match(sessionSource, /suspend fun uploadManualPhoto\(file: File\)/);
  assert.match(sessionSource, /stageForAnalyze = true/);

  assert.match(transportSource, /put\("previewActive", previewActive\)/);
  assert.match(transportSource, /put\("requestId", command\.requestId \?: command\.id\)/);
  assert.match(transportSource, /optJSONObject\("profile"\)/);
  assert.match(transportSource, /androidDictationBackend/);
  assert.match(transportSource, /archiveFormat/);
  assert.match(transportSource, /downloadTranscriptModel/);
  assert.match(transportSource, /modelDownloadClient/);
  assert.match(transportSource, /callTimeout\(5, TimeUnit\.MINUTES\)/);
  assert.match(transportSource, /val androidDictationBackend: String = "vosk"/);
  assert.match(transportSource, /reportFailureToDiagnostics: Boolean = true/);
  assert.match(
    transportSource,
    /postJson\("\/api\/v1\/session\/register", payload, reportFailureToDiagnostics\)/
  );
  assert.match(transportSource, /stageForAnalyze: Boolean = false/);
  assert.match(transportSource, /put\("stageForAnalyze", stageForAnalyze\)/);

  assert.match(recorderSource, /MediaRecorder\.AudioSource\.MIC/);
  assert.match(recorderSource, /android-dictation-/);
  assert.match(voskTranscriberSource, /org\.vosk\.Model/);
  assert.match(voskTranscriberSource, /Recognizer\(model, ANDROID_VOSK_SAMPLE_RATE\)/);
  assert.match(voskTranscriberSource, /recognizer\.acceptWaveForm/);
  assert.match(voskProfileSource, /defaultAndroidVoskModelProfile/);
  assert.match(voskProfileSource, /requireAndroidVoskModelProfile/);
  assert.match(voskProfileSource, /vosk-model-small-tr-0\.3\.zip/);
  assert.match(modelManagerSource, /archiveFormat == "zip-directory"/);
  assert.match(modelManagerSource, /suspend fun ensureLocalModel/);
  assert.match(modelManagerSource, /copyAssetModelIfAvailable/);
  assert.match(modelManagerSource, /Bundled local Vosk model checksum did not match/);
  assert.match(modelManagerSource, /Local \$\{profile\.backend\} model is not available/);
  assert.match(modelManagerSource, /ZipInputStream/);
  assert.match(modelManagerSource, /Vosk model archive contains an unsafe path/);
  assert.match(gradleSource, /abiFilters \+= listOf\("armeabi-v7a", "arm64-v8a"\)/);
  assert.match(gradleSource, /com\.alphacephei:vosk-android:0\.3\.75/);
  assert.doesNotMatch(gradleSource, /WHISPER_CPP_DIR/);
  assert.doesNotMatch(gradleSource, /externalNativeBuild/);
  assert.match(activitySource, /manualDictationToggleButton/);
  assert.match(activitySource, /manualDictationTranscriptValue/);
  assert.match(activitySource, /buildManualTranscriptModelProfile/);
  assert.match(activitySource, /manualModelManager\.ensureLocalModel\(profile\)/);
  assert.match(activitySource, /withTimeout\(MANUAL_DICTATION_TRANSCRIBE_TIMEOUT_MS\)/);
  assert.match(activitySource, /manualVoskTranscriber\.transcribe/);
  assert.match(activitySource, /manualDictationTranscriptValue\.setSelection\(0\)/);
  assert.match(activitySource, /manualDictationTranscriptValue\.scrollTo\(0, 0\)/);
  assert.match(activitySource, /hasDesktopSessionIntent\(intent\)/);
  assert.match(activitySource, /maybeStartPreviewAndSessionLoop\(\)/);
  assert.match(activitySource, /ensureCaptureForegroundService\(\)/);
  assert.match(activitySource, /configureManualImagePanel\(\)/);
  assert.match(activitySource, /imageCaptureButton\.setOnClickListener/);
  assert.match(activitySource, /takeManualImageCapture\(\)/);
  assert.match(activitySource, /addManualImageCapture\(\)/);
  assert.match(activitySource, /sessionCoordinator\.captureManualPhoto\(\)/);
  assert.match(activitySource, /sessionCoordinator\.uploadManualPhoto\(captureFile\)/);
  assert.match(activitySource, /Paused for manual dictation/);
  assert.doesNotMatch(activitySource, /manualModelManager\.ensureModel\(profile\)/);
  assert.doesNotMatch(activitySource, /AndroidWhisperTranscriber/);
  assert.doesNotMatch(activitySource, /ManualDictationBackend/);
  assert.match(activitySource, /defaultAndroidVoskModelProfile/);

  assert.match(captureServiceSource, /const previewActive =/);
  assert.match(captureServiceSource, /\/api\/v1\/transcript\/model/);
  assert.match(captureServiceSource, /CAPTURE_VOSK_MODEL_DESCRIPTORS/);
  assert.match(captureServiceSource, /return "vosk";/);
  assert.doesNotMatch(captureServiceSource, /commandKind === "open-camera"\s*\?\s*"ready"/);

  const bundledVoskModel = readFileSync(
    "android-companion/app/src/main/assets/transcript-models/vosk-model-small-tr-0.3.zip"
  );
  assert.equal(
    createHash("sha1").update(bundledVoskModel).digest("hex"),
    "1bc2391ea03d6091c39c4ff42b627c811501d41f"
  );
  assert.equal(
    existsSync(
      "android-companion/app/src/main/kotlin/com/hayaletev/androidcompanion/transcript/AndroidWhisperTranscriber.kt"
    ),
    false
  );
  assert.equal(existsSync("android-companion/app/src/main/cpp/native-lib.cpp"), false);
  assert.equal(existsSync("android-companion/app/src/main/cpp/CMakeLists.txt"), false);
});
