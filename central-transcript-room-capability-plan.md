# Plan: Central Transcript Room Capability

**Generated**: 2026-04-22
**Estimated Complexity**: High

## Overview
- Promote the current Analyze dictation runtime and Laboratory `whisper.cpp` usage into a single Hayalet Ev speech capability owned by the core app.
- Keep local transcription out of the `++cmd` critical path. Use a typed capability/event bus for capture, transcription, and transcript fan-out. Reserve `++cmd` for optional AI reactions after a transcript already exists.
- Recommended architecture:
  - `SpeechRuntimeService` in `electron/` owns `whisper-cli` discovery/build, model catalog, checksum verification, active locale/profile resolution, and transcription jobs.
  - `TranscriptIngressHub` in `electron/` owns publish/subscribe fan-out to renderer coordinators, assistant relays, and room-host consumers.
  - `TranscriptCapabilityClient` in `src/js/modules/transcript/` becomes the shared renderer entry point for Analyze, Assistant, OpenCode UI, and future rooms.
  - `Room Transcript Adapter` exposes the capability through the existing room-host bridge and runtime message queues instead of broad `electronAPI` exposure.
- Recommended model policy for v1:
  - English `light` -> `tiny.en`
  - English `full` -> `base.en`
  - Turkish `light` -> multilingual `tiny`
  - Turkish `full` -> multilingual `base`
- Recommended default language policy:
  - Resolve from `settings.general.language`
  - Map `tr*` to `tr`
  - Map all other locales to `en` unless a future explicit override is introduced
- Recommended room policy:
  - Core app owns binary/model lifecycle and shared cache
  - Rooms consume the capability and may request profile hints
  - Room identity and consumer scope are derived from host registration, not renderer-supplied IDs
  - Room-specific model ownership/download state should be retired over time
- Recommended override policy:
  - Shell dictation defaults to app language + global transcript profile
  - Room-owned analysis jobs can pass job hints for locale/model intent without taking over binary/model ownership

## Architecture Decisions
- Use a main-process capability hub as the source of truth. Do not make `BroadcastChannel` the canonical transport because room webviews and assistant webviews already rely on IPC-driven fan-out.
- Keep the current `transcript:ingress` idea, but generalize it into scoped consumers plus explicit relay hops from Electron -> renderer coordinator -> child webview or room runtime.
- Use the existing room host/event bridge as the only room-facing seam. Do not introduce a second direct preload mini-API for transcript capability ownership.
- Do not route local microphone capture or transcription through `++cmd`. It adds protocol coupling, capture risk, and unnecessary AI dependency to a local runtime feature.
- Allow optional `++cmd` follow-up only as a secondary adapter for rooms that want transcript completion to trigger an AI workflow.
- File-based transcription requests must stay inside managed paths or service-owned temp assets so the capability does not become a generic room file-read primitive.

## Prerequisites
- Use `rooms/laboratory` as the editable room source of truth. Do not plan edits against `data/rooms/laboratory` except for runtime validation.
- Preserve the existing environment override behavior:
  - `HAYALET_EV_TRANSCRIPT_WHISPER_BIN`
  - `HAYALET_EV_TRANSCRIPT_WHISPER_MODEL`
- Preserve backward compatibility for current consumers:
  - Analyze page dictation
  - Assistant transcript ingress
  - OpenCode UI dictation
  - `electron/preload.cjs` transcript aliases
  - `electron/webview-preload.cjs` assistant transcript hooks
  - `src/js/app/electron-fallback.ts`
- Decide naming during implementation kickoff:
  - User-facing profile labels: `Light/Full` or `Fast/Deep`
  - Keep Laboratory per-project model intent as a job hint layer even after centralization

## Sprint 1: Define Core Contracts
**Goal**: Create non-breaking type and settings seams so the capability can be centralized without immediately rewriting every consumer.
**Demo/Validation**:
- `npm run typecheck` passes with new speech/transcript types in place.
- Existing Analyze and Assistant callers still compile against compatibility adapters.
- A developer can inspect a typed locale/profile resolution path without changing runtime behavior yet.

