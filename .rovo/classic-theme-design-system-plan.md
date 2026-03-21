# Plan: Classic Theme Design System Remediation

**Generated**: 2026-03-21
**Estimated Complexity**: High

## Overview
This plan turns the classic theme audit findings into a phased remediation program for the renderer CSS architecture.

The approach is:
- reduce global CSS leakage first,
- centralize hidden shared tokens and semantic theme aliases,
- refactor repeated scene-shell and page-shell patterns into reusable primitives,
- then remove stale or duplicate CSS with regression coverage.

This plan assumes the scope is limited to the classic renderer stack and classic-owned CSS surfaces:
- `src/styles/**`
- classic theme manager and related renderer pages
- shared scene wrappers that currently consume classic theme tokens

Important scope note:
- `src/index.html` behaves like a main shell with runtime page switching, so stylesheet splitting must respect hidden-page navigation and cannot assume every linked page stylesheet is accidental dead weight.

Out of scope:
- `ghost-agent/**`
- scene theme bundle content under `shared/themes/**`
- visual redesign or theme art replacement
- provider logic changes unrelated to CSS loading or theming

## Prerequisites
- Keep existing theme IDs and public theme behavior stable: `obsidian`, `ivory-lab`, `ember-console`.
- Preserve current user-facing markup contracts unless a sprint explicitly updates HTML and tests together.
- Use incremental commits so each sprint can be reverted independently.
- Treat global CSS dependency leaks as migration risks until entrypoint coverage is added.
- Prefer central token imports and reusable utility classes over page-local raw values.

## Sprint 1: Baseline, Scope Lock, and Guardrails
**Goal**: Freeze the current CSS architecture into measurable baselines before moving tokens or entrypoints.
**Demo/Validation**:
- Produce a page-to-stylesheet matrix for shell pages and standalone HTML entrypoints.
- Add regression coverage that will fail if classic CSS loading boundaries regress.
- Run the audit script and capture a baseline report for raw colors, duplicate gradients, and token leakage.

### Task 1.1: Map CSS Entrypoints and Runtime Ownership
- **Location**: `/home/raistlin/hayalet-ev/src/index.html`, `/home/raistlin/hayalet-ev/src/pages/*.html`, `/home/raistlin/hayalet-ev/src/styles/main.css`
- **Description**: Document CSS ownership across all renderer entry shapes, not only HTML `<link>` tags. Inventory Vite HTML inputs, `?raw` template imports, shell-injected fragments, embedded-in-scene fragments, and JS-generated markup/class producers so stylesheet ownership reflects real runtime behavior.
- **Complexity**: 3
- **Dependencies**: None
- **Acceptance Criteria**:
  - A definitive matrix exists for `index.html`, `archives.html`, `whisper.html`, `settings.html`, and `opencode-ui.html`.
  - The matrix also captures raw template imports and runtime-generated page/class producers from renderer TS modules.
  - Each CSS file or selector family is tagged as `shared shell`, `shell page-runtime`, `standalone page`, `embedded fragment`, `scene-specific`, or `candidate for deletion`.
- **Validation**:
  - Compare current `<link>` tags and `@import` chains against actual page markup usage.
  - Trace high-churn class producers in TS and raw HTML/template imports before assigning ownership.

### Task 1.2: Add CSS Entrypoint Regression Coverage
- **Location**: `/home/raistlin/hayalet-ev/scripts/tests/`, `/home/raistlin/hayalet-ev/scripts/tests/theme-classic-modularization-regressions.test.ts`
- **Description**: Add regression coverage that verifies classic shell entrypoints only load intended CSS bundles after the refactor, standalone pages continue to load only the files they need, and production build output preserves the intended stylesheet graph.
- **Complexity**: 5
- **Dependencies**: Task 1.1
- **Acceptance Criteria**:
  - Tests fail if `src/index.html` links page CSS that should be split later.
  - Tests fail if standalone pages lose required shared CSS such as `main.css`.
  - Validation also checks emitted renderer HTML and CSS references in `dist/renderer/**` after a production build.
