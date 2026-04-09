# Plan: Game Room Fate Knots

**Generated**: 2026-03-27
**Estimated Complexity**: High

## Overview
Add `fate-knots` as the third `game-room` main function with a strong, portable foundation rather than a fully content-heavy game. V1 should deliver a working skeleton that covers:
- feature registration inside `game-room`
- portable feature-local assets and content manifests
- deterministic host state and serialization
- lobby / ready flow
- character creation using all current processed selection categories
- one intro scenario with common-decision flow
- one combat encounter with a basic combat engine
- resilient `++cmd` bridge under `GameRoomFateKnots*`
- regression coverage that keeps XOX and Team Tetris stable

The plan assumes:
- feature id: `fate-knots`
- command family: `GameRoomFateKnots*`
- V1 prioritizes a strong skeleton over full content breadth
- four-seat play is not mandatory in V1; the host should choose the simplest efficient readiness model now, with stricter seat requirements tracked for V2
- common decisions are mandatory in V1
- the V1 participant set is fixed when a run starts; common-decision quorum is unanimous across those active participants, and timeout or seat-loss moves the session into an explicit recoverable waiting/desync state instead of silently shrinking quorum
- the source asset pool remains under root `assets/**`, but runtime assets for the feature move into portable room-local folders
- scene-mode hotspot placement and transparent-window tuning are deferred after V1, while the feature close-up background asset is still prepared now

## Locked Decisions
- **Feature Identity**: `fate-knots`
- **Command Prefix**: `GameRoomFateKnots`
- **Foundation Strategy**: strong skeleton first
- **Decision Model**: mandatory common decision in V1
- **Character Mapping**:
  - `avatars` -> avatar selection
  - `class-icons` -> class selection
  - `background-icons` -> background selection
- **Playable Slice**: `lobby -> character creation -> map intro -> 1-2 narrative choices -> 1 combat encounter -> result/continue hook`
- **Feature Switching**: the easiest safe approach is acceptable in V1; active Fate Knots state may reset when leaving the feature
- **Localization**: full bilingual completion can be handled after the core V1 plan, but V1 must not break existing i18n expectations

## Prerequisites
- Existing `game-room` room contract and portable-room packaging rules
- Current feature structure under `rooms/game-room/main-functions/*`
- Current source asset pool under `assets/processed/**`
- Existing room regression style under `scripts/tests/*game-room*`
- Existing asset pipeline script: `scripts/process-item-assets.mjs`

## Asset Strategy
The source-of-truth split for V1 should be:
- **Design/source pool**: root `assets/**` and `assets/processed/**`
- **Portable runtime assets**: `rooms/game-room/main-functions/fate-knots/assets/**`
- **Portable runtime content manifests**: `rooms/game-room/main-functions/fate-knots/data/**`

Recommended implementation rule:
- keep root `assets/processed/**` as the upstream art pool
- create a small sync/import step that copies the selected Fate Knots runtime assets into the feature-local room package
- runtime host/UI code must read from room-local paths only
- ids can initially derive from filenames, then be enriched later with better display copy

This keeps the feature bundleable and avoids runtime dependence on workspace-root asset folders.

## Suggested Supporting Skills
### Built-in / already available
- `plan-harder`: primary planning workflow
- `frontend-design`: convert wireframes and UI rules into scene-first implementation choices later
- `agent-browser`: useful for later UI smoke checks and visual walkthroughs
- `codemod`: useful if the current two-feature assumptions need a safe generalized refactor

### Optional external skills worth considering later
- `aj-geddes/useful-ai-prompts@visual-regression-testing`
- `bobmatnyc/claude-mpm-skills@playwright-e2e-testing`
- `ityes22/game-design-document@game-design-document`
- `skills.volces.com@game-designer-toolkit`
- `daffy0208/ai-dev-standards@asset-manager`

These should stay optional unless the implementation phase proves they remove real friction.

## Sprint 1: Room Contract And Portable Feature Skeleton
**Goal**: Make `game-room` capable of hosting a third feature cleanly without breaking XOX or Team Tetris.
**Demo/Validation**:
- `rooms/game-room/manifest.json` validates with a third feature
- the room bundle can include Fate Knots files without missing-path failures
- existing XOX and Team Tetris manifest/room regressions still pass

