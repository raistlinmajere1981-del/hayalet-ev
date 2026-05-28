# Plan: Laboratory YouTube Import Mode Phase 3 - Extraction Strategy System

**Generated**: 2026-04-29
**Estimated Complexity**: Medium

## Overview

Replace the YouTube import right panel's passive format display with an active extraction strategy system. The user should choose between Best Quality, Audio Only, Small Size, and Advanced/Custom before any future backend execution exists. This phase remains UI and local-state only: no yt-dlp execution, no media host action, no asset creation, no project source mutation, no installed-copy edits, and no persistence migration.

The current Phase 2 baseline already provides `state.ui.labMode === "import-youtube"`, transient `state.ui.youtubeImport` URL/status/preview state, simulated metadata parsing, `rooms/laboratory/ui/youtube-import-workspace.ts`, import-mode CSS in `rooms/laboratory/ui/styles/project-workspace.css`, and targeted store/controller/UI regressions. Phase 3 should extend that local import state with a strategy decision and make the ready right panel react to that decision.

## Research Summary

- `rooms/laboratory/models/lab-types.ts` currently defines `LabYoutubeImportState` with `url`, `status`, and `preview`, plus YouTube import events for URL parsing and clear/reset.
- `rooms/laboratory/runtime/lab-store.ts` creates idle YouTube import state and currently replaces that object in `youtube-import-set-url`, parse, error, clear, and hydrate paths.
- `rooms/laboratory/runtime/lab-run-controller.ts` already handles `youtube-import.url`, `youtube-import-clear`, and currently treats `youtube-import.format` as inert.
- `rooms/laboratory/ui/youtube-import-workspace.ts` currently renders a static ready panel with `Format: Best available`, `Estimated size: ~14 MB`, a format dropdown, a checked audio checkbox, and static footer buttons.
- `rooms/laboratory/ui/styles/project-workspace.css` owns all `.labx-import-*` styles and currently gives the right panel equal visual weight to passive controls.
- Existing tests already cover the current static dropdown and footer. They must be revised to assert the new strategy-card contract and the absence of the legacy format dropdown.

## Clarifications And Assumptions

- No blocking questions remain. The request is a local UI/state revision with no backend work.
- The requested `ui.youtubeImport.strategy` maps to this repo's `LabYoutubeImportState` and `LabStoreEvent` pattern.
- Strategy state is transient UI state and should not be added to `LabPersistedState`.
- Default strategy is `"video_best"`.
- Changing URL or parse status should preserve the selected strategy and custom settings.
- Exiting import mode preserves a ready URL/preview/strategy/custom decision so Back and re-entry remain reversible; exiting while parsing keeps the current controller behavior by clearing pending parse state.
- Explicit clear and hydrate reset strategy and custom settings to their defaults.
- Custom advanced controls should be visible and locally controllable in the import workspace, but they must not mutate `sourceDrafts` or call media host actions in this phase.
- Existing room-local i18n remains the source for visible copy, with concise fallback strings in the renderer.
- Because the active workflow is terminal/plain text, implementation should use `workflow:terminal-mode`.

## Prerequisites

- Inspect the dirty worktree before implementation and preserve unrelated Phase 1/1.5/2 changes already present in Laboratory files.
- Work only in the workspace source tree, mainly `rooms/laboratory` and `scripts/tests`.
- Keep `data/rooms/laboratory` untouched; installed/runtime copies are refreshed by the room sync/build flow.
- Do not change `rooms/laboratory/main-functions/media-analysis/host/source-intake-youtube.ts`, `yt-dlp.form.json`, or backend download behavior in this phase.
- Before implementation, run the repo's mode check and approval flow again if required by the active workflow.

## Sprint 1: Strategy State Contract

**Goal**: Add transient strategy state and reducer events without changing persisted state or backend source drafts.

**Demo/Validation**:

- Fresh stores expose `state.ui.youtubeImport.strategy === "video_best"`.
- Dispatching a strategy event updates only `ui.youtubeImport.strategy`.
- URL parse, parse success, and parse error preserve the selected strategy.
- Clear and hydrate reset to the default strategy.

### Task 1.1: Add Strategy Types

