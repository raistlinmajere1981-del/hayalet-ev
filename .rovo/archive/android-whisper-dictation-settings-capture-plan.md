# Plan: Android Whisper Dictation, Shared Capture, and Voice Commands

**Generated**: 2026-04-29
**Estimated Complexity**: High

## Overview
Move Analyze dictation to exactly two audio/transcription modes:

- Local: record with the desktop microphone and transcribe through the existing desktop whisper.cpp runtime.
- Android: record on the Android phone and transcribe on the Android phone with whisper.cpp.

Keep the voice command system, but change its role: voice command never owns microphone capture and never calls a fallback speech recognizer. It only inspects finalized transcript text and dispatches matching commands. Add an Analyze page `voice command active/passive` control, then promote the transcript, camera, and voice-command contracts so rooms can reuse them. Each room can expose its own command set while using the shared capture/transcript plumbing.

Settings > Capture should stop duplicating Analyze transcript controls. It should focus on Android companion/device/camera defaults. Shared transcript runtime settings remain responsible for whisper.cpp profile/model management. Voice command configuration moves to a shared command registry/room manifest contract instead of living as camera-capture phrase inputs.

## Prerequisites
- Android NDK and CMake support must be available in the Android companion build environment.
- A concrete Android whisper.cpp integration path must be chosen during implementation: vendored source/submodule or reproducible Gradle fetch.
- The Android companion must package or receive a whisper model without causing unacceptable APK size or install/update friction.
- A test Android device with `RECORD_AUDIO` permission and enough CPU/RAM for the selected model is required.
- Room-facing contracts must be defined before feature wiring: transcript target ids, camera session targets, command set ids, and command dispatch payloads.

## Sprint 1: Contracts and Settings Shape
**Goal**: Define the two-mode dictation contract, preserve voice command as transcript-text matching, and remove obsolete fallback speech settings.
**Demo/Validation**:
- `npm run typecheck`
- Existing capture settings load without throwing when old `speechFallbackMode` or `androidSpeechEnabled` values are present.
- Analyze renders Local/Android dictation availability and a separate voice-command active/passive state.

### Task 1.1: Replace Provider Settings Contract
- **Location**: `src/types/settings.ts`, `src/types/settings-defaults.ts`, `src/js/modules/settings/settings-schema.ts`
- **Description**: Remove fallback speech settings from normalized capture providers. Preserve Android companion enablement for device/camera bridge use. Add or normalize a separate voice-command preference that is not tied to speech capture backend selection.
- **Complexity**: 5
- **Dependencies**: None
- **Acceptance Criteria**:
  - No user-facing fallback mode remains in normalized settings.
  - Android dictation availability is not controlled by a generic Android speech toggle.
  - Voice command enablement is represented separately from capture/transcription provider settings.
  - Old configs still normalize without data loss outside removed fields.
- **Validation**:
  - `npm run typecheck`
  - Add or update settings normalization tests if present.

### Task 1.2: Define Transcript Source Modes
- **Location**: `src/types/transcript.ts`, `src/js/modules/transcript/dictation-ui.ts`, `src/js/pages/analyze.ts`
- **Description**: Make dictation mode semantics explicit: `local` means PC mic plus desktop whisper.cpp; `android` means Android mic plus Android whisper.cpp. Keep mixed routing out of the UI and API. Ensure transcript payloads carry enough metadata for command matching and room targeting.
- **Complexity**: 4
- **Dependencies**: Task 1.1
- **Acceptance Criteria**:
  - Mode labels and source checks match only the two allowed audio/transcription combinations.
  - Android ingress events are accepted only for the active target.
  - Transcript payload metadata can identify source, target, request id, active target owner, and optional room/feature id.
- **Validation**:
  - `npm run typecheck`
  - Manual review of Analyze dictation toggle behavior.