### Task 1.1: Generalize Two-Feature Assumptions
- **Location**: `rooms/game-room/shared/host/feature-meta.js`, `rooms/game-room/shared/host/context-state.js`, `rooms/game-room/ui/context-runtime.js`, `rooms/game-room/ui/index.js`
- **Description**: Remove current assumptions that only `xox` and `team-tetris` exist. Introduce a normalized multi-feature path so `fate-knots` can be registered without special-casing the room shell forever.
- **Complexity**: 8
- **Dependencies**: None
- **Acceptance Criteria**:
  - the room shell can recognize `fate-knots` as a valid active feature
  - default feature stays `xox`
  - existing features keep their current ids and behavior
- **Validation**:
  - `scripts/tests/game-room-xox-room-regressions.test.ts`
  - `scripts/tests/game-room-team-tetris-room-regressions.test.ts`
  - `scripts/tests/room-manifest-regressions.test.ts`

### Task 1.2: Add Fate Knots Feature Contract To The Room Manifest
- **Location**: `rooms/game-room/manifest.json`, `rooms/game-room/i18n/tr.json`, `rooms/game-room/i18n/en.json`
- **Description**: Register the new feature entry, basic description, command list, protocol list, and provisional close-up asset reference. Scene-mode hotspot placement remains deferred, but the feature should still have a prepared close-up asset path for later integration.
- **Complexity**: 6
- **Dependencies**: Task 1.1
- **Acceptance Criteria**:
  - `fate-knots` appears in `manifest.features[]`
  - the feature has a stable command and protocol contract surface
  - i18n keys exist without breaking current room loading
- **Validation**:
  - `scripts/tests/room-manifest-regressions.test.ts`
  - a new Fate Knots room regression file

### Task 1.3: Create The Feature-Local Directory Skeleton
- **Location**: `rooms/game-room/main-functions/fate-knots/`
- **Description**: Create the portable feature folders: `assets/`, `data/`, `host/`, `ui/`, `protocols/`, and `styles.css`. Copy `assets/team-fate-knots.webp` into the feature-local asset area using a stable runtime filename.
- **Complexity**: 4
- **Dependencies**: Task 1.2
- **Acceptance Criteria**:
  - the new feature follows the canonical room package layout
  - the close-up background exists under the feature-local asset tree
- **Validation**:
  - bundle/build file existence checks in a new Fate Knots room regression test

### Task 1.4: Author Initial Fate Knots Protocol Artifacts
- **Location**: `rooms/game-room/main-functions/fate-knots/protocols/`, `rooms/game-room/manifest.json`
- **Description**: Add the first protocol files for Fate Knots so the feature has explicit AI and US1 contract artifacts from the start. At minimum, define an AI interaction protocol and a US1 transport/info protocol that match the `GameRoomFateKnots*` command family.
- **Complexity**: 6
- **Dependencies**: Tasks 1.2-1.3
- **Acceptance Criteria**:
  - manifest protocol specs point to real Fate Knots protocol files
  - AI and US1-facing protocol artifacts exist with stable keys and filenames
  - protocol text is sufficient for later host/runtime integration and regression testing
- **Validation**:
  - `scripts/tests/room-manifest-regressions.test.ts`
  - `scripts/tests/room-protocol-registry-regressions.test.ts`
  - required-file assertions in Fate Knots room regressions

### Task 1.5: Add Baseline Regression Coverage For The New Feature Contract
- **Location**: `scripts/tests/game-room-fate-knots-room-regressions.test.ts`, `scripts/tests/scene-debug-room-regressions.test.ts`
- **Description**: Add contract-oriented tests for required files, manifest registration, command names, protocol keys, and provisional view asset linkage.
- **Complexity**: 5
- **Dependencies**: Tasks 1.2-1.4
- **Acceptance Criteria**:
  - the repo gains a dedicated Fate Knots regression baseline
  - the scene-debug suite knows the feature exists, even if hotspot tuning is deferred
