# Pattern Room V2 Workspace Plan

Generated: 2026-08-04
Status: approved direction, implementation not started
Branch: `feature/pattern-room-v2-workspace`
Scope: Pattern Room only; cross-room integration is explicitly out of scope.

## 1. Product Goal

Pattern Room must become a persistent investigative workspace where the user can collect sources, extract evidence, distinguish analysis from interpretation, expose uncertainty, build typed relationships, run Tenth Man reviews, inspect AI suggestions, and decide what enters the case.

The room is not a chat page and not a set of disconnected dashboards. The central product metaphor is an investigative workstation:

- left: case and source spine
- center: investigation canvas
- right: contextual inspector
- focused modes: source review, debate, case review, report

The existing local-first, deterministic and user-approved behavior remains authoritative.

## 2. Explicit Non-Goals

The following items are not part of this plan:

- integration with Laboratory Room or other rooms
- cross-room asset transfer
- general Hayalet Ev room navigation changes
- replacing Pattern Room persistence with cloud storage
- automatic truth scoring
- automatic acceptance of AI output
- literal 3D office simulation

## 3. Decisions Locked for V2

### 3.1 Workspace model

Pattern Room will use a persistent three-region workspace:

1. Case Rail
   - case identity and status
   - compact workspace navigation
   - source collections and saved views
   - recent activity and review history access

2. Investigation Canvas
   - board, graph, layer, table and timeline views over the same investigation data
   - board and connections are no longer separate products
   - selected view is a presentation choice, not a separate data model

3. Context Inspector
   - changes according to the selected source, evidence, node, edge, AI suggestion or empty canvas
   - supports editing, linking, review staging and provenance inspection
   - collapsible and resizable

### 3.2 Focused modes

The main workspace can open focused modes without destroying case context:

- Source Review Mode
- Debate Mode
- Case Review Mode
- Report Mode

These modes may temporarily widen the center surface or replace the inspector, but the active case and navigation remain visible.

### 3.3 Visual direction

The current noir/amber identity remains, but UI semantics become stricter:

- neutral charcoal: base surfaces
- amber: human focus and primary action
- cyan: AI communication and remote slot activity
- green: source-backed or user-verified state
- red: contradiction, invalid state or critical uncertainty
- purple: alternative hypothesis or counter-position
- serif: document reading only
- monospace: identifiers, metadata, protocol and system status only

Decorative office elements may appear in overview or empty states, but they must not replace real investigation data.

## 4. Current Architecture to Preserve

The following existing capabilities are retained and adapted rather than rewritten:

- local overlay state
- source producers and segmented long-text import
- archive search and segment selection
- user-authored evidence and nodes
- typed edges
- deterministic report generation
- snapshot persistence and migration
- Tenth Man local phase flow
- Case Packet generation
- SlotBridge dispatch
- correlation, timeout, retry and recovery
- parser and preview-before-apply workflow
- selective Case Review application modes

## 5. Architecture Corrections Before UI Expansion

### 5.1 Rename the active view model

`PatternRoomMockData` is used as the active UI projection even after local overlay adaptation. It must be renamed to one of:

- preferred: `PatternRoomWorkspaceModel`
- acceptable: `PatternRoomViewModel`

The migration should be mechanical and covered by typecheck/tests.

### 5.2 Separate report projection from Case Packet construction

Current Case Packet construction depends in part on report item strings and metadata parsing. V2 must use this flow:

```text
Domain + Local Overlay
  -> Workspace Model
  -> Report Projection
  -> Case Packet Projection
```

Report and Case Packet are sibling projections. Neither parses the rendered output of the other.

Required structured indexes:

- source index
- evidence index
- node index
- edge index
- debate projection
- open-question projection

### 5.3 Introduce AI suggestion semantics

AI output must not become evidence merely because the response uses an Evidence heading.

Add explicit suggestion types:

- `review_observation`
- `review_analysis`
- `review_counter_argument`
- `evidence_candidate`
- `connection_candidate`
- `open_question`
- `uncertainty_note`