### Task 1.3: Clean Capture Settings UI
- **Location**: `src/pages/settings.html`, `src/js/pages/settings/panels/capture.ts`, `shared/languages/en/index.json`, `shared/languages/tr/index.json`
- **Description**: Remove the local Whisper enable toggle, Android speech enable toggle, and fallback mode selector from Capture policy. Keep Android companion enablement, preferred device, camera lens, photo quality, attach mode, and confirmation. Replace removed availability gates with runtime readiness checks: desktop transcript runtime readiness for Local mode, Android companion plus Android whisper readiness for Android mode.
- **Complexity**: 5
- **Dependencies**: Task 1.1
- **Acceptance Criteria**:
  - Settings > Capture no longer exposes transcript provider toggles that overlap Analyze behavior.
  - Capture panel copy describes device/camera/companion capture, not speech backend selection.
  - The transcript runtime panel remains available for desktop whisper.cpp model/profile management.
  - Analyze no longer depends on removed `capture.providers.localWhisperEnabled` or `androidSpeechEnabled` fields.
- **Validation**:
  - `npm run typecheck`
  - Run app smoke check and inspect Settings > Capture.

### Task 1.4: Preserve Voice Command as Transcript Matcher
- **Location**: `shared/capture/command-catalog.ts`, `src/types/capture.ts`, `src/types/transcript.ts`, `src/types/settings.ts`, `electron/capture-service.ts`, Android session files
- **Description**: Keep the voice command concept, but detach it from Android `SpeechRecognizer` and camera capture phrase inputs. Define it as a transcript-text matcher that consumes final transcript payloads and emits command matches. Migrate existing `capture.commandPhrases` into the Analyze command set before removing the Capture UI controls.
- **Complexity**: 6
- **Dependencies**: Task 1.2
- **Acceptance Criteria**:
  - Voice command is not removed.
  - Voice command does not start or stop microphone capture.
  - Voice command only processes transcript text after Local or Android whisper transcription completes.
  - Existing custom `capture.commandPhrases` are preserved in the Analyze command set where possible.
  - Capture phrase UI is removed only after migration behavior is tested.
- **Validation**:
  - `npm run typecheck`
  - Regression test for legacy phrase migration.
  - Regression test for transcript text -> command match.

### Task 1.5: Add Caller-Owned Request Correlation Contract
- **Location**: `src/types/transcript.ts`, `electron/transcript-service.ts`, `src/js/modules/transcript/electron-client.ts`, `electron/preload.cjs`, Android transport/session files
- **Description**: Move request correlation into the base transcript contract before Android recording work starts. The caller creates the `requestId`; local, Android, room, and command-match paths preserve it through transcription, ingress, matching, and insertion.
- **Complexity**: 6
- **Dependencies**: Task 1.2
- **Acceptance Criteria**:
  - `TranscriptSubmitIngressRequest` can carry a caller-owned `requestId`.
  - `transcriptService.submitIngress` preserves caller request ids instead of always replacing them.
  - Local dictation, Android dictation, room transcript requests, and command matches share the same correlation id.
  - Stale request ids can be rejected before text insertion or command dispatch.
- **Validation**:
  - `npm run typecheck`
  - Regression test for caller-owned request id preservation.
  - Regression test for stale request rejection.

## Sprint 2: Shared Room Runtime Contracts
**Goal**: Promote transcript, camera, and voice-command services into reusable room-facing contracts.
**Demo/Validation**:
- A non-Analyze room can declare command metadata and receive command matches from transcript text in a test harness.
- Existing Analyze capture/transcript behavior still works through the shared contract.

### Task 2.1: Extend Existing Shared Transcript Target Contract
- **Location**: `src/types/transcript.ts`, `electron/transcript-service.ts`, `electron/room-tool-service.ts`, `src/js/modules/rooms/room-host-runtime.ts`, room runtime bridge types
- **Description**: Room transcript targets already exist. Extend the current contract with feature id, caller-owned request id, active target ownership, final/non-final semantics, and room-runtime delivery rules instead of inventing a parallel target model.
- **Complexity**: 6
- **Dependencies**: Sprint 1
- **Acceptance Criteria**:
  - Existing `room:<roomId>` transcript targets keep working.
  - Optional feature ids and active target owner are typed and normalized.
  - Transcript ingress can fan out to room runtime surfaces without Analyze-specific assumptions.
  - Target mismatch, stale request ids, and inactive target ownership are ignored.
- **Validation**:
  - `npm run typecheck`
  - Room target normalization regression.
  - Room host transcript delivery regression.

