import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";

test("android companion diagnostics panel stays wired across ui and runtime flows", () => {
  const layoutSource = readFileSync(
    "android-companion/app/src/main/res/layout/activity_main.xml",
    "utf8"
  );
  const stringsSource = readFileSync(
    "android-companion/app/src/main/res/values/strings.xml",
    "utf8"
  );
  const diagnosticsSource = readFileSync(
    "android-companion/app/src/main/kotlin/com/hayaletev/androidcompanion/debug/CompanionDiagnostics.kt",
    "utf8"
  );
  const manifestSource = readFileSync(
    "android-companion/app/src/main/AndroidManifest.xml",
    "utf8"
  );
  const networkSecurityConfigSource = readFileSync(
    "android-companion/app/src/main/res/xml/network_security_config.xml",
    "utf8"
  );
  const activitySource = readFileSync(
    "android-companion/app/src/main/kotlin/com/hayaletev/androidcompanion/MainActivity.kt",
    "utf8"
  );
  const captureServiceSource = readFileSync("electron/capture-service.ts", "utf8");
  const sessionSource = readFileSync(
    "android-companion/app/src/main/kotlin/com/hayaletev/androidcompanion/session/CompanionSessionCoordinator.kt",
    "utf8"
  );
  const transportSource = readFileSync(
    "android-companion/app/src/main/kotlin/com/hayaletev/androidcompanion/transport/DesktopBridgeClient.kt",
    "utf8"
  );
  const cameraSource = readFileSync(
    "android-companion/app/src/main/kotlin/com/hayaletev/androidcompanion/capture/CameraSessionController.kt",
    "utf8"
  );
  const speechSource = readFileSync(
    "android-companion/app/src/main/kotlin/com/hayaletev/androidcompanion/speech/CommandSpeechController.kt",
    "utf8"
  );

  assert.match(layoutSource, /id="@\+id\/diagnosticsPanel"/);
  assert.match(layoutSource, /id="@\+id\/diagnosticsSummaryValue"/);
  assert.match(layoutSource, /id="@\+id\/diagnosticsLogsValue"/);
  assert.match(layoutSource, /id="@\+id\/diagnosticsCopyButton"/);
  assert.match(layoutSource, /id="@\+id\/diagnosticsShareButton"/);
  assert.match(layoutSource, /id="@\+id\/diagnosticsClearButton"/);

  assert.match(stringsSource, /name="diagnostics_label"/);
  assert.match(stringsSource, /name="diagnostics_copy"/);
  assert.match(stringsSource, /name="diagnostics_share"/);
  assert.match(manifestSource, /android:networkSecurityConfig="@xml\/network_security_config"/);
  assert.match(manifestSource, /android:usesCleartextTraffic="true"/);
  assert.match(networkSecurityConfigSource, /cleartextTrafficPermitted="true"/);

  assert.match(diagnosticsSource, /MAX_LOG_ENTRIES = 400/);
  assert.match(diagnosticsSource, /fun buildShareText\(\): String/);
  assert.match(diagnosticsSource, /fun buildSnapshotPayload\(deviceId: String\): JSONObject/);
  assert.match(diagnosticsSource, /fun interface CompanionDiagnosticsListener/);
  assert.match(diagnosticsSource, /Log\.e\(LOG_TAG, message\)/);

  assert.match(activitySource, /CompanionDiagnostics\.addListener\(diagnosticsListener\)/);
  assert.match(activitySource, /configureDiagnosticsPanel\(\)/);
  assert.match(activitySource, /copyDiagnosticsToClipboard\(\)/);
  assert.match(activitySource, /shareDiagnostics\(\)/);
  assert.match(activitySource, /CompanionDiagnostics\.buildShareText\(\)/);

  assert.match(sessionSource, /CompanionDiagnostics\.i\(\s*"session"/);
  assert.match(sessionSource, /CompanionDiagnostics\.w\(\s*"bridge"/);
  assert.match(sessionSource, /CompanionDiagnostics\.e\(\s*"command"/);
  assert.match(sessionSource, /syncDiagnosticsSnapshot\(\)/);
  assert.match(sessionSource, /bridgeClient\.submitDiagnosticsSnapshot\(launchContext\.deviceId\)/);
  assert.doesNotMatch(sessionSource, /catch \(_: Exception\)/);

  assert.match(captureServiceSource, /\/api\/v1\/diagnostics\/snapshot/);
  assert.match(captureServiceSource, /writeCompanionDiagnosticsShadowSnapshot/);
  assert.match(captureServiceSource, /Paths\.getLogsDir\(\),\s*"android-companion"/);

  assert.match(transportSource, /CompanionDiagnostics\.e\("bridge", "GET \$path failed\."/);
  assert.match(transportSource, /CompanionDiagnostics\.i\(\s*"bridge",\s*"Acknowledged command/);
  assert.match(transportSource, /fun submitDiagnosticsSnapshot\(deviceId: String\)/);
  assert.match(transportSource, /reportFailureToDiagnostics = false/);

  assert.match(cameraSource, /CompanionDiagnostics\.i\("camera", "Binding camera preview\."/);
  assert.match(cameraSource, /CompanionDiagnostics\.e\("camera", "Photo capture failed\."/);

  assert.match(speechSource, /CompanionDiagnostics\.w\("speech", "Speech recognizer reported error code/);
  assert.match(speechSource, /CompanionDiagnostics\.setState\("Speech backend"/);
});
