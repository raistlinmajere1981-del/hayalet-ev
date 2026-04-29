# Plan: Laboratory YouTube Import Mode Phase 2 - Live Import Intelligence

**Generated**: 2026-04-29
**Estimated Complexity**: Medium

## Overview

Transform the current shell-only YouTube Import Workspace into a responsive, local-state-driven import experience. The user can paste or type a YouTube URL, the store enters a parsing state, a simulated metadata preview appears after roughly 800ms, and the right panel becomes contextual. This phase remains intentionally non-destructive: no yt-dlp execution, no metadata API calls, no pipeline integration, no source asset creation, no persistence, and no installed-copy edits.

The current implementation already has `state.ui.labMode === "import-youtube"`, an import-only layout branch, `rooms/laboratory/ui/youtube-import-workspace.ts`, controller event delegation, and Phase 1/1.5 render regressions. Phase 2 should build on that shape by adding local `ui.youtubeImport` state, explicit store events, deterministic simulated parse behavior in the controller/UI layer, contextual markup, focused CSS, and regressions.

## Clarifications And Assumptions

- No blocking questions remain. The request is scoped to local UI intelligence only.
- `LabStoreState.ui.youtubeImport` is UI-local and should not be added to `LabPersistedState`.
- The requested action names map to this repo's `LabStoreEvent` union.
- The parse is simulated with deterministic sample metadata. It must not call network APIs, yt-dlp, room tools, or media host actions.
- The preview thumbnail may be a derived YouTube thumbnail URL. That is a visual image load only, not a metadata/import request, and the UI must tolerate image load failure without changing parse state.
- Blank input has one canonical behavior: clear to idle. Invalid non-empty input has one canonical behavior: parse error.
- Error state is handled through the new store event for invalid non-empty values.
- Existing `sourceDrafts.youtubeUrl` behavior can be preserved for compatibility, but `ui.youtubeImport.url` becomes the import workspace's local source of truth.
- Because current mode is `terminal` and `whereami.effectiveMode` is `other-provider-cli`, implementation should use `workflow:terminal-mode` with plain text and no Rovo interaction payload.

## Prerequisites

- Work only in workspace source files, mainly `rooms/laboratory` and `scripts/tests`.
- Keep `data/rooms/laboratory` untouched; installed copies are refreshed by build/sync flows only.
- Preserve Phase 1/1.5 guarantees: import mode is isolated, reversible, and does not mutate source/project/pipeline state.
- Use focused validation before broader checks:
  - `npm run rooms:test:file -- scripts/tests/laboratory-store-runtime-regressions.test.ts`
  - `npm run rooms:test:file -- scripts/tests/laboratory-controller-runtime-regressions.test.ts`
  - `npm run rooms:test:file -- scripts/tests/laboratory-ui-evaluation-regressions.test.ts`
  - `npm run rooms:typecheck`

## Sprint 1: Store Contract And Reducer

**Goal**: Add a local import state contract that can represent idle, parsing, ready, and error states without touching persisted or media source state.

**Demo/Validation**:

- Fresh stores expose `state.ui.youtubeImport.status === "idle"`.
- Dispatching the new events updates only `ui.youtubeImport`.
- Clearing returns URL, preview, and status to the initial idle shape.
- Hydration resets the transient import state and preserves persisted source draft behavior.

### Task 1.1: Add YouTube Import Types

- **Location**: `rooms/laboratory/models/lab-types.ts`
- **Description**: Add `LabYoutubeImportStatus`, `LabYoutubeImportPreview`, and `LabYoutubeImportState`, then add `youtubeImport: LabYoutubeImportState` to `LabStoreUiState`.
- **Complexity**: 3
- **Dependencies**: None
- **Parallel Execution**: Can run before reducer work.
- **Acceptance Criteria**:
  - Status union is `"idle" | "parsing" | "ready" | "error"`.
  - Preview supports optional `title`, `duration`, and `thumbnail`.
  - The state shape stays aligned with the request: `url`, `status`, and `preview`; no persisted `errorReason` field is added.
  - No field is added to `LabPersistedState`.
- **Validation**:
  - `npm run rooms:typecheck`

### Task 1.2: Initialize Default Import State

- **Location**: `rooms/laboratory/runtime/lab-store.ts`
- **Description**: Add a helper such as `createIdleYoutubeImportState()` and initialize `createInitialState().ui.youtubeImport` from it.
- **Complexity**: 2
- **Dependencies**: Task 1.1
- **Parallel Execution**: Sequential after type addition.
- **Acceptance Criteria**:
  - Default state is `{ url: null, status: "idle", preview: null }`.
  - The initializer returns a fresh object so reset paths do not share mutable state.