### Task 2.2: Define Shared Camera Session Contract
- **Location**: `src/types/capture.ts`, `electron/capture-service.ts`, `electron/handlers/ipc-capture.ts`, `electron/preload.cjs`, `src/js/global.d.ts`, `src/js/modules/capture/electron-client.ts`, room runtime bridge types
- **Description**: Make camera session commands target-aware so Analyze and rooms can request Android camera preview, capture, retake, stop, and asset sync through the same service. Migrate Analyze-specific IPC/preload APIs to target-aware calls without breaking existing Analyze buttons during the transition.
- **Complexity**: 6
- **Dependencies**: Task 2.1
- **Acceptance Criteria**:
  - Camera commands carry a target id, not a hardcoded Analyze target.
  - IPC handlers, preload exposure, renderer global typings, and renderer client wrappers all accept target-aware payloads.
  - Captured assets are stored/staged per target or room when applicable.
  - Analyze remains compatible with `analyze-compose`.
- **Validation**:
  - Capture bridge regression tests.
  - IPC/preload/global typecheck.
  - Manual Analyze phone capture smoke.

### Task 2.3: Define Room Voice Command Registry
- **Location**: `src/types/capture.ts`, `src/types/transcript.ts`, `src/types/room-manifest-types.ts`, `src/js/modules/rooms/room-command-registry.ts`, room manifest docs, `rooms/*/manifest.json` contract docs
- **Description**: Integrate voice phrases with the existing room command system instead of creating a parallel registry. Decide explicitly whether voice phrases extend `RoomCommandSpec` or live in a `voiceCommandSets` manifest field that resolves to room command ids. Analyze gets its own command set and an active/passive toggle.
- **Complexity**: 7
- **Dependencies**: Task 2.1
- **Acceptance Criteria**:
  - Command sets are room-scoped and namespace-isolated.
  - Voice command names cannot collide accidentally with another room's command names.
  - Command matching can be enabled/disabled per active target.
  - Command match output includes command id, matched phrase, confidence or match type, transcript request id, and room/feature target.
- **Validation**:
  - Typecheck and command registry unit tests.
  - Collision/namespace regression test.

### Task 2.4: Add Shared Command Dispatcher
- **Location**: `src/js/modules/transcript/`, `src/js/modules/capture/`, `electron/capture-service.ts`, room runtime bridge modules
- **Description**: Implement a dispatcher that receives transcript payloads, rejects non-final or stale payloads before matching, checks whether voice command is active for the target, matches against the active command set, and emits a command event to Analyze or room runtime.
- **Complexity**: 7
- **Dependencies**: Task 2.3
- **Acceptance Criteria**:
  - Central dispatcher ignores `isFinal !== true`, stale request ids, inactive targets, and empty text before command matching.
  - Voice command only reacts to final transcript text.
  - Normal transcript insertion still happens when command matching is active unless a room explicitly consumes the transcript.
  - Malformed or unmatched transcript text does not dispatch commands.
- **Validation**:
  - Unit/regression tests for matched, unmatched, disabled, non-final, inactive-target, empty-text, and stale transcript cases.

## Sprint 3: Android Whisper Runtime Foundation
**Goal**: Add a native Android whisper.cpp runtime that can transcribe a local WAV file inside the companion app.
**Demo/Validation**:
- `npm run android:build`
- Android unit/instrumented smoke transcribes a short bundled WAV or reports a clear missing-model state.

### Task 3.1: Add Native Build Skeleton
- **Location**: `android-companion/app/build.gradle.kts`, `android-companion/app/src/main/cpp/`, `android-companion/app/src/main/jniLibs/` if needed
- **Description**: Enable NDK/CMake for the companion app and add a minimal native library wrapper for whisper.cpp. Keep ABI choices explicit to avoid accidental bloated builds.
- **Complexity**: 7
- **Dependencies**: Sprint 2
- **Acceptance Criteria**:
  - Debug APK builds with native whisper wrapper.
  - CI/build scripts fail clearly if NDK/CMake is missing.
- **Validation**:
  - `npm run android:build`
  - `npm run android:check`

### Task 3.2: Vendor or Fetch whisper.cpp Reproducibly
- **Location**: `android-companion/`, `scripts/build-android-companion.mjs`, `scripts/android-companion-utils.mjs`
- **Description**: Add a reproducible source strategy for whisper.cpp, pinned to the desktop runtime tag unless a newer Android-required tag is intentionally selected. Ensure build cache freshness includes native source inputs.
- **Complexity**: 7
- **Dependencies**: Task 3.1
- **Acceptance Criteria**:
  - Android build does not depend on an unpinned floating upstream state.
  - Artifact freshness checks notice native source changes.
