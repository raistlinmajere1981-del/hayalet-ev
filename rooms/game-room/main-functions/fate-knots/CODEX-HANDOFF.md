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
- weight, encumbrance or inventory-capacity mechanics
- automatic/random loot ownership assignment
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

World Forge is a separate pre-runtime authority surface. The current contract deliberately does not assign Forge ownership to AI1 or AI0. Keep Forge orchestration provider-independent unless a later design decision explicitly selects a provider/role.

## Fixed runtime ownership

The engine owns canonical state and mechanical outcomes.

AI1 and AI0 are interpreters/actors over canonical packets. They do not become the rules engine.

Combat remains headless and deterministic. AI1 sees combat start context and a final result summary, not every combat action.

## Stage C integration reality — preserve this boundary

The branch already contains real Fate Knots persistence/host/Hub integration. Treat it as an implementation to reconcile and verify, not as an empty scaffold to redesign.

Canonical persistence is host-owned:

- Universe Packages and Run States are persisted separately
- malformed persisted records are rejected rather than silently turned into fallback canon
- browser/UI code does not receive raw `SaveUniverse` or `SaveRun` commands
- continuing a saved run must not re-run World Forge

The neutral Hub receives a player-safe projection, not a raw Universe Package. The active feature state event is `fate-knots-hub-state`.

Character/run setup has an explicit secrecy boundary:

- every Forge-authored map defines `startNodeId`
- every character template explicitly defines `playerSelectable`
- every character template explicitly defines `startingPosition`
- renderer obtains selectable character data through `GameRoomFateKnotsGetRunSetup`
- renderer must not inspect a raw Universe Package to discover selectable characters
- the setup projection must not expose hidden map/NPC/finale/knot canon merely to build the character screen

Run bootstrap is deliberately two-step:

1. `GameRoomFateKnotsCreateRun` creates canonical `run-setup` state from the accepted universe and explicit player-seat/character assignments
2. `GameRoomFateKnotsStartRun` opens the Forge-authored start node and enters exploration

Do not collapse this into a renderer-created run object. The split prevents world/map canon from being opened during character preparation.

Current neutral-Hub management commands are intent-level read/select/delete operations. Preserve that direction rather than giving browser code direct persistence authority.

The Game Room manifest intentionally registers Fate Knots without a `scene` block for now. Do not invent hotspot coordinates, close-up backgrounds, or transparent-window geometry merely to satisfy the feature entry. Stage E/local visual work may choose the actual room placement while leaving all mechanics unchanged.

## Fixed AI0 runtime isolation

Fate Knots AI0 is not the normal Hayalet Ev coding assistant.

Runtime NPC/combat calls must not bootstrap from the Hayalet Ev repository root or inherit the development-agent policy surface. In particular, Fate Knots AI0 runtime must not load or act on:

- root `AGENTS.md`
- `.rovo/MODES.md`
- `.rovo/WORKFLOWS.md`
- `.rovo/MEMORY.md`
- `.rovo/03-ARCHITECTURE.md`
- project MCP/tool discovery
- project Shared Memory bootstrap
- coding-agent conversation history

Do not solve this by adding "ignore AGENTS.md" to the prompt. Once repository policy is loaded, the context cost has already been paid.

Stage C host integration must launch Fate Knots AI0 from an external app-data workspace outside the repository tree and materialize only the minimal NPC runtime policy described by `AI0-RUNTIME-OVERRIDE.md` / `shared/ai0-runtime.ts`.

V1 Fate Knots AI0 runtime has no tools by default: no filesystem, shell, MCP, web, image generation, GitHub or project memory. World Forge image generation is a separate authority surface and must not be attached to the NPC actor merely because both use AI.

AI0 calls are packet-driven/stateless. NPC continuity comes from canonical persona/known/relationship facts and current scene/combat packets supplied by the engine. AI0 output is validated before the engine accepts any interaction or combat choice.

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

## Fixed V1 inventory and loot law

Inventory remains card-native and deliberately small:

- every actor owns a personal card inventory through `ownedCardIds`
- `item` and `equipment` cards are the inventory-visible physical belongings
- duplicate owned item-card IDs represent multiple physical copies (for example two identical potions)
- consuming an item removes one owned copy; revoking a card removes all owned copies of that card id
- equipment ownership is represented by owning its `equipment` card
- an equipment card must point through `sourceId` to its mechanical equipment definition
- `equipmentIds` represents only currently equipped definitions, not total ownership
- equipping an item may replace another equipped definition in the same explicit equipment slot
- V1 has no weight, encumbrance or inventory-capacity limit

`teamPoolItemIds` is currently an internal/transitional field name for the neutral, unassigned loot pool. It is not a permanent communal backpack.

Loot allocation is a party decision:

- every loot occurrence is allocated to one party actor or explicitly left behind
- the exact proposal requires approval from every current party actor
- without unanimity no allocation state is mutated
- AI1 may narrate loot but does not choose ownership
- AI0 does not choose player loot ownership
- the engine does not randomly distribute contested loot

Do not rename persistence fields ad hoc during visual work. If a migration or persisted-field rename becomes necessary, implement it as an explicit persistence migration rather than an implicit renderer change.

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
- exact loot quantities/content generated by a given encounter
- exact camp healing and when equipment changes are permitted in scene flow
- exact symbolic music notation/synthesis backend
- exact provider/wrapper wire syntax for World Forge, DM, and isolated AI0 runtime transport
- persistence migration policy for older Fate Knots records if one is later required

These are Raistlin/Nexa design decisions or later balancing decisions, not visual/runtime implementation choices.

## Areas where Codex has creative freedom

Codex may decide, within a specific task:

- the visual Game Room hotspot/close-up placement for Fate Knots when that presentation task is explicitly assigned
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

GitHub Actions availability is not assumed for this rebuild. The branch now changes shared Game Room host/UI/manifest integration and includes structural regression coverage, but those tests have intentionally not been executed remotely.

After reconciling this branch with the current local/main Laboratory work, Codex should run the repository's normal typecheck/build/tests, including the Game Room manifest/installed-copy/Fate Knots regressions, then perform a live Game Room smoke check. Fix genuine integration/type errors, but do not weaken the Fate Knots authority or secrecy contracts merely to make a stale unrelated expectation pass.
