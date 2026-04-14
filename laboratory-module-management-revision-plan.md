# Plan: Laboratory Module Management Revision

**Generated**: 2026-04-14
**Estimated Complexity**: High

## Overview
This revision reshapes the current Dependency Center into a cleaner Module Management surface with explicit user-driven refresh and update controls, a denser single-column tool list, a simplified left rail, and fully separated Turkish and English copy. The plan treats the recurring loading/refresh issue as a first-class bug, then rebuilds the overlay information architecture around three stable concerns: module selection, active operations, and per-module maintenance.

## Assumptions
- "Modul" in this plan refers to room-managed tool cards in the right panel. Existing profile model cards remain in scope for copy cleanup and action audit if they share the same surface.
- "Araclari Yenile" will remain as a probe-only refresh action. It should not perform release/update lookups.
- "Guncellemeleri kontrol et" means "check release/update availability for one installed tool" rather than immediately running the update.
- "Modulleri guncelle" means "run update/install mutation for all installed and update-eligible tools", executed in a controlled host-side sequence and surfaced in Active Operations.
- The repeated overlay/loading effect is caused at least in part by the current automatic `tools-refresh` dispatch when the overlay opens. Any additional periodic trigger discovered during implementation will be removed under the same sprint.

## Prerequisites
- Current Laboratory settings overlay implementation in:
  - `rooms/laboratory/shared/ui/settings-overlay.ts`
  - `rooms/laboratory/shared/ui/settings-tool-card.ts`
  - `rooms/laboratory/shared/ui/settings-profile-model.ts`
- Host action pipeline for tool probing and mutation in:
  - `rooms/laboratory/shared/host/project-tool-status.ts`
  - `rooms/laboratory/shared/host/tool-mutations.ts`
  - `rooms/laboratory/shared/host/action-router.ts`
  - `rooms/laboratory/main-functions/media-analysis/host/action-handlers-project.ts`
- Overlay and panel styling in:
  - `rooms/laboratory/shared/styles/components/overlay.css`
  - `rooms/laboratory/shared/styles/components/panels.css`
  - `rooms/laboratory/shared/styles/responsive.css`
- Locale sources in:
  - `rooms/laboratory/i18n/tr.json`
  - `rooms/laboratory/i18n/en.json`

## Sprint 1: Stabilize Refresh and Update Control Contract
**Goal**: Stop unintended refresh/check cycles and define explicit actions for probe refresh, per-tool update check, and bulk update.
**Demo/Validation**:
- Open Module Management and verify it no longer auto-dispatches a refresh/update action on open.
- Leave the overlay open for at least 20-30 seconds and confirm no repeated loading/probe cycle is triggered.
- Trigger explicit refresh, single-tool update check, and bulk update flows from buttons only.

### Task 1.1: Remove automatic refresh on overlay open
- **Location**: `rooms/laboratory/shared/ui/request-runtime.ts`
- **Description**: Remove the automatic `sendSourceAction("tools-refresh", {})` call from `openSettingsOverlay()` so the overlay becomes passive until the user chooses a control.
- **Complexity**: 3/10
- **Dependencies**: None
- **Acceptance Criteria**:
  - Opening the overlay no longer triggers tool refresh by itself.
  - Overlay animation/render remains intact after the auto-refresh removal.
- **Validation**:
  - Manual open/close smoke test.
  - Confirm no `tools-refresh` request fires from `open-settings`.

### Task 1.2: Split probe refresh from update lookup semantics
- **Location**:
  - `rooms/laboratory/shared/host/project-tool-status.ts`
  - `rooms/laboratory/main-functions/media-analysis/host/action-handlers-project.ts`
  - `rooms/laboratory/shared/host/action-router.ts`
- **Description**: Separate "probe installed state" from "check release/update availability". Keep `tools-refresh` as probe-only. Add a dedicated host action for per-tool update check and a separate bulk update action contract.
- **Complexity**: 8/10
- **Dependencies**: Task 1.1
- **Acceptance Criteria**:
  - Probe refresh does not run release lookup logic.
  - A single installed tool can request update availability explicitly.
  - A top-level bulk action exists for installed tools.
- **Validation**:
  - Unit/host smoke around `refreshToolStatus(..., { checkUpdates: false })`.
  - Manual verification that update metadata changes only after explicit check/update actions.

### Task 1.3: Add UI actions for single-tool update check and bulk update
- **Location**:
  - `rooms/laboratory/shared/ui/action-router-actions.ts`
  - `rooms/laboratory/shared/ui/request-runtime.ts`
  - `rooms/laboratory/shared/ui/settings-tool-card.ts`
  - `rooms/laboratory/shared/ui/settings-overlay.ts`