- **Validation**:
  - `node --test scripts/tests/game-room-fate-knots-room-regressions.test.ts`
  - `scripts/tests/room-command-registry-regressions.test.ts`
  - `scripts/tests/room-protocol-registry-regressions.test.ts`
  - related room regression suites

## Sprint 2: Asset Import Layer And Content Registry Foundation
**Goal**: Build a deterministic, portable content/asset loading layer that reads only room-local runtime files.
**Demo/Validation**:
- a sync/import step can populate Fate Knots runtime assets from the root source pool
- the host can load a registry snapshot without crashing on bad content
- missing files and invalid JSON produce predictable fallback state
- an early room bundle smoke check passes after asset sync so root-path leaks are caught before later sprints

### Task 2.1: Define Feature-Local Runtime Manifest Files
- **Location**: `rooms/game-room/main-functions/fate-knots/data/`
- **Description**: Create the first JSON manifests for runtime assets, card catalogs, character catalogs, scenario content, and combat config. Initial ids may derive from filenames.
- **Complexity**: 7
- **Dependencies**: Sprint 1
- **Acceptance Criteria**:
  - manifests exist for avatars, classes, backgrounds, cards, scenes, map, and combat config
  - filename-derived ids are normalized and stable
- **Validation**:
  - JSON parse checks in dedicated loader tests

### Task 2.2: Add A Feature Asset Sync/Import Utility
- **Location**: `scripts/rooms/`, `rooms/game-room/main-functions/fate-knots/data/asset-import.manifest.json`
- **Description**: Implement a small script that copies the selected source files from root `assets/processed/**` into `rooms/game-room/main-functions/fate-knots/assets/**`, preserving portable runtime paths.
- **Complexity**: 6
- **Dependencies**: Task 2.1
- **Acceptance Criteria**:
  - the feature can be rebuilt from the source asset pool
  - runtime code does not depend on root asset paths
  - the sync process records deterministic source metadata for each copied runtime asset
  - repeated sync runs reconcile or remove stale runtime files instead of drifting silently
  - copied manifest paths are normalized relative paths only, and absolute or traversal-style paths are rejected
  - a room bundle smoke check passes immediately after sync
- **Validation**:
  - dry-run or smoke execution of the import script
  - repeated sync smoke with unchanged inputs
  - early `game-room` room bundle smoke
  - file existence assertions in tests

### Task 2.3: Implement Asset Registry And Content Loader Modules
- **Location**: `rooms/game-room/main-functions/fate-knots/host/asset-registry.js`, `rooms/game-room/main-functions/fate-knots/host/content-loader.js`
- **Description**: Load manifests, resolve runtime-local asset paths, detect duplicate ids, tolerate invalid entries, and produce a predictable registry snapshot for host/UI use.
- **Complexity**: 8
- **Dependencies**: Tasks 2.1-2.2
- **Acceptance Criteria**:
  - duplicate ids are reported and ignored deterministically
  - invalid JSON or missing assets do not crash the feature
  - placeholders/fallback records are available when content is incomplete
  - loader path resolution rejects absolute or traversal-derived manifest entries before runtime use
- **Validation**:
  - `scripts/tests/game-room-fate-knots-asset-registry-regressions.test.ts`

### Task 2.4: Decide How V1 Surfaces The Current Asset Pool
- **Location**: `rooms/game-room/main-functions/fate-knots/data/*.json`
- **Description**: Model the first playable slice so all current asset categories are represented visibly in V1, without forcing every single file into the critical path. The intro scenario should at least surface: map, scene art, avatars, classes, backgrounds, NPCs, locations, items, creatures, and core UI assets.
- **Complexity**: 5
- **Dependencies**: Task 2.3
- **Acceptance Criteria**:
  - the V1 content map explicitly names how each asset category appears on-screen
  - no asset category is left unplanned or orphaned
  - category coverage is defined by minimum visible representation per family, not by wiring every asset file into the critical path
- **Validation**:
  - content manifest review plus UI acceptance checklist

## Sprint 3: Host State Model And Command Surface
**Goal**: Establish serializable game state and a resilient command bridge for a playable shell.
**Demo/Validation**:
- Fate Knots host can initialize, persist, hydrate, and reset state
- command parsing works for valid and invalid payloads
- feature switching can safely reset or invalidate active runs

