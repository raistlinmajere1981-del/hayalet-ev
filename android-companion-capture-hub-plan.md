# Plan: Central Android Companion Capture Hub

**Generated**: 2026-04-22
**Estimated Complexity**: High

## Overview
Build a central capture capability system that extends the current Electron-owned transcript runtime into a broader platform service for:

- Local PC speech-to-text through the existing Whisper.cpp runtime
- Android speech-to-text through a companion app
- Target-scoped command normalization from transcript input
- Android camera session control and photo capture
- Managed media ingress and attachment staging for Analyze and future rooms
- Settings-first lifecycle management for connection, install, update, health, and command policy

This plan explicitly removes room-specific implementation from scope. No `repair room` work is included. The goal is to make the platform ready so future rooms can consume the same service through stable contracts.

The mandatory UX requirement for image capture is:

- The Android phone must show the live camera preview on the phone screen while the capture session is active.
- Analyze must be able to trigger capture, receive the resulting image, and add it to staged attachments inside the app.

The first real app consumer is `Analyze`. Future rooms should only consume the central service through room host / capability clients, similar to how Laboratory consumes transcript functionality today.

The Android companion app must follow the repo-local side-app pattern already used by `ghost-agent/`:

- It lives in its own top-level project folder inside the repo.
- It keeps its own source, build, runtime, and release files isolated from the main app.
- It is orchestrated by root-level scripts and shared repo tooling.
- It does not introduce a second Node dependency tree; root-managed tooling remains the only Node dependency surface.

## Assumptions
- The existing local transcript runtime remains the source of truth for PC-local STT and must stay backward-compatible during migration.
- Settings becomes the only place where Android companion connection, installation, updates, command profiles, and defaults are managed.
- Existing Whisper/transcript management must be moved out of the current user settings operational area and consolidated with Android/capture management under one new Settings tab.
- The Android companion app lives inside this repo as a repo-local side app, similar in ownership model to `ghost-agent/`, so app versioning and upgrade flow stay under project control.
- The initial Android speech path uses platform on-device recognition for command-grade latency, with an explicit fallback seam for Vosk.
- Phone-side live preview is mandatory in V1. Desktop-side continuous mirrored preview is deferred until the control, capture, and attachment pipeline is stable. Analyze V1 should show device/session state and the last captured image after upload.
- Transport should prefer `adb reverse` + local desktop bridge so USB and wireless-debug connections can share one desktop-side protocol.

## Prerequisites
- Android companion lifecycle assumes `adb` is available on the host machine; if it is missing, Settings must surface an actionable install/setup message instead of failing silently.
- Preserve existing transcript compatibility:
  - `electron/transcript-service.ts`
  - `electron/handlers/ipc-transcript.ts`
  - `electron/preload.cjs`
  - `src/js/modules/transcript/electron-client.ts`
- Preserve room-managed path safety and room-host relay behavior:
  - `src/js/modules/rooms/room-host-runtime.ts`
  - `src/types/room-tools.ts`
  - `electron/room-tool-service.ts`
- Keep current Analyze attachment send flow working:
  - `src/js/pages/analyze.ts`
  - `src/js/pages/analyze/upload-handler.ts`
- Reuse Settings as the operational control plane:
  - `src/pages/settings.html`
  - `src/js/pages/settings/panels/init.ts`
  - `src/js/pages/settings/accounts/user-panel.ts`
  - `src/js/modules/settings/settings-schema.ts`
  - `src/types/settings.ts`
- Existing repo-local side-app reference:
  - `ghost-agent/`
  - `scripts/build-ghost-agent.mjs`
  - `package.json` ghost build/start scripts
- New Android side-app is expected under:
  - `android-companion/`

## Sprint 1: Define Central Capability Contracts
**Goal**: Introduce shared types, settings, and architecture seams for a generalized capture platform without changing runtime behavior yet.
**Demo/Validation**:
- `npm run typecheck` passes with the new settings and shared types.
- Existing transcript callers still compile without behavior changes.
- The repo contains a clear architecture note describing local transcript, Android transcript, command, and camera/media ownership boundaries.

