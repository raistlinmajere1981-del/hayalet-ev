# Plan: Laboratory YouTube URL Import Refinement

**Generated**: 2026-05-01
**Estimated Complexity**: Medium

## Overview

Refine the Laboratory project source import URL/YouTube area so it behaves like a compact two-step flow: paste URL, check it, then use the same primary button to add the checked source to the project. The post-check YouTube selection panel should be hidden in fresh/new-project state, hidden while checking, visible only after a successful check, and cleared again after a completed add.

The implementation should stay in the workspace source copy under `rooms/laboratory`; `data/rooms/laboratory` must not be edited manually. The existing `yt-dlp.form.json` fields should be used as the source for the richer controls instead of inventing unrelated options.

## Research Summary

- The visible title `Kaynak Ice Aktarma Calisma Alani` and the right route label `Video / YouTube` are rendered in `rooms/laboratory/ui/project-source-import.ts`.
- The current URL row renders two separate buttons, `project-import-check-url` and `project-import-url-add`, in `renderUrlImportSection`.
- The current YouTube result panel renders preview plus only two stream selects in `renderYoutubeCheckResult`.
- The persistent detail block is rendered separately by `renderProjectImportDetails`, so details can appear outside the post-check area.
- Project import URL, YouTube preview, selected formats, review focus, and completion state are owned by `rooms/laboratory/runtime/lab-store.ts`.
- Button routing and field updates are owned by `rooms/laboratory/runtime/lab-run-controller.ts`.
- Download args already consume `youtubeCaptureMode` and `youtubeCustom` fields in `rooms/laboratory/main-functions/media-analysis/host/source-intake-youtube.ts`.
- Existing tests already cover this surface in `scripts/tests/laboratory-source-intake-regressions.test.ts` and store behavior in `scripts/tests/laboratory-store-runtime-regressions.test.ts`.

## Clarification Gate

No blocking questions remain for planning.

Safe assumptions:

- "URL - YouTube import alanı" means the project source import overlay, not the older full-screen `youtube-import-workspace.ts`.
- "Daha detay seçilebilecek kontrol" means exposing the existing room-approved yt-dlp controls from `rooms/laboratory/shared/data/tools/yt-dlp.form.json`.
- Direct URL imports should share the same single-button flow: `Kontrol Et` before a ready check, `Projeye Ekle` after a ready check.
- The post-check details panel should include metadata and download choices together; the separate always-visible details block should be removed or conditionally hidden.
- A successful add should clear the input and post-check panel, while the import progress/completion signal may remain visible if the current UI already keeps it.
- New project creation should reset all project import drafts and YouTube check state, not only the legacy source draft fields.

## Prerequisites

- Preserve unrelated dirty worktree changes. Current workspace already has many modified Laboratory files.
- Work only in source files under `rooms/laboratory` and targeted tests under `scripts/tests`.
- Keep room-local i18n as the main source for visible copy.
- Use `workflow:terminal-mode` while the `sade` profile is active.
- Do not change installed/runtime copies under `data/rooms/laboratory`.

## Sprint 1: State Reset Contract

**Goal**: Make fresh projects and completed adds return the URL importer to check mode with no stale YouTube result panel.

**Demo/Validation**:

- Starting a new project shows an empty URL field.
- No post-check YouTube/download selection panel is visible in a new project.
- After a completed YouTube add, the URL field is empty, the selection panel is hidden, and the primary button says `Kontrol Et`.

### Task 1.1: Add a Full Project Import Reset Path

- **Location**: `rooms/laboratory/models/lab-types.ts`, `rooms/laboratory/runtime/lab-store.ts`
- **Description**: Add a store event or helper that resets `ui.projectImport` to the default import state and resets `ui.youtubeImport` to idle. Prefer a single explicit event such as `project-import-reset` if it keeps reducer intent clear.
- **Complexity**: 4
- **Dependencies**: None
- **Acceptance Criteria**:
  - All media kind drafts reset to `createDefaultSourceDrafts()`.
  - `urlCheck` returns to idle.
  - `lastAction`, `lastRequestId`, and post-check YouTube preview/format selections are cleared.
  - Existing `project-import-cleared` behavior remains available for user-triggered partial clear if still needed.
- **Validation**:
  - Store regression asserts full reset from a ready YouTube state.
  - `npm run rooms:typecheck`

### Task 1.2: Clear Import State When Creating a New Project

- **Location**: `rooms/laboratory/runtime/lab-run-controller.ts`
- **Description**: Update `startCleanProjectSession()` to dispatch the full project import reset before or alongside the existing source draft reset.
- **Complexity**: 3
- **Dependencies**: Task 1.1
- **Acceptance Criteria**:
  - Selecting the `new` project option clears the URL field and checked YouTube result state.
  - Existing source reset and `project-create` host action continue to run.
  - No media host action is sent solely for clearing UI state.