Rules:

- `evidence_candidate` is not a `PatternEvidenceItem`
- promotion to evidence requires a real source and excerpt
- candidate acceptance may open Source Review Mode with a prefilled extraction form
- all applied AI content retains review session provenance

### 5.4 Structured Case Review response first

Preferred parser sequence:

1. canonical JSON/schema result
2. bilingual structured headings (TR/EN)
3. current free-text fallback

The existing fallback remains as a safety net.

### 5.5 Persist workspace layout separately

Extend snapshot schema with a UI-only workspace layout structure:

```ts
export type PatternWorkspaceLayout = {
  activeCanvasMode: "board" | "graph" | "layers" | "table" | "timeline";
  selectedEntityId: string | null;
  inspectorCollapsed: boolean;
  inspectorWidth: number;
  railCollapsed: boolean;
  viewport: { x: number; y: number; zoom: number };
  nodePositions: Readonly<Record<string, { x: number; y: number }>>;
  collapsedGroups: readonly string[];
  activeFilters: PatternWorkspaceFilterState;
};
```

This data is presentation state and must remain separate from case truth.

## 6. Information Architecture

### 6.1 Case Rail

Primary destinations:

- Workspace
- Sources
- Reviews
- Report

Secondary destinations are contextual rather than permanent pages:

- graph is a canvas mode
- layers is a canvas mode
- Tenth Man debate is a focused review mode
- review history is a Reviews subview

Rail footer:

- active case name
- source/evidence/node/review counts
- save state
- local-only status

### 6.2 Investigation Canvas modes

#### Board

- free placement
- draggable nodes
- visible typed edges
- group frames and labels
- source/evidence/node visual distinctions

#### Graph

- relationship-first layout
- edge type and direction filters
- neighborhood focus
- contradiction and unsupported-node discovery

#### Layers

- Evidence / Analysis / Interpretation / Uncertainty lanes
- compatible with current category model
- drag promotion requires explicit confirmation where semantics change

#### Table

- dense sortable list
- columns for type, layer, confidence signal, provenance, created by, review status
- bulk selection for review staging only; no silent bulk mutation

#### Timeline

- creation and review trace chronology
- source dates when available
- case activity dates separated from historical subject dates

### 6.3 Context Inspector states

#### Empty canvas

- quick add source
- quick note
- saved filters
- case health summary

#### Source

- metadata and reliability
- full text and segments
- search within source
- extract evidence
- link to existing nodes
- add to review packet

#### Evidence

- excerpt and source backlink
- page/segment context
- interpretation shown separately
- linked analyses and uncertainties

#### Node

- content, layer and provenance
- supports/contradicts/questions lists
- move to review packet
- convert semantics only through explicit action

#### Edge

- endpoints
- type, direction and note
- source of creation
- edit/remove controls

#### AI suggestion

- source review session
- raw and parsed context
- accept, reject, edit, convert to candidate workflow
- never one-click convert unsupported text to evidence

## 7. V2 Delivery Phases

## Phase 0 — Baseline and Safety Net

Goal: lock current behavior before structural work.

Tasks:

- add or update smoke screenshots for all current Pattern Room views
- document current snapshot schema and migration behavior
- verify current `check`, Pattern Room regression tests and room build
- add tests around report-to-Case-Packet coupling before replacing it
- list all hard-coded UI strings

Exit criteria:

- current behavior reproducible
- failing tests are understood before V2 changes
- no product change yet

## Phase 1 — Model and Projection Cleanup

Goal: remove architectural blockers without changing the visible UI substantially.

Tasks:

- rename `PatternRoomMockData`
- create structured workspace projection helpers
- refactor Case Packet to consume structured model data directly
- retain exact packet limits and caution semantics
- add structured AI suggestion records
- add bilingual parser headings and canonical JSON parsing seam
- add tests for all projection paths

Exit criteria:

