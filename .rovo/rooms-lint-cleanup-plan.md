# Plan: Rooms Lint Cleanup

**Generated**: 2026-03-30
**Estimated Complexity**: High

## Overview

The `rooms/` lint surface is large but highly repetitive: `22,862` warnings across `220` files, with almost all messages concentrated in `@typescript-eslint/no-unsafe-member-access`, `@typescript-eslint/no-unsafe-assignment`, `@typescript-eslint/no-unsafe-call`, `@typescript-eslint/no-explicit-any`, and a smaller tail of `no-unsafe-return` and `no-unsafe-argument`.

The fastest safe approach is not file-by-file cleanup. We should first eliminate high-multiplier `deps: any` and global registry entry points, then sweep feature clusters that can be owned independently.

Current warning concentration:

- `rooms/laboratory/**`: `16,307`
- `rooms/game-room/**`: `6,555`
- `rooms/**/main-functions/**`: `13,451`
- `rooms/laboratory/shared/ui/**`: `3,279`
- `rooms/laboratory/shared/host/**`: `2,545`
- `rooms/game-room/main-functions/fate-knots/**`: `4,302`

## Prerequisites

- Baseline command: `npm run rooms:lint -- --format json --output-file /tmp/rooms-eslint.json`
- Fast verification commands:
  - `npx eslint "rooms/laboratory/**/*.{js,ts}"`
  - `npx eslint "rooms/game-room/**/*.{js,ts}"`
  - `npx eslint "rooms/game-room/main-functions/fate-knots/**/*.{js,ts}"`
  - `npx eslint "rooms/laboratory/shared/**/*.{js,ts}" "rooms/laboratory/main-functions/media-analysis/**/*.{js,ts}"`
- Worktree hygiene: only one worker edits a room subtree at a time unless the write sets are explicitly disjoint.
- Keep changes atomic: one cluster, one validation pass, one commit.

## Execution Model

Preferred model:

- One main coordinator session keeps the plan, reruns lint, and integrates results.
- One parallel worker owns `rooms/game-room/**`.
- One parallel worker owns `rooms/laboratory/**`.
- After the room-level foundation tasks are complete, the laboratory worker may split again by feature cluster if needed.

Why this model:

- The room directories are naturally separated, so merge risk stays low.
- A single plan file keeps progress and lint counts in one place.
- Subagents are lower-friction than two manually coordinated sessions because they inherit context and reduce copy-paste drift.

Optional fallback:

- If manual parallel work is preferred, open a second session and assign it only one room track.
- The second session should not edit shared plan structure, `package.json`, or eslint config unless the coordinator explicitly assigns it.

Suggested second-session prompt:

`Read /home/raistlin/hayalet-ev/rooms-lint-cleanup-plan.md and implement only the Laboratory track tasks assigned by the coordinator. Do not edit game-room files. After each task, rerun targeted rooms lint for your owned files and report remaining warning counts by rule.`

## Sprint 0: Baseline And Ownership
**Goal**: Lock a reproducible baseline and prepare the work for parallel execution without overlap.
**Demo/Validation**:

- `npm run rooms:lint -- --format json --output-file /tmp/rooms-eslint.json`
- Warning totals and top clusters are recorded before edits begin.
- Owners for `game-room` and `laboratory` are explicitly assigned.

### Task S0-T1: Capture The Rooms Baseline
- **Location**: `/tmp/rooms-eslint.json`, `/home/raistlin/hayalet-ev/rooms-lint-cleanup-plan.md`
- **Description**: Run the rooms-only lint snapshot, record total warnings, top rules, top files, and top directory clusters. This is the baseline used to prove progress after each wave.
- **depends_on**: []
- **Acceptance Criteria**:
  - Baseline totals are recorded.
  - Top warning rules and high-noise file clusters are identified.
  - Future work can compare against the same snapshot format.
- **Validation**:
  - `npm run rooms:lint -- --format json --output-file /tmp/rooms-eslint.json`

### Task S0-T2: Assign Parallel Ownership And Validation Scope
- **Location**: `/home/raistlin/hayalet-ev/rooms-lint-cleanup-plan.md`
- **Description**: Decide the initial parallel split: coordinator, `game-room` worker, `laboratory` worker. Define which lint commands each worker is allowed to run and which directories each worker may edit.
- **depends_on**: [S0-T1]
- **Acceptance Criteria**:
  - No task has overlapping ownership.
  - Each worker has a clear validation command.
  - Cross-room edits are coordinator-only unless explicitly reassigned.
- **Validation**:
  - Review the ownership map before implementation starts.

## Sprint 1: Foundation Contracts
**Goal**: Remove the broadest `any` entry points so later feature sweeps become mechanical instead of improvisational.
**Demo/Validation**:

- Representative composition files stop exposing `deps: any` at room entry points.
- Warning count drops in both rooms before feature-specific work starts.

