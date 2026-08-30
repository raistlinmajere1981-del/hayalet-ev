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

## 11. Combat defeat, falling, and death

A character reaching `0 HP` during combat becomes `fallen`; this is not immediate permanent death.

A fallen character:

- stops taking normal turns for that combat
- cannot commit normal action/movement cards
- remains part of the combat state for effects that explicitly target fallen actors

If the party wins, fallen player characters return with a low configured recovery HP and receive an injury/wound consequence according to the card/status rules.

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
