# Plan: Laboratory Project Workspace Source Intake Consolidation

**Generated**: 2026-04-29
**Estimated Complexity**: High

## Overview

The Laboratory Project Workspace currently spreads source import across two mental models:

- `renderSourceIntake` is embedded inside the left project navigation column.
- YouTube import is a separate `labMode="import-youtube"` full-screen override.

The target design is a single Project Workspace flow:

- Left panel: saved projects only.
- Center top: unified source import workspace with `Video`, `Sound`, and `Image` tabs.
- Center bottom: source-first project list. Reuse the existing entity grid if practical, but default it to source-like media (`source`, `clip`, `audio`, `image`, `frame`) rather than making reports/artifacts the primary view.
- Right panel: import preview, imported file details, and progress. When no import is active, it can fall back to selected asset inspection.
- Import footer: only `Clear` and `Add` actions.

Recommended layout:

```text
Project Workspace
+---------------+-----------------------------------------+-------------------+
| Projects      | Source Import Workspace                 | Import Review     |
|               | [Video] [Sound] [Image]                 | Preview           |
| saved list    | method cards + fields + strategy        | Details           |
| new/delete    | footer: Clear | Add                     | Progress          |
|               +-----------------------------------------+ or Asset Inspector|
|               | Source-first media list                 |                   |
+---------------+-----------------------------------------+-------------------+
```

## Prerequisites

- Current branch is expected to include Phase 3 YouTube strategy work.
- No new backend import execution is required for the first implementation pass; reuse existing host actions:
  - `source-pick-local`
  - `source-download-url`
  - `source-download-youtube`
- Existing source preset config remains the source of truth:
  - `rooms/laboratory/shared/data/tools/source-presets.json`
- Existing import progress should continue to come from `sourceProbeStatus` and `activityFeed`.
- `Add` must use the new import draft route, not the currently committed `source.kind` or `source.mode`.

## Safe Assumptions

- The label should evolve from YouTube-only to a generic `Source Import Workspace` / `Kaynak Ice Aktarma Calisma Alani`.
- Video supports `YouTube`, `Local`, and `Direct URL`.
- Sound supports `Local` and `Direct URL`.
- Image supports `Local` and `Direct URL`.
- Selecting a tab or method should not replace the active project source until the user clicks `Add`.
- The existing `import-youtube` full-screen mode can stay as a temporary compatibility route, but no Project Workspace control should enter it after this migration.
- Asset-level actions currently in the bottom context bar should move into the right inspector so the import footer can stay focused on `Clear` and `Add`.
- The center-bottom "sources" request means a source-first media list. Reports and generated artifacts can remain accessible through filters or inspector context, but the default list should prioritize imported media.

## YouTube Strategy To Host Payload Mapping

The embedded YouTube method should keep Phase 3 strategy cards, but `Add` must translate them into the existing host payload shape.

| Strategy | Draft/UI meaning | Host payload mapping |
| --- | --- | --- |
| `video_best` | Best Quality | `youtubePreset: "best"`, `youtubeCaptureMode: "video+audio"`, preset defaults from `source-presets.json` |
| `audio_only` | Audio Only | `youtubePreset: "custom"`, `youtubeCaptureMode: "audio-only"`, `youtubeCustom.audioFormat: "mp3"` or user-selected audio format, no video-only format override |
| `low_size` | Small Size | `youtubePreset: "low"`, `youtubeCaptureMode: "video+audio"`, low preset defaults |
| `custom` | Advanced | `youtubePreset: "custom"`, `youtubeCaptureMode` and `youtubeCustom` derived from visible advanced controls |

## Sprint 1: Import Layout Contract

**Goal**: Define the new workspace ownership model without changing backend behavior.

**Demo/Validation**:
- Project Workspace opens with left navigation, center content, and right panel responsibilities clearly represented in tests.
- No source import action is triggered by simply switching tabs or methods.
- `project-import-add` can be tested without mutating committed source mode first.