### Task 1.1: Add Shared Capture Settings Schema
- **Location**:
  - `src/types/settings.ts`
  - `src/types/settings-defaults.ts`
  - `src/js/modules/settings/settings-schema.ts`
- **Description**: Add a new capture-oriented settings block for Android companion lifecycle, command defaults, camera defaults, transport preferences, and provider enablement. Lock one canonical V1 field model before implementation: transcript language/profile remain canonical in `general.language` and `general.transcriptModelVariant`, while Android/device/camera/command settings live under a new `capture.*` namespace. The new capture tab may edit both canonical areas, but there must be no duplicate write path or temporary alias as a second source of truth.
- **Complexity**: 6
- **Dependencies**: None
- **Acceptance Criteria**:
  - Settings can represent Android device preferences, capture defaults, and command profile policy.
  - Existing settings files normalize safely without new required fields.
  - Local transcript settings remain backward-compatible and keep one canonical V1 storage location.
- **Validation**:
  - `npm run typecheck`
  - Extend settings schema regression coverage

### Task 1.2: Introduce Shared Capture Domain Types
- **Location**:
  - `src/types/capture.ts` (new)
  - `src/types/transcript.ts`
  - `src/types/room-tools.ts`
- **Description**: Add typed contracts for provider IDs, device IDs, target IDs, command intents, camera session state, media asset refs, and capture event envelopes. Evolve transcript target semantics into a shared target model reusable by transcript, command, and media ingress.
- **Complexity**: 7
- **Dependencies**: Task 1.1
- **Acceptance Criteria**:
  - Shared targeting works for `analyze-compose`, assistant surfaces, and `room:<roomId>` consumers.
  - Transcript, command, and media events share a common envelope shape.
  - Room-facing types can reference future media ingress operations without exposing arbitrary file writes.
- **Validation**:
  - `npm run typecheck`
  - Targeted compile review for transcript and room tool consumers

### Task 1.3: Write the Central Capture Architecture Note
- **Location**:
  - `docs/capture-centralization.md` (new)
  - Cross-reference from `docs/transcript-centralization.md`
- **Description**: Document the new platform model: local transcript runtime, Android companion runtime, command normalization, camera ownership, managed media ingress, Settings-first operations, and the rule that rooms consume the system but do not own its lifecycle.
- **Complexity**: 3
- **Dependencies**: Task 1.2
- **Acceptance Criteria**:
  - The note clearly explains what is centralized and what remains a consumer concern.
  - The note explains why Android management belongs in Settings instead of individual rooms.
  - The note defines V1 scope versus deferred work such as desktop live preview mirroring.
  - The note explicitly distinguishes the legacy whisper/deferred-message surface from transcript/capture runtime ownership so users do not see two competing management concepts.
- **Validation**:
  - Manual documentation review

### Task 1.4: Define the Repo-Local Android Side-App Contract
- **Location**:
  - `android-companion/` (planned root folder)
  - `package.json`
  - `scripts/build-ghost-agent.mjs`
  - `scripts/electron-builder-after-pack.mjs`
- **Description**: Define the repo-local side-app contract before implementation work begins. This task locks the folder layout, artifact layout under `dist/android-companion/`, root `android:*` script names, Electron-consumable version manifest shape, and packaging/mirroring expectations so later Settings install/update work is not built on an implicit contract.
- **Complexity**: 5
- **Dependencies**: Task 1.1
- **Acceptance Criteria**:
  - The plan and architecture docs stop referring to the Android app as a generic workspace.
  - The Android app has a canonical repo-local side-app contract comparable to `ghost-agent/`.
  - A canonical artifact and metadata layout is defined before Settings lifecycle UI depends on it.
- **Validation**:
  - Manual architecture and build-contract review

## Sprint 2: Build the Electron Capture Hub Foundation
**Goal**: Create a main-process hub that centralizes provider registry, event fan-out, command normalization, and managed media ingress while preserving current transcript behavior.
**Demo/Validation**:
- A synthetic Android provider can register with the hub.
- The hub can emit transcript, command, and media events to a target without requiring room-specific logic.
- Existing local transcript status and transcription calls still work.