### Task 1.1: Add Shared Speech Settings Types
- **Location**: `src/types/settings.ts`, `src/types/settings-defaults.ts`, `src/js/modules/settings/settings-schema.ts`
- **Description**: Add a new app-owned speech/transcript settings block under `general`, including profile selection and any future-proof fields needed for locale policy.
- **Complexity**: 4
- **Dependencies**: None
- **Acceptance Criteria**:
  - Settings schema can represent a global transcript profile without breaking old settings files.
  - Default settings resolve to a safe baseline profile.
  - Legacy settings normalize cleanly.
- **Validation**:
  - `npm run typecheck`
  - Manual schema normalization check with an old settings payload

### Task 1.2: Generalize Transcript Domain Types
- **Location**: `src/types/transcript.ts`, potential new `shared/transcript/model-catalog.ts`
- **Description**: Replace page-specific targeting with typed consumer IDs, transcript scopes, model descriptors, and locale/profile resolution contracts.
- **Complexity**: 5
- **Dependencies**: Task 1.1
- **Acceptance Criteria**:
  - Types can describe app consumers and room consumers with one contract.
  - Types can represent active model metadata, not only `modelId` and `modelLanguage`.
  - Existing renderer callers can be adapted without ambiguity.
- **Validation**:
  - `npm run typecheck`
  - Review compile errors in `src/js/modules/transcript/*` and `electron/transcript-service.ts`

### Task 1.3: Define the Shared Model Selection Policy
- **Location**: new `shared/transcript/model-policy.ts`, `electron/transcript-service.ts`
- **Description**: Encode the locale/profile-to-model mapping, fallback rules, env var precedence, and checksum metadata for shared models.
- **Complexity**: 5
- **Dependencies**: Task 1.2
- **Acceptance Criteria**:
  - The model policy resolves the four requested TR/EN light/full combinations.
  - Turkish policy explicitly uses multilingual models.
  - The policy documents how unknown locales fall back.
- **Validation**:
  - Unit-level policy assertions or a small targeted test file
  - Manual policy review against the current Laboratory descriptors

### Task 1.4: Write a Short Migration Note
- **Location**: new `docs/transcript-centralization.md` or inline architecture note near the new shared contract
- **Description**: Document why the capability hub is preferred over `++cmd`, what remains backward-compatible, and how Laboratory will migrate.
- **Complexity**: 2
- **Dependencies**: Task 1.3
- **Acceptance Criteria**:
  - The migration path is explicit enough that future room work does not recreate direct `whisper-cli` ownership.
  - The note calls out room-source-of-truth and security boundaries.
- **Validation**:
  - Manual review

## Sprint 2: Centralize the Electron Runtime
**Goal**: Turn the current `transcript-service` into a core runtime that owns binary/model lifecycle and consumer-safe fan-out.
**Demo/Validation**:
- `transcript-status` returns active model metadata derived from app language + profile.
- Runtime preparation downloads or reuses the correct model for TR/EN profile combinations.
- The same service can transcribe both microphone-style payloads and file-based room artifacts.
- Assistant and room consumers still receive transcript delivery through their current renderer-relay paths.
- Existing Analyze dictation still works through compatibility wiring.

### Task 2.1: Split Runtime, Model Registry, and Ingress Hub Responsibilities
- **Location**: `electron/transcript-service.ts`, new `electron/transcript-model-registry.ts`, new `electron/transcript-ingress-hub.ts`
- **Description**: Refactor the current monolith so runtime prep, model resolution, and transcript fan-out are separate but coordinated.
- **Complexity**: 7
- **Dependencies**: Task 1.3
- **Acceptance Criteria**:
  - Runtime prep no longer hardcodes `ggml-base.bin`.
  - Fan-out no longer depends on only `analyze-compose` and `assistant-opencode-native`.
  - Service boundaries are explicit enough for room access to reuse them.
- **Validation**:
  - `npm run typecheck`
  - Manual `transcript-status` inspection in Electron dev mode

### Task 2.2: Implement Shared Model Cache and Verification Rules
- **Location**: `electron/transcript-service.ts`, new `shared/transcript/model-catalog.ts`
- **Description**: Add the shared cache entries for `tiny.en`, `base.en`, `tiny`, and `base`, including checksum verification and destination naming under `data/transcript/models`.
- **Complexity**: 7
- **Dependencies**: Task 2.1
- **Acceptance Criteria**:
  - Central runtime downloads each model at most once per cache path.
  - Checksum mismatch removes or quarantines bad downloads.
  - Env overrides still short-circuit bundled policy safely.