- **Validation**:
  - Store regression asserts the initial state.

### Task 1.3: Add Store Events

- **Location**: `rooms/laboratory/models/lab-types.ts`
- **Description**: Add events for `youtube-import-set-url`, `youtube-import-parse-start`, `youtube-import-parse-success`, `youtube-import-parse-error`, and `youtube-import-clear`.
- **Complexity**: 3
- **Dependencies**: Task 1.1
- **Parallel Execution**: Can pair with reducer implementation.
- **Acceptance Criteria**:
  - `youtube-import-set-url` carries `url: string | null`.
  - `youtube-import-parse-success` carries a preview object.
  - `youtube-import-parse-error` may carry a short reason string for debug/event inspection, but the reducer does not store or render that reason in Phase 2.
- **Validation**:
  - `npm run rooms:typecheck`

### Task 1.4: Implement Reducer Behavior

- **Location**: `rooms/laboratory/runtime/lab-store.ts`
- **Description**: Handle each new event in `reduceEvent`. Keep mutations scoped to `state.ui.youtubeImport`; do not patch `source`, `assets`, `workbench`, `run`, `reports`, or project state.
- **Complexity**: 4
- **Dependencies**: Tasks 1.1-1.3
- **Parallel Execution**: Sequential after event types.
- **Acceptance Criteria**:
  - Set URL updates URL and clears stale preview when URL changes.
  - Parse start sets status to `parsing` and clears preview.
  - Parse success sets status to `ready` and stores preview.
  - Parse error sets status to `error`, keeps the current non-empty URL, and clears preview.
  - Clear resets URL, status, and preview to idle defaults.
  - Hydrate resets transient import state to idle.
- **Validation**:
  - Add store tests in `scripts/tests/laboratory-store-runtime-regressions.test.ts`.

## Sprint 2: Parse Simulation Controller

**Goal**: Wire URL input to state transitions and deterministic simulated metadata without triggering real download or media host behavior.

**Demo/Validation**:

- Typing or pasting a URL dispatches set-url and parse-start immediately.
- A timer dispatches parse-success after about 800ms.
- Blank values clear to idle; invalid non-empty values dispatch parse-error.
- Changing the URL before the timer completes cannot let stale metadata overwrite the latest state.

### Task 2.1: Add Controller Parse Timer State

- **Location**: `rooms/laboratory/runtime/lab-run-controller.ts`
- **Description**: Add local timer bookkeeping for the simulated import parse. Use the same controller-level event delegation style as existing source draft input handling.
- **Complexity**: 4
- **Dependencies**: Sprint 1
- **Parallel Execution**: Sequential after store events exist.
- **Acceptance Criteria**:
  - Existing global/user-action timers are not mixed with import parse timers.
  - A dedicated helper such as `clearYoutubeImportParseTimer()` owns cleanup.
  - A new URL clears the prior pending parse timer.
  - Exit/clear action clears any pending parse timer.
  - If a controller teardown API is introduced in this phase, it calls the same cleanup helper; if not, the plan documents that the current controller is session-lived and cleanup is action/lifecycle-event based.
- **Validation**:
  - Controller regression with timer mock proves one pending timer and stale timer cleanup.

### Task 2.2: Route Import URL Input

- **Location**: `rooms/laboratory/ui/youtube-import-workspace.ts`, `rooms/laboratory/runtime/lab-run-controller.ts`
- **Description**: Give the import URL field its own field name such as `youtube-import.url`, then handle input and paste through the existing input listener path. Preserve `source.youtubeUrl` compatibility only if needed for existing Phase 1 tests.
- **Complexity**: 4
- **Dependencies**: Tasks 1.3-1.4, Task 2.1
- **Parallel Execution**: Sequential with controller simulation.
- **Acceptance Criteria**:
  - Input dispatches `youtube-import-set-url`.
  - Paste is covered either by the browser's follow-up input event or by a small paste handler that reads the pasted URL after the input value settles.
  - Non-empty values dispatch `youtube-import-parse-start`.
  - Empty values dispatch `youtube-import-clear` and leave the state idle.
  - Invalid non-empty values dispatch `youtube-import-set-url` followed by `youtube-import-parse-error`.
  - No `sendMediaAction`, `source-download-youtube`, `load-source`, pipeline event, or asset event is emitted.
- **Validation**:
  - Controller regression simulates input on `youtube-import.url`.