### Task 2.1: Create the Main-Process Capture Hub Modules
- **Location**:
  - `electron/capture-hub/index.ts` (new)
  - `electron/capture-hub/provider-registry.ts` (new)
  - `electron/capture-hub/event-bus.ts` (new)
  - `electron/capture-hub/target-router.ts` (new)
- **Description**: Add a single ownership layer that registers local and Android providers, routes events by target, and exposes a stable internal API for transcript, command, and media flows.
- **Complexity**: 8
- **Dependencies**: Sprint 1
- **Acceptance Criteria**:
  - The hub can register more than one provider type without special casing Analyze.
  - Event routing supports app targets and room targets.
  - Provider metadata includes device identity, source type, and health state.
- **Validation**:
  - `npm run typecheck`
  - Unit-level event routing assertions

### Task 2.2: Add Host ADB State Machine and Diagnostics
- **Location**:
  - `electron/capture-hub/adb-state-service.ts` (new)
  - `electron/capture-hub/adb-runner.ts` (new)
  - `src/types/capture.ts`
- **Description**: Add a typed host/device state machine for Android lifecycle management before Settings UI is built. This service must model real ADB states and transport failures instead of collapsing everything into connected/disconnected.
- **Complexity**: 8
- **Dependencies**: Task 2.1
- **Acceptance Criteria**:
  - The host service distinguishes missing `adb`, unauthorized devices, offline devices, multiple devices, reverse-port conflicts, package query failures, and healthy devices.
  - USB and wireless-debug transport details are preserved in state.
  - Later Settings UI can render state directly without inventing a second abstraction layer.
- **Validation**:
  - Unit tests for representative ADB state transitions
  - Manual diagnostic smoke test with synthetic outputs

### Task 2.3: Refactor Transcript Runtime Behind the Hub
- **Location**:
  - `electron/transcript-service.ts`
  - `electron/handlers/ipc-transcript.ts`
  - `src/js/modules/transcript/electron-client.ts`
- **Description**: Keep the current Whisper.cpp runtime intact, but register it as a provider behind the new hub so transcript ingress and status reporting become provider-aware instead of being hard-coded to the local runtime.
- **Complexity**: 8
- **Dependencies**: Task 2.1
- **Acceptance Criteria**:
  - Local Whisper stays the active PC-local provider.
  - Existing IPC methods remain callable.
  - Transcript ingress can carry provider and device metadata.
- **Validation**:
  - `npm run typecheck`
  - Manual local transcript smoke test in Analyze

### Task 2.4: Add Command Normalization Service
- **Location**:
  - `electron/capture-hub/command-runtime.ts` (new)
  - `shared/capture/command-catalog.ts` (new)
  - `src/types/capture.ts`
- **Description**: Add a central command interpreter that turns final transcript text into normalized intents. Keep transcript and command as separate outputs so consumers can use raw text, normalized intent, or both.
- **Complexity**: 7
- **Dependencies**: Task 2.1
- **Acceptance Criteria**:
  - Transcript-only flows still work when no command match is found.
  - Generic intents like capture, retake, attach, cancel, and stop can be represented centrally.
  - The command catalog supports future target-specific extensions without room-owned parser forks.
- **Validation**:
  - Unit tests for command normalization and no-match fallback

### Task 2.5: Add Managed Media Ingress and Staging Services
- **Location**:
  - `electron/capture-hub/media-ingress-service.ts` (new)
  - `electron/capture-hub/attachment-staging-service.ts` (new)
  - `electron/room-tool-service.ts`
- **Description**: Add a managed ingestion pipeline that accepts photo/audio payloads from providers, stores them under service-owned or room-managed paths, and emits typed asset references. This must not become a generic arbitrary file-write surface.
- **Complexity**: 8
- **Dependencies**: Task 2.1
- **Acceptance Criteria**:
  - Analyze staging and future room asset ingress can share one central path policy.
  - Room-managed writes remain restricted to managed directories.
  - The service can emit a staged asset ref without forcing immediate DB persistence.
