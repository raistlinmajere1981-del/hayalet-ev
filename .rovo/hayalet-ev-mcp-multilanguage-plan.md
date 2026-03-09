# Plan: Hayalet-ev and MCP Multi-language Support

**Generated**: 2026-03-08
**Estimated Complexity**: High

## Overview
Build a single i18n architecture for the Hayalet-ev renderer, Electron main process, and MCP server with these rules:

- Code-side identifiers, filenames, and comments are normalized to English across the Hayalet-ev main app and MCP server scope.
- User-facing UI, logs, and MCP responses support at least Turkish and English.
- Default language stays Turkish.
- Languages are stored in folder-based packs and can be either single-file or split across multiple files.
- Users can add their own language packs.

The current branch already contains partial groundwork:

- Shared locale and catalog helpers exist in `shared/i18n/`.
- Renderer i18n bootstrap exists in `src/js/modules/i18n/index.ts`.
- Electron language IPC handlers exist in `electron/handlers/ipc-i18n.ts`.
- MCP language helpers exist in `src/mcp-server/utils/i18n/index.ts`.
- Provider UI language strategy metadata already exists in provider configs and `electron/webview-preload.cjs`.

The real gap is coverage and consistency, not raw capability. Renderer surfaces are only partially localized, logger APIs are still string-first, and MCP i18n is largely unused.

## Current-State Audit
- `src/types/i18n.ts` already allows extensible locale strings, but selector behavior still collapses to `tr | en`.
- Built-in catalogs are embedded in `shared/i18n/bundled-languages.ts`, not stored in a folder layout yet.
- External language packs are already expected under `data/shared/languages/<locale>/`.
- The Entrance page and many renderer modules still contain hardcoded Turkish strings in HTML and TS.
- `src/js/modules/logger/Logger.ts` and `electron/logger/core/LoggerCore.ts` are message-string based, which makes new log localization inconsistent and hard to audit.
- `src/mcp-server/utils/i18n/index.ts` exists, but only one direct usage path is present today.
- Existing Turkish identifiers/comments are spread across renderer, Electron, and MCP files, so code-language cleanup must be treated as a dedicated migration track.

## Prerequisites
- Keep Turkish (`tr`) as the immutable fallback language.
- Treat provider selector language and provider UI language as separate concerns.
- Execute the Turkish-to-English code migration in explicit module batches instead of one repo-wide rename pass.

## Proposed Language Layout
Use one folder convention for bundled and external packs.

- Bundled packs:
  - `shared/languages/tr/manifest.json`
  - `shared/languages/tr/index.json`
  - or `shared/languages/tr/*.json`
  - same structure for `en`
- User packs:
  - `data/shared/languages/<locale>/manifest.json`
  - `data/shared/languages/<locale>/index.json`
  - or `data/shared/languages/<locale>/*.json`

Recommended split for multi-file packs:
- `app.json`
- `pages.entrance.json`
- `pages.asistan.json`
- `pages.opencode-ui.json`
- `logs.renderer.json`
- `logs.main.json`
- `logs.mcp.json`
- `mcp-tools.json`
- `providers.json`

Recommended manifest fields:
- `locale`
- `nativeName`
- `englishName`
- `direction`
- `selectorLanguage`
- `description`
- `version`

## Sprint 1: Normalize the Foundation
**Goal**: Turn the current partial i18n work into one canonical runtime model.
**Demo/Validation**:
- App starts with Turkish default.
- Renderer, Electron, and MCP can resolve one shared key for `tr` and `en`.
- A bundled pack and an external pack are both discoverable from the same registry flow.

### Task 1.1: Replace embedded built-in catalogs with folder-based packs
- **Location**: `shared/i18n/`, `shared/languages/`
- **Description**: Move built-in TR/EN catalogs out of `shared/i18n/bundled-languages.ts` into a folder format that matches external packs. Keep a small loader-only TS layer.
- **Dependencies**: None
- **Acceptance Criteria**:
  - Built-in and external packs share the same loading contract.
  - `bundled-languages.ts` becomes registry glue, not the catalog source of truth.
