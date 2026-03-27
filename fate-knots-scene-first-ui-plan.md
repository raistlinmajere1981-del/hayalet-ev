# Plan: Fate Knots Scene-First UI

**Generated**: 2026-03-27
**Estimated Complexity**: High

## Overview
Turn the current Fate Knots V1 shell into a scene-first game surface that uses the existing feature-local assets instead of generic CSS panels, buttons, and cards. The layout must follow the provided SVG wireframes closely, keep the current host/runtime contract stable, and leave future-ready dummy anchors for the planned 4-player mode without forcing V2 logic into V1.

Core approach:
- keep the current DOM/CSS renderer and do not switch to PixiJS in this phase
- replace generic panel language with reusable asset-backed UI primitives
- treat the wireframes as placement guides, not loose inspiration
- preserve the current playable flow: lobby -> character creation -> scenario -> combat -> result
- seed future 4-seat placeholders now so V2 can attach real multiplayer behavior later without redesigning the screen structure

## Locked Decisions
- **Rendering Model**: DOM/CSS only for this phase
- **Visual Priority**: scene first, system second, decoration last
- **Primary Inputs**: `assets/game-room-fate-knots-ui-rules.md` and the four SVG wireframes
- **Asset Source**: use the existing portable runtime assets already under `rooms/game-room/main-functions/fate-knots/assets/**`
- **V2 Preparation**: add dummy seat anchors and dormant HUD slots for the future 4-player model, but do not implement real V2 behavior now
- **CSS Strategy**: keep CSS for layout, state, hover, and responsive behavior; move visual identity to asset-backed surfaces wherever possible
- **Semantic Test Hooks**: the redesign should introduce stable DOM hooks such as `data-fk-phase`, `data-fk-role`, and `data-seat-id` for structural assertions

## Non-Negotiable UI Boundary
- Dummy seats are renderer-only in this phase.
- `participants`, `excludedSeats`, `decision.participantIds`, `combat.party`, command payloads, host/runtime schemas, and serialization rules do not change.
- Dummy anchors never participate in vote counts, pending-seat logic, combat turn ownership, or readiness math.
- The renderer may display reserved anchors for `user`, `ai1`, `ai2`, and `us1`, but V1 logic still derives from the live host state only.

## Overflow Guardrails
- No new nested scroll root is added unless a phase explicitly needs it.
- If a nested scroller is introduced, it must be named in the implementation, isolated to one region, and covered by rerender-preservation tests.
- Decorative rails and dummy anchors stay outside overflow-critical containers whenever possible.

## DOM Semantics Rules
- Interactive choices, combat actions, and primary/secondary controls remain real `button` elements.
- Dormant dummy anchors are non-button, non-focusable, and visually muted.
- Landmark regions should expose stable `data-fk-role` markers so UI tests do not depend on fragile class names.

## Current Baseline
Observed from the current implementation:
- `rooms/game-room/main-functions/fate-knots/ui/module.js` already has phase-specific render paths for overview, character creation, scenario, combat, and result
- `rooms/game-room/main-functions/fate-knots/styles.css` still uses generic rounded panel, button, and card styling that reads closer to a dashboard shell than a game surface
- the runtime asset package already includes reusable UI families:
  - `ui/frames` (6)
  - `ui/buttons` (8)
  - `ui/cards` (5)
  - `ui/dialogue` (5)
  - `ui/status` (6)
  - `ui/map` (7)
  - `ui/combat-fx` (5)
  - `ui/combat-icons` (6)
  - `ui/overlays` (6)
  - `ui/card-effects` (5)
- the current regression baseline already covers UI interaction paths and scroll preservation

## Prerequisites
- Existing Fate Knots runtime package under `rooms/game-room/main-functions/fate-knots/`
- Existing UI path regressions under `scripts/tests/game-room-fate-knots-ui-path-regressions.test.ts`
- Existing room and host regressions for Fate Knots
- The four SVG wireframes in `assets/`
- The design rules in `assets/game-room-fate-knots-ui-rules.md`

