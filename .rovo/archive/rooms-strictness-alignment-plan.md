# Plan: Rooms Strictness Alignment

**Generated**: 2026-03-30
**Estimated Complexity**: High

## Overview

Raise `rooms/` to the same effective TypeScript and ESLint strictness as the rest of Hayalet Ev without breaking room runtime, installed-build parity, or room regression coverage.

Current baseline on this branch:
- `npm run rooms:typecheck` passes.
- `npm run rooms:lint` passes.
- `rooms/` has `296` TypeScript files.
- `tsconfig.rooms.json` is still looser than root for `strict`, `strictNullChecks`, `strictFunctionTypes`, `strictBindCallApply`, `strictPropertyInitialization`, `noImplicitThis`, `noImplicitReturns`, `exactOptionalPropertyTypes`, `noUncheckedIndexedAccess`, and `noPropertyAccessFromIndexSignature`.
- Room lint also keeps a separate relaxed contract in `eslint.config.cjs` via `roomTsContractRules`.
- `rooms/` still contains heavy `any` debt: about `1637` `any` tokens. Rough split: `laboratory` `1157`, `game-room` `475`.

Measured impact before changing config:
- `strictNullChecks` alone surfaces `54` TypeScript errors.
- `noImplicitReturns` adds `0` new errors and can be enabled early.
- `strictNullChecks` plus call/this/property strictness surfaces `75` errors.
- `strictNullChecks` plus `exactOptionalPropertyTypes` and `noUncheckedIndexedAccess` surfaces `164` errors.
- Adding `noPropertyAccessFromIndexSignature` explodes to `2078` errors, mostly `TS4111`, so this must be the final compiler step.

## Prerequisites

- Preserve the room contract: workspace TS source -> generated JS build/install output.
- Keep `npm run rooms:test:core` green after each sprint.
- Treat the current branch state as the migration baseline; this plan assumes in-flight room edits are intentional and should not be reverted.
- Do not re-run `scripts/rooms-ts-bulk-implicit-any.mjs` as a migration shortcut; it is useful as historical context, but it increases explicit `any` debt.

## Sprint 1: Freeze The Strictness Baseline

**Goal**: Turn today\'s relaxed room contract into an explicit migration runway with repeatable measurements.
**Demo/Validation**:
- `npm run rooms:typecheck`
- `npm run rooms:lint`
- New targeted strictness scripts report stable counts on the current branch

### Task 1.1: Save the current compiler and lint gap as a documented baseline
- **Location**: `.rovo/rooms-strictness-alignment-plan.md`, `tsconfig.rooms.json`, `eslint.config.cjs`
- **Description**: Record the exact strictness differences between room config and root config, plus the measured error counts for each planned phase.
- **Dependencies**: None
- **Acceptance Criteria**:
  - The team can see which flags are still relaxed for rooms.
  - The migration order is justified by measured error volume, not guesswork.
- **Validation**:
  - Review the baseline note and confirm the listed counts still match local commands.

### Task 1.2: Add phase-specific quality scripts without changing room behavior yet
- **Location**: `package.json`
- **Description**: Add explicit migration scripts such as `rooms:typecheck:null`, `rooms:typecheck:shape`, `rooms:typecheck:index-signature`, and matching lint probes so each phase has a single canonical command.
- **Dependencies**: Task 1.1
- **Acceptance Criteria**:
  - Every planned strictness phase has one repeatable command.
  - CI/local verification can run a single phase without flipping the final config too early.
- **Validation**:
  - Run each new script once and confirm it reports the expected baseline.

### Task 1.3: Group the hot files into migration batches
- **Location**: `.rovo/rooms-strictness-alignment-plan.md` or a short migration note under `.rovo/`
- **Description**: Split fixes into concrete batches so work can move in parallel: `game-room nullability`, `game-room command/state shape`, `laboratory shared host`, `laboratory feature state`, and `lint any cleanup`.
- **Dependencies**: Task 1.2
- **Acceptance Criteria**:
  - Each batch has a small hotspot list and an owner-friendly scope.