### Task 3.1: Define Core Models And Persistent State Shape
- **Location**: `rooms/game-room/main-functions/fate-knots/host/models.js`, `rooms/game-room/main-functions/fate-knots/host/state.js`
- **Description**: Define the initial model surface for `CardDefinition`, `CardInstance`, `CharacterDefinition`, `CharacterSelection`, `GameParticipant`, `GameSessionState`, `ScenarioState`, `SceneState`, `CombatState`, `GameAction`, `CombatAction`, `AssetManifest`, `ContentManifest`, and UI snapshot layers.
- **Complexity**: 8
- **Dependencies**: Sprint 2
- **Acceptance Criteria**:
  - state factories and serializers cover lobby, creation, scenario, combat, and result phases
  - public UI snapshots are separate from internal state where it matters
  - persisted-state normalization handles missing, stale, or pre-Fate-Knots room records with an explicit safe reset/migrate policy
- **Validation**:
  - `scripts/tests/game-room-fate-knots-host-regressions.test.ts`
  - serialize/hydrate tests

### Task 3.2: Expand Command Parsing For Fate Knots
- **Location**: `rooms/game-room/main-functions/fate-knots/host/payloads.js`, `rooms/game-room/main-functions/fate-knots/host/commands.js`, optional minimal `rooms/game-room/shared/host/command-args.js` seam only if needed
- **Description**: Add payload readers and normalization helpers for `GameRoomFateKnotsStart`, `Reset`, `Ready`, `CharacterSelect`, `Choice`, `CombatAction`, `Sync`, and `End`, preferring feature-local parsing wrappers over broad shared parser coupling.
- **Complexity**: 7
- **Dependencies**: Task 3.1
- **Acceptance Criteria**:
  - invalid payloads are rejected safely
  - stale and duplicate payload checks have explicit hooks
  - command parsing remains isolated from UI details
  - any shared parser changes stay minimal and do not hard-couple the room shell to Fate Knots payload shapes
- **Validation**:
  - command parsing regression tests with valid/invalid payloads

### Task 3.3: Lock Quorum, Waiting, And Compatibility Policy
- **Location**: `rooms/game-room/main-functions/fate-knots/host/models.js`, `rooms/game-room/main-functions/fate-knots/host/state.js`, `rooms/game-room/main-functions/fate-knots/host/runtime.js`
- **Description**: Freeze the V1 rules for participant eligibility, unanimous common-decision quorum, seat-loss handling, timeout recovery, and legacy-state compatibility before wider UI wiring depends on ambiguous behavior.
- **Complexity**: 6
- **Dependencies**: Tasks 3.1-3.2
- **Acceptance Criteria**:
  - the run captures a stable participant roster at start
  - mandatory common decisions require all active participants in that roster
  - timeout, disconnect, or missing replies move the session into an explicit recoverable waiting/desync state with reason-coded status
  - stale persisted Fate Knots state normalizes to either a compatible migrated record or an explicit safe reset path
- **Validation**:
  - quorum and timeout tests
  - persisted-state compatibility tests

### Task 3.4: Implement Runtime Shell And Room Host Wiring
- **Location**: `rooms/game-room/main-functions/fate-knots/host/runtime.js`, `rooms/game-room/host/index.js`
- **Description**: Add Fate Knots runtime dispatch to the room host, including state push messages, lifecycle hooks, and safe reset behavior when leaving the feature.
- **Complexity**: 8
- **Dependencies**: Tasks 3.1-3.3
- **Acceptance Criteria**:
  - the room host can dispatch Fate Knots commands
  - state updates reach the UI through a dedicated Fate Knots message shape
  - feature switching follows the chosen easy safe reset path
- **Validation**:
  - dedicated host regressions
  - existing XOX and Team Tetris host regressions

### Task 3.5: Add Phase Visibility And Waiting-State Rules
- **Location**: `rooms/game-room/main-functions/fate-knots/host/state.js`, `rooms/game-room/main-functions/fate-knots/host/runtime.js`
- **Description**: Ensure each snapshot always exposes current phase, turn owner, pending actions, and waiting state. This is essential because the user explicitly wants low ambiguity and strong delayed-input tolerance.
- **Complexity**: 5
- **Dependencies**: Task 3.4
- **Acceptance Criteria**:
  - UI never has to infer whether the game is in lobby, creation, scenario, combat, or result
  - waiting and retry states are explicit
