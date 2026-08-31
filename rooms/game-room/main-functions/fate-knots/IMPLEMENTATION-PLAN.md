# Fate Knots — Implementation Plan

The rebuild is intentionally staged so each change is reviewable and can be merged/rebased independently of unrelated room work.

## Stage A — Contract lock (Nexa / branch-safe)

Status: complete for initial headless work.

Goals:

- preserve the agreed game design in-repo
- define data contracts before renderer work
- prevent local implementation from inventing rules

Delivered:

- `README.md` design contract
- `CODEX-HANDOFF.md` guardrails
- `shared/contracts.ts`
- `FORGE-ASSET-CONTRACT.md` for provider-independent image/asset generation boundaries
- `forge/universe-validation.ts` runtime validation + lossless normalization gate for World Forge candidates

No Game Room registration or shared host wiring is required in this stage.

## Stage B — Headless core (Nexa / branch-safe)

Status: in progress, combat/run boundary and V1 loot ownership established.

Build inside `main-functions/fate-knots` without final visuals.

Delivered so far:

- external/default rules configuration contract in `rules/config.ts`
- lightweight `front | rear` + `engaged | near | far` position helpers in `shared/position.ts`
- deterministic owned/granted/blocked card availability and legality resolver in `shared/card-legality.ts`
- explicit standing/fallen target legality in the shared card requirement contract
- deterministic card effect planning in `shared/effect-resolution.ts`
- mechanical effect target stored in the canonical card effect contract, separate from presentation `applyTo`
- ordered mechanical patches for damage/heal/shield/status/movement/stat/resource/card/reveal/retreat effects
- combat discussion -> commit -> resolution -> aftermath phase/commit flow in `shared/combat-flow.ts`
- combat-only runtime state in `shared/combat-runtime.ts` for shields, combat-scoped stat modifiers, timed-status bookkeeping and retreat requests
- atomic ordered patch application in `shared/combat-patch-apply.ts`
- shield absorption before HP damage and `0 HP -> fallen` applied by combat authority, not by the card planner
- duplicate owned item-card ids represent multiple physical copies; `consume` removes one copy while `revoke` removes all copies
- run reveal patches deferred out of combat authority rather than mutating run state directly
- explicit terminal evaluation in `shared/combat-result.ts` for party victory, party defeat and retreat
- ambiguous simultaneous fall/retreat terminal states are rejected rather than silently resolved by implementation order
- deterministic two-pass resolution ordering in `shared/resolution-order.ts`: movement first, then action
- per-pass ordering by `fast | normal | heavy` card priority, effective speed, then stable actor-id tie break
- enemy tactical controller contract in `shared/enemy-controller.ts`
- explicit `policy | ai0` enemy controller families without moving mechanical authority out of the engine
- AI0 combat decision packets expose legal options and visible combat state but never hidden participant commits
- deterministic policy heuristics deliberately remain explicit content modules rather than implicit fallback behavior
- full ordered turn execution in `shared/combat-resolution-executor.ts`
- movement resolves before the action queue is rebuilt from the new state
- every queued card is revalidated immediately before execution; post-commit range/status/position changes can cancel a card without corrupting combat
- an actor made `fallen` by a faster action loses any unresolved queued action
- terminal victory/defeat/retreat evaluation runs during ordered resolution and stops later queued actions once combat ends
- explicit V1 effect-duration law and aftermath settlement in `shared/combat-aftermath.ts`
- shields and direct combat stat modifiers clear at aftermath
- non-persistent untimed statuses are turn-scoped
- `durationTurns` statuses survive the application turn plus the configured number of complete following turns
- timed status reapplication refreshes one timer rather than stacking duplicate timers
- persistent untimed statuses survive until explicit removal
- V1 party-victory recovery in `shared/post-combat-settlement.ts`: standing actors keep HP, fallen party actors recover at the configured low HP (default 1), no implicit max-HP injury system
- terminal cleanup in `shared/combat-closure.ts`: timed/combat-only statuses and combat runtime state cannot leak into the run
- combat entry/exit authority in `shared/run-flow.ts`
- party defeat automatically moves the run to `failed`; victory/retreat require an explicit engine-selected next phase rather than guessed story flow
- party combat state is synchronized back into persistent run actor state only at combat exit
- V1 personal inventory/loot flow in `shared/loot.ts`
- `ownedCardIds` is the personal card inventory; `item` and `equipment` cards are inventory-visible ownership
- `teamPoolItemIds` is a transient neutral/unassigned loot pool, not a permanent shared inventory
- loot allocation requires unanimous approval from the current party and covers every loot entry; no agreement means no state mutation
- equipment ownership is the equipment card; `equipmentIds` stores only currently equipped mechanical definitions
- one explicit equipment slot may be occupied at a time; equipping a new definition in the same slot unequips the old one
- no weight, encumbrance, inventory-capacity or loot RNG subsystem in V1
- Universe Package validation checks structural safety, unique IDs, references, effect target/value/duration shapes, map/finale links and equipment-card ownership consistency
- normalization is lossless only: trim/dedupe/copy; it does not invent missing canon, rules, assets or fallback content

