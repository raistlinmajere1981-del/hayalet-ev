# Plan: Multi-language Support for Hayalet-ev and MCP Server

**Generated**: 2026-03-08
**Estimated Complexity**: High

## Overview
Add a real i18n system for the Hayalet-ev renderer, Electron main process, and MCP server, using Turkish as the default language and English as the second built-in language. The current codebase already stores `general.language` and has locale-aware provider selectors, but it does not have a shared translation layer for UI text, log messages, MCP tool outputs, or provider UI language synchronization.

This plan assumes a staged rollout:
- Sprint 1 creates the shared i18n foundation and makes language selection extensible beyond `tr | en`.
- Sprint 2 migrates the renderer UI in page clusters.
- Sprint 3 migrates logs and MCP-facing text.
- Sprint 4 adds provider web UI language synchronization.
- Sprint 5 adds custom language pack support, tooling, and cleanup.

Current codebase observations from research:
- `general.language` already exists and defaults to `tr` in [src/types/settings-defaults.ts](src/types/settings-defaults.ts).
- Settings normalization currently hard-limits language to `tr` or `en` in [src/js/modules/settings/settings-schema.ts](src/js/modules/settings/settings-schema.ts).
- Entrance settings already expose a dummy selector in [src/pages/entrance.html](src/pages/entrance.html) and [src/js/pages/entrance/user-panel.ts](src/js/pages/entrance/user-panel.ts).
- Provider selector locale resolution already exists in [shared/provider-selector-resolution.ts](shared/provider-selector-resolution.ts), [src/js/modules/webview/message-sender.ts](src/js/modules/webview/message-sender.ts), and provider configs.
- Electron sessions preserve cookies and localStorage in [electron/session-manager.ts](electron/session-manager.ts), which is relevant for provider UI language persistence.
- The scope is broad: about `543` log emission sites and about `699` hardcoded user-facing TR/EN string hits were detected during the audit.

## Prerequisites
- Have working provider test accounts for ChatGPT, Gemini, and Grok for live language-sync verification.
- Keep Turkish as the fallback language for every missing key and every failed custom language pack load.

## Confirmed Decisions
- English-only code naming and comments are required for the Hayalet-ev main app and the MCP server scope of this initiative.
- Custom language packs may be discovered on app restart; hot reload is not required in the first release.
- Historical logs must render in the currently selected language, not the language active when the log entry was originally emitted.

## Proposed Language Layout
- Bundled languages:
  - `shared/languages/tr/*.json`
  - `shared/languages/en/*.json`
- User-added language packs:
  - `data/shared/languages/<locale>/manifest.json`
  - `data/shared/languages/<locale>/index.json`
  - or `data/shared/languages/<locale>/*.json`

Recommended catalog split:
- `app.json` for shared renderer UI
- `pages.<page>.json` for page-specific strings
- `logs.renderer.json`
- `logs.main.json`
- `logs.mcp.json`
- `mcp-tools.json`
- `providers.json`

## Sprint 1: Foundation and Language Registry
**Goal**: Replace the dummy `tr | en` setting with a shared i18n foundation that supports built-in and external languages.
**Demo/Validation**:
- Start the app with Turkish default intact.
- Switch `general.language` to `en` in settings JSON and confirm the loader accepts it.
- Load one translation key from renderer, main, and MCP contexts with Turkish fallback.

### Task 1.1: Define the i18n architecture and key strategy
- **Location**: `shared/`, `src/js/modules/`, `electron/`, `src/mcp-server/`
- **Description**: Define canonical key naming, catalog split, fallback rules, interpolation rules, and missing-key behavior. Keep all new filenames, functions, and comments in English.
- **Dependencies**: None
- **Acceptance Criteria**:
  - One canonical translation API is chosen for all runtimes.
  - Key namespaces are documented before migration starts.
  - Fallback behavior is always `selected language -> tr`.
- **Validation**:
  - Architecture note added to the plan implementation branch before coding begins.

