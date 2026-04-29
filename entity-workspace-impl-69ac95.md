# Entity Workspace — Implementation Plan

Implement the Project & Entity Management Surface as a full-screen overlay integrated into the existing Laboratory system, following the spec's entity-centric mental model.

---

## Scope

- **8 new files** (7 TS + 1 CSS)
- **4 modified files** (lab-types.ts, lab-store.ts, lab-run-controller.ts, lab-root.ts)
- No changes to existing CSS files; all styles in new `styles/project-workspace.css`

---

## Step 1 — Store Foundation

### `lab-types.ts`

Add to `LabStoreUiState`:
```ts
projectWorkspaceOpen: boolean;
projectWorkspaceSelectedEntityIds: string[];
projectWorkspaceSort: "createdAt" | "name" | "type";
projectWorkspaceFilter: LabAssetType | null;
projectWorkspaceGroup: "type" | "run" | "intent" | null;
projectWorkspaceSearch: string;
projectWorkspaceConfirmReplace: string | null;
```

Add to `LabStoreEvent` union:
```
| { type: "project-workspace-toggled"; open?: boolean }
| { type: "project-workspace-entity-selected"; entityIds: string[] }
| { type: "project-workspace-sort-changed"; sort: ... }
| { type: "project-workspace-filter-changed"; filter: ... }
| { type: "project-workspace-group-changed"; group: ... }
| { type: "project-workspace-search-changed"; search: string }
| { type: "project-workspace-confirm-replace"; assetId: string | null }
```

### `lab-store.ts`

- Add defaults in `createInitialState()`
- Add cases in `reduceEvent()` for new event types
- No persistence changes (overlay is transient)

---

## Step 2 — Overlay Shell

### `ui/project-workspace-overlay.ts`

- Renders full-screen overlay when `ui.projectWorkspaceOpen === true`
- Grid layout: `220px 1fr 280px` / `52px 1fr auto`
- Composes header + navigation + grid + inspector + context bar
- Returns empty string when closed

---

## Step 3 — Header

Part of `project-workspace-overlay.ts` (inline, not separate file — spec says header is simple).

- Left: Back button (closes overlay)
- Center: "PROJECT WORKSPACE" title
- Right: Close ✕ button

---

## Step 4 — Left Column

### `ui/project-navigation.ts`

- Renders project list from `state.projectIndex.projects`
- Active project highlighted via `activeProjectId`
- "New Project" button → existing `save-project` action pattern
- "Delete Project" button → existing `project-delete` action pattern

---

## Step 5 — Center Grid

### `ui/asset-grid.ts`

- Toolbar: sort, filter, group, search input
- Entity cards rendered via `renderEntityCard()`
- Sort/filter/group use new `ui.projectWorkspace*` fields
- Groups rendered with section headers using natural language
- Cards: type-aware variants (video/image/audio/report/artifact)
- Single-click → `project-workspace-entity-selected`
- Double-click → `asset-use-as-source` + close overlay (via controller)

### `ui/asset-card.ts`

- Video: thumbnail placeholder + duration + CLP/SRC label + hover scrub bar
- Image: thumbnail placeholder + resolution
- Audio: waveform silhouette placeholder + duration
- Report: icon + finding count (not file size)
- Artifact: contextual label
- Hover → dispatches `timeline-highlight` (wired in controller)

---

## Step 6 — Inspector

### `ui/asset-inspector.ts`

- Type-aware preview section
- Metadata (name, type, created, duration/resolution)
- Run context: derives human-readable analysis label from `run`, `intentIds`, selection snapshot
- Actions: Use as Source (with confirm), Open Report, Delete, Download, Send to AI (stub)
- "Meaning layer" placeholder section
- "Jump to Timeline" button (dispatches seek)

---

## Step 7 — Context Action Bar

### `ui/context-action-bar.ts`

- Appears when `projectWorkspaceSelectedEntityIds.length > 0`
- Shows "N selected: name" label
- Action buttons: Use as Source, Open Report, Delete, Send to AI
- Animate-in from bottom via CSS

---

## Step 8 — CSS

### `ui/styles/project-workspace.css`

- Overlay: `position: fixed; inset: 0; z-index: 900`
- Backdrop: semi-transparent + blur
- Grid layout for 3-column + header + bar
- Card styles: `--labx-radius-tight`, hover lift, selection accent
- Type-specific accent colors on card badges
- Context bar slide-up animation
- Inspector sections
- All using existing `--labx-*` tokens

---

## Step 9 — Integration

### `lab-root.ts`

- Import + render `renderProjectWorkspaceOverlay(state, copy)` alongside existing overlays
- Add `updateRenderedElement` call for `#lab-project-workspace-root`
- Wire ESC key to close overlay when open
- Wire double-click on entity card → `asset-use-as-source` + close

### `lab-run-controller.ts`

- Handle new `data-lab-action` values:
  - `project-workspace-open` → dispatch toggle
  - `project-workspace-close` → dispatch toggle
  - `project-workspace-entity-select` → dispatch selection
  - `project-workspace-entity-dblclick` → asset-use-as-source + close
  - `project-workspace-sort/filter/group/search` → dispatch changes
  - `project-workspace-confirm-replace` / `project-workspace-cancel-replace` → confirm flow
  - `project-workspace-jump-timeline` → seek to entity timestamp
  - `project-workspace-send-to-ai` → stub (no-op with activity event)

### `lab-top-bar.ts`

- Replace project `<select>` with a `[📁 Project: Name]` button that opens overlay

---

## Implementation Order

| # | Task | Files |
|---|------|-------|
| 1 | Store types + events | `lab-types.ts` |
| 2 | Store reducer | `lab-store.ts` |
| 3 | CSS | `styles/project-workspace.css` |
| 4 | `project-navigation.ts` | new |
| 5 | `asset-card.ts` | new |
| 6 | `asset-grid.ts` | new |
| 7 | `asset-inspector.ts` | new |
| 8 | `context-action-bar.ts` | new |
| 9 | `project-workspace-overlay.ts` | new |
| 10 | Integration: `lab-root.ts` | modify |
| 11 | Integration: `lab-run-controller.ts` | modify |
| 12 | Top bar: `lab-top-bar.ts` | modify |
| 13 | Typecheck | `npm run typecheck` |