- **Validation**:
  - Run the relevant `scripts/tests/*theme*` and new CSS entrypoint regression tests.
  - Run `npm run build` and assert the emitted HTML/CSS asset graph matches the intended ownership map.

### Task 1.3: Expand the Existing Design System Audit Script
- **Location**: `/home/raistlin/hayalet-ev/scripts/design-system-audit.mjs`
- **Description**: Extend the audit script so it can report raw colors outside approved token files, duplicate gradients, duplicate variable definitions, and consumers of `--scene-*` values that rely on non-obvious import order.
- **Complexity**: 5
- **Dependencies**: Task 1.1
- **Acceptance Criteria**:
  - The script reports violations grouped by file and category.
  - Approved token files can be allow-listed so the report stays actionable.
- **Validation**:
  - Run the script before and after later sprints and verify the report changes meaningfully.

### Task 1.4: Define the Target Token Taxonomy
- **Location**: `/home/raistlin/hayalet-ev/src/styles/design-system/tokens/`, `/home/raistlin/hayalet-ev/src/styles/design-system/themes/`
- **Description**: Decide the target ownership model for raw measurement tokens, semantic page aliases, scene shell aliases, and component-level override hooks before moving values across files.
- **Complexity**: 4
- **Dependencies**: Task 1.1
- **Acceptance Criteria**:
  - A target token map exists for `primitive`, `semantic theme`, `component alias`, and `page alias`.
  - The migration rules clarify what is allowed to stay page-local versus what must be centralized.
- **Validation**:
  - Cross-check the token map against the audit findings and the imported order in `src/styles/design-system/index.css`.

### Task 1.5: Add Runtime Selector Contract Guardrails
- **Location**: `/home/raistlin/hayalet-ev/scripts/tests/`, `/home/raistlin/hayalet-ev/src/js/pages/`, `/home/raistlin/hayalet-ev/src/js/modules/rooms/`
- **Description**: Add a small regression layer for selector families that are created or mutated in TS so later utility consolidation and dead CSS cleanup do not break JS/HTML coupling silently.
- **Complexity**: 5
- **Dependencies**: Task 1.1
- **Acceptance Criteria**:
  - High-churn selector families used by JS-generated markup are inventoried and covered by grep/static assertions or targeted tests.
  - The plan has an explicit contract list for selectors that must be treated as public runtime interfaces during the refactor.
- **Validation**:
  - Run the new selector contract tests alongside the theme modularization regressions.

## Sprint 2: Shared Token Extraction and Theme Contract Cleanup
**Goal**: Remove hidden stylesheet coupling and move shared visual constants into explicit, reusable token layers.
**Demo/Validation**:
- Shared scene scale tokens load without depending on `entrance/scene.css`.
- Duplicate token definitions are removed from components where a central token already exists.
- Theme files expose semantic aliases for repeated classic scene shell styling.

### Task 2.1a: Add Shared Scene Scale Tokens with Compatibility Aliases
- **Location**: `/home/raistlin/hayalet-ev/src/styles/entrance/scene.css`, `/home/raistlin/hayalet-ev/src/styles/design-system/tokens/`, `/home/raistlin/hayalet-ev/src/styles/design-system/index.css`
- **Description**: Introduce a new shared token file for `--scene-rem-*`, `--scene-px-*`, and `--scene-em-*`, import it before all consumers, and keep temporary compatibility definitions or aliases in the old location until migrations are complete.
- **Complexity**: 8
- **Dependencies**: Task 1.4
- **Acceptance Criteria**:
  - A shared scene-scale token file exists and is imported before all existing consumers.
  - Compatibility aliases prevent breakage while consumers are still being migrated.
- **Validation**:
  - Search for canonical `--scene-rem-*`, `--scene-px-*`, `--scene-em-*` definitions.
  - Run renderer pages that use scene shells and confirm variables resolve correctly after adding the new token file.