- **Validation**:
  - Targeted install/verify smoke tests
  - Manual cache inspection under `data/transcript/models`

### Task 2.3: Bind Runtime Resolution to App Language and Profile
- **Location**: `electron/transcript-service.ts`, `electron/settings-manager.ts`
- **Description**: Read app settings during status, runtime ensure, and transcribe calls so active whisper language and model are always aligned with the core app setting.
- **Complexity**: 5
- **Dependencies**: Task 2.2
- **Acceptance Criteria**:
  - `transcribeLocal()` does not depend on callers sending `"auto"` to choose language.
  - Status exposes the resolved active locale family and active model descriptor.
  - Settings changes affect subsequent requests without needing duplicate room logic.
- **Validation**:
  - `npm run typecheck`
  - Manual locale/profile switch smoke check

### Task 2.4: Add Shared Batch and File-Based Transcription Requests
- **Location**: `electron/transcript-service.ts`, `electron/handlers/ipc-transcript.ts`, `src/types/transcript.ts`, `src/js/modules/transcript/electron-client.ts`
- **Description**: Extend the core service so it can process both base64 audio payloads and existing file-path or temp-artifact jobs, while enforcing managed-path restrictions for room-owned assets.
- **Complexity**: 6
- **Dependencies**: Task 2.3
- **Acceptance Criteria**:
  - The core service accepts both renderer-captured audio and room-host file artifacts.
  - A transcription job pins its resolved model and language at job start.
  - File-based jobs do not assume ownership of Laboratory output files unless explicitly told to manage temp files.
  - Arbitrary file paths from rooms are rejected unless they come from managed room-tool outputs or service-owned temp paths.
- **Validation**:
  - Targeted smoke test with a temporary WAV path
  - Targeted smoke test with a mic-style base64 payload

### Task 2.5: Generalize Transcript Publish/Subscribe
- **Location**: `electron/handlers/ipc-transcript.ts`, `electron/preload.cjs`, `electron/webview-preload.cjs`, `src/js/modules/transcript/electron-client.ts`
- **Description**: Evolve the current ingress flow into a consumer-scoped, two-hop transport that routes transcripts through renderer coordinators and existing room/assistant relay paths without leaking text to unintended surfaces.
- **Complexity**: 6
- **Dependencies**: Task 2.4
- **Acceptance Criteria**:
  - Consumers can subscribe by typed consumer ID or scope.
  - Assistant-specific delivery still works.
  - Analyze compatibility remains intact while the new transport exists.
  - Transport explicitly models assistant renderer relay and room-page relay behavior with readiness queues.
- **Validation**:
  - Manual multi-consumer smoke test
  - Regression test for assistant transcript ingress

### Task 2.6: Preserve Legacy API Shape During Migration
- **Location**: `electron/preload.cjs`, `electron/webview-preload.cjs`, `src/js/modules/transcript/electron-client.ts`, `src/js/app/electron-fallback.ts`
- **Description**: Keep current preload aliases and compatibility entry points intact until app shell, assistant relay, and Laboratory adapters are migrated.
- **Complexity**: 4
- **Dependencies**: Task 2.5
- **Acceptance Criteria**:
  - Existing transcript preload methods remain callable during migration.
  - Assistant relay paths keep working with compatibility aliases.
  - Fallback contracts remain aligned with the evolving runtime status shape.
- **Validation**:
  - `npm run typecheck`
  - Manual Analyze + Assistant smoke pass before deeper room migration

## Sprint 3: Unify Renderer and Settings Surfaces
**Goal**: Make the app shell use the new capability client so settings, Analyze, Assistant, and OpenCode UI all consume the same behavior.
**Demo/Validation**:
- Changing the transcript profile in Settings updates future dictation runs.
- Analyze and OpenCode UI dictation continue to work with the centralized runtime.
- No page directly hardcodes `"auto"` as its local dictation policy anymore.

### Task 3.1: Introduce a Shared Capability Client
- **Location**: new `src/js/modules/transcript/capability-client.ts`, `src/js/modules/transcript/electron-client.ts`
- **Description**: Add a renderer-facing client that hides IPC details, consumer registration, and active model metadata resolution.
- **Complexity**: 5
- **Dependencies**: Task 2.5
- **Acceptance Criteria**:
  - Analyze, Assistant, and OpenCode UI can use one client contract.
  - Consumer registration and ingress subscription no longer require ad hoc page logic.
  - Future room adapters can reuse this client.