## Asset Gap Assessment
- No blocking new asset appears required for this UI phase; the current Fate Knots runtime package already covers frames, buttons, cards, dialogue, status, map markers, overlays, and combat feedback.
- Optional polish assets can wait until after implementation review: a dedicated Fate Knots wordmark, seat-specific plaque variants, and a bespoke result banner.

## Success Criteria
- Each phase exposes one dominant scene-led landmark region through stable hooks such as `data-fk-role="map-shell"`, `scene-shell`, or `combat-arena`.
- Each phase exposes stable landmark hooks for its secondary rail and action zone without relying on fragile class names.
- Existing runtime payloads, command dispatch, and host/runtime schemas remain compatible.
- Future 4-seat UI anchors are renderer-only, marked with `data-seat-id`, and do not create extra interactive controls in V1.
- No regression appears in command dispatch, scroll preservation, i18n fallback behavior, installed-host smoke, or installed UI parity coverage.

## Sprint 1: Asset Audit And Scene-First UI Contract
**Goal**: Convert the design rules and current asset pool into an explicit UI contract before touching renderer structure.
**Demo/Validation**:
- a written UI contract exists for each phase and asset family
- every current screen has a defined scene-first hierarchy
- every future 4-seat anchor has a named placeholder target

### Task 1.1: Create A Wireframe-To-Screen Mapping Table
- **Location**: `fate-knots-scene-first-ui-plan.md`
- **Description**: Map each SVG wireframe to the matching runtime phase and record the required dominant area, secondary panels, action cluster, and phase landmark ownership.
- **Complexity**: 2
- **Dependencies**: None
- **Acceptance Criteria**:
  - each phase has a one-line composition rule and one named dominant region
  - deviations from the SVGs and landmark ownership are listed explicitly
- **Validation**:
  - manual review against the four SVG files
  - landmark checklist review

### Task 1.2: Define The Reusable UI Primitive Set
- **Location**: `rooms/game-room/main-functions/fate-knots/styles.css`, `rooms/game-room/main-functions/fate-knots/ui/module.js`
- **Description**: Define the primitive families that later implementation must use instead of generic panels: scene frame, side frame, button plate, card slot, dialogue panel, status chip, map marker, combat indicator, overlay veil.
- **Complexity**: 4
- **Dependencies**: Task 1.1
- **Acceptance Criteria**:
  - every major visual block maps to an existing asset family or a thin CSS fallback
  - generic fallback blocks are explicitly limited to layout-only roles
- **Validation**:
  - asset-to-primitive checklist

### Task 1.3: Freeze The V2 Dummy Anchor Inventory
- **Location**: `rooms/game-room/main-functions/fate-knots/ui/module.js`, `rooms/game-room/main-functions/fate-knots/styles.css`
- **Description**: Decide where dormant renderer-only placeholders for `ai1`, `ai2`, and `us1` live in each phase. This includes seat plaques, initiative chips, scenario portraits, and combat hand anchors.
- **Complexity**: 4
- **Dependencies**: Task 1.1
- **Acceptance Criteria**:
  - all four seat ids have a reserved UI location in lobby, creation, scenario, and combat
  - V1 only activates the current simplified roster logic
  - dummy anchors are renderer-only and never alter participant-derived counts, payloads, or combat ownership
  - dummy anchors are visually muted, non-button, and clearly non-interactive in V1
- **Validation**:
  - phase-by-phase anchor checklist

### Task 1.4: Record CSS Elimination Boundaries
- **Location**: `rooms/game-room/main-functions/fate-knots/styles.css`
- **Description**: Mark which current generic CSS objects must disappear in the redesign: floating card panels, broad gradient surfaces, generic app-like buttons, placeholder metrics, and generic art cards.
- **Complexity**: 3
- **Dependencies**: Tasks 1.2-1.3
- **Acceptance Criteria**:
  - obsolete generic classes are listed before implementation starts
  - allowed CSS-only utilities are limited to layout, spacing, state, overflow, and responsive behavior