### Task 2.1b: Migrate Scene Token Consumers to the Shared Source
- **Location**: `/home/raistlin/hayalet-ev/src/styles/main.css`, `/home/raistlin/hayalet-ev/src/styles/server.css`, `/home/raistlin/hayalet-ev/src/styles/scene-system/*.css`, `/home/raistlin/hayalet-ev/src/styles/scene-editor/*.css`, `/home/raistlin/hayalet-ev/src/styles/assistant.css`, `/home/raistlin/hayalet-ev/src/styles/analyze.css`
- **Description**: Update all audited consumers so they intentionally depend on the shared scene-scale layer rather than the historical `entrance/scene.css` definition point.
- **Complexity**: 6
- **Dependencies**: Task 2.1a
- **Acceptance Criteria**:
  - Consumers in `main.css`, `server.css`, `scene-system/*.css`, and `scene-editor/*.css` no longer depend on `entrance.css` being loaded.
  - No migration step changes variable names and import order in the same commit without compatibility coverage.
- **Validation**:
  - Run the audit script and focused renderer smoke checks after each migration slice.

### Task 2.1c: Remove Legacy Scene Scale Definitions
- **Location**: `/home/raistlin/hayalet-ev/src/styles/entrance/scene.css`
- **Description**: Remove the legacy canonical `--scene-*` definitions from `entrance/scene.css` only after the shared token file is in place, consumers are migrated, and regression checks are green.
- **Complexity**: 4
- **Dependencies**: Tasks 2.1a, 2.1b
- **Acceptance Criteria**:
  - `entrance/scene.css` no longer acts as the hidden source of truth for shared scene-scale primitives.
  - Compatibility aliases are removed only after audit and tests are green.
- **Validation**:
  - Re-run the audit script and scene-related regression tests before deleting the legacy definitions.

### Task 2.2: Consolidate Duplicate Layout and Size Tokens
- **Location**: `/home/raistlin/hayalet-ev/src/styles/design-system/tokens/layout.css`, `/home/raistlin/hayalet-ev/src/styles/design-system/tokens/sizes.css`, `/home/raistlin/hayalet-ev/src/styles/design-system/components/toast.css`, `/home/raistlin/hayalet-ev/src/styles/design-system/components/navigation.css`
- **Description**: Remove duplicated component-local values such as `--toast-max-w` and align dropdown, toast, and panel measurements to a single source of truth.
- **Complexity**: 4
- **Dependencies**: Task 1.4
- **Acceptance Criteria**:
  - Component files do not redefine token values already owned by `tokens/`.
  - Measurements with shared meaning use one token name only.
- **Validation**:
  - Search for duplicate variable names and confirm only one canonical definition remains.

### Task 2.3: Split Theme Primitive Tokens from Feature-Specific Aliases
- **Location**: `/home/raistlin/hayalet-ev/src/styles/design-system/themes/theme-base.css`, `/home/raistlin/hayalet-ev/src/styles/design-system/themes/theme-obsidian.css`, `/home/raistlin/hayalet-ev/src/styles/design-system/themes/theme-ivory-lab.css`, `/home/raistlin/hayalet-ev/src/styles/design-system/themes/theme-ember-console.css`
- **Description**: Reorganize theme files so base palette and surface primitives remain separate from feature-specific aliases such as assistant chips, app-shell variants, and scene shell values.
- **Complexity**: 7
- **Dependencies**: Task 1.4
- **Acceptance Criteria**:
  - Theme files clearly distinguish primitive values from semantic aliases.
  - Repeated feature aliases are grouped by concern instead of being interleaved through the file.
  - New aliases exist for repeated classic scene shell surfaces where needed.
- **Validation**:
  - Theme diff review shows the new structure is easier to scan.
  - Theme switching still updates assistant and app-shell surfaces correctly.

### Task 2.4: Normalize Shared Field and Choice Override Hooks
- **Location**: `/home/raistlin/hayalet-ev/src/styles/design-system/components/inputs.css`, `/home/raistlin/hayalet-ev/src/styles/design-system/components/choices.css`, `/home/raistlin/hayalet-ev/src/styles/design-system/components/chat.css`, `/home/raistlin/hayalet-ev/src/styles/design-system/components/modals.css`, `/home/raistlin/hayalet-ev/src/styles/assistant.css`, `/home/raistlin/hayalet-ev/src/styles/archives.css`
- **Description**: Replace repeated local field and chip overrides with reusable variant tokens or utility modifiers so pages customize the shared components instead of redefining the same patterns ad hoc.
- **Complexity**: 7
- **Dependencies**: Task 2.2
- **Acceptance Criteria**:
  - Shared field styles expose documented override points for modal, chat, assistant, and archives variants.
  - Shared chip styles expose reusable dense, segmented, assistant, and archive variants without page-local duplication.
