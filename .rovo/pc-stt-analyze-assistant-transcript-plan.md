# Plan: PC STT Analyze Assistant Transcript Integration

**Generated**: 2026-03-31
**Estimated Complexity**: High

## Overview

Integrate a first-release local speech-to-text flow for the desktop app and surface it through microphone buttons on the two manual text entry points the user called out:

- `analyze` page compose box: `#compose-input`
- `assistant` page native OpenCode UI compose box: `#chat-input` inside `src/pages/opencode-ui.html`

The first implementation goal is:

- desktop microphone capture
- local transcription on PC
- transcript insertion into the active page's input

At the same time, the plan should leave a clean seam for future Android-origin transcripts without tying the feature to wireless networking in `v1`.

The most important architectural constraint discovered in the codebase is:

- the existing `whisper` feature is not speech-to-text UI infrastructure
- it is a scheduled message queue / delayed delivery system
- it should stay out of scope for this work

Because of that, the plan intentionally introduces a new `transcript` or `dictation` domain instead of extending `WhisperManager`, `whisper-actions`, or the `whisper` workspace tool UI.

## Research Notes

- `src/pages/analyze.html` owns the manual compose textarea `#compose-input`.
- `src/js/pages/analyze.ts` already centralizes draft persistence, send-button state, and message action insertion for `#compose-input`.
- `src/pages/opencode-ui.html` owns the native OpenCode UI textarea `#chat-input`.
- `src/js/pages/opencode-ui/chat-events.ts` already centralizes input auto-resize and send-button state for `#chat-input`.
- `src/js/pages/assistant/assistant.ts` already registers a host-level delivery handler for assistant traffic, but that path sends a full message to `ai0`; it does not target native input insertion.
- `src/js/pages/assistant/webview-bindings.ts` already contains host/guest IPC seams for OpenCode UI lifecycle events.
- `src/js/pages/opencode-ui/host-helpers.ts` already sends guest-to-host events via `window.electronAPI?.sendToHost(...)`.
- `src/js/modules/webview/providers/opencode-ui/config.ts` already declares `inputField: "#chat-input"` but leaves `voiceButton` empty, so selector metadata will need to be updated when the native mic button is added.
- `electron/webview-preload.cjs` already supports `ipcRenderer.on(...)` listeners and guest-side exposed callbacks, so the native OpenCode path can pick a concrete host->guest transport instead of DOM mutation from the shell.
- The existing laboratory audio flow already normalizes audio to mono `16 kHz` WAV before downstream model runners, and that is a strong prior for `whisper.cpp` input preparation.
- `rooms/laboratory/shared/data/tools/toolchain.manifest.json` currently defines installable `whisper.cpp` assets only for `win32-x64`, so desktop provisioning cannot be treated as solved for all platforms.
- There is no current microphone capture flow in `src/js` and no current `getUserMedia` usage.
- There is no current transcript abstraction shared between desktop capture and future Android ingress.

## Assumptions

- `v1` only supports two insertion targets:
  - `analyze-compose`
  - `assistant-opencode-native`
- `v1` does not add dictation to generic provider webviews such as ChatGPT/Gemini/OpenCode web app.
- Transcript insertion should preserve existing typed draft content.
- Default insert behavior is:
  - insert at caret when the target textarea is focused and selection data is available
  - otherwise append to the end with whitespace normalization
- `v1` only needs final transcript insertion.
  - partial streaming text is optional and can be deferred if it complicates the first cut
- Desktop STT engine choice is `whisper.cpp` first, with a smaller model option available for slower hardware.
- Android work in this phase is infrastructure-only:
  - no full Android app build
  - no production transport
  - only a source-agnostic ingress seam and testable injection path

## Scope Lock

- In scope:
  - microphone button on `analyze` compose area
  - microphone button on native OpenCode UI compose area
  - shared transcript target/insertion infrastructure
  - local PC audio capture and local PC transcription
  - active-target transcript insertion
  - UI state for idle / recording / transcribing / error
  - future Android transcript ingress seam