- **Description**: Add new UI actions for `tool-check-updates` and `tools-update-all`, wire them into the request pipeline, and ensure only these controls can trigger update lookups or bulk updates.
- **Complexity**: 7/10
- **Dependencies**: Task 1.2
- **Acceptance Criteria**:
  - Installed tool cards show a "check for updates" CTA.
  - Header shows a "Modulleri Guncelle" CTA next to refresh.
  - No hidden or automatic UI path still triggers update lookup.
- **Validation**:
  - Action routing smoke for each new action.
  - Grep audit for `tools-refresh` and update-check entry points.

### Task 1.4: Route tool/update jobs into Active Operations only
- **Location**:
  - `rooms/laboratory/shared/host/tool-mutations.ts`
  - `rooms/laboratory/shared/ui/settings-overlay.ts`
  - `rooms/laboratory/shared/host/runtime-events.ts`
- **Description**: Ensure update checks and bulk update flows produce visible job state in Active Operations and do not depend on unrelated loading overlays for feedback.
- **Complexity**: 6/10
- **Dependencies**: Tasks 1.2-1.3
- **Acceptance Criteria**:
  - Update checks surface as visible operations.
  - Bulk update progress appears in the left-side operations panel.
  - The overlay does not fall back to generic loading state for these actions.
- **Validation**:
  - Manual run with one per-tool check and one bulk update.
  - Verify operations feed entries appear and retire correctly.

## Sprint 2: Rebuild Overlay Information Architecture
**Goal**: Turn Dependency Center into a cleaner Module Management overlay with a simplified header, reordered left rail, and single-column right content.
**Demo/Validation**:
- Overlay title reads "Modul Yonetimi" in Turkish and "Module Management" in English.
- Left rail starts with module controls, ends with an operations panel that can scroll independently.
- Right panel shows one continuous tool column without the current inventory overview block.

### Task 2.1: Rename the overlay and remove header copy clutter
- **Location**:
  - `rooms/laboratory/shared/ui/settings-overlay.ts`
  - `rooms/laboratory/i18n/tr.json`
  - `rooms/laboratory/i18n/en.json`
- **Description**: Replace Dependency Center labels with Module Management labels, remove the eyebrow/subtitle copy requested by the user, and add the new top-level bulk update button copy.
- **Complexity**: 4/10
- **Dependencies**: None
- **Acceptance Criteria**:
  - Header shows only the requested title and actions.
  - Turkish and English titles are clean and non-mixed.
- **Validation**:
  - Locale smoke in both `tr` and `en`.

### Task 2.2: Remove readiness and tool inventory overview panels
- **Location**: `rooms/laboratory/shared/ui/settings-overlay.ts`
- **Description**: Remove the left-side readiness summary card and the right-side top inventory overview ("Arac envanteri") block.
- **Complexity**: 4/10
- **Dependencies**: Task 2.1
- **Acceptance Criteria**:
  - Readiness panel is gone.
  - Tool inventory overview block is gone.
  - Layout still balances left rail and right content without dead space.
- **Validation**:
  - Visual smoke in overlay desktop layout.

### Task 2.3: Move module controls to the top-left and compress them into single-line rows
- **Location**:
  - `rooms/laboratory/shared/ui/settings-overlay.ts`
  - `rooms/laboratory/shared/styles/components/panels.css`
  - `rooms/laboratory/shared/styles/responsive.css`
  - `rooms/laboratory/i18n/tr.json`
  - `rooms/laboratory/i18n/en.json`
- **Description**: Move module include/exclude controls to the top of the left column. Convert each module card into a single-line layout: module title on the left, actions on the right. Remove helper copy like "Aktif modulu sec" and "Odakla".
- **Complexity**: 6/10
- **Dependencies**: Task 2.2
- **Acceptance Criteria**:
  - Module control block appears first in the left rail.
  - Each module row reads as `title - buttons` in one line on desktop.
  - Unwanted helper/status copy is removed.
- **Validation**:
  - Visual check with 2+ modules selected/unselected.
  - Responsive check on narrow width.

### Task 2.4: Make Active Operations fill the remaining left-column height
- **Location**:
  - `rooms/laboratory/shared/ui/settings-overlay.ts`
  - `rooms/laboratory/shared/styles/components/panels.css`
  - `rooms/laboratory/shared/styles/components/overlay.css`
  - `rooms/laboratory/shared/styles/responsive.css`
