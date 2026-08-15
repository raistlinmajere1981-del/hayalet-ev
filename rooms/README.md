# Rooms

`rooms/<room-id>` is the editable source of truth for a Hayalet Ev room.

A room can own its manifest, TypeScript/JavaScript, CSS, HTML, i18n, protocols, source assets, host runtime, browser runtime, tools, and room-local static data without becoming a second core application.

## Source, Runtime, Storage

- Editable room source lives under `rooms/<room-id>`.
- Generated room runtime artifacts are disposable and live under `rooms/.build/<room-id>/runtime`.
- Mutable room data lives under `data/room-storage/<room-id>` and may contain projects, exports, tool runtimes, model caches, and room runtime state.
- The legacy `data/rooms` tree is a generated package-copy location kept only for migration and rollback compatibility.

Do not edit generated runtime/package copies as peer source trees.

## Architectural Contract

The core discovers and loads rooms; the room owns the domain behavior inside its boundary.

A portable room should therefore:

- keep implementation source under its own `rooms/<room-id>` tree,
- use room-local i18n namespaces,
- communicate through supported commands, protocols and SlotBridge boundaries,
- avoid importing core implementation internals,
- avoid requiring another room's private implementation,
- keep mutable project/runtime data out of the source tree,
- remain packageable as a `.hevroom` when its dependencies permit it.

See [../CONTRIBUTING.md](../CONTRIBUTING.md) for contribution rules and `.rovo/slot-bridge-contract.md` for the SlotBridge contract.

## Built-in Rooms

The repository ships first-party rooms both as product features and as examples of the room architecture.

| Room | Status | Current scope | Documentation |
| --- | --- | --- | --- |
| `laboratory` | Implemented | Media/audio project intake, readiness/tooling, processing, comparison and inspection, annotation/export, analysis and reporting. | [Laboratory](../LABORATORY.md), [room ownership](laboratory/README.md) |
| `forge-room` | Implemented | Goal/preflight workflow, task drafting, AI assignments, conflict review, synthesis and handoff packages. | [Forge Room](../FORGEROOM.md) |
| `repair-room` | Implemented | Electronics repair sessions, evidence/knowledge packs, board/camera workbench, measurements, timeline/overlays, AI and hands-free interaction. | [Repair Room](repair-room/README.md) |
| `game-room` | Implemented / evolving | Tavla, four-seat Team Tetris, and a Fate Knots placeholder reserved for a later game design. | [Backgammon](../BACKGAMMON.md), [Team Tetris](../TEAM-TETRIS.md) |
| `pattern-room` | Prototype | Phase-one local-only research-pattern surface with overview, board, desk, archive, dissent and report views. | `pattern-room/manifest.json` |

Status labels describe the current repository surface, not a compatibility or long-term support guarantee.

## Room Notes

### Laboratory

Laboratory is currently the broadest analysis room. The manifest exposes unified media and audio workbench features, while the room runtime contains source intake, tool/model readiness, project persistence, media inspection, comparison, annotation/export and analysis pipelines.

Use the dedicated room gate for structural Laboratory work:

```bash
node rooms/laboratory/scripts/laboratory-check.mjs
```

### Forge Room

Forge treats AI output as part of a production workflow rather than a chat transcript. It persists goals and assignments, collects multiple responses, exposes conflicts and produces a selected synthesis/handoff package.

### Repair Room

Repair Room owns electronics-repair state and interaction inside the room boundary. Its current command surface includes repair session lifecycle, evidence research, measurements, overlays/timeline, AI chat, viewport/layout state, dictation, ambient listening, TTS and Android camera controls.

### Game Room

Game Room currently contains two functioning game systems and one placeholder:

- Tavla can target AI1, AI2 or connected US1.
- Team Tetris uses four seats: `user`, `ai1`, `ai2`, `us1`.
- Fate Knots is intentionally a placeholder for a future game pass.

### Pattern Room

Pattern Room is intentionally marked as a prototype. Its manifest describes a phase-one dummy/local-only surface; it should not be presented as a finished investigation product yet.

## Packaging

The distributable room package format is `.hevroom`.

Packaging should copy the room-owned source/runtime material required by the room while keeping generated workspace artifacts and mutable user data outside the package unless a specific export contract says otherwise.

The first-party room source can remain in this monorepo even when the same room is distributable as a package. The monorepo copy is the development source; generated/installed copies are not peers.

## Validation

For broad repository changes run:

```bash
npm run check:all
```

Useful room-focused checks include:

```bash
npm run rooms:typecheck
npm run rooms:test
```

For Laboratory-specific changes prefer its complete room gate shown above.
