# Fate Knots — Rebuild Contract

This document is the source of truth for the Fate Knots rebuild. It intentionally replaces the removed prototype assumptions. Implementation, visual work, Codex tasks, and future balancing must preserve these rules unless they are explicitly revised.

## 1. Core fantasy

Fate Knots is a card-driven collaborative story game played inside a previously prepared but player-unknown universe.

The player must not begin with knowledge of the world, scenario, map, NPCs, hidden conflicts, or finale. A universe is forged before play. During the run, the player discovers it gradually.

AI is not the rules engine.

- The engine owns canonical runtime state and resolves mechanics.
- AI1 is the DM/narrator. It connects existing world knots into a coherent story and presents scene transitions.
- AI0 portrays NPCs on demand.
- AI2 is an optional player character.
- US1 is an optional remote player character.
- The local user is a player character.

The intended relationship is:

`forged universe -> canonical engine state -> DM/NPC interpretation -> player decisions -> engine resolution -> updated canon`

## 2. Fixed AI roles for this rebuild

The rebuild does not ask a renderer or Codex task to invent role assignments.

- `user`: local player
- `ai1`: DM / narrative bridge
- `ai0`: NPC actor service
- `ai2`: optional second player
- `us1`: optional third player

AI0 is available to the world but is not continuously active. It is invoked when an NPC must speak, trade, react, or make a personality-driven choice that is explicitly delegated to it.

AI1 is not called for every mechanical action. It receives scene-relevant state and engine summaries only when narration is required.

## 3. Two authority periods

### World Forge authority

Before play, AI may create candidate content:

- world premise and tone
- locations and connections
- NPCs and creatures
- items and equipment
- card definitions within the supported card grammar
- encounters and hidden story knots
- map data
- visual theme instructions/assets
- audio theme instructions
- one main finale structure and epilogue conditions

The engine validates and normalizes this output into a canonical Universe Package.

### Runtime authority

After the Universe Package is accepted, AI does not freely rewrite canon.

- The engine owns state changes.
- AI1 narrates from canon and may propose scene choices that stay inside canon and supported mechanics.
- AI0 portrays the NPC role packet it receives.
- Player agents receive only information a player is allowed to know.

## 4. Meta UI versus universe UI

Fate Knots has two deliberately separate presentation layers.

### Neutral Hub

Before a universe exists or is loaded, Fate Knots uses a stable neutral management UI. The Hub may expose normal management controls because no universe theme exists yet.

The Hub owns:

- saved universe list
- continue
- create new universe
- reset/delete universe
- settings
- participant availability
- AI role/status information
- World Forge progress

The first launch must not assume a themed book, table, background, card frame, or map asset.

### Universe Runtime

Only after a Universe Package is ready may the game switch to that universe's generated theme.

The universe theme may define:

- closed-book cover
- table/background
- open-book page surface
- card frame family
- map visual language
- icon/sigil family
- separators/bookmarks
- scene illustration style
- NPC/character portrait style
- transition assets
- ambience/music identity

A saved universe loads its existing package. Continuing a run must not re-run World Forge.

## 5. Book presentation grammar

Once the universe is loaded, the game is presented as a living story book.

The book is not decorative chrome placed around a conventional dashboard. It is the primary presentation surface.

- Exploration and decisions use an open two-page spread.
- Dialogue is presented as part of the page composition, not as a chat application.
- Maps use a dedicated atlas/map spread.
- Combat uses both pages: one team on one page, the opposing team on the other.
- Loot and camp use book-native inventory/record layouts.
- The finale and epilogue are presented as final story pages before the book closes.

## 6. Player-facing UI law

After a universe is loaded, generic application UI must not leak into normal gameplay when the same state can be expressed through the world presentation.

Avoid player-facing:

- generic dropdowns for actions or targets
- dashboard status panels
- generic `OK` / `Confirm` / `Next` buttons where an in-world interaction is possible
- toast messages such as `Your turn`, `2 cards selected`, or `3/3 ready`
- scroll-box storytelling as the primary narrative surface
- raw engine/debug labels