- **Validation**:
  - Targeted path safety tests
  - Manual synthetic media ingress smoke test

### Task 2.6: Avoid Namespace Collision with Existing Desktop Device Automation
- **Location**:
  - `electron/device-manager.ts`
  - Any new Android device service files
- **Description**: Keep the current xdotool-backed desktop automation surface separate from Android companion lifecycle management. Do not overload `device-manager.ts` with Android logic; introduce a distinct `companion-*` or `android-*` service boundary.
- **Complexity**: 4
- **Dependencies**: Task 2.1
- **Acceptance Criteria**:
  - Desktop mouse/keyboard automation stays untouched.
  - Android companion lifecycle files have a dedicated namespace.
  - Future contributors cannot confuse desktop device actions with Android bridge management.
- **Validation**:
  - Manual source review

### Task 2.7: Implement the Root Android Side-App Artifact Contract
- **Location**:
  - `package.json`
  - `scripts/build-android-companion.mjs` (new)
  - `scripts/electron-builder-after-pack.mjs`
  - `dist/android-companion/` (new artifact layout)
- **Description**: Implement the build and artifact contract defined in Sprint 1 so later Settings lifecycle operations can rely on a real canonical APK path, version manifest, and packaging mirror rules. This task should define root commands such as `android:check` and `android:build`, plus a machine-readable artifact/version manifest consumed by Electron.
- **Complexity**: 7
- **Dependencies**: Task 1.4
- **Acceptance Criteria**:
  - Root scripts exist for Android companion validation and build.
  - `dist/android-companion/` has a stable artifact layout and version manifest contract.
  - Packaged workspace mirroring rules are defined early enough for Electron-side install/update flows.
- **Validation**:
  - Manual root build-contract smoke test

## Sprint 3: Make Settings the Control Plane
**Goal**: Move capture/transcript/Android management into a dedicated Settings surface with connection, installation, update, command, and defaults management.
**Demo/Validation**:
- Settings can show local transcript health and Android companion health in one place.
- Settings can list Android device records and transport status.
- Settings can persist command and camera defaults.

### Task 3.1: Add a Dedicated Capture Tab to Settings
- **Location**:
  - `src/pages/settings.html`
  - `src/js/pages/settings/panels/init.ts`
  - `src/js/pages/settings/panels/capture.ts` (new)
  - `src/js/pages/settings/controller.ts`
  - `shared/themes/castle/maps/settings.scene.json`
  - `shared/themes/castle/manifest.ts`
  - `src/styles/design-system/components/capture-settings.css` (new)
  - `src/js/pages/settings/panel-i18n.ts`
  - `shared/languages/tr/index.json`
  - `shared/languages/en/index.json`
  - `scripts/tests/settings-scene-theme-panel-regressions.test.ts`
- **Description**: Add a dedicated Settings tab for capture and companion management instead of expanding the current user card indefinitely. This tab becomes the single operational home for existing Whisper/transcript management plus all new Android/capture management. If the user panel keeps any transcript summary at all, it must be read-only and link back to the capture tab.
- **Complexity**: 7
- **Dependencies**: Sprint 2
- **Acceptance Criteria**:
  - Settings has a first-class capture tab.
  - Local transcript runtime, Android device management, and command policy live together in one operational surface.
  - Existing settings tabs remain functional.
  - No duplicate operational transcript controls remain in the user panel.
  - The Settings scene controller, scene map, panel art routing, and regression tests all recognize the new tab.
- **Validation**:
  - `npm run typecheck`
  - Manual Settings navigation smoke test

### Task 3.2: Surface Local Transcript Runtime in the New Capture Panel
- **Location**:
  - `src/js/pages/settings/panels/capture.ts`
  - `src/js/pages/settings/accounts/user-panel.ts`
- **Description**: Move the current Whisper/transcript runtime controls into the new capture panel and reduce the user panel to a compact summary or navigation hint only. The operational buttons for prepare, refresh, install, repair, and remove must live only in the capture tab.
- **Complexity**: 5
- **Dependencies**: Task 3.1
- **Acceptance Criteria**:
  - Transcript runtime management is available from the capture tab.
  - The user panel no longer exposes operational transcript management.
  - Existing model management behavior remains intact.
