# Plan: Fate Knots Pre-Skill Cleanup

**Generated**: 2026-03-29
**Estimated Complexity**: Medium

## Overview
Perform a narrow semantic cleanup on Fate Knots so future visual skills operate on a stable, reviewable surface instead of guessing around duplicated asset plumbing and inconsistent DOM semantics.

Approach:
- keep the current DOM/CSS renderer and current host/gameplay contract
- limit scope to asset source-of-truth, landmark clarity, truthful phase identity, and marker semantics
- preserve the current playable flow and command payloads
- treat this as a cleanup pass, not a redesign or polish pass

## Assumptions
- The renderer stays DOM/CSS; no PixiJS, canvas, or room-shell rewrite is introduced here.
- Host/runtime payload shape stays stable unless a tiny UI-facing alias or debug field is required for phase truthfulness.
- Dev-visible missing-asset behavior should be explicit and testable, but it does not need to hard-crash production rendering.
- Existing Fate Knots UI and installed-copy regression suites are the primary acceptance gate.

## Prerequisites
- Source files under `rooms/game-room/main-functions/fate-knots/ui/**`
- Supporting styles under `rooms/game-room/main-functions/fate-knots/styles/**`
- Generated asset metadata under `rooms/game-room/main-functions/fate-knots/data/**`
- Existing UI and asset tests under:
  - `scripts/tests/game-room-fate-knots-ui-path-regressions.test.ts`
  - `scripts/tests/game-room-fate-knots-asset-registry-regressions.test.ts`
  - `scripts/tests/game-room-fate-knots-asset-sync-regressions.test.ts`
  - `scripts/tests/game-room-installed-ui-smoke-regressions.test.ts`
  - `scripts/tests/game-room-fate-knots-room-regressions.test.ts`

## Pre-Implementation Cleanup Report

### Duplicated Asset Plumbing
- `ui/surface-assets-runtime.ts` hardcodes the UI asset exposure table even though generated asset metadata already exists under `data/runtime-assets*.module.ts`.
- Semantic aliases such as `mainSceneFrame`, `sidePanelFrame`, `notificationBanner`, and marker assets are currently tied to manual path literals instead of a manifest-backed resolver.
- Generated UI asset ids that are not exposed through the manual table should be audited explicitly before refactor so they are either reachable by alias or deliberately deferred.

### Ambiguous Landmark Areas
- Landmark coverage is strongest at shell and major frame level, but weak or absent for some interior regions that future review tooling will inspect directly.
- The minimum per-phase landmarks requested by this cleanup are not yet explicit everywhere: main scene, support rail, action zone, log, narration, summary/status, and selection zone.
- `.fk-overview__main { display: contents; }` weakens DOM ownership and should not be relied on for reviewable landmarks.

### Phase Identity Issues
- The root renderer currently treats non-mapped phases as overview, which hides invalid states and makes DOM inspection less trustworthy.
- Idle/lobby/overview distinctions should remain explicit in DOM markers and should not be inferred from fallback rendering.
- Unknown phases should be surfaced in a predictable dev-visible way so critic tooling does not misread them as a valid lobby screen.

### Marker Semantic Issues
- `data-selected` is not consistently defined across phases and must be normalized to one meaning only.
- Combat currently uses selection-like markers for turn ownership, which should be split into a dedicated active-turn marker.
- Any new marker added in this pass should be critic-friendly, phase-agnostic where possible, and assertable in tests.

## Sprint 1: Asset Source Of Truth
**Goal**: Replace duplicated UI asset exposure with a manifest-backed resolver while keeping current semantic aliases stable for the renderer.
**Demo/Validation**:
- UI assets resolve from one source of truth
- existing semantic alias names still work
- missing assets surface predictably in dev-oriented tests