### Task 1.2: Make app language extensible
- **Location**: `src/types/settings.ts`, `src/types/settings-defaults.ts`, `src/js/modules/settings/settings-schema.ts`, `electron/settings-manager.ts`
- **Description**: Replace the `AppLanguage = "tr" | "en"` bottleneck with an extensible string-based locale model plus validation against the installed language registry.
- **Dependencies**: Task 1.1
- **Acceptance Criteria**:
  - Default remains `tr`.
  - Unknown locale values do not crash settings load.
  - Installed custom locales can be persisted in settings.
- **Validation**:
  - Add normalization tests for `tr`, `en`, invalid values, and custom locale codes.

### Task 1.3: Add shared language loader and translator
- **Location**: `shared/i18n/`, `src/js/modules/i18n/`, `electron/i18n/`, `src/mcp-server/utils/i18n/`
- **Description**: Build a shared loader that can merge bundled catalogs with external packs, support single-file and multi-file catalogs, validate manifests, and expose a translator with interpolation.
- **Dependencies**: Task 1.2
- **Acceptance Criteria**:
  - Bundled TR/EN catalogs load successfully.
  - External language packs can override or extend catalogs.
  - Missing keys return Turkish fallback and emit a debug warning.
- **Validation**:
  - Unit tests for merge order, fallback resolution, and interpolation.

### Task 1.4: Add language registry and metadata API
- **Location**: `shared/i18n/`, `electron/handlers/`, `src/js/modules/settings/`, `src/mcp-server/`
- **Description**: Expose installed language metadata to renderer and MCP. Include locale code, display name, direction, completeness, source (`built-in` or `external`), and validation status.
- **Dependencies**: Task 1.3
- **Acceptance Criteria**:
  - UI can ask for installed languages.
  - MCP can read the current app language and available languages.
  - Broken custom packs are marked invalid without breaking startup.
- **Validation**:
  - Integration test for language registry listing.

### Task 1.5: Make restart-time language pack discovery explicit
- **Location**: `shared/i18n/`, `electron/handlers/`, settings UI
- **Description**: Design the registry around startup-time discovery of bundled and external language packs. Show clear UX copy that newly added language packs become available after restart.
- **Dependencies**: Task 1.4
- **Acceptance Criteria**:
  - Registry scans bundled and external packs on startup.
  - No file watching or hot reload logic is required for v1.
  - UI/help text makes the restart requirement explicit.
- **Validation**:
  - Add a manual test note for “drop language pack -> restart -> select language”.

## Sprint 2: Renderer UI Migration
**Goal**: Localize the Hayalet-ev renderer UI and make language changes observable in the app.
**Demo/Validation**:
- Change language in Entrance settings and see visible UI text switch to English.
- Refresh the app and confirm selected language persists.
- Verify Turkish remains the default on clean startup.

### Task 2.1: Bind the renderer to the i18n manager
- **Location**: `src/js/app/index.ts`, `src/js/app/page-init.ts`, `src/js/modules/settings-manager.ts`, `src/js/modules/core/runtime-actions.ts`
- **Description**: Create a renderer-side i18n manager that reacts to settings changes and exposes translation helpers to pages and shared modules.
- **Dependencies**: Sprint 1
- **Acceptance Criteria**:
  - Renderer has one source of truth for active locale.
  - Language changes trigger controlled re-render or targeted DOM updates.
  - No page reads raw `general.language` directly for UI text.
- **Validation**:
  - Manual smoke test across page navigation.

### Task 2.2: Migrate Entrance and settings-first surfaces
- **Location**: `src/pages/entrance.html`, `src/js/pages/entrance.ts`, `src/js/pages/entrance/*.ts`, `src/index.html`
- **Description**: Replace hardcoded labels, placeholders, button text, error text, and live overlay labels in the current dummy language area first.
- **Dependencies**: Task 2.1
- **Acceptance Criteria**:
  - Entrance user panel is fully localized.
  - Settings language selector uses registry-driven options.
  - No Turkish hardcoded strings remain in migrated Entrance surfaces except data content.
- **Validation**:
  - Visual check in both `tr` and `en`.

### Task 2.3: Migrate shared chrome and common UI primitives
- **Location**: `src/js/app/navigation.ts`, `src/js/app/indicators.ts`, `src/styles/design-system/`, shared modal/toast helpers
- **Description**: Localize navigation labels, status text, shared overlays, and generic UI components used by multiple pages.
- **Dependencies**: Task 2.2
- **Acceptance Criteria**:
  - Shared UI components render with translated labels.
  - No page duplicates translation logic locally.
