# Pattern Room V2 Progress

Branch: `feature/pattern-room-v2-workspace`
Updated: 2026-08-04

## Locked scope

- Pattern Room only.
- Cross-room integration is out of scope.
- Production must not open with the former Dünya'nın Şekli sample case.
- Sample domain data may remain only as an isolated regression-test fixture.

## Completed: production data boundary

- Added `rooms/pattern-room/shared/data/pattern-room-domain.ts`.
- Production domain starts as an empty local case:
  - no nodes
  - no edges
  - no sources
  - no evidence
  - no report traces
  - pending review session with disconnected role definitions
- Moved the former sample case into `shared/data/testing/pattern-room-domain.fixture.ts`.
- UI and host runtimes use the production empty domain directly.
- Regression suites import the isolated fixture explicitly.
- The compatibility mock-domain module has been removed.
- Installed-UI tests inject the fixture through the runtime factory; production still opens the empty domain.
- Host lifecycle coverage asserts the production empty topic.

## Completed: workspace model naming

- `PatternRoomWorkspaceModel` is the canonical active UI projection type.
- The former `PatternRoomMockData` compatibility alias has been removed.

## Completed: structured Case Packet projection

- Added `pattern-room-case-packet-projection.ts`.
- Active Case Review preview builds its packet from structured domain + local overlay data.
- Report cards, report metadata strings and rendered arrow text are not parsed to build a Case Packet.
- Domain and local sources, evidence, board notes, typed connections, debate state and open questions are projected directly.
- Packet limits, deterministic behavior and cautious language are covered by regression tests.
- The legacy report-string Case Packet adapter has been removed.

## Current validation state

The following checks passed after the production/test-domain migration:

- typecheck
- Pattern Room core regressions
- room build
- strict lint
- format check

## Next implementation steps

1. Introduce explicit AI suggestion records.
2. Stop AI `Evidence` section text from becoming evidence automatically.
3. Add evidence-candidate promotion rules that require a real source and excerpt.
4. Add canonical JSON and Turkish/English heading parser paths.
5. Begin the three-region Workspace Shell V2 after the suggestion boundary is green.
