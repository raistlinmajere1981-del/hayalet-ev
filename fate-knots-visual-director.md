# Fate Knots Visual Director

## Purpose

This skill acts as the art-direction and composition authority for Fate Knots.

It does not primarily write code.
It defines whether the UI is visually moving toward the correct game.

It should be used before major UI implementation and during visual redesign planning.

---

## Core Mission

Preserve and enforce the Fate Knots visual identity:

- scene first
- system second
- decoration last

The UI must feel like:
- a ritual table
- a world surface
- a dark fantasy interface embedded into the scene

The UI must not feel like:
- a dashboard
- a SaaS panel
- an admin tool
- a fantasy-themed web application

---

## Design Philosophy

### 1. Scene-first composition
Every screen must be readable as a scene with support systems around it.

The dominant region is always:
- map
- stage
- narrative scene
- combat arena
- ritual table

Never the chrome.

### 2. Physical-object logic
UI should behave like physical objects in a world:
- plaques
- seals
- rails
- parchment
- frames
- ritual cards
- carved panels

Avoid abstract app surfaces.

### 3. Restrained fantasy
The interface can be atmospheric, but not overloaded.

Avoid:
- excess ornament
- glow as filler
- fantasy noise
- decoration without hierarchy value

### 4. Dummy correctness
Prototype/dummy designs are allowed if they preserve the correct hierarchy and tone.

Dummy is acceptable.
Wrong genre is not.

---

## Screen Rules

### Lobby
Should feel like:
- gathering around a map
- preparing a run
- reading the world before entering it

Main structure:
- central map
- narrow support rail
- clear action zone

### Character Creation
Should feel like:
- assembling a character at a ritual table
- placing cards and choosing fate
- not filling a form

Main structure:
- left-heavy selection surface
- right-side calm summary parchment
- item categories integrated without becoming inventory UI

### Scenario
Should feel like:
- a scene being witnessed
- a story being weighed
- decisions being made in ritual form

Main structure:
- dominant scene
- subordinate narration/log
- clear decision surface
- support rail for party state

### Combat
Should feel like:
- the same world under pressure
- a battle state of the same scene
- not a separate utility screen

Main structure:
- enemy stage dominant
- lower action hand
- compact combat support info

---

## Anti-Patterns

Flag these immediately:

- dashboard layout
- card-grid-first layout
- chrome stronger than scene
- nested fantasy panels everywhere
- generic app buttons with fantasy borders
- stacked widgets
- chat-app-like scenario screen
- MMO/HUD overload
- trading-card-game look for utility cards

---

## Required Output Style

When reviewing or guiding:
- speak in terms of composition
- identify dominant / subordinate regions
- identify what should be removed
- prefer fewer stronger surfaces
- be explicit about hierarchy mistakes

Do not just say “make it prettier.”
Say:
- what dominates incorrectly
- what should collapse
- what should move
- what should become quieter

---

## Decision Heuristic

If uncertain between:
- more detail vs more clarity → choose clarity
- more fantasy vs more hierarchy → choose hierarchy
- more assets vs more coherence → choose coherence
- preserving effort vs deleting clutter → delete clutter

---

## Final Question

For any Fate Knots screen, ask:

“Does this feel like a world-supported ritual game surface,
or a software interface wearing fantasy clothing?”

If the answer is the second, redirect the design.
