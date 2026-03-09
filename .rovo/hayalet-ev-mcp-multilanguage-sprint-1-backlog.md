# Sprint 1 Backlog: Multi-language Foundation

**Generated**: 2026-03-08
**Parent Plan**: `.rovo/hayalet-ev-mcp-multilanguage-plan.md`
**Sprint Goal**: Turn the existing partial i18n groundwork into one canonical language-pack and registry foundation that works for renderer, Electron, and MCP.

## Sprint Demo
At the end of Sprint 1, all of these should work:

- Turkish remains the default app language.
- Built-in `tr` and `en` are loaded from folder-based packs, not only TS-embedded catalogs.
- Renderer and MCP can list the same installed languages.
- `general.language` accepts a custom locale such as `de` without crashing settings load.
- External packs under `data/shared/languages/<locale>/` are discovered safely.

## Definition of Done
- Shared pack loader contract is stable.
- Electron IPC and MCP language APIs both use the same registry model.
- At least one regression test covers each of:
  - built-in pack loading
  - external pack discovery
  - invalid-pack fallback
  - custom locale normalization

## Execution Order
1. Baseline inventory and rename-risk audit
2. Pack schema and loader contract
3. Built-in pack extraction to folders
4. Shared registry/loader refactor
5. Locale and settings acceptance updates
6. Electron and MCP registry integration
7. Tests and sprint demo verification

## Atomic Tasks

### Task S1.1: Capture the baseline inventory
- **Location**: `shared/**`, `src/**`, `electron/**`, `src/mcp-server/**`
- **Description**: Record the current i18n surface and Turkish-code cleanup scope before refactor starts.
- **Deliverables**:
  - list of existing i18n entry points
  - list of current hardcoded built-in catalogs
  - first-pass inventory of Turkish identifiers/comments in shared, Electron, renderer, and MCP scope
- **Dependencies**: None
- **Acceptance Criteria**:
  - Inventory exists and is grouped by module.
  - Rename-risk items are labeled as safe, compatibility-sensitive, or deferred.
- **Validation**:
  - Grep snapshot checked into a planning/audit note.

### Task S1.2: Freeze the pack schema
- **Location**: `src/types/i18n.ts`, `shared/i18n/`
- **Description**: Finalize the canonical language-pack shape for bundled and external languages.
- **Inputs**:
  - current `LanguageDescriptor`
  - current `LoadedLanguagePack`
  - current external manifest support
- **Outputs**:
  - final manifest field list
  - final pack merge/fallback rules
  - final invalid-pack handling rules
- **Dependencies**: Task S1.1
- **Acceptance Criteria**:
  - One schema is documented and used by all loaders.
  - No runtime-specific pack shape exists.
- **Validation**:
  - Type-level build passes after schema update.

### Task S1.3: Create bundled language folders
- **Location**: `shared/languages/tr/`, `shared/languages/en/`
- **Description**: Extract the current built-in catalogs from `shared/i18n/bundled-languages.ts` into folder-based pack files.
- **Dependencies**: Task S1.2
- **Acceptance Criteria**:
  - Both built-in languages have manifest + catalog files.
  - Catalog content is functionally equivalent to the current embedded catalogs.
- **Validation**:
  - Snapshot or regression test comparing old vs new key resolution for representative keys.

### Task S1.4: Refactor the built-in loader
- **Location**: `shared/i18n/bundled-languages.ts`, `shared/i18n/node-loader.ts`, `shared/i18n/catalog.ts`
- **Description**: Convert the built-in loader into a thin registry/adapter layer that reads from `shared/languages/`.
- **Dependencies**: Task S1.3
- **Acceptance Criteria**:
  - Built-in pack resolution no longer depends on large inline TS catalog objects.
  - Fallback behavior stays `selected -> tr`.
- **Validation**:
  - Unit tests for built-in discovery and pack loading.

