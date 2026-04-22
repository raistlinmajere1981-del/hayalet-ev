import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";

test("android companion keeps on-device speech and preview-active session contract wired", () => {
  const speechSource = readFileSync(
    "android-companion/app/src/main/kotlin/com/hayaletev/androidcompanion/speech/CommandSpeechController.kt",
    "utf8"
  );
  const sessionSource = readFileSync(
    "android-companion/app/src/main/kotlin/com/hayaletev/androidcompanion/session/CompanionSessionCoordinator.kt",
    "utf8"
  );
  const transportSource = readFileSync(
    "android-companion/app/src/main/kotlin/com/hayaletev/androidcompanion/transport/DesktopBridgeClient.kt",
    "utf8"
  );
  const captureServiceSource = readFileSync("electron/capture-service.ts", "utf8");

  assert.match(speechSource, /createOnDeviceSpeechRecognizer/);
  assert.match(speechSource, /isOnDeviceRecognitionAvailable/);
  assert.match(speechSource, /SpeechFallbackMode\.VOSK_SEAM/);
  assert.match(speechSource, /"open-camera"\s+to\s+openCamera/);

  assert.match(sessionSource, /previewActive = cameraController\.isPreviewBound\(\)/);
  assert.match(sessionSource, /cameraController\.stopSession\(\)/);
  assert.match(sessionSource, /applyCommandProfile\(command\.profile\)/);
  assert.match(sessionSource, /readPhraseList\("openCamera"\)/);
  assert.match(sessionSource, /"speechBackend"/);
  assert.match(sessionSource, /"commandCandidate"/);

  assert.match(transportSource, /put\("previewActive", previewActive\)/);
  assert.match(transportSource, /optJSONObject\("profile"\)/);

  assert.match(captureServiceSource, /const previewActive =/);
  assert.doesNotMatch(captureServiceSource, /commandKind === "open-camera"\s*\?\s*"ready"/);
});