### Task 2.3: Build Simulated Preview Payload

- **Location**: `rooms/laboratory/runtime/lab-run-controller.ts`
- **Description**: Add a small pure helper to extract a YouTube video id from common URL shapes and build the sample preview payload.
- **Complexity**: 3
- **Dependencies**: Task 2.2
- **Parallel Execution**: Can be developed with controller tests.
- **Acceptance Criteria**:
  - Valid watch, short, and embed URL shapes produce a thumbnail URL.
  - Preview title is deterministic, such as `Sample Video Title`.
  - Duration is deterministic, `154`.
  - No metadata/API network request is made by controller code; browser image loading from the returned thumbnail URL is treated as optional visual loading only.
- **Validation**:
  - Controller/source-level tests assert helper behavior or emitted preview payload.

### Task 2.4: Guard Stale Parse Completion

- **Location**: `rooms/laboratory/runtime/lab-run-controller.ts`, `rooms/laboratory/runtime/lab-store.ts`
- **Description**: Ensure a timer scheduled for an older URL cannot overwrite the preview for a newer URL. Prefer controller-side captured URL checks, and consider carrying the captured URL on parse success so the reducer can ignore mismatched completions.
- **Complexity**: 5
- **Dependencies**: Tasks 2.1-2.3
- **Parallel Execution**: Sequential after the first simulation path works.
- **Acceptance Criteria**:
  - Rapid URL changes result in a preview for only the latest URL.
  - Clearing before the timer fires leaves the state idle.
  - Exiting import mode does not later re-enter ready state from a delayed timer.
- **Validation**:
  - Timer-mock controller regression invokes old and new callbacks out of order.

### Task 2.5: Define Controller Lifetime Cleanup

- **Location**: `rooms/laboratory/runtime/lab-run-controller.ts`, `scripts/tests/laboratory-controller-runtime-regressions.test.ts`
- **Description**: Explicitly document and test how the new parse timer is cleaned up across the current controller lifetime. The existing controller is session-lived and exposes `attach`; avoid a broad detach refactor unless implementation creates one for the parse timer.
- **Complexity**: 3
- **Dependencies**: Tasks 2.1-2.4
- **Parallel Execution**: Sequential after timer routing.
- **Acceptance Criteria**:
  - New URL, clear, exit import mode, and invalid URL paths clear stale timers.
  - No delayed parse callback can update state after clear or exit.
  - Any new cleanup API is local and does not rewrite unrelated event listener ownership.
- **Validation**:
  - Controller timer-mock regression verifies post-clear and post-exit callbacks are inert.

## Sprint 3: Preview And Status Rendering

**Goal**: Replace the inert empty state with visible parsing/error/ready feedback and a real preview presentation.

**Demo/Validation**:

- Idle state still invites URL entry.
- Parsing state shows `Analyzing video metadata...` under the URL input.
- Ready state replaces the center empty area with thumbnail, title, and formatted duration.
- Error state shows `Invalid YouTube URL or network error`.

### Task 3.1: Add State Data Attributes

- **Location**: `rooms/laboratory/ui/youtube-import-workspace.ts`
- **Description**: Add state attributes such as `data-import-status` and `data-has-preview` on the workspace/body root before building state-specific markup branches.
- **Complexity**: 2
- **Dependencies**: Sprint 1
- **Parallel Execution**: Can run before CSS and render branch work.
- **Acceptance Criteria**:
  - CSS can target ready vs non-ready without brittle text selectors.
  - Tests can assert the current state through attributes.
  - Idle, parsing, ready, and error all emit deterministic attribute values.
- **Validation**:
  - Render regression asserts attributes for idle, parsing, ready, and error.

### Task 3.2: Add Formatting Helpers

- **Location**: `rooms/laboratory/ui/youtube-import-workspace.ts`
- **Description**: Add small helpers for duration formatting and safe preview fallback text.
- **Complexity**: 2
- **Dependencies**: Sprint 1
- **Parallel Execution**: Can run before markup update.
- **Acceptance Criteria**:
  - `154` formats as `02:34` in the preview.
  - Right panel duration can format as `2:34` if that better matches the requested label.
  - Missing preview fields render gracefully without `undefined`.
- **Validation**:
  - Render tests assert duration text.

### Task 3.3: Render Status Feedback Under URL Input

