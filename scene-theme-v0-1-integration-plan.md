# Plan: Scene Theme v0.1 Entrance Bootstrap

**Generated**: 2026-03-16
**Estimated Complexity**: High

## Overview
Add a startup-only UI mode split (`classic` / `scene`) without disturbing the existing classic shell, slot runtime, or page controllers. The lowest-risk path is to keep the current renderer boot, `EntranceHallController`, `SlotController`, `TrafficManager`, and page navigation intact, then layer a scene-specific loading overlay and entrance scene on top of the existing entrance DOM only when startup mode is `scene`.

This keeps Analyze, Assistant, Server, Archives, Whisper, and Settings on their current classic implementations while allowing scene mode to own only:
- startup loading overlay
- entrance background
- 6 door hotspots
- account-to-character rendering
- character state presentation
- character mini menu
- assign + connect action

## Plan Assumptions
- Recommended v0.1 scope: scene characters are driven by `settings.accounts` AI-provider entries plus active remote-email identities eligible for `us1`.
- Recommended low-risk default: `assistantSlot` / `ai0` stays a door destination, not a spawned entrance character, because current connection rules in scope only cover `ai1`, `ai2`, and `us1`.
- `npm start` should remain classic-safe by default. If literal `npm start classic` syntax is required, wrapper arg handling will be added, but npm CLI forwarding may still require `--` on some setups.
- Existing `data-theme` palette logic must stay separate from the new UI mode; scene mode should use a new startup flag plus a separate DOM attribute such as `data-ui-mode`.

## Prerequisites
- Scene assets already exist under `src/assets/themes/castle/`.
- Current startup flag flow is already wired through Electron main -> preload -> renderer.
- Entrance runtime already has stable integration points for settings, slots, webviews, traffic, and page navigation.
- Validation commands expected during implementation:
  - `npx tsx --test scripts/tests/startup-flags-regressions.test.ts`
  - `npx tsx --test scripts/tests/ghost-wrapper-runtime.test.ts`
  - `npm run check-types`
  - targeted entrance/scene regression tests to be added in this work

## File Plan

### Existing Files Likely To Change
- `package.json`
- `scripts/ghost-agent-wrapper.mjs`
- `scripts/lib/ghost-wrapper-runtime.mjs`
- `electron/startup-flags.ts`
- `electron/preload.cjs`
- `src/index.html`
- `src/js/app/index.ts`
- `src/js/ui/splash-screen.ts`
- `src/pages/entrance.html`
- `src/js/pages/entrance.ts`
- `src/js/pages/entrance/us1-panel.ts`
- `src/styles/entrance.css`
- `src/styles/design-system/components/splash.css`
- `scripts/tests/startup-flags-regressions.test.ts`
- `scripts/tests/ghost-wrapper-runtime.test.ts`

### Existing Files Possibly Touched Only If Needed
- `src/js/app/navigation.ts`
- `src/js/pages/entrance/webview-panel.ts`
- `src/styles/entrance/slot.css`
- `src/styles/main.css`

### New Modules Recommended
- `src/js/ui/ui-mode.ts`
- `src/js/ui/scene-loading-overlay.ts`
- `src/js/pages/entrance/scene/scene-controller.ts`
- `src/js/pages/entrance/scene/scene-config.ts`
- `src/js/pages/entrance/scene/scene-hotspots.ts`
- `src/js/pages/entrance/scene/scene-character-roster.ts`
- `src/js/pages/entrance/scene/scene-character-state.ts`
- `src/js/pages/entrance/scene/scene-character-menu.ts`
- `src/js/pages/entrance/scene/scene-connect-actions.ts`
- `src/styles/entrance/scene.css`
- `scripts/tests/scene-mode-regressions.test.ts`
- `scripts/tests/scene-entrance-connect-regressions.test.ts`

## Sprint 1: Startup Mode Contract
**Goal**: Introduce a safe `classic` vs `scene` startup contract while keeping the current app launch and classic behavior intact.
**Demo/Validation**:
- `npm start` still opens classic mode with no visual change.
- `npm run start:scene` reaches the renderer with a scene startup flag.
- Existing startup flag and wrapper runtime tests still pass.