- Out of scope:
  - existing `whisper` delayed-message feature changes
  - voice input for generic remote provider webviews
  - full Android companion app
  - production USB / ADB transport
  - model chooser UX for end users
  - streaming partial transcript polish unless it falls out cheaply

## Proposed Architecture

### 1. New Feature Namespace

Create a new feature namespace such as `transcript` or `dictation` and keep it fully separate from existing `whisper` modules.

Suggested runtime surfaces:

- `electron/transcript-service.ts`
- `src/js/modules/transcript/*`
- optional shared types under `src/types/*` only if cross-process typing needs it

### 2. Transcript Envelope

Normalize every transcript source into one envelope shape:

- `source`: `pc-mic | android-bridge | synthetic-test`
- `target`: `analyze-compose | assistant-opencode-native`
- `text`
- `isFinal`
- `createdAt`
- `metadata`

This keeps desktop mic capture and future Android ingress on the same downstream insertion path.

### 3. Target Inserter Layer

Introduce a small target adapter layer so page-specific DOM logic does not leak into the STT service:

- analyze adapter writes into `#compose-input`, dispatches `input`, refreshes draft/send state
- OpenCode UI adapter writes into `#chat-input`, dispatches `input`, refreshes auto-resize/send state

### 4. Host / Guest Boundary For Assistant

For native OpenCode UI, do not make the assistant controller mutate guest DOM directly on every transcript event.

Instead, use a concrete host/guest transport:

- host decides the transcript target is `assistant-opencode-native`
- host sends a dedicated transcript event with `webview.send(...)`
- `electron/webview-preload.cjs` exposes a guest-side callback registration surface
- guest page owns the actual `#chat-input` write and UI refresh

That keeps OpenCode UI behavior aligned with its existing local state management.

### 5. Desktop Capture Path

Use renderer-side mic capture for `v1` and send audio to a main/electron-side transcription service.

Why:

- page-local mic button state belongs in renderer
- `whisper.cpp` process/binary/model lifecycle belongs in Electron/main or a service seam, not page code
- audio preparation should be locked early instead of assumed
  - preferred baseline: mono `16 kHz` WAV normalization before transcription

### 6. Android-Ready Ingress

Do not build Android transport now, but do add:

- source-agnostic transcript ingestion API
- a synthetic/manual injection path that can emulate Android-origin transcript delivery
- optional placeholder bridge contract doc for later USB/ADB integration

This keeps the downstream insertion and state machine reusable.

## Sprint 0: Lock Preconditions Before UI Work
**Goal**: Freeze the risky cross-cutting decisions early so implementation does not thrash on permissions, audio format, or runtime provisioning.
**Demo/Validation**:
- A short implementation note exists for permission handling, audio format, and runtime provisioning
- The rest of the plan can point to explicit chosen seams instead of placeholders

### Task 0.1: Decide the microphone permission model
- **Location**: `electron/window-manager.ts`, `electron/main.ts`, `src/js/modules/transcript/capture-controller.ts`
- **Description**: Confirm whether desktop capture will request mic permission from the main renderer only, what Electron session hooks are needed, and how cancellation/cleanup behaves if the active page changes mid-capture.
- **Complexity**: 4
- **Dependencies**: None
- **Acceptance Criteria**:
  - One explicit permission path is selected
  - Cleanup behavior is defined for page switch, assistant reconnect, and app close
  - The plan no longer assumes `getUserMedia` works without Electron seam work
- **Validation**:
  - Codebase review note recorded in implementation notes

### Task 0.2: Lock the capture output and normalization format
- **Location**: `src/js/modules/transcript/capture-controller.ts`, `electron/transcript-service.ts`, optional helper under `electron/*`
- **Description**: Decide whether renderer capture produces a usable format directly for `whisper.cpp` or whether a conversion step is required. The baseline should be explicit rather than implied.
- **Complexity**: 5
- **Dependencies**: Task 0.1
- **Acceptance Criteria**:
  - One canonical transcription input format is chosen
  - If conversion is needed, the plan states where it runs
  - The plan explicitly references mono `16 kHz` WAV normalization as the default baseline
- **Validation**:
  - Implementation note reviewed against current laboratory audio precedent