- **Validation**:
  - stylesheet audit checklist

### Task 1.5: Define Landmark Hooks And Visual Review Matrix
- **Location**: `fate-knots-scene-first-ui-plan.md`, future `rooms/game-room/main-functions/fate-knots/ui/module.js`, `scripts/tests/game-room-fate-knots-ui-path-regressions.test.ts`
- **Description**: Freeze the landmark hook strategy for `data-fk-phase`, `data-fk-role`, and `data-seat-id`, and document the screenshot review matrix for the visual refactor.
- **Complexity**: 4
- **Dependencies**: Tasks 1.1-1.4
- **Acceptance Criteria**:
  - phase landmarks are named for `data-fk-phase`, `data-fk-role`, and `data-seat-id`
  - the screenshot matrix is documented for `overview`, `creation`, `scenario`, `combat`, and `result` at `1600x900`, one embedded width, and one locale flip
- **Validation**:
  - plan review checklist

## Sprint 2: Shared Visual Foundation And Asset-Backed Primitives
**Goal**: Build the visual language once so every phase can reuse it consistently.
**Demo/Validation**:
- a single visual family drives all major surfaces
- no phase depends on the old generic panel language
- UI remains functional with current state payloads

### Task 2.1: Add A Scene Surface Layer Stack
- **Location**: `rooms/game-room/main-functions/fate-knots/styles.css`
- **Description**: Introduce a layered scene shell with background veil, frame asset, inner content safe-zone, and responsive overflow handling. The shell must support map view, scene art view, and combat view without changing the room-level scroll behavior, and it should bind to the existing `featureView` / `fate-knots-view` background wherever the shared close-up surface is needed.
- **Complexity**: 6
- **Dependencies**: Sprint 1
- **Acceptance Criteria**:
  - the root screen exposes one dominant `data-fk-role` scene surface per phase
  - frame assets and overlays replace the current app-card appearance
  - no new nested scroll root is introduced unless it is explicitly named and test-covered
- **Validation**:
  - `scripts/tests/game-room-fate-knots-ui-path-regressions.test.ts`
  - manual screenshot review in Electron later

### Task 2.2: Introduce Asset Alias Helpers And Primitive Recipes
- **Location**: `rooms/game-room/main-functions/fate-knots/ui/module.js`, `fate-knots-scene-first-ui-plan.md`
- **Description**: Add thin helper accessors that map semantic UI needs such as `mainSceneFrame`, `sidePanelFrame`, `buttonPrimary`, `buttonSecondary`, `dialoguePanel`, `targetRing`, and `statusBadge` to the runtime asset registry, and record the primitive recipe table for asset source, fallback, stretch mode, safe-zone padding, and z-order.
- **Complexity**: 5
- **Dependencies**: Task 2.1
- **Acceptance Criteria**:
  - renderer code stops hardcoding low-level asset filenames inline before phase-specific rewrites expand
  - each primitive records asset source, fallback, stretch mode, padding safe-zone, and z-order
  - the scene shell explicitly binds to `featureView` / `fate-knots-view` where the design rules call for a shared close-up background
- **Validation**:
  - targeted UI helper unit coverage inside `game-room-fate-knots-ui-path-regressions.test.ts`
  - primitive recipe checklist

### Task 2.3: Build Asset-Backed Button And Card Primitives
- **Location**: `rooms/game-room/main-functions/fate-knots/ui/module.js`, `rooms/game-room/main-functions/fate-knots/styles.css`
- **Description**: Replace generic `fk-button`, `fk-option`, and `fk-choice` presentation with button-plate and card-slot driven primitives using current button/card/effect assets.
- **Complexity**: 7
- **Dependencies**: Task 2.2
- **Acceptance Criteria**:
  - primary and secondary actions have distinct asset-backed states
  - selected, disabled, and hover states use controlled overlays instead of app-like color fills
  - card actions still dispatch the same commands and payloads