### Task 1.1: Extend Startup Flags End-To-End
- **Location**: `package.json`, `scripts/ghost-agent-wrapper.mjs`, `scripts/lib/ghost-wrapper-runtime.mjs`, `electron/startup-flags.ts`, `electron/preload.cjs`
- **Description**: Add a startup-only UI mode field to the existing launch flag chain so Electron main, preload, and renderer all agree on `classic` vs `scene`.
- **Complexity**: 5
- **Dependencies**: None
- **Acceptance Criteria**:
  - Launch args can represent `scene` without breaking existing `startPage` or `autoConnect` handling.
  - `npm start` continues to behave as classic.
  - `npm run start:scene` injects the scene startup mode without affecting ghost/app mode transitions.
- **Validation**:
  - Update and run `scripts/tests/startup-flags-regressions.test.ts`.
  - Update and run `scripts/tests/ghost-wrapper-runtime.test.ts`.

### Task 1.2: Add Renderer UI Mode Bootstrap
- **Location**: `src/js/app/index.ts`, `src/js/ui/ui-mode.ts`, `src/index.html`
- **Description**: Read the startup flag in the renderer, normalize it once, and publish it via a dedicated DOM attribute and helper API before entrance/page rendering begins.
- **Complexity**: 4
- **Dependencies**: Task 1.1
- **Acceptance Criteria**:
  - Renderer exposes a single source of truth for UI mode.
  - `data-ui-mode="scene"` and `data-ui-mode="classic"` can be targeted from CSS/DOM logic.
  - No runtime theme switch API is added.
- **Validation**:
  - Manual DOM check in devtools.
  - Typecheck for the new helper API.

### Task 1.3: Keep Theme Palette Logic Separate
- **Location**: `src/js/ui/ui-mode.ts`, `src/js/app/index.ts`, optional CSS selectors only
- **Description**: Explicitly isolate the new UI mode from existing `ThemeManager` / `data-theme` so palette themes remain classic theming and scene mode becomes a separate concern.
- **Complexity**: 2
- **Dependencies**: Task 1.2
- **Acceptance Criteria**:
  - No new scene logic depends on `ThemeManager.current`.
  - Existing theme dropdown behavior remains untouched.
- **Validation**:
  - Manual check that theme selection still works in classic pages.

## Sprint 2: Loading Overlay
**Goal**: Reuse the existing splash API surface, but let scene mode render the 4-frame castle door loading sequence before entrance appears.
**Demo/Validation**:
- Classic mode still shows the current splash.
- Scene mode shows the door animation, progress text, and transitions out cleanly.

### Task 2.1: Turn SplashScreen Into a Mode-Aware Facade
- **Location**: `src/js/ui/splash-screen.ts`, `src/js/ui/scene-loading-overlay.ts`
- **Description**: Keep the existing `SplashScreen.show/update/complete/hide` API, but delegate to a scene-specific renderer when UI mode is `scene`.
- **Complexity**: 6
- **Dependencies**: Sprint 1
- **Acceptance Criteria**:
  - `src/js/app/index.ts` call sites stay nearly unchanged.
  - Scene mode uses the same progress/status lifecycle as classic mode.
  - Minimum display timing and hide animation rules still apply.
- **Validation**:
  - Manual startup check in both modes.
  - Typecheck on the facade implementation.

### Task 2.2: Add Scene Loading Markup and Styling
- **Location**: `src/styles/design-system/components/splash.css`, optional additions in `src/index.html` only if static markup is preferred
- **Description**: Introduce castle door frame animation styling, scene-specific layout tokens, and a safe z-index/lifecycle that does not conflict with existing overlays.
- **Complexity**: 4
- **Dependencies**: Task 2.1
- **Acceptance Criteria**:
  - Loading door assets are referenced in a renderer-safe way.
  - Progress text remains readable and localizable.
  - Overlay removal does not leave dead DOM or duplicate splash nodes.
- **Validation**:
  - Visual smoke check on desktop and narrow viewport.