- **Location**: `rooms/laboratory/models/lab-types.ts`
- **Description**: Add a `LabYoutubeImportStrategy` union with `"video_best" | "audio_only" | "low_size" | "custom"` and add `strategy: LabYoutubeImportStrategy` to `LabYoutubeImportState`.
- **Complexity**: 2
- **Dependencies**: None
- **Parallel Execution**: Can run before reducer work.
- **Acceptance Criteria**:
  - `LabYoutubeImportState` includes `strategy`.
  - No field is added to `LabPersistedState`.
  - Type naming follows existing Laboratory model naming.
- **Validation**:
  - `npm run rooms:typecheck`

### Task 1.2: Initialize And Preserve Default Strategy

- **Location**: `rooms/laboratory/runtime/lab-store.ts`
- **Description**: Update `createIdleYoutubeImportState()` to include `strategy: "video_best"` and preserve the current strategy when URL/status updates replace the import state object.
- **Complexity**: 4
- **Dependencies**: Task 1.1
- **Parallel Execution**: Sequential after type addition.
- **Acceptance Criteria**:
  - Fresh import state is `{ url: null, status: "idle", preview: null, strategy: "video_best" }`.
  - `youtube-import-set-url` keeps the selected strategy while changing URL/status/preview.
  - Parse start, parse success, and parse error keep the selected strategy.
  - `youtube-import-clear` and `hydrate` reset to the default idle state.
- **Validation**:
  - Store regression covers default, URL change preservation, clear, and hydrate.

### Task 1.3: Add Strategy Event

- **Location**: `rooms/laboratory/models/lab-types.ts`, `rooms/laboratory/runtime/lab-store.ts`
- **Description**: Add `youtube-import-set-strategy` to `LabStoreEvent`, validate the incoming strategy, and update `state.ui.youtubeImport.strategy`.
- **Complexity**: 3
- **Dependencies**: Task 1.1
- **Parallel Execution**: Can pair with Task 1.2.
- **Acceptance Criteria**:
  - Event shape is `{ type: "youtube-import-set-strategy"; strategy: LabYoutubeImportStrategy }`.
  - Unknown values cannot enter state through reducer normalization or TypeScript escape hatches.
  - Changing strategy does not change URL, status, preview, source, assets, run, reports, or source drafts.
- **Validation**:
  - Store regression dispatches each strategy and verifies scoped mutation.

## Sprint 2: Strategy View Model

**Goal**: Centralize strategy labels, descriptions, estimated sizes, format labels, and CTA fragments so all right-panel UI changes stay consistent.

**Demo/Validation**:

- Each strategy maps to a deterministic label, description, size, and format label.
- Right-panel summary and footer CTA text read from the same strategy view model.

### Task 2.1: Add Strategy Metadata Helper

- **Location**: `rooms/laboratory/ui/youtube-import-workspace.ts`
- **Description**: Add a small helper such as `getYoutubeImportStrategyView(strategy, copy)` that returns label, description, estimated size, format label, and CTA label.
- **Complexity**: 3
- **Dependencies**: Sprint 1 type surface.
- **Parallel Execution**: Can run alongside i18n key additions.
- **Acceptance Criteria**:
  - `video_best` renders `Best Quality`, `Maximum resolution and bitrate`, `~14 MB`, and `Best available`.
  - `audio_only` renders `Audio Only`, `Extract audio track only`, `~2 MB`, and `MP3 / AAC`.
  - `low_size` renders `Small Size`, `Compressed for quick use`, `~5 MB`, and a compact video format label such as `MP4 compressed`.
  - `custom` renders `Advanced`, `Manual control over formats`, a custom/manual size label, and `Manual`.
  - No helper triggers side effects or backend behavior.
- **Validation**:
  - Render regression asserts expected text for all strategies.

### Task 2.2: Add Room-Local Copy Keys

- **Location**: `rooms/laboratory/i18n/en.json`, `rooms/laboratory/i18n/tr.json`, `rooms/laboratory/ui/youtube-import-workspace.ts`
- **Description**: Add keys for strategy labels, descriptions, estimated size labels, format labels, advanced control labels, and dynamic CTA templates.
- **Complexity**: 3
- **Dependencies**: Task 2.1 can define exact key names.
- **Parallel Execution**: Can run with Task 2.1.
- **Acceptance Criteria**:
  - English and Turkish catalogs stay in key parity.
  - Renderer uses `copy.t(...)` with concise fallbacks.
  - Existing Phase 2 copy keys remain unless no longer used.