- report and Case Packet are independent projections
- no report string parsing is needed to build Case Packet
- current UI still works
- existing saved data remains loadable

## Phase 2 — Workspace Shell V2

Goal: introduce the persistent three-region structure.

Tasks:

- replace page-oriented shell with Case Rail + Canvas + Inspector
- reduce permanent destinations to Workspace, Sources, Reviews, Report
- implement collapsible/resizable rail and inspector
- add workspace layout state in memory
- preserve active selection during view changes
- create responsive behavior for 1440p, 1080p and compact widths

Exit criteria:

- navigation does not destroy context
- selected entity remains visible in inspector
- no large unused right-side region at normal desktop resolutions
- keyboard navigation remains supported

## Phase 3 — Unified Investigation Canvas

Goal: merge Board and Connections into one surface.

Tasks:

- add canvas entity adapters for sources, evidence, nodes and edges
- implement Board mode with manual positions
- implement Graph mode with relationship rendering
- retain Layers mode using the current four semantic lanes
- implement edge selection and inspector editing
- add filters for layer, entity type, edge type, provenance and review status
- add viewport and node position persistence

Initial implementation constraint:

- prefer the existing DOM/TypeScript stack
- do not add a graph library until a short spike compares bundle size, accessibility, performance and maintenance cost

Exit criteria:

- all current board items appear on the unified canvas
- all local edges are visibly rendered
- users can create and inspect an edge without leaving the canvas
- switching modes does not duplicate or mutate investigation data

## Phase 4 — Source Review Mode

Goal: turn Archive into a serious reading and evidence extraction workflow.

Tasks:

- rename Archive UI concept to Sources while keeping internal compatibility where needed
- master list or collection rail on left
- document reader in center
- segments/search/evidence extraction in inspector
- source backlink navigation from evidence
- prefilled extraction flow from `evidence_candidate`
- add provenance and reliability controls

Exit criteria:

- source -> passage -> evidence -> linked analysis can be completed without page hopping
- candidate AI evidence cannot bypass source selection
- long documents remain usable

## Phase 5 — Debate and Case Review Separation

Goal: make local Tenth Man debate and external AI Case Review understandable.

Tasks:

- Debate Mode for local role/tour flow
- Case Review Mode for packet preview, dispatch, reply, parser and apply
- Review Center subviews: Active, Suggestions, History
- remove user-facing `dummy` terminology outside debug mode
- show clear stage transitions and pending actions
- present suggestion-level accept/reject/edit controls

Exit criteria:

- user can distinguish simulation, external dispatch and applied result
- all automatic boundaries remain visible
- no AI result changes the case without a user action

## Phase 6 — Report and Investigation Health

Goal: make report and overview decision-oriented.

Tasks:

- report backlinks to source/evidence/node entities
- report section filters and export readiness
- Workspace home summary:
  - active research question
  - strongest current interpretation
  - strongest counter-position
  - unresolved contradictions
  - critical uncertainty
  - pending evidence candidates
  - suggested next research actions
- derive health indicators from transparent counts, not hidden scoring

Exit criteria:

- overview helps decide the next action
- report entries are traceable to case entities
- no truth score is implied

## Phase 7 — Visual System and Polish

Goal: apply final visual identity after workflows stabilize.

Tasks:

- semantic color tokens
- typography cleanup
- reduce excessive borders and repeated card chrome
- motion tied to state transitions only
- focus, contrast and reduced-motion audit
- empty/loading/error/timeout/recovery states
- full i18n migration of Pattern Room UI text

Exit criteria:

- UI visually expresses semantic differences
- long reading and dense graph work are both comfortable
- Turkish and English surfaces are complete

## 8. Files Expected to Change

Primary UI:

- `rooms/pattern-room/ui/pattern-room-ui-runtime.ts`
- `rooms/pattern-room/ui/panels/pattern-workspace-shell.ts`
- `rooms/pattern-room/ui/panels/pattern-overview-panel.ts`
- `rooms/pattern-room/ui/panels/pattern-board-panel.ts`
- `rooms/pattern-room/ui/panels/pattern-desk-panel.ts`
- `rooms/pattern-room/ui/panels/pattern-archive-panel.ts`
- `rooms/pattern-room/ui/panels/pattern-tenth-man-panel.ts`
- `rooms/pattern-room/ui/panels/pattern-report-panel.ts`
- `rooms/pattern-room/ui/workspace.css`
- `rooms/pattern-room/ui/style.css`
- `rooms/pattern-room/ui/tokens.css`

New likely UI modules:

- `rooms/pattern-room/ui/workspace/pattern-workspace-state.ts`
- `rooms/pattern-room/ui/workspace/pattern-workspace-layout.ts`
- `rooms/pattern-room/ui/canvas/pattern-canvas-model.ts`
- `rooms/pattern-room/ui/canvas/pattern-canvas-view.ts`
- `rooms/pattern-room/ui/canvas/pattern-canvas-board-mode.ts`
- `rooms/pattern-room/ui/canvas/pattern-canvas-graph-mode.ts`
- `rooms/pattern-room/ui/canvas/pattern-canvas-layers-mode.ts`
- `rooms/pattern-room/ui/inspector/pattern-context-inspector.ts`
- `rooms/pattern-room/ui/reviews/pattern-review-center.ts`

Shared/domain:

- `rooms/pattern-room/shared/types/pattern-room.ts`
- `rooms/pattern-room/shared/types/pattern-room-domain.ts`
- `rooms/pattern-room/shared/types/pattern-room-snapshot.ts`
- `rooms/pattern-room/shared/state/pattern-room-snapshot.ts`
- `rooms/pattern-room/shared/state/pattern-room-snapshot-migration.ts`
- `rooms/pattern-room/shared/adapters/pattern-room-view-adapters.ts`
- `rooms/pattern-room/shared/adapters/pattern-room-case-packet-adapter.ts`
- `rooms/pattern-room/shared/adapters/pattern-room-case-review-parser.ts`
- `rooms/pattern-room/shared/adapters/pattern-room-case-review-apply.ts`

Tests:

- existing Pattern Room regression suites
- new workspace layout migration tests
- new projection independence tests
- new suggestion promotion tests
- new unified canvas interaction smoke tests

## 9. Validation Gates

Every phase must pass the relevant subset of:

```bash
npm run format:check
npm run lint:strict
npm run check-types
npm run rooms:test:core
npm run rooms:build
npm run design:audit:rooms
```

Before merge, run:

```bash
npm run check:all
```

Manual desktop checks:

- 2560x1440
- 1920x1080
- 1440x900
- compact width behavior
- keyboard-only navigation
- reduced motion
- save, reload and active review recovery

## 10. User Decision Checkpoints

The implementation can proceed autonomously except at these checkpoints:

### Checkpoint A — V2 shell visual review

After Phase 2, provide screenshots of:

- Workspace with no selection
- selected source
- selected node
- compact rail

User decides whether the density and proportions are correct before canvas work expands.

### Checkpoint B — Canvas interaction choice

After a small Board/Graph spike, user reviews:

- manual board placement
- graph relationship view
- edge appearance
- inspector behavior

User approves the interaction direction before full persistence and filters.

### Checkpoint C — AI suggestion language

Before Phase 5 is finalized, user approves Turkish labels for:

- evidence candidate
- connection candidate
- open question
- applied review note
- rejected suggestion

### Checkpoint D — Final visual identity

After workflow completion, user chooses between two restrained style variants:

- warmer physical investigation desk
- darker near-future forensic workstation

Both use the same final information architecture.

## 11. First Implementation Slice

The first code slice will be Phase 0 + the safe portion of Phase 1:

1. baseline tests and coupling tests
2. rename the active UI model
3. introduce structured Case Packet projection inputs
4. preserve current UI output
5. run repository validation

No major UI redesign should begin until this slice is green.