Prefer an interaction grammar that can be understood visually:

- selectable card -> raises/advances visually
- valid target -> target gains a theme-appropriate affordance
- invalid card/target -> visibly unavailable or softly resists interaction
- committed card -> physically settles/locks/seals into place
- ready state -> visible through composition/state, not a mechanical counter message
- transition completion -> page behavior signals that the scene can advance
- status -> icon, attached status card, mark, aura, or other persistent visual state

Short tooltips or help text are allowed for accessibility and learning, but they are support surfaces rather than the normal game language.

Debug UI is separate and may expose exact phase names, IDs, valid targets, card counts, revisions, and other mechanical state.

## 7. Cards are the universal action language

The player should reason primarily in terms of cards they own and cards they are currently allowed to use.

Cards may represent:

- character identity
- movement
- attacks
- defense
- abilities
- equipment-provided techniques
- consumable items
- buffs/debuffs/statuses
- injuries
- choices/events when a scene needs a discrete object representation

Equipment may grant, modify, or remove available cards. A weapon should not require a separate bespoke combat subsystem when its behavior can be represented by the cards it grants.

Example:

- sword -> Slash / Lunge / Parry family
- bow -> Aim / Quick Shot / Volley family
- potion -> consumable heal/status-removal card

V1 does not require a collectible-card-game draw/discard economy. `Available cards` means cards currently owned/granted and legal under state requirements.

## 8. No visible dice system in the rebuild

The removed prototype used d20-style test mechanics. Those are not part of the rebuild contract.

V1 is deterministic by default. Strategy should not be dominated by a hidden or visible luck roll.

If a card is intentionally risky, its risk must be represented explicitly by that card's configured outcome grammar rather than by introducing a global dice subsystem.

## 9. Lightweight position model — no grid

V1 deliberately does not use square or hex grid combat.

The engine may model lightweight tactical position with two small dimensions:

- row: `front | rear`
- range: `engaged | near | far`

Movement is expressed through cards, not coordinate picking.

Examples:

- Advance
- Engage
- Withdraw
- Take Cover
- Charge

Weapon/card legality may depend on row/range. This gives distance and positioning tactical meaning without pathfinding, line-of-sight geometry, tile occupancy, or grid AI.

The data model must not prevent a future coordinate-based mode, but V1 must not implement one.

## 10. Combat ownership and phases

AI1 is outside the combat loop.

AI1 may narrate that combat has begun. The engine then owns combat until a terminal combat result is reached. AI1 receives a compact result package afterward and continues the story from that result.

Combat is turn-based and has no time limit.

Each turn supports:

1. `discussion` — players may talk and plan
2. `commit` — legal card choices and targets are locked
3. `resolution` — engine resolves deterministic mechanics
4. `aftermath` — presentation/status settles before the next discussion

The initial configurable action budget is:

- up to one movement card
- up to one action card

Both are optional. This is external configuration, not a renderer decision.

## 11. Combat defeat, falling, victory recovery, and death

A character reaching `0 HP` during combat becomes `fallen`; this is not immediate permanent death.

A fallen character:

- stops taking normal turns for that combat
- cannot commit normal action/movement cards
- remains part of the combat state for effects that explicitly target fallen actors

V1 party-victory recovery is intentionally severe and simple:

- standing party actors keep the exact HP they finished combat with; victory does not heal the team
- a party actor that is still `fallen` when the party wins returns at the configured recovery HP; the V1 default is `1 HP`
- the recovered actor is no longer `fallen`
- canonical `maxHp` is not automatically reduced
- the engine does not automatically invent or attach a generic injury/wound card

The design deliberately avoids an automatic max-HP penalty because that would require a second implicit restoration model. Lasting wounds remain available through the existing card/status language: if a universe or later balancing pass wants a broken arm, deep wound, concussion, reduced max HP, blocked card family, or similar consequence, it must exist as an explicit injury/status definition with visible mechanics and an explicit removal/recovery rule.

