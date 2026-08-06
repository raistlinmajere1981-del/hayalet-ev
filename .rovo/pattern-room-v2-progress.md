# Pattern Room V2 Progress

Branch: `feature/pattern-room-v2-workspace`
Updated: 2026-08-05
Status: functional implementation complete; general UI revision deferred to a separate session

## Locked scope

- Pattern Room only.
- Cross-room integration is out of scope.
- Production must not open with the former Dünya'nın Şekli sample case.
- Sample domain data may remain only as an isolated regression-test fixture.
- Investigation truth, AI suggestions and presentation state remain separate concerns.

## Completed: production data boundary

- Added `rooms/pattern-room/shared/data/pattern-room-domain.ts`.
- Production starts as an empty local case with no nodes, edges, sources, evidence or report traces.
- The former sample case lives only in `shared/data/testing/pattern-room-domain.fixture.ts`.
- UI and host runtimes use the production domain directly.
- Regression suites inject the isolated fixture explicitly.
- The compatibility mock-domain module has been removed.

## Completed: workspace model and structured projections

- `PatternRoomWorkspaceModel` is the canonical active UI projection type.
- Case Packets are built from structured domain and local overlay data.
- Report strings, rendered arrows and report-card metadata are not parsed to build Case Packets.
- Case Packet connections expose source and target identifiers alongside labels.
- Report generation remains deterministic and read-only.

## Completed: AI suggestion and evidence-candidate boundary

- Parsed Case Review output exposes typed suggestion records.
- AI evidence suggestions are stored as evidence candidates, never direct evidence.
- Candidates persist without entering `localAuthoredEvidence`.
- Promotion requires a real source and a user-selected source excerpt.
- AI text is preserved as interpretation rather than treated as source material.
- Candidates can be explicitly promoted or discarded by the user.

## Completed: canonical and bilingual Case Review parsing

- Case Review messages request one canonical JSON envelope with seven typed section arrays.
- Plain and fenced canonical JSON are supported.
- Turkish and English section headings are controlled fallback paths.
- Invalid output is preserved as cautious Analysis content with warnings.
- Case Review role lines use normalized, non-duplicated slot labels.

## Completed: persistent Workspace Shell V2

- The application uses a persistent left navigation spine, center workspace and right context inspector.
- Navigation and inspector ownership survive focused-view changes.
- Board and Connections are modes of one Investigation Canvas.
- Center surfaces no longer allocate duplicate local inspectors.
- Right-inspector quick tools use one full-width column.

## Completed: visible action feedback and truthful workspace metrics

- Common local actions publish explicit success, information or error feedback.
- Duplicate actions report that the item was already present instead of implying a mutation.
- Feedback survives panel rerenders and remains dismissible.
- Case metrics separately count sources, evidence, board notes, connections and reviews.
- Placeholder cards are not counted as case truth.

## Completed: editable case identity

- The case name and primary research question are editable from Case Hub.
- Custom identity persists in the existing version-1 snapshot contract.
- Workspace summaries, graph fallback, report context and Case Review use the edited identity.
- Older snapshots without custom identity remain compatible.

## Completed: truthful report metrics and Tenth Man separation

- Source counts represent real domain and local source entities.
- Aggregate report cards are not counted as sources.
- Tenth Man references, local turns and optional summary are separate metrics.
- Tenth Man references appear in the report before a local debate session starts.
- Report outline and document sections use the same structured metrics.

## Completed: connection selection and local edge editing

- Domain and local connections are explicit selectable graph records.
- The persistent inspector shows source, target, type, scope and note.
- Domain connections remain read-only.
- Local connection type and note can be edited without changing endpoints.
- Connection deletion remains intentionally outside the UI boundary.
- Stale connection selections are cleared when linked local entities disappear.

## Completed: graph connection-list viewport correction

- Claim cards no longer reserve the full graph surface height.
- Selectable connection cards remain in normal flow directly below claims.
- Connection index badges are anchored to their own cards.

## Completed: separate Investigation Canvas presentation persistence

- Canvas mode, selected board item and selected connection persist in an optional snapshot `presentation` object.
- Presentation state remains outside the local case overlay.
- Snapshot schema version remains `1`.
- Older snapshots without presentation state restore safely.
- Invalid or stale selections are cleared against the current workspace projection.

## Functional closure validation

Latest local validation was reported clean after the presentation-state commit:

- targeted snapshot, persistence, storage and installed-UI regressions
- Pattern Room core regressions
- TypeScript checks
- room build
- strict lint
- format check
- Pattern Room design-system audit
- manual save, restore, selection and connection-editing checks

## Functional closure decision

The planned Pattern Room V2 functional foundation is complete on this branch. No further feature behavior is required before beginning the general UI revision.

The current boundaries remain intentional:

- no cross-room integration
- no automatic AI mutation of case truth
- no connection deletion UI
- no cloud persistence
- no general Hayalet Ev shell redesign

## Next session: general UI revision

Start from the existing functional behavior and preserve its tests. The next session should focus on:

1. Move Archive selected-source details and evidence capture into the persistent right inspector.
2. Simplify Case Review and Tenth Man into clearer focused modes without nested inspector layers.
3. Replace placeholder and decorative empty states with deliberate product empty states.
4. Rework report document hierarchy, spacing and navigation readability.
5. Rework graph node and connection presentation without changing the connection model.
6. Review panel widths, typography, responsive collapse behavior and inspector density.
7. Keep case truth, AI suggestions and presentation state visibly distinguishable.