- **Validation**:
  - Manual local transcript runtime management smoke test

### Task 3.3: Add Android Companion Management UI
- **Location**:
  - `src/js/pages/settings/panels/capture.ts`
  - `electron/handlers/ipc-capture.ts` (new)
  - `electron/preload.cjs`
  - `src/js/modules/capture/electron-client.ts` (new)
- **Description**: Add UI and IPC for device discovery, USB/wireless debugging status, pairing guidance, connect/disconnect, app launch, permission status, and companion health. This UI must render the typed ADB state machine from Sprint 2 instead of inventing a simplified connected/disconnected model.
- **Complexity**: 8
- **Dependencies**: Task 3.1
- **Acceptance Criteria**:
  - Settings can display device list and connection state.
  - USB and wireless-debug devices are distinguishable.
  - Connection and health actions work through one Settings-owned surface.
  - Missing `adb` or unsupported host setup is shown as an actionable setup state, not a generic error.
  - Unauthorized, offline, multi-device, reverse-conflict, and package-query failure states are visible and actionable.
- **Validation**:
  - Manual device list smoke test with no device and with one device attached

### Task 3.4: Add Companion Install and Update Operations
- **Location**:
  - `src/js/pages/settings/panels/capture.ts`
  - `electron/capture-hub/companion-install-service.ts` (new)
  - `android-companion/`
- **Description**: Add Settings actions for install, reinstall, and update of the Android companion app through ADB. The desktop app should detect the installed companion version and compare it with the local side-app build or packaged APK artifact using the canonical artifact contract from Sprint 2.
- **Complexity**: 8
- **Dependencies**: Task 2.7, Task 3.3
- **Acceptance Criteria**:
  - Settings can tell whether the device app is missing, outdated, or healthy.
  - Install/update flows are explicit and observable in the UI.
  - The app never silently mutates devices without user-triggered actions from Settings.
- **Validation**:
  - Manual install/update dry run or smoke run
  - Version comparison assertions

### Task 3.5: Add Command and Camera Defaults Management
- **Location**:
  - `src/js/pages/settings/panels/capture.ts`
  - `src/types/settings.ts`
  - `shared/capture/command-catalog.ts`
- **Description**: Add Settings controls for command phrases, enabled providers, default active Android device, default camera lens, capture quality, post-capture attach behavior, and command confirmation policy.
- **Complexity**: 7
- **Dependencies**: Task 3.3
- **Acceptance Criteria**:
  - Command and camera defaults are persisted in Settings.
  - The capture hub can read those defaults without room-specific logic.
  - The UI clearly separates platform defaults from target-specific behavior.
- **Validation**:
  - Settings persistence smoke test

### Task 3.6: Disambiguate the Legacy Whisper Surface
- **Location**:
  - `src/js/pages/whisper/app.ts`
  - `src/pages/whisper.html`
  - `docs/transcript-centralization.md`
  - `shared/languages/tr/index.json`
  - `shared/languages/en/index.json`
- **Description**: Clarify or rename the legacy whisper surface so it does not look like a second transcript/capture management UI after the new Settings capture tab lands. Keep its deferred-message role intact, but remove naming or copy collisions with the centralized capture system.
- **Complexity**: 4
- **Dependencies**: Task 3.1
- **Acceptance Criteria**:
  - Users can distinguish deferred whisper behavior from transcript/camera runtime management.
  - The new capture tab is the only operational surface for transcript and Android capture lifecycle management.
- **Validation**:
  - Manual wording and navigation review

## Sprint 4: Add the Renderer Capability Client and Analyze Consumer
**Goal**: Make Analyze the first real consumer of the central capture system for transcript, image capture, and attachment staging.
**Demo/Validation**:
- Analyze can subscribe to central transcript and media events.
- Analyze can trigger Android capture through the new capability client.
- Incoming Android images can appear in the existing staged attachments list.