- **Validation**:
  - JSON parse and existing i18n/test suite checks.

## Sprint 3: Replace Format Dropdown With Strategy Cards

**Goal**: Make strategy selection the dominant right-panel interaction and remove the passive dropdown feel.

**Demo/Validation**:

- Ready state right panel shows a `.labx-strategy-list` with four selectable cards.
- The active card is visibly selected.
- Clicking a card updates state and rerenders the summary/CTA.
- The legacy `youtube-import.format` dropdown is gone from ready, parsing, idle, and error import panels; Custom may introduce only an import-local `youtube-import.custom.format` control.

### Task 3.1: Render Strategy Cards

- **Location**: `rooms/laboratory/ui/youtube-import-workspace.ts`
- **Description**: Replace the ready panel's format dropdown and checked audio row with a strategy card list. Use real buttons for accessibility while keeping the requested card classes, for example `class="strategy-card labx-strategy-card active"`.
- **Complexity**: 5
- **Dependencies**: Sprints 1 and 2.
- **Parallel Execution**: Sequential after strategy view model exists.
- **Acceptance Criteria**:
  - Markup includes `.labx-strategy-list`.
  - Four cards render in this order: Best Quality, Audio Only, Small Size, Advanced.
  - Active card has the `active` class and an `aria-pressed="true"` state.
  - Each card shows label, description, and estimated size except Custom may show manual/custom size text.
  - Cards expose `data-lab-action="youtube-import-set-strategy"` and the strategy value through an existing pattern such as `data-lab-value`.
  - The ready panel no longer renders `data-lab-field="youtube-import.format"` for any strategy path.
  - Custom format selection, when visible, uses `data-lab-field="youtube-import.custom.format"`.
- **Validation**:
  - UI render regression asserts card order, active state, text, and absence of the old dropdown.

### Task 3.2: Wire Strategy Click Handling

- **Location**: `rooms/laboratory/runtime/lab-run-controller.ts`
- **Description**: Add a click action case for `youtube-import-set-strategy` that dispatches the new store event and does nothing else.
- **Complexity**: 3
- **Dependencies**: Task 1.3 and Task 3.1.
- **Parallel Execution**: Can run with CSS after markup contract is stable.
- **Acceptance Criteria**:
  - Clicked card changes `state.ui.youtubeImport.strategy`.
  - No `sendMediaAction`, `source-download-youtube`, `load-source`, source patch, or asset event is emitted.
  - Empty or unknown values fall back safely to the default or no-op behavior.
- **Validation**:
  - Controller regression clicks every card value and asserts state change plus zero host events.

### Task 3.3: Style Cards As Primary Controls

- **Location**: `rooms/laboratory/ui/styles/project-workspace.css`
- **Description**: Add `.labx-strategy-list` grid styles and card styling. Scope generic `.strategy-card` rules under `.labx-strategy-list` to avoid accidental global collisions.
- **Complexity**: 4
- **Dependencies**: Task 3.1.
- **Parallel Execution**: Can run after class contract is defined.
- **Acceptance Criteria**:
  - `.labx-strategy-list` uses `display: grid` and `gap: 10px`.
  - `.labx-strategy-list .strategy-card.active` has `border: 2px solid var(--labx-accent)` and `background: var(--labx-accent-soft)` or an existing equivalent accent-soft token.
  - Cards have stable padding, focus-visible styling, and no layout shift when active border changes.
  - Mobile layout remains stacked with no text overlap.
- **Validation**:
  - CSS/source regression asserts key selectors and properties.

### Task 3.4: Remove Non-Ready Placeholder Dropdowns

- **Location**: `rooms/laboratory/ui/youtube-import-workspace.ts`
- **Description**: Replace the parsing/non-ready panel's disabled format select and audio checkbox with status/context copy or a non-interactive strategy preview. The old dropdown must not survive as a disabled placeholder.
- **Complexity**: 3
- **Dependencies**: Task 3.1.
- **Parallel Execution**: Can run with ready-panel markup once the strategy view model exists.
- **Acceptance Criteria**:
  - Parsing state no longer renders `data-lab-field="youtube-import.format"`, a disabled format select, or the old checked audio row.
  - Idle and error states remain simple context states and do not show format dropdown UI.
  - Non-ready states do not imply backend execution is available.