- **Validation**:
  - Unit tests for bundled pack discovery and load order.

### Task 1.2: Unify the language registry API
- **Location**: `shared/i18n/`, `electron/i18n/`, `electron/handlers/ipc-i18n.ts`, `src/mcp-server/utils/i18n/index.ts`
- **Description**: Expose one registry shape for renderer, Electron, and MCP. Add pack validity metadata and restart-required metadata for external packs.
- **Dependencies**: Task 1.1
- **Acceptance Criteria**:
  - Renderer and MCP list the same installed languages.
  - Broken packs are skipped without breaking startup.
- **Validation**:
  - Integration test for language listing and invalid-pack handling.

### Task 1.3: Separate app locale from selector locale
- **Location**: `shared/i18n/locale.ts`, `src/types/i18n.ts`, provider config types
- **Description**: Keep free-form app locale support, but explicitly map unsupported locales to selector locales for provider automation.
- **Dependencies**: Task 1.2
- **Acceptance Criteria**:
  - `general.language` accepts custom locales.
  - Provider selectors still resolve safely to supported automation locales.
- **Validation**:
  - Tests for `tr`, `en`, and a custom locale such as `de`.

### Task 1.4: Create the Turkish-code migration inventory
- **Location**: `src/**`, `electron/**`, `shared/**`, `src/mcp-server/**`
- **Description**: Build a module-by-module inventory of existing Turkish identifiers, filenames, comments, and exported symbols. Classify each item as safe rename, compatibility rename, or deferred rename.
- **Dependencies**: Task 1.2
- **Acceptance Criteria**:
  - Every affected module is assigned a rename strategy.
  - External contracts that need compatibility shims are explicitly listed.
- **Validation**:
  - Inventory document plus grep-based baseline snapshot.

## Sprint 2: Localize the Renderer
**Goal**: Make Hayalet-ev user-facing renderer text registry-driven and language-switchable.
**Demo/Validation**:
- Changing language updates visible renderer text.
- Default Turkish remains intact on a clean install.
- A custom pack appears in the language selector after restart.

### Task 2.1: Finish the renderer i18n binding
- **Location**: `src/js/app/index.ts`, `src/js/app/page-init.ts`, `src/js/modules/i18n/index.ts`, `src/js/modules/settings-manager.ts`
- **Description**: Make the renderer treat `AppI18n` as the single source of truth and remove ad hoc page-local language assumptions.
- **Dependencies**: Sprint 1
- **Acceptance Criteria**:
  - Pages do not read raw `general.language` for text decisions.
  - Language changes trigger deterministic UI refreshes.
- **Validation**:
  - Manual page-switch smoke test.

### Task 2.2: Migrate Entrance and shared shell UI
- **Location**: `src/pages/entrance.html`, `src/js/pages/entrance/**`, `src/index.html`, top-bar/navigation modules
- **Description**: Replace hardcoded text, labels, hints, statuses, and placeholder content with translation keys.
- **Dependencies**: Task 2.1
- **Acceptance Criteria**:
  - Entrance no longer hardcodes Turkish UI labels.
  - Shared shell surfaces follow the selected language.
- **Validation**:
  - Visual check in TR and EN.

### Task 2.3: Finish Asistan and OpenCode UI localization
- **Location**: `src/pages/asistan.html`, `src/js/pages/asistan/**`, `src/pages/opencode-ui.html`, `src/js/pages/opencode-ui/**`
- **Description**: Finish page-level migration where partial i18n already exists and remove the remaining inline text.
- **Dependencies**: Task 2.2
- **Acceptance Criteria**:
  - Both Asistan and OpenCode UI are fully catalog-driven.
  - No new Turkish strings are introduced in touched TS/HTML logic files.
- **Validation**:
  - Smoke test of all primary user flows.

