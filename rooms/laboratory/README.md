# Laboratory Room Ownership

Laboratory source of truth lives under `rooms/laboratory`.

Do not edit `data/rooms/laboratory` as a peer source tree. Installed/runtime copies are generated from the workspace room source by the room build, install, or startup sync flow.

## Runtime Boundaries

- `host/` wires the room host runtime together.
- `shared/host/` owns reusable host primitives, project paths, IO, process orchestration, reporting, and utility helpers.
- `main-functions/*/host/` owns feature-specific source intake, edit/profile/process behavior, and tool adapters.
- `runtime/` owns browser-side state, selectors, event coordination, execution planning, and media/timeline controllers.
- `ui/` owns renderers, binders, overlays, and room-local CSS entry points.
- `shared/data/tools/` contains path-loaded room tool metadata and payloads. Treat JSON, Python, conf, and inc files here as dynamic runtime inputs, not dead code candidates.

## Cleanup Rules

- Prove reachability before deleting files. Use `npm run laboratory:cleanup:inventory` and focused `rg` checks before removal.
- Keep path-loaded roots in the cleanup keep-list: manifest asset paths, `i18n.baseDir`, `ui/index.html`, `ui/style.css`, `shared/data/tools/**`, and feature asset folders.
- Remove generated or installed output only through the room build/sync lifecycle.
- Prefer compatibility wrapper exports for first-pass god-file splits. Rewrite import paths only after the new domain module has passed targeted tests.
- Treat `subtitle-analysis` as internal transcript support. Do not partially remove it from manifest, model types, project schema, host runtime, or tests.

## Validation Shortlist

- Baseline: `npm run rooms:typecheck`
- Host/UI smoke: `npm run rooms:test:file -- scripts/tests/laboratory-host-import-smoke-regressions.test.ts scripts/tests/laboratory-ui-evaluation-regressions.test.ts`
- Store/selectors: `npm run rooms:test:file -- scripts/tests/laboratory-store-runtime-regressions.test.ts scripts/tests/laboratory-runtime-truth-regressions.test.ts`
- Source/workspace UI: `npm run rooms:test:file -- scripts/tests/laboratory-source-ui-regressions.test.ts scripts/tests/laboratory-workspace-runtime-regressions.test.ts`
- Build/package: `npm run rooms:build`