### Task 4.1: Introduce a Shared Renderer Capture Client
- **Location**:
  - `src/js/modules/capture/client.ts` (new)
  - `src/js/modules/capture/electron-client.ts` (new)
  - `src/js/modules/transcript/electron-client.ts`
- **Description**: Add a renderer-facing client that exposes one API for transcript events, command events, device status, camera session status, and media asset delivery. This client should hide IPC details from Analyze and future room consumers.
- **Complexity**: 7
- **Dependencies**: Sprint 3
- **Acceptance Criteria**:
  - Analyze can use one client instead of talking directly to transcript IPC only.
  - Future room pages can subscribe by target without creating their own transport layer.
  - The client still supports local transcript compatibility.
- **Validation**:
  - `npm run typecheck`
  - Manual synthetic event delivery smoke test

### Task 4.2: Add Analyze Capture Controls and Session State
- **Location**:
  - `src/pages/analyze.html`
  - `src/styles/analyze.css`
  - `src/js/pages/analyze.ts`
- **Description**: Add Analyze UI for Android capture session state, device selection summary, capture trigger, retake, attach behavior, and feedback. V1 should not depend on desktop-side continuous live preview; it should surface capture state and the latest captured result while the phone itself shows the live camera preview.
- **Complexity**: 7
- **Dependencies**: Task 4.1
- **Acceptance Criteria**:
  - Analyze can start or stop an Android capture session via the central client.
  - The UI makes it clear that live preview is on the phone screen during capture.
  - Users can see the latest returned image and attachment state before sending.
- **Validation**:
  - Manual Analyze UI smoke test with synthetic media result

### Task 4.3: Stage Android Media into Existing Analyze Attachments
- **Location**:
  - `src/js/pages/analyze.ts`
  - `src/js/pages/analyze/upload-handler.ts`
  - `electron/capture-hub/attachment-staging-service.ts`
- **Description**: Extend the staged attachment flow so Android photos delivered through the central hub become first-class staged files inside Analyze, reusing the current send pipeline instead of inventing a second message attachment path.
- **Complexity**: 8
- **Dependencies**: Task 4.2
- **Acceptance Criteria**:
  - Android-delivered images appear in the same staged list as manually added files.
  - Existing AI1, AI2, and US1 send flows can send those files without special-case branches.
  - Attachment names, mime types, and stored paths are managed centrally.
- **Validation**:
  - Manual Analyze send smoke test with a staged Android image

### Task 4.4: Support Provider-Aware Analyze Dictation
- **Location**:
  - `src/js/pages/analyze.ts`
  - `src/js/modules/transcript/dictation-ui.ts`
  - `src/js/modules/capture/client.ts`
- **Description**: Evolve Analyze dictation so local PC mic and Android transcript can coexist under one central service model. The UI should make source state visible without duplicating transcript insertion logic.
- **Complexity**: 6
- **Dependencies**: Task 4.1
- **Acceptance Criteria**:
  - Analyze can still use local Whisper dictation.
  - Analyze can also accept Android transcript ingress through the same target.
  - Transcript insertion stays source-agnostic at the textarea layer.
- **Validation**:
  - Manual Analyze smoke test for local and synthetic Android transcript paths

## Sprint 5: Build the Android Companion App MVP
**Goal**: Create the Android companion side app that provides phone-side live preview, command-grade speech input, control-channel connectivity, and photo upload to the desktop hub.
**Demo/Validation**:
- A connected Android phone can launch the companion app from Settings.
- The app shows live camera preview on the phone.
- The app can capture a photo and send it to the desktop hub.
- The app can send transcript and command events to the desktop hub.

### Task 5.1: Scaffold the Android Companion Workspace
- **Location**:
  - `android-companion/` (new)
  - Root `package.json` scripts for build/install/update orchestration
- **Description**: Create a Kotlin-based Android side app with a clear module structure for transport, camera, speech, permissions, and session control. Model its repo placement and operational ownership after `ghost-agent/`: isolated source tree, root-driven scripts, no separate Node dependency tree, and release metadata tied to the Hayalet Ev repo.
- **Complexity**: 7
- **Dependencies**: Task 2.7
- **Acceptance Criteria**:
  - The repo contains a buildable Android side-app directory at `android-companion/`.
  - Version metadata is visible to the desktop app.
  - The workspace structure supports future Vosk fallback without a rewrite.
  - Root scripts can build and package the Android side app without introducing a second Node dependency tree.