- **Validation**:
  - Navigate through all top-level pages and confirm common chrome follows language changes.

### Task 2.4: Migrate remaining renderer pages in clusters
- **Location**:
  - `src/pages/asistan.html`, `src/js/pages/asistan/**`
  - `src/pages/opencode-ui.html`, `src/js/pages/opencode-ui/**`
  - `src/js/pages/analyze/**`
  - `src/js/pages/archives/**`
  - `src/js/pages/server/**`
- **Description**: Migrate page clusters one by one so each cluster can be reviewed and tested independently.
- **Dependencies**: Task 2.3
- **Acceptance Criteria**:
  - All user-visible page strings move to catalogs.
  - New code in touched files uses English identifiers/comments only.
  - Turkish remains only in translation data, not in renderer logic.
- **Validation**:
  - Page-by-page smoke checklist with screenshots or manual QA notes.

## Sprint 3: Logs, Main Process, and MCP Text
**Goal**: Make Hayalet-ev logs and MCP-facing text language-aware without losing structured diagnostics.
**Demo/Validation**:
- Trigger the same action in `tr` and `en` and confirm visible logs change language.
- Confirm structured logs still preserve machine-readable fields.
- Confirm MCP tool user-facing responses switch with the selected language.

### Task 3.1: Extend log entries to support message keys and params
- **Location**: shared logging types, `src/js/modules/logger/Logger.ts`, `electron/logger/core/LoggerCore.ts`, writers under `electron/logger/writers/`
- **Description**: Add a message-descriptor path to log APIs so callsites can pass `messageKey + params` instead of only raw strings. Keep raw string fallback for incremental migration, but make structured logs store enough metadata to re-render old entries in the currently selected language.
- **Dependencies**: Sprint 1
- **Acceptance Criteria**:
  - Logger accepts both legacy string messages and localized descriptors.
  - Structured logs preserve key, params, and optionally resolved message.
  - Historical log viewers can re-render localized entries using the active language.
  - Console/log files remain human-readable.
- **Validation**:
  - Unit tests for descriptor rendering and legacy compatibility.

### Task 3.2: Migrate renderer and main-process log callsites
- **Location**:
  - `src/js/**`
  - `electron/**`
- **Description**: Convert user-visible log/toast/status messages from hardcoded Turkish/English strings to translation keys. Prioritize categories surfaced in Entrance live logs, toasts, Asistan flows, startup, and provider scenarios.
- **Dependencies**: Task 3.1
- **Acceptance Criteria**:
  - Visible Hayalet-ev logs switch language with settings.
  - Historical migrated log entries re-render in the newly selected language.
  - Error details remain technical and untranslated where necessary.
  - Legacy debug-only low-value messages can remain temporarily if they are not user-facing, but must be tracked.
- **Validation**:
  - Compare log output for the same workflow in both languages.

### Task 3.3: Localize MCP server outputs and tool metadata
- **Location**: `src/mcp-server/**`
- **Description**: Move user-facing MCP tool descriptions, result summaries, progress messages, and error wrappers to catalogs. Keep protocol field names and internal identifiers in English.
- **Dependencies**: Sprint 1
- **Acceptance Criteria**:
  - MCP user-facing text follows selected app language.
  - Tool descriptions and result text use translation keys.
  - Internal JSON shapes and tool names remain stable.
- **Validation**:
  - Smoke-test a representative MCP tool set in both languages.

### Task 3.4: Add language-aware progress and fallback behavior
- **Location**: `src/mcp-server/utils/progress.ts`, `src/mcp-server/utils/mcp-logger.ts`, `src/mcp-server/utils/log-utils.ts`
- **Description**: Ensure progress, stderr-safe diagnostics, and fallback console lines behave sensibly when translation catalogs are unavailable or partially loaded.
- **Dependencies**: Task 3.3
- **Acceptance Criteria**:
  - Startup failures still emit understandable messages.
  - Missing catalog state does not break MCP startup.
  - Turkish fallback is used on loader failure.