- **Validation**:
  - Compare generated CSS before and after for reduced duplicate field and chip rules.
  - Verify focus, hover, and active states still match prior behavior.

## Sprint 3: Shared Scene Shell and Surface Primitive Refactor
**Goal**: Replace repeated scene shell blocks with reusable utilities and semantic tokens while preserving page-specific behavior.
**Demo/Validation**:
- Assistant, server, analyze, entrance scene panels, and settings scene surfaces all consume a shared scene shell contract.
- Page-specific scene wrappers keep their unique layout geometry while sharing the same surface primitives.

### Task 3.1: Introduce Reusable Scene Shell Utilities
- **Location**: `/home/raistlin/hayalet-ev/src/styles/design-system/components/composites.css`, `/home/raistlin/hayalet-ev/src/styles/scene-system/`, `/home/raistlin/hayalet-ev/src/styles/design-system/themes/`
- **Description**: Create reusable classes or alias-driven patterns for scene topbars, scene panels, embedded scene page shells, and scene shade layers.
- **Complexity**: 8
- **Dependencies**: Tasks 2.1, 2.3
- **Acceptance Criteria**:
  - Shared scene shell primitives exist for topbars, content panels, panel shades, and framed embedded page shells.
  - Shared primitives are theme-driven rather than raw RGB-driven.
- **Validation**:
  - Compare assistant/server/analyze/entrance/settings styles and confirm the repeated blocks shrink materially.

### Task 3.2: Refactor Assistant and Server Scene Shells to Shared Primitives
- **Location**: `/home/raistlin/hayalet-ev/src/styles/assistant.css`, `/home/raistlin/hayalet-ev/src/styles/server.css`
- **Description**: Replace duplicated topbar and panel surface definitions with the shared scene shell contract while keeping separate frame geometry and page-specific layouts.
- **Complexity**: 7
- **Dependencies**: Task 3.1
- **Acceptance Criteria**:
  - Raw gradients and panel shadows repeated across assistant and server are removed or reduced to page aliases.
  - Only geometry and behavior stay page-local.
- **Validation**:
  - Visual compare assistant and server scene mode states in all three themes.

### Task 3.3: Refactor Analyze, Entrance, and Settings Embedded Scene Panels
- **Location**: `/home/raistlin/hayalet-ev/src/styles/analyze.css`, `/home/raistlin/hayalet-ev/src/styles/entrance/scene.css`, `/home/raistlin/hayalet-ev/src/styles/main.css`
- **Description**: Replace duplicated embedded panel shells and screen shades with shared scene panel utilities, preserving each page’s content layout and view switching.
- **Complexity**: 8
- **Dependencies**: Task 3.1
- **Acceptance Criteria**:
  - Embedded whisper, archives, and settings scene panel shells use common surface tokens.
  - Page-local CSS retains only layout geometry, slot placement, and page-specific exceptions.
- **Validation**:
  - Verify entrance whisper embed, analyze archives embed, and settings scene panel all render with the same shell contract.

### Task 3.4: Align Scene Editor and Scene System with Central Scene Tokens
- **Location**: `/home/raistlin/hayalet-ev/src/styles/scene-editor/index.css`, `/home/raistlin/hayalet-ev/src/styles/scene-editor/editor-panel.css`, `/home/raistlin/hayalet-ev/src/styles/scene-editor/debug-overrides.css`, `/home/raistlin/hayalet-ev/src/styles/scene-system/shell.css`, `/home/raistlin/hayalet-ev/src/styles/scene-system/clickable.css`
- **Description**: Remove ad hoc blur, radius, and measurement literals where a shared scene token or utility should own the value, and convert raw media queries to project breakpoints.
- **Complexity**: 7
- **Dependencies**: Task 2.1
- **Acceptance Criteria**:
  - Scene editor and scene system consume the shared scene scale tokens consistently.
  - The raw `@media (max-width: 720px)` usage is replaced with the shared custom media system.