- **Validation**:
  - Confirm every top-error file from the baseline belongs to one batch.

## Sprint 2: Enable Compiler Quick Wins

**Goal**: Turn on the strict flags that already have little or zero cost before touching the heavy nullability work.
**Demo/Validation**:
- `npm run rooms:typecheck`
- `npm run rooms:test:core`
- New quick-win strictness scripts return zero errors

### Task 2.1: Enable `noImplicitReturns`
- **Location**: `tsconfig.rooms.json`
- **Description**: Promote `noImplicitReturns` immediately since the measured baseline shows zero new errors.
- **Dependencies**: Sprint 1
- **Acceptance Criteria**:
  - `tsconfig.rooms.json` now matches root for `noImplicitReturns`.
  - No room compile regressions appear.
- **Validation**:
  - `npm run rooms:typecheck`
  - `npm run rooms:test:core`

### Task 2.2: Audit low-risk compiler flags that should move with no source edits
- **Location**: `tsconfig.rooms.json`
- **Description**: Re-check whether `alwaysStrict`, `noFallthroughCasesInSwitch`, and `noImplicitOverride` introduce real room errors; promote them if they remain clean.
- **Dependencies**: Task 2.1
- **Acceptance Criteria**:
  - Rooms stop lagging root on zero-cost compiler safety where possible.
- **Validation**:
  - Run the matching probe scripts from Sprint 1.

## Sprint 3: Nullability Alignment First

**Goal**: Make `strictNullChecks` the new room baseline, then absorb the small follow-up `this` and call-signature errors.
**Demo/Validation**:
- `rooms:typecheck:null` returns zero errors
- `npm run rooms:typecheck`
- Targeted game-room and laboratory host regressions stay green

### Task 3.1: Fix the game-room nullability hotspots first
- **Location**: `rooms/game-room/main-functions/fate-knots/host/prompt-runtime.ts`, `rooms/game-room/main-functions/team-tetris/host/engine.ts`, `rooms/game-room/main-functions/xox/host/runtime.ts`, nearby support modules
- **Description**: Resolve the largest `strictNullChecks` failures first, focusing on nullable command payloads, optional handlers, and match/session state.
- **Dependencies**: Sprint 2
- **Acceptance Criteria**:
  - The measured `54` nullability errors are mostly eliminated from `game-room`.
  - Feature runtime behavior stays unchanged.
- **Validation**:
  - `rooms:typecheck:null`
  - Targeted `game-room-*` regression suites

### Task 3.2: Clear the smaller laboratory nullability spillover
- **Location**: `rooms/laboratory/shared/host/io-runtime.ts`, `rooms/laboratory/shared/host/reporting-export.ts`, `rooms/laboratory/shared/host/job-state.ts`, `rooms/laboratory/main-functions/subtitle-analysis/host/youtube-discovery.ts`, `rooms/laboratory/main-functions/media-analysis/ui/edit-stage.ts`
- **Description**: Remove the remaining nullable access points after the game-room blockers are fixed.
- **Dependencies**: Task 3.1
- **Acceptance Criteria**:
  - `strictNullChecks` can be enabled in `tsconfig.rooms.json`.
- **Validation**:
  - `rooms:typecheck:null`
  - Targeted laboratory regressions

### Task 3.3: Promote the dependent `this` and call-site strictness flags
- **Location**: `tsconfig.rooms.json`, `rooms/game-room/host/runtime.ts`, `rooms/laboratory/host/foundation-runtimes.ts`, `rooms/laboratory/host/feature-runtimes.ts`, `rooms/laboratory/main-functions/subtitle-analysis/ui/runtime.ts`
- **Description**: After nullability is green, enable `noImplicitThis`, `strictFunctionTypes`, `strictBindCallApply`, and `strictPropertyInitialization`, then clear the remaining small set of follow-up type mismatches.
- **Dependencies**: Task 3.2
- **Acceptance Criteria**:
  - The post-null group drops from `75` errors to zero.
- **Validation**:
  - `npm run rooms:typecheck`
  - Targeted room host/runtime regressions