- **Validation**:
  - Clean Android build from a fresh checkout.
  - Artifact stale/fresh regression tests.

### Task 3.3: Add Android Model Storage and Selection
- **Location**: `android-companion/app/src/main/kotlin/com/hayaletev/androidcompanion/`, `electron/capture-service.ts`, `shared/transcript/model-catalog.ts`, Android bridge/model transfer files
- **Description**: Use a concrete first-release model provisioning policy instead of deferring the choice. Default plan: desktop-managed model provisioning from the shared whisper.cpp model catalog, pushed/cached on the phone with checksum validation. Start with the smallest acceptable Android profile, likely `tiny` or the existing light profile, unless product testing proves `base` is acceptable.
- **Complexity**: 8
- **Dependencies**: Task 3.2
- **Acceptance Criteria**:
  - First-release Android model id/profile is explicitly pinned.
  - Model checksum and expected size are validated before Android transcription.
  - Companion can resolve an installed model path before recording starts.
  - Missing model state is visible in host status, Analyze/room availability, and phone diagnostics.
  - Model transfer, chunking or packaging choice, cleanup, and update behavior are documented and tested.
  - Desktop and Android use the same model family/profile policy where practical.
- **Validation**:
  - Android diagnostic snapshot shows model status.
  - Model missing/invalid checksum regression.
  - Manual install/update on selected device.

### Task 3.4: Implement File Transcription API on Android
- **Location**: `android-companion/app/src/main/kotlin/com/hayaletev/androidcompanion/speech/`, `android-companion/app/src/main/cpp/`
- **Description**: Replace Android `SpeechRecognizer` transcript generation with an Android whisper transcription service that accepts a WAV file path and returns final text plus metadata.
- **Complexity**: 8
- **Dependencies**: Task 3.3
- **Acceptance Criteria**:
  - No `SpeechRecognizer` path is used for Analyze or room dictation.
  - Android-side phrase detection and `commandCandidate` metadata no longer produce transcripts or commands.
  - `speechFallbackMode` is removed from the Android launch/runtime path.
  - Transcription errors include model, audio, and native runtime context.
  - Transcript metadata includes `speechBackend: android-whisper.cpp`.
- **Validation**:
  - Android smoke transcribes a known short audio sample.
  - Regression proving old Android SpeechRecognizer path cannot dispatch transcript or command events.
  - Phone diagnostics show backend and elapsed time.

## Sprint 4: Android Phone Recording Flow
**Goal**: Make Android dictation record audio on the phone, stop on second button press or explicit command, transcribe on the phone, and send the text back.
**Demo/Validation**:
- In Analyze, choose Android, press dictate, speak into phone, press stop, see text inserted.
- No desktop microphone permission prompt appears in Android mode.

### Task 4.1: Add Android Audio Recorder
- **Location**: `android-companion/app/src/main/kotlin/com/hayaletev/androidcompanion/speech/`
- **Description**: Add an `AudioRecord` or `MediaRecorder` based WAV recorder. Use mono 16 kHz PCM to match the desktop local path and avoid codec conversion.
- **Complexity**: 7
- **Dependencies**: Sprint 3
- **Acceptance Criteria**:
  - Recording file is created in the companion cache directory.
  - Stop finalizes a valid WAV file.
  - Permissions and empty-audio cases are handled clearly.
- **Validation**:
  - Android instrumented/manual recording smoke.
  - Inspect diagnostics for duration, sample rate, frame count.

### Task 4.2: Extend Bridge Commands for Dictation
- **Location**: `src/types/capture.ts`, `electron/capture-service.ts`, `android-companion/app/src/main/kotlin/com/hayaletev/androidcompanion/session/CompanionSessionCoordinator.kt`, `android-companion/app/src/main/kotlin/com/hayaletev/androidcompanion/transport/DesktopBridgeClient.kt`
- **Description**: Add target-aware dictation commands such as `start-dictation` and `stop-dictation`. Keep camera commands separate so Android dictation does not have to open camera preview.
- **Complexity**: 6
- **Dependencies**: Task 4.1
- **Acceptance Criteria**:
  - Analyze Android dictate starts phone audio recording.
  - Room Android dictate can target `room:<roomId>`.
  - Second button press stops phone recording and starts Android whisper transcription.
  - Camera preview is not required for Android dictation.
