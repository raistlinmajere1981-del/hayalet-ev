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
- `AI0-RUNTIME-OVERRIDE.md` for game-runtime isolation from the normal Hayalet Ev coding-agent bootstrap
- `forge/universe-validation.ts` runtime validation + lossless normalization gate for World Forge candidates

## Stage B — Headless core (Nexa / branch-safe)

Status: complete for the current V1 combat/card/runtime contract surface. Local typecheck/tests remain intentionally deferred until the integration checkpoint.

Delivered:

- external/default rules configuration contract in `rules/config.ts`
- lightweight `front | rear` + `engaged | near | far` position helpers in `shared/position.ts`
- deterministic owned/granted/blocked card availability and legality resolver in `shared/card-legality.ts`
- explicit standing/fallen target legality in the shared card requirement contract
- deterministic card effect planning in `shared/effect-resolution.ts`
- mechanical effect target stored separately from presentation `applyTo`
- ordered mechanical patches for damage/heal/shield/status/movement/stat/resource/card/reveal/retreat effects
- combat discussion -> commit -> resolution -> aftermath phase/commit flow
- combat-only runtime state for shields, combat-scoped stat modifiers, timed-status bookkeeping and retreat requests
- atomic ordered patch application
- shield absorption before HP damage and `0 HP -> fallen` applied by combat authority
- duplicate owned item-card ids represent multiple physical copies; `consume` removes one copy while `revoke` removes all copies
- explicit terminal evaluation for party victory, party defeat and retreat
- ambiguous simultaneous fall/retreat terminal states rejected rather than silently resolved by implementation order
- deterministic two-pass resolution ordering: movement first, then action
- per-pass ordering by `fast | normal | heavy`, effective speed, then stable actor-id tie break
- enemy tactical controller contract with explicit `policy | ai0` families
- AI0 combat packets expose legal options/visible state but never hidden pending commits
- full ordered turn execution with legality recheck immediately before each queued card resolves
- an actor made `fallen` by a faster action loses any unresolved queued action
- explicit V1 effect-duration law and aftermath settlement
- shields/direct combat modifiers clear at aftermath; timed/persistent status behavior is explicit
- V1 party-victory recovery: standing actors keep HP, fallen party actors recover at configured low HP (default 1), no implicit max-HP injury system
- terminal cleanup prevents combat-only state leaking into the run
- combat entry/exit authority and party-defeat run failure
- bounded non-combat run transitions and finale completion
- V1 personal inventory/loot flow using actor-owned cards + transient neutral loot pool
- unanimous loot allocation; no weight, encumbrance, inventory-capacity or loot RNG subsystem
- equipment ownership separate from equipped mechanical definitions
- canonical `npcRoles` and bounded AI0 NPC role packet builder
- AI0 runtime request/response validation and stateless packet-owned continuity
- bounded AI1 scene/result packet contracts
- semantic presentation-event helpers; Babylon does not own mechanics

## Stage C — Persistence and host integration (Nexa + local verification)

Status: in progress. Updated `main` was reviewed before shared integration; the intervening Laboratory/Yahtzee changes do not overlap the Fate Knots integration files.

Delivered:

- dedicated `feat/fate-knots-stage-c` integration branch over the completed headless rebuild
- separate Universe Package and Run State validation/mutation stores
- **real restart-safe persistence** under `room-storage/game-room/fate-knots/`; RoomHost `setState/getState` is only a hot cache
- durable JSON hydration before Game Room host readiness
- atomic writes through the existing Electron room-storage bridge and cache rollback on durable-write failure
- null-safe rollback snapshots even if a durable helper is called before normal hydration
- run snapshots preserve `combatRuntime` only while combat is active, allowing mid-combat restart/resume of shields, timed statuses and combat-scoped modifiers
- story transition + encounter identity is also persisted during combat so a resumed victory/retreat resolves against the same canonical encounter
- universe deletion removes associated runs; run activation also activates its universe
- Fate Knots host management command family for refresh/save/activate/delete of universes and runs
- Game Room host runtime hydrates Fate Knots durable state and publishes `fate-knots-state`
- Fate Knots registered in shared Game Room feature metadata and room manifest
- neutral pre-universe Hub in `ui/hub.js` + `ui/hub.css`
- Hub manages accepted saved universes/runs without pretending an uncreated universe already has a book/theme
- active Fate Knots feature receives its own host-state refresh through the shared Game Room lifecycle
- bounded AI1 runtime: narration only, no mechanics, transition choice, canon invention or combat resolution
- separate AI1 Forge/runtime session metadata so hidden Forge authoring context is not reused as normal DM history
- AI1 SlotBridge transport supports dedicated session opening and validated JSON requests
- isolated AI0 Electron transport through the existing `roomToolsCall` surface
- Fate-specific background OpenCode server uses a separate 4120-4134 port range and external app-data workspace; the normal visible development AI0 session/server is not reused
- isolated AI0 workspace materializes only a minimal Fate policy plus `permission: {"*":"deny"}` and `tools: {"*": false}`
- every AI0 dialogue/combat request uses a fresh short-lived session that is deleted after the response
- AI0 structured responses are parsed and revalidated before they can reach engine authority

