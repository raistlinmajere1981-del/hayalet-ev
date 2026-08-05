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

## Completed: three-region Workspace Shell V2 boundary

- The application shell now exposes a persistent left case/source spine, center workspace canvas and right context inspector.
- Navigation, center outlet and context inspector remain mounted while focused views change.
- The right inspector tracks the active workspace and repeats the current case summary without mutating room state.
- Desktop layouts use all three regions; narrower layouts collapse the context inspector without changing navigation or data.
- Installed UI regressions verify region persistence and active-view context updates.

## Completed: unified Investigation Canvas boundary

- Board and Connections now open as board and graph modes of one Investigation Canvas.
- The persistent workspace navigation exposes one canvas destination instead of separate Board and Connections products.
- Existing desk snapshots and overview shortcuts remain compatible and open the graph mode.
- Switching canvas modes does not mutate investigation data and keeps the Board navigation item active.
- Installed UI regressions cover board/graph mode switching, one active view and compatibility entry points.

## Completed: persistent Investigation Inspector ownership

- Board selections render source, evidence and node details in the shell-level right inspector.
- Board authoring and graph connection tools now live in the same persistent inspector instead of panel-local sidebars.
- Switching Board and Graph modes refreshes inspector content without remounting the workspace shell.
- Center canvas surfaces no longer allocate a second local inspector column.
- Installed UI regressions verify inspector identity, selection details, authoring tools and graph composer ownership.

## Completed: persistent inspector quick-tool density

- Board authoring disclosures now stack in a single full-width column inside the persistent right inspector.
- Node, evidence and connection forms no longer inherit the three-column desktop authoring grid.
- Inspector form controls keep full available width without horizontal compression.

## Completed: editable case identity and packet identity

- The active case name and primary research question can be edited from the Case Hub inspector.
- Custom identity persists in the existing version-1 snapshot without changing production defaults or older snapshot compatibility.
- Workspace summaries, overview copy, graph fallback, report context and Case Review preview use the edited identity.
- Case Packet connections expose source and target ids alongside labels.
- Case Review role lines no longer duplicate slot identifiers.
- Installed UI, snapshot, Case Packet and message regressions cover the new boundary.

## Next implementation steps

1. Add explicit edge selection and edge-detail editing to the persistent inspector.
2. Persist Investigation Canvas presentation state separately from case truth.

## Completed: visible action feedback and truthful workspace metrics

- Common local mutations now publish an explicit success, information or error message in a shell-level feedback surface.
- Feedback survives panel rerenders, remains visible when the right inspector collapses and can be dismissed explicitly.
- Duplicate desk and Tenth Man reference actions report that the item was already present instead of implying a new mutation.
- Case summary chips now separate sources, evidence, board notes, connections and review sessions; placeholder cards are not counted as case truth.
- Installed UI regressions cover feedback replacement, dismissal and truthful fixture metrics.

## Next implementation steps

1. Add editable case identity and research question metadata.
2. Correct report outline counts and separate Tenth Man references from session turns.
3. Add sourceId and targetId to projected Case Packet connections and normalize repeated role labels.