### Task 1.1: Freeze The UI Asset Alias Contract
- **Location**: `rooms/game-room/main-functions/fate-knots/ui/surface-assets-runtime.ts`
- **Description**: Inventory every semantic alias currently consumed by the Fate Knots renderer, map each alias to a generated manifest id, and mark any generated-but-unaliased ids as either intentionally deferred or newly supported.
- **Complexity**: 3
- **Dependencies**: None
- **Acceptance Criteria**:
  - every alias used by `getUiAsset(...)` is mapped to one generated asset id
  - the cleanup explicitly records any generated ids left out of the alias layer
  - no renderer call site needs to know raw file paths after this contract is frozen
- **Validation**:
  - manual alias inventory review against `data/runtime-assets-ui.module.ts`
  - targeted grep to confirm renderer call sites only use semantic keys

### Task 1.2: Introduce A Manifest-Backed UI Asset Resolver
- **Location**: `rooms/game-room/main-functions/fate-knots/ui/surface-assets-runtime.ts`
- **Description**: Replace the manual file-path exposure table with a resolver that builds semantic aliases from manifest-backed asset records. If the current IIFE runtime cannot consume the generated module directly, add the smallest compatible bridge instead of keeping duplicated path literals.
- **Complexity**: 7
- **Dependencies**: Task 1.1
- **Acceptance Criteria**:
  - one source of truth exists for UI asset records
  - semantic aliases remain available to existing renderer code
  - manual path duplication is removed from the UI asset runtime
  - the resolver is compatible with the current browser-side runtime format
- **Validation**:
  - `node --test scripts/tests/game-room-fate-knots-asset-registry-regressions.test.ts`
  - `node --test scripts/tests/game-room-fate-knots-asset-sync-regressions.test.ts`

### Task 1.3: Add Predictable Missing-Asset Surfacing
- **Location**: `rooms/game-room/main-functions/fate-knots/ui/surface-assets-runtime.ts`, `rooms/game-room/main-functions/fate-knots/ui/surface-primitives-runtime.ts`, `scripts/tests/game-room-fate-knots-ui-path-regressions.test.ts`
- **Description**: Add a deterministic missing-asset path for dev/test use so unresolved aliases do not silently degrade into invisible surfaces. Prefer a stable marker or placeholder contract that tests can assert without depending on console noise alone.
- **Complexity**: 5
- **Dependencies**: Task 1.2
- **Acceptance Criteria**:
  - missing UI assets fail visibly and predictably in dev-oriented execution
  - production rendering keeps a safe fallback instead of crashing the room
  - tests can detect the missing-asset state explicitly
- **Validation**:
  - targeted UI-path regression covering one forced missing-asset case
  - installed UI smoke remains green after resolver changes

## Sprint 2: Landmark Contract And Phase Truthfulness
**Goal**: Make DOM structure explicitly inspectable per phase and ensure phase markers reflect real state instead of fallback guesses.
**Demo/Validation**:
- every phase exposes the required landmark roles
- landmark ownership is visible in DOM inspection
- idle, overview, and unknown states are distinguishable

### Task 2.1: Add Strict Landmark Wrappers Per Phase
- **Location**: `rooms/game-room/main-functions/fate-knots/ui/journey-overview-runtime.ts`, `rooms/game-room/main-functions/fate-knots/ui/journey-creation-runtime.ts`, `rooms/game-room/main-functions/fate-knots/ui/stage-narrative-runtime.ts`, `rooms/game-room/main-functions/fate-knots/ui/stage-combat-runtime.ts`, `rooms/game-room/main-functions/fate-knots/ui/stage-runtime.ts`
- **Description**: Ensure every phase exposes explicit `data-fk-role` markers for the minimum contract: main scene, support rail, action zone, log, narration, summary/status, and selection zone where applicable. Add thin wrappers when a role does not yet have a stable owner.
- **Complexity**: 7
- **Dependencies**: Sprint 1
- **Acceptance Criteria**:
  - overview, creation, scenario, combat, and result all expose a consistent landmark vocabulary
  - landmarks are explicit in DOM rather than implied by CSS class structure
  - no required landmark is omitted in a valid phase
- **Validation**:
  - `node --test scripts/tests/game-room-fate-knots-ui-path-regressions.test.ts`
  - targeted DOM assertions for each phase