Transport research decision:

- stable OpenCode V1 does not reliably honor per-session directory override
- V2 directory-scoped sessions remain beta and are not a Fate Knots dependency
- V1 uses a separate isolated OpenCode `serve` process rooted in the Fate runtime workspace
- fail closed on isolation/provider errors; never silently fall back to a repository-root NPC session

Remaining Stage C integration:

- connect the bounded AI1/AI0 transports to concrete gameplay orchestration call sites (scene narration, NPC interaction and AI0-controlled enemy commits)
- expose run creation/character selection through the host command surface
- persistence-facing cleanup/migration of the internal `teamPoolItemIds` name when the persisted V1 schema is finalized
- local strict typecheck/build/regression verification after the World Forge adapter boundary is stable

## Stage D — World Forge orchestration (shared)

Status: core orchestration is defined behind the still-disabled Hub `Create universe` control. The remaining hard dependency is a concrete image/materialization adapter and its Hub wiring.

Delivered:

- `forge/world-forge.ts` separates non-canonical AI authoring from canonical Universe Package authority
- Forge `requestId`, `universeId`, and `createdAt` are engine-owned and must round-trip unchanged
- AI-authored asset paths cannot become canonical paths
- every draft visual asset uses `fate-knots-pending://<assetId>` and has exactly one generation plan
- audio-file generation is not a World Forge hard dependency; music may use symbolic/catalog fallback
- canonical finalization requires every pending asset to become a real stored file, then reruns validation + lossless normalization
- missing/duplicate/foreign materialized assets fail closed
- canonical story skeleton added to `FateKnotsUniversePackage`: knots, transitions and encounters
- story transitions support only bounded requirements (`completed/revealed knots`, party-owned cards) and bounded progression patches (`reveal/complete knots`, reveal locations); no script/eval/quest DSL
- start knot, hidden-knot consistency, story references, combat encounters and finale references are validated structurally
- deterministic `shared/story-progression.ts` derives player-visible facts and legal transition ids from canon
- AI1 scene packets may be built through `shared/story-dm.ts`, which derives facts/transitions from canon instead of accepting caller-invented lists
- combat transitions do not reveal their destination before victory; retreat restores the source knot/location
- story outcome -> combat exit -> story tracking cleanup has a composed authority path in `shared/story-combat-flow.ts`
- canonical encounter builder creates combat state from party actors + forged opponent character templates; AI does not author live combat state
- V1 party and opposition opening combat position is fixed `front + near`; tactical variation begins through movement cards rather than an encounter-layout DSL
- bounded player run setup in `shared/run-setup.ts`: Forge supplies spoiler-safe `player-template` characters; `user`, optional `ai2`, optional `us1` select complete templates; no point-buy/class-tree builder in V1
- minimum playability gate rejects a Forge universe with no player template or one that uses a player template as an encounter opponent
- World Forge authoring prompt explicitly describes the supported story/card/NPC/finale grammar and produces JSON only
- dedicated AI1 Forge session authoring in `host/world-forge-authoring.ts`; candidate is validated before any asset generation or canonical save
- provider-neutral asset materializer job planner in `forge/materializer.ts`
- compatible batch groups prefer sheet jobs, max eight cells; 4-8 compatible images may batch while small tails fall back to singles
- sheet jobs use the existing equal-grid crop contract and retain partial success so failed cells can be regenerated independently
- canonical card-art mapping uses the asset tag `card-art:<cardId>`; duplicate, foreign or wrong-kind bindings are rejected
- `host/world-forge-orchestrator.ts` composes: durable readiness -> AI1 draft -> materialization -> finalization -> playability/card-art recheck -> durable universe save -> Forge provenance checkpoint

Still required before Hub `Create universe` is enabled:

- concrete `FateKnotsAssetMaterializerAdapter` implementation using a supported image-generation path
- ensure generated files/crops are stored beneath the managed Fate/Game Room storage boundary and returned as normal materialized assets
- expose Forge progress/readiness/failure state to the Neutral Hub
- wire the Hub create action to the completed orchestrator only when a materializer adapter is actually available

The Hub must continue to work without a generated book/background/theme.

Batch generation is an optimization, not a runtime dependency. Six-to-eight related card/item illustrations remain the preferred high-value batch size when quality permits. Generated card art contains illustration only; typography, rules, frames, icons and selection state remain deterministic renderer work.

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
- run-setup/player-template selection surface
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

GitHub Actions are not assumed available. Run the repository's normal typecheck/build/tests and live Game Room checks locally once the full Hub -> Forge -> validated/materialized Universe Package -> durable save -> bounded AI runtime chain reaches a stable checkpoint.

The next intended external architecture review should happen just before or alongside that first local verification. The review must look for contradictions, authority leaks, persistence/lifecycle faults and strict-TypeScript risks; it must not redesign Fate Knots or invent new game rules.
