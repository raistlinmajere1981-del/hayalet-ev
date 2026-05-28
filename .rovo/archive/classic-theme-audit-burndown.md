# Classic Theme Audit Burndown

## Summary

| Phase | Total | `hardcoded-color` | `duplicate-css-var-definition` | `duplicate-gradient` | Notes |
| --- | ---: | ---: | ---: | ---: | --- |
| Follow-up plan baseline | 263 | 184 | 78 | 1 | Starting point recorded in the remaining-findings plan and ledger. |
| Post-Sprint-2 archives/theme cleanup | 185 | 125 | 60 | 0 | Archives stopped carrying its own amber/brown token stack. |
| Post-Sprint-3 audit tightening | 125 | 125 | 0 | 0 | Intentional scoped recipe overrides no longer count as duplicate debt. |
| Post analyze/server scene alias cleanup | 90 | 90 | 0 | 0 | Analyze and server scene surfaces moved behind centralized classic aliases. |
| Post entrance scene alias cleanup | 45 | 45 | 0 | 0 | Entrance scene no longer carries raw warm/cool palette literals. |
| Post assistant/shared surface alias cleanup | 0 | 0 | 0 | 0 | Assistant, settings scene, splash scene, and overlay shells all resolve through theme aliases. |

## Sprint 3 Delta

| File | Removed issues | Rule mix |
| --- | ---: | --- |
| `src/styles/main.css` | 27 | `duplicate-css-var-definition=27` |
| `src/styles/design-system/components/choices.css` | 13 | `duplicate-css-var-definition=13` |
| `src/styles/design-system/components/modals.css` | 8 | `duplicate-css-var-definition=8` |
| `src/styles/design-system/components/chat.css` | 7 | `duplicate-css-var-definition=7` |
| `src/styles/entrance/slot.css` | 3 | `duplicate-css-var-definition=3` |
| `src/styles/design-system/components/opencode-ui-tabs.css` | 2 | `duplicate-css-var-definition=2` |

## Archives Impact

- `src/styles/archives.css` no longer contributes any audit findings.
- Archives surfaces, inputs, choice chips, tabs, and item states now resolve through centralized `--archives-*` theme aliases instead of page-local raw palette literals.
- Theme personality remains controlled by classic theme files:
  - `src/styles/design-system/themes/theme-obsidian.css`
  - `src/styles/design-system/themes/theme-ivory-lab.css`
  - `src/styles/design-system/themes/theme-ember-console.css`

## Final Delta

| File | Removed issues | Rule mix |
| --- | ---: | --- |
| `src/styles/analyze.css` | 25 | `hardcoded-color=25` |
| `src/styles/server.css` | 10 | `hardcoded-color=10` |
| `src/styles/entrance/scene.css` | 45 | `hardcoded-color=45` |
| `src/styles/assistant.css` | 25 | `hardcoded-color=25` |
| `src/styles/design-system/components/splash.css` | 11 | `hardcoded-color=11` |
| `src/styles/main.css` | 7 | `hardcoded-color=7` |
| `src/styles/design-system/components/page-shells.css` | 2 | `hardcoded-color=2` |

## Remaining Hotspots

- `npm run design:audit` now passes with a `0`-issue baseline.
- Manual verification evidence is recorded in `.rovo/classic-theme-manual-verification.md`.
- Sprint 4 was closed with a user-approved Archives screenshot spot-check instead of the broader Electron/manual sweep originally planned.

## Validation

- `npx tsx --test scripts/tests/runtime-page-style-loader-regressions.test.ts scripts/tests/classic-css-entrypoint-regressions.test.ts scripts/tests/classic-css-selector-contract-regressions.test.ts scripts/tests/theme-classic-modularization-regressions.test.ts`
- `npm run design:audit -- --update-baseline`
- `npm run design:audit`
- `npm run build`
- `CHECK_DIST_RENDERER_CSS_GRAPH=1 npx tsx --test scripts/tests/classic-css-entrypoint-regressions.test.ts`