- **Validation**:
  - Controller/source-intake regression covers the new-project reset expectation.

### Task 1.3: Clear Checked State After Completed Add

- **Location**: `rooms/laboratory/runtime/lab-store.ts`
- **Description**: Extend `completeTrackedProjectImport()` so a completed `source-download-youtube` or `source-download-url` clears the active import draft and `ui.youtubeImport`, while preserving the already committed `source` result.
- **Complexity**: 5
- **Dependencies**: Task 1.1
- **Acceptance Criteria**:
  - The committed source remains ready and points to the downloaded file.
  - The URL input and checked result panel are cleared after the matching tracked request completes.
  - The primary URL button returns to check mode.
  - Failed or cancelled imports do not clear the user input.
- **Validation**:
  - Store regression simulates a tracked completed event and asserts reset.
  - Store regression simulates failed/cancelled event and asserts input remains available.

## Sprint 2: Single Primary URL Action

**Goal**: Replace the separate `Kontrol Et` and `Projeye Ekle` buttons with one mode-aware primary button and move `Temizle` next to it.

**Demo/Validation**:

- Idle or error state: one primary button says `Kontrol Et`.
- Checking state: same button says `Kontrol ediliyor` and is disabled.
- Ready state: same button says `Projeye Ekle` and triggers add.
- `Temizle` sits next to the primary button in the URL row.

### Task 2.1: Build URL Primary Action View Model

- **Location**: `rooms/laboratory/ui/project-source-import.ts`
- **Description**: Create a small local helper that derives the primary action, label, disabled reason, and title from `urlCheck.status`, `buildProjectImportUrlCheckAction`, and `buildProjectImportHostAction`.
- **Complexity**: 4
- **Dependencies**: Sprint 1 can run independently.
- **Acceptance Criteria**:
  - `idle` and `error` resolve to `data-lab-action="project-import-check-url"`.
  - `checking` resolves to `project-import-check-url` with disabled state.
  - `ready` resolves to `data-lab-action="project-import-url-add"`.
  - Disabled titles still explain missing URL, missing yt-dlp, or other blocked add reasons.
- **Validation**:
  - Markup tests assert the action and label for idle, checking, ready YouTube, ready direct URL, and missing yt-dlp states.

### Task 2.2: Remove the Second Add Button

- **Location**: `rooms/laboratory/ui/project-source-import.ts`
- **Description**: Replace the current two-button URL row with one primary button plus the moved clear button.
- **Complexity**: 3
- **Dependencies**: Task 2.1
- **Acceptance Criteria**:
  - The URL panel contains no second `project-import-url-add` button.
  - Ready state still exposes the add action through the single primary button.
  - Existing controller action cases can remain because the ready primary button still uses `project-import-url-add`.
- **Validation**:
  - UI regression asserts only one URL primary action button appears.

### Task 2.3: Move Clear Into the URL Row

- **Location**: `rooms/laboratory/ui/project-source-import.ts`, `rooms/laboratory/ui/styles/project-workspace.css`
- **Description**: Render `project-import-clear` next to the primary URL button and remove the footer clear button.
- **Complexity**: 3
- **Dependencies**: Task 2.2
- **Acceptance Criteria**:
  - `Temizle` is adjacent to the URL primary button.
  - Clear remains disabled or visually inert when there is no draft/check value, if the existing disabled pattern supports it.
  - Footer no longer contains a clear button.
  - Mobile layout stacks input, primary action, and clear without overlap.
- **Validation**:
  - Markup regression asserts clear button location by URL-row containment.
  - CSS regression or snapshot assertion covers mobile grid selectors.

## Sprint 3: Post-Check Result Panel

**Goal**: Put all video/download details into the panel that appears only after URL check success, and hide details during checking.

**Demo/Validation**:

- During `Kontrol ediliyor`, no right/detail panel content is shown beyond a compact status.
- After a YouTube check, preview, metadata, stream choices, and download controls appear in one result area.
- After a direct URL check, a compact direct URL success/details area appears.
- The separate persistent detail row no longer duplicates those details.

### Task 3.1: Gate the Post-Check Panel by URL Check Status

- **Location**: `rooms/laboratory/ui/project-source-import.ts`
- **Description**: Ensure `renderYoutubeCheckResult` and direct URL result markup return substantive detail markup only when `urlCheck.status === "ready"`.
- **Complexity**: 3
- **Dependencies**: None
- **Acceptance Criteria**:
  - `checking` returns only the status text, not preview/details controls.
  - `idle` returns no result panel.
  - `error` returns only the error alert.