- **Validation**:
  - snapshot tests and UI smoke assertions

## Sprint 4: Lobby And Character Creation Vertical Slice
**Goal**: Deliver the first interactive pre-scenario experience with scene-first UI and progressive disclosure.
**Demo/Validation**:
- the user can enter Fate Knots, see a clear lobby, ready up, choose character traits, and move into the scenario
- the UI does not resemble a generic dashboard

### Task 4.1: Add Fate Knots UI Module Registration
- **Location**: `rooms/game-room/ui/index.js`, `rooms/game-room/ui/style.css`, `rooms/game-room/main-functions/fate-knots/ui/module.js`, `rooms/game-room/main-functions/fate-knots/styles.css`
- **Description**: Route the room shell to a Fate Knots UI module when the feature is active, and add feature-local CSS imports.
- **Complexity**: 6
- **Dependencies**: Sprint 3
- **Acceptance Criteria**:
  - the shell can render Fate Knots without affecting other features
  - Fate Knots has isolated state sanitizers and render entrypoints
- **Validation**:
  - UI path regression tests

### Task 4.2: Build The Lobby / Ready Screen
- **Location**: `rooms/game-room/main-functions/fate-knots/ui/module.js`, `rooms/game-room/main-functions/fate-knots/styles.css`
- **Description**: Implement the lobby using the lobby wireframe and UI rules: dominant map center, narrow participant rail, explicit ready/start status, and progressive disclosure for first-time understanding.
- **Complexity**: 7
- **Dependencies**: Task 4.1
- **Acceptance Criteria**:
  - the lobby clearly shows phase, participants, readiness, and the next action
  - it reads like a game staging surface, not a SaaS panel
- **Validation**:
  - targeted UI path regression test
  - manual checklist against `assets/ui_wireframe_lobby.svg`

### Task 4.3: Build Character Creation With Current Selection Pools
- **Location**: `rooms/game-room/main-functions/fate-knots/ui/module.js`, `rooms/game-room/main-functions/fate-knots/data/*.json`
- **Description**: Use all current processed selection families: avatars, class icons, and background icons. Keep the screen readable and preparation-table-like rather than form-like.
- **Complexity**: 7
- **Dependencies**: Tasks 4.1, 2.4
- **Acceptance Criteria**:
  - avatar/class/background choices all work
  - selected character summary is always visible
  - ready state is explicit after selection
- **Validation**:
  - character creation UI regression test
  - state serialization test for chosen loadout

### Task 4.4: Add Minimal First-Time Guidance
- **Location**: `rooms/game-room/main-functions/fate-knots/ui/module.js`, `rooms/game-room/main-functions/fate-knots/styles.css`
- **Description**: Apply the “first five minutes” rule from the spec: reveal only the necessary UI first, reduce noise, and make the next required click obvious.
- **Complexity**: 4
- **Dependencies**: Tasks 4.2-4.3
- **Acceptance Criteria**:
  - the user is not presented with the full system all at once
  - key transitions explain themselves through layout and labels
- **Validation**:
  - manual smoke walkthrough

## Sprint 5: Scenario Screen And Common Decision Flow
**Goal**: Deliver one intro scenario with scene-first narrative UI, common decisions, and visible system state.
**Demo/Validation**:
- after character creation, the player enters a scenario screen
- the scenario shows scene art, narrative text, log, choices, and side status
- the group can submit a required common decision and advance

### Task 5.1: Create Intro Scenario Content And Routing
- **Location**: `rooms/game-room/main-functions/fate-knots/data/scenarios/`, `rooms/game-room/main-functions/fate-knots/host/content-loader.js`
- **Description**: Add one intro scenario and route it through the host. The slice should visibly use location, NPC, and item content from the registered asset pool.
- **Complexity**: 6
- **Dependencies**: Sprints 2-4
- **Acceptance Criteria**:
  - the intro scenario can advance through at least 1-2 narrative choices
  - at least one NPC, one location card, and one item-facing content surface appear during the slice