- **Validation**:
  - Capture bridge command regression tests.
  - Manual Android device smoke.

### Task 4.3: Update Analyze Dictation State Machine
- **Location**: `src/js/modules/transcript/dictation-ui.ts`, `src/js/pages/analyze.ts`, `src/pages/analyze.html`, `src/styles/analyze.css`
- **Description**: Make Android mode mirror the local start/stop button behavior. Local mode controls a `MicrophoneCaptureSession`; Android mode controls bridge dictation commands and waits for Android ingress.
- **Complexity**: 6
- **Dependencies**: Task 4.2
- **Acceptance Criteria**:
  - Local mode: first press records on desktop, second press transcribes on desktop.
  - Android mode: first press records on phone, second press transcribes on phone.
  - Button state and notices are accurate during Android recording/transcribing.
- **Validation**:
  - UI smoke for both modes.
  - Unit-level tests if dictation state machine has existing harness; otherwise add focused regression.

### Task 4.4: Implement Android/Room Result Correlation Runtime
- **Location**: `electron/capture-service.ts`, Android transport/session files, `src/js/modules/transcript/dictation-ui.ts`, room runtime bridge modules
- **Description**: Use the Sprint 1 caller-owned request id contract in the Android and room runtime flows. Prevent stale phone transcripts from landing after the user switches modes, pages, or rooms.
- **Complexity**: 5
- **Dependencies**: Task 1.5, Task 4.3
- **Acceptance Criteria**:
  - Android and room transcript events carry the original caller request id.
  - Stale Android transcript events are ignored.
  - Active dictation request clears after success, cancellation, or error.
  - Metadata includes device id, dictation request id, and target id.
- **Validation**:
  - Regression test for stale ingress.
  - Manual mode-switch and room-switch smoke.

### Task 4.5: Handle Android Dictation Lifecycle and Concurrency
- **Location**: `electron/capture-service.ts`, Android session/recorder/transcriber files, `src/js/modules/transcript/dictation-ui.ts`
- **Description**: Define failure and race behavior for phone recording and native transcription. Cover stop while starting, cancel while transcribing, app backgrounded, device disconnect, bridge reconnect, model missing after recording, duplicate second press, and timeout.
- **Complexity**: 6
- **Dependencies**: Task 4.4
- **Acceptance Criteria**:
  - Duplicate start/stop clicks are idempotent.
  - Device disconnect and bridge reconnect do not insert stale transcripts.
  - App backgrounding closes or resumes recording according to documented behavior.
  - Model-missing after recording returns a recoverable error without losing app state.
- **Validation**:
  - Lifecycle regression tests where practical.
  - Manual disconnect/reconnect and duplicate-click smoke.

## Sprint 5: Analyze Voice Command UX
**Goal**: Add a visible active/passive voice command control on Analyze and wire it to transcript-text command matching.
**Demo/Validation**:
- In Analyze, voice command passive means transcript inserts only as text.
- In Analyze, voice command active means matching final transcript text dispatches the configured Analyze command.

### Task 5.1: Add Analyze Voice Command Toggle
- **Location**: `src/pages/analyze.html`, `src/js/pages/analyze.ts`, `src/styles/analyze.css`, language catalogs
- **Description**: Add a compact `voice command active/passive` control near dictation controls. Scope the state per target, default passive. Analyze state must not globally enable room voice commands. Define reload, page switch, room switch, and target switch behavior.
- **Complexity**: 4
- **Dependencies**: Sprint 2
- **Acceptance Criteria**:
  - Toggle is visible and accessible.
  - Toggle state updates command matching immediately for Analyze only.
  - Toggle does not change selected microphone/transcript mode.
  - Analyze voice command state does not leak to rooms.
  - Default state is passive unless a persisted target-specific preference says otherwise.
- **Validation**:
  - UI smoke in Analyze.
  - `npm run typecheck`
  - Regression for Analyze active state not enabling room commands.

