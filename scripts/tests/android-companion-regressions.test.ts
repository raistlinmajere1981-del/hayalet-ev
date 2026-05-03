import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";

test("android companion keeps whisper.cpp dictation and preview-active session contract wired", () => {
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
  const transcriberSource = readFileSync(
    "android-companion/app/src/main/kotlin/com/hayaletev/androidcompanion/transcript/AndroidWhisperTranscriber.kt",
    "utf8"
  );
  const nativeSource = readFileSync("android-companion/app/src/main/cpp/native-lib.cpp", "utf8");
  const gradleSource = readFileSync("android-companion/app/build.gradle.kts", "utf8");
  const captureServiceSource = readFileSync("electron/capture-service.ts", "utf8");

  assert.match(sessionSource, /previewActive = cameraController\.isPreviewBound\(\)/);
  assert.match(sessionSource, /cameraController\.stopSession\(\)/);
  assert.match(sessionSource, /applyCommandProfile\(command\.profile\)/);
  assert.match(sessionSource, /"start-dictation"/);
  assert.match(sessionSource, /"stop-dictation"/);
  assert.match(sessionSource, /requestId = command\.requestId \?: command\.id/);
  assert.match(sessionSource, /target = command\.target/);
  assert.match(sessionSource, /"speechBackend"/);
  assert.match(sessionSource, /"whisper\.cpp-android"/);
  assert.match(sessionSource, /if \(command\.kind == "start-dictation"\) \{[\s\S]*audioRecorder\.cancel\(\)/);

  assert.match(transportSource, /put\("previewActive", previewActive\)/);
  assert.match(transportSource, /put\("requestId", command\.requestId \?: command\.id\)/);
  assert.match(transportSource, /optJSONObject\("profile"\)/);
  assert.match(transportSource, /downloadTranscriptModel/);

  assert.match(recorderSource, /MediaRecorder\.AudioSource\.MIC/);
  assert.match(recorderSource, /android-dictation-/);
  assert.match(transcriberSource, /System\.loadLibrary\("hayalet_whisper"\)/);
  assert.match(nativeSource, /whisper_full_default_params/);
  assert.match(nativeSource, /whisper_full_get_segment_text/);
  assert.match(gradleSource, /abiFilters \+= listOf\("armeabi-v7a", "arm64-v8a"\)/);

  assert.match(captureServiceSource, /const previewActive =/);
  assert.match(captureServiceSource, /\/api\/v1\/transcript\/model/);
  assert.doesNotMatch(captureServiceSource, /commandKind === "open-camera"\s*\?\s*"ready"/);
});