- **Validation**:
  - Start MCP with a missing or broken language pack and verify graceful fallback.

### Task 3.5: Update log readers and live log UI to resolve keys at render time
- **Location**: `src/js/pages/entrance/live-log-overlay*.ts`, `src/js/pages/entrance.ts`, `src/mcp-server/utils/log-utils.ts`, log reading helpers under `electron/logger/`
- **Description**: Change log display paths to prefer `messageKey + params` when present and translate on read/render using the current locale. Legacy raw-string entries continue to display as-is.
- **Dependencies**: Task 3.1
- **Acceptance Criteria**:
  - Live logs and read-back logs render localized migrated entries in the currently selected language.
  - Legacy raw-string history remains readable without breaking viewers.
  - UI clearly handles mixed history during migration.
- **Validation**:
  - Emit logs in Turkish, switch to English, reopen the log view, and verify migrated entries re-render in English.

## Sprint 4: Provider Web UI Language Synchronization
**Goal**: Keep provider webview language aligned with the app language where technically possible.
**Demo/Validation**:
- Set app language to Turkish and verify provider UI lands in Turkish where supported.
- Switch to English and verify the same for connected providers.
- Show a status for providers where the language cannot be set programmatically.

### Task 4.1: Add provider language strategy metadata
- **Location**: `src/types/provider.ts`, provider configs under `src/js/modules/webview/providers/**/config.ts`
- **Description**: Extend provider config with a `uiLanguage` strategy model describing supported locales, persistence mechanism, detection method, and update strategy.
- **Dependencies**: Sprint 1
- **Acceptance Criteria**:
  - Every provider declares whether UI language sync is `supported`, `partial`, or `unsupported`.
  - Selector locale and UI language sync are treated as separate concerns.
- **Validation**:
  - Config type checks and provider registry smoke test.

### Task 4.2: Research and document provider language persistence per provider
- **Location**: `electron/provider-tester/**`, provider configs, research notes in repo
- **Description**: For ChatGPT, Gemini, Grok, and OpenCode/OpenCode UI, determine where language is stored or inferred: URL params, cookies, localStorage, account settings, or DOM settings flow. Use existing partitions and provider tester hooks for evidence capture.
- **Dependencies**: Task 4.1
- **Acceptance Criteria**:
  - Each provider has a documented persistence mechanism or an explicit unsupported note.
  - Evidence is linked to a reproducible check path.
- **Validation**:
  - Manual or scripted provider tester run per provider.

### Task 4.3: Build a shared provider language sync orchestrator
- **Location**: `src/js/modules/webview/**`, `electron/handlers/ipc-provider.ts`, `electron/session-manager.ts`, `src/js/pages/entrance/webview-panel.ts`
- **Description**: Add a common flow that detects app language changes, applies provider-specific language sync on connect/load, and persists sync status per slot/provider.
- **Dependencies**: Task 4.2
- **Acceptance Criteria**:
  - Sync runs automatically after slot connection and on app language change.
  - Sync can be skipped safely on unsupported providers.
  - User gets a visible status when provider UI language is out of sync.
- **Validation**:
  - End-to-end slot connection smoke tests for `ai1`, `ai2`, and `ai0` where relevant.

### Task 4.4: Add provider-level verification scenarios
- **Location**: `electron/provider-tester/**`, provider scenario definitions, config files
- **Description**: Add provider test steps that verify both selector readiness and actual provider UI language state.
- **Dependencies**: Task 4.3
- **Acceptance Criteria**:
  - Provider tests can assert language state or report unsupported reason.
  - Selector promotion logic remains locale-safe.
- **Validation**:
  - Provider test results include locale evidence in both `tr` and `en`.

## Sprint 5: Custom Language Packs, Migration Rules, and Hardening
**Goal**: Let users add their own language packs safely and finish the coding-style cleanup needed for sustainable maintenance.
**Demo/Validation**:
- Drop a new language folder into the configured language directory.
- Restart or reload the registry and select the new language.
- Confirm missing keys fall back to Turkish and invalid packs are rejected cleanly.

