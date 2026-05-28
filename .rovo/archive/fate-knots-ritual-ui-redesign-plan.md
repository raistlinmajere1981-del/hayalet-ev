# Plan: Fate Knots Ritual UI Redesign

**Generated**: 2026-03-28
**Estimated Complexity**: High

## Overview
Redesign Fate Knots so the player reads each screen as a game scene, not a web page. The first delivery focus is the lobby and the screen opened by `KOSUYU BASLAT`, then the same ritual-heavy language extends to scenario, combat, and result surfaces.

Core approach:
- keep `game-room` and `fate-knots` host/runtime contracts stable
- use the existing `immersive-stage` room shell and `scene-view` transparent-window pipeline as the primary presentation layer
- aggressively recompose Fate Knots DOM/CSS around physical scene objects: frame, table, plaque, seal, ledger, ritual header
- remove the remaining legacy visual language instead of letting old and new UI systems coexist
- prioritize aggressive convergence toward the reference-image whole over conservative reuse of the current look
- use PixiJS only as a conditional fallback if the current renderer cannot deliver the required scene-space behavior

## Current Baseline
- `rooms/game-room/main-functions/fate-knots/ui/module.js` already renders five distinct phases: overview, character creation, scenario, combat, result.
- `rooms/game-room/main-functions/fate-knots/styles.css` already uses feature-local assets, but the composition still reads as card/panel UI.
- `rooms/game-room/manifest.json` already exposes `immersive-stage` and a `transparentWindow` for `fate-knots-closeup`.
- Existing tests already assert `data-fk-phase`, `data-fk-role`, seat markers, and command dispatch in `scripts/tests/game-room-fate-knots-ui-path-regressions.test.ts`.
- `package.json` does not currently include `pixi.js`, so a Pixi migration is not a free switch; it would be a new renderer track.

## Locked Decisions
- **Primary Renderer**: DOM/CSS stays the default path for the redesign.
- **Presentation Priority**: `scene-view` is the showcase mode; `classic` is a functional fallback and must inherit the same art direction rather than keeping an older look.
- **Scene Shell**: `main-functions/fate-knots/assets/fate-knots-view.webp` remains the base close-up art in scene mode unless replaced by a better dedicated close-up asset later.
- **Host Contract**: no host payload, protocol, or save-state schema changes in the UI redesign phase.
- **Room / Feature Split**: `game-room` stays the room; `fate-knots` stays a main function inside it.
- **Single Visual Standard**: legacy panel/web-app remnants should be removed, not preserved alongside the new ritual language.
- **Visible Copy**: new labels belong in `rooms/game-room/i18n/en.json` and `rooms/game-room/i18n/tr.json`, not in hardcoded renderer text or baked asset art.
- **Vertical Slice Order**: lobby first, then `KOSUYU BASLAT` screen, then scenario, then combat, then result.
- **Asset Policy**: existing project assets are the first source; replace or generate only where they fail the target composition or material language.

## Full-Fit Layout Contract
The redesign should auto-fill the available feature window and use the area efficiently instead of reading like a centered web page.

Target rules:
- `16:9` and `16:10` are primary target ratios.
- ultrawide desktop is best-effort, but the composition must stay weighted and not collapse into a small centered island.
- the opening viewport must show one dominant focal composition without requiring immediate scroll.
- the main scene object should own roughly `60-72%` of the first-view width on desktop for lobby, scenario, and combat.
- secondary rails should compress before the dominant scene shrinks below readability.
- vertical space should be consumed by stage composition first, not by large top/bottom padding bands.
- if a screen introduces overflow, the first visible band still has to feel complete and intentional.

## PixiJS Decision Gate
PixiJS should be introduced only if at least one of these becomes a hard requirement during implementation:
- the lobby or follow-up screen needs camera pan/zoom inside the transparent window, not just layered DOM motion
- the ritual look depends on persistent scene-space fog, embers, or light passes with more than three independently animated depth layers
- masking, per-pixel lighting, or animated map-path rendering becomes visually central and CSS/SVG can no longer carry it cleanly
- Electron profiling on target hardware shows the DOM/CSS version missing the desired interaction quality or frame budget