### Task 2.2: Remove Structural Ownership Ambiguity From Layout
- **Location**: `rooms/game-room/main-functions/fate-knots/styles/layout.css`, `rooms/game-room/main-functions/fate-knots/styles/presentation.css`
- **Description**: Remove or reduce layout rules that erase ownership of landmark containers, especially `display: contents` patterns that make DOM inspection weaker than the rendered layout suggests.
- **Complexity**: 4
- **Dependencies**: Task 2.1
- **Acceptance Criteria**:
  - critical phase wrappers remain real DOM owners
  - landmark inspection does not depend on flattened layout semantics
  - no broad visual redesign is introduced while fixing ownership
- **Validation**:
  - DOM inspection in UI-path tests
  - manual review of rendered hierarchy in test runtime

### Task 2.3: Preserve True Phase Identity At The Root
- **Location**: `rooms/game-room/main-functions/fate-knots/ui/module.ts`, `rooms/game-room/main-functions/fate-knots/ui/state-support-runtime.ts`, `scripts/tests/game-room-fate-knots-ui-path-regressions.test.ts`
- **Description**: Replace the implicit overview fallback with explicit handling for valid phases such as `idle` and explicit unknown-phase surfacing for invalid states. DOM markers should tell the truth even if rendering falls back to a safe screen.
- **Complexity**: 6
- **Dependencies**: Task 2.1
- **Acceptance Criteria**:
  - `data-fk-phase` reflects the real phase instead of a guessed fallback
  - idle/lobby/overview semantics are explicit
  - unknown phases surface clearly in dev/test instead of masquerading as overview
- **Validation**:
  - UI-path regression coverage for idle, creation, scenario, combat, result, and one unknown phase case

## Sprint 3: Marker Semantics And Critic-Friendly State
**Goal**: Normalize state attributes so visual tooling can infer selection, turn ownership, and other UI states without ambiguity.
**Demo/Validation**:
- `data-selected` means one thing everywhere
- turn ownership uses a separate explicit marker
- updated DOM semantics are asserted in tests

### Task 3.1: Freeze Marker Semantics Matrix
- **Location**: `rooms/game-room/main-functions/fate-knots/ui/surface-primitives-runtime.ts`, `rooms/game-room/main-functions/fate-knots/ui/journey-creation-runtime.ts`, `rooms/game-room/main-functions/fate-knots/ui/stage-narrative-runtime.ts`, `rooms/game-room/main-functions/fate-knots/ui/stage-combat-runtime.ts`
- **Description**: Define one meaning for `data-selected` and identify every other state that needs its own explicit marker such as turn owner, active seat, or waiting state.
- **Complexity**: 3
- **Dependencies**: Sprint 2
- **Acceptance Criteria**:
  - `data-selected` is reserved for real selection state only
  - non-selection states have dedicated attribute names
  - the matrix is simple enough to mirror directly in tests
- **Validation**:
  - manual attribute inventory before edits
  - grep-based confirmation after edits

### Task 3.2: Apply Normalized Markers Across Phase Renderers
- **Location**: `rooms/game-room/main-functions/fate-knots/ui/journey-creation-runtime.ts`, `rooms/game-room/main-functions/fate-knots/ui/stage-narrative-runtime.ts`, `rooms/game-room/main-functions/fate-knots/ui/stage-combat-runtime.ts`, `rooms/game-room/main-functions/fate-knots/ui/chrome-runtime.ts`
- **Description**: Update phase-specific renderers so creation and scenario use `data-selected` only for actual choice state, while combat and seat-display surfaces use separate explicit markers for active turn or highlighted ownership.
- **Complexity**: 6
- **Dependencies**: Task 3.1
- **Acceptance Criteria**:
  - combat no longer uses `data-selected` as a proxy for user turn
  - choice and catalog cards expose consistent selection semantics
  - any new state marker is critic-friendly and phase-appropriate
- **Validation**:
  - `node --test scripts/tests/game-room-fate-knots-ui-path-regressions.test.ts`
  - targeted assertions on combat and scenario DOM attributes