- **Validation**:
  - UI path regressions for start, ready, choice, combat action, reset, and end-run

### Task 2.4: Add Dialogue, Log, And Status Primitive Families
- **Location**: `rooms/game-room/main-functions/fate-knots/ui/module.js`, `rooms/game-room/main-functions/fate-knots/styles.css`
- **Description**: Create reusable dialogue/log/status building blocks from the dialogue, status, and frame assets so log and status areas stop looking like plain text panels.
- **Complexity**: 6
- **Dependencies**: Task 2.2
- **Acceptance Criteria**:
  - log area no longer resembles a chat app or plain admin list
  - status chips are compact, readable, and reusable across narrative and combat
  - small state badges exist for future seat readiness and V2 turn ownership
- **Validation**:
  - DOM structure assertions in UI regressions
  - manual readability review checklist

### Task 2.5: Audit i18n Surface And Copy Inventory For New Labels
- **Location**: `rooms/game-room/i18n/tr.json`, `rooms/game-room/i18n/en.json`, `rooms/game-room/main-functions/fate-knots/ui/module.js`
- **Description**: Create an explicit copy inventory for new labels introduced by the visual redesign such as seat plaques, seat-state labels, dormant markers, status chips, badge labels, and alt/assistive labels, and keep them in room-local i18n rather than hardcoding them into the renderer.
- **Complexity**: 4
- **Dependencies**: Tasks 2.3-2.4
- **Acceptance Criteria**:
  - newly added visible copy for the refactor is sourced from existing room-local i18n files
  - the copy inventory is validated in both `en` and `tr`
  - renderer fallbacks stay minimal and do not become the primary source of visible copy
- **Validation**:
  - i18n key checklist plus targeted UI regression review

### Task 2.6: Add Early Installed-Copy UI Parity Gate
- **Location**: `data/rooms/game-room/**`, `scripts/tests/game-room-installed-host-runtime-smoke-regressions.test.ts`, installed UI smoke coverage under `scripts/tests/*`
- **Description**: Refresh the installed `game-room` copy once after the shared visual foundation lands and validate installed UI/CSS/asset references, not only the host import path.
- **Complexity**: 5
- **Dependencies**: Tasks 2.1-2.5
- **Acceptance Criteria**:
  - the installed `game-room` copy is refreshed once after the shared foundation lands
  - installed UI smoke loads the packaged Fate Knots UI entry, not only the host
  - referenced Fate Knots UI assets exist in the installed package
- **Validation**:
  - targeted installed smoke plus packaged asset parity assertions

## Sprint 3: Lobby And Character Creation Recomposition
**Goal**: Make the pre-run flow feel like gathering around a game table, not configuring a web form.
**Demo/Validation**:
- lobby matches the lobby SVG hierarchy
- character creation matches the preparation-table feeling from the creation SVG
- V2 seat placeholders are visible but dormant

### Task 3.1: Rebuild Lobby Around The Central Map
- **Location**: `rooms/game-room/main-functions/fate-knots/ui/module.js`, `rooms/game-room/main-functions/fate-knots/styles.css`
- **Description**: Make the map the dominant center surface, move participants into a narrower right rail, and place the start action in the lower-right action zone. Use map frame and marker assets for emphasis.
- **Complexity**: 7
- **Dependencies**: Sprint 2
- **Acceptance Criteria**:
  - the lobby exposes stable landmarks for `map-shell`, `right-rail`, and `start-zone`
  - the central map owns the dominant horizontal region at wireframe-scale desktop widths
  - the start action remains in the lower-right action zone without changing command behavior
- **Validation**:
  - existing overview UI path regression updated to new structure
  - manual wireframe alignment review