### Task 0.3: Choose the `whisper.cpp` runtime and provisioning path
- **Location**: `electron/transcript-service.ts`, `electron/room-tool-service.ts`, `package.json`, `electron/paths.ts`
- **Description**: Decide whether the new transcript feature reuses room-tool style provisioning or gets a dedicated minimal runtime path, and document platform support limitations up front.
- **Complexity**: 5
- **Dependencies**: Task 0.2
- **Acceptance Criteria**:
  - One runtime/provisioning strategy is chosen
  - Platform caveats are explicit
  - Binary/model resolution is split from transcription logic in later tasks
- **Validation**:
  - Plan references the chosen runtime seam and current platform support gap

## Sprint 1: Separate Transcript Domain And Lock Target Contracts
**Goal**: Establish a clean architecture for transcript insertion without touching the existing `whisper` queue feature.
**Demo/Validation**:
- A synthetic transcript can be injected into analyze and OpenCode UI targets without microphone capture
- Existing `whisper` workspace tool behavior remains unchanged

### Task 1.1: Create a new transcript namespace and keep `whisper` out of scope
- **Location**: `src/js/modules/transcript/*`, `electron/transcript-service.ts` or equivalent new Electron module, `shared/languages/en/index.json`, `shared/languages/tr/index.json`
- **Description**: Define the new transcript/dictation feature surface, naming, event model, and i18n keys without reusing the old `whisper` naming path.
- **Complexity**: 4
- **Dependencies**: Sprint 0 complete
- **Acceptance Criteria**:
  - No new feature code imports `src/js/modules/whisper-manager.ts`
  - No existing `whisper` controller or queue contract is repurposed
  - New i18n keys live under a new namespace rather than `app.whisper.*`
- **Validation**:
  - `rg -n "modules/whisper-manager|app\\.whisper" src electron` on touched files
  - `npm run typecheck`

### Task 1.2: Define transcript target and insertion contracts
- **Location**: `src/js/modules/transcript/types.ts`, `src/js/modules/transcript/target-resolver.ts`, `src/js/modules/transcript/insert-text.ts`
- **Description**: Create the target ids, transcript envelope type, and caret-aware insertion helper used by both pages.
- **Complexity**: 5
- **Dependencies**: Task 1.1
- **Acceptance Criteria**:
  - Target ids are explicit and limited to analyze/native-opencode for `v1`
  - Insert helper supports caret insertion and append fallback
  - Result shape can carry non-PC sources later
- **Validation**:
  - Unit-like dev smoke through a synthetic transcript payload
  - `npm run typecheck`

### Task 1.3: Add page-level target adapters for analyze and native OpenCode UI
- **Location**: `src/js/pages/analyze.ts`, `src/js/pages/analyze/context-menu.ts`, `src/js/pages/opencode-ui/chat-events.ts`, `src/js/pages/opencode-ui/composer-actions.ts`, `src/js/pages/opencode-ui/tools-prompts.ts`, `src/js/modules/transcript/page-targets.ts`
- **Description**: Wrap page-specific text insertion behavior by reusing the existing “write text, dispatch input, focus, move caret” patterns already present in analyze and OpenCode UI instead of rebuilding them from scratch.
- **Complexity**: 6
- **Dependencies**: Task 1.2
- **Acceptance Criteria**:
  - Analyze adapter dispatches `input` and preserves draft persistence flow
  - OpenCode UI adapter dispatches `input`, refreshes auto-resize, and refreshes send button state
  - Both adapters can be called without microphone capture present
- **Validation**:
  - Manual synthetic transcript insert on both targets
  - `npm run typecheck`

### Task 1.4: Add assistant host/guest bridge for native OpenCode transcript insertion
- **Location**: `src/js/pages/assistant/assistant.ts`, `src/js/pages/assistant/webview-bindings.ts`, `electron/webview-preload.cjs`, `src/js/pages/opencode-ui/app.ts`
- **Description**: Add a dedicated assistant-to-native-OpenCode transcript channel using `webview.send(...)` plus a guest callback exposed through the webview preload so transcript delivery does not bypass OpenCode UI state handling.
- **Complexity**: 7
- **Dependencies**: Task 1.3
- **Acceptance Criteria**:
  - Assistant page can target the native OpenCode guest explicitly
  - OpenCode UI owns final DOM mutation of `#chat-input`
  - No generic `deliverToAssistant(...)` message-send path is overloaded for transcript insertion
  - The transport choice is concrete and implemented at one seam only