### Task 1.1: Define Project Import Route Contract

- **Location**:
  - `rooms/laboratory/models/lab-types.ts`
  - `rooms/laboratory/runtime/lab-selectors.ts`
  - `rooms/laboratory/runtime/lab-run-controller.ts`
- **Description**: Define the draft route contract before rendering UI. The contract should include active media kind, method per kind, draft field ownership, right-panel focus state, request/progress correlation, and a draft-to-host payload builder.
- **Complexity**: 8
- **Dependencies**: None
- **Acceptance Criteria**:
  - `project-import-add` builds host actions from import draft state, never from committed `source.mode`.
  - `project-import-clear` has route-aware semantics for fields, preview, strategy/custom settings, and progress focus.
  - Progress can be correlated to the active route by action key and, if available, request/job id.
  - The draft-to-host payload builder is unit-testable without DOM rendering.
- **Validation**:
  - Selector/helper tests for route defaults and payload building.
  - Controller regression proving Add works when committed source mode differs from draft method.

### Task 1.2: Add Project Import UI State

- **Location**:
  - `rooms/laboratory/models/lab-types.ts`
  - `rooms/laboratory/runtime/lab-store.ts`
- **Description**: Add a UI-only import draft state, separate from committed source config. Suggested shape:
  - active kind: `video | audio | image`
  - method per kind: `youtube | local | url`
  - draft fields compatible with existing `LabSourceDrafts`
  - embedded YouTube substate or adapter for Phase 3 strategy/preview
  - active preview/progress focus marker
- **Complexity**: 7
- **Dependencies**: Task 1.1
- **Acceptance Criteria**:
  - Tab/method selection is stored in UI state.
  - Active project source is not cleared by tab/method selection alone.
  - Defaults are derived from `source-presets.json`.
  - Project import state is the source of truth for the embedded YouTube route; `sourceDrafts` is only a host-payload compatibility surface.
  - Existing `ui.youtubeImport` is either migrated under project import state or explicitly treated as the deprecated full-screen compatibility state.
- **Validation**:
  - Store regression for tab switching preserving current source.
  - Hydration regression for sane defaults when persisted state is missing.
  - State ownership regression proving embedded YouTube edits do not drift from Add payloads.

### Task 1.3: Define Import Method Availability

- **Location**:
  - `rooms/laboratory/runtime/lab-selectors.ts`
  - `rooms/laboratory/ui/workspace-surface.ts` or a new import helper module
- **Description**: Centralize kind/method availability so UI and controller use the same rules from source presets.
- **Complexity**: 4
- **Dependencies**: Task 1.2
- **Acceptance Criteria**:
  - Video renders YouTube/local/url when configured.
  - Sound and image do not render YouTube unless presets later add it.
  - Missing config falls back to safe defaults.
- **Validation**:
  - Unit tests around preset-derived method availability.

### Task 1.4: Preserve Existing Source Draft Compatibility

- **Location**:
  - `rooms/laboratory/runtime/lab-store.ts`
  - `rooms/laboratory/ui/lab-root.ts`
- **Description**: Keep existing `sourceDrafts` persistence working while the new import UI state becomes the route owner.
- **Complexity**: 6
- **Dependencies**: Task 1.2
- **Acceptance Criteria**:
  - Existing saved projects hydrate without losing draft fields.
  - `sourceDrafts` remains compatible with host source actions.
  - YouTube strategy state does not leak into persisted project source unless explicitly committed.
- **Validation**:
  - Persistence regression test.

## Sprint 2: Project Workspace Recomposition

**Goal**: Move source import out of the left panel and into the center top of the Project Workspace.

**Demo/Validation**:
- Left panel contains only projects and project actions.
- Center panel contains import workspace above a source-first media list.
- Existing entity grid behavior remains reachable through filters or secondary grouping where needed.

### Task 2.1: Remove Source Intake From Project Navigation

