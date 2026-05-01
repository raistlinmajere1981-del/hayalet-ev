# Plan: Laboratory i18n Compliance

**Generated**: 2026-05-01
**Estimated Complexity**: Medium

## Overview
Bring the Laboratory room to full room-local i18n compliance. The current EN/TR catalogs are structurally aligned, but the UI still references missing translation keys and several runtime/user-facing messages rely on fallback literals or host data. The fix should preserve `rooms/laboratory` as source of truth, avoid manual edits to installed copies, and add a guard so new Laboratory copy cannot drift silently.

Research baseline:
- `rooms/laboratory/i18n/en.json` and `rooms/laboratory/i18n/tr.json` both contain 1,778 leaf strings with no missing keys across locales.
- 69 Laboratory key references are missing from both catalogs; 63 are static `copy.t(...)` calls.
- Missing keys cluster in `lab-drawer.ts`, `lab-process-strip.ts`, `lab-runtime-i18n.ts`, `lab-top-bar.ts`, `lab-waveform-timeline-render.ts`, and `workspace-surface.ts`.
- Several manifest labels/descriptions and runtime event messages are still literal or host-sourced.
- Targeted baseline test command currently fails in existing game-room i18n tests, not in Laboratory source UI tests.

## Assumptions
- Scope is the Laboratory workspace source under `rooms/laboratory`.
- Installed copies under `data/rooms/laboratory` are refreshed by room build/install flow, not hand-edited.
- Turkish strings may remain ASCII-only if that matches the current catalog style.
- Product names, codecs, file formats, and protocol terms may intentionally stay identical between EN/TR.
- Existing uncommitted user changes are preserved.

## Prerequisites
- Fresh mode check before code edits: `npm run mode:status` and `npm run whereami`.
- Change approval before editing source files.
- Relevant commands available: `npm run rooms:test:file`, `npm run rooms:typecheck`, `npm run rooms:build`.

## Sprint 1: Catalog Gap Closure
**Goal**: Add missing Laboratory translation leaves without changing runtime behavior.
**Demo/Validation**:
- Run a key-reference audit and confirm zero missing static Laboratory i18n keys.
- Spot-check setup, running, result, explore, process strip, center skeleton, and inspector labels in EN/TR.

### Task 1.1: Add Drawer Running Copy
- **Location**: `rooms/laboratory/i18n/en.json`, `rooms/laboratory/i18n/tr.json`
- **Description**: Add `mediaAnalysis.drawer.running.planStatus.*`, `planResolving`, `cancel*`, and `cancel*Sub` keys.
- **Complexity**: 2
- **Dependencies**: None
- **Acceptance Criteria**:
  - Every key used by `rooms/laboratory/ui/lab-drawer.ts` running mode resolves from both catalogs.
  - Existing fallbacks are preserved semantically.
- **Validation**:
  - Key-reference audit.
  - `npm run rooms:test:file -- scripts/tests/laboratory-source-ui-regressions.test.ts`

### Task 1.2: Add Drawer Result and Explore Copy
- **Location**: `rooms/laboratory/i18n/en.json`, `rooms/laboratory/i18n/tr.json`
- **Description**: Add result implementation, advisory, freshness, report CTA, and explore mode labels under `mediaAnalysis.drawer.result` and `mediaAnalysis.drawer.explore`.
- **Complexity**: 3
- **Dependencies**: Task 1.1
- **Acceptance Criteria**:
  - Candidate, commitment, staging, coherence, readiness, bridge, report, and explore labels resolve in both locales.
  - Runtime-generated advisory summaries remain localized through existing formatter locale inputs.
- **Validation**:
  - Key-reference audit.
  - Existing Laboratory source UI regression.

### Task 1.3: Add Process Strip, Top Bar, Timeline, Center, Inspector Copy
- **Location**: `rooms/laboratory/i18n/en.json`, `rooms/laboratory/i18n/tr.json`
- **Description**: Add `mediaAnalysis.strip.moduleStatus.*`, `mediaAnalysis.strip.analysisSummary`, `mediaAnalysis.drawer.expand/collapse`, `mediaAnalysis.timeline.suggested*`, `mediaAnalysis.center.*`, and `mediaAnalysis.workspaceInspector.*`.
- **Complexity**: 2
- **Dependencies**: Task 1.2
- **Acceptance Criteria**:
  - All current static `copy.t(...)` calls resolve from the catalogs.
  - Skeleton and inspector strings are localized before real content loads.
