import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";

test("analyze page wires central capture inbox imports into staged attachments", () => {
  const htmlSource = readFileSync("src/pages/analyze.html", "utf8");
  const pageSource = readFileSync("src/js/pages/analyze.ts", "utf8");
  const uploadSource = readFileSync("src/js/pages/analyze/upload-handler.ts", "utf8");
  const captureClientSource = readFileSync("src/js/modules/capture/electron-client.ts", "utf8");
  const dictationUiSource = readFileSync("src/js/modules/transcript/dictation-ui.ts", "utf8");
  const voiceCommandMatcherSource = readFileSync(
    "src/js/modules/transcript/voice-command-matcher.ts",
    "utf8"
  );
  const captureServiceSource = readFileSync("electron/capture-service.ts", "utf8");
  const commandCatalogSource = readFileSync("shared/capture/command-catalog.ts", "utf8");
  const companionCoordinatorSource = readFileSync(
    "android-companion/app/src/main/kotlin/com/hayaletev/androidcompanion/session/CompanionSessionCoordinator.kt",
    "utf8"
  );
  const settingsTypeSource = readFileSync("src/types/settings.ts", "utf8");
  const settingsDefaultsSource = readFileSync("src/types/settings-defaults.ts", "utf8");
  const settingsSchemaSource = readFileSync("src/js/modules/settings/settings-schema.ts", "utf8");

  assert.match(htmlSource, /id="capture-import-btn"/);
  assert.match(htmlSource, /class="compose-user-header"/);
  assert.match(htmlSource, /id="compose-android-status"/);
  assert.match(htmlSource, /id="compose-ambient-btn"/);
  assert.match(htmlSource, /id="compose-ambient-status"/);
  assert.match(htmlSource, /id="android-camera-panel"/);
  assert.match(htmlSource, /id="android-camera-feed"/);
  assert.doesNotMatch(htmlSource, /compose-user-identity/);
  assert.doesNotMatch(htmlSource, /id="analyze-capture-shell"/);
  assert.doesNotMatch(htmlSource, /id="capture-clear-btn"/);
  assert.doesNotMatch(htmlSource, /id="capture-panel-close-btn"/);
  assert.doesNotMatch(htmlSource, /id="capture-photo-btn"/);
  assert.doesNotMatch(htmlSource, /id="capture-session-btn"/);
  assert.doesNotMatch(htmlSource, /id="capture-stop-btn"/);
  assert.doesNotMatch(htmlSource, /id="analyze-capture-latest-image"/);
  assert.match(pageSource, /consumeAnalyzeCaptureAssets/);
  assert.match(pageSource, /handleCaptureImportClick/);
  assert.match(pageSource, /renderCaptureSessionState/);
  assert.match(pageSource, /onCaptureMediaIngress/);
  assert.match(pageSource, /onCapturePreviewFrame/);
  assert.match(pageSource, /_handleCaptureMediaIngress/);
  assert.match(pageSource, /_handleCapturePreviewFrame/);
  assert.match(pageSource, /toggleAndroidCameraPanel/);
  assert.match(pageSource, /_stageCaptureAsset/);
  assert.match(pageSource, /openAndroidCameraManagement/);
  assert.doesNotMatch(pageSource, /_openCapturePanel/);
  assert.doesNotMatch(pageSource, /_closeCapturePanel/);
  assert.doesNotMatch(pageSource, /clearCapturePreview/);
  assert.match(pageSource, /capture-analyze-photo/);
  assert.match(pageSource, /start-analyze-preview/);
  assert.match(pageSource, /stop-analyze-preview/);
  assert.match(pageSource, /start-analyze-session/);
  assert.match(pageSource, /stop-analyze-session/);
  assert.match(pageSource, /_syncVoiceCommandSettings/);
  assert.match(pageSource, /path\.startsWith\("voiceCommands"\)/);
  assert.match(pageSource, /onCaptureAmbientStatus/);
  assert.match(pageSource, /_handleAmbientTranscriptIngress/);
  assert.match(pageSource, /_stripAmbientWakePhrase/);
  assert.match(pageSource, /_parseAmbientDictationIntent/);
  assert.match(pageSource, /_announceAmbientFeedback/);
  assert.match(pageSource, /_playAmbientFeedbackTone/);
  assert.match(pageSource, /ANALYZE_AMBIENT_DICTATION_PREFIXES/);
  assert.match(pageSource, /start-ambient-listener/);
  assert.match(pageSource, /stop-ambient-listener/);
  assert.match(
    pageSource,
    /matchVoiceCommand\(payload\.text, this\._buildAnalyzeVoiceCommandSpecs\(\)\)/
  );
  assert.match(pageSource, /payload\.target !== "analyze-compose"/);
  assert.match(pageSource, /payload\.requestId !== this\._ambientRequestId/);
  assert.match(pageSource, /requireEnabled: false/);
  assert.match(pageSource, /ambientFeedback: true/);
  assert.match(pageSource, /ambientCommandDetectedMessage/);
  assert.match(pageSource, /ambientDictationInsertedMessage/);
  assert.doesNotMatch(pageSource, /import-capture/);
  assert.doesNotMatch(pageSource, /\{\s*id:\s*"retake"/);
  assert.doesNotMatch(pageSource, /\{\s*id:\s*"attach"/);
  assert.doesNotMatch(pageSource, /\{\s*id:\s*"cancel"/);
  assert.match(voiceCommandMatcherSource, /\.normalize\("NFD"\)/);
  assert.match(voiceCommandMatcherSource, /\[ıİ\]/);
  assert.doesNotMatch(commandCatalogSource, /^\s*(retake|attach|cancel):/m);
  assert.match(companionCoordinatorSource, /stageForAnalyze = true/);
  assert.match(pageSource, /page\.captureImport\.success/);
  assert.match(uploadSource, /export function mergeUploadFiles/);
  assert.match(captureClientSource, /captureConsumeAnalyzeAssets/);
  assert.match(captureClientSource, /captureStartAnalyzeSession/);
  assert.match(captureClientSource, /captureStopAnalyzeSession/);
  assert.match(captureClientSource, /captureStartAnalyzePreview/);
  assert.match(captureClientSource, /captureStopAnalyzePreview/);
  assert.match(captureClientSource, /captureStartAmbientListener/);
  assert.match(captureClientSource, /captureStopAmbientListener/);
  assert.match(captureClientSource, /onCapturePreviewFrame/);
  assert.match(captureClientSource, /onCaptureAmbientStatus/);
  assert.match(captureClientSource, /captureRequestAnalyzePhoto/);
  assert.match(captureServiceSource, /consumeAnalyzeInboxAssets/);
  assert.match(captureServiceSource, /api\/v1\/media\/analyze/);
  assert.match(captureServiceSource, /api\/v1\/preview\/analyze/);
  assert.match(captureServiceSource, /api\/v1\/transcript\/ingress/);
  assert.match(captureServiceSource, /api\/v1\/ambient\/status/);
  assert.match(captureServiceSource, /CAPTURE_MEDIA_INGRESS_CHANNEL = "capture:media-ingress"/);
  assert.match(captureServiceSource, /CAPTURE_PREVIEW_FRAME_CHANNEL = "capture:preview-frame"/);
  assert.match(captureServiceSource, /CAPTURE_AMBIENT_STATUS_CHANNEL = "capture:ambient-status"/);
  assert.match(captureServiceSource, /normalizeTranscriptTarget/);
  assert.match(captureServiceSource, /requestId and target are required/);
  assert.match(
    captureServiceSource,
    /const hasActiveRequest = this\.activeAnalyzeMediaRequestIds\.has\(requestId\)/
  );
  assert.match(captureServiceSource, /const stageForAnalyze = body\["stageForAnalyze"\] === true/);
  assert.match(captureServiceSource, /stageForAnalyze !== true \|\| activeSession === null/);
  assert.match(
    captureServiceSource,
    /stageForAnalyze === true \|\| captureSettings\.attachMode === "auto-stage"/
  );
  assert.match(captureServiceSource, /metadata:[\s\S]*stageForAnalyze/);
  assert.match(captureServiceSource, /Analyze capture request is not active/);
  assert.match(
    captureServiceSource,
    /activeAnalyzeMediaRequestIds\.add\(getCommandRequestId\(command\)\)/
  );
  assert.match(captureServiceSource, /statusText === "failed" \|\| statusText === "done"/);
  assert.match(captureServiceSource, /this\.analyzeState\.state === "result-ready"/);
  assert.match(captureServiceSource, /target !== CAPTURE_ANALYZE_TARGET/);
  assert.match(captureServiceSource, /open-camera/);
  assert.match(captureServiceSource, /close-camera/);
  assert.match(captureServiceSource, /start-dictation/);
  assert.match(captureServiceSource, /stop-dictation/);
  assert.match(captureServiceSource, /start-preview-stream/);
  assert.match(captureServiceSource, /stop-preview-stream/);
  assert.match(captureServiceSource, /start-ambient-listener/);
  assert.match(captureServiceSource, /stop-ambient-listener/);
  assert.match(captureServiceSource, /resolveAmbientCommandProfile/);
  assert.match(captureServiceSource, /cancelAnalyzeDictation/);
  assert.match(captureServiceSource, /am", "force-stop", CAPTURE_ANDROID_COMPANION_PACKAGE/);
  assert.match(captureClientSource, /captureCancelAnalyzeDictation/);
  assert.match(pageSource, /cancelAndroidDictation/);
  assert.match(captureServiceSource, /previewActive/);
  assert.match(captureServiceSource, /transcriptModel/);
  assert.match(settingsTypeSource, /transcriptBackend\?: TranscriptDictationBackend/);
  assert.match(settingsTypeSource, /androidTranscriptModelVariant\?: TranscriptModelVariant/);
  assert.match(settingsTypeSource, /androidDictationBackend\?: AndroidDictationBackend/);
  assert.match(settingsTypeSource, /ambient\?: VoiceCommandAmbientSettings/);
  assert.match(settingsDefaultsSource, /androidTranscriptModelVariant: "light"/);
  assert.match(settingsDefaultsSource, /androidDictationBackend: "vosk"/);
  assert.match(settingsDefaultsSource, /DEFAULT_AMBIENT_WAKE_PHRASES/);
  assert.match(settingsSchemaSource, /androidTranscriptModelVariant:[\s\S]*"light"/);
  assert.match(
    settingsSchemaSource,
    /androidDictationBackend:[\s\S]*normalizeAndroidDictationBackend/
  );
  assert.match(captureServiceSource, /defaults\["androidTranscriptModelVariant"\][\s\S]*"light"/);
  assert.match(captureServiceSource, /defaults\?\.\["androidDictationBackend"\]/);
  assert.match(captureServiceSource, /androidDictationBackend: settings\.androidDictationBackend/);
  assert.match(settingsSchemaSource, /normalizeAmbientWakePhrases/);
  assert.match(settingsSchemaSource, /DEFAULT_AMBIENT_ACTIVE_WINDOW_MS/);
  assert.match(captureServiceSource, /return "vosk";/);
  assert.match(captureServiceSource, /vosk-model-small-tr-0\.3\.zip/);
  assert.match(captureServiceSource, /ensureDirectCompanionModelArchive/);
  assert.doesNotMatch(
    captureServiceSource,
    /normalizeTranscriptModelVariant\(general\["transcriptModelVariant"\], "full"\)/
  );
  assert.doesNotMatch(captureServiceSource, /commandCatalogJson/);
  assert.match(captureClientSource, /"error" in value/);
  assert.match(captureServiceSource, /summarizeCompanionBuildFailure/);
  assert.match(
    dictationUiSource,
    /activeAndroidRequestId = requestId;[\s\S]*await options\.requestAndroidDictation\?\.\(\{[\s\S]*action: "start"/
  );
  assert.match(dictationUiSource, /payload\.status === "started"[\s\S]*currentState = "listening"/);
  assert.match(dictationUiSource, /ANDROID_TRANSCRIPTION_TIMEOUT_MS = 35_000/);
  assert.match(dictationUiSource, /scheduleAndroidTranscriptionTimeout/);
  assert.match(
    dictationUiSource,
    /cancelAndroidTranscription\(requestId, options\.getLabels\(\)\.androidTimeoutMessage\)/
  );
  assert.match(
    dictationUiSource,
    /button\.disabled = state === "transcribing" && mode !== "android"/
  );
  assert.match(dictationUiSource, /transcriptionBackend: transcription\.backend/);
  assert.match(dictationUiSource, /transcriptionMs: transcription\.transcriptionMs/);
  assert.match(dictationUiSource, /if \(result === "ready"\)[\s\S]*currentState = "listening"/);
  assert.match(
    dictationUiSource,
    /currentState = "listening";[\s\S]*labels\.androidPreparingMessage/
  );
  assert.match(
    dictationUiSource,
    /currentState === "listening" \|\| currentState === "transcribing"/
  );
  assert.match(captureServiceSource, /requirePreviewActive: false/);
  assert.match(captureServiceSource, /requireSession: false/);
  assert.doesNotMatch(pageSource, /captureState === "pending-launch"[\s\S]*return "starting"/);
});