### Task S1.5: Unify installed-language registry behavior
- **Location**: `shared/i18n/node-loader.ts`
- **Description**: Make bundled and external languages appear through one registry path, including stable sorting, source tagging, and invalid-pack skipping.
- **Dependencies**: Task S1.4
- **Acceptance Criteria**:
  - Renderer and MCP receive the same installed-language list semantics.
  - Invalid external packs do not break startup.
- **Validation**:
  - Integration test with one valid and one broken external pack.

### Task S1.6: Update locale normalization and selector mapping
- **Location**: `shared/i18n/locale.ts`, `src/types/i18n.ts`
- **Description**: Preserve free-form app locale support while keeping provider selector mapping safe.
- **Dependencies**: Task S1.2
- **Acceptance Criteria**:
  - `tr`, `en`, and custom locales normalize consistently.
  - Provider selector locale still resolves to supported automation values.
- **Validation**:
  - Unit tests for `tr`, `en`, `en-US`, `de`, invalid strings, and non-string inputs.

### Task S1.7: Make settings accept custom locales safely
- **Location**: `src/js/modules/settings/settings-schema.ts`, `src/types/settings.ts`, `src/types/settings-defaults.ts`
- **Description**: Ensure settings loading/saving tolerates custom locale values without narrowing back to `tr | en`.
- **Dependencies**: Task S1.6
- **Acceptance Criteria**:
  - Default remains Turkish.
  - Unknown locale values do not crash normalization.
  - Saved custom locale values round-trip correctly.
- **Validation**:
  - Regression test for settings normalization and persistence.

### Task S1.8: Wire Electron registry APIs to the shared loader
- **Location**: `electron/i18n/language-service.ts`, `electron/handlers/ipc-i18n.ts`, `electron/preload.cjs`, `src/js/global.d.ts`
- **Description**: Ensure renderer IPC language APIs expose the unified registry metadata and pack loading behavior.
- **Dependencies**: Task S1.5, Task S1.7
- **Acceptance Criteria**:
  - Renderer can list and load languages using the shared registry.
  - API behavior is identical for bundled and external packs.
- **Validation**:
  - Integration smoke test through IPC.

### Task S1.9: Wire MCP registry APIs to the shared loader
- **Location**: `src/mcp-server/utils/i18n/index.ts`
- **Description**: Align MCP language listing/loading with the same registry semantics used by Electron.
- **Dependencies**: Task S1.5, Task S1.7
- **Acceptance Criteria**:
  - MCP can read current app language and installed languages safely.
  - Missing or broken external packs fall back to bundled Turkish.
- **Validation**:
  - MCP-side regression test for `loadMcpLanguage()` and `listMcpLanguages()`.

### Task S1.10: Add the sprint regression suite
- **Location**: `scripts/tests/`
- **Description**: Add the minimum regression coverage needed to lock Sprint 1 behavior before UI migration starts.
- **Dependencies**: Task S1.4, Task S1.5, Task S1.6, Task S1.7, Task S1.8, Task S1.9
- **Acceptance Criteria**:
  - Tests cover built-in loading, external discovery, invalid-pack fallback, and custom locale settings acceptance.
- **Validation**:
  - Sprint 1 regression suite passes locally.

## Parallelization Notes
- Task S1.6 can start after Task S1.2 and run in parallel with Task S1.3.
- Task S1.8 and Task S1.9 can run in parallel after Task S1.5 and Task S1.7.
- Task S1.10 should start only after loader, settings, and integration tasks stabilize.

## Suggested Commit Batches
- **Batch 1**: schema + inventory
- **Batch 2**: bundled language folders + built-in loader refactor
- **Batch 3**: registry unification + locale/settings updates
- **Batch 4**: Electron + MCP integration
- **Batch 5**: regression tests

## Sprint 1 Exit Checklist
- `shared/languages/tr` and `shared/languages/en` exist and are loadable
- external language folder contract is documented in code comments or README note
- renderer IPC language list/load path works
- MCP language list/load path works
- settings accept custom locale values safely
- Turkish fallback remains stable