- **Location**:
  - `rooms/laboratory/ui/project-navigation.ts`
  - `rooms/laboratory/ui/styles/project-workspace.css`
- **Description**: Remove `renderSourceIntake` from the nav column and simplify left column styles.
- **Complexity**: 3
- **Dependencies**: Sprint 1
- **Acceptance Criteria**:
  - `.labx-pw-nav__intake` is gone from rendered markup.
  - Project list gets the reclaimed vertical space.
- **Validation**:
  - Update `laboratory-project-workspace-regressions.test.ts`.

### Task 2.2: Add Center Import Region Above Asset Grid

- **Location**:
  - `rooms/laboratory/ui/project-workspace-overlay.ts`
  - new `rooms/laboratory/ui/project-source-import.ts`
  - `rooms/laboratory/ui/asset-grid.ts`
- **Description**: Compose center content as import region plus a source-first media list instead of rendering asset grid alone. The current asset grid can be reused, but its default Project Workspace mode should prioritize imported media sources over reports/artifacts.
- **Complexity**: 6
- **Dependencies**: Task 2.1
- **Acceptance Criteria**:
  - Import panel is above the asset list.
  - Source/media toolbar and list remain below and scroll independently when needed.
  - Reports/artifacts remain reachable without dominating the default list.
  - Hypothesis stays with analysis workspace, not inside import controls, unless intentionally retained above the list.
- **Validation**:
  - Markup regression for import-above-grid ordering.
  - CSS regression for grid area names.

### Task 2.3: Add Video/Sound/Image Tabs

- **Location**:
  - `rooms/laboratory/ui/project-source-import.ts`
  - `rooms/laboratory/runtime/lab-run-controller.ts`
  - `rooms/laboratory/i18n/en.json`
  - `rooms/laboratory/i18n/tr.json`
- **Description**: Render tab buttons for media kind selection and wire them to UI state.
- **Complexity**: 5
- **Dependencies**: Task 2.2
- **Acceptance Criteria**:
  - Active tab is visible and keyboard reachable.
  - Tab switch updates import draft only.
  - Labels are localized.
- **Validation**:
  - Controller click regression.
  - UI markup/i18n regression.

### Task 2.4: Convert Import Method Controls To Cards

- **Location**:
  - `rooms/laboratory/ui/project-source-import.ts`
  - `rooms/laboratory/ui/styles/project-workspace.css`
- **Description**: Replace source type/method dropdown pairing with method cards inside the active media tab.
- **Complexity**: 6
- **Dependencies**: Task 2.3
- **Acceptance Criteria**:
  - The UI no longer feels like a dropdown-first import flow.
  - Method cards expose local/url/youtube options based on active tab.
  - Disabled YouTube clearly explains missing `yt-dlp`.
- **Validation**:
  - UI regression proving method cards exist and old route dropdown is absent from Project Workspace.

## Sprint 3: Unified Import Panel Content

**Goal**: Give each tab its own import options while sharing one coherent panel.

**Demo/Validation**:
- Video tab can choose YouTube/local/url.
- Sound tab can choose local/url.
- Image tab can choose local/url.
- Footer always shows only `Clear` and `Add`.

### Task 3.1: Implement Local Import Fields

- **Location**:
  - `rooms/laboratory/ui/project-source-import.ts`
  - `rooms/laboratory/runtime/lab-run-controller.ts`
- **Description**: Render local import controls for active media kind with filename hint and a clear call-to-action.
- **Complexity**: 4
- **Dependencies**: Sprint 2
- **Acceptance Criteria**:
  - Local method does not require URL.
  - Add dispatches existing local source action with current draft.
  - Clear resets only the import draft, not project assets.
- **Validation**:
  - Controller regression for local Add/Clear.

### Task 3.2: Implement Direct URL Fields

- **Location**:
  - `rooms/laboratory/ui/project-source-import.ts`
  - `rooms/laboratory/runtime/lab-run-controller.ts`