- **Validation**:
  - Key-reference audit.
  - Targeted UI render tests.

### Task 1.4: Add Runtime User Action Copy
- **Location**: `rooms/laboratory/i18n/en.json`, `rooms/laboratory/i18n/tr.json`
- **Description**: Add missing `mediaAnalysis.runtime.userActions.exportEnhancedFrame.*` strings used by `lab-runtime-i18n.ts`.
- **Complexity**: 1
- **Dependencies**: Task 1.3
- **Acceptance Criteria**:
  - Enhanced frame action states resolve through room-local catalog.
- **Validation**:
  - Key-reference audit.
  - Runtime text translation unit coverage if available.

## Sprint 2: Runtime and Manifest i18n Hardening
**Goal**: Remove remaining visible fallback/literal paths that can leak the wrong language.
**Demo/Validation**:
- Switch locale context in a smoke render and verify UI/runtime visible copy follows the active locale.
- Confirm manifest metadata can be translated without editing installed copies.

### Task 2.1: Localize Manifest-Facing Metadata
- **Location**: `rooms/laboratory/manifest.json`, `rooms/laboratory/i18n/en.json`, `rooms/laboratory/i18n/tr.json`, room manifest tests if needed
- **Description**: Align manifest labels/descriptions/hotspots/features with the room i18n strategy used elsewhere in the app, or add a documented test-backed bridge if manifest schema requires literals.
- **Complexity**: 4
- **Dependencies**: Sprint 1
- **Acceptance Criteria**:
  - Menu, workbench, scene hotspot, and feature names/descriptions have a localization path.
  - Manifest schema validation still passes.
- **Validation**:
  - `npm run rooms:test:file -- scripts/tests/room-manifest-regressions.test.ts scripts/tests/rooms-scene-page-regressions.test.ts`

### Task 2.2: Localize Runtime Event and Lock Messages
- **Location**: `rooms/laboratory/runtime/lab-run-controller.ts`, `rooms/laboratory/ui/lab-runtime-i18n.ts`, `rooms/laboratory/i18n/en.json`, `rooms/laboratory/i18n/tr.json`
- **Description**: Route user-facing `buildUiEvent(...)`, `pushLockedWorkspaceEvent(...)`, confirm text, and primary action labels through the existing room i18n adapter.
- **Complexity**: 5
- **Dependencies**: Sprint 1
- **Acceptance Criteria**:
  - Locked workspace, preview unavailable, delete confirmation, project save, and primary action labels are locale-aware.
  - Host or dynamic project data remains untouched and escaped.
- **Validation**:
  - Add or update Laboratory runtime tests for emitted event messages.
  - `npm run rooms:test:file -- scripts/tests/laboratory-source-ui-regressions.test.ts scripts/tests/laboratory-host-action-runtime-regressions.test.ts`

### Task 2.3: Review Host Projection Literals
- **Location**: `rooms/laboratory/main-functions/**`, `rooms/laboratory/shared/host/**`, `rooms/laboratory/shared/data/tools/*.json`
- **Description**: Separate product/tool names from user-facing sentences, then migrate blockers, warnings, readiness impact, manual hints, and provider/module copy to key-backed catalog entries where they surface in UI.
- **Complexity**: 5
- **Dependencies**: Task 2.2
- **Acceptance Criteria**:
  - User-visible host projection messages have keys or documented non-localized rationale.
  - Tool IDs, executable names, URLs, codecs, and model identifiers are not over-translated.
- **Validation**:
  - Tool manager render smoke in EN/TR.
  - `npm run rooms:test:file -- scripts/tests/laboratory-source-ui-regressions.test.ts scripts/tests/laboratory-audio-runtime-regressions.test.ts`

## Sprint 3: Regression Guard
**Goal**: Prevent Laboratory i18n drift from returning.
**Demo/Validation**:
- A dedicated Laboratory i18n test fails on missing catalog keys or user-facing literals.
- The test passes after the remediation.

### Task 3.1: Add Laboratory Catalog Parity Test
- **Location**: `scripts/tests/laboratory-i18n-regressions.test.ts`
- **Description**: Add a focused EN/TR leaf parity test for `rooms/laboratory/i18n/*.json`.
- **Complexity**: 2
- **Dependencies**: Sprint 1
- **Acceptance Criteria**:
  - Missing keys, extra keys, and empty unexpected values are reported with exact paths.