- **Validation**:
  - Search for raw `@media (max-width:` in these files.
  - Confirm the editor panel still fits mobile and low-height viewports.

## Sprint 4: Page Stylesheet Splitting and Responsive Stabilization
**Goal**: Stop loading all page CSS globally and harden page responsiveness around centralized breakpoints and tokens.
**Demo/Validation**:
- Main shell only loads shared classic CSS and page CSS that is actually required at boot.
- Standalone pages still work with their smaller CSS sets.
- Narrow viewport layouts remain usable at `1240`, `1024`, `768`, `640`, `560`, and `480` widths.

### Task 4.1: Extract Shared Workspace and Page-Shell CSS from `main.css`
- **Location**: `/home/raistlin/hayalet-ev/src/styles/main.css`, `/home/raistlin/hayalet-ev/src/styles/design-system/components/`, `/home/raistlin/hayalet-ev/src/styles/*.css`
- **Description**: Move truly shared page-shell and workspace-shell rules out of `main.css` into explicit shared layers before pruning any shell-level stylesheet links. This includes shared wrappers that are currently overridden by embedded scene pages.
- **Complexity**: 8
- **Dependencies**: Tasks 2.4, 3.1, 3.3
- **Acceptance Criteria**:
  - Shared shells such as workspace/page wrappers are explicitly owned by a shared layer instead of implicitly by `main.css`.
  - Embedded scene pages no longer rely on accidental cascade inheritance from unrelated shell rules.
- **Validation**:
  - Diff `main.css` and confirm shared shells moved to a reusable layer without visual regressions in shell pages or embedded scene views.

### Task 4.2: Split Main Shell CSS from Page-Specific CSS
- **Location**: `/home/raistlin/hayalet-ev/src/index.html`, `/home/raistlin/hayalet-ev/src/pages/*.html`, `/home/raistlin/hayalet-ev/src/styles/main.css`, `/home/raistlin/hayalet-ev/vite.config.js`
- **Description**: Replace the current implicit CSS ownership model with an explicit one. If the main shell truly requires certain page styles for in-document navigation, keep them intentionally in the shell bundle; otherwise move them to standalone entrypoints or lazy page-level loading.
- **Complexity**: 9
- **Dependencies**: Tasks 1.1, 1.2, 1.5, 2.1c, 4.1
- **Acceptance Criteria**:
  - `src/index.html` links only CSS that is required for shell boot or hidden-page runtime navigation.
  - Standalone HTML entrypoints continue to load the minimum required shared CSS.
  - Any CSS kept global in the main shell is documented as an intentional runtime dependency, not an accidental leak.
- **Validation**:
  - Run the CSS entrypoint regression tests.
  - Open each page and verify that no page loses its styles due to removed global leakage.
  - Run `npm run build` and assert the emitted renderer HTML/CSS graph in `dist/renderer/**` matches the intended ownership map.

### Task 4.3: Stabilize Responsive Behavior After CSS Ownership Changes
- **Location**: `/home/raistlin/hayalet-ev/src/styles/main.css`, `/home/raistlin/hayalet-ev/src/styles/assistant.css`, `/home/raistlin/hayalet-ev/src/styles/server.css`, `/home/raistlin/hayalet-ev/src/styles/analyze.css`, `/home/raistlin/hayalet-ev/src/styles/archives.css`, `/home/raistlin/hayalet-ev/src/styles/whisper.css`
- **Description**: Recheck responsive behavior after the shared-shell extraction and stylesheet ownership split, then patch layout regressions exposed by the new ownership boundaries.
- **Complexity**: 6
- **Dependencies**: Tasks 4.1, 4.2
- **Acceptance Criteria**:
  - Narrow and medium viewport layouts remain usable after stylesheet ownership changes.
  - Any regressions caused by removed global leakage are fixed in the owning stylesheet rather than by reintroducing accidental coupling.