### Task 5.1: Support external language packs
- **Location**: `data/shared/languages/`, `shared/i18n/`, `electron/handlers/`, settings UI
- **Description**: Support user-added languages as a folder containing either a single `index.json` or multiple partial JSON files plus a manifest.
- **Dependencies**: Sprint 1
- **Acceptance Criteria**:
  - External packs appear in the language selector.
  - Invalid packs are skipped with actionable errors.
  - Custom languages never overwrite bundled Turkish fallback.
- **Validation**:
  - Add one happy-path and one invalid-pack integration test.

### Task 5.2: Add i18n tooling for scaffolding and validation
- **Location**: `scripts/i18n/`
- **Description**: Create scripts to scaffold a new language from Turkish, validate key coverage, report missing/unused keys, and optionally split/merge catalogs.
- **Dependencies**: Task 5.1
- **Acceptance Criteria**:
  - Contributors can create a new language pack without hand-copying every file.
  - CI or local check can validate pack health.
- **Validation**:
  - Run scaffold + validate against TR and EN catalogs.

### Task 5.3: Apply English-only code naming across Hayalet-ev and MCP server surfaces touched by this initiative
- **Location**: `src/**`, `electron/**`, `shared/**`, `src/mcp-server/**`
- **Description**: Enforce English-only filenames, function names, and comments for all new or refactored code inside the Hayalet-ev main app and MCP server scope. External provider websites remain outside this rule because they are third-party UIs.
- **Dependencies**: All earlier sprint tasks
- **Acceptance Criteria**:
  - New i18n and migration modules are fully English.
  - Refactored Hayalet-ev and MCP server files do not introduce new Turkish identifiers/comments.
  - Remaining legacy Turkish code in untouched local files is explicitly inventoried if not migrated yet.
- **Validation**:
  - Final audit checklist for touched files.

### Task 5.4: Add contributor and operator documentation
- **Location**: `README.md`, `.rovo/`, language pack docs
- **Description**: Document language folder structure, fallback rules, custom pack installation, provider sync caveats, and translation authoring rules.
- **Dependencies**: Task 5.1, Task 5.2
- **Acceptance Criteria**:
  - A contributor can add a new language pack from docs only.
  - Provider sync limitations are explicitly documented.
- **Validation**:
  - Dry-run the documented custom language flow.

## Testing Strategy
- Unit tests:
  - Language normalization and registry loading
  - Catalog merge and fallback behavior
  - Translation interpolation
  - Logger descriptor rendering
  - Provider language strategy resolution
- Integration tests:
  - Settings persistence for built-in and custom locales
  - Renderer language switch on Entrance and one secondary page
  - MCP output language switch
  - External language pack discovery and validation
- Provider verification:
  - ChatGPT, Gemini, Grok, OpenCode/OpenCode UI language-state checks
  - Selector and UI language assertions kept separate
- Manual QA:
  - Clean install defaults to Turkish
  - Switch to English and back
  - Missing key fallback stays readable
  - Live logs and historical log viewers behave as specified

## Potential Risks & Gotchas
- The requirement "all code-side names/comments in English" applies across Hayalet-ev main app and MCP server work touched by this project. This still needs strict scope control to avoid turning the migration into an uncontrolled repo-wide rename campaign.
- Current locale handling is selector-oriented, not text-oriented. Reusing it directly for UI translation will create leaky abstractions unless a real shared i18n layer is added first.
- Provider UI language may be account-scoped or server-side for some services, not only cookie/localStorage-based. Some providers may require navigation to settings, account preferences, or may not support safe automation.
- The log requirement is stricter than a normal i18n migration because historical logs must render in the currently selected language. That means structured logs need to retain descriptors, not only pre-rendered text.
- MCP output localization is broad because many tool descriptions and response bodies are currently hardcoded.
- Restart-only external language loading simplifies the first release, but UX must clearly communicate that newly added language packs appear only after restart.

## Rollback Plan
- Keep `tr` as the immutable fallback language.
- Roll out by sprint and keep legacy raw-string logger support until migration is complete.
- If provider UI language sync causes instability, disable only that subsystem and keep app/UI localization active.
- If external language packs cause failures, disable external pack loading and keep bundled TR/EN.
- If a page cluster is incomplete, fall back to Turkish strings for missing keys instead of blocking startup.