- **Description**: Make the operations panel consume the remaining left-rail height and scroll internally when content grows. Rename/shorten its copy per request.
- **Complexity**: 7/10
- **Dependencies**: Tasks 2.2-2.3
- **Acceptance Criteria**:
  - "Canli operasyonlar" title is removed.
  - Empty state reads "Aktif islem yok" in Turkish and a fully English equivalent in English.
  - Long operation lists scroll inside the panel instead of escaping the overlay.
- **Validation**:
  - Manual visual check with empty operations and populated operations.
  - Confirm no overlay-height overflow in desktop viewport.

### Task 2.5: Collapse the right content into a single tool column
- **Location**:
  - `rooms/laboratory/shared/ui/settings-overlay.ts`
  - `rooms/laboratory/shared/styles/components/panels.css`
  - `rooms/laboratory/shared/styles/responsive.css`
- **Description**: Flatten the right side into one vertical tool stream instead of summary + auto/manual splits. Keep the card stack dense and scan-friendly.
- **Complexity**: 6/10
- **Dependencies**: Task 2.2
- **Acceptance Criteria**:
  - Tools render in one vertical column.
  - Auto/manual grouping is either removed or converted into lightweight section dividers without two-column layout behavior.
  - Card spacing stays consistent with the rest of Laboratory.
- **Validation**:
  - Visual smoke with all tools present.

## Sprint 3: Correct Tool Card Behavior and Helper UX
**Goal**: Make tool CTAs match real tool state, remove stage-support noise, and simplify the manual helper.
**Demo/Validation**:
- Installed tools no longer show "Unsupported" just because the active stage does not use them.
- Stage-support rows disappear from tool cards.
- Manual helper opens only for not-installed manual tools and shows a reduced Linux/Windows-only layout.

### Task 3.1: Remove stage-support row and decouple CTA logic from stage support
- **Location**:
  - `rooms/laboratory/shared/ui/settings-tool-card.ts`
  - `rooms/laboratory/shared/ui/source-snapshot-tool-selectors.ts`
  - `rooms/laboratory/i18n/tr.json`
  - `rooms/laboratory/i18n/en.json`
- **Description**: Stop using active-stage support as the primary CTA gate. Remove the "Asama destegi" summary row and compute action buttons from install strategy + installed state + availability instead.
- **Complexity**: 7/10
- **Dependencies**: Sprint 2 layout tasks
- **Acceptance Criteria**:
  - Installed tools show update-check CTA regardless of active stage.
  - Stage support no longer renders as a summary row.
  - Unsupported/planned tools still display a clear non-actionable state when truly unsupported or planned.
- **Validation**:
  - Visual comparison for installed automatic tools, installed manual tools, missing manual tools, and planned tools.

### Task 3.2: Replace installed manual/helper button behavior
- **Location**:
  - `rooms/laboratory/shared/ui/settings-tool-card.ts`
  - `rooms/laboratory/shared/ui/action-router-actions.ts`
  - `rooms/laboratory/shared/ui/request-runtime.ts`
- **Description**: Make the helper toggle passive/disabled for installed manual tools. For installed tools, primary CTA becomes "Guncellemeleri kontrol et". For missing manual tools, helper remains available.
- **Complexity**: 6/10
- **Dependencies**: Task 3.1, Sprint 1 action contract
- **Acceptance Criteria**:
  - Installed manual tools do not expose a live helper toggle as their main action.
  - Installed tools expose update-check instead of unsupported/manual-refresh wording.
  - Missing manual tools still allow helper access.
- **Validation**:
  - Manual UI state matrix for installed vs missing manual/system-command tools.

### Task 3.3: Simplify the helper content and remove macOS branch
- **Location**:
  - `rooms/laboratory/shared/ui/settings-tool-card.ts`
  - `rooms/laboratory/shared/styles/components/panels.css`
  - `rooms/laboratory/shared/styles/responsive.css`
  - `rooms/laboratory/i18n/tr.json`
  - `rooms/laboratory/i18n/en.json`
- **Description**: Remove the requested helper blocks: "Kurulum Yardimcisi", "Host beklentisi", "Kurulumdan sonra", and the commands hint sentence. Keep only the essential command area plus Linux/Windows platform buttons, sized so labels never overflow.
- **Complexity**: 7/10
- **Dependencies**: Task 3.2
- **Acceptance Criteria**:
  - macOS button and macOS helper content are removed.
  - Linux and Windows buttons expand cleanly without text overflow.
  - Helper copy is materially shorter and no longer repeats removed diagnostic/meta sections.
