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

Still intentionally deferred until the package/state shapes are exercised:

- full Universe Package validation/normalization helpers

No Game Room registration or shared host wiring is required in this stage.

## Stage B — Headless core (Nexa / branch-safe)

Status: in progress.

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
- run reveal patches deferred out of combat authority rather than mutating run state directly
- explicit terminal evaluation in `shared/combat-result.ts` for party victory, party defeat and retreat
- ambiguous simultaneous fall/retreat terminal states are rejected rather than silently resolved by implementation order
- deterministic two-pass resolution ordering in `shared/resolution-order.ts`: movement first, then action
- per-pass ordering by `fast | normal | heavy` card priority, effective speed, then stable actor-id tie break
- action queue intended to be rebuilt after movement; fallen actors are skipped/cancelled before unresolved actions
- enemy tactical controller contract in `shared/enemy-controller.ts`
- explicit `policy | ai0` enemy controller families without moving mechanical authority out of the engine
- AI0 combat decision packets expose legal options and visible combat state but never hidden participant commits
- deterministic policy heuristics deliberately remain explicit content modules rather than implicit fallback behavior

Next planned pieces:

- resolution executor that revalidates legality against post-movement state before each action and applies effect patches in queue order
- aftermath settlement and timed-status turn bookkeeping
- fallen post-victory recovery contract once exact recovery/injury values are deliberately chosen
- run phase transitions
- Universe Package validation/normalization shell
- DM scene/result packet builders
- AI0 NPC role packet builder for narrative/non-combat interaction
- presentation-event emitter helpers

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

This is the first stage likely to touch shared Game Room files and therefore the first stage where rebasing/merging current `main` should be considered before edits.

## Stage D — Neutral Hub and World Forge orchestration (shared)

Implement the stable pre-universe management surface and orchestration:

- saved universes
- create/continue/reset/delete
- connection/readiness display
- World Forge progress
- draft -> validation -> canonical Universe Package
- generated theme/assets attached to the universe

The Hub must work without a generated book/background/theme.

## Stage E — Babylon book runtime (Codex/local)

Local visual/runtime work after contracts are available:

- closed book reveal
- opening/page transitions
- exploration spread
- dialogue/choice composition
- atlas/map spread
- combat two-page spread
- card selection/target/commit affordances
- loot/camp/finale surfaces

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