- **Location**: `rooms/laboratory/ui/youtube-import-workspace.ts`, `rooms/laboratory/i18n/en.json`, `rooms/laboratory/i18n/tr.json`
- **Description**: Add status feedback below the URL input. Include stable ids requested by the spec for parsing and error copy.
- **Complexity**: 3
- **Dependencies**: Tasks 1.1-1.4
- **Parallel Execution**: Can run with preview markup.
- **Acceptance Criteria**:
  - Parsing feedback includes `id="5zfn1x"` and text `Analyzing video metadata...`.
  - Error feedback includes `id="b8nq4m"` and text `Invalid YouTube URL or network error`.
  - Idle and ready states do not show stale error feedback.
  - EN/TR catalogs stay in key parity.
- **Validation**:
  - Render regression asserts parsing and error states.

### Task 3.4: Render Ready Preview

- **Location**: `rooms/laboratory/ui/youtube-import-workspace.ts`
- **Description**: When `state.ui.youtubeImport.status === "ready"` and preview exists, render `.labx-import-preview` with `.labx-import-thumb`, `.labx-import-meta`, `.title`, and `.duration` instead of the empty state.
- **Complexity**: 4
- **Dependencies**: Task 3.2
- **Parallel Execution**: Sequential after formatting helpers.
- **Acceptance Criteria**:
  - Ready state center is dominated by preview content.
  - Thumbnail `src`, preview title, alt text, input value, duration fallback, and any dynamic label/value are escaped through the existing string renderer helpers.
  - Title and duration are visible.
  - Empty-state hint is absent in ready state.
- **Validation**:
  - UI render regression asserts preview markup and absence of empty state.

### Task 3.5: Keep Input Stateful Across States

- **Location**: `rooms/laboratory/ui/youtube-import-workspace.ts`
- **Description**: Bind the import URL field value to `state.ui.youtubeImport.url` and keep it visible in idle, parsing, ready, and error states.
- **Complexity**: 3
- **Dependencies**: Sprint 1, Task 2.2
- **Parallel Execution**: Can run with status markup.
- **Acceptance Criteria**:
  - User-entered URL remains visible during parsing and ready states.
  - Clear resets the input value.
  - Existing Phase 1 tests are updated from `source.youtubeUrl` expectations to the new import-local field where appropriate.
- **Validation**:
  - Render regression checks value binding for a seeded state.

## Sprint 4: Contextual Right Panel And Controls

**Goal**: Make the right panel react to import state so the screen feels understood rather than static.

**Demo/Validation**:

- Idle right panel shows basic information only.
- Parsing right panel disables controls and shows `Analyzing video...`.
- Ready right panel enables controls and shows format, estimated size, and duration.
- Controls remain inert with respect to download/pipeline actions.

### Task 4.1: Replace Static Placeholders With State Branches

- **Location**: `rooms/laboratory/ui/youtube-import-workspace.ts`, `rooms/laboratory/i18n/en.json`, `rooms/laboratory/i18n/tr.json`
- **Description**: Replace the current static `.labx-import-url`, `.labx-import-basic`, and `.labx-import-advanced` text with a contextual config renderer and room-local copy keys.
- **Complexity**: 4
- **Dependencies**: Sprints 1 and 3
- **Parallel Execution**: Can run with CSS once class names are chosen.
- **Acceptance Criteria**:
  - Idle state shows basic info only and no enabled advanced controls.
  - Parsing state includes `id="jp9w3v"` and text `Analyzing video...`.
  - Ready state includes `id="0zznv2"` and labels for format, estimated size, and duration.
  - All new visible right-panel copy is sourced through EN/TR i18n keys with bootstrap fallbacks.
  - No actual download action is added.
- **Validation**:
  - Render regression asserts all three panel states.

### Task 4.2: Add Inert Controls With Disabled/Enabled State

- **Location**: `rooms/laboratory/ui/youtube-import-workspace.ts`
- **Description**: Add expected option controls as inert UI elements: format display/select, basic option rows, and action buttons. Disable all controls until ready.
- **Complexity**: 4
- **Dependencies**: Task 4.1
- **Parallel Execution**: Sequential after right-panel branch.
- **Acceptance Criteria**:
  - Parsing controls render disabled.
  - Ready option controls render enabled for local selection affordance, but do not dispatch import/download/pipeline actions.
  - Footer execution buttons remain non-executing in this phase, either semantically disabled or present without any `data-lab-action`.
  - Click/change tests prove ready controls cannot emit `source-download-youtube`, `load-source`, pipeline, asset, or media host actions.
- **Validation**:
  - Render regression asserts disabled attributes before ready and no forbidden action markers.
  - Controller regression clicks ready-state controls and asserts no host/media action emission.

