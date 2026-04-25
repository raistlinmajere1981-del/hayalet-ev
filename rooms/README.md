# Rooms

`rooms/<room-id>` is the only editable source tree for room manifests, TypeScript,
CSS, HTML, i18n, protocols, source assets, and room-local static data.

Generated room runtime artifacts are disposable and live under
`rooms/.build/<room-id>/runtime`. Do not edit those files by hand.

Mutable room data lives under `data/room-storage/<room-id>`, including projects,
exports, tool runtimes, model caches, and room runtime state. The legacy
`data/rooms` tree is a generated package-copy location kept only for migration
and rollback compatibility.