- **Validation**:
  - `npm run typecheck`
  - Manual client smoke check in Analyze and Assistant surfaces

### Task 3.2: Update Shared Dictation UI Bindings
- **Location**: `src/js/modules/transcript/dictation-ui.ts`, `src/js/pages/analyze.ts`, `src/js/pages/opencode-ui/app.ts`
- **Description**: Update dictation bindings so they request transcription through the capability client and inherit the app-owned language/profile policy automatically.
- **Complexity**: 4
- **Dependencies**: Task 3.1
- **Acceptance Criteria**:
  - Dictation bindings no longer send a hardcoded `"auto"` language.
  - Existing button UX remains stable.
  - Success and error notices stay localized.
- **Validation**:
  - Manual microphone smoke test on Analyze and OpenCode UI

### Task 3.3: Add Settings UX for Transcript Profile
- **Location**: `src/pages/settings.html`, `src/js/pages/settings/accounts/user-panel.ts`, `src/styles/main.css`, `shared/languages/tr/index.json`, `shared/languages/en/index.json`
- **Description**: Add a second selector under application language for transcript profile, keep the layout stable, and localize user-facing copy.
- **Complexity**: 4
- **Dependencies**: Task 1.1
- **Acceptance Criteria**:
  - Settings panel exposes the new profile choice under language.
  - Labels remain understandable in TR and EN.
  - Saving the profile updates app settings without breaking existing account UI.
- **Validation**:
  - Manual settings UI smoke test
  - `npm run typecheck`

### Task 3.4: Update Renderer Fallback Contracts
- **Location**: `src/js/app/electron-fallback.ts`, `src/js/global.d.ts`
- **Description**: Keep fallback and global typing aligned with the richer runtime status and consumer contract.
- **Complexity**: 3
- **Dependencies**: Task 3.1
- **Acceptance Criteria**:
  - Non-Electron fallback code still compiles.
  - New status fields and consumer methods are typed everywhere.
- **Validation**:
  - `npm run typecheck`

## Sprint 4: Laboratory Projection Compatibility
**Goal**: Project the central capability into Laboratory’s existing tool/model/readiness UI before any execution callsite is swapped.
**Demo/Validation**:
- Laboratory model panels still show install/remove/progress/readiness state.
- Persisted project `modelId` state continues to resolve meaningfully.
- Managed and local process views still surface transcript progress and readiness without swapping runners yet.

### Task 4.1: Project Central Runtime State into Laboratory Model and Tool Surfaces
- **Location**: `rooms/laboratory/main-functions/media-analysis/host/profile-models.ts`, `rooms/laboratory/main-functions/media-analysis/host/profile-state.ts`, `rooms/laboratory/shared/host/tool-mutations.ts`, `rooms/laboratory/shared/host/room-tools-progress.ts`
- **Description**: Add a projection layer that maps the central registry and runtime status into Laboratory’s current `toolState`, `profileModelState`, readiness warnings, progress events, and persisted model selection semantics.
- **Complexity**: 8
- **Dependencies**: Task 2.6
- **Acceptance Criteria**:
  - Laboratory can render central tool/model status without becoming the owner of downloads.
  - Existing progress/install/remove/readiness UI remains functional.
  - Persisted `modelId` state still maps to a valid central descriptor or a safe migration fallback.
- **Validation**:
  - Manual Laboratory profile-model panel smoke test
  - Manual install/remove/progress UI smoke test

### Task 4.2: Add a Laboratory Execution Adapter Before Runner Swap
- **Location**: `rooms/laboratory/shared/host/analysis-artifact-runtime.ts`, `rooms/laboratory/main-functions/audio-analysis/host/process-local-runners.ts`, `rooms/laboratory/shared/host/process-managed-media-runner.ts`, `rooms/laboratory/host/project-runtimes.ts`
- **Description**: Introduce an adapter layer that can call the central transcription capability while preserving Laboratory artifact paths, job/progress wiring, and managed-runner semantics.
- **Complexity**: 8
- **Dependencies**: Task 4.1
- **Acceptance Criteria**:
  - Laboratory local and managed runners can call through the adapter without changing user-facing behavior.
  - Transcript artifacts still land in Laboratory-owned output paths.
  - No direct `whisper.cpp` shell-out is removed until the adapter path is proven stable.