Next planned pieces:

- small run-phase helpers beyond combat entry/exit where the transition is already design-authorized
- DM scene/result packet builders
- AI0 NPC role packet builder for narrative/non-combat interaction
- presentation-event emitter helpers
- later: persistence-facing naming/migration for the currently internal `teamPoolItemIds` loot-pool field

Requirements:

- deterministic by default
- no Babylon dependency
- no image/audio generation dependency
- no Game Room shared integration until the feature core is coherent

## Stage C — Persistence and host integration (Nexa + local verification)

Only after Stage B contracts settle:

- universe storage
- run save/resume
- feature registration
- host command family
- Game Room context/state bridge
- player/AI transport integration points
- neutral Hub state surface
- persistence-safe naming/migration for personal inventory and transient loot state

This is the first stage likely to touch shared Game Room files and therefore the first stage where rebasing/merging current `main` should be considered before edits.

## Stage D — Neutral Hub and World Forge orchestration (shared)

Implement the stable pre-universe management surface and orchestration:

- saved universes
- create/continue/reset/delete
- connection/readiness display
- World Forge progress
- draft -> validation -> canonical Universe Package
- generated theme/assets attached to the universe
- provider-independent image adapter
- optional batch image-sheet extraction using `forge/image-sheet.ts`

The Hub must work without a generated book/background/theme.

Batch image generation is an optimization, not a runtime dependency. Prefer 6-8 illustration cells per request when quality is acceptable; extract accepted cells into normal individual assets and regenerate failed cells independently. Generated card art must not bake card typography/rules/UI into the image.

## Stage E — Babylon book runtime (Codex/local)

Local visual/runtime work after contracts are available:

- closed book reveal
- opening/page transitions
- exploration spread
- dialogue/choice composition
- atlas/map spread
- combat two-page spread
- card selection/target/commit affordances
- personal inventory/equipment spread
- unanimous loot-allocation spread
- camp/finale surfaces

Codex should consume semantic state/events rather than infer mechanics from UI.

Use at least two visually different mock universe Theme Packages to prove that the renderer is theme-driven rather than hardcoded to one book design.

## Stage F — Presentation collection (Codex/local, iterative)

Grow reusable catalogs independently from the rules engine:

- slash/stab/blunt/projectile effects
- defense/heal/status/movement effects
- persistent status visuals
- card SFX
- ambience
- music instrument/texture resources
- universe music identity experiment

Artistic variation is encouraged here; game-rule invention is not.

## Stage G — Optional speech layer (later)

- STT can feed normal player discussion/input
- reserve/use `voiceProfileId`
- TTS remains optional until multiple useful voice profiles are available

Do not make speech a V1 launch dependency.

## Local testing handoff

GitHub Actions are not assumed available. After the current Laboratory work is finished and branches are merged locally, run the repository's normal typecheck/build/tests and live Game Room checks there.

Until then, keep commits small and isolate Fate Knots work from shared room files wherever possible.
