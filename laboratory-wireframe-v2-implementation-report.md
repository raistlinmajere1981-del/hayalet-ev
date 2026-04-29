# Laboratory Wireframe v2 Implementation Report

Generated: 2026-04-29

## Scope

Implemented the open-gaps plan in `laboratory-wireframe-v2-open-gaps-plan.md` for the Laboratory room source copy under `rooms/laboratory`. The work stayed in the room source and focused regressions, with no manual edits to `data/rooms/laboratory`.

Runtime context at implementation time:

- `npm run mode:status`: `terminal`, app closed, Electron unavailable.
- `npm run whereami`: `effectiveMode=other-provider-cli`.
- Workflow used: `workflow:terminal-mode`, plain text, no app interaction payload.

Live Electron/CDP smoke was skipped because the app was not running and `electronConnectionAvailable=false`.

## Sprint Results

### Sprint 1: Running-Mode Mutation Locks

Status: completed.

Implemented a shared workspace lock contract and threaded it through store, controller, and UI render paths.

Key changes:

- Added `LabWorkspaceLockState` and selector-driven lock derivation.
- Locked source, timeline, ROI mutation, workspace intents, and hypothesis during `running` and `queued` runs.
- Kept focus and inspection controls available while a run is active.
- Added store guards so direct events cannot mutate locked analysis inputs.
- Added controller guards for timeline actions, source controls, ROI toggles, intent changes, and hypothesis edits.
- Reset `userExploreToggle` on run start.
- Rendered locked affordances in timeline, ROI overlay, and hypothesis UI.

Important files:

- `rooms/laboratory/models/lab-types.ts`
- `rooms/laboratory/runtime/lab-selectors.ts`
- `rooms/laboratory/runtime/lab-store.ts`
- `rooms/laboratory/runtime/lab-run-controller.ts`
- `rooms/laboratory/ui/lab-waveform-timeline-render.ts`
- `rooms/laboratory/ui/workspace-roi-overlay.ts`
- `rooms/laboratory/ui/workspace-hypothesis.ts`
- `rooms/laboratory/ui/lab-selection-roi-binder.ts`
- `rooms/laboratory/ui/lab-root.ts`

### Sprint 2: Media Viewport State Machine

Status: completed.

Implemented explicit viewport states and source retry semantics.

Key changes:

- Added `LabMediaViewportState` and `getMediaViewportState`.
- Added stale/mismatched source protection through `isLoadedSourceMatchingMode`.
- Rendered explicit empty, loading, active, and error viewport states.
- Hid timeline, ROI, and filters outside the active viewport state.
- Added `source-probe-retry` as a separate action from analysis retry.
- Blocked local source retry from blind re-import. Local failures now require choosing the file again from the source panel.
- URL retry replays the stored/draft URL when available.
- YouTube retry respects URL presence and `yt-dlp` readiness.
- Converted retry block reasons to machine-readable codes and localized visible copy through room i18n.

Important files:

- `rooms/laboratory/models/lab-types.ts`
- `rooms/laboratory/runtime/lab-selectors.ts`
- `rooms/laboratory/runtime/lab-run-controller.ts`
- `rooms/laboratory/ui/workspace-surface.ts`
- `rooms/laboratory/ui/lab-source-retry-copy.ts`
- `rooms/laboratory/i18n/en.json`
- `rooms/laboratory/i18n/tr.json`

### Sprint 3: Decision Surface Mapping and Advisories

Status: completed.

Closed deterministic result drawer display gaps.

Key changes:

- Replaced raw candidate, commitment, and staging status rendering with localized UI mappings.
- Added EN/TR labels for valid, unstable, invalid, approved, revoked, ready, pending, and empty states.
- Used existing formatter functions for coherence, readiness, and bridge advisory summaries.
- Kept coherence details auto-open only for conflicted state.
- Kept readiness details auto-open for strained signal.
- Kept bridge details collapsed by default.
- Preserved warning banner behavior for completed runs with warnings.

Important files:

- `rooms/laboratory/ui/lab-drawer.ts`
- `rooms/laboratory/i18n/en.json`
- `rooms/laboratory/i18n/tr.json`

### Sprint 4: Process Strip Semantics

Status: completed.

Closed process strip state, color, warning, cancellation, empty, and localization gaps.

Key changes:

- Recent action history now uses `getUserActions(state).slice(0, 5)`.
- Added `partial` strip state for completed runs with warnings.
- Added warning dot/progress tone support.
- Warning dots are now attributed from module trace stage/module information instead of always the final step.
- Cancelled runs show a cancelled state without retry CTA and without error coloring.
- Empty completed runs include the empty reason in the strip label.
- Unknown-total active runs show indeterminate progress without `0%`.
- Added room-local EN/TR process strip copy.

Important files:

- `rooms/laboratory/ui/lab-process-strip.ts`
- `rooms/laboratory/ui/lab-theme.css`
- `rooms/laboratory/i18n/en.json`
- `rooms/laboratory/i18n/tr.json`

### Sprint 5: Timeline / Viewport Sync

Status: completed.

Closed timeline interaction and preview sync behavior.

Key changes:

- Timeline drag completion now seeks preview to the final selected start time.
- Mousemove drag remains selection-only and does not seek continuously.
- Click-only seek behavior remains intact.
- Bookmark/timeline seek tries to center the timeline target when overflow exists.
- Locked timeline actions are inert.
- Timeline locked state is visible through markup and CSS.