- **Validation**:
  - UI render regression asserts absence of the legacy dropdown/select/checkbox in idle, parsing, and error states.

## Sprint 4: Dynamic Summary And CTA Labels

**Goal**: Make the right-panel summary and footer buttons visibly react to the selected strategy.

**Demo/Validation**:

- Choosing Audio Only updates size to `~2 MB`, format to `MP3 / AAC`, and CTA to include `Audio Only`.
- Choosing Small Size updates size to `~5 MB`.
- Choosing Best Quality returns to `~14 MB`.
- Footer buttons remain disabled until preview is ready, but ready-state labels reflect the current strategy.

### Task 4.1: Replace Static Ready Summary

- **Location**: `rooms/laboratory/ui/youtube-import-workspace.ts`
- **Description**: Replace the static ready summary with strategy-driven values for format, estimated size, description, and duration.
- **Complexity**: 4
- **Dependencies**: Sprint 2.
- **Parallel Execution**: Sequential after view model.
- **Acceptance Criteria**:
  - Summary reads from current `state.ui.youtubeImport.strategy`.
  - Estimated size and format label visibly change per strategy.
  - Description is shown near the strategy decision, not as a hidden note.
  - Duration remains based on preview metadata.
- **Validation**:
  - Render regression snapshots/assertions for each strategy.

### Task 4.2: Make Footer CTA Dynamic

- **Location**: `rooms/laboratory/ui/youtube-import-workspace.ts`
- **Description**: Change footer labels from static `Download` and `Download + Analyze` to strategy-aware labels such as `Download (Audio Only · ~2 MB)` and `Download & Analyze (Best Quality)`.
- **Complexity**: 3
- **Dependencies**: Task 4.1.
- **Parallel Execution**: Can run with Task 4.1.
- **Acceptance Criteria**:
  - Ready footer reflects the selected strategy.
  - Disabled/non-ready footer does not imply a runnable backend action.
  - Buttons still do not expose `data-lab-action` or trigger backend execution.
  - Text wraps cleanly on narrow screens.
- **Validation**:
  - UI render regression asserts CTA text for Best Quality and Audio Only at minimum.

## Sprint 5: Conditional Advanced Panel

**Goal**: Ensure Custom/Advanced mode has visible, locally controllable advanced settings without backend execution.

**Demo/Validation**:

- Selecting Advanced reveals `.labx-advanced-settings`.
- Non-custom strategies do not render the advanced panel.
- Advanced controls can be changed locally without mutating source drafts or calling backend actions.

### Task 5.1: Add Minimal Custom Draft Shape

- **Location**: `rooms/laboratory/models/lab-types.ts`, `rooms/laboratory/runtime/lab-store.ts`
- **Description**: Add a small transient custom settings shape so the Advanced controls are real local UI controls. Use resolution, format, and audioExtraction under `ui.youtubeImport.custom`.
- **Complexity**: 4
- **Dependencies**: Sprint 1.
- **Parallel Execution**: Sequential after the base strategy state is added.
- **Acceptance Criteria**:
  - Custom settings are UI-local and absent from `LabPersistedState`.
  - Defaults are deterministic, for example `resolution: "best"`, `format: "mp4"`, `audioExtraction: false`.
  - Clear/hydrate reset custom settings.
  - URL parse paths preserve current custom settings.
- **Validation**:
  - Store regression covers defaults, update, preservation, clear, and hydrate.

### Task 5.2: Add Custom Settings Event And Input Handling

