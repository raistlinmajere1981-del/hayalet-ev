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

## Completed: AI suggestion boundary

- Parsed Case Review output now exposes explicit typed suggestion records.
- Evidence-section output is classified as `evidence_candidate`, not evidence.
- Applying a review never writes AI evidence suggestions into `localAuthoredEvidence`.
- Evidence candidates remain in the structured review result until a source-backed promotion workflow is completed.
- UI copy and regression expectations distinguish candidates from evidence.

## Completed: persistent evidence candidates and promotion boundary

- Applied AI evidence suggestions are stored as explicit local `candidate` records.
- Candidate records persist through snapshot save and restore without entering `localAuthoredEvidence`.
- Candidate provenance retains the originating review session and suggestion id.
- Promotion rejects missing candidates, unknown sources and empty selected excerpts.
- Successful promotion creates source-linked evidence, keeps AI text in interpretation and removes the candidate.
- Older snapshots without the optional candidate collection restore safely with an empty collection.

## Completed: evidence candidate promotion UI

- Case Review displays persisted AI evidence candidates as a separate review queue.
- Promotion controls require the user to select a real source and enter a source excerpt before activation.
- Promotion delegates to the guarded local-state command and never treats AI text as the excerpt.
- Successful promotion removes the candidate, creates source-linked evidence and preserves AI text as interpretation.
- Candidates can be explicitly discarded by the user.
- Installed UI regressions cover disabled promotion, source selection, excerpt entry and source-linked evidence output.

## Completed: canonical and bilingual Case Review parsing

- Case Review messages request one canonical JSON envelope with seven typed section arrays.
- The parser accepts plain or fenced canonical JSON and preserves each JSON array entry as a separate suggestion item.
- Structured connection objects are validated against the existing edge-type allowlist.
- English and Turkish section headings are accepted as a controlled fallback path.
- Invalid JSON envelopes are preserved as cautious Analysis fallback content with warnings.
- Parser-format regressions cover canonical JSON, fenced JSON, Turkish headings and the outbound response contract.

## Next implementation steps

1. Begin the three-region Workspace Shell V2.
2. Merge Board and Connections into the Investigation Canvas after the shell boundary is green.