- **Validation**:
  - Visual smoke for at least one manual tool with helper open.
  - Narrow-width check for code block wrapping and button widths.

### Task 3.4: Add header-level bulk update control
- **Location**:
  - `rooms/laboratory/shared/ui/settings-overlay.ts`
  - `rooms/laboratory/shared/ui/action-router-actions.ts`
  - `rooms/laboratory/shared/ui/request-runtime.ts`
  - `rooms/laboratory/i18n/tr.json`
  - `rooms/laboratory/i18n/en.json`
- **Description**: Add the "Modulleri Guncelle" button to the left of "Araclari Yenile" and wire it to the bulk update host action.
- **Complexity**: 5/10
- **Dependencies**: Sprint 1 bulk action contract
- **Acceptance Criteria**:
  - Button renders in header in both locales.
  - Disabled/busy behavior is coherent while bulk update is running.
- **Validation**:
  - Manual click flow and job feed smoke.

## Sprint 4: Full Locale Separation and Data-Copy Cleanup
**Goal**: Remove mixed-language descriptor content and ensure the overlay reads as fully Turkish or fully English.
**Demo/Validation**:
- Turkish overlay contains no English helper/body text.
- English overlay contains no Turkish remnants.
- Tool/helper explanatory text remains available after moving away from raw manifest strings.

### Task 4.1: Audit and externalize mixed descriptor copy
- **Location**:
  - `rooms/laboratory/shared/data/tools/toolchain.manifest.json`
  - `rooms/laboratory/shared/host/room-snapshot.ts`
  - `rooms/laboratory/i18n/tr.json`
  - `rooms/laboratory/i18n/en.json`
- **Description**: Replace raw English manifest prose used in `setupHint`, `readinessImpact`, `usedBy`, `testImpact`, and helper notes with locale-safe keys or per-locale descriptor maps so tool cards do not mix languages.
- **Complexity**: 9/10
- **Dependencies**: Sprint 2 and 3 structure tasks
- **Acceptance Criteria**:
  - Tool descriptor prose shown in the overlay resolves through locale-aware copy.
  - Turkish and English surfaces are each internally consistent.
- **Validation**:
  - Grep audit for visible English strings still sourced directly from manifest into Turkish UI.
  - Manual compare of `tr` and `en` overlay screenshots.

### Task 4.2: Update overlay/module/operations copy to match the new IA
- **Location**:
  - `rooms/laboratory/i18n/tr.json`
  - `rooms/laboratory/i18n/en.json`
  - `rooms/laboratory/shared/ui/settings-overlay.ts`
  - `rooms/laboratory/shared/ui/settings-tool-card.ts`
  - `rooms/laboratory/shared/ui/settings-profile-model.ts`
- **Description**: Rename all leftover dependency/readiness/tool-room phrasing to module-management language and shorten/remove the lines requested by the user.
- **Complexity**: 6/10
- **Dependencies**: Task 4.1
- **Acceptance Criteria**:
  - No user-facing copy still says "Bagimlilik Merkezi" or the removed descriptive subtitle.
  - Left and right column labels match the new layout and wording.
- **Validation**:
  - Locale smoke in both languages.
  - Grep audit for stale strings.

## Sprint 5: Bulk Update Orchestration and Regression Pass
**Goal**: Finalize the host-side bulk update path and verify the overlay behaves predictably across states.
**Demo/Validation**:
- Bulk update runs installed tools in a deterministic order and reports progress in Active Operations.
- Single-tool update check, refresh, install, and helper flows all still work.
- No automatic update checks happen on overlay open or idle.

### Task 5.1: Implement host-side bulk update sequencing
- **Location**:
  - `rooms/laboratory/shared/host/tool-mutations.ts`
  - `rooms/laboratory/shared/host/action-router.ts`
  - `rooms/laboratory/main-functions/media-analysis/host/action-handlers-project.ts`
- **Description**: Add a bulk-update mutation path that iterates installed/update-eligible tools sequentially, emits job progress, and refreshes dependent state when needed.
- **Complexity**: 8/10
- **Dependencies**: Sprint 1 and Task 3.4
- **Acceptance Criteria**:
  - Bulk update skips non-installed or ineligible tools.
  - Jobs appear sequentially and leave the tool registry in a refreshed state.
  - Whisper/profile-model side effects still refresh profile model state correctly.
- **Validation**:
  - Host smoke with mixed installed/manual/automatic tools.
  - Confirm tool state persistence after completion/failure.