### Task 4.3: Add Clear/Reset UI Contract

- **Location**: `rooms/laboratory/ui/youtube-import-workspace.ts`, `rooms/laboratory/runtime/lab-run-controller.ts`
- **Description**: Add a clear command with `data-lab-action="youtube-import-clear"` and route it to the new clear event. If the existing back control should also clear, make that an explicit local decision in the implementation notes before coding.
- **Complexity**: 3
- **Dependencies**: Sprint 1, Task 2.1
- **Parallel Execution**: Can run after controller routing exists.
- **Acceptance Criteria**:
  - Clear empties URL, clears preview, and resets status to idle.
  - Clear cancels pending parse timers.
  - Back still exits import mode without triggering downloads.
- **Validation**:
  - Store and controller regressions assert reset behavior.

## Sprint 5: Layout Evolution And Styling

**Goal**: Make ready state visually dominant and preserve responsive polish across import states.

**Demo/Validation**:

- Ready state uses `grid-template-columns: 1.2fr 1fr`.
- Idle/parsing can keep the existing perception-lock layout.
- Preview image and metadata do not overlap at desktop or narrow widths.
- Disabled and enabled right-panel states are visually clear.

### Task 5.1: Style Preview State

- **Location**: `rooms/laboratory/ui/styles/project-workspace.css`
- **Description**: Add styles for `.labx-import-thumb`, `.labx-import-meta`, `.title`, `.duration`, status feedback, contextual right panel rows, and disabled state.
- **Complexity**: 4
- **Dependencies**: Sprints 3 and 4
- **Parallel Execution**: Can run with render tests after class names settle.
- **Acceptance Criteria**:
  - Preview thumbnail has stable dimensions or aspect ratio.
  - Metadata text fits without overlapping or shifting layout.
  - Parsing/error feedback is visible under the URL input.
  - Disabled controls are clearly inactive.
- **Validation**:
  - CSS/source assertions in UI regression.
  - Optional screenshot smoke if app is running or deliberately started.

### Task 5.2: Implement Ready Layout Columns

- **Location**: `rooms/laboratory/ui/styles/project-workspace.css`
- **Description**: Change `.labx-import-body` to `grid-template-columns: 1.2fr 1fr` when a preview exists, while keeping a clean stacked mobile fallback.
- **Complexity**: 3
- **Dependencies**: Task 3.1
- **Parallel Execution**: Can run with preview styles.
- **Acceptance Criteria**:
  - Ready state applies the requested `1.2fr 1fr` grid.
  - Mobile layout remains one column.
  - Existing import-only shell sizing is not regressed.
- **Validation**:
  - CSS/source regression checks selector and media query.

## Sprint 6: Regression Suite And Smoke

**Goal**: Prove the phase is responsive, stateful, and still non-destructive.

**Demo/Validation**:

- Focused tests pass.
- Typecheck passes or any pre-existing unrelated failures are documented.
- Manual/Electron smoke confirms paste/input visibly reacts within roughly one second when available.

### Task 6.1: Store Regression Coverage

- **Location**: `scripts/tests/laboratory-store-runtime-regressions.test.ts`
- **Description**: Add tests for default import state, set URL, parse start, parse success, parse error, clear, hydrate reset, blank-as-clear behavior, and non-mutation of source/assets/project state.
- **Complexity**: 4
- **Dependencies**: Sprint 1
- **Parallel Execution**: Can run before UI work is complete.
- **Acceptance Criteria**:
  - Every new store event is exercised.
  - Tests prove transient state is not persisted.
- **Validation**:
  - `npm run rooms:test:file -- scripts/tests/laboratory-store-runtime-regressions.test.ts`

### Task 6.2: Controller Regression Coverage

- **Location**: `scripts/tests/laboratory-controller-runtime-regressions.test.ts`
- **Description**: Add timer-mock tests for URL input, paste/input ordering, parse start, delayed parse success, blank clear, invalid non-empty URL error, stale timer guard, clear/exit cancellation, ready-control clicks, and no media host action.
- **Complexity**: 5
- **Dependencies**: Sprint 2
- **Parallel Execution**: Sequential after controller implementation.
- **Acceptance Criteria**:
  - Simulated parse delay is asserted as about 800ms.
  - Blank input clears to idle and does not enter error state.
  - Invalid non-empty input enters error state.
  - Ready-state option/footer interactions do not trigger import/download/pipeline behavior.
  - No `sendEvent` payload uses `source-download-youtube`, `load-source`, or pipeline execution actions.