If none of these gates trigger, do not migrate the feature to PixiJS in this phase.

## Asset Gap Snapshot
### Already sufficient for the first aggressive pass
- `assets/ui/frames/*`
- `assets/ui/buttons/*`
- `assets/ui/map/*`
- `assets/ui/overlays/*`
- `assets/ui/dialogue/*`
- `assets/ui/cards/*`
- `assets/ui/status/*`
- map, portrait, location, creature, and scene art under `assets/**`

### High-value optional assets to request
- dedicated `Fate Knots` wordmark or crest for the ritual header
- large wax-seal or engraved-start-button art for the main start action
- four seat-specific plaque variants for `user`, `ai1`, `ai2`, and `us1`
- a character-creation tabletop or dossier background plate for the second screen
- a bespoke result banner so the final screen does not reuse generic framing

### Potentially blocking only for near-reference parity
- a replacement lobby map art with stronger painted focal hierarchy
- a custom interstitial panel art for the exact post-start ritual moment

## Preferred Asset Request Brief
If art is commissioned or generated before implementation, request these first:
- `fate_knots_wordmark_crest`
  - use: ritual header centerpiece
  - format: transparent `webp` or `png`
  - note: dark bronze, bone, or iron material language; not glossy fantasy logo art
  - safe zone: keep the center `70%` composition-safe for flexible title overlay and scaling
- `fate_knots_start_seal`
  - use: main start action in the lobby
  - format: transparent `webp` or `png`
  - note: wax seal, engraved medallion, or carved plate; should support idle, hover, and active glow overlays
  - safe zone: keep edges clean so glow overlays can expand without clipping
- `fate_knots_seat_plaque_set`
  - use: `user`, `ai1`, `ai2`, `us1` roster plaques
  - format: four transparent variants or one base plus four emblem overlays
  - note: each seat should be distinguishable at a glance without loud color coding
  - safe zone: leave a large clean interior region for portrait, localized labels, and state text
- `fate_knots_creation_tabletop`
  - use: post-start preparation table background or dossier plate
  - format: wide background art for the second screen
  - note: should feel like laid-out parchment, tools, and ritual setup, not a UI panel
  - safe zone: preserve one large quiet work area for the selection layer and one calmer side band for the dossier rail
- `fate_knots_result_banner`
  - use: result/closure screen hero treatment
  - format: transparent or semi-transparent overlay art
  - note: restrained, aftermath-oriented, not celebratory arcade UI
  - safe zone: keep the central read area clear for localized title and summary text

Global production rules:
- do not bake text, numbers, or language-specific symbols into any asset
- avoid decorative elements that invade the center work area and force awkward DOM masking
- keep alpha edges clean enough for `scene-view` compositing over dark backgrounds

## Prerequisites
- `rooms/game-room/main-functions/fate-knots/ui/module.js`
- `rooms/game-room/main-functions/fate-knots/styles.css`
- `rooms/game-room/manifest.json`
- `rooms/game-room/i18n/en.json`
- `rooms/game-room/i18n/tr.json`
- `scripts/tests/game-room-fate-knots-ui-path-regressions.test.ts`
- installed-copy parity checks under `scripts/tests/game-room-installed-*.test.ts`
- scene-shell references under `src/js/pages/room-page/*` and `src/styles/rooms/scene.css`

## Sprint 1: Freeze The Ritual Contract
**Goal**: Turn the visual target into an implementation contract before rewriting layout.
**Demo/Validation**:
- one written mapping exists from current phases to ritual equivalents
- one renderer decision note exists that says when DOM/CSS stops and Pixi starts
- one asset gap ledger exists and is ranked by blocking severity
- one full-fit layout contract exists for `16:9`, `16:10`, and wider desktop bands

