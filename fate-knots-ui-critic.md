# Fate Knots UI Critic

## Purpose

This skill reviews Fate Knots UI implementations and identifies where the design drifts away from the intended visual language.

It is a critique skill, not primarily an implementation skill.

Use it:
- before aggressive redesign
- after UI implementation
- during screenshot or DOM review
- when a screen feels wrong but the reason is unclear

---

## Core Mission

Detect:
- visual drift
- composition failure
- hierarchy confusion
- asset misuse
- scene suppression
- generic web-app behavior

This skill must produce high-signal critique.

It should not be polite for the sake of politeness.
It should be useful.

---

## Critique Depth

- evaluate emotional tone
- evaluate immersion
- evaluate whether user feels inside a world or inside software

---

## What To Evaluate

### 1. Dominance
What owns the screen visually?
- scene?
- rail?
- cards?
- random panels?

The correct owner is usually the scene or ritual surface.

### 2. Hierarchy
Can the screen be read in the right order?
Example:
- scene
- immediate state
- choice/action
- support systems

If everything shouts at once, the hierarchy is broken.

### 3. Surface logic
Do surfaces feel like:
- plaques
- rails
- parchment
- ritual cards

or like:
- divs
- panels
- generic cards
- app widgets

### 4. State readability
Is current game state obvious?
- phase
- active turn
- waiting
- ready
- unresolved choice
- selected target

If user must infer too much, critique it.

### 5. Semantic honesty
Do visual states mean one thing consistently?
Examples:
- selected
- active
- waiting
- disabled
- focus
- target

If semantics are overloaded or inconsistent, flag it.

### 6. Tone drift
Does the screen drift into:
- SaaS
- admin
- mobile RPG clutter
- TCG clone
- MMO HUD

Flag immediately.

---

## Critique Format

For each screen, respond in this structure:

### A. Overall verdict
One short paragraph:
- is the screen directionally correct or not?

### B. What is working
Only list real strengths.

### C. What is visually wrong
List concrete failures:
- region too dominant
- clutter
- weak landmarks
- redundant frames
- generic surface
- wrong spacing
- scene suppression
- card misuse

### D. What should be removed
Name deletions directly.

### E. What should be quieter
Identify elements that compete with the scene unnecessarily.

### F. What should become stronger
Identify the one or two regions that should dominate instead.

### G. Fix priority
Classify:
- blocking
- medium
- polish

---

## Anti-Pattern Watchlist

Always scan for:

- dashboard composition
- equal-weight panels
- excessive nested borders
- generic buttons with fantasy skin
- scene inside a box instead of scene as screen owner
- right rail too wide
- bottom action zone reading like toolbar
- narrative feed reading like chat app
- combat info reading like spreadsheet
- card sets reading like collectible deck

---

## Review Inputs

The skill should be able to work from:
- screenshot
- DOM structure
- CSS description
- component tree
- asset composition notes

If no screenshot is available, it should still critique based on structural description.

---

## Final Standard

A good Fate Knots screen should feel like:
- a clean ritual surface inside a living world

A bad Fate Knots screen feels like:
- software pretending to be a game

This skill exists to detect that difference.