- **Validation**:
  - Android build smoke test
  - Root `android:check` / `android:build` smoke test

### Task 5.2: Implement Phone-Side Camera Session and Live Preview
- **Location**:
  - `android-companion/app/src/main/...`
- **Description**: Add CameraX-based preview and photo capture. The phone screen must show the live camera feed while the capture session is active, and the app must support session commands such as open camera, capture photo, retake, switch lens, and torch toggling.
- **Complexity**: 8
- **Dependencies**: Task 5.1
- **Acceptance Criteria**:
  - Phone-side live preview is stable and visible to the user.
  - Capture session lifecycle is explicit and recoverable after interruption.
  - Resulting photos can be serialized to the desktop-side media ingress pipeline.
- **Validation**:
  - Manual Android camera smoke test

### Task 5.3: Implement Speech Input for Command-Grade Android STT
- **Location**:
  - `android-companion/app/src/main/...`
  - `shared/capture/command-catalog.ts`
- **Description**: Add Android speech input for command-grade latency using platform on-device recognition first. Define a clean fallback seam for Vosk so later expansion does not require desktop or renderer changes.
- **Complexity**: 8
- **Dependencies**: Task 5.1
- **Acceptance Criteria**:
  - The app can emit transcript final events and normalized command candidates.
  - The speech layer is good enough for short command utterances.
  - The implementation keeps provider-specific logic inside the app or companion bridge boundary.
- **Validation**:
  - Manual Android voice command smoke test

### Task 5.4: Implement Companion Transport and Session Protocol
- **Location**:
  - `android-companion/app/src/main/...`
  - `electron/capture-hub/companion-bridge-server.ts` (new)
- **Description**: Implement the control and upload channel between phone and desktop. Prefer `adb reverse` + local bridge in V1 so USB and wireless debugging can reuse the same desktop-side server contract.
- **Complexity**: 9
- **Dependencies**: Tasks 5.2 and 5.3
- **Acceptance Criteria**:
  - The companion app can register with the desktop hub.
  - The companion app can send transcript, command, status, and photo payloads.
  - Connection recovery behavior is explicit when the bridge drops.
- **Validation**:
  - End-to-end device connection smoke test

## Sprint 6: Prepare the Platform for Future Rooms
**Goal**: Expose stable consumption seams for future rooms and complete operational polish for Settings-driven management.
**Demo/Validation**:
- A room can subscribe to central capture events without owning lifecycle logic.
- Settings can manage companion lifecycle end-to-end.
- Analyze continues to work as the reference consumer.

### Task 6.1: Expose Room-Ready Consumption Seams
- **Location**:
  - `src/js/modules/rooms/room-host-runtime.ts`
  - `src/types/room-tools.ts`
  - `electron/room-tool-service.ts`
  - `src/js/modules/capture/client.ts`
- **Description**: Extend the current room host and room tool seams so future rooms can consume transcript, command, camera state, and media asset refs from the central hub without implementing their own companion logic.
- **Complexity**: 7
- **Dependencies**: Sprint 4 and Sprint 5
- **Acceptance Criteria**:
  - Rooms can subscribe to target-scoped capture events.
  - Room-facing APIs expose asset refs and commands, not raw arbitrary transports.
  - No room needs to manage Android install, pairing, or updates.
- **Validation**:
  - Synthetic room-target event smoke test

### Task 6.2: Add Settings Health, Logs, and Recovery Actions
- **Location**:
  - `src/js/pages/settings/panels/capture.ts`
  - `electron/capture-hub/*`
  - `shared/languages/tr/index.json`
  - `shared/languages/en/index.json`
- **Description**: Add operational surfaces for bridge health, last sync time, permission failures, reconnect, reinstall, clear pairing state, and quick diagnostics so users can recover companion issues without touching a future room.
- **Complexity**: 6
- **Dependencies**: Sprint 5
- **Acceptance Criteria**:
  - Settings can explain common failure states.
  - Reconnect and recovery actions are available in one place.
  - Operational feedback is understandable without reading logs directly.