### Task 1.1: Map phase intent to physical scene objects
- **Location**: `assets/fate-knots-ritual-ui-redesign-plan.md`
- **Description**: Freeze the semantic translation table for every major block: panel -> frame, button -> seal, list -> ledger, slot -> plaque, header -> ritual arch, status chip -> carved badge.
- **Complexity**: 2
- **Dependencies**: None
- **Acceptance Criteria**:
  - each Fate Knots phase has one dominant scene object and two secondary object families
  - banned panel/app vocabulary is explicitly listed for implementation review
- **Validation**:
  - manual review against reference images and `assets/game-room-fate-knots-ui-rules.md`

### Task 1.2: Freeze landmark ownership for the first two screens
- **Location**: `rooms/game-room/main-functions/fate-knots/ui/module.js`, `scripts/tests/game-room-fate-knots-ui-path-regressions.test.ts`
- **Description**: Define which `data-fk-role` markers must exist on the redesigned lobby and post-start screen so visual rewrites do not break testability.
- **Complexity**: 4
- **Dependencies**: Task 1.1
- **Acceptance Criteria**:
  - lobby exposes stable hooks for `ritual-header`, `map-shell`, `right-rail`, and `start-zone`
  - post-start screen exposes stable hooks for `ritual-header`, `selection-table`, `dossier-rail`, and `lock-zone`
- **Validation**:
  - targeted DOM assertions added or updated in the UI regression suite

### Task 1.3: Audit scene-view window and close-up constraints
- **Location**: `rooms/game-room/manifest.json`, `src/js/pages/room-page/scene-render-runtime.ts`, `src/styles/rooms/scene.css`
- **Description**: Confirm the current `transparentWindow` can hold the more theatrical lobby and creation compositions without clipping important edges.
- **Complexity**: 4
- **Dependencies**: Task 1.1
- **Acceptance Criteria**:
  - a safe-zone note exists for desktop and narrower widths
  - any transparent-window adjustment is identified before layout work begins
- **Validation**:
  - manual scene-view review at the room page shell level
  - scene-window bounds sanity check in debug mode if needed

### Task 1.4: Rank asset gaps and define fallback recipes
- **Location**: `assets/fate-knots-ritual-ui-redesign-plan.md`, `rooms/game-room/main-functions/fate-knots/ui/module.js`
- **Description**: Record which requested polish assets are optional and which missing elements must be simulated with layered existing assets plus CSS.
- **Complexity**: 3
- **Dependencies**: Tasks 1.1-1.3
- **Acceptance Criteria**:
  - every desired visual beat has either a current asset recipe or an explicit requested asset
  - no implementation task depends on an unclassified missing asset
- **Validation**:
  - checklist review before Sprint 2 starts

### Task 1.5: Freeze viewport-fit and density rules
- **Location**: `assets/fate-knots-ritual-ui-redesign-plan.md`, `rooms/game-room/main-functions/fate-knots/styles.css`
- **Description**: Convert the full-fit layout expectations into concrete density rules for first-view occupancy, rail width, safe padding, and overflow behavior across the primary desktop ratios.
- **Complexity**: 4
- **Dependencies**: Tasks 1.2-1.3
- **Acceptance Criteria**:
  - each phase has a written first-view occupancy target
  - no future implementation step can interpret the redesign as a centered page with decorative margins
- **Validation**:
  - plan checklist review

## Sprint 2: Shared Ritual Foundation
**Goal**: Build one reusable visual system that makes the feature stop reading like a dashboard.
**Demo/Validation**:
- common frame, plaque, seal, and ledger primitives exist
- legacy app-card styling no longer drives primary surfaces
- lobby and creation can share the same object language

### Task 2.1: Replace generic surface language with ritual primitives
- **Location**: `rooms/game-room/main-functions/fate-knots/styles.css`, `rooms/game-room/main-functions/fate-knots/ui/module.js`
- **Description**: Refactor shared primitives so primary containers are expressed as scene frame, side rail, plaque, ledger, seal, and arch instead of broad rounded panels and generic buttons.
- **Complexity**: 7
- **Dependencies**: Sprint 1
- **Acceptance Criteria**:
  - reusable helper recipes exist for `mainSceneFrame`, `sidePanelFrame`, `buttonPlate`, `cardSlotFrame`, `notificationBanner`, and overlay stacks
  - old glassy or app-card surfaces are either deleted or isolated to non-primary utility roles