### Task 3.3: Refresh Regression Coverage And Installed Parity
- **Location**: `scripts/tests/game-room-fate-knots-ui-path-regressions.test.ts`, `scripts/tests/game-room-installed-ui-smoke-regressions.test.ts`, `scripts/tests/game-room-fate-knots-room-regressions.test.ts`
- **Description**: Update regressions to assert the new landmark contract, truthful phase identity, normalized markers, and missing-asset visibility. Refresh installed-copy assertions only where the asset resolver affects packaged behavior.
- **Complexity**: 6
- **Dependencies**: Tasks 3.1-3.2
- **Acceptance Criteria**:
  - the primary UI-path suite asserts the new semantics instead of old ambiguities
  - installed-copy parity still confirms packaged Fate Knots UI structure
  - no command-dispatch regression is introduced by semantic cleanup
- **Validation**:
  - `node --test scripts/tests/game-room-fate-knots-ui-path-regressions.test.ts`
  - `node --test scripts/tests/game-room-installed-ui-smoke-regressions.test.ts`
  - `node --test scripts/tests/game-room-fate-knots-room-regressions.test.ts`

### Task 3.4: Emit The Post-Cleanup Report
- **Location**: Final implementation summary plus optional update to `.rovo/fate-knots-pre-skill-cleanup-plan.md`
- **Description**: After implementation, report what changed, what was intentionally deferred, and whether Fate Knots is now ready for the visual-skill layer.
- **Complexity**: 2
- **Dependencies**: Task 3.3
- **Acceptance Criteria**:
  - summary explicitly covers asset source-of-truth, landmarks, phase identity, and marker semantics
  - deferred nice-to-haves are listed separately from required cleanup work
  - readiness verdict for future visual skills is explicit
- **Validation**:
  - manual checklist against the original cleanup goals

## Optional Low-Risk Follow-Ups
- Move result rendering out of `ui/stage-runtime.ts` only if Sprint 2 already touches result enough that extraction is nearly free.
- Expose review/debug coverage data in a dev-facing panel only if the asset resolver work already introduces a clean debug seam.
- Keep both items outside the required acceptance gate so the cleanup does not turn into a redesign pass.

## Testing Strategy
- Run asset-source validation first:
  - `node --test scripts/tests/game-room-fate-knots-asset-registry-regressions.test.ts`
  - `node --test scripts/tests/game-room-fate-knots-asset-sync-regressions.test.ts`
- Run UI semantic validation second:
  - `node --test scripts/tests/game-room-fate-knots-ui-path-regressions.test.ts`
  - `node --test scripts/tests/game-room-fate-knots-room-regressions.test.ts`
- Run packaging/install parity last if the asset resolver or landmark changes affect bundled output:
  - `node --test scripts/tests/game-room-installed-ui-smoke-regressions.test.ts`
- Validate each sprint separately so regressions are isolated to one cleanup concern at a time.

## Potential Risks & Gotchas
- The browser-side UI runtime is IIFE-based, so manifest-backed asset lookup may need a small compatibility bridge rather than a direct ES module import.
- Missing-asset surfacing must be deterministic in tests; console-only warnings are not enough.
- Landmark additions can accidentally create style churn or scroll regressions if wrappers are added carelessly.
- Explicit unknown-phase handling must not misclassify valid `idle` state as an error.
- Marker cleanup can break tests if old assertions implicitly relied on ambiguous semantics.
- This work should stop the moment it starts drifting into broad visual redesign or CSS polish.

## Rollback Plan
- Land the work in small sprint-aligned commits so each cleanup concern can be reverted independently.
- If Sprint 1 causes packaging/runtime issues, revert only the manifest-backed resolver and keep the old semantic alias surface until the compatibility bridge is fixed.
- If Sprint 2 causes layout churn, revert wrapper/layout ownership changes without undoing Sprint 1 asset cleanup.
- If Sprint 3 causes selector instability, revert marker-attribute changes while keeping truthful phase identity and landmark wrappers in place.
