import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";

test("analyze page wires central capture inbox imports into staged attachments", () => {
  const htmlSource = readFileSync("src/pages/analyze.html", "utf8");
  const pageSource = readFileSync("src/js/pages/analyze.ts", "utf8");
  const uploadSource = readFileSync("src/js/pages/analyze/upload-handler.ts", "utf8");
  const captureClientSource = readFileSync("src/js/modules/capture/electron-client.ts", "utf8");
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
  assert.match(captureServiceSource, /open-camera/);
  assert.match(captureServiceSource, /close-camera/);
  assert.match(captureServiceSource, /previewActive/);
  assert.match(captureServiceSource, /commandCatalogJson/);
  assert.match(captureClientSource, /"error" in value/);
  assert.match(captureServiceSource, /summarizeCompanionBuildFailure/);
});