- **Validation**:
  - `node --test scripts/tests/game-room-fate-knots-ui-path-regressions.test.ts`

### Task 2.2: Build a dedicated ritual header family
- **Location**: `rooms/game-room/main-functions/fate-knots/ui/module.js`, `rooms/game-room/main-functions/fate-knots/styles.css`, `rooms/game-room/i18n/en.json`, `rooms/game-room/i18n/tr.json`
- **Description**: Turn the current top/title treatment into a framed ritual header with restrained glow, center-weighted composition, and phase-aware subtitle copy.
- **Complexity**: 6
- **Dependencies**: Task 2.1
- **Acceptance Criteria**:
  - header no longer looks like a page title or chip row
  - header survives both classic and scene-view presentation modes
  - title, subtitle, and state labels remain localized
- **Validation**:
  - manual visual review for overview and character-creation phases
  - i18n key coverage review

### Task 2.3: Add seal-style action primitives
- **Location**: `rooms/game-room/main-functions/fate-knots/ui/module.js`, `rooms/game-room/main-functions/fate-knots/styles.css`
- **Description**: Replace generic primary/secondary action styling with a seal/decision treatment, including hover, ready, disabled, and active states.
- **Complexity**: 6
- **Dependencies**: Task 2.1
- **Acceptance Criteria**:
  - `GameRoomFateKnotsStart`, `Ready`, `Sync`, `Reset`, and `End` actions share one physical visual language
  - primary action feels heavier than secondary actions without becoming flashy
- **Validation**:
  - command dispatch assertions in UI regressions
  - manual hover/disabled review in Electron

### Task 2.4: Remove the remaining web-page tells
- **Location**: `rooms/game-room/main-functions/fate-knots/styles.css`
- **Description**: Eliminate the visual patterns that still make the feature look like a page: floating cards, oversized rounded corners, pill-heavy meta rows, and evenly spaced admin-grid behavior.
- **Complexity**: 5
- **Dependencies**: Tasks 2.1-2.3
- **Acceptance Criteria**:
  - no primary Fate Knots surface reads as a generic app panel
  - spacing and grouping favor stage composition over dashboard symmetry
  - `classic` fallback no longer preserves a visibly older Fate Knots visual system
- **Validation**:
  - stylesheet audit
  - side-by-side screenshot comparison before and after

## Sprint 3: Lobby Vertical Slice - Scene-First Gathering
**Goal**: Turn the first screen into a ritualized gathering scene centered on the map.
**Demo/Validation**:
- the map is the dominant object
- the right rail reads like a table edge, not a settings panel
- the start control reads like a commitment point, not a web button

### Task 3.1: Recompose overview layout around one dominant map scene
- **Location**: `rooms/game-room/main-functions/fate-knots/ui/module.js`, `rooms/game-room/main-functions/fate-knots/styles.css`
- **Description**: Rebuild `renderOverviewStage` so the map owns the center, the participant rail compresses to the right, and memory/history surfaces stop competing with the map in the opening viewport.
- **Complexity**: 8
- **Dependencies**: Sprint 2
- **Acceptance Criteria**:
  - `map-shell` visually dominates on desktop widths
  - `right-rail` stays narrow and subordinate
  - memory/history information moves below the first focal band or into a calmer secondary zone
- **Validation**:
  - UI regression structure updates
  - manual visual review at `1600x900` and one narrower width

### Task 3.2: Turn seats into physical plaques
- **Location**: `rooms/game-room/main-functions/fate-knots/ui/module.js`, `rooms/game-room/main-functions/fate-knots/styles.css`, `rooms/game-room/i18n/en.json`, `rooms/game-room/i18n/tr.json`
- **Description**: Replace the current seat cards with plaque-like roster objects that feel mounted to the right-hand table edge.
- **Complexity**: 7
- **Dependencies**: Task 3.1
- **Acceptance Criteria**:
  - `user`, `ai1`, `ai2`, and `us1` remain structurally present through `data-seat-id`
  - live and dormant seats are readable without using system-y words like `Beklemede` as the dominant label
  - dormant seats stay non-interactive in V1