- **Description**: Render URL and filename fields for direct URL import.
- **Complexity**: 4
- **Dependencies**: Sprint 2
- **Acceptance Criteria**:
  - Add is disabled when URL is blank.
  - URL draft survives switching away and back to the same tab/method.
  - Active project source is not changed until Add.
- **Validation**:
  - Store/controller regression for draft preservation and disabled Add.

### Task 3.3: Embed YouTube Strategy System In Video Tab

- **Location**:
  - `rooms/laboratory/ui/project-source-import.ts`
  - `rooms/laboratory/ui/youtube-import-workspace.ts`
  - `rooms/laboratory/runtime/lab-run-controller.ts`
- **Description**: Reuse or extract Phase 3 strategy-card rendering so YouTube appears as a video import method inside Project Workspace.
- **Complexity**: 8
- **Dependencies**: Sprint 2
- **Acceptance Criteria**:
  - Selecting YouTube no longer enters full-screen `import-youtube` from the Project Workspace flow.
  - YouTube URL parse/preview works while `state.ui.labMode` remains `normal` and `projectWorkspaceOpen` remains true.
  - No Project Workspace control dispatches `enter-youtube-import-mode`.
  - Strategy selection updates summary/CTA context inside the import panel.
  - Custom strategy still reveals advanced controls.
  - Existing YouTube parse preview continues to work.
- **Validation**:
  - Update tests that currently expect `source.mode=youtube` to switch to `import-only`.
  - Add regression that Project Workspace remains open while YouTube strategy changes.

### Task 3.4: Normalize Import Footer Actions

- **Location**:
  - `rooms/laboratory/ui/project-source-import.ts`
  - `rooms/laboratory/runtime/lab-run-controller.ts`
- **Description**: Add import footer with only `Clear` and `Add`. Move any unrelated selected-asset actions out of the global bottom bar and into the right inspector.
- **Complexity**: 6
- **Dependencies**: Tasks 3.1-3.3
- **Acceptance Criteria**:
  - Import footer never shows secondary analysis/download/send actions.
  - `Clear` resets only the active tab/method draft fields.
  - `Clear` cancels pending YouTube parse timers and clears YouTube preview/status for the active YouTube route.
  - `Clear` does not delete project assets, active source, selected asset ids, or completed host activity history.
  - `Clear` drops active import review focus back to selected asset inspector when no draft/progress remains.
  - `Add` maps to existing host source action for active kind/method.
- **Validation**:
  - UI regression for footer button count and labels.
  - Controller regression for Clear/Add payloads.

## Sprint 4: Right Panel Import Review

**Goal**: Make the right panel the decision and feedback surface for imports.

**Demo/Validation**:
- While drafting, right panel previews expected import route.
- While importing, right panel shows progress.
- After import, right panel shows imported file details.
- When an existing asset is selected and no import is active, right panel still works as asset inspector.

### Task 4.1: Add Import Review Renderer

- **Location**:
  - new `rooms/laboratory/ui/project-import-review.ts`
  - `rooms/laboratory/ui/project-workspace-overlay.ts`
  - `rooms/laboratory/ui/asset-inspector.ts`
- **Description**: Introduce a right-panel renderer that chooses between import review and asset inspector. Priority order must be explicit: running import > edited draft focus > completed import summary > selected asset inspector > empty guidance.
- **Complexity**: 7
- **Dependencies**: Sprint 3
- **Acceptance Criteria**:
  - Draft import state shows selected kind/method, filename, URL, and strategy summary where relevant.
  - Running import shows progress from `sourceProbeStatus` and activity feed.
  - Completed import shows file metadata from source/project asset records.
  - Stale completed/failed progress does not suppress the selected asset inspector unless it belongs to the current route focus.
  - Selected asset inspector remains available.
- **Validation**:
  - Project workspace regression for right-panel priority rules.