- **Validation**:
  - Manual smoke pass at target breakpoints across shell pages and standalone pages.

### Task 4.4: Convert Shared Hardcoded Measurements into Reusable Tokens
- **Location**: `/home/raistlin/hayalet-ev/src/styles/main.css`, `/home/raistlin/hayalet-ev/src/styles/design-system/tokens/layout.css`, `/home/raistlin/hayalet-ev/src/styles/design-system/tokens/sizes.css`, `/home/raistlin/hayalet-ev/src/styles/design-system/tokens/spacing.css`
- **Description**: Move repeated or shared viewport, spacing, and control measurements out of page files into token files when they represent reusable constraints rather than one-off local geometry.
- **Complexity**: 6
- **Dependencies**: Task 2.2
- **Acceptance Criteria**:
  - Shared values such as topbar gaps, relay line widths, modal widths, and repeated panel dimensions are owned centrally where appropriate.
  - Page files retain only truly page-specific geometry.
- **Validation**:
  - Diff the audited files and verify the number of raw `px`, `rem`, `vh`, and `vw` literals drops in shared surfaces.

### Task 4.5: Recheck Page Responsiveness After Entry Split
- **Location**: `/home/raistlin/hayalet-ev/src/styles/archives.css`, `/home/raistlin/hayalet-ev/src/styles/whisper.css`, `/home/raistlin/hayalet-ev/src/styles/assistant.css`, `/home/raistlin/hayalet-ev/src/styles/server.css`, `/home/raistlin/hayalet-ev/src/styles/entrance.css`, `/home/raistlin/hayalet-ev/src/styles/rooms.css`
- **Description**: Re-run responsive verification after CSS splitting, then patch any page that relied on a style leaking in from another stylesheet.
- **Complexity**: 7
- **Dependencies**: Tasks 4.2, 4.3, 4.4
- **Acceptance Criteria**:
  - All classic pages remain navigable and readable at target breakpoints.
  - No page depends on selectors defined only in another page’s stylesheet.
- **Validation**:
  - Manual smoke pass across the main shell and standalone pages at each target breakpoint.

## Sprint 5: Duplicate Surface Cleanup, Dead CSS Removal, and Regression Hardening
**Goal**: Remove stale or merged styles safely after the structural refactor lands.
**Demo/Validation**:
- The audit report shows fewer duplicate gradients, raw colors, and cross-file dependencies.
- Selector removals are backed by markup or JS usage checks.
- Shared components become easier to extend without page-local duplication.

### Task 5.1: Merge Near-Identical Surface Components
- **Location**: `/home/raistlin/hayalet-ev/src/styles/design-system/components/opencode-ui-tabs.css`, `/home/raistlin/hayalet-ev/src/styles/design-system/components/composites.css`, `/home/raistlin/hayalet-ev/src/styles/archives.css`
- **Description**: Consolidate near-identical surface items such as todo/file cards, archive/search result cards, and other repeated bordered surface blocks into reusable utility or component variants.
- **Complexity**: 6
- **Dependencies**: Tasks 2.4, 3.1
- **Acceptance Criteria**:
  - Repeated card skins share one primitive or modifier set.
  - Page files no longer carry multiple copies of the same surface recipe.
- **Validation**:
  - Compare merged rules visually and inspect the CSS diff for reduced duplication.

### Task 5.2: Perform Safe Dead Selector and File Cleanup
- **Location**: `/home/raistlin/hayalet-ev/src/styles/**`, `/home/raistlin/hayalet-ev/src/js/**`, `/home/raistlin/hayalet-ev/src/pages/**`
- **Description**: Remove selectors and page-local rules that became redundant after entrypoint splitting and primitive consolidation, but only after confirming they are not referenced by JS-generated markup.
- **Complexity**: 7
- **Dependencies**: Tasks 4.1, 5.1
- **Acceptance Criteria**:
  - Removed selectors are traceable to deleted markup, deleted runtime code, or merged primitives.
  - No JS-injected class or runtime template class is removed accidentally.
- **Validation**:
  - Search class names in `src/js`, `src/pages`, and HTML templates before deletion.
  - Re-run relevant smoke pages after cleanup.