- **Validation**:
  - DOM seat-presence assertions
  - locale review for seat-state copy

### Task 3.3: Convert the start action into a ritual seal
- **Location**: `rooms/game-room/main-functions/fate-knots/ui/module.js`, `rooms/game-room/main-functions/fate-knots/styles.css`
- **Description**: Rebuild the opening action zone so `KOSUYU BASLAT` sits as a weighted lower-right seal with restrained pulse, glow, and press-state feedback.
- **Complexity**: 6
- **Dependencies**: Task 3.1
- **Acceptance Criteria**:
  - the action zone visually anchors the lower-right corner
  - the main action is unmistakably primary without looking like a standard CTA button
  - command payload and timing do not change
- **Validation**:
  - start-command regression assertion
  - manual interaction review in Electron

### Task 3.4: Refine marker and path emphasis without over-animating
- **Location**: `rooms/game-room/main-functions/fate-knots/styles.css`, `rooms/game-room/main-functions/fate-knots/ui/module.js`
- **Description**: Upgrade map markers, label plates, and connection cues so the map feels alive enough to be a scene while staying within the project motion rules.
- **Complexity**: 5
- **Dependencies**: Task 3.1
- **Acceptance Criteria**:
  - active node emphasis is visible without continuous noisy animation
  - marker labels feel attached to the world, not to a form control
- **Validation**:
  - manual visual review
  - no regression in marker click targets if interaction is added later

## Sprint 4: Post-Start Screen Vertical Slice - Ritual Begins
**Goal**: Make the first screen after `KOSUYU BASLAT` feel like a ritual preparation table instead of a form.
**Demo/Validation**:
- the screen opened by start has a strong ritual identity
- selection is left-weighted and active
- the right side reads as dossier or prepared build, not summary sidebar

### Task 4.1: Reframe character creation as a preparation table
- **Location**: `rooms/game-room/main-functions/fate-knots/ui/module.js`, `rooms/game-room/main-functions/fate-knots/styles.css`
- **Description**: Recompose `renderCreationStage` so the left side becomes the active preparation table and the right side becomes a quieter dossier rail.
- **Complexity**: 8
- **Dependencies**: Sprint 2
- **Acceptance Criteria**:
  - the main eye path starts on the left selection field, then resolves on the right dossier
  - the screen does not resemble a multi-column settings page
- **Validation**:
  - UI regression structure updates
  - manual visual review against the second reference image

### Task 4.2: Add the ritual-begin header state
- **Location**: `rooms/game-room/main-functions/fate-knots/ui/module.js`, `rooms/game-room/main-functions/fate-knots/styles.css`, `rooms/game-room/i18n/en.json`, `rooms/game-room/i18n/tr.json`
- **Description**: Give the post-start screen a dedicated header state that feels like the ritual has begun rather than merely entering a setup form.
- **Complexity**: 5
- **Dependencies**: Sprint 2, Task 4.1
- **Acceptance Criteria**:
  - header language and composition clearly differ from the lobby
  - the opening state feels transitional and ceremonial without requiring a new host phase
- **Validation**:
  - copy review
  - manual screenshot review

### Task 4.3: Convert selection cards into tactile choice objects
- **Location**: `rooms/game-room/main-functions/fate-knots/ui/module.js`, `rooms/game-room/main-functions/fate-knots/styles.css`
- **Description**: Make avatar, class, and background choices feel like table objects laid out for selection rather than evenly repeated catalog tiles.
- **Complexity**: 7
- **Dependencies**: Task 4.1
- **Acceptance Criteria**:
  - selected state is obvious through layering and posture, not just border color
  - disabled and locked states remain readable without flat UI language
- **Validation**:
  - selection-command regression assertions
  - manual selected/disabled state review