### Task S1-T1: Type Laboratory Composition Boundaries
- **Location**: `rooms/laboratory/host/*.ts`, `rooms/laboratory/ui/*.ts`, `rooms/laboratory/shared/host/*.ts`, `rooms/laboratory/shared/ui/*.ts`
- **Description**: Replace large `deps: any` aggregates with named dependency types and typed helper return values in the laboratory composition layer. Prioritize files like `feature-runtimes.ts`, `project-runtimes.ts`, `feature-adapters.ts`, `ui/core-public-api.ts`, and shared runtime/accessor builders.
- **depends_on**: [S0-T2]
- **Acceptance Criteria**:
  - Top-level laboratory composition files no longer introduce bulk `any`-driven member access.
  - Shared host/UI helpers expose typed records or narrow helper contracts.
  - Targeted lint on laboratory foundation files shows a meaningful reduction.
- **Validation**:
  - `npx eslint "rooms/laboratory/host/**/*.{ts,js}" "rooms/laboratory/ui/**/*.{ts,js}" "rooms/laboratory/shared/**/*.{ts,js}"`

### Task S1-T2: Type Game-Room Registry Boundaries
- **Location**: `rooms/game-room/ui/**/*.ts`, `rooms/game-room/main-functions/**/ui/*.ts`
- **Description**: Introduce typed factory registry and shared state helper contracts for the game-room UI runtimes. Prioritize IIFE-style files that read from `global.GameRoomUiFactories` and files that shuttle participant/selection/combat state through untyped helpers.
- **depends_on**: [S0-T2]
- **Acceptance Criteria**:
  - Global registry access flows through typed interfaces instead of raw `global: any`.
  - Common runtime helpers no longer force downstream `no-unsafe-member-access` cascades.
  - `fate-knots`, `team-tetris`, and `xox` can build on the same shared contracts.
- **Validation**:
  - `npx eslint "rooms/game-room/ui/**/*.{ts,js}" "rooms/game-room/main-functions/**/*.{ts,js}"`

## Sprint 2: Game-Room Feature Sweeps
**Goal**: Clear `game-room` warnings by feature cluster once the registry boundary is typed.
**Demo/Validation**:

- `game-room` warning count drops in visibly separate steps.
- Each feature cluster can be linted and reviewed independently.

### Task S2-T1: Clean Fate-Knots State And Chrome Runtimes
- **Location**: `rooms/game-room/main-functions/fate-knots/ui/*.ts`
- **Description**: Type the state defaults, sanitizers, participant bundles, chrome runtime, stage runtime, and support helpers. Focus on replacing `candidate: any`, `deps: any`, and repeated `toRecord`-style unsafe access with explicit shapes and local narrowing helpers.
- **depends_on**: [S1-T2]
- **Acceptance Criteria**:
  - Core state-building and rendering paths in `fate-knots` no longer rely on raw `any`.
  - Representative files such as `state-sanitize-runtime.ts`, `chrome-runtime.ts`, `module.ts`, and stage runtimes show major warning reduction.
  - Shared helper types are reused instead of duplicated.
- **Validation**:
  - `npx eslint "rooms/game-room/main-functions/fate-knots/**/*.{ts,js}"`

### Task S2-T2: Clean Team-Tetris And XOX Runtimes
- **Location**: `rooms/game-room/main-functions/team-tetris/**/*.ts`, `rooms/game-room/main-functions/xox/**/*.ts`
- **Description**: Reuse the typed registry and shared state contracts from Sprint 1 to remove `any` leakage in the remaining game-room features. Keep this as a separate task so `fate-knots` can land first.
- **depends_on**: [S1-T2]
- **Acceptance Criteria**:
  - `team-tetris` and `xox` stop depending on raw registry lookups and ad-hoc `any` payloads.
  - No new shared helper divergence is introduced between features.
  - The remaining `game-room` warnings are either eliminated or isolated to known exceptions.
- **Validation**:
  - `npx eslint "rooms/game-room/main-functions/team-tetris/**/*.{ts,js}" "rooms/game-room/main-functions/xox/**/*.{ts,js}"`

## Sprint 3: Laboratory Feature Sweeps
**Goal**: Clean the laboratory room in waves that respect its heavier shared dependency graph.
**Demo/Validation**:

- Shared laboratory runtime surfaces are already typed before feature modules are touched.
- Each feature cluster can be owned and validated independently after the shared pass.

### Task S3-T1: Clean Media-Analysis Host And Projection Layers
- **Location**: `rooms/laboratory/main-functions/media-analysis/**/*.{ts,js}`, `rooms/laboratory/host/feature-runtimes.ts`, `rooms/laboratory/host/project-runtimes.ts`
- **Description**: Remove `any`-driven flow from media profile projection, feature runtime composition, and related host adapters. Focus on projection records, profile target resolution, and typed runtime return shapes because these fan out into many downstream warnings.
- **depends_on**: [S1-T1]
- **Acceptance Criteria**:
  - Media-analysis host/projection files stop introducing broad unsafe access chains.
  - High-noise files such as `profile-projection.ts` and composition runtimes show major warning reduction.
  - Shared types introduced here are reusable by other laboratory features.