## Sprint 4: Shape Safety Without Index-Signature Enforcement

**Goal**: Land the medium-cost data-shape protections before the very expensive index-signature rule.
**Demo/Validation**:
- `rooms:typecheck:shape` returns zero errors
- Installed room build/runtime tests still pass

### Task 4.1: Type command and snapshot dictionary seams
- **Location**: `rooms/game-room/shared/host/command-registry.ts`, `rooms/laboratory/shared/host/room-snapshot.ts`, `rooms/laboratory/shared/host/process-report-state.ts`, `rooms/laboratory/shared/host/process-runtime.ts`
- **Description**: Replace loose record access with typed map helpers, discriminated records, or local guards so dictionary-style state becomes explicit.
- **Dependencies**: Sprint 3
- **Acceptance Criteria**:
  - Dynamic record access no longer relies on implicit undefined assumptions.
  - The biggest `noUncheckedIndexedAccess` and `exactOptionalPropertyTypes` hotspots are reduced first.
- **Validation**:
  - `rooms:typecheck:shape`
  - Room protocol/registry regression suites

### Task 4.2: Fix feature-state shape drift in game-room and laboratory
- **Location**: `rooms/game-room/main-functions/team-tetris/host/engine-board.ts`, `rooms/game-room/main-functions/team-tetris/host/engine-match.ts`, `rooms/game-room/main-functions/team-tetris/ui/draft-runtime.ts`, `rooms/laboratory/main-functions/subtitle-analysis/host/youtube-discovery.ts`, `rooms/laboratory/main-functions/audio-analysis/host/state.ts`
- **Description**: Tighten optional payloads, index-based lookups, and event snapshots so feature code compiles cleanly under shape-safe flags.
- **Dependencies**: Task 4.1
- **Acceptance Criteria**:
  - The measured `164` shape errors fall to zero without enabling `noPropertyAccessFromIndexSignature` yet.
- **Validation**:
  - `rooms:typecheck:shape`
  - Feature-specific regression suites

### Task 4.3: Promote `exactOptionalPropertyTypes` and `noUncheckedIndexedAccess`
- **Location**: `tsconfig.rooms.json`
- **Description**: Flip these two options once the affected state containers and command dictionaries are already typed.
- **Dependencies**: Task 4.2
- **Acceptance Criteria**:
  - Rooms match root on optional-value and indexed-access safety.
- **Validation**:
  - `npm run rooms:typecheck`
  - `npm run rooms:test:core`

## Sprint 5: Finish Compiler Parity With Index-Signature Safety

**Goal**: Enable the last compiler gap, `noPropertyAccessFromIndexSignature`, in a dedicated final compiler sprint.
**Demo/Validation**:
- `rooms:typecheck:index-signature` returns zero errors
- `npm run typecheck`

### Task 5.1: Normalize index-signature access helpers before flipping the flag
- **Location**: `rooms/laboratory/shared/host/room-snapshot.ts`, `rooms/laboratory/main-functions/audio-analysis/host/state.ts`, `rooms/laboratory/main-functions/subtitle-analysis/host/state-normalization.ts`, `rooms/game-room/main-functions/fate-knots/host/combat-state.ts`, `rooms/game-room/main-functions/fate-knots/host/content-loader-combat.ts`
- **Description**: Introduce bracket-access helpers, typed record readers, and narrowed local variables in the files currently driving `TS4111`.
- **Dependencies**: Sprint 4
- **Acceptance Criteria**:
  - The `TS4111` wave is reduced in the highest-churn state files before the flag is enabled repo-wide for rooms.
- **Validation**:
  - `rooms:typecheck:index-signature`
  - Targeted feature regression suites

### Task 5.2: Enable `noPropertyAccessFromIndexSignature`
- **Location**: `tsconfig.rooms.json`
- **Description**: Flip the final room compiler gap once the `TS4111` surface is under control.
- **Dependencies**: Task 5.1
- **Acceptance Criteria**:
  - Room compiler strictness now matches the root TypeScript contract.
