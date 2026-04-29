import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";

test("analyze page wires central capture inbox imports into staged attachments", () => {
  const htmlSource = readFileSync("src/pages/analyze.html", "utf8");
  const pageSource = readFileSync("src/js/pages/analyze.ts", "utf8");
  const uploadSource = readFileSync("src/js/pages/analyze/upload-handler.ts", "utf8");
  const captureClientSource = readFileSync("src/js/modules/capture/electron-client.ts", "utf8");
  const dictationUiSource = readFileSync("src/js/modules/transcript/dictation-ui.ts", "utf8");
  const captureServiceSource = readFileSync("electron/capture-service.ts", "utf8");

  assert.match(htmlSource, /id="capture-import-btn"/);
  assert.match(htmlSource, /id="analyze-capture-shell" hidden/);
  assert.match(htmlSource, /id="capture-session-btn"/);
  assert.match(htmlSource, /id="capture-stop-btn"/);
  assert.match(htmlSource, /id="capture-photo-btn"/);
  assert.match(htmlSource, /id="analyze-capture-latest-image"/);
  assert.match(pageSource, /consumeAnalyzeCaptureAssets/);
  assert.match(pageSource, /handleCaptureImportClick/);
  assert.match(pageSource, /renderCaptureSessionState/);
  assert.match(pageSource, /capture-analyze-photo/);
  assert.match(pageSource, /start-analyze-session/);
  assert.match(pageSource, /stop-analyze-session/);
  assert.match(pageSource, /page\.captureImport\.success/);
  assert.match(uploadSource, /export function mergeUploadFiles/);
  assert.match(captureClientSource, /captureConsumeAnalyzeAssets/);
  assert.match(captureClientSource, /captureStartAnalyzeSession/);
  assert.match(captureClientSource, /captureStopAnalyzeSession/);
  assert.match(captureClientSource, /captureRequestAnalyzePhoto/);
  assert.match(captureServiceSource, /consumeAnalyzeInboxAssets/);
  assert.match(captureServiceSource, /api\/v1\/media\/analyze/);
  assert.match(captureServiceSource, /api\/v1\/transcript\/ingress/);
  assert.match(captureServiceSource, /CAPTURE_MEDIA_INGRESS_CHANNEL = "capture:media-ingress"/);
  assert.match(captureServiceSource, /normalizeTranscriptTarget/);
  assert.match(captureServiceSource, /requestId and target are required/);
  assert.match(captureServiceSource, /activeAnalyzeMediaRequestIds\.has\(requestId\)/);
  assert.match(captureServiceSource, /Analyze capture request is not active/);
  assert.match(captureServiceSource, /activeAnalyzeMediaRequestIds\.add\(getCommandRequestId\(command\)\)/);
  assert.match(captureServiceSource, /statusText === "failed" \|\| statusText === "done"/);
  assert.match(captureServiceSource, /this\.analyzeState\.state === "result-ready"/);
  assert.match(captureServiceSource, /target !== CAPTURE_ANALYZE_TARGET/);
  assert.match(captureServiceSource, /open-camera/);
  assert.match(captureServiceSource, /close-camera/);
  assert.match(captureServiceSource, /start-dictation/);
  assert.match(captureServiceSource, /stop-dictation/);
  assert.match(captureServiceSource, /previewActive/);
  assert.match(captureServiceSource, /transcriptModel/);
  assert.doesNotMatch(captureServiceSource, /commandCatalogJson/);
  assert.match(captureClientSource, /"error" in value/);
  assert.match(captureServiceSource, /summarizeCompanionBuildFailure/);
  assert.match(
    dictationUiSource,
    /activeAndroidRequestId = requestId;[\s\S]*await options\.requestAndroidDictation\?\.\(\{[\s\S]*action: "start"/
  );
  assert.match(dictationUiSource, /payload\.status === "started"[\s\S]*currentState = "listening"/);
  assert.match(dictationUiSource, /if \(result === "ready"\)[\s\S]*currentState = "listening"/);
  assert.match(dictationUiSource, /currentState = "transcribing";[\s\S]*labels\.androidPreparingMessage/);
  assert.match(dictationUiSource, /currentState === "listening" \|\| currentState === "transcribing"/);
  assert.doesNotMatch(pageSource, /captureState === "pending-launch"[\s\S]*return "starting"/);
});
