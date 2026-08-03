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

## Current compatibility debt

The visible UI still imports `PATTERN_ROOM_DOMAIN_MOCK` through the old runtime file. The compatibility module now returns the empty production domain, so sample content is no longer shown, but the import name and test/runtime split remain.

The old Case Packet adapter is still the active UI path. The new structured projection is implemented and tested but not yet wired into preview dispatch.

## Next implementation steps

1. Migrate UI runtime and host runtime imports from the compatibility module to `PATTERN_ROOM_DOMAIN`.
2. Migrate regression tests to explicit `PATTERN_ROOM_DOMAIN_TEST_FIXTURE` imports.
3. Delete `pattern-room-domain.mock.ts`.
4. Wire Case Review preview to the structured Case Packet projection.
5. Remove report-string parsing from the active Case Packet adapter.
6. Begin the three-region Workspace Shell V2 after the model/projection slice is green.