### Task 5.2: Define Analyze Command Set
- **Location**: `shared/capture/command-catalog.ts` or new shared command registry, `src/js/pages/analyze.ts`, settings migration code
- **Description**: Convert existing `capture.commandPhrases` into an Analyze-specific command set: open camera, capture, retake, attach/sync, stop. Preserve user custom phrases during migration. These commands are matched from transcript text only.
- **Complexity**: 5
- **Dependencies**: Task 5.1
- **Acceptance Criteria**:
  - Analyze command set is not stored as generic Capture policy UI.
  - Existing user-customized capture command phrases migrate into the Analyze command set.
  - Matching transcript text can trigger Analyze camera actions when voice command is active.
  - Unmatched transcript text remains normal dictation text.
- **Validation**:
  - Command matching regression tests.
  - Legacy phrase migration regression tests.
  - Manual voice command smoke.

### Task 5.3: Add Command Feedback and Conflict Rules
- **Location**: `src/js/pages/analyze.ts`, notification UI, command dispatcher
- **Description**: Show clear feedback when transcript text matched a command. Define conflict behavior when text both looks like a command and should be inserted as user message.
- **Complexity**: 4
- **Dependencies**: Task 5.2
- **Acceptance Criteria**:
  - Matched commands show a notification or inline status.
  - Passive mode always inserts text normally.
  - Active mode follows a documented rule: command-only phrases dispatch, non-command phrases insert.
- **Validation**:
  - Manual Analyze command smoke.
  - Regression for command-only vs freeform transcript.

## Sprint 6: Host Status, Diagnostics, and UX Cleanup
**Goal**: Make Android whisper and shared command readiness observable while removing old fallback copy.
**Demo/Validation**:
- Settings > Capture is focused on companion/camera capture.
- Analyze clearly offers Local/Android dictation and voice command active/passive.
- Phone diagnostics show recording/model/transcription state.

### Task 6.1: Add Android Whisper Status to Capture Status
- **Location**: `src/types/capture.ts`, `electron/capture-service.ts`, Android diagnostics files
- **Description**: Extend status snapshots with Android whisper readiness: companion installed, bridge connected, mic permission, model ready, native runtime ready.
- **Complexity**: 5
- **Dependencies**: Sprint 4
- **Acceptance Criteria**:
  - Analyze can disable Android dictate for precise reasons.
  - Rooms can inspect whether Android dictation and camera capture are available.
  - Settings can show Android companion readiness without speech fallback controls.
- **Validation**:
  - `npm run typecheck`
  - Capture status regression tests.

### Task 6.2: Clean i18n and Copy
- **Location**: `shared/languages/en/index.json`, `shared/languages/tr/index.json`
- **Description**: Remove fallback/speech-recognition copy and add concise strings for Android whisper recording, model missing, transcribing, command active/passive, command matched, and failure states.
- **Complexity**: 3
- **Dependencies**: Task 6.1
- **Acceptance Criteria**:
  - No visible text references Vosk or Android system speech fallback.
  - Voice command copy remains present and accurate.
  - Turkish and English catalogs remain complete.
- **Validation**:
  - i18n/catalog validation if available.
  - Manual Settings/Analyze smoke.

### Task 6.3: Update Companion and Room Docs
- **Location**: `android-companion/README.md`, room contract docs, `.rovo/_metadata` only if generated by existing scripts
- **Description**: Document Android whisper runtime requirements, model provisioning, shared camera/transcript usage, and room command-set declaration.
- **Complexity**: 4
- **Dependencies**: Sprint 5
- **Acceptance Criteria**:
  - Developer setup explains NDK/CMake and model handling.
  - README no longer describes Android speech recognition as the transcript backend.
  - Room docs explain how a room declares and handles voice commands.
- **Validation**:
  - Documentation review.

## Sprint 7: Regression Suite and Device Acceptance
**Goal**: Lock behavior with tests and a practical device checklist.
**Demo/Validation**:
- Desktop typecheck passes.
- Android build passes.
- Manual Android dictation inserts transcript into Analyze.
- Voice command active/passive works from transcript text.