### Task 3.2: Add Dormant 4-Seat Lobby Plaques
- **Location**: `rooms/game-room/main-functions/fate-knots/ui/module.js`, `rooms/game-room/main-functions/fate-knots/styles.css`
- **Description**: Add reserved slot plaques for `user`, `ai1`, `ai2`, and `us1`, with V1 readiness states and a muted placeholder treatment for seats that are not live yet.
- **Complexity**: 5
- **Dependencies**: Task 3.1
- **Acceptance Criteria**:
  - all four seats are structurally present in the lobby with stable `data-seat-id` markers
  - dormant seats remain renderer-only and do not influence host-derived readiness or roster math
  - dormant seats are non-button and non-focusable in V1
- **Validation**:
  - DOM assertions for seat presence in UI tests

### Task 3.3: Recompose Character Creation As A Selection Table
- **Location**: `rooms/game-room/main-functions/fate-knots/ui/module.js`, `rooms/game-room/main-functions/fate-knots/styles.css`
- **Description**: Move avatar/class/background choices into a left-weighted selection table with summary, portrait, and selected build on the right. Use card template assets instead of plain option tiles.
- **Complexity**: 8
- **Dependencies**: Sprint 2
- **Acceptance Criteria**:
  - the creation screen exposes stable landmarks for `selection-table`, `summary-rail`, and `selection-actions`
  - the selected build summary remains calm and readable
  - ready/reset actions live near the summary action zone without changing payloads
- **Validation**:
  - current selection and ready UI regressions remain green
  - manual check against `ui_wireframe_character_create.svg`

### Task 3.4: Add Future Seat Selection Tabs As Dummy Objects
- **Location**: `rooms/game-room/main-functions/fate-knots/ui/module.js`, `rooms/game-room/main-functions/fate-knots/styles.css`
- **Description**: Reserve muted seat tabs or markers showing where V2 remote seat character setup will attach later, without enabling multi-seat editing in V1.
- **Complexity**: 4
- **Dependencies**: Task 3.3
- **Acceptance Criteria**:
  - a future seat-navigation affordance exists in the layout with stable `data-seat-id` hooks
  - only the current active V1 seat remains interactive
  - placeholder anchors are non-focusable in V1
- **Validation**:
  - DOM assertions for placeholder anchors

## Sprint 4: Scenario Screen And Narrative Decision Surface
**Goal**: Turn the scenario phase into a scene-led narrative surface with subordinate log and decision layers.
**Demo/Validation**:
- scenario screen follows the scenario SVG composition
- scene art and narrative dominate the upper field
- log and choices feel integrated, not like app widgets

### Task 4.1: Promote Scene Art To The Main Narrative Surface
- **Location**: `rooms/game-room/main-functions/fate-knots/ui/module.js`, `rooms/game-room/main-functions/fate-knots/styles.css`
- **Description**: Rebuild the scenario layout so the top scene area combines image, title, body, speaker, and attached world assets under a single framed stage.
- **Complexity**: 7
- **Dependencies**: Sprint 2
- **Acceptance Criteria**:
  - the scenario screen exposes stable landmarks for `scene-shell`, `story-feed`, and `decision-surface`
  - scenario image and text form one unified top region
  - attached NPC, item, and creature references appear as supporting world evidence, not as random cards
- **Validation**:
  - scenario UI regression updated for new DOM structure
  - manual review against `ui_wireframe_scenario.svg`

### Task 4.2: Rebuild The Log As A Calm Story Feed
- **Location**: `rooms/game-room/main-functions/fate-knots/ui/module.js`, `rooms/game-room/main-functions/fate-knots/styles.css`
- **Description**: Move the log into the lower-left narrative feed using dialogue panel assets, restrained speaker labeling, and compact event entries.
- **Complexity**: 5
- **Dependencies**: Task 4.1
- **Acceptance Criteria**:
  - log area does not resemble chat bubbles or a console list
  - speaker and system entries remain distinguishable