- **Validation**:
  - Manual guest/host transcript smoke
  - `npm run electron:build`

### Task 1.5: Add explicit insertion regression coverage
- **Location**: `src/js/pages/analyze.ts`, `src/js/pages/opencode-ui/app.ts`, `src/js/modules/transcript/page-targets.ts`
- **Description**: Add one focused regression pass for caret insertion, append fallback, and page-state refresh so transcript insertion stays aligned with each page’s existing input semantics.
- **Complexity**: 4
- **Dependencies**: Task 1.4
- **Acceptance Criteria**:
  - Caret insertion is covered
  - Append fallback is covered
  - Analyze and OpenCode UI both refresh their local input state correctly
- **Validation**:
  - Manual regression checklist
  - `npm run typecheck`

## Sprint 2: Add Desktop Microphone Capture And Local PC Transcription
**Goal**: Make the desktop app capture audio locally, transcribe locally, and feed the transcript envelope into the shared insertion path.
**Demo/Validation**:
- Desktop capture and transcription work behind a controller seam before final page buttons are wired
- Errors are surfaced without breaking the page

### Task 2.1: Add a mic capture controller and permission UX
- **Location**: `src/js/modules/transcript/capture-controller.ts`, `src/js/modules/transcript/capture-state.ts`, `src/js/global.d.ts`, `electron/window-manager.ts` or `electron/main.ts` only if Electron permission handling is required
- **Description**: Implement the renderer-side capture lifecycle for idle / recording / stopping / transcribing / error, including microphone permission handling and cleanup.
- **Complexity**: 7
- **Dependencies**: Sprint 1 complete
- **Acceptance Criteria**:
  - Capture can be started and stopped from page UI
  - Permission denied shows explicit UI feedback
  - Cancelling capture does not leave stale busy state
- **Validation**:
  - Manual mic permission smoke
  - `npm run typecheck`

### Task 2.2: Add `whisper.cpp` provisioning and runtime path resolution
- **Location**: `electron/transcript-service.ts`, `electron/room-tool-service.ts` if reused, `package.json`, `electron/paths.ts`
- **Description**: Implement the selected runtime/provisioning strategy from Sprint 0, keeping binary/model lookup separate from actual transcription execution.
- **Complexity**: 8
- **Dependencies**: Task 2.1
- **Acceptance Criteria**:
  - Runtime setup is explicit rather than implicit
  - Binary/model resolution succeeds or fails with actionable diagnostics
  - Platform support limitations are surfaced honestly
- **Validation**:
  - Provisioning smoke for the target development machine
  - `npm run typecheck`

### Task 2.3: Add audio normalization and one-shot transcription execution
- **Location**: `electron/transcript-service.ts`, optional audio prep helper under `electron/*`
- **Description**: Implement the chosen audio preparation flow and one-shot `whisper.cpp` invocation so a normalized audio input produces a final transcript result.
- **Complexity**: 6
- **Dependencies**: Task 2.2
- **Acceptance Criteria**:
  - Normalized audio format is honored consistently
  - Local transcription runs without cloud dependencies
  - Service returns text plus minimal metadata needed by the renderer
- **Validation**:
  - Manual transcription smoke with Turkish sample
  - `npm run electron:build`
  - `npm run typecheck`

### Task 2.4: Wire desktop transcription results into the shared transcript envelope
- **Location**: `src/js/modules/transcript/controller.ts`, `src/js/modules/transcript/page-targets.ts`, page-specific controllers
- **Description**: Connect the capture controller and Electron transcription service to the target insertion pipeline so transcript results are ready before final page buttons are wired.
- **Complexity**: 5
- **Dependencies**: Task 2.3
- **Acceptance Criteria**:
  - Transcript text reaches the correct active target through the shared envelope
  - Existing typed draft text is preserved
  - Failure cases reset the UI correctly