- **Validation**:
  - Manual Laboratory managed-run smoke test
  - Manual transcript artifact generation smoke test

## Sprint 5: Expose the Capability to Rooms
**Goal**: Give rooms a first-class way to consume speech/transcript behavior through the existing room host/runtime seam.
**Demo/Validation**:
- A room UI can subscribe to transcript ingress and request transcription through host-mediated capability messages.
- No room needs broad `electronAPI` exposure.
- Room runtime reload and readiness queues continue to behave correctly.

### Task 5.1: Standardize the Room Transcript Contract on the Existing Host Bridge
- **Location**: `electron/room-webview-preload.cjs`, `src/js/modules/rooms/room-host-runtime.ts`, `src/js/pages/room-page/runtime-messaging.ts`, `src/js/pages/room-page/runtime-events.ts`
- **Description**: Define transcript capability messages over the existing room host channel and readiness queue system instead of creating a second direct room preload capability surface.
- **Complexity**: 6
- **Dependencies**: Task 2.5
- **Acceptance Criteria**:
  - Room transcript requests and ingress subscriptions flow through room-host messages and `notifyRoom`.
  - Room identity is derived from host registration, not renderer-supplied consumer IDs.
  - Pending-room-message behavior stays intact when the runtime is not ready yet.
- **Validation**:
  - Manual room runtime load/reload smoke test
  - Security review of exposed room-facing methods

### Task 5.2: Add a Room Transcript Adapter in the Shared Client Layer
- **Location**: new `src/js/modules/transcript/room-client.ts`, `src/js/modules/transcript/capability-client.ts`, `src/js/pages/room-page/runtime-messaging.ts`, `src/js/pages/room-page/runtime-events.ts`
- **Description**: Provide a room-aware client wrapper so room runtime UIs can consume the same dictation/transcript helpers as the core shell while respecting room-host routing.
- **Complexity**: 5
- **Dependencies**: Task 5.1
- **Acceptance Criteria**:
  - Room UIs can reuse shared dictation helpers or a small adapter over them.
  - Room ingress messages are routed only to intended room consumers.
  - Room UI microphone capture stays browser-owned while transcription stays centralized.
- **Validation**:
  - Manual room dictation smoke test
  - `npm run typecheck`

### Task 5.3: Swap Laboratory Execution Callsites to the Central Capability
- **Location**: `rooms/laboratory/shared/host/analysis-artifact-runtime.ts`, `rooms/laboratory/main-functions/audio-analysis/host/process-local-runners.ts`, `rooms/laboratory/shared/host/process-managed-media-runner.ts`, `rooms/laboratory/host/project-runtimes.ts`
- **Description**: Replace the remaining direct Laboratory execution paths with the central capability only after the projection and adapter layers are stable.
- **Complexity**: 8
- **Dependencies**: Task 4.2, Task 5.2
- **Acceptance Criteria**:
  - Laboratory transcript sampling no longer shells out directly to `whisper.cpp`.
  - Transcript artifacts still land in Laboratory output paths.
  - Runtime errors and progress come from the shared capability instead of duplicate room-local logic.
- **Validation**:
  - Manual Laboratory transcript sample smoke test
  - Regression check for transcript artifact creation

## Sprint 6: Hardening, Cleanup, and Adoption Rules
**Goal**: Finish the migration safely and make the central capability the default path for future rooms.
**Demo/Validation**:
- The full smoke matrix passes across app shell, assistant surfaces, and Laboratory.
- Documentation clearly tells future room work how to consume the shared capability.
- Old direct `whisper.cpp` ownership paths are either removed or marked deprecated.

### Task 6.1: Add Focused Tests for Model Policy and Fan-Out Rules
- **Location**: test locations matching the repo’s current transcript and room test conventions
- **Description**: Add tests for locale/profile resolution, checksum path handling, consumer scoping, room-safe delivery, relay behavior, and Laboratory projection compatibility.
- **Complexity**: 6
- **Dependencies**: Task 5.3
- **Acceptance Criteria**:
  - Tests cover TR/EN light/full resolution.
  - Tests cover ingress routing isolation between app and room consumers.
  - Tests cover runtime fallback/error cases.
  - Tests cover assistant relay behavior, room reload replay, and Laboratory progress/projection semantics.