- **Validation**:
  - `npm run rooms:typecheck`
  - `npm run typecheck`

## Sprint 6: Converge ESLint To The Main App Contract

**Goal**: Remove the relaxed `roomTsContractRules` exceptions in a safe order after compiler parity is in place.
**Demo/Validation**:
- `npm run rooms:lint`
- `npm run lint`
- Room tests remain green after each lint phase

### Task 6.1: Reduce `any` debt before re-enabling `no-explicit-any`
- **Location**: `rooms/laboratory/main-functions/media-analysis/**/*`, `rooms/laboratory/shared/host/**/*`, `rooms/game-room/main-functions/**/*`, `rooms/game-room/shared/**/*`
- **Description**: Replace high-volume `any` seams with named input/output contracts, helper types, and parser return types. Start where the debt is densest: `laboratory/main-functions`, `laboratory/shared`, then `game-room/main-functions`.
- **Dependencies**: Sprint 5
- **Acceptance Criteria**:
  - The largest `any` hotspots are typed with domain contracts instead of blanket escape hatches.
  - The repo is ready for `@typescript-eslint/no-explicit-any`.
- **Validation**:
  - A temporary `rooms:lint:any` probe shows a steady downward count.

### Task 6.2: Re-enable lint in dependency order
- **Location**: `eslint.config.cjs`
- **Description**: Re-enable room lint rules in this order: `no-explicit-any` -> `no-unsafe-*` -> `prefer-nullish-coalescing` and `prefer-optional-chain` -> `strict-boolean-expressions` -> `no-unnecessary-condition` and `no-unnecessary-type-assertion` -> `no-base-to-string`, `no-confusing-void-expression`, `restrict-template-expressions`.
- **Dependencies**: Task 6.1
- **Acceptance Criteria**:
  - Room lint exceptions shrink phase by phase instead of flipping all rules at once.
  - Each lint phase stays committable and reviewable.
- **Validation**:
  - Run the matching phase lint probe after every rule promotion.

### Task 6.3: Re-enable style-level parity rules last
- **Location**: `eslint.config.cjs`
- **Description**: Turn on `explicit-function-return-type`, `naming-convention`, `require-await`, `promise-function-async`, `return-await`, and `no-redundant-type-constituents` only after structural type safety is stable.
- **Dependencies**: Task 6.2
- **Acceptance Criteria**:
  - The final room lint contract matches the main app contract or the remaining deltas are explicitly justified in comments.
- **Validation**:
  - `npm run rooms:lint`
  - `npm run lint`

## Testing Strategy

- After every compiler flag change:
  - `npm run rooms:typecheck`
  - `npm run rooms:test:core`
- After every lint phase:
  - `npm run rooms:lint`
  - targeted room regression suites for the touched files
- At the end of each sprint:
  - `npm run typecheck`
  - `npm run lint`
- Before declaring completion:
  - `npm run rooms:check`
  - short manual smoke for both installed rooms if host/UI runtime seams changed

## Potential Risks & Gotchas

- The current branch already contains broad room edits, so strictness work should be rebased onto the active branch state instead of assuming a clean-room migration from `main`.
- `noPropertyAccessFromIndexSignature` is the highest-cost compiler flag by far. Treat it as its own sprint, not as part of the earlier shape-safety flip.
- `no-explicit-any` should not be enabled before the main domain contracts exist, or the team will get churn without real safety.
- `game-room` dominates the first nullability wave, but `laboratory` dominates the long-tail `any` cleanup. The migration order should reflect that split.
- Room runtime and installed-copy regressions are more important than temporary probe counts; never flip a flag without the room tests.

## Rollback Plan

- Revert strictness in the smallest unit possible: one compiler flag change or one lint-rule batch at a time.
- Keep temporary probe scripts even if a phase is reverted; they remain useful for measuring the next attempt.
- If a sprint destabilizes room runtime, revert the config flip first and keep any harmless typing improvements that already pass tests.
- If a lint rule creates too much churn, turn it back off and keep the supporting type changes for a later pass.