- **Validation**:
  - Manual synthetic + real transcript pipeline smoke
  - `npm run typecheck`

## Sprint 3: Add UI Buttons, States, And Android-Ready Ingress Seams
**Goal**: Finish the first-visible UX and leave clean future seams for Android-origin transcript delivery.
**Demo/Validation**:
- Both target inputs show a microphone action with clear state changes
- A synthetic non-PC transcript can enter the same insertion path

### Task 3.1: Add analyze microphone button and state visuals
- **Location**: `src/pages/analyze.html`, `src/js/pages/analyze.ts`, `src/styles/analyze.css`, `src/styles/design-system/components/composites.css`, `shared/languages/en/index.json`, `shared/languages/tr/index.json`
- **Description**: Add the analyze-page microphone action near `#compose-input`, wire it to the transcript controller, and include translated labels, tooltip text, and visual states for recording/transcribing/error.
- **Complexity**: 4
- **Dependencies**: Task 2.3
- **Acceptance Criteria**:
  - Button is visually attached to the compose input
  - State changes are visible and accessible
  - Existing send/upload layout remains usable on desktop and narrow widths
- **Validation**:
  - Manual responsive smoke
  - `npm run lint`

### Task 3.2: Add native OpenCode UI microphone button and state visuals
- **Location**: `src/pages/opencode-ui.html`, `src/js/pages/opencode-ui/app.ts`, `src/js/pages/opencode-ui/chat-events.ts`, `src/styles/design-system/components/chat.css`, `src/js/pages/opencode-ui/i18n.ts`, `src/js/modules/webview/providers/opencode-ui/config.ts`, `shared/languages/en/index.json`, `shared/languages/tr/index.json`
- **Description**: Add the microphone action to the native OpenCode input row, wire it to the transcript controller, and ensure it cooperates with textarea resize/send-button logic.
- **Complexity**: 5
- **Dependencies**: Task 2.3
- **Acceptance Criteria**:
  - Button lives inside the OpenCode input row, not the assistant shell topbar
  - Chat input layout remains stable
  - Send button and mic button states do not conflict
  - Provider selector metadata includes both `voiceButton` and `microphoneButton` so future automation and diagnostics can detect it
- **Validation**:
  - Manual native OpenCode UI smoke
  - `npm run lint`

### Task 3.3: Add source-agnostic transcript ingress for future Android delivery
- **Location**: `src/js/modules/transcript/ingress.ts`, `src/js/modules/transcript/types.ts`, optional Electron seam under `electron/transcript-service.ts` or a new `electron/transcript-bridge.ts`
- **Description**: Introduce a small ingress interface that accepts transcript envelopes from sources other than the desktop mic, and ship at least one synthetic/test source so Android can plug in later without changing page adapters.
- **Complexity**: 5
- **Dependencies**: Sprint 1 complete
- **Acceptance Criteria**:
  - Ingress path can inject a transcript without mic capture
  - Source metadata survives to logging/diagnostics
  - Downstream adapters do not care whether text came from PC or Android
- **Validation**:
  - Manual synthetic ingress smoke
  - `npm run typecheck`

### Task 3.4: Document the deferred Android bridge contract
- **Location**: `.rovo/` follow-up plan note or implementation notes file, inline comments near the ingress seam only where needed
- **Description**: Lock the minimal Android-facing payload contract now so later USB/ADB work does not force a rewrite of the PC insertion pipeline.
- **Complexity**: 3
- **Dependencies**: Task 3.3
- **Acceptance Criteria**:
  - Contract defines source id, target id, text, final flag, and optional metadata
  - Contract explicitly avoids assuming wireless transport
  - Contract is narrow enough to support ADB reverse or other future transports
- **Validation**:
  - Self-review against planned Android constraints

## Sprint 4: Stabilization, Validation, And Non-Regression
**Goal**: Prove the new transcript path works without regressing unrelated message flows.
**Demo/Validation**:
- Both pages work with transcript insertion
- Existing analyze send flow and native OpenCode send flow still behave normally
- Existing `whisper` queue feature remains untouched