### Task 4.2: Render Media-Specific Preview States

- **Location**:
  - `rooms/laboratory/ui/project-import-review.ts`
- **Description**: Render video thumbnail/YouTube preview, audio placeholder/player when URL/path exists, and image preview when available.
- **Complexity**: 5
- **Dependencies**: Task 4.1
- **Acceptance Criteria**:
  - Video preview can show YouTube thumbnail.
  - Audio preview does not use visual thumbnail-only language.
  - Image preview reserves stable dimensions.
- **Validation**:
  - UI snapshot/markup tests per media kind.

### Task 4.3: Move Asset Context Actions Into Inspector

- **Location**:
  - `rooms/laboratory/ui/asset-inspector.ts`
  - `rooms/laboratory/ui/context-action-bar.ts`
  - `rooms/laboratory/ui/project-workspace-overlay.ts`
- **Description**: Reduce or remove the global context action bar so bottom import actions stay visually meaningful.
- **Complexity**: 5
- **Dependencies**: Task 4.1
- **Acceptance Criteria**:
  - Use-as-source, delete, open report, download remain available from right panel.
  - Bottom bar no longer competes with import footer.
  - Multi-select delete behavior is preserved in the inspector or moved to a compact selected-assets panel before the global bar is removed.
- **Validation**:
  - Regression tests for selected asset actions.

## Sprint 5: Controller, Persistence, And Host Payload Alignment

**Goal**: Ensure the new UI produces existing host-compatible payloads.

**Demo/Validation**:
- Add local/url/youtube sends the same host action family as before.
- Draft changes persist during rerenders and project switches behave predictably.
- Active analysis locks still prevent source mutation.

### Task 5.1: Add Import Draft Field Handlers

- **Location**:
  - `rooms/laboratory/runtime/lab-run-controller.ts`
- **Description**: Wire `data-lab-field` and `data-lab-action` values for import tabs, method cards, URL fields, filename hint, YouTube strategy, custom settings, Clear, and Add.
- **Complexity**: 8
- **Dependencies**: Sprints 1-4
- **Acceptance Criteria**:
  - Input/change handlers keep rerender-safe form values.
  - Locked source state blocks Add and draft commits, but does not break read-only viewing.
  - YouTube parse timers are cancelled on Clear/project switch.
  - Existing `source.kind` and `source.mode` controls are not required for Project Workspace import routing.
- **Validation**:
  - Controller regressions covering each action and field.

### Task 5.2: Build Add Payload From Import Draft

- **Location**:
  - `rooms/laboratory/runtime/lab-run-controller.ts`
  - `rooms/laboratory/shared/host/*` only if required
- **Description**: Convert the active import draft to the existing `fields` payload expected by source host actions. This should be a new `project-import-add` path, not a wrapper around the existing `runSourcePrimaryAction()` behavior that reads committed `source.mode`.
- **Complexity**: 6
- **Dependencies**: Task 5.1
- **Acceptance Criteria**:
  - Local sends `source-pick-local`.
  - URL sends `source-download-url`.
  - YouTube sends `source-download-youtube`.
  - Payload includes draft `kind`, draft `mode`, and current field values without clearing unrelated project assets.
  - Local audio/image imports do not depend on the currently committed source kind; if host support is missing, add the minimum host/picker contract to pass draft kind/mode.
  - YouTube strategy is mapped through the table in this plan before sending host payload.
- **Validation**:
  - Host action payload regression.
  - Regression where committed source is video/local but draft route is image/url and Add sends image/url.

### Task 5.3: Persist Only Useful Import UI State

- **Location**:
  - `rooms/laboratory/ui/lab-root.ts`
  - `rooms/laboratory/runtime/lab-store.ts`