- **Validation**:
  - UI path regression assertions for log rendering

### Task 4.3: Rebuild Choice Cards As Decision Objects
- **Location**: `rooms/game-room/main-functions/fate-knots/ui/module.js`, `rooms/game-room/main-functions/fate-knots/styles.css`
- **Description**: Replace the generic choice button stack with decision objects that sit in the lower-right zone and visually connect to the current scene context.
- **Complexity**: 6
- **Dependencies**: Task 4.1
- **Acceptance Criteria**:
  - decision objects occupy the lower-right `decision-surface` with stable landmark hooks
  - unanimous vote state, selected state, and conflict state remain clear
  - sync/reset remain secondary controls
- **Validation**:
  - existing scenario command dispatch test remains green
  - vote count and conflict UI assertions are preserved

### Task 4.4: Add Dormant Scenario Portrait Anchors For 4 Seats
- **Location**: `rooms/game-room/main-functions/fate-knots/ui/module.js`, `rooms/game-room/main-functions/fate-knots/styles.css`
- **Description**: Reserve small portrait, vote-ring, or seat-marker anchors that can later show all four participants during narrative voting.
- **Complexity**: 4
- **Dependencies**: Tasks 4.2-4.3
- **Acceptance Criteria**:
  - the scenario layout already has reserved `data-seat-id` anchors for four participant presences
  - dormant anchors are renderer-only, non-button, and visually quiet in V1
- **Validation**:
  - placeholder DOM presence checks

## Sprint 5: Combat Surface And Future Turn-Order Anchors
**Goal**: Make combat feel like the same world in battle state, not a separate dashboard.
**Demo/Validation**:
- combat follows the combat SVG composition
- enemy stage dominates the top
- action hand occupies the bottom zone
- future turn-order and seat anchors exist without enabling V2 gameplay

### Task 5.1: Rebuild Combat Stage As A Shared World Space
- **Location**: `rooms/game-room/main-functions/fate-knots/ui/module.js`, `rooms/game-room/main-functions/fate-knots/styles.css`
- **Description**: Recompose combat into a top arena with enemy presence, scene frame, enemy feedback, and restrained combat markers using the combat FX and overlay assets.
- **Complexity**: 8
- **Dependencies**: Sprint 2
- **Acceptance Criteria**:
  - the combat screen exposes stable landmarks for `combat-arena`, `combat-status`, and `combat-hand`
  - enemy stage dominates the upper half
  - combat metrics stay secondary and readable without becoming a dashboard table
- **Validation**:
  - combat action UI regression remains green
  - manual review against `ui_wireframe_combat.svg`

### Task 5.2: Rebuild The Bottom Action Hand
- **Location**: `rooms/game-room/main-functions/fate-knots/ui/module.js`, `rooms/game-room/main-functions/fate-knots/styles.css`
- **Description**: Convert combat actions into a wide lower hand with card-slot visuals, action cost/status indicators, and a compact action log lane.
- **Complexity**: 7
- **Dependencies**: Task 5.1
- **Acceptance Criteria**:
  - combat actions render inside the lower `combat-hand` region as playable cards, not list buttons
  - disabled and waiting states remain obvious
  - action click behavior remains unchanged at the command layer
- **Validation**:
  - existing combat dispatch regression remains green

### Task 5.3: Add Turn-Order And Seat HUD Dummy Anchors
- **Location**: `rooms/game-room/main-functions/fate-knots/ui/module.js`, `rooms/game-room/main-functions/fate-knots/styles.css`
- **Description**: Add muted turn-order markers, seat chips, and empty combat slots for the future 4-seat combat model.
- **Complexity**: 5
- **Dependencies**: Tasks 5.1-5.2
- **Acceptance Criteria**:
  - the combat screen has reserved `data-seat-id` and turn-order anchors for four participant presences without layout rebuild
  - current V1 combat remains focused on the active seat only
  - dormant anchors are renderer-only and non-button
