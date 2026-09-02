# Fate Knots — Scenario Objectives V1

This file supersedes the older interpretation that treated `finale` as a mandatory final-combat phase.

## Core model

A Fate Knots universe has a scenario objective and a bounded set of canonical ways to resolve that objective.

Combat is a tool that may appear on one or more solution paths. Combat is not itself the definition of a finale.

World Forge authors the possible solution routes when the Universe Package is created. Runtime AI may narrate or act within those routes but may not invent a new victory condition.

## Exploration remains available around endgame combat

Reaching an important/final encounter does not trap an active run in a one-way finale phase.

A party may:

- enter a major combat
- retreat
- return to exploration
- camp and recover where legal
- acquire cards/items/knowledge through other canonical knots
- return later
- or unlock a different canonical solution route and never repeat that combat

Retreat from any retreatable combat returns to the normal story/exploration flow unless a later explicit rule says otherwise.

## `finaleUnlocked`

`finaleUnlocked` means the baseline scenario prerequisites for terminal solution routes have been satisfied.

It does not mean:

- the run has ended
- the party is trapped in a final scene
- a final boss must immediately be fought
- exploration/camp choices are disabled

Individual terminal routes may additionally carry their normal bounded transition requirements.

## Terminal success routes

V1 keeps the existing story transition kind `finale` for schema compatibility.

Its meaning is now:

> an explicit canonical terminal-success transition whose requirements have been satisfied.

A universe may author multiple `finale` transitions from different reachable story knots. Some paths may require combat-derived progression, some may require particular items/reveals, and some may contain no combat.

Choosing a legal terminal `finale` transition completes the run.

Player-facing UI does not need to label the action as `Finale`; it should render the authored transition label and scene naturally.

## Final encounter metadata

`finale.finalEncounterId` remains optional metadata identifying an encounter that World Forge considers part of an endgame route.

It is not a phase gate and victory over that encounter does not automatically complete the scenario merely because its id matches `finalEncounterId`.

A final encounter may instead apply the normal canonical combat-transition victory patch. That patch can satisfy the requirements for a later terminal `finale` transition.

## Bounded V1 grammar

No generic quest scripting system is added.

Solution routes continue to use the existing bounded primitives:

Transition requirements:

- completed knot ids
- revealed knot ids
- party-owned card ids

Progression patches:

- reveal knot ids
- complete knot ids
- reveal location ids

The existing `finale.successConditionId`, `finalChoiceCardIds` and `epilogueConditionIds` remain authored finale identity/presentation metadata in V1. Runtime does not turn those ids into a generic expression or scripting engine; terminal mechanical legality remains encoded by the bounded story transition requirements and canonical progression state.

## Example

Scenario objective: stop the creature at Black Mountain.

Possible authored routes may include:

1. reach the mountain and defeat it directly; victory reveals/completes a knot that enables a terminal success transition
2. discover its weakness, acquire a weapon, then defeat it
3. recover a sealing artifact and unlock a non-combat terminal route

If the party fights too early and retreats, the run remains active. The party may camp, explore, strengthen and return later.

The game ends only when one authored terminal success transition is actually completed.