- **Validation**:
  - Manual failure-mode walkthrough

### Task 6.3: Add Build, Packaging, and Release Notes for the Companion
- **Location**:
  - `android-companion/`
  - Root scripts or package metadata
  - `docs/capture-centralization.md`
- **Description**: Add the scripts, release notes, and operator guidance needed to build, install, and update the companion app as part of the project lifecycle.
- **Description**: Add the scripts, release notes, and operator guidance needed to build, install, and update the companion app as part of the project lifecycle. This task also decides whether root `build:all` and packaged release flows should fail when the Android companion artifact is missing or stale.
- **Complexity**: 5
- **Dependencies**: Sprint 5
- **Acceptance Criteria**:
  - The repo has a documented build path for the Android app.
  - The desktop app can compare installed and expected companion versions.
  - Update flow is documented for developers and operators.
  - Root release gating for missing or stale Android companion artifacts is explicitly defined.
- **Validation**:
  - Manual build/install documentation review

## Testing Strategy
- Keep compatibility tests for the existing local transcript runtime in place during every sprint.
- Add focused unit tests for:
  - Settings normalization
  - Target routing
  - Command normalization
  - ADB state transitions
  - Managed media path restrictions
- Add synthetic provider tests so Analyze can be validated before the Android app is ready.
- Add manual smoke checklists for:
  - Local Whisper prepare / refresh / install / remove
  - Android device detection in Settings
  - Android companion launch and reconnect
  - Phone-side live preview during capture
  - Analyze staged attachment flow with Android images
  - Analyze dictation with local and Android sources
- Before future rooms consume the system, keep one target-agnostic smoke matrix:
  - app target transcript
  - app target media ingress
  - room target transcript
  - room target media ingress

## Potential Risks & Gotchas
- `adb` may be missing, outdated, or behave differently across host environments. Settings must detect that explicitly and explain how to recover.
- The current transcript runtime is centralized, but camera/media ingress is not. If attachment staging is bolted directly into Analyze, future rooms will inherit a UI-specific seam instead of a platform seam.
- `electron/device-manager.ts` already means desktop xdotool automation. Reusing that name for Android would create long-term confusion.
- If Android companion ownership is not modeled like `ghost-agent/`, the repo may drift into a half-embedded/half-external app that is harder to build, release, and reason about.
- Android USB and wireless debugging have different operational failure modes. Settings must make those states visible instead of hiding them behind one generic “disconnected” badge.
- If the new capture tab edits both canonical transcript fields and new `capture.*` fields without a locked ownership rule, the project will create a dual source of truth. The V1 canonical field decision must be explicit and tested.
- Phone-side live preview is mandatory for the user experience, but desktop continuous mirrored preview is not required for V1. Treating both as mandatory would inflate the transport scope too early.
- Command parsing must not replace transcript delivery. Some consumers need the raw text even when a command is recognized.
- Analyze attachment staging must reuse the existing send pipeline. Creating a second “special Android attachment” send path would fragment message behavior.
- The Android companion app will need explicit permission and lifecycle recovery handling. Camera, microphone, and background connection failures should be surfaced in Settings, not buried inside future rooms.
- Local transcript, Android transcript, and future room commands can create naming drift if target IDs and provider IDs are not standardized early.

## Rollback Plan
- Keep the current local transcript IPC and Settings behavior working behind compatibility wrappers until the new capture tab and hub are stable.
- Land the capture hub in additive stages so Analyze can continue using its existing local dictation path during development.
- Keep Android companion operations feature-flagged or guarded by capability checks until end-to-end install and reconnect flows are proven.
- If Android media ingress proves unstable, disable automatic Analyze attachment staging and fall back to transcript-only Android support while the storage pipeline is repaired.
- If the new Settings capture tab causes regressions, leave only a read-only transcript summary in the user panel and temporarily hide the new Android management surface rather than duplicating operational controls again.