- **Validation**:
  - `npx eslint "rooms/laboratory/main-functions/media-analysis/**/*.{ts,js}" "rooms/laboratory/host/feature-runtimes.ts" "rooms/laboratory/host/project-runtimes.ts"`

### Task S3-T2: Clean Subtitle-Analysis Runtime Surface
- **Location**: `rooms/laboratory/main-functions/subtitle-analysis/**/*.{ts,js}`
- **Description**: Type the subtitle-analysis feature boundary after the shared laboratory contracts are stable. Reuse the same pattern as media-analysis: explicit dependency contracts, typed records, and narrow helper returns.
- **depends_on**: [S1-T1]
- **Acceptance Criteria**:
  - Subtitle-analysis feature modules no longer depend on broad `any` payloads.
  - Job/process/report accessors use typed shapes instead of repeated unsafe casting.
  - Warning counts fall without reintroducing duplicate helper types.
- **Validation**:
  - `npx eslint "rooms/laboratory/main-functions/subtitle-analysis/**/*.{ts,js}"`

### Task S3-T3: Clean Audio-Analysis Runtime Surface
- **Location**: `rooms/laboratory/main-functions/audio-analysis/**/*.{ts,js}`
- **Description**: Apply the shared laboratory typing approach to audio-analysis, especially module catalogs, provider state access, and analysis result composition paths.
- **depends_on**: [S1-T1]
- **Acceptance Criteria**:
  - Audio-analysis modules stop leaking `any` into laboratory shared/UI accessors.
  - Remaining warnings are isolated to explicitly documented edge adapters, not core flows.
  - The room-level lint count moves close to zero or to a small, explainable tail.
- **Validation**:
  - `npx eslint "rooms/laboratory/main-functions/audio-analysis/**/*.{ts,js}"`

## Sprint 4: Convergence And Regression Guard
**Goal**: Recombine both room tracks, verify the full `rooms/` surface, and prevent backsliding.
**Demo/Validation**:

- Full `rooms/` lint passes at the target warning count.
- Remaining warnings, if any, are intentionally documented and triaged.

### Task S4-T1: Run Full Rooms Verification
- **Location**: `rooms/**/*.{js,ts}`
- **Description**: Rerun the full rooms-only lint and compare against the Sprint 0 baseline. Produce a short delta summary by room, rule, and top residual files.
- **depends_on**: [S2-T1, S2-T2, S3-T1, S3-T2, S3-T3]
- **Acceptance Criteria**:
  - Full `rooms/` lint is rerun after all room tasks land.
  - The final warning count is recorded against the original baseline.
  - Any residual warnings are clustered and named, not left as an opaque tail.
- **Validation**:
  - `npm run rooms:lint -- --format json --output-file /tmp/rooms-eslint-final.json`

### Task S4-T2: Add A Rooms-Only Regression Guard
- **Location**: `package.json`, CI or local workflow docs if needed
- **Description**: Once the warning count reaches the agreed threshold, add a rooms-only enforcement step such as `--max-warnings 0` or a dedicated `rooms:lint:strict` script so new warnings cannot silently return.
- **depends_on**: [S4-T1]
- **Acceptance Criteria**:
  - A rooms-only lint guard exists or is explicitly deferred with a reason.
  - The guard does not broaden scope to app-wide lint.
  - Team members have a clear command to run before merging room changes.
- **Validation**:
  - Run the chosen strict rooms-only command locally.

## Testing Strategy

- Re-run targeted lint after every task, not only at the end of a sprint.
- Track progress in deltas, not anecdotes:
  - room total
  - cluster total
  - top 5 remaining rules
- For tasks that replace `deps: any` with named types, verify both lint output and runtime shape assumptions by reading the immediate call sites before widening the contract.
- Prefer room-local smoke checks if a task touches UI composition or host/runtime assembly.

## Potential Risks & Gotchas

- `laboratory` has a heavy shared dependency graph. If feature work starts before Sprint 1 is stable, warning churn will bounce between shared and feature files.
- `game-room` uses IIFE-style runtime modules and global factory registries. If these are typed inconsistently across features, warning counts will drop short-term but type drift will grow.
- Some helpers intentionally normalize untrusted data. Those files may still need carefully documented narrowing helpers instead of aggressive type assertions.
- If two workers touch the same composition file, merge conflicts will erase most of the time savings from parallelism.
- A full rooms-only strict guard should be added only after the residual warning count is low enough to avoid blocking the cleanup itself.

## Rollback Plan

- Keep each task as a separate commit scoped to one room cluster.
- If a task regresses runtime behavior, revert only that cluster commit and keep the rest of the room track moving.
- If a shared laboratory contract causes downstream churn, revert the contract pass and re-split it into smaller host/UI subtasks.
- If manual dual-session coordination becomes noisy, fall back to one coordinator plus subagents using this same plan file.