### Task 2.3: Verify Asset Loading Strategy
- **Location**: `src/js/ui/scene-loading-overlay.ts`
- **Description**: Decide and implement the static asset access pattern for the four loading frames, preferring Vite-bundled URLs for static scene assets instead of runtime `readFile`.
- **Complexity**: 3
- **Dependencies**: Task 2.1
- **Acceptance Criteria**:
  - Door frames load in dev and prod builds.
  - No `electronAPI.readFile` dependency is introduced for static scene assets.
- **Validation**:
  - Manual dev run plus build sanity check.

## Sprint 3: Entrance Scene Shell
**Goal**: Add a scene stage to the entrance page while preserving the current entrance runtime, mounts, and classic DOM wiring behind it.
**Demo/Validation**:
- In scene mode, the entrance background renders and door hotspots are clickable.
- In classic mode, the current entrance layout remains unchanged.
- Slot/webview runtime still initializes successfully.

### Task 3.1: Add Scene DOM Skeleton Without Breaking Existing IDs
- **Location**: `src/pages/entrance.html`, `src/styles/entrance.css`, `src/styles/entrance/scene.css`
- **Description**: Add a scene stage, hotspot layer, character layer, and menu container as additive DOM around the current entrance content. Do not rename or reparent the existing `ai1/ai2/us1` IDs that current panels depend on.
- **Complexity**: 7
- **Dependencies**: Sprint 2
- **Acceptance Criteria**:
  - Existing `getElementById` bindings still work.
  - The classic slot grid remains present for runtime support.
  - Scene stage can visually replace entrance presentation only in scene mode.
- **Validation**:
  - Manual inspection that existing entrance buttons/selects still exist in DOM.
  - `EntranceHallController.init()` completes without null-reference regressions.

### Task 3.2: Preserve Webview Mount Safety In Scene Mode
- **Location**: `src/pages/entrance.html`, `src/styles/entrance/scene.css`, optional `src/js/pages/entrance/webview-panel.ts`
- **Description**: Keep `ai1-webview-mount` and `ai2-webview-mount` available and mounted even when the user is looking at the scene, avoiding `display:none` patterns that could break webview lifecycle assumptions.
- **Complexity**: 6
- **Dependencies**: Task 3.1
- **Acceptance Criteria**:
  - `SlotController.ensureWebviewMounted` and `ensureWebviewAttached` continue to work.
  - Scene mode does not break connect/disconnect flow for AI slots.
- **Validation**:
  - Manual connect/disconnect smoke test on `ai1` and `ai2` in scene mode.

### Task 3.3: Implement Hotspot Configuration and Navigation Bridge
- **Location**: `src/js/pages/entrance/scene/scene-config.ts`, `src/js/pages/entrance/scene/scene-hotspots.ts`, `src/js/pages/entrance.ts`
- **Description**: Define 6 hotspot rectangles plus actions and wire them to existing navigation/events instead of creating a new routing system.
- **Complexity**: 5
- **Dependencies**: Task 3.1
- **Acceptance Criteria**:
  - Analyze, Archives, Server, Whisper, Assistant, and Settings actions use existing navigation/events.
  - Settings hotspot opens the current settings overlay through `settings-hub:open`.
  - No new page controller type is introduced.
- **Validation**:
  - Manual click-through of all 6 hotspots.
  - New regression test for hotspot action mapping.

### Task 3.4: Scene Controller Integration
- **Location**: `src/js/pages/entrance.ts`, `src/js/pages/entrance/scene/scene-controller.ts`
- **Description**: Compose a scene controller into `EntranceHallController` and activate it only in scene mode, leaving classic panel initialization untouched.
- **Complexity**: 5
- **Dependencies**: Tasks 3.1-3.3
- **Acceptance Criteria**:
  - Scene controller can mount, render, and tear down through entrance lifecycle hooks.
  - `onShow()` refreshes scene state from settings without duplicating classic controller logic.
- **Validation**:
  - Manual entrance show/hide cycle via page navigation.

