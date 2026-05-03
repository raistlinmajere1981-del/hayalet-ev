# PATCH 6 — Laboratory UI Simplification & Visual Cohesion

CSS-only visual simplification. No runtime, no controller, no new features.

## Proposed Changes

### 1. Decision-Driven Header on Context Panel

#### [MODIFY] [lab-drawer.ts](file:///home/raistlin/hayalet-ev/rooms/laboratory/ui/lab-drawer.ts)

- `renderLabDrawer()` (line ~1224): Before the existing `renderDrawerHeader(mode, copy)`, insert a **decision header block** (`.labx-decision-header`) that shows the current intent in large text with a subtitle
- Uses existing `buildLabDecisionSnapshot()` from `lab-decision-layer.ts` and the `resolveDrawerMode()` already imported
- Intent → label mapping:
  - `ready-to-run` → **"Hazır"** / "Analiz başlatılabilir"
  - `preparing-analysis` → **"Hazırlanıyor"** / "Kaynak veya seçim bekleniyor"
  - `running-analysis` → **"Analiz Ediliyor"** / "Modüller çalışıyor"
  - `reviewing-results` → **"Sonuçlar"** / "Analiz tamamlandı"
  - `exploring-alternatives` → **"Keşif"** / "Alternatifler değerlendiriliyor"
  - `idle` → **"Beklemede"** / "Kaynak yükleyin"
- No new data computation — purely derived from existing snapshot

#### [MODIFY] [lab-theme.css](file:///home/raistlin/hayalet-ev/rooms/laboratory/ui/lab-theme.css)

- New class `.labx-decision-header` at end of V3 DRAWER section (~line 6486):
  - Large title (`1.1rem`, `font-weight: 700`)
  - Subtle subtitle (`0.72rem`, `text-dim`)
  - Bottom border separator, padding `0.65rem 0`, margin-bottom `0.35rem`
  - Intent-driven accent color on title via `data-decision-state`

---

### 2. Pipeline Block Visual Emphasis

#### [MODIFY] [lab-theme.css](file:///home/raistlin/hayalet-ev/rooms/laboratory/ui/lab-theme.css)

- `.labx-pipeline-block` (line 6128): Add padding (`0.55rem 0`), transition for opacity
- New rule: `.labx-pipeline-block + .labx-pipeline-block` → `border-top: 1px solid` with subtle separator
- Inactive blocks (non-action types): lower opacity (`0.82`)
- Active block rule: `.labx-pipeline-block[data-block-type="action"]` → full opacity, slightly brighter left border or subtle glow (`box-shadow: inset 2px 0 0 var(--labx-accent)`)

---

### 3. Right Panel (Drawer) Density Reduction

#### [MODIFY] [lab-theme.css](file:///home/raistlin/hayalet-ev/rooms/laboratory/ui/lab-theme.css)

- `.labx-drawer__section h3` (line 6137): Increase margin-bottom from `0.4rem` to `0.55rem`
- `.labx-drawer__intent-cluster` (line 6180): Increase padding from `0.38rem` to `0.5rem`
- `.labx-drawer__intent-list` (line 6147): Increase gap from `0.35rem` to `0.55rem`
- Secondary action buttons (`.labx-drawer__explore-toggle`, `.labx-drawer__intent-toggle`): Lower opacity to `0.72`, full on hover
- `.labx-cta` (new): Primary button styling — full-width, `min-height: 2.6rem`, accent gradient background, strong border-radius, clear visual weight
- `.labx-cta--danger`: Error-tone variant for cancel button

---

### 4. Inspector Panel → Background Treatment

#### [MODIFY] [lab-theme.css](file:///home/raistlin/hayalet-ev/rooms/laboratory/ui/lab-theme.css)

- `.labx-workspace-inspector` (line 3793): Reduce default opacity from `0.65` to `0.55`
- `.labx-workspace-inspector.labx-focus-passive` (line 3824): Reduce from `0.65` to `0.5`
- `.labx-workspace-inspector` background: Darken slightly by adjusting gradient rgba values
- `.labx-workspace-inspector__toggle` (line 3840): Reduce background brightness from `rgba(92, 215, 223, 0.08)` to `rgba(92, 215, 223, 0.05)`

---

### 5. General Spacing System

#### [MODIFY] [lab-theme.css](file:///home/raistlin/hayalet-ev/rooms/laboratory/ui/lab-theme.css)

- `.labx-drawer` (line 6102): Increase padding from `0.75rem` to `0.85rem`, gap from `0.75rem` to `0.9rem`
- `.labx-drawer__body` (line 6119): Increase gap from `0.75rem` to `0.9rem`
- `.labx-right-context__tier-1` (line 5526): Increase gap from `0.4rem` to `0.55rem`, padding from `0.6rem 0` to `0.7rem 0`
- `.labx-right-context__tier-2` (line 5533): Increase gap from `0.45rem` to `0.6rem`

---

### 6. No-Touch List (Verification)

- ❌ No wrapper node changes
- ❌ No `data-*` attribute changes
- ❌ No pipeline order changes
- ❌ No controller modifications
- ❌ No `lab-root.ts` render flow changes
- ❌ No grid layout restructure

## Verification Plan

### Automated Tests
```bash
npx vitest run scripts/tests/laboratory-ui-evaluation-regressions.test.ts
npx vitest run scripts/tests/laboratory-source-ui-regressions.test.ts
npx vitest run scripts/tests/laboratory-wireframe-v2-contract-regressions.test.ts
npx vitest run scripts/tests/room-layout-contract-regressions.test.ts
npx vitest run scripts/tests/room-page-regressions.test.ts
npm run typecheck
```

### Manual Verification
- User confirms visual impression: sade, okunabilir, ilk bakışta anlaşılır
