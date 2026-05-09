import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";

test("settings theme panel wires scene theme management UI", () => {
  const htmlSource = readFileSync("src/pages/settings.html", "utf8");
  const appSource = readFileSync("src/js/pages/settings/app.ts", "utf8");
  const controllerSource = readFileSync("src/js/pages/settings/controller.ts", "utf8");
  const initSource = readFileSync("src/js/pages/settings/panels/init.ts", "utf8");
  const panelSource = readFileSync("src/js/pages/settings/panels/theme.ts", "utf8");

  assert.match(htmlSource, /id="scene-theme-current-name"/);
  assert.match(htmlSource, /id="scene-theme-current-meta"/);
  assert.match(htmlSource, /id="scene-theme-selection-hint"/);
  assert.match(htmlSource, /id="scene-theme-import"/);
  assert.match(htmlSource, /id="scene-theme-refresh"/);
  assert.match(htmlSource, /id="scene-theme-export"/);
  assert.match(htmlSource, /id="scene-theme-apply"/);
  assert.match(htmlSource, /id="scene-theme-settings-list"/);

  assert.match(appSource, /import\s+\{\s*setupSettingsPanels\s*\}\s+from\s+"\.\/panels\/init\.js"/);
  assert.match(appSource, /setupSettingsPanels\(\);/);
  assert.match(initSource, /import\s+\{\s*setupSettingsThemePanel\s*\}\s+from\s+"\.\/theme\.js"/);
  assert.match(initSource, /setupSettingsThemePanel\(\);/);

  assert.match(panelSource, /registerSettingsPanelLifecycle\("theme"/);
  assert.match(panelSource, /SceneThemeManager\.setCurrentTheme/);
  assert.match(panelSource, /syncInstalledSceneThemeRegistrationsFromElectron/);
  assert.match(panelSource, /sceneThemesImportBundle/);
  assert.match(panelSource, /sceneThemesPackageInstalled/);
  assert.match(controllerSource, /SceneUiScaleManager\.onChange\(\(\) => \{/);
  assert.match(controllerSource, /this\.sync\(this\.state\);/);
});

test("settings language panel wires tab, panel, and renderer bootstrap", () => {
  const htmlSource = readFileSync("src/pages/settings.html", "utf8");
  const appSource = readFileSync("src/js/pages/settings/app.ts", "utf8");
  const pageInitSource = readFileSync("src/js/app/page-init.ts", "utf8");
  const initSource = readFileSync("src/js/pages/settings/panels/init.ts", "utf8");
  const panelSource = readFileSync("src/js/pages/settings/panels/languages.ts", "utf8");

  assert.match(htmlSource, /id="settings-tab-languages"/);
  assert.match(htmlSource, /data-settings-panel="languages"/);
  assert.match(htmlSource, /id="settings-panel-languages"/);
  assert.match(htmlSource, /id="language-editor-entry-list"/);
  assert.match(htmlSource, /id="language-editor-meta"/);

  assert.match(appSource, /import\s+\{\s*setupSettingsPanels\s*\}\s+from\s+"\.\/panels\/init\.js"/);
  assert.match(appSource, /setupSettingsPanels\(\);/);
  assert.match(
    pageInitSource,
    /import\s+\{\s*setupSettingsPanels\s*\}\s+from\s+"\.\.\/pages\/settings\/panels\/init\.js"/
  );
  assert.match(pageInitSource, /setupSettingsPanels\(\);/);

  assert.match(
    initSource,
    /import\s+\{\s*setupSettingsLanguagesPanel\s*\}\s+from\s+"\.\/languages\.js"/
  );
  assert.match(initSource, /setupSettingsLanguagesPanel\(\);/);
  assert.match(initSource, /setupSettingsThemePanel\(\);/);

  assert.match(panelSource, /registerSettingsPanelLifecycle\("languages"/);
  assert.match(
    panelSource,
    /state\.scope === "app" \? languageEditorT\("scope\.app"\) : languageEditorT\("scope\.rooms"\)/
  );
  assert.match(
    panelSource,
    /if \(action === "refresh"\) \{[\s\S]*void refreshSources\(refs, state, \{\s*forceRoomRefresh: state\.scope === "room",\s*reloadData: true,\s*\}\);/
  );
  assert.match(
    panelSource,
    /registerSettingsPanelLifecycle\("languages", \{[\s\S]*onActivate: \(\) => \{[\s\S]*void refreshSources\(refs, state, \{ reloadData: false \}\);[\s\S]*onDeactivate:/
  );
  assert.match(panelSource, /joinPath\(selectedRoom\.i18nBaseDir, `\$\{locale\}\.json`\)/);
});

test("settings capture panel centralizes transcript runtime and android management wiring", () => {
  const htmlSource = readFileSync("src/pages/settings.html", "utf8");
  const controllerSource = readFileSync("src/js/pages/settings/controller.ts", "utf8");
  const initSource = readFileSync("src/js/pages/settings/panels/init.ts", "utf8");
  const panelSource = readFileSync("src/js/pages/settings/panels/capture.ts", "utf8");
  const transcriptSource = readFileSync(
    "src/js/pages/settings/capture/transcript-runtime-panel.ts",
    "utf8"
  );
  const userPanelSource = readFileSync("src/js/pages/settings/accounts/user-panel.ts", "utf8");

  assert.match(htmlSource, /id="settings-tab-capture"/);
  assert.match(htmlSource, /id="settings-panel-capture"/);
  assert.match(htmlSource, /data-settings-panel="capture"/);
  assert.match(htmlSource, /id="capture-android-host-status"/);
  assert.match(htmlSource, /id="capture-android-preview-note"/);
  assert.match(htmlSource, /id="capture-default-device-select"/);
  assert.match(htmlSource, /id="capture-provider-android-companion"/);
  assert.match(htmlSource, /id="capture-android-dictation-backend-select"/);
  assert.match(htmlSource, /id="capture-android-device-list"/);
  assert.match(htmlSource, /id="capture-android-progress-shell"/);
  assert.match(htmlSource, /id="capture-android-progress-bar"/);
  assert.match(htmlSource, /id="capture-android-progress-details"/);
  assert.match(htmlSource, /id="capture-android-progress-confirm-btn"/);
  assert.match(htmlSource, /id="capture-android-progress-cancel-btn"/);
  assert.match(htmlSource, /id="capture-android-connect-address"/);
  assert.match(htmlSource, /id="capture-android-connect-btn"/);
  assert.match(htmlSource, /id="capture-default-lens-select"/);
  assert.match(htmlSource, /id="capture-voice-command-enabled"/);
  assert.match(htmlSource, /id="capture-voice-command-open-camera-input"/);
  assert.match(htmlSource, /id="capture-voice-command-capture-input"/);
  assert.match(htmlSource, /id="capture-voice-command-stop-input"/);
  assert.doesNotMatch(htmlSource, /id="capture-voice-command-retake-input"/);
  assert.doesNotMatch(htmlSource, /id="capture-voice-command-attach-input"/);
  assert.doesNotMatch(htmlSource, /id="capture-voice-command-cancel-input"/);
  assert.match(htmlSource, /id="capture-voice-command-save-btn"/);
  assert.match(htmlSource, /id="capture-voice-command-reset-btn"/);
  assert.match(htmlSource, /id="app-transcript-backend-select"/);
  assert.match(htmlSource, /id="app-transcript-runtime-models"/);

  assert.match(controllerSource, /"capture"/);
  assert.match(
    initSource,
    /import\s+\{\s*setupSettingsCapturePanel\s*\}\s+from\s+"\.\/capture\.js"/
  );
  assert.match(initSource, /setupSettingsCapturePanel\(\);/);

  assert.match(panelSource, /registerSettingsPanelLifecycle\("capture"/);
  assert.match(panelSource, /new CaptureTranscriptRuntimePanel\(SettingsManager, root\)/);
  assert.match(panelSource, /capture-android-host-status/);
  assert.match(panelSource, /capture-android-bridge-status/);
  assert.match(panelSource, /saveCapturePolicy/);
  assert.match(panelSource, /capture-default-device-select/);
  assert.match(panelSource, /capture-provider-android-companion/);
  assert.match(panelSource, /capture-android-dictation-backend-select/);
  assert.match(panelSource, /capture-android-device-list/);
  assert.match(panelSource, /renderAndroidOperationState/);
  assert.match(panelSource, /startActionProgressPolling/);
  assert.match(panelSource, /runAndSyncCaptureAction\(state, root, "install-companion"\)/);
  assert.match(panelSource, /confirmCaptureBootstrapInstall/);
  assert.match(panelSource, /dismissCaptureOperation/);
  assert.match(panelSource, /runAndSyncCaptureAction\(state, root, "launch-companion"\)/);
  assert.match(panelSource, /connectCaptureDevice/);
  assert.match(panelSource, /disconnectCaptureDevice/);
  assert.match(panelSource, /setPreferredDevice/);
  assert.match(panelSource, /captureT\("android\.previewHint"\)/);
  assert.match(panelSource, /renderCaptureVoiceCommands/);
  assert.match(panelSource, /saveCaptureVoiceCommands/);
  assert.match(panelSource, /resetCaptureVoiceCommandDefaults/);
  assert.match(panelSource, /DEFAULT_CAPTURE_COMMAND_PHRASES/);
  assert.match(panelSource, /normalizeCapturePhraseList/);
  assert.equal((htmlSource.match(/id="capture-provider-fallback-select"/g) ?? []).length, 0);
  assert.equal((htmlSource.match(/id="capture-policy-feedback"/g) ?? []).length, 1);
  assert.equal((htmlSource.match(/id="capture-provider-android-speech"/g) ?? []).length, 0);
  assert.equal((htmlSource.match(/id="capture-provider-local-whisper"/g) ?? []).length, 0);
  assert.equal(
    (htmlSource.match(/capture\.policy\.androidDictationBackendOptions\.whisper/g) ?? []).length,
    0
  );
  assert.equal((htmlSource.match(/id="capture-voice-command-open-camera-input"/g) ?? []).length, 1);
  assert.equal((htmlSource.match(/id="capture-voice-command-capture-input"/g) ?? []).length, 1);
  assert.equal((htmlSource.match(/id="capture-voice-command-stop-input"/g) ?? []).length, 1);
  assert.equal((htmlSource.match(/id="capture-android-device-list"/g) ?? []).length, 1);

  assert.match(transcriptSource, /ensureTranscriptRuntime/);
  assert.match(transcriptSource, /listTranscriptModels/);
  assert.match(transcriptSource, /saveTranscriptBackend/);
  assert.match(transcriptSource, /vosk-small-tr/);
  assert.match(transcriptSource, /getSettingsSignature/);

  assert.doesNotMatch(userPanelSource, /ensureTranscriptRuntime/);
  assert.doesNotMatch(userPanelSource, /app-transcript-profile-select/);
});