## Sprint 4: Character Roster And Visual State
**Goal**: Render entrance characters from the existing account model and map their visual states from the current slot + traffic runtime.
**Demo/Validation**:
- All eligible accounts appear as characters on the entrance scene.
- Avatar head placement uses the supplied body asset plus runtime avatar imagery.
- Character positions remain stable while states change.

### Task 4.1: Build Scene Character Roster Resolver
- **Location**: `src/js/pages/entrance/scene/scene-character-roster.ts`, optional `src/js/pages/entrance/scene/scene-config.ts`
- **Description**: Resolve which accounts become scene characters and assign each a stable scene position keyed by account identity rather than slot occupancy.
- **Complexity**: 6
- **Dependencies**: Sprint 3
- **Acceptance Criteria**:
  - AI provider accounts can be listed even when not assigned to a slot.
  - Active remote-email identities eligible for `us1` are represented correctly.
  - Character positions remain unchanged when slot assignment changes.
- **Validation**:
  - Unit/regression test for roster derivation from settings snapshots.

### Task 4.2: Implement Character Body + Avatar Composition
- **Location**: `src/js/pages/entrance/scene/scene-controller.ts`, `src/styles/entrance/scene.css`
- **Description**: Render the supplied body asset as a static base and place the runtime avatar into a head slot overlay using the same safe data-URL strategy already used elsewhere for avatars.
- **Complexity**: 5
- **Dependencies**: Task 4.1
- **Acceptance Criteria**:
  - Head avatar renders independently from the body asset.
  - Missing avatar falls back gracefully.
  - Mobile and desktop layouts remain readable.
- **Validation**:
  - Manual visual review with accounts that have and do not have avatars.

### Task 4.3: Bridge Slot And Traffic State Into Scene State Classes
- **Location**: `src/js/pages/entrance/scene/scene-character-state.ts`, `src/js/pages/entrance.ts`
- **Description**: Map existing runtime data into scene classes: `inactive`, `connected`, `loading`, `thinking`. Reuse `SettingsManager.subscribe`, `SlotController.on(SlotEvent.STATE_CHANGED)`, `TrafficManager.onUpdate`, and `us1` connection state.
- **Complexity**: 7
- **Dependencies**: Tasks 4.1-4.2
- **Acceptance Criteria**:
  - Character state is derived from current assignment plus runtime status, not from ad hoc flags.
  - Slot activation changes class only; it does not change the character position.
  - `thinking` and `loading` override `connected` visually when active.
- **Validation**:
  - Manual connect/loading/thinking checks for AI slots.
  - Manual connect/loading checks for US1.
  - Regression test for state priority mapping.

## Sprint 5: Character Menu And Assign + Connect
**Goal**: Let scene characters open a small action menu and reuse current connection machinery for assignment + connect.
**Demo/Validation**:
- Clicking a character opens a mini menu.
- Connect assigns the correct slot and starts the existing connection flow.
- Connect is disabled when no eligible slot exists.

### Task 5.1: Implement Scene Character Menu Component
- **Location**: `src/js/pages/entrance/scene/scene-character-menu.ts`, `src/styles/entrance/scene.css`, optional `src/pages/entrance.html`
- **Description**: Build a lightweight anchored menu for scene characters instead of reusing the full modal system.
- **Complexity**: 5
- **Dependencies**: Sprint 4
- **Acceptance Criteria**:
  - Menu opens on character click and closes on outside click/Escape.
  - Menu can display action-disabled states and reasons.
  - No interference with whisper/settings overlays.
- **Validation**:
  - Manual interaction test with keyboard and mouse.

### Task 5.2: Add AI Slot Resolution Logic
- **Location**: `src/js/pages/entrance/scene/scene-connect-actions.ts`
- **Description**: Resolve AI characters to their current assigned slot if present, otherwise the first empty AI slot (`ai1` then `ai2`). Disable connect when both AI slots are occupied by different accounts.
- **Complexity**: 6
- **Dependencies**: Task 5.1
- **Acceptance Criteria**:
  - AI account already assigned to `ai1` or `ai2` reconnects on its existing slot.
  - Unassigned AI account selects the first empty AI slot.
  - No slot available => menu action disabled.