- **Validation**:
  - placeholder DOM presence checks in combat-phase UI tests

## Sprint 6: Result Screen, Responsive Polish, And Regression Hardening
**Goal**: Finish the UI family, lock the responsive behavior, and keep the visual refactor safe.
**Demo/Validation**:
- result screen matches the new visual family
- mobile/smaller widths remain usable without collapsing the scene-first hierarchy
- regression suites continue to protect behavior

### Task 6.1: Restyle The Result Phase Into The Same Visual Family
- **Location**: `rooms/game-room/main-functions/fate-knots/ui/module.js`, `rooms/game-room/main-functions/fate-knots/styles.css`
- **Description**: Replace the plain result panel with a framed resolution surface that reuses dialogue/status primitives and keeps reset/end-run actions visually consistent.
- **Complexity**: 4
- **Dependencies**: Sprint 2
- **Acceptance Criteria**:
  - result screen no longer feels like a fallback utility panel
  - run summary and follow-up hint remain easy to read
- **Validation**:
  - result phase UI regression remains green

### Task 6.2: Add Responsive Breakpoints Without Breaking Composition
- **Location**: `rooms/game-room/main-functions/fate-knots/styles.css`
- **Description**: Add breakpoint rules that preserve scene dominance and action placement across smaller desktop widths and constrained embedded room layouts.
- **Complexity**: 6
- **Dependencies**: Sprints 3-5
- **Acceptance Criteria**:
  - no phase collapses into stacked app cards at intermediate widths
  - side rails and action zones remain legible
  - any nested scroller introduced by responsive changes is explicitly named and regression-tested
- **Validation**:
  - manual Electron resize smoke later
  - targeted DOM structure checks stay stable

### Task 6.3: Expand UI Regression Coverage For Asset-Backed DOM Structure
- **Location**: `scripts/tests/game-room-fate-knots-ui-path-regressions.test.ts`
- **Description**: Extend the current UI regression suite so it checks the new primitive families, dummy anchors, and phase-specific structural landmarks in addition to command dispatch.
- **Complexity**: 6
- **Dependencies**: Sprints 3-5
- **Acceptance Criteria**:
  - tests assert presence of stable `data-fk-phase`, `data-fk-role`, and `data-seat-id` hooks for key landmarks
  - tests assert presence of scene frame, right rail, log surface, decision surface, combat hand, and future dummy anchors
  - scroll preservation assertion remains intact
- **Validation**:
  - `npx tsx --test scripts/tests/game-room-fate-knots-ui-path-regressions.test.ts`

### Task 6.4: Run Integrated Smoke Coverage For The Refactor
- **Location**: `scripts/tests/game-room-fate-knots-ui-path-regressions.test.ts`, `scripts/tests/game-room-fate-knots-host-regressions.test.ts`, `scripts/tests/game-room-installed-host-runtime-smoke-regressions.test.ts`, installed UI smoke coverage under `scripts/tests/*`
- **Description**: Run the relevant Fate Knots UI, host, installed-host, and installed-UI smoke suites to ensure the design refactor did not break the feature contract.
- **Complexity**: 3
- **Dependencies**: Task 6.3
- **Acceptance Criteria**:
  - UI command dispatch still works for every phase
  - host/runtime smoke still reaches the first scenario successfully
  - installed UI smoke and packaged asset parity pass after the refactor
- **Validation**:
  - targeted test run plus manual smoke checklist

### Task 6.5: Finalize Installed-Copy Refresh And Visual Sign-Off
- **Location**: `data/rooms/game-room/**`, implementation checklist only
- **Description**: Treat the installed-copy refresh as a final sign-off gate so workspace-only renderer changes do not hide a broken installed room package.
- **Complexity**: 2
- **Dependencies**: Task 6.4
- **Acceptance Criteria**:
  - the installed `game-room` copy is refreshed again before final visual verification
  - manual smoke includes opening the installed Fate Knots room and verifying the first visible phase renders with the new surface family
