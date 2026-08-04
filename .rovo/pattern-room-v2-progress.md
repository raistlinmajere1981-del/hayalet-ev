# Pattern Room V2 Progress

Branch: `feature/pattern-room-v2-workspace`
Updated: 2026-08-04

## Locked scope

- Pattern Room only.
- Cross-room integration is out of scope.
- Production must not open with the former Dünya'nın Şekli sample case.
- Sample domain data may remain only as an isolated regression-test fixture during migration.

## Completed in the first implementation slice

### Production data boundary

- Added `rooms/pattern-room/shared/data/pattern-room-domain.ts`.
- Production domain now starts as an empty local case:
  - no nodes
  - no edges
  - no sources
  - no evidence
  - no report traces
  - pending review session with disconnected role definitions
- Moved the former sample case into `shared/data/testing/pattern-room-domain.fixture.ts`.
- Converted `pattern-room-domain.mock.ts` into a temporary compatibility boundary:
  - production/runtime receives the empty domain
  - Node regression execution receives the isolated fixture

This compatibility boundary is temporary. It will be removed after UI and host imports are migrated to `pattern-room-domain.ts` and tests import the fixture explicitly.

### Workspace model naming

- Added `PatternRoomWorkspaceModel` as the canonical active UI projection type.
- Kept `PatternRoomMockData` only as a deprecated compatibility alias for mechanical migration.

### Structured Case Packet projection seam

- Added `pattern-room-case-packet-projection.ts`.
- The new projection reads structured domain and local-overlay records directly.
- It does not parse report cards, report metadata strings, or rendered arrow text.
- It includes domain and local sources, evidence, board notes, typed connections, debate state and open questions.
- Existing limits and caution language are preserved.

### Regression coverage added

- Production empty-domain contract.
- Mutable-array isolation between empty domain instances.
- Structured Case Packet projection from domain + overlay.
- Packet limit preservation.

## Phase 1 migration status

- UI and host runtimes now use the production empty domain directly.
- Regression suites import the isolated fixture explicitly.
- The compatibility mock-domain module has been removed.
- Active Case Review preview now builds its packet from structured domain + local overlay data.
- The old report-string Case Packet adapter remains only for legacy regression coverage and can be retired after those tests move to the structured projection.

## Next implementation steps

1. Move remaining Case Packet regression cases to the structured projection.
2. Retire the legacy report-string Case Packet adapter.
3. Introduce explicit AI suggestion records and evidence-candidate promotion rules.
4. Begin the three-region Workspace Shell V2.

- Direct-runtime Case Review smoke tests now inject the isolated fixture, while the host lifecycle test asserts the production empty topic.