- **Validation**:
  - scenario flow regression test

### Task 5.2: Implement The Scenario Screen UI
- **Location**: `rooms/game-room/main-functions/fate-knots/ui/module.js`, `rooms/game-room/main-functions/fate-knots/styles.css`
- **Description**: Build the scenario screen using the scenario wireframe: scene image dominant in the upper area, narrative/status on the right, log bottom-left, decisions bottom-right.
- **Complexity**: 8
- **Dependencies**: Task 5.1
- **Acceptance Criteria**:
  - the screen remains scene-first and low-noise
  - system status is visible without overwhelming the scene
  - human, AI, and system messages are visually distinct
- **Validation**:
  - UI regression test
  - manual checklist against `assets/ui_wireframe_scenario.svg`

### Task 5.3: Implement Mandatory Common Decision Resolution
- **Location**: `rooms/game-room/main-functions/fate-knots/host/runtime.js`, `rooms/game-room/main-functions/fate-knots/host/state.js`
- **Description**: Add the simplest reliable common-decision rule for V1. All participating seats must resolve the same pending choice before the scenario advances.
- **Complexity**: 7
- **Dependencies**: Tasks 5.1-5.2
- **Acceptance Criteria**:
  - pending choice state is explicit
  - waiting states are visible
  - timeout never auto-resolves a common choice; it moves the session into a recoverable waiting/desync state instead
  - stale or duplicate responses are invalidated cleanly with a reason-coded host status
  - duplicate or late responses do not corrupt progress
- **Validation**:
  - choice resolution tests
  - delayed input tolerance tests
  - timeout and recovery-state tests

### Task 5.4: Add Re-Sync And Retry Hooks For Narrative State
- **Location**: `rooms/game-room/main-functions/fate-knots/host/runtime.js`, `rooms/game-room/main-functions/fate-knots/ui/module.js`
- **Description**: Add the minimal V1 hooks needed to avoid silent failure when input is delayed, duplicated, or temporarily missing.
- **Complexity**: 5
- **Dependencies**: Task 5.3
- **Acceptance Criteria**:
  - the UI can surface waiting state clearly
  - the host can emit a clean snapshot for re-sync
  - the UI exposes an explicit re-sync or re-submit path after timeout/desync
  - recovery actions never skip unresolved mandatory common-choice state silently
- **Validation**:
  - sync command tests
  - recovery-action tests
  - manual interruption smoke test

## Sprint 6: Combat Engine And Combat Screen
**Goal**: Add one deterministic combat encounter that uses the current creature and combat UI asset families.
**Demo/Validation**:
- the intro scenario can enter combat
- combat accepts actions, resolves outcomes, and returns to scenario/result state

### Task 6.1: Define Combat Config And Action Card Catalog
- **Location**: `rooms/game-room/main-functions/fate-knots/data/combat/`
- **Description**: Model the basic combat configuration and the V1 combat card set: Strike, Quick Strike, Heavy Blow, Risk Strike, Guard, Dodge, Counter, Focus, Position, Recover, Poison, and Stun.
- **Complexity**: 6
- **Dependencies**: Sprint 2
- **Acceptance Criteria**:
  - combat rules are externalized in data files
  - card definitions are stable and testable
- **Validation**:
  - config loader tests

### Task 6.2: Implement The Basic Combat Engine
- **Location**: `rooms/game-room/main-functions/fate-knots/host/combat-engine.js`, `rooms/game-room/main-functions/fate-knots/host/runtime.js`
- **Description**: Build a deterministic, state-driven combat engine using simple stats and externalized config. Combat resolves first; narrative description can remain lightweight.
- **Complexity**: 8
- **Dependencies**: Task 6.1, Sprint 3
- **Acceptance Criteria**:
  - one encounter can initialize, resolve turns, and end cleanly
  - combat writes results back into scenario state
  - state remains serializable
- **Validation**:
  - `scripts/tests/game-room-fate-knots-engine-regressions.test.ts`
  - serialize/hydrate combat tests