- **Validation**:
  - `npm run typecheck`
  - Targeted test runs

### Task 6.2: Remove or Deprecate Duplicate Runtime Paths
- **Location**: `rooms/laboratory/*`, `electron/transcript-service.ts`, any leftover compatibility shims
- **Description**: Remove obsolete direct `whisper-cli` ownership paths or mark them as temporary compatibility shims with explicit cleanup notes.
- **Complexity**: 5
- **Dependencies**: Task 6.1
- **Acceptance Criteria**:
  - The central capability is the documented default path.
  - Duplicate ownership code is either gone or clearly marked for follow-up removal.
  - No installed-room drift is introduced by editing generated copies.
- **Validation**:
  - Manual code review
  - `npm run typecheck`

### Task 6.3: Publish a Future Room Integration Checklist
- **Location**: `docs/transcript-centralization.md` or room integration documentation
- **Description**: Add a concise checklist for future room authors covering capability registration, consumer IDs, transcript fan-out, and when `++cmd` is appropriate.
- **Complexity**: 2
- **Dependencies**: Task 6.2
- **Acceptance Criteria**:
  - Future room work has one documented integration path.
  - The checklist explicitly says local speech features should use the capability bus, not raw `++cmd`.
- **Validation**:
  - Manual review

## Testing Strategy
- Run `npm run typecheck` after each sprint because the migration touches shared types, preload contracts, renderer clients, and room adapters.
- Add focused tests for:
  - Locale/profile model resolution
  - Checksum and cache handling
  - Consumer-scoped ingress fan-out
  - Assistant relay compatibility
  - Room-safe transcript access
  - Room runtime reload/replay behavior
  - Laboratory projection state and progress semantics
  - Concurrent model ensure/download dedupe
- Keep a manual smoke matrix:
  - Analyze dictation with app language `tr` + `light`
  - Analyze dictation with app language `en` + `full`
  - Assistant transcript ingress delivery
  - OpenCode UI dictation button flow
  - Laboratory profile-model install/remove/progress projection
  - Laboratory transcript sample artifact generation
  - One room runtime reload/reconnect scenario after transcript subscription

## Potential Risks & Gotchas
- Turkish does not have a dedicated `*.tr.bin` model in the current repo/runtime descriptors, so the plan must intentionally use multilingual models for TR.
- Laboratory currently has its own model registry and readiness UX. Centralizing ownership without a projection layer will break that UI.
- Room webviews currently only expose `roomAPI`; giving them raw `electronAPI` would widen the security surface too much.
- Room microphone permissions can behave differently from main renderer permissions, so capture should stay in the room UI context while transcription stays centralized.
- Existing `transcript:ingress` fan-out is broad. Generalizing it without consumer scoping could leak transcript text into unintended surfaces.
- Model downloads are large and expensive. The new service needs job serialization or dedupe so simultaneous room/app requests do not redownload the same file.
- Settings changes can race with an active transcription job. The runtime should resolve the active model at request start and keep that job pinned to one descriptor.
- App-language defaults are correct for shell dictation, but room-owned analysis jobs may need explicit job hints to avoid regressing multilingual content analysis.
- File-based transcription jobs must not accidentally delete or relocate Laboratory-owned artifacts during central cleanup.
- Environment overrides and packaged/runtime probe paths must keep their precedence; otherwise existing manual installs may silently stop working.
- Room migrations must avoid editing `data/rooms/*` as if they were source files.

## Rollback Plan
- Keep compatibility adapters for the old Analyze, Assistant, and room relay contracts until the room capability path is stable.
- Ship the central runtime behind non-breaking API aliases first, then remove old direct-call sites only after smoke coverage passes.
- Preserve the current `HAYALET_EV_TRANSCRIPT_WHISPER_BIN` and `HAYALET_EV_TRANSCRIPT_WHISPER_MODEL` overrides throughout the migration.
- If Laboratory migration slips, keep Laboratory on a temporary adapter that reads central runtime status while still using its existing UI projection.
- If room preload exposure becomes risky, fall back to a host-mediated room adapter before exposing any broader room-facing API.
- Gate rollout per consumer surface: `app shell`, `assistant relay`, and `Laboratory` should be independently disableable during migration.