- **Validation**:
  - `npm run rooms:test:file -- scripts/tests/laboratory-controller-runtime-regressions.test.ts`

### Task 6.3: UI Render Regression Coverage

- **Location**: `scripts/tests/laboratory-ui-evaluation-regressions.test.ts`
- **Description**: Update import workspace tests to cover idle, parsing, ready, and error markup; contextual right panel; requested ids; preview replacement; and data attributes.
- **Complexity**: 5
- **Dependencies**: Sprints 3-5
- **Parallel Execution**: Sequential after markup/CSS.
- **Acceptance Criteria**:
  - Idle keeps empty state.
  - Parsing shows both status feedback areas.
  - Ready shows preview and dynamic labels.
  - Error shows the requested error text.
  - Import-only layout still omits legacy chrome.
- **Validation**:
  - `npm run rooms:test:file -- scripts/tests/laboratory-ui-evaluation-regressions.test.ts`

### Task 6.4: Final Room Checks

- **Location**: Repository root
- **Description**: Run the focused suite and `rooms:typecheck`. If broader checks fail from unrelated dirty worktree changes, document exact failing files and separate them from Phase 2 work.
- **Complexity**: 2
- **Dependencies**: Tasks 6.1-6.3
- **Parallel Execution**: Final step only.
- **Acceptance Criteria**:
  - Focused store/controller/UI tests pass.
  - Typecheck status is known.
  - No installed copy or generated room artifact is manually edited.
- **Validation**:
  - `npm run rooms:test:file -- scripts/tests/laboratory-store-runtime-regressions.test.ts scripts/tests/laboratory-controller-runtime-regressions.test.ts scripts/tests/laboratory-ui-evaluation-regressions.test.ts`
  - `npm run rooms:typecheck`

## Testing Strategy

- Store tests own the state contract and reducer correctness.
- Controller tests own input/paste behavior, timer delay, stale parse cancellation, clear behavior, and no media action emission.
- UI render tests own markup, ids, preview replacement, right-panel state branches, i18n key parity, and import-only shell isolation.
- CSS/source assertions cover the ready-state layout selector and required classes.
- Manual smoke is optional but valuable: enter YouTube import mode, paste a URL, confirm parsing feedback appears immediately, and confirm preview appears within roughly one second.

## Potential Risks & Gotchas

- **Timer race**: A user may paste a second URL before the first simulated parse completes. Mitigation: clear prior timer and guard completion by captured latest URL.
- **Paste ordering**: Paste handlers can run before the input element value updates. Mitigation: prefer the input event as the source of truth, or defer paste handling until the value has settled.
- **State ownership drift**: Existing source draft handling uses `source.youtubeUrl`. Mitigation: keep `ui.youtubeImport.url` as the import-local truth and only mirror source drafts if compatibility requires it.
- **Accidental pipeline trigger**: Existing source input code can call media actions for normal source fields. Mitigation: use a distinct `youtube-import.url` field and assert no forbidden action markers/events.
- **Thumbnail fetch failure**: Remote YouTube thumbnail images may fail due to network or policy constraints. Mitigation: keep thumbnail optional, provide alt/fallback styling, and never couple image loading to parse status.
- **Ready controls look executable**: The phase enables local option controls visually but must not execute downloads. Mitigation: keep footer execution actions semantically disabled or actionless, and add controller tests proving clicks emit no host/media action.
- **Invalid URL definition**: The request asks for error handling but not full validation. Mitigation: use a small conservative validator for common YouTube URL shapes; blank clears to idle, and unknown non-empty hosts enter error.
- **I18n parity**: Existing import copy is room-local. Mitigation: add every new English key with a Turkish peer in the same commit.
- **Dirty worktree**: Phase 1/1.5 files are already modified. Mitigation: preserve existing user changes, keep Phase 2 edits narrow, and avoid generated installed-copy churn.
- **Full typecheck noise**: Existing `tsc_output.txt` shows unrelated errors may exist. Mitigation: run focused tests and document unrelated typecheck failures separately if they remain.

## Rollback Plan

- Remove `ui.youtubeImport` types and default initializer.
- Remove the five `youtube-import-*` store events and reducer cases.
- Remove controller timer/input routing for `youtube-import.url`.
- Revert `youtube-import-workspace.ts` to the Phase 1.5 empty-state renderer.
- Remove added `.labx-import-*` CSS for preview/status/contextual controls.
- Remove Phase 2 test cases while keeping Phase 1/1.5 import mode tests intact.