### Task 6.3: Build The Combat Screen UI
- **Location**: `rooms/game-room/main-functions/fate-knots/ui/module.js`, `rooms/game-room/main-functions/fate-knots/styles.css`
- **Description**: Implement the combat screen from the combat wireframe and UI rules: enemies on the upper stage, action cards below, combat log to the left, party/status information visible but restrained.
- **Complexity**: 8
- **Dependencies**: Task 6.2
- **Acceptance Criteria**:
  - combat feels like the same world, not a disconnected dashboard
  - the screen visibly uses creature, combat-icon, status, and combat-fx asset families
- **Validation**:
  - UI regression test
  - manual checklist against `assets/ui_wireframe_combat.svg`

### Task 6.4: Return To Scenario Or Result With A Continue Hook
- **Location**: `rooms/game-room/main-functions/fate-knots/host/runtime.js`, `rooms/game-room/main-functions/fate-knots/ui/module.js`
- **Description**: After the first encounter, route the user either back to narrative state or into a lightweight result/continue screen that leaves a clean hook for V2.
- **Complexity**: 4
- **Dependencies**: Task 6.3
- **Acceptance Criteria**:
  - the playable slice closes cleanly after combat
  - the state exposes a stable continue point for later expansion
- **Validation**:
  - end-to-end smoke test of the full V1 slice

## Sprint 7: Integration Hardening And Regression Safety Net
**Goal**: Harden the feature against delayed input, packaging issues, and regressions in existing room features.
**Demo/Validation**:
- the full V1 slice can run without breaking XOX or Team Tetris
- packaging and room-copy logic keep Fate Knots portable
- failure cases degrade predictably

### Task 7.1: Add Full Fate Knots Regression Suites
- **Location**: `scripts/tests/game-room-fate-knots-host-regressions.test.ts`, `scripts/tests/game-room-fate-knots-ui-path-regressions.test.ts`, `scripts/tests/game-room-fate-knots-engine-regressions.test.ts`, `scripts/tests/game-room-fate-knots-asset-registry-regressions.test.ts`
- **Description**: Create targeted tests for host init, command parsing, asset loading, scenario flow, combat flow, and UI path coverage.
- **Complexity**: 7
- **Dependencies**: Sprints 2-6
- **Acceptance Criteria**:
  - V1 behavior is covered by small focused regression files
  - failures point to one subsystem clearly
- **Validation**:
  - `node --test` on the new suites

### Task 7.2: Re-Run Existing Game Room Regressions
- **Location**: existing `scripts/tests/game-room-xox-*.test.ts`, `scripts/tests/game-room-team-tetris-*.test.ts`
- **Description**: Verify that generalizing the room shell and host wiring did not regress the current features, and that room-level registries and feature switching can see Fate Knots cleanly.
- **Complexity**: 3
- **Dependencies**: Task 7.1
- **Acceptance Criteria**:
  - XOX and Team Tetris still pass their targeted room/host/ui regressions
  - room-level command and protocol registries expose Fate Knots entries correctly
  - room-page feature switching can see Fate Knots without destabilizing existing features
- **Validation**:
  - existing regression suites
  - `scripts/tests/room-command-registry-regressions.test.ts`
  - `scripts/tests/room-protocol-registry-regressions.test.ts`
  - `scripts/tests/room-page-regressions.test.ts`

### Task 7.3: Validate Portable Room Packaging
- **Location**: `scripts/rooms/build-room-bundle.mjs`, room bundle tests if needed
- **Description**: Confirm Fate Knots room-local assets and data are included in room bundle outputs, with no runtime dependence on root `assets/processed/**`.
- **Complexity**: 5
- **Dependencies**: Sprints 1-6
- **Acceptance Criteria**:
  - a bundled room contains the Fate Knots runtime files it needs
  - required file collection passes
  - the installed room copy can hydrate Fate Knots runtime files and still pass a minimal feature smoke check without workspace-root asset access
- **Validation**:
  - room bundle smoke test
  - installed-copy runtime smoke
  - bundle import regression coverage if necessary

### Task 7.4: Finish Manual Smoke Checklist
- **Location**: implementation notes or PR checklist
- **Description**: Validate the expected user flow: select game, enter lobby, ready up, build character, enter scenario, submit choice, enter combat, resolve combat, and confirm existing features still work.
- **Complexity**: 3
- **Dependencies**: Tasks 7.1-7.3
- **Acceptance Criteria**:
  - the manual flow mirrors the requested V1 slice
  - known rough edges are documented explicitly