### Task 4.4: Turn the summary rail into a dossier or character altar
- **Location**: `rooms/game-room/main-functions/fate-knots/ui/module.js`, `rooms/game-room/main-functions/fate-knots/styles.css`
- **Description**: Rebuild `createSelectionSummary` so the right side feels like a prepared dossier, hero stand, or altar-like summary object.
- **Complexity**: 6
- **Dependencies**: Task 4.1
- **Acceptance Criteria**:
  - the right rail visually supports the selection flow without reading as a dashboard sidebar
  - lock/ready controls belong to the dossier rail naturally
- **Validation**:
  - manual review in both classic and scene-view modes

### Task 4.5: Add a lightweight opening-motion pass
- **Location**: `rooms/game-room/main-functions/fate-knots/styles.css`
- **Description**: Add small, stateful motion for header reveal, seal emphasis, and active selection focus so the start transition feels meaningful without becoming noisy.
- **Complexity**: 4
- **Dependencies**: Tasks 4.1-4.4
- **Acceptance Criteria**:
  - motion is short, informative, and phase-bound
  - no continuous decorative animation becomes the main focus
- **Validation**:
  - manual motion review in Electron
  - quick performance sanity check on target hardware

## Sprint 5: Scenario And Combat Recomposition
**Goal**: Carry the same scene-first language into the playable screens without regressing function.
**Demo/Validation**:
- scenario and combat look like the same world as lobby and creation
- log and decision areas no longer feel like app widgets
- combat still reads quickly

### Task 5.1: Rebuild scenario lower rail as story apparatus
- **Location**: `rooms/game-room/main-functions/fate-knots/ui/module.js`, `rooms/game-room/main-functions/fate-knots/styles.css`
- **Description**: Rework the scenario lower area so log, narration, and decisions read like story apparatus attached to the scene, not independent panel blocks.
- **Complexity**: 7
- **Dependencies**: Sprint 2
- **Acceptance Criteria**:
  - `scene-shell` remains dominant
  - `story-feed` and `decision-surface` become secondary ritual objects
  - the log no longer resembles a chat app
- **Validation**:
  - scenario path assertions in the UI regression suite

### Task 5.2: Rebuild combat as the same world entering battle state
- **Location**: `rooms/game-room/main-functions/fate-knots/ui/module.js`, `rooms/game-room/main-functions/fate-knots/styles.css`
- **Description**: Keep the scene visible and convert combat status plus hand areas into grounded battle objects rather than dashboard cards.
- **Complexity**: 8
- **Dependencies**: Sprint 2
- **Acceptance Criteria**:
  - arena remains visually dominant
  - hand, party rail, and combat log feel attached to the battle space
  - readability of turn, HP, and action availability does not regress
- **Validation**:
  - combat path assertions in the UI regression suite
  - manual readability review

### Task 5.3: Rebuild result screen as closure, not admin recap
- **Location**: `rooms/game-room/main-functions/fate-knots/ui/module.js`, `rooms/game-room/main-functions/fate-knots/styles.css`
- **Description**: Redesign the result phase so it feels like ritual closure and aftermath instead of a plain summary page.
- **Complexity**: 5
- **Dependencies**: Sprint 2
- **Acceptance Criteria**:
  - result screen keeps one strong focal block
  - action choices remain clear but restrained
- **Validation**:
  - result path assertions in the UI regression suite

## Sprint 6: Packaging, Verification, And Optional Pixi Spike
**Goal**: Prove the redesign survives packaging and make a bounded renderer fallback plan if DOM/CSS fails.
**Demo/Validation**:
- installed copy matches source behavior
- scene-view and classic modes both remain usable
- a Pixi spike plan exists but is not executed unless the gate is hit

### Task 6.1: Refresh installed game-room copy and verify UI asset parity
- **Location**: `data/rooms/game-room/**`, `scripts/tests/game-room-installed-ui-smoke-regressions.test.ts`
- **Description**: Run `npm run rooms:bundle`, refresh the installed `game-room` package after the redesign lands, and verify that packaged Fate Knots UI assets resolve correctly.
- **Complexity**: 5
- **Dependencies**: Sprints 3-5
- **Acceptance Criteria**:
  - installed UI uses the redesigned Fate Knots assets and structure
  - no source-only path assumptions remain