- **Location**: `rooms/laboratory/models/lab-types.ts`, `rooms/laboratory/runtime/lab-store.ts`, `rooms/laboratory/runtime/lab-run-controller.ts`
- **Description**: Add an event such as `youtube-import-custom-updated` and handle `data-lab-field="youtube-import.custom.*"` controls through local store dispatch. Account for the controller's split paths: text/live controls may arrive through `handleInput`, while selects and checkboxes should be handled through `handleChange`.
- **Complexity**: 4
- **Dependencies**: Task 5.1.
- **Parallel Execution**: Sequential after custom draft shape.
- **Acceptance Criteria**:
  - Resolution dropdown, format dropdown, and audio extraction toggle update only `ui.youtubeImport.custom`.
  - Controller coverage includes both `input` and `change` paths where the control type requires them.
  - Custom fields do not reuse `source.youtubeCustom.*` names and do not mutate `state.ui.sourceDrafts`.
  - No host/media action is emitted.
- **Validation**:
  - Controller regression simulates control changes and asserts scoped state mutation plus zero host events.

### Task 5.3: Render Advanced Settings Conditionally

- **Location**: `rooms/laboratory/ui/youtube-import-workspace.ts`
- **Description**: Render `.labx-advanced-settings` only when `strategy === "custom"` with resolution dropdown, format dropdown, and audio extraction toggle.
- **Complexity**: 4
- **Dependencies**: Task 5.1.
- **Parallel Execution**: Can run with CSS after state decision.
- **Acceptance Criteria**:
  - Advanced panel is absent for Best Quality, Audio Only, and Small Size.
  - Advanced panel is present for Custom/Advanced.
  - Controls are accessible, labeled, and locally safe.
  - The panel does not look like a separate nested card inside a card.
- **Validation**:
  - UI render regression asserts conditional presence and field names.

### Task 5.4: Style Advanced Settings

- **Location**: `rooms/laboratory/ui/styles/project-workspace.css`
- **Description**: Add advanced settings layout styles that fit under the strategy list without competing with the cards.
- **Complexity**: 3
- **Dependencies**: Task 5.3.
- **Parallel Execution**: Can run after markup.
- **Acceptance Criteria**:
  - `.labx-advanced-settings` is visually subordinate to strategy cards.
  - Controls align in a compact responsive grid.
  - Labels and values do not overflow on mobile.
- **Validation**:
  - CSS/source regression and manual responsive smoke if app is available.

## Sprint 6: Regression Refresh And Smoke Checks

**Goal**: Prove the new strategy system is selectable, visible, dynamic, and non-executing.

**Demo/Validation**:

- Store, controller, render, and CSS tests pass.
- Manual smoke shows the user can tell the difference between all four strategies.

### Task 6.1: Update Store Regressions

- **Location**: `scripts/tests/laboratory-store-runtime-regressions.test.ts`
- **Description**: Add and update tests for strategy defaults, event updates, URL preservation, clear/hydrate reset, exit/re-entry preservation, parsing-exit cleanup, and custom settings.
- **Complexity**: 3
- **Dependencies**: Sprints 1 and 5.
- **Parallel Execution**: Can run alongside controller/UI tests after event names stabilize.
- **Acceptance Criteria**:
  - Tests fail if strategy is dropped during URL changes.
  - Tests fail if strategy leaks into persisted state.
  - Tests assert `state.persisted` or serialized persistence payloads never receive `youtubeImport.strategy` or `youtubeImport.custom` through broad spreading.
- **Validation**:
  - `npm run rooms:test:file -- scripts/tests/laboratory-store-runtime-regressions.test.ts`

### Task 6.2: Update Controller Regressions

- **Location**: `scripts/tests/laboratory-controller-runtime-regressions.test.ts`
- **Description**: Replace the old inert `youtube-import.format` assertion with strategy-card click assertions and custom control input/change assertions.
- **Complexity**: 4
- **Dependencies**: Sprints 3 and 5.
- **Parallel Execution**: Can run with UI tests.
- **Acceptance Criteria**:
  - Clicking each strategy updates state.
  - No host events are sent.
  - Old format dropdown interaction is not required for non-custom strategies.
- **Validation**:
  - `npm run rooms:test:file -- scripts/tests/laboratory-controller-runtime-regressions.test.ts`

### Task 6.3: Update UI Render And CSS Regressions

