# Multi-language Inventory

**Generated**: 2026-03-08
**Scope**: Hayalet-ev renderer, Electron main/preload, MCP server

## Existing I18n Entry Points
- `shared/i18n/locale.ts`
- `shared/i18n/catalog.ts`
- `shared/i18n/bundled-languages.ts`
- `shared/i18n/node-loader.ts`
- `src/js/modules/i18n/index.ts`
- `electron/i18n/language-service.ts`
- `electron/handlers/ipc-i18n.ts`
- `src/mcp-server/utils/i18n/index.ts`

## Existing Language Storage
- Built-in languages now live under:
  - `shared/languages/tr/`
  - `shared/languages/en/`
- External languages are loaded from:
  - `data/shared/languages/<locale>/`

## Current High-Risk Rename Areas
- `src/js/modules/logger/**`
  - Wide fan-out across renderer UI and log viewers.
- `electron/logger/**`
  - Shared log shape and session readers depend on message structure.
- `src/js/modules/webview/**`
  - Provider configs, selector locale mapping, and preload sync logic are tightly coupled.
- `src/mcp-server/tools/**`
  - Many tool descriptions and friendly outputs remain hardcoded.
- `src/js/pages/**` and `src/pages/**`
  - UI strings and some Turkish comments/identifiers are mixed together.

## Current Safe-First Rename Areas
- `shared/i18n/**`
- `electron/i18n/**`
- `src/mcp-server/utils/i18n/**`
- `src/js/modules/i18n/**`
- test files added specifically for the multi-language work

## Notes
- Provider selector locale must remain compatible with automation support even when app locale becomes extensible.
- Legacy raw-string logs must remain readable during migration.
- Turkish fallback remains mandatory even when custom languages are added.