- **Validation**:
  - `npm run rooms:bundle`
  - installed UI smoke tests
  - `node --test scripts/tests/game-room-fate-knots-asset-sync-regressions.test.ts`
  - packaged asset existence assertions

### Task 6.2: Run a visual review matrix
- **Location**: manual review matrix tied to `scripts/tests/game-room-fate-knots-ui-path-regressions.test.ts`
- **Description**: Capture and compare the redesigned screens at `1600x900`, one narrower desktop width, and one locale flip for both classic and scene-view modes.
- **Complexity**: 4
- **Dependencies**: Sprints 3-5
- **Acceptance Criteria**:
  - lobby and post-start screens meet the new scene-first target
  - scenario and combat stay visually coherent with them
- **Validation**:
  - screenshot review checklist

### Task 6.3: Prepare a bounded Pixi spike only if the gate fires
- **Location**: `package.json`, new `rooms/game-room/main-functions/fate-knots/ui/pixi/*` files if activated, `rooms/game-room/main-functions/fate-knots/ui/module.js`
- **Description**: If the Pixi gate is hit, run a narrow spike that renders only the lobby map shell and ritual header inside the existing room scene window before any full migration is approved.
- **Complexity**: 7
- **Dependencies**: Task 6.2 and an explicit failure against the Pixi decision gate
- **Acceptance Criteria**:
  - the spike is isolated to one screen and one adapter seam
  - host/runtime commands and state entry points remain unchanged
  - a revert path exists back to DOM/CSS
- **Validation**:
  - manual Electron profiling
  - no host regression

## Testing Strategy
- Keep `scripts/tests/game-room-fate-knots-ui-path-regressions.test.ts` as the structural safety net for all phase landmarks and command dispatch.
- Add or update assertions for `ritual-header`, `map-shell`, `right-rail`, `start-zone`, `selection-table`, `dossier-rail`, and key `data-seat-id` anchors.
- Treat `scene-view` as the primary visual review target and `classic` as the parity fallback target.
- Run packaged UI smoke after the shared primitive rewrite and again after the first two screens land.
- Run `npm run rooms:bundle` and `node --test scripts/tests/game-room-fate-knots-asset-sync-regressions.test.ts` before calling the redesign packaged-safe.
- Manually review screenshots in both `classic` and `scene-view` presentation modes.
- If any transparent-window bounds change, verify the room scene shell in Electron, not only the fake DOM test harness.

## Potential Risks & Gotchas
- The current map art may still look too "component-like" even after layout fixes. Mitigation: treat map framing, marker emphasis, and surrounding composition as first-class, and only request new map art if that still fails.
- Character creation can easily fall back into a catalog grid. Mitigation: keep left-side choice flow intentionally uneven and let the right dossier stay quiet.
- The right rail can become too dense when four plaques, remote state, and action seals compete. Mitigation: rank information density and demote non-critical text beneath the first focal band.
- `scene-view` clipping can break the new ritual header or lower-right seal. Mitigation: audit safe zones before visual rewrites and adjust the transparent window only if required.
- Reusing too many old chip/badge patterns will keep the web-app smell. Mitigation: explicitly delete or quarantine legacy app-like primitives during Sprint 2.
- A premature Pixi migration could slow delivery and multiply seams. Mitigation: require the Pixi decision gate to fail before any dependency or adapter work begins.

## Rollback Plan
- Keep the redesign scoped to Fate Knots source files first: `rooms/game-room/main-functions/fate-knots/**`.
- Land shared primitive rewrites in small commits so the lobby and post-start vertical slices can be reverted independently.
- Do not change host/runtime schemas during the visual redesign; this keeps rollback UI-only.
- If packaged parity breaks, restore the prior bundled `game-room` output and re-run the installed smoke path before attempting more visual changes.
- If a Pixi spike is attempted and rejected, remove the adapter seam and dependency before expanding beyond the lobby experiment.