### Task 2.4: Migrate the remaining renderer page clusters
- **Location**: `src/js/pages/**`, `src/pages/**`
- **Description**: Finish localization for the remaining renderer pages and shared overlays that are still hardcoded.
- **Dependencies**: Task 2.3
- **Acceptance Criteria**:
  - All remaining user-facing renderer surfaces are catalog-driven.
  - Mixed-language UI states are removed from migrated pages.
- **Validation**:
  - Page-by-page smoke checklist.

## Sprint 3: Localize Logs and MCP Outputs
**Goal**: Make logs and MCP responses switchable without losing structured diagnostics.
**Demo/Validation**:
- The same action shows Turkish or English user-facing logs depending on selected language.
- After changing language, newly emitted logs follow the new language.
- Representative MCP tools return localized human text while keeping stable JSON shapes.

### Task 3.1: Add message descriptors to logger types
- **Location**: shared logging types, `src/js/modules/logger/Logger.ts`, `electron/logger/core/LoggerCore.ts`, writer modules
- **Description**: Introduce `messageKey + params + resolvedMessage` support for new log emission while preserving legacy raw strings during migration.
- **Dependencies**: Sprint 1
- **Acceptance Criteria**:
  - Loggers accept either raw strings or descriptors.
  - Structured logs store the resolved message for display and may also store descriptor metadata for debugging.
- **Validation**:
  - Unit tests for descriptor rendering and legacy compatibility.

### Task 3.2: Migrate renderer and main-process user-visible log sites
- **Location**: `src/js/**`, `electron/**`
- **Description**: Migrate toast, panel, startup, sync, and provider-status messages to translation keys first; leave low-value debug strings for a later sweep if they are not user-facing.
- **Dependencies**: Task 3.1
- **Acceptance Criteria**:
  - User-visible logs follow the selected language.
  - Error payload details remain technical where needed.
- **Validation**:
  - Compare the same workflow in TR and EN.

### Task 3.3: Activate MCP i18n across tool descriptions and responses
- **Location**: `src/mcp-server/**`
- **Description**: Wire `translateMcpMessage()` into tool descriptions, summaries, progress updates, and friendly errors.
- **Dependencies**: Sprint 1
- **Acceptance Criteria**:
  - MCP tool metadata and human-readable outputs are localized.
  - Tool names, handler names, and JSON field names stay English.
- **Validation**:
  - Smoke-test a representative MCP tool set in both languages.

### Task 3.4: Update log viewers for mixed old/new history
- **Location**: `src/js/pages/entrance/live-log-overlay*.ts`, Electron log readers, MCP log readers
- **Description**: Ensure log viewers display newly localized entries correctly and keep legacy raw-string entries readable without trying to retranslate old history.
- **Dependencies**: Task 3.1
- **Acceptance Criteria**:
  - Mixed old/new history remains readable.
  - New entries show the language that was active at emission time.
- **Validation**:
  - Emit logs in TR, switch to EN, emit again, verify only newly produced entries follow EN.

## Sprint 4: Provider Runtime Behavior
**Goal**: Align provider UI behavior with the selected language where possible.
**Demo/Validation**:
- Supported providers pick up the app language.
- Unsupported providers show explicit status.

### Task 4.1: Harden provider UI language sync
- **Location**: `electron/webview-preload.cjs`, provider configs under `src/js/modules/webview/providers/**`, provider tester flows
- **Description**: Promote the existing provider `uiLanguage` metadata from partial groundwork to a verified subsystem with evidence-based support status.
- **Dependencies**: Sprint 1
- **Acceptance Criteria**:
  - Automatic sync works for Hayalet-controlled surfaces.
  - Partial/manual providers expose explicit status and caveats.
- **Validation**:
  - Provider verification runs for ChatGPT, Gemini, Grok, OpenCode, and OpenCode UI.