- **Validation**:
  - UI regression asserts no `.labx-project-import__youtube-result` while checking.

### Task 3.2: Move Details Into the Result Panel

- **Location**: `rooms/laboratory/ui/project-source-import.ts`
- **Description**: Reuse or refactor `renderProjectImportDetails` so its rows render inside the ready result panel instead of as a separate always-visible block.
- **Complexity**: 5
- **Dependencies**: Task 3.1
- **Acceptance Criteria**:
  - Ready YouTube panel contains type, method, name/title, duration, and format count when available.
  - Ready direct URL panel contains type/method/url readiness details.
  - The standalone details block is removed or conditionally hidden in checking/idle states.
  - No duplicated metadata rows appear.
- **Validation**:
  - UI regression asserts details exist inside the ready panel and not outside it.

### Task 3.3: Remove Header Title and Route Label

- **Location**: `rooms/laboratory/ui/project-source-import.ts`
- **Description**: Remove visible header content for `mediaAnalysis.projectImport.title`, `mediaAnalysis.projectImport.eyebrow`, and the route label text.
- **Complexity**: 2
- **Dependencies**: None
- **Acceptance Criteria**:
  - The rendered surface no longer shows `Kaynak Ice Aktarma Calisma Alani`.
  - The rendered surface no longer shows `Video / YouTube`.
  - The section keeps a useful `aria-label`, using i18n if needed, without visible duplicate chrome.
- **Validation**:
  - UI regression asserts these strings are absent.

## Sprint 4: Rich YouTube Download Controls

**Goal**: Replace the current two-list-only YouTube selection with a richer, room-approved yt-dlp control set.

**Demo/Validation**:

- After a successful YouTube check, the panel exposes stream, capture, container, audio, subtitle, and network controls.
- Changing any control updates project import drafts.
- Adding to project uses those fields to build existing yt-dlp args.

### Task 4.1: Add a Project Import yt-dlp Form Renderer

- **Location**: `rooms/laboratory/ui/project-source-import.ts`, `rooms/laboratory/shared/data/tools/yt-dlp.form.json`
- **Description**: Render the allowed controls from the existing form schema, scoped under the ready YouTube result panel. Keep the existing video/audio stream selects, then add fields for capture mode, format strategy, merge output format, recode video, audio format, audio quality, subtitle toggles/language, playlist items, rate limit, and retries.
- **Complexity**: 7
- **Dependencies**: Sprint 3 ready panel structure
- **Acceptance Criteria**:
  - Current video/audio stream selects remain available.
  - Additional controls use existing `youtubeForm` i18n keys.
  - Controls are compact, grouped, and visible only after a ready YouTube check.
  - No controls are shown for direct URL checks.
- **Validation**:
  - Markup regression asserts representative controls and section labels.
  - `npm run rooms:typecheck`

### Task 4.2: Wire New Project Import Fields

- **Location**: `rooms/laboratory/runtime/lab-run-controller.ts`
- **Description**: Extend `buildProjectImportDraftPatch` and field handlers for `project-import.youtubeCaptureMode` and `project-import.youtubeCustom.*` values used by the new controls.
- **Complexity**: 5
- **Dependencies**: Task 4.1
- **Acceptance Criteria**:
  - Select, text, number, and checkbox controls update `ui.projectImport.drafts.video`.
  - URL changes still clear prior check state.
  - Non-URL setting changes do not clear the ready check result.
  - Existing `project-import.youtubeVideoFormat` and `project-import.youtubeAudioFormat` selection events continue to work.
- **Validation**:
  - Controller regression checks field names and dispatch payloads.

### Task 4.3: Respect Capture Mode in Format Expression

- **Location**: `rooms/laboratory/runtime/lab-project-import.ts`
- **Description**: Update the YouTube format selection builder so capture mode influences the final `format` expression and kind.
- **Complexity**: 6
- **Dependencies**: Task 4.2
- **Acceptance Criteria**:
  - `video+audio` can combine selected video and audio IDs.
  - `audio-only` uses the selected audio stream when available and marks source kind as audio.
  - `video-only` uses the selected video stream and avoids forcing an audio stream.
  - Extra `youtubeCustom` fields from the detailed controls are preserved unless intentionally overridden by the stream expression.
- **Validation**:
  - Unit/store helper regression asserts generated host action fields for each capture mode.

### Task 4.4: Style Dense Controls Without Layout Jank

- **Location**: `rooms/laboratory/ui/styles/project-workspace.css`
- **Description**: Add a compact grid for the expanded controls, with stable min widths and mobile stacking.
- **Complexity**: 4
- **Dependencies**: Task 4.1
- **Acceptance Criteria**:
  - Controls do not overflow in desktop or mobile layouts.
  - Labels remain readable and do not collide with buttons.
  - Result panel does not appear as nested cards inside another card beyond existing section framing.