If the player party loses the combat, the run ends as a failure. V1 does not require replacement characters, inheritance systems, or mid-run character recruitment to recover from party defeat.

Retreat is not a free universal button. It may be available only when current cards/rules permit a legal retreat resolution.

## 12. Finale and run ending

World Forge creates a hidden main finale structure as part of the canonical universe.

The finale may include:

- main conflict
- prerequisite knots/information/items
- finale location
- final encounter or decision
- success condition
- epilogue facts that vary from accumulated state

V1 targets one main finale with state-sensitive epilogue variation rather than a large branching ending graph.

Success flow:

`finale resolved -> epilogue -> book closes -> completed`

Failure flow:

`party defeat -> death/failure summary -> book closes -> failed`

## 13. Presentation effects are data, not combat logic

Card mechanics and card presentation must remain separate.

A resolved card may reference presentation metadata such as:

- animation/effect ID
- application target (`self`, `primaryTarget`, `allEnemies`, etc.)
- timing
- persistent status visual
- sound effect ID

Examples:

- sword card -> slash effect on target avatar
- potion card -> glow/pulse on self avatar
- shield card -> barrier effect on target/self

The engine determines what happened and to whom. The presentation layer chooses the configured visual/audio representation.

Effects form a reusable collection that can grow independently from rules and balance.

## 14. Audio direction

SFX should use a reusable catalog referenced by card/presentation IDs.

Music should use a hybrid model:

- reusable instrument/SFX/texture catalog
- per-universe symbolic musical identity created during World Forge when available
- local/runtime synthesis or prepared assets when practical
- state-driven layers such as exploration, travel, camp, tension, combat, victory, defeat, finale

Music generation is not allowed to become a hard dependency for starting a universe. The system must permit a catalog fallback.

Speech:

- existing STT may later feed player discussion/input
- TTS is optional presentation, not a V1 dependency
- data may reserve `voiceProfileId`
- multiple voice profiles are preferred before full narration is enabled

## 15. Runtime phase model

The initial phase vocabulary is:

- `hub`
- `world-forge`
- `run-setup`
- `exploration`
- `transition`
- `combat-discussion`
- `combat-commit`
- `combat-resolution`
- `combat-aftermath`
- `loot`
- `camp`
- `finale`
- `completed`
- `failed`

Only one runtime phase is authoritative at a time.

Individual conversation/inspection actions do not have to end an exploration scene. Scene advancement is a distinct transition decision.

## 16. State ownership summary

### Canon Engine

Owns and mutates:

- universe/run state
- revealed/hidden world state
- player state
- inventory/equipment
- card ownership and legality
- positions
- combat
- status/injury
- loot/team pool
- finale conditions

### AI1 / DM

May:

- narrate scenes
- connect canonical knots
- present engine-supported choices
- narrate transitions
- introduce combat when canon/scene conditions support it
- narrate engine result summaries

Must not:

- invent mechanical results already owned by the engine
- resolve combat
- grant arbitrary loot/stats/items outside engine contracts
- silently rewrite accepted canon

### AI0 / NPC actor

May:

- speak as the supplied NPC
- react according to supplied role state
- conduct roleplay/trade dialogue within engine-provided possibilities
- make personality-driven choices explicitly delegated by the engine

Must not:

- act as global world memory
- determine mechanical outcomes
- know hidden information outside its role packet

### Player agents

Receive only player-visible information and act as players through legal player actions/cards.

## 17. Development boundary

The first implementation stage is headless and data-driven.

Babylon is a presentation/interactivity layer, not the rules owner.

The headless engine must be able to represent a run without requiring the final book scene, generated artwork, particle effects, music, or TTS.

Visual iteration should begin only after state, card, combat, World Forge, and presentation-event contracts are stable enough that a renderer does not need to invent missing game rules.

## 18. Deterministic combat resolution order

Participants make decisions before resolution; resolution does not become a sequence of reactive hidden counter-picks.