### Task 4.2: Add provider-level verification scenarios
- **Location**: `electron/provider-tester/**`, provider scenario definitions, provider config files
- **Description**: Extend provider verification so it can prove whether UI language sync is supported, partial, or unsupported per provider.
- **Dependencies**: Task 4.1
- **Acceptance Criteria**:
  - Test output captures language-sync evidence per provider.
  - Partial/manual providers produce actionable status output.
- **Validation**:
  - Run provider verification in both TR and EN where supported.

## Sprint 5: Tooling, Code-Language Migration, and Documentation
**Goal**: Make the system maintainable, complete the code-language migration, and keep contributor workflows safe.
**Demo/Validation**:
- A contributor can scaffold a new language pack and validate it locally.
- Existing Turkish identifiers/comments are removed from the Hayalet-ev main app and MCP server scope.
- Operators understand restart behavior and fallback rules.

### Task 5.1: Add language-pack scaffold and validation scripts
- **Location**: `scripts/i18n/`
- **Description**: Create scripts to scaffold a new pack from Turkish, validate coverage, and report missing keys.
- **Dependencies**: Sprint 1
- **Acceptance Criteria**:
  - New pack creation is scriptable.
  - Validation catches invalid manifests and missing keys.
- **Validation**:
  - Run scaffold + validate for TR, EN, and one sample external pack.

### Task 5.2: Execute the Turkish-to-English code migration
- **Location**: `src/**`, `electron/**`, `shared/**`, `src/mcp-server/**`
- **Description**: Rename existing Turkish identifiers, filenames, and comments to English across the Hayalet-ev main app and MCP server in controlled module batches. Use compatibility aliases only where public contracts cannot change in one step.
- **Dependencies**: Sprints 2-4
- **Acceptance Criteria**:
  - Existing Turkish identifiers/comments in scope are removed or explicitly exempted.
  - Imports, exports, tests, and compatibility paths are updated consistently.
  - Public contracts that cannot be renamed immediately are tracked with a follow-up path.
- **Validation**:
  - Typecheck/tests after each module batch plus final grep audit.

### Task 5.3: Document runtime rules and contributor workflow
- **Location**: `README.md`, `.rovo/`, language-pack docs
- **Description**: Document folder layout, fallback rules, restart behavior, provider limitations, and the code-language migration rules.
- **Dependencies**: Tasks 5.1, 5.2
- **Acceptance Criteria**:
  - A contributor can add a pack using docs only.
  - Operator docs explain what is localized and what remains provider-controlled.
- **Validation**:
  - Dry-run the documented add-language flow.

## Testing Strategy
- Unit tests:
  - Locale normalization and selector fallback
  - Language pack discovery and merge order
  - Translation interpolation and missing-key fallback
  - Logger descriptor rendering
- Integration tests:
  - Settings persistence
  - Renderer language switching
  - MCP output language switching
  - External pack discovery
- Manual/provider verification:
  - OpenCode and OpenCode UI end-to-end sync
  - ChatGPT/Gemini/Grok evidence capture
  - New-log localization checks after language changes
- Migration safety:
  - Typecheck and regression tests after each code-language rename batch
  - Final grep audit for remaining Turkish identifiers/comments in scope

## Potential Risks & Gotchas
- The current branch already contains partial i18n changes, so the plan must treat this as an in-progress migration rather than a greenfield design.
- Provider UI language may remain account-controlled for some vendors and cannot be guaranteed by DOM automation alone.
- The full Turkish-to-English code migration is large and should be executed in explicit module batches with type-safe renames and compatibility shims where needed.
- Some names may participate in persistent storage, IPC channels, file paths, or external contracts, so not every rename is mechanically safe.
- MCP output localization is broad because many tool descriptions and response bodies are currently hardcoded.

## Rollback Plan
- Keep Turkish bundled and always available as the final fallback.
- Preserve legacy raw-string log support until descriptor migration is complete.
- If provider UI sync is unstable, disable only that subsystem and keep app/MCP localization active.
- If external packs fail validation, ignore them and keep built-in TR/EN available.