- **Validation**:
  - CSS/markup regression plus manual screenshot smoke if the app is running.

## Sprint 5: Tests and Verification

**Goal**: Lock the new UX contract with targeted tests and type checks.

**Demo/Validation**:

- Targeted regressions pass.
- Room TypeScript passes.
- Manual smoke confirms the URL flow.

### Task 5.1: Update Source Intake UI Regressions

- **Location**: `scripts/tests/laboratory-source-intake-regressions.test.ts`
- **Description**: Update existing assertions around `project-import-check-url`, `project-import-url-add`, details visibility, YouTube format controls, and removed header strings.
- **Complexity**: 5
- **Dependencies**: Sprints 2-4
- **Acceptance Criteria**:
  - Idle state has single primary check button and adjacent clear.
  - Checking state hides result/details controls.
  - Ready YouTube state has one add-mode primary button and rich controls.
  - Header title and route label are absent.
  - Existing local import assertions still pass.
- **Validation**:
  - `npm run rooms:test:file -- scripts/tests/laboratory-source-intake-regressions.test.ts`

### Task 5.2: Update Store Runtime Regressions

- **Location**: `scripts/tests/laboratory-store-runtime-regressions.test.ts`
- **Description**: Add tests for new-project reset, completed add reset, and failed add preserving input.
- **Complexity**: 4
- **Dependencies**: Sprint 1
- **Acceptance Criteria**:
  - Reset contract is covered directly.
  - Completion cleanup does not erase committed source state.
  - Failed/cancelled events keep recoverable user input.
- **Validation**:
  - `npm run rooms:test:file -- scripts/tests/laboratory-store-runtime-regressions.test.ts`

### Task 5.3: Run Final Checks

- **Location**: project root
- **Description**: Run targeted tests first, then room typecheck.
- **Complexity**: 2
- **Dependencies**: Tasks 5.1 and 5.2
- **Acceptance Criteria**:
  - Targeted source-intake regression passes.
  - Targeted store regression passes.
  - Room typecheck passes.
- **Validation**:
  - `npm run rooms:test:file -- scripts/tests/laboratory-source-intake-regressions.test.ts`
  - `npm run rooms:test:file -- scripts/tests/laboratory-store-runtime-regressions.test.ts`
  - `npm run rooms:typecheck`

## Testing Strategy

- Use store tests for state transitions that are easy to regress silently: new project reset, completed add cleanup, failed add recovery.
- Use UI markup tests for the visible contract: title removal, route label removal, single primary button, clear placement, hidden checking details, and ready-only YouTube controls.
- Use controller source tests for field routing because this UI uses string-based `data-lab-field` and `data-lab-action` contracts.
- Use `npm run rooms:typecheck` as the final TypeScript gate.

## Potential Risks & Gotchas

- Existing tests currently expect both `project-import-check-url` and `project-import-url-add` in the same ready markup. Those expectations must change to "single primary button changes action by state."
- Clearing state on completion must not clear the committed `source` object, or the imported media will look like it disappeared.
- If the completion reset also clears `lastRequestId`, the progress panel may stop showing final completion. Decide during implementation whether completion status should stay visible while input resets.
- The existing `buildYoutubeFormatSelectionFields` can override custom audio settings. Capture mode handling needs to be adjusted carefully so new controls actually affect yt-dlp args.
- The `yt-dlp.form.json` schema is data, but the UI currently does not import/render it. Implementation can either import the JSON directly or mirror a small typed descriptor; direct import reduces drift if room bundling supports it.
- Many Laboratory files are already modified in the worktree, so implementation should inspect diffs before editing and avoid overwriting unrelated changes.

## Rollback Plan

- Revert changes in `rooms/laboratory/ui/project-source-import.ts` and `rooms/laboratory/ui/styles/project-workspace.css` to restore the current two-button and two-select UI.
- Revert store/controller changes in `rooms/laboratory/runtime/lab-store.ts`, `rooms/laboratory/runtime/lab-run-controller.ts`, `rooms/laboratory/runtime/lab-project-import.ts`, and any model event additions.
- Revert test expectation changes in `scripts/tests/laboratory-source-intake-regressions.test.ts` and `scripts/tests/laboratory-store-runtime-regressions.test.ts`.
- No installed room copy rollback is needed if `data/rooms/laboratory` is left untouched.

## Review Note

Sub-agent review was not run because the active tool policy only allows spawning agents when the user explicitly asks for delegation. The plan includes the review-sensitive gotchas inline, especially around completion cleanup and yt-dlp field propagation.