Pending player/AI2/US1 commits are not exposed to AI0 enemy decision packets. Once the required commits are locked, the engine resolves the turn in two passes:

1. movement pass
2. action pass

Within each pass the order is:

1. card resolution priority
2. effective character speed
3. stable deterministic tie break

The initial card priority vocabulary is:

- `fast`
- `normal`
- `heavy`

`fast` resolves before `normal`; `normal` resolves before `heavy`. A card without an explicit tier defaults to `normal`.

Effective speed is the actor's canonical speed plus current combat-scoped speed modifiers. Exact ties use a stable actor-id ordering rather than RNG or a dice roll.

The action queue is built after the movement pass has changed positions. Card legality/range must therefore be checked against the current state when an action is about to resolve, not only against the state that existed during commit.

A queued action is also conditional on the actor still being able to act. If a faster action makes an actor `fallen` before that actor's action resolves, the unresolved action is cancelled.

A card may contain its own ordered effect sequence. For example, a Lunge-style action may move and then damage as one action card; this does not create a grid or a separate movement subsystem.

## 19. Enemy combat decision authority

Enemy mechanics are always engine-owned. The initial design supports two tactical controller families:

- `policy` — a deterministic engine policy selected by explicit `policyId`
- `ai0` — a personality-driven NPC decision over engine-provided legal options

Simple enemies should not require an AI0 call merely because AI0 exists. Creatures whose behavior is adequately represented by a deterministic policy should remain local/headless.

AI0 is useful when personality or character intent should influence tactical choice, especially important NPCs and bosses.

For an AI0-controlled enemy the engine provides only the combat-visible packet needed to choose:

- the NPC's visible combat state
- visible actor state
- legal movement cards
- legal action cards
- legal target IDs

The packet must not contain other participants' hidden pending commits, hidden target selections, hidden world facts, or precomputed mechanical outcomes.

AI0 returns only a tactical choice such as movement card, action card, and target. That choice then enters the same legality and commit path used by other actors. AI0 cannot directly mutate HP, status, position, initiative, or combat result.

Specific deterministic policy heuristics are content/balance definitions and are not implicit engine behavior. A policy such as `aggressive-melee` or `defensive-ranged` must be defined explicitly before use rather than invented by renderer/Codex code.

## 20. V1 effect duration law

Fate Knots V1 uses one deliberately small duration grammar instead of separate timer systems for shields, buffs, debuffs and statuses.

Immediate state effects remain immediate:

- damage/heal
- energy/resource changes
- movement/position changes
- card grant/revoke/consume
- reveal/retreat requests

Combat-local protection and direct stat changes are turn-scoped:

- shield created during a turn remains available for later effects in that turn, then clears during aftermath
- direct `modify-stat` combat modifiers remain for the current turn, then clear during aftermath
- when a temporary `maxHp` modifier disappears, current HP is clamped back to the canonical max if necessary

Status duration uses three cases:

1. non-persistent status with no `durationTurns` -> current turn only, removed in aftermath
2. status with `durationTurns: N` -> survives its application turn and remains active for N complete following turns
3. persistent status with no `durationTurns` -> remains until an explicit remove effect or later run rule removes it

A timed status counter does not decrement during the same aftermath in which the status was first applied. Therefore `durationTurns: 1` means the status remains through the rest of the application turn and one complete next turn, expiring after that next turn's aftermath.

Reapplying the same timed status does not create duplicate timers. V1 refreshes the existing timer and never shortens its remaining duration. Explicit status stacking, if later required, must be introduced as a deliberate status rule rather than emerging accidentally from repeated card use.

When an application supplies `durationTurns`, that explicit duration takes precedence over the status definition's default persistence behavior for that application.

This rule keeps common defense/buff cards easy to reason about, gives stun/poison-style statuses useful next-turn behavior, and avoids a second generic duration engine. Longer-lived stat behavior should be represented through an explicit status/card definition rather than by adding separate modifier lifetime semantics.
