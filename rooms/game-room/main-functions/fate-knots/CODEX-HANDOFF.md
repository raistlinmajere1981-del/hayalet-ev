# Fate Knots — Codex Handoff Guardrails

This file exists to keep local Codex work from redesigning Fate Knots while solving implementation or visual tasks.

Read `README.md` in this directory first. Treat it as the design authority.

## Decisions Codex must not reinterpret

Do not introduce any of the following unless explicitly requested in a later task:

- a dice/d20 system
- global RNG as a combat decision-maker
- square/hex grid combat
- pathfinding or tile movement
- AI1/DM participation inside per-action combat resolution
- AI0 as global canon/world-memory authority
- replacement player characters after party defeat
- a collectible deck draw/discard loop
- generic player-facing dropdowns for action/target selection after a universe is loaded
- generic player-facing dashboard/status prose when state can be communicated by composition, card state, animation, iconography, or sound
- scroll-box narrative as the primary story surface
- a hard dependency on runtime image generation, runtime music generation, or TTS

## Fixed role model

- local user: player
- AI1: DM/narrator
- AI0: NPC actor service
- AI2: optional player
- US1: optional remote player

Do not swap these roles as a convenience during implementation.

## Fixed runtime ownership

The engine owns canonical state and mechanical outcomes.

AI1 and AI0 are interpreters/actors over canonical packets. They do not become the rules engine.

Combat remains headless and deterministic. AI1 sees combat start context and a final result summary, not every combat action.

## Fixed combat direction

Combat uses:

- turn-based play
- no turn timer
- discussion -> commit -> resolution -> aftermath
- card-driven movement and action
- lightweight position only: `front | rear` plus `engaged | near | far`
- initial configurable budget: up to one movement card and one action card per actor per turn

All participants commit before resolution. Pending player commits are hidden from AI0 enemy decision packets.

Resolution is two-pass:

1. movement cards
2. action cards

Within each pass, order is deterministic:

1. card priority: `fast` before `normal` before `heavy`
2. effective actor speed: higher first
3. stable actor-id tie break

The action queue is built after movement has resolved. Before every queued entry resolves, the actor must still be standing. If a faster action makes an actor `fallen`, that actor's unresolved action is cancelled.

Cards default to `normal` priority if they do not define a priority tier. Do not add an initiative die or random tie break.

`0 HP` means `fallen` during combat. Party defeat ends the run.

## Fixed V1 party-victory recovery

V1 uses a deliberately severe but small recovery rule instead of a second hidden injury/health subsystem:

- standing party actors keep the exact HP they finished combat with
- a party actor that was `fallen` when the party wins returns at the configured low recovery HP; the V1 default is `1 HP`
- recovered actors are no longer `fallen`
- canonical `maxHp` is not automatically reduced by the engine
- V1 does not automatically invent or attach a generic injury card after recovery

If a lasting wound is desired later, represent it explicitly as an injury/status card with visible mechanics and an explicit removal/recovery rule. Do not silently lower max HP or invent a restoration timer in renderer/local code.

## Fixed V1 effect duration law

Do not invent per-card timer semantics. V1 uses one small duration grammar:

- damage/heal/resource/card ownership/movement effects are immediate state changes
- shields are turn-scoped and clear in aftermath
- direct combat stat modifiers are turn-scoped and clear in aftermath
- a non-persistent status without `durationTurns` lasts only the current turn and clears in aftermath
- a status with `durationTurns: N` survives the application turn and then remains for N complete following turns
- timed status counters do not decrement in the same turn in which the status was applied
- reapplying the same timed status does not stack another timer; it refreshes the existing status without shortening its remaining duration
- a persistent status without `durationTurns` remains until an explicit remove effect or later run rule removes it
- `durationTurns` overrides the status definition's default persistence behavior for that application

If a design later needs a multi-turn stat change, represent it through an explicit status definition/card rather than adding a second independent modifier timer system.

## Fixed enemy combat control

Enemy mechanics remain engine-owned. Enemy tactical choice has exactly two controller families in the initial contract:

- `policy`: deterministic engine policy identified by an explicit `policyId`
- `ai0`: personality-driven NPC choice over engine-provided legal options

AI0 receives only combat-visible state and legal card/target options. It must not receive other participants' hidden commits or hidden canon facts. AI0 returns a choice; the normal legality/commit path validates it again before storage.

Do not call AI0 for every enemy merely because it exists. Simple creatures may use explicit deterministic policies. AI0 is intended for NPCs/bosses where personality-driven tactical choice adds value.

Individual policy heuristics are not yet globally fixed. Do not silently invent `aggressive-melee`, `defensive-ranged`, or similar behavior unless a task explicitly defines that policy.

## Fixed presentation direction

Before universe creation/load:

- neutral Fate Knots Hub is allowed
- normal management UI is allowed

After universe creation/load:

- the generated universe theme owns the game presentation
- the living book is the primary gameplay surface
- exploration, choices, dialogue, map, combat, loot, camp, finale all appear through book-native presentation
- combat uses a two-page spread with opposing teams on opposing pages

Player-facing mechanics should be discoverable through interaction affordances.

Examples:

- select card -> card lifts/advances
- legal target -> target gains themed affordance
- commit -> card settles/locks/seals
- status -> visual mark/status card/aura
- transition-ready -> page behavior, not `3/3 ready`

Debug surfaces may show raw state and mechanical text. Player surfaces should not.

## Presentation effects

Do not hardcode card visuals into combat formulas.

Cards/events reference reusable presentation IDs. Presentation may include:

- animation/particle effect
- application target
- timing
- persistent status visual
- SFX

Exact visual style, particles, textures, lighting, and timing may be creatively implemented as long as they preserve the semantic event contract.

## Audio direction

SFX comes from a reusable catalog.

Universe music may use a symbolic per-universe theme plus reusable instrument/texture resources, with catalog fallback.

TTS is optional and must not block V1.

## Reserved decisions — do not guess

The following details are intentionally not final yet. If a local task reaches one of them, preserve the contract surface and stop rather than inventing a rule:

- exact player/base stat values
- exact starting card catalogs for generated universes
- exact energy/resource costs
- exact heuristics/content for individual deterministic enemy policies
- exact loot quantities and inventory capacities
- exact camp healing/equipment limits
- exact symbolic music notation/synthesis backend
- exact AI prompt/transport wire format for World Forge, DM, and AI0
- exact persistence key names and migration strategy

These are Raistlin/Nexa design decisions or later balancing decisions, not visual/runtime implementation choices.

## Areas where Codex has creative freedom

Codex may decide, within a specific task:

- texture/art style execution requested for a universe
- exact Babylon material/light parameters
- particle shapes and animation curves
- micro-animation duration and easing
- camera composition that preserves the required page/interaction layout
- implementation refactors that do not alter contracts
- naming of internal private helpers
- performance optimizations that preserve behavior

When a task would require a new game rule, new phase, new card economy, new AI authority, or new player-facing interaction grammar, stop and leave the decision to the Fate Knots design contract rather than inventing it.

## Local testing expectation

GitHub Actions availability is not assumed for this rebuild. Local Codex work may run typecheck/build/tests when available and report failures, but it must not weaken contracts merely to make an unrelated test pass.