- **Validation**:
  - Regression tests for slot resolution matrix.

### Task 5.3: Add US1 Resolution Logic
- **Location**: `src/js/pages/entrance/scene/scene-connect-actions.ts`, `src/js/pages/entrance/us1-panel.ts`
- **Description**: Route remote identities only to `us1`, reusing current `us1` settings and sync flow instead of pushing them through `SlotController`.
- **Complexity**: 6
- **Dependencies**: Task 5.1
- **Acceptance Criteria**:
  - Active remote identity can bind and connect through the existing `us1` flow.
  - If `us1` is occupied by a different remote identity, connect is disabled or clearly blocked.
  - No attempt is made to call `CoreEngine.setConnection("us1")`.
- **Validation**:
  - Manual US1 scene connect test.
  - Regression test for US1 eligibility logic.

### Task 5.4: Reuse Existing Connect/Disconnect Machinery
- **Location**: `src/js/pages/entrance.ts`, `src/js/pages/entrance/us1-panel.ts`, `src/js/pages/entrance/scene/scene-connect-actions.ts`
- **Description**: After scene assignment writes the correct settings path, call the existing connection APIs (`connectUser`, `CoreEngine.setConnection`, or a new public US1 bridge method) so logging, resume URL, remembered connection state, and traffic lifecycle remain centralized.
- **Complexity**: 7
- **Dependencies**: Tasks 5.2-5.3
- **Acceptance Criteria**:
  - Scene connect uses current connection side effects instead of duplicating them.
  - Resume URL and remembered connection state behavior for AI slots still works.
  - US1 keeps using its message sync path.
- **Validation**:
  - Manual connect/disconnect flow for AI and US1.
  - New regression tests around assignment + connect helpers.

## Testing Strategy
- Keep current startup-flag and wrapper tests green:
  - `scripts/tests/startup-flags-regressions.test.ts`
  - `scripts/tests/ghost-wrapper-runtime.test.ts`
- Add pure helper tests for:
  - scene roster derivation
  - hotspot action mapping
  - AI slot resolution
  - US1 eligibility resolution
  - scene state priority mapping
- Run renderer safety checks after each sprint:
  - `npm run check-types`
  - targeted `npx tsx --test` suites
- Manual smoke checklist per sprint:
  - classic startup unchanged
  - scene startup overlay appears and exits
  - entrance scene shows background + doors
  - hotspot routes open existing pages/overlay
  - characters spawn with stable positions
  - connect actions respect slot availability and existing flows

## Potential Risks & Gotchas
- `slot-grid` and `ai1/ai2` mount nodes cannot simply disappear or be aggressively reparented; `WebviewPanel` and `SlotController` rely on stable IDs and existing mount targets.
- `us1` is not managed by `SlotController`; it has separate settings and sync rules. Treat it as a special bridge, not as another slot-controller slot.
- Reusing `data-theme` for scene mode would entangle runtime palette switching with startup-only UI mode and create avoidable regressions.
- The scene menu must coexist with whisper/settings overlays and should not reuse overlay class names already used by webview gating or scenario overlays.
- Static scene assets should use a bundler-safe asset path strategy; avatar imagery should continue using the existing runtime `readFile -> data URL` approach.
- Literal `npm start classic` behavior depends on npm argument forwarding. The safe contract is `npm start` for classic plus `npm run start:scene` for scene; explicit classic argv support can be added but should not replace the default-safe path.
- If assistant `ai0` later needs to appear as a spawned character, that should be a follow-up phase because its assignment and connect UX is separate from the v0.1 rules in scope.

## Rollback Plan
- Remove the new startup mode flag while leaving `classic` as the default launch path.
- Delete scene-only modules and CSS imports.
- Remove scene-specific entrance DOM wrappers while preserving original IDs and classic markup.
- Restore `SplashScreen` to a single classic renderer if the scene loader proves unstable.
- Keep tests for startup flags and wrapper runtime focused so the classic launch path remains protected even if the scene branch is disabled.