- **Description**: Persist active tab/method and safe draft text fields if appropriate. Avoid persisting volatile preview/progress/timers.
- **Complexity**: 5
- **Dependencies**: Sprint 1 and Task 5.1
- **Acceptance Criteria**:
  - Reload restores a reasonable import draft.
  - Running/progress UI rehydrates from host snapshot/activity, not stale UI-only fields.
  - Existing `youtubeImport` persistence guard remains intact.
- **Validation**:
  - Persistence regression test.

### Task 5.4: Remove Legacy Route Affordances From Project Workspace

- **Location**:
  - `rooms/laboratory/runtime/lab-run-controller.ts`
  - `rooms/laboratory/runtime/lab-store.ts`
  - `rooms/laboratory/ui/project-navigation.ts`
  - `rooms/laboratory/ui/workspace-surface.ts`
  - `rooms/laboratory/ui/styles/project-workspace.css`
- **Description**: Clean up or isolate legacy controls that conflict with the consolidated import flow.
- **Complexity**: 5
- **Dependencies**: Tasks 5.1-5.3
- **Acceptance Criteria**:
  - Project Workspace no longer renders `.labx-pw-nav__intake`.
  - Project Workspace no longer uses `workspace-toggle-source-intake` or `.sourceIntakeCollapsed` for source import visibility.
  - Project Workspace no longer dispatches `enter-youtube-import-mode`.
  - Deprecated full-screen YouTube code is either isolated behind non-Project-Workspace compatibility tests or removed in a follow-up.
- **Validation**:
  - Source assertions proving old route affordances are absent from Project Workspace renderers.
  - Controller regression proving no Project Workspace action enters `import-youtube`.

## Sprint 6: Styling, I18n, And Regression Coverage

**Goal**: Polish the consolidated workspace and protect it with focused tests.

**Demo/Validation**:
- Desktop layout uses space efficiently.
- Narrow layout stacks predictably.
- Text fits and controls do not overlap.
- Focused tests and typecheck pass.

### Task 6.1: Project Workspace CSS Reflow

- **Location**:
  - `rooms/laboratory/ui/styles/project-workspace.css`
  - `rooms/laboratory/ui/lab-theme.css` only if shared controls must change
- **Description**: Update grid to support center top import + center bottom asset list + right import review.
- **Complexity**: 7
- **Dependencies**: Sprints 2-4
- **Acceptance Criteria**:
  - Left panel has stable project width.
  - Import panel has compact but dominant controls.
  - Asset grid gets remaining vertical space.
  - Right panel scrolls independently.
  - Mobile/tablet stacks without text overlap.
- **Validation**:
  - CSS/source regression tests.
  - Manual screenshot smoke if app is running.

### Task 6.2: Localize New Copy

- **Location**:
  - `rooms/laboratory/i18n/en.json`
  - `rooms/laboratory/i18n/tr.json`
- **Description**: Add labels for tabs, method cards, import review states, Clear/Add, progress, and empty states.
- **Complexity**: 4
- **Dependencies**: UI tasks
- **Acceptance Criteria**:
  - No new visible copy relies only on fallback strings.
  - Turkish labels match existing style: `Video`, `Ses`, `Gorsel`, `Temizle`, `Ekle`.
- **Validation**:
  - I18n regression test or source assertions.

### Task 6.3: Update Existing Regressions

- **Location**:
  - `scripts/tests/laboratory-project-workspace-regressions.test.ts`
  - `scripts/tests/laboratory-source-intake-regressions.test.ts`
  - `scripts/tests/laboratory-controller-runtime-regressions.test.ts`
  - `scripts/tests/laboratory-store-runtime-regressions.test.ts`
  - `scripts/tests/laboratory-ui-evaluation-regressions.test.ts`
- **Description**: Replace old expectations around nav-owned source intake and YouTube full-screen entry with the new consolidated workspace.
- **Complexity**: 8
- **Dependencies**: Sprints 1-5
- **Acceptance Criteria**:
  - Tests assert source import lives in center top.
  - Tests assert left nav has no source controls.
  - Tests assert YouTube stays in Project Workspace.
  - Tests assert Clear/Add are the only import footer actions.