- **Location**: `scripts/tests/laboratory-ui-evaluation-regressions.test.ts`
- **Description**: Update ready-state assertions for strategy cards, active styling contract, dynamic summary, dynamic footer labels, conditional advanced panel, and non-ready removal of legacy dropdown placeholders.
- **Complexity**: 5
- **Dependencies**: Sprints 2 through 5.
- **Parallel Execution**: Can run with store/controller test work after markup stabilizes.
- **Acceptance Criteria**:
  - Ready markup includes `.labx-strategy-list`.
  - Active strategy card is visible and unique.
  - Estimated size and format labels change per strategy.
  - Custom reveals `.labx-advanced-settings`.
  - Footer labels reflect selected strategy.
  - Legacy `data-lab-field="youtube-import.format"` is absent in ready, parsing, idle, and error states.
  - Custom mode uses only `data-lab-field="youtube-import.custom.format"` for format selection.
- **Validation**:
  - `npm run rooms:test:file -- scripts/tests/laboratory-ui-evaluation-regressions.test.ts`

### Task 6.4: Run Focused And Broad Checks

- **Location**: Repository root
- **Description**: Run focused tests first, then typecheck.
- **Complexity**: 2
- **Dependencies**: Tasks 6.1 through 6.3.
- **Parallel Execution**: Sequential validation.
- **Acceptance Criteria**:
  - Focused Laboratory tests pass.
  - `npm run rooms:typecheck` passes.
  - No generated installed-copy drift is committed.
- **Validation**:
  - `npm run rooms:test:file -- scripts/tests/laboratory-store-runtime-regressions.test.ts`
  - `npm run rooms:test:file -- scripts/tests/laboratory-controller-runtime-regressions.test.ts`
  - `npm run rooms:test:file -- scripts/tests/laboratory-ui-evaluation-regressions.test.ts`
  - `npm run rooms:typecheck`

## Testing Strategy

- Store tests prove the strategy decision is canonical UI state and survives parse transitions.
- Controller tests prove strategy selection is interactive and still non-executing.
- Render tests prove the user can see the active choice, changed size/format/description, and dynamic CTAs.
- CSS tests prove the strategy list is visually dominant and scoped.
- Manual smoke, when the app is available, should cover:
  - Enter YouTube import mode.
  - Paste a valid YouTube URL and wait for ready state.
  - Select Best Quality, Audio Only, Small Size, and Advanced.
  - Confirm summary and footer text change immediately.
  - Confirm Advanced reveals controls.
  - Confirm no download starts.

## Acceptance Matrix

- Strategy is selectable: Sprint 3 controller and render tests.
- Selection visibly changes UI: Sprint 4 render tests.
- Size/format updates dynamically: Sprint 2 and Sprint 4 tests.
- Custom reveals advanced controls: Sprint 5 tests.
- CTA reflects selected strategy: Sprint 4 tests.
- No backend execution yet: Sprint 3, Sprint 4, and Sprint 6 controller assertions.

## Potential Risks & Gotchas

- `youtube-import-set-url` currently replaces the import state object. If strategy is not explicitly preserved there, selecting a URL can silently reset or drop the chosen strategy.
- Existing UI tests assert the old `youtube-import.format` dropdown. Those assertions must be intentionally replaced, not left stale.
- A generic `.strategy-card` selector could collide with future room UI. Scope CSS under `.labx-strategy-list` while keeping the requested class.
- Implementing cards as plain `div` elements would satisfy the visual sample but create keyboard/accessibility regressions. Use buttons with card styling.
- If custom controls reuse `source.youtubeCustom.*`, they may mutate active source drafts or imply backend readiness. Use import-local field names.
- Dynamic footer labels can overflow on narrow screens. CSS should allow wrapping and stable button sizing.
- `var(--labx-accent-soft)` may not exist. If absent, add a local fallback style or use an existing soft accent token consistently.
- The current worktree is already dirty in many Laboratory files. Implementation must inspect diffs before editing and avoid reverting unrelated changes.

## Rollback Plan

- Remove `LabYoutubeImportStrategy`, the strategy/custom fields, and new store events from `lab-types.ts` and `lab-store.ts`.
- Restore the static ready-panel markup in `youtube-import-workspace.ts`.
- Remove strategy/advanced CSS from `project-workspace.css`.
- Restore the old inert dropdown-related assertions only if the product decision reverts to the Phase 2 UI.
- Re-run the focused Laboratory tests and `npm run rooms:typecheck`.