- **Validation**:
  - installed-copy smoke checklist recorded in implementation notes

### Task 6.6: Capture The Screenshot Matrix And Locale Flip Review
- **Location**: implementation checklist only
- **Description**: Capture the planned screenshot matrix for `overview`, `creation`, `scenario`, `combat`, and `result` at `1600x900`, one embedded width, and one locale flip so the CSS-heavy redesign has a concrete visual sign-off gate.
- **Complexity**: 3
- **Dependencies**: Task 6.5
- **Acceptance Criteria**:
  - the screenshot matrix is completed for the named phases and widths
  - one locale flip is included to catch copy-pressure layout issues
- **Validation**:
  - screenshot review checklist

## Testing Strategy
- Keep current behavior tests as the safety net:
  - `scripts/tests/game-room-fate-knots-ui-path-regressions.test.ts`
  - `scripts/tests/game-room-fate-knots-host-regressions.test.ts`
  - `scripts/tests/game-room-installed-host-runtime-smoke-regressions.test.ts`
  - installed UI smoke coverage under `scripts/tests/*`
- Add DOM structure assertions gradually per sprint instead of rewriting the full UI test in one jump
- Validate every phase against its matching SVG wireframe before moving on
- Use stable `data-fk-phase`, `data-fk-role`, and `data-seat-id` hooks so DOM assertions do not depend on fragile class names
- Reserve Electron screenshot smoke for implementation time after each major phase refactor
- Complete the screenshot matrix for `overview`, `creation`, `scenario`, `combat`, and `result` at `1600x900`, one embedded width, and one locale flip before final sign-off
- Refresh the installed `data/rooms/game-room/**` copy before final visual sign-off so workspace-only CSS changes do not mask packaging drift

## Potential Risks & Gotchas
- The current renderer may not expose enough semantic asset aliases; implementation could become filename-heavy without an alias helper layer
- Overusing decorative assets can reduce readability and break the “system second” rule
- The future 4-seat placeholders can clutter V1 or leak into logic if they are not kept renderer-only, non-interactive, and visually muted
- A large CSS rewrite could accidentally reintroduce scroll jumps or overflow traps inside the room shell
- If the asset-backed primitives are introduced without updating tests, the UI refactor may look correct but silently break command paths
- Responsive collapse is a real risk because the wireframes target 1600x900 proportions; intermediate widths need explicit layout choices
- New seat plaques, badges, and status labels can quietly bypass i18n if the visual refactor is implemented too quickly
- Installed host smoke alone is not enough; a packaged UI/CSS/asset break could slip through without installed UI parity coverage

## Mitigation Notes
- Build semantic UI asset helpers before spreading asset references across render functions
- Keep visual overlays restrained and treat text contrast as a first-class acceptance criterion
- Use placeholder opacity, inactive labels, and non-button semantics for V2 dummy anchors
- Preserve the existing scroll-state logic and extend tests instead of replacing them
- Refactor phase by phase so each screen stays demoable and testable
- Treat installed-copy refresh as part of the implementation definition of done, not an optional packaging step
- Do not add new nested scrollers unless they are explicitly justified, named, and regression-tested
- Use stable `data-fk-phase`, `data-fk-role`, and `data-seat-id` hooks to make DOM assertions durable across CSS refactors

## Rollback Plan
- Keep the current host/runtime contract untouched so UI changes remain reversible at the renderer layer
- Land the refactor in phase-based commits: foundation, lobby/create, scenario, combat, result/polish
- If a phase regresses badly, revert only that phase’s renderer and stylesheet changes while leaving the asset registry and tests intact
- If asset-backed styling proves unstable for a specific primitive, temporarily fall back to a thin CSS surface for that primitive only instead of rolling back the entire redesign