- **Validation**:
  - `npm run rooms:test:file -- scripts/tests/laboratory-project-workspace-regressions.test.ts`
  - `npm run rooms:test:file -- scripts/tests/laboratory-source-intake-regressions.test.ts`
  - `npm run rooms:test:file -- scripts/tests/laboratory-controller-runtime-regressions.test.ts`
  - `npm run rooms:test:file -- scripts/tests/laboratory-store-runtime-regressions.test.ts`
  - `npm run rooms:test:file -- scripts/tests/laboratory-ui-evaluation-regressions.test.ts`

### Task 6.4: Typecheck And Smoke

- **Location**:
  - whole repo / Laboratory room
- **Description**: Run the final focused validation set.
- **Complexity**: 3
- **Dependencies**: All implementation tasks
- **Acceptance Criteria**:
  - Focused tests pass.
  - `npm run rooms:typecheck` passes.
  - If app is available, Project Workspace smoke confirms layout, tabs, preview, progress, and Clear/Add behavior.
- **Validation**:
  - `npm run rooms:typecheck`
  - Optional Electron/CDP screenshot smoke when app mode is active.

## Testing Strategy

- Store tests:
  - Import tab/method state defaults.
  - Switching media tabs does not mutate active source.
  - Clear resets import draft and YouTube preview without deleting assets.
  - Persisted state hydrates safely.
- Controller tests:
  - Tab click, method card click, field input/change, Clear, Add.
  - YouTube strategy and custom settings inside Project Workspace.
  - Lock behavior during active analysis.
- UI tests:
  - Left nav contains projects only.
  - Center top contains import panel.
  - Center bottom contains the source-first media list.
  - Right panel switches between import review and asset inspector.
  - Footer contains only Clear and Add for import.
- Integration/smoke:
  - Local video import path.
  - Direct URL audio import path.
  - Image local/url import path.
  - YouTube preview + strategy selection path.

## Potential Risks & Gotchas

- Existing source controls mutate committed source config on `source.kind` and `source.mode` changes. The new UI needs draft route state to avoid replacing active source before Add.
- Current tests expect `source.mode=youtube` to enter `labMode="import-youtube"`. Those tests must be updated only after the embedded Project Workspace YouTube flow exists.
- `renderSourceIntake` lives in `workspace-surface.ts` but is imported by `project-navigation.ts`; moving it may reveal hidden coupling with center workspace rendering.
- The right panel currently assumes selected asset inspection. Import review needs clear priority rules so selection and active import do not fight.
- Existing bottom context action bar can visually conflict with the requested Clear/Add-only footer. Asset actions should move to the inspector before the bar is removed.
- YouTube Phase 3 state is currently separate from `sourceDrafts`. Add must translate strategy/custom choices into the existing YouTube host payload without persisting volatile preview state.
- `yt-dlp` unavailable state must be shown in the video/YouTube method card and must disable Add cleanly.
- `sourceProbeStatus` and `activityFeed` are global enough to show stale progress. The import review needs route/action/request correlation before it claims the right panel.
- Local file picker host code may assume the committed source kind. Add must pass draft kind/mode or update host support before audio/image local imports are considered complete.
- Mobile layout can easily become cramped with top import + bottom grid + right review; responsive stacking needs explicit tests or screenshot smoke.

## Rollback Plan

- Keep the existing source host actions unchanged.
- Keep `renderYoutubeImportWorkspaceMarkup` available until the embedded Project Workspace flow is validated.
- If the new layout causes regressions, revert only Project Workspace composition files first:
  - `project-workspace-overlay.ts`
  - `project-navigation.ts`
  - `project-source-import.ts`
  - `project-import-review.ts`
  - `project-workspace.css`
- Store additions should be additive and safely ignored by older renderers.
- Avoid changing `source-presets.json` semantics unless a later backend requirement needs it.