- **Validation**:
  - `npm run rooms:test:file -- scripts/tests/laboratory-i18n-regressions.test.ts`

### Task 3.2: Add Static Key Reference Audit
- **Location**: `scripts/tests/laboratory-i18n-regressions.test.ts`
- **Description**: Scan `rooms/laboratory/ui` and `rooms/laboratory/runtime` for static `copy.t(...)` keys and assert every key exists in EN/TR catalogs.
- **Complexity**: 3
- **Dependencies**: Task 3.1
- **Acceptance Criteria**:
  - The current 69 missing references become zero.
  - Dynamic key families are covered by base-family checks or explicit enumerations.
- **Validation**:
  - New test file passes.

### Task 3.3: Add Literal Leak Guard
- **Location**: `scripts/tests/laboratory-i18n-regressions.test.ts`
- **Description**: Add allowlist-aware checks for common user-facing literal patterns in Laboratory UI/runtime files.
- **Complexity**: 4
- **Dependencies**: Task 3.2
- **Acceptance Criteria**:
  - Literal UI copy in render output, event builders, locked-workspace messages, and action labels is caught.
  - Technical constants and product names are allowlisted narrowly.
- **Validation**:
  - New test file passes.
  - Existing Laboratory render tests pass.

## Sprint 4: Verification and Build Sync
**Goal**: Prove the source fix is runnable and can propagate through the room build flow.
**Demo/Validation**:
- Build workspace rooms and run targeted Laboratory tests.
- Confirm no installed-copy manual edits are required.

### Task 4.1: Run Targeted Laboratory Suite
- **Location**: `scripts/tests/laboratory-*.test.ts`, new i18n regression file
- **Description**: Run the new Laboratory i18n suite plus source UI, selection runtime, workspace runtime, host action, and installed parity tests.
- **Complexity**: 3
- **Dependencies**: Sprint 3
- **Acceptance Criteria**:
  - Laboratory-focused tests pass or failures are documented as unrelated pre-existing issues.
- **Validation**:
  - `npm run rooms:test:file -- scripts/tests/laboratory-i18n-regressions.test.ts scripts/tests/laboratory-source-ui-regressions.test.ts scripts/tests/laboratory-selection-runtime-regressions.test.ts scripts/tests/laboratory-workspace-runtime-regressions.test.ts scripts/tests/laboratory-host-action-runtime-regressions.test.ts`

### Task 4.2: Run Typecheck and Room Build
- **Location**: project root
- **Description**: Run room typecheck and build to verify catalog JSON, room source, and generated room artifacts remain valid.
- **Complexity**: 2
- **Dependencies**: Task 4.1
- **Acceptance Criteria**:
  - `npm run rooms:typecheck` passes.
  - `npm run rooms:build` completes or reports only known unrelated generated metadata drift.
- **Validation**:
  - Command outputs recorded in final implementation report.

## Testing Strategy
- Start with a key audit to make missing catalog references visible.
- Add targeted tests before or alongside catalog remediation so future UI additions are protected.
- Prefer Laboratory-focused suites first, then broader room manifest/scene tests if manifest metadata changes.
- Treat the current `scripts/tests/i18n-remediation-regressions.test.ts` game-room failures as baseline unrelated to Laboratory unless future edits touch shared room i18n infrastructure.

## Potential Risks & Gotchas
- Current worktree has existing modifications in Laboratory UI/runtime and i18n files; edits must be minimal and preserve those changes.
- EN/TR catalogs are large, so JSON insertion order should match nearby sections to reduce review noise.
- Some identical EN/TR values are correct technical labels, but some are likely untranslated Turkish catalog debt.
- Runtime strings built from dynamic project, asset, tool, and host data should not be forced through static translation.
- Manifest i18n may require schema-aware changes; do not invent new manifest fields without validating readers and tests.
- Existing game-room i18n tests fail before this work; do not use those failures as a Laboratory regression signal.

## Rollback Plan
- Revert only the Laboratory i18n catalog additions, Laboratory runtime/UI changes, and new Laboratory i18n test file from this task.
- Leave unrelated pre-existing worktree changes untouched.
- If manifest schema changes prove risky, keep Sprint 1 catalog remediation and defer manifest localization behind a smaller schema-backed plan.
