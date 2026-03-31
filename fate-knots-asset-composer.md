# Fate Knots Asset Composer

## Purpose

This skill translates Fate Knots visual direction into practical asset-composition rules.

It answers:
- which asset family should be used here?
- what is a frame vs overlay vs icon vs CSS state?
- how should surfaces be layered?
- when should CSS be quiet and assets do the work?

It is the bridge between visual direction and implementation.

---

## Core Mission

Build Fate Knots screens from coherent reusable visual primitives instead of ad hoc decorated components.

The job is not:
- “use more assets”

The job is:
- use fewer assets correctly
- compose them consistently
- preserve hierarchy

---

## Composition Style

- describe layering as foreground / midground / background
- define visual weight instead of CSS priority
- prefer fewer stronger surfaces over many weak ones

---

## Primitive Families

Think in these terms:

### Scene shell
Used for:
- map
- scenario scene
- combat stage
- ritual table surface

Composition:
- base surface
- frame
- optional veil/overlay
- content safe-zone

### Support rail
Used for:
- party info
- seat plaques
- right-side support systems

Composition:
- rail frame
- plaque items
- status markers
- minimal overlays

### Action surface
Used for:
- choices
- combat action hand
- primary confirm action

Composition:
- button plate / card slot base
- state overlay
- icon
- label

### Summary parchment
Used for:
- character summary
- scenario summary
- result text
- lore snippets

Composition:
- parchment base
- subtle frame
- text region
- optional emblem / seal

### State markers
Used for:
- active
- selected
- waiting
- locked
- ready
- target

Composition:
- icon / ring / chip / glow
- never confuse semantic meanings

---

## Asset Composition Rules

### 1. One semantic state = one meaning
Do not overload the same state marker for multiple meanings.

Examples:
- selected != active turn
- waiting != disabled
- target != selected card

### 2. CSS is support, not identity
Use CSS for:
- layout
- spacing
- transitions
- hover deltas
- responsive rules

Do not rely on CSS alone for visual identity.

### 3. Assets should establish the surface family
A surface should visually belong to one family.
Do not mix too many frame languages inside one region.

### 4. Scene surfaces stay quiet around the center
Do not overcrowd the scene frame with chrome.
The world must remain readable.

### 5. Overlay restraint
Overlays are for:
- mood
- emphasis
- state hint

Not for:
- filling empty space
- hiding weak layout
- compensating for poor hierarchy

---

## Usage Heuristics

### Lobby
Prefer:
- map frame
- marker family
- narrow plaques
- restrained CTA

Avoid:
- multi-panel shells
- boxed map widget feel

### Character Creation
Prefer:
- ritual table surface
- card slots
- parchment summary
- item category rows integrated into same table

Avoid:
- app wizard panels
- inventory grid feel
- isolated utility boxes

### Scenario
Prefer:
- scene shell
- narration parchment
- dialogue/log surface
- decision plaques/cards

Avoid:
- chat layout
- equal-weight stacked panels

### Combat
Prefer:
- battle stage shell
- compact side state
- lower action hand
- clear target ring / turn marker

Avoid:
- HUD overload
- spreadsheet metrics
- card clutter stronger than enemies

---

## Review Questions

For every composed surface, ask:

1. What family is this surface in?
2. What asset establishes that family?
3. What state layers sit on top?
4. Which part is CSS-only?
5. Is this quieter than the scene if it should be?
6. Is this stronger than the scene only when gameplay demands it?

---

## Common Failure Modes

Flag these:

- too many asset families in one screen
- CSS gradients competing with assets
- decorative overlays replacing hierarchy
- every panel looking equally important
- button assets used as generic containers
- card assets used where plaques or rails are needed
- item category areas becoming inventory UI instead of ritual setup UI

---

## Final Rule

Compose Fate Knots like a physical game surface:
- large surfaces establish context
- medium surfaces support decisions
- small markers communicate state

Never compose it like a component library showcase.