### Task 5.2: Verify operations panel coverage for all maintenance flows
- **Location**:
  - `rooms/laboratory/shared/ui/settings-overlay.ts`
  - `rooms/laboratory/shared/host/runtime-events.ts`
  - `rooms/laboratory/shared/ui/host-messages.ts`
- **Description**: Ensure refreshes, update checks, installs, and bulk updates are all represented in Active Operations with stable labels and non-overflowing rows.
- **Complexity**: 5/10
- **Dependencies**: Task 5.1
- **Acceptance Criteria**:
  - Operation rows are visible, scrollable, and readable for each maintenance action.
  - No separate loading overlay is needed for maintenance feedback.
- **Validation**:
  - Manual action matrix for refresh / check updates / install / bulk update.

### Task 5.3: Regression and cleanup pass
- **Location**:
  - `rooms/laboratory/shared/ui/settings-overlay.ts`
  - `rooms/laboratory/shared/ui/settings-tool-card.ts`
  - `rooms/laboratory/shared/ui/settings-profile-model.ts`
  - `rooms/laboratory/shared/styles/components/overlay.css`
  - `rooms/laboratory/shared/styles/components/panels.css`
  - `rooms/laboratory/shared/styles/responsive.css`
  - `rooms/laboratory/i18n/tr.json`
  - `rooms/laboratory/i18n/en.json`
- **Description**: Remove dead copy/branches left behind by the old Dependency Center structure and run a final responsive and locale sweep.
- **Complexity**: 4/10
- **Dependencies**: Prior sprints
- **Acceptance Criteria**:
  - No dead readiness/inventory/helper blocks remain.
  - Desktop and reduced-width layouts stay readable.
  - Overlay title, buttons, and helper copy align with the final IA.
- **Validation**:
  - `npm run typecheck`
  - Targeted syntax checks for modified TS/CSS files
  - Manual desktop/narrow overlay smoke

## Testing Strategy
- Static validation:
  - `npm run typecheck`
  - Syntax checks for all modified TS and CSS files
- UI behavior validation:
  - Open overlay in Turkish and English
  - Verify no automatic refresh/update occurs on open or idle
  - Verify left rail order: module controls -> operations
  - Verify operations panel internal scroll
  - Verify right column single-stack tool list
- Action matrix:
  - Refresh tools
  - Check updates for one installed tool
  - Bulk update installed tools
  - Open helper for a missing manual tool
  - Verify helper disabled/passive for installed manual tool
- Localization validation:
  - Grep for stale Dependency Center copy
  - Grep for raw English helper/readiness prose shown in Turkish path

## Potential Risks & Gotchas
- The current repeated loading symptom may have more than one trigger. The known trigger is `openSettingsOverlay()` dispatching `tools-refresh`, but implementation should also audit any hidden refresh paths before closing the bug.
- Tool descriptor prose is currently sourced from raw manifest fields. Full locale separation may require a broader data-shape change instead of simple string replacement.
- CTA logic currently conflates stage support with install/update eligibility. Untangling this without breaking planned/unsupported tool states is the main behavioral risk.
- Bulk update needs strict sequencing and good cancellation/error handling so one failed tool does not leave the operations feed or busy flags in a broken state.
- The left-column "fill remaining height and scroll internally" requirement depends on overlay height, sticky header offsets, and sidebar sizing. This needs desktop and reduced-height viewport smoke tests, not only type checks.
- Profile model cards share some dependency copy and tool state. If the overlay still includes model cards, their copy path must be audited too so the locale split remains complete.

## Rollback Plan
- Revert overlay layout changes first:
  - `rooms/laboratory/shared/ui/settings-overlay.ts`
  - `rooms/laboratory/shared/styles/components/panels.css`
  - `rooms/laboratory/shared/styles/components/overlay.css`
  - `rooms/laboratory/shared/styles/responsive.css`
- Revert action-contract changes second:
  - `rooms/laboratory/shared/ui/action-router-actions.ts`
  - `rooms/laboratory/shared/ui/request-runtime.ts`
  - `rooms/laboratory/shared/host/action-router.ts`
  - `rooms/laboratory/main-functions/media-analysis/host/action-handlers-project.ts`
  - `rooms/laboratory/shared/host/project-tool-status.ts`
  - `rooms/laboratory/shared/host/tool-mutations.ts`
- Revert locale/data changes last:
  - `rooms/laboratory/i18n/tr.json`
  - `rooms/laboratory/i18n/en.json`
  - `rooms/laboratory/shared/data/tools/toolchain.manifest.json`
  - `rooms/laboratory/shared/host/room-snapshot.ts`