### Task 7.1: Update Desktop Regression Tests
- **Location**: `scripts/tests/android-companion-regressions.test.ts`, `scripts/tests/analyze-capture-ingress-regressions.test.ts`, related test fixtures
- **Description**: Update bridge/capture tests for dictation commands, shared room targets, Android whisper status, stale ingress, command matching, and removed fallback settings.
- **Complexity**: 6
- **Dependencies**: Sprint 6
- **Acceptance Criteria**:
  - Tests cover start/stop dictation commands.
  - Tests cover room target normalization.
  - Tests verify voice command active/passive behavior.
  - Tests verify removed fallback settings are ignored or migrated safely.
- **Validation**:
  - Run targeted script tests.

### Task 7.2: Update Android Tests or Smoke Harness
- **Location**: `android-companion/app/src/test/`, `android-companion/app/src/androidTest/`, scripts if harness is preferred
- **Description**: Add the lightest practical validation for recorder WAV output and whisper runtime invocation. If full native transcription is too slow for CI, provide a deterministic smoke path with a tiny sample.
- **Complexity**: 6
- **Dependencies**: Sprint 6
- **Acceptance Criteria**:
  - Recorder output validates as WAV.
  - Native transcriber reports ready/missing model deterministically.
- **Validation**:
  - `npm run android:build`
  - Android test command chosen during implementation.

### Task 7.3: End-to-End Manual Checklist
- **Location**: `android-whisper-dictation-settings-capture-plan.md` or future implementation PR notes
- **Description**: Record the final acceptance checklist for local dictation, Android dictation, Analyze voice commands, and at least one room target smoke.
- **Complexity**: 2
- **Dependencies**: Tasks 7.1 and 7.2
- **Acceptance Criteria**:
  - Local mode uses desktop mic only.
  - Android mode uses phone mic only.
  - Android mode transcribes on phone only.
  - Voice command active mode dispatches from transcript text only.
  - Voice command passive mode does not dispatch.
  - Settings > Capture contains no duplicate Analyze transcript backend switches.
- **Validation**:
  - Manual checklist on a real phone.

## Testing Strategy
- Run `npm run typecheck` after every sprint touching TypeScript.
- Run targeted regression tests for capture bridge, settings normalization, transcript target normalization, voice command matching, and Analyze ingress filtering.
- Add early tests before final acceptance for command matching normalization, passive default, non-final ignored for commands, stale request ignored, legacy phrase migration, room phrase namespace isolation, old Android speech backend rejection, Android mode no desktop mic, and local mode no phone mic.
- Run `npm run android:check` and `npm run android:build` after Android build changes.
- Use one real Android device for acceptance because microphone permission, native CPU behavior, and model storage are device-dependent.
- Add a short known WAV fixture for Android native transcription if build size and licensing allow.
- Add at least one room-level smoke test that declares a command set and receives a command match from transcript text.
- Add a room-level smoke for target-aware camera capture and asset staging.

## Potential Risks & Gotchas
- Android whisper.cpp integration may require NDK/CMake setup not currently covered by companion bootstrap scripts.
- Whisper models can make APKs large. Prefer desktop-managed model provisioning unless a tiny packaged model is explicitly acceptable.
- Android CPU transcription may be slow with `base` models. Start with `tiny` or a clear model profile split for Android.
- Android `AudioRecord` requires careful WAV header finalization and lifecycle cleanup when the app is backgrounded.
- Existing camera capture commands currently start speech; the plan separates dictation from camera and makes voice command consume transcript text only.
- Voice command matching can accidentally consume natural language. Use command-only phrase rules first, then expand cautiously.
- Room command sets need namespace isolation so one room's phrase does not trigger another room's command.
- Active/passive state must be per target; a global toggle would accidentally enable room commands.
- Old settings keys must not break existing user configs, and custom legacy command phrases must not be dropped.
- Stale Android ingress must be correlated to the active dictation request to avoid inserting old text or dispatching old commands into Analyze or rooms.

## Rollback Plan
- Keep desktop local dictation path unchanged until Android mode passes end-to-end smoke.
- Gate Android whisper mode behind Android companion readiness checks, so failure disables Android mode rather than enabling mixed routing.
- Keep voice command passive by default if command matching causes false positives.
- If native Android whisper blocks the build, revert only Android native build and dictation command changes while preserving shared room contracts behind disabled readiness checks if already merged.
- Preserve old config normalization for at least one release so rollback does not require manual user config edits.