### Task 5.3: Add Ongoing Regression Checks for Design System Hygiene
- **Location**: `/home/raistlin/hayalet-ev/scripts/design-system-audit.mjs`, `/home/raistlin/hayalet-ev/scripts/tests/`
- **Description**: Turn the audit findings into ongoing checks so future work does not reintroduce raw page gradients, duplicated shared tokens, or cross-page stylesheet coupling.
- **Complexity**: 5
- **Dependencies**: Tasks 1.3, 5.2
- **Acceptance Criteria**:
  - The audit script can be run as a repeatable hygiene check.
  - At least one regression test guards CSS entrypoint boundaries and one guards token centralization assumptions.
- **Validation**:
  - Run the test suite segments covering classic theme modularization and the audit script.

### Task 5.4: Final Theme and Page Sweep
- **Location**: `/home/raistlin/hayalet-ev/src/styles/design-system/themes/`, `/home/raistlin/hayalet-ev/src/styles/*.css`
- **Description**: Do a final pass across all classic pages and all classic themes to catch any regressions introduced by token or stylesheet ownership changes.
- **Complexity**: 4
- **Dependencies**: All prior tasks
- **Acceptance Criteria**:
  - `obsidian`, `ivory-lab`, and `ember-console` render correctly across classic pages.
  - Shared scene wrappers that still depend on classic theme tokens remain visually coherent.
- **Validation**:
  - Manual theme sweep across `entrance`, `assistant`, `analyze`, `archives`, `whisper`, `server`, `rooms`, `settings`, and `opencode-ui`.

## Testing Strategy
- Use the expanded audit script as the first line of static verification.
- Add targeted regression tests for CSS entrypoints and token ownership boundaries.
- Add targeted regression tests for runtime-generated selector contracts before consolidating shared component classes.
- Run focused existing regression suites around classic theme modularization after each sprint.
- Use `npm run build` as part of ownership validation whenever stylesheet entrypoints or Vite inputs are changed.
- Perform manual viewport sweeps at `1440`, `1240`, `1024`, `768`, `640`, `560`, and `480`.
- Perform manual theme sweeps for `obsidian`, `ivory-lab`, and `ember-console`.
- During cleanup sprints, search JS and HTML usage before deleting any selector that looks unused.

## Potential Risks & Gotchas
- CSS entrypoint splitting can expose pages that accidentally relied on unrelated global styles.
- The main shell may intentionally need some page CSS for hidden-page navigation, so aggressive stylesheet removal from `index.html` could break in-app page switching.
- Shared shells currently owned by `main.css` may need to be extracted before any page-level link pruning, otherwise embedded scene pages can lose base layout styles.
- Moving `--scene-*` primitives may break import order assumptions in scene-system and scene-editor code if the new token file is imported in the wrong place.
- Removing `entrance/scene.css` as the hidden `--scene-*` source of truth in one pass is risky; compatibility aliases should stay until consumers and tests are migrated.
- Shared primitive refactors may change selector specificity and accidentally alter hover/focus behavior.
- Over-centralizing page-local visuals can erase intentional differences between assistant, server, analyze, and entrance scene experiences.
- Static dead CSS analysis can miss runtime-generated classes from JS templates and controllers.
- Source HTML checks are insufficient for ownership validation because Vite may rewrite or merge stylesheet boundaries in the production output.
- Theme alias cleanup can create regressions if primitive and semantic tokens are renamed in the same sprint without temporary compatibility aliases.
- Responsive cleanup should be done after token extraction, otherwise breakpoint work may need to be redone once measurements move.

## Rollback Plan
- Land each sprint in separate commits or branches so changes can be reverted independently.
- Keep temporary compatibility aliases when moving major variables such as `--scene-*` or feature-specific theme aliases.
- Split entrypoint changes from selector cleanup so loading regressions can be rolled back without restoring dead CSS.
- If a shared primitive refactor introduces visual regressions, restore the page-local alias layer first and retry consolidation in smaller slices.
- Preserve the audit script and regression tests even if an implementation slice is rolled back; they remain useful guardrails.