Important files:

- `rooms/laboratory/runtime/lab-run-controller.ts`
- `rooms/laboratory/ui/lab-waveform-timeline-render.ts`
- `rooms/laboratory/ui/lab-waveform-timeline-types.ts`
- `rooms/laboratory/ui/lab-theme.css`

### Sprint 6: Regression Closure

Status: completed.

Added a dedicated Wireframe v2 contract regression file and updated existing focused expectations.

New coverage:

- Active-run workspace locks and direct store mutation guards.
- Locked timeline and locked hypothesis rendering.
- Failed source setup/error viewport/idle strip behavior.
- Stale completed source viewport fallback.
- Local retry blocked safely, URL retry replayed, YouTube dependency guard, and YouTube retry success.
- Localized decision labels and advisory defaults.
- Partial/cancelled/indeterminate process strip states.
- Module/stage-attributed warning dot behavior.
- English visible copy for retry block reasons.

Important files:

- `scripts/tests/laboratory-wireframe-v2-contract-regressions.test.ts`
- `scripts/tests/laboratory-controller-runtime-regressions.test.ts`
- `scripts/tests/laboratory-ui-evaluation-regressions.test.ts`

## Subagent Reviews

### Beauvoir Review

Finding summary:

- Local retry was unsafe for failed local sources.
- Viewport state did not handle stale/mismatched sources.
- Process strip warning attribution was too coarse.
- Process strip copy was not room-localized.
- `config/rooms.json` had timestamp churn from build output.

Resolution:

- Local retry now returns a block reason and does not dispatch `source-pick-local`.
- Stale/mismatched completed sources now resolve to `empty`, not `active`.
- Warning dots derive from module trace stage/module and warning mentions.
- Strip copy added to EN/TR catalogs.
- `config/rooms.json` was restored; it currently has no diff.

### Chandrasekhar Review

Finding summary:

- Retry block reason text was still hardcoded Turkish in a selector and rendered in the viewport.

Resolution:

- Added `LabSourceRetryBlockReason` reason codes.
- `getSourceRetryBlockReason` now returns codes only.
- Added `rooms/laboratory/ui/lab-source-retry-copy.ts` to format reason codes through room i18n.
- Updated viewport and controller warning events to use localized formatter output.
- Added matching `retryBlocked` keys to EN/TR catalogs.

### Sartre Spot Check

Result:

- Verified retry block reasons are codes, not visible localized text.
- Verified viewport and controller localize retry block reasons through room i18n.
- Verified EN/TR retry block catalogs match.
- Verified source retry regression coverage.
- Verified `config/rooms.json` has no diff.

Note:

- `rooms/laboratory/ui/lab-source-retry-copy.ts` and `scripts/tests/laboratory-wireframe-v2-contract-regressions.test.ts` are new files and must be included with the change set. They are intentionally new, not missing.

## Validation

Passed:

- `hev_dev_check_syntax` on the changed TypeScript/CSS/test files used during implementation.
- `node -e "JSON.parse(...)"` for `rooms/laboratory/i18n/en.json` and `rooms/laboratory/i18n/tr.json`.
- `npm run rooms:typecheck`
- `npm run rooms:test:file -- scripts/tests/laboratory-wireframe-v2-contract-regressions.test.ts`
  - Result: 7/7 passed.
- `npm run rooms:test:file -- scripts/tests/laboratory-controller-runtime-regressions.test.ts scripts/tests/laboratory-ui-evaluation-regressions.test.ts scripts/tests/laboratory-wireframe-v2-contract-regressions.test.ts`
  - Result: 56/56 passed.
- `npm run rooms:test:file -- scripts/tests/laboratory-ui-evaluation-regressions.test.ts scripts/tests/laboratory-source-ui-regressions.test.ts scripts/tests/laboratory-workspace-runtime-regressions.test.ts scripts/tests/laboratory-controller-runtime-regressions.test.ts scripts/tests/laboratory-execution-runtime-regressions.test.ts scripts/tests/laboratory-wireframe-v2-contract-regressions.test.ts`
  - Result: 156/156 passed.
- `npm run rooms:build`
  - Built `forge-room`, `game-room`, and `laboratory`.
- `git diff --check`
  - Clean.

Skipped:

- Live Electron/CDP smoke. Reason: app closed, runtime mode `terminal`, Electron connection unavailable.

## Current Change Set Notes

Intended new files:

- `laboratory-wireframe-v2-open-gaps-plan.md`
- `laboratory-wireframe-v2-implementation-report.md`
- `rooms/laboratory/ui/lab-source-retry-copy.ts`
- `scripts/tests/laboratory-wireframe-v2-contract-regressions.test.ts`

Observed unrelated untracked file left untouched:

- `android-whisper-dictation-settings-capture-plan.md`

Generated config:

- `config/rooms.json` has no diff after build.

## Residual Risk

- Live app behavior was not visually smoke-tested because the Electron app was closed.
- Timeline drag completion and bookmark centering are covered through focused controller tests, not a live browser/Electron interaction pass.
- Local retry intentionally requires user file re-selection; this is safer than reusing a stale local file handle, but it is a deliberate UX constraint.