### Task 4.1: Add targeted regression checks for page input behavior
- **Location**: targeted smoke coverage or focused test helpers where practical; minimum manual checklist recorded beside the feature work
- **Description**: Validate that transcript insertion updates page-local state consistently with typed input.
- **Complexity**: 4
- **Dependencies**: Sprint 3 complete
- **Acceptance Criteria**:
  - Analyze send button enables/disables correctly after transcript insertion
  - Analyze draft restore still works
  - OpenCode UI textarea auto-resize still works
  - OpenCode UI send button still reflects message presence
- **Validation**:
  - Manual smoke checklist
  - `npm run typecheck`
  - `npm run electron:build`

### Task 4.2: Run non-regression checks for unrelated whisper and assistant flows
- **Location**: existing whisper workspace tool, assistant connection flow, analyze send flow
- **Description**: Confirm the new transcript code did not accidentally reuse or destabilize the old `whisper` queue system or assistant connection lifecycle.
- **Complexity**: 4
- **Dependencies**: Task 4.1
- **Acceptance Criteria**:
  - Existing `whisper` tool UI opens and behaves as before
  - Assistant connection/disconnection still works
  - Assistant reconnect/reload does not drop or misroute transcript delivery state
  - Analyze send/upload behavior still works without the mic feature
- **Validation**:
  - Manual regression smoke
  - `npm run check-types`

## Testing Strategy

- Fast inner-loop:
  - `npm run typecheck`
  - `npm run electron:build`
- Targeted UI smoke:
  - analyze mic -> transcript insert
  - analyze typed draft + transcript append
  - native OpenCode mic -> transcript insert
  - assistant page reload/reconnect with OpenCode UI still functioning
  - assistant reconnect/reload while transcript state is mid-flight
- Non-regression:
  - analyze send and file upload
  - native OpenCode send path
  - existing `whisper` workspace tool
- Optional heavier pass before merge:
  - `npm run lint`
  - `npm run check`

## Potential Risks & Gotchas

- The current `whisper` naming is misleading for this feature.
  - Mitigation: new `transcript` or `dictation` namespace only.
- Native OpenCode UI is a guest surface.
  - Mitigation: use an explicit host/guest contract instead of direct host DOM mutation.
- `getUserMedia` / microphone permission may need Electron-specific handling depending on current shell/session behavior.
  - Mitigation: isolate permission handling in Sprint 2 before UI polish.
- Input insertion must not bypass page-local state refresh.
  - Mitigation: adapters dispatch `input` and reuse existing page state update hooks.
- `whisper.cpp` model/binary packaging can expand scope.
  - Mitigation: `v1` uses one-shot transcription and one default small-enough multilingual model path.
- Android work can sprawl early.
  - Mitigation: only build the ingress seam now, not the transport.
- Cursor-aware insertion can behave differently across pages.
  - Mitigation: standardize on caret insert when focused, append fallback otherwise.
- The shell already has a topbar `whisper` workspace tool that means something else.
  - Mitigation: avoid `whisper` wording for the new mic UX and keep user-facing copy under `transcript` / `dictation` language.
- `MediaRecorder` output can vary by platform and may still force a conversion step even after the UI work is done.
  - Mitigation: lock the canonical normalized input format in Sprint 0 and keep capture/output prep separate from insertion logic.
- If transcript delivery races with assistant reconnect or webview reload, text can be lost or routed to a stale guest.
  - Mitigation: add cancellation/replay protection and explicit reconnect smoke coverage before calling the feature stable.

## Rollback Plan

- Keep all new functionality behind a narrow transcript feature seam so the mic buttons can be disabled without touching analyze send logic or assistant connection logic.
- If desktop STT integration proves unstable, preserve:
  - Sprint 1 target insertion contracts
  - Sprint 3 synthetic ingress seam
  - page UI behind disabled or hidden mic buttons
- If native OpenCode guest integration becomes the blocker, ship analyze-only transcript first while preserving the shared envelope/target architecture for assistant follow-up.