- **Validation**:
  - manual smoke run

## Testing Strategy
- **Contract tests**:
  - room manifest validation
  - required file existence
  - command/protocol registration
- **Loader tests**:
  - asset registry init
  - invalid JSON tolerance
  - missing file fallback
  - duplicate id handling
- **State tests**:
  - init
  - hydrate / serialize
  - feature reset behavior
  - phase visibility rules
- **Scenario tests**:
  - intro scenario routing
  - common decision waiting and resolve flow
  - sync / retry behavior
- **Combat tests**:
  - config load
  - engine init
  - action resolution
  - state return path after combat
- **Regression tests**:
  - XOX
  - Team Tetris
  - room command registry
  - room protocol registry
  - room-page feature switching
  - room bundle portability

## Potential Risks And Gotchas
- **Third-feature refactor risk**: `game-room` currently carries hardcoded two-feature assumptions. If generalized poorly, XOX and Team Tetris can regress even before Fate Knots logic is added.
- **Portable asset drift**: If any runtime path still points at root `assets/processed/**`, room bundles may work in workspace but fail after packaging or install.
- **Scope inflation**: “Use all processed assets” can explode content scope. V1 should guarantee all categories are represented, not that every asset file gets bespoke gameplay.
- **Decision deadlock**: Mandatory common decisions can stall if a participant is delayed. The plan must keep waiting state, retry, and re-sync explicit to avoid silent deadlock.
- **UI drift into dashboard style**: The wireframes and UI rules are strict. The implementation needs scene-first composition and restrained system chrome.
- **Localization gap**: The room already uses `tr` and `en`. Even if full English copy is deferred, the feature cannot leave broken or missing key paths in the room shell.
- **Feature-switch reset surprise**: Reset-on-leave is acceptable for V1, but it must be clearly surfaced in status text so users do not lose state silently.
- **Content naming debt**: Filename-derived ids are fine for V1, but the manifests should make later copy enrichment easy.

## Recommended Refinements Before Implementation
- Keep scene-mode hotspot placement out of the critical path. Only prepare the close-up asset now.
- Use feature-local manifests early, even if their first version is small and partly filename-driven.
- Prefer adding a small asset sync script instead of manual copy steps so future art changes are repeatable.
- Treat “all categories visible” as a content coverage matrix, not as “every single file appears in the first ten minutes.”

## Current Asset Sufficiency
- **Blocking status**: the current processed asset pool appears sufficient for the V1 skeleton.
- **V1-ready families**:
  - map background
  - scenario scene backgrounds
  - avatars
  - class icons
  - background icons
  - NPC, location, item, and creature card art
  - reusable UI frames, buttons, dialogue, status, combat, overlay, and map assets
- **Optional extras, not blockers**:
  - a dedicated Fate Knots wordmark or logo plate
  - feature-specific panel art for the close-up view
  - extra creature or NPC art if later encounters need more visual variety
  - phase-specific icons for lobby / scenario / combat / result

## Rollback Plan
- Revert Fate Knots manifest and shell registration first if the third-feature generalization destabilizes `game-room`.
- Keep the portable feature under its own folder so partial rollback can delete `rooms/game-room/main-functions/fate-knots/**` cleanly.
- If loader or host hardening becomes too large, freeze the feature at a read-only shell after Sprint 2 or Sprint 3, while preserving the portable asset/content structure.
- If common-decision orchestration proves too fragile in the first pass, keep the single shared-choice UI but reduce the sync logic to a simpler host-owned state transition before expanding again.

## Post-V1 Backlog
- Scene-mode hotspot placement and transparent-window tuning for Fate Knots inside `game-room`
- Stricter seat requirements or true four-seat enforcement
- Full English localization pass and copy polish
- Richer scenario branches and multiple encounters
- More nuanced decision resolution beyond mandatory common agreement
- AI-specific protocol improvements and higher-fidelity remote sync behavior
- Optional dedicated Fate Knots panel art or wordmark if the current asset set feels too generic
