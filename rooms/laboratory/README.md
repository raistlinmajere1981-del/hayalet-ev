# Laboratory Room Ownership

Laboratory source of truth lives under `rooms/laboratory`.

Do not edit `data/rooms/laboratory` as a peer source tree. Installed/runtime copies are generated from the workspace room source by the room build, install, or startup sync flow.

## Runtime Boundaries

- `host/` wires the room host runtime together.
- `shared/host/` owns reusable host primitives, project paths, IO, process orchestration, reporting, and utility helpers.
- `features/*/host/` owns feature-specific source intake, edit/profile/process behavior, and tool adapters.
- `runtime/` owns browser-side state, selectors, event coordination, execution planning, and media/timeline controllers.
- `ui/` owns renderers, binders, overlays, and room-local CSS entry points.
- `tools/` contains path-loaded room tool metadata and payloads. Treat JSON, Python, conf, and inc files here as dynamic runtime inputs, not dead code candidates.

Dependency Cruiser enforces the Laboratory layer boundaries. New runtime-to-UI imports are blocked; the small legacy coordinator allow-list exists only until those coordinators are split.

## Cleanup Rules

- Prove reachability before deleting files. Use `npm run laboratory:cleanup:inventory` and focused `rg` checks before removal.
- Keep path-loaded roots in the cleanup keep-list: manifest asset paths, `i18n.baseDir`, `ui/index.html`, `ui/style.css`, `tools/**`, and feature asset folders.
- Remove generated or installed output only through the room build/sync lifecycle.
- Prefer compatibility wrapper exports for first-pass god-file splits. Rewrite import paths only after the new domain module has passed targeted tests.
- Transcript/runtime ownership stays outside Laboratory.

## Validation

Run the complete local Laboratory gate before feature work or after structural changes:

```bash
node rooms/laboratory/scripts/laboratory-check.mjs
```

The gate runs room typechecking, strict room lint, dependency boundaries, the Laboratory dead-code gate, every `scripts/tests/laboratory-*.test.ts` regression, and the workspace room build. Test discovery is dynamic so new Laboratory regression files automatically join the gate.

Useful variants:

```bash
node rooms/laboratory/scripts/laboratory-check.mjs --list
node rooms/laboratory/scripts/laboratory-check.mjs --ci
```

`--list` prints the resolved steps and test files without executing them. `--ci` skips checks that the repository CI already runs globally and keeps Laboratory dependency, cleanup, and regression gates.

For a shorter targeted investigation, use `npm run rooms:test:file -- <test files>` and `npm run rooms:typecheck`.
