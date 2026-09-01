# Fate Knots — Implementation Plan

The rebuild is intentionally staged so each change is reviewable and can be merged/rebased independently of unrelated room work.

## Stage A — Contract lock

Status: complete.

Delivered:

- `README.md` design authority
- `CODEX-HANDOFF.md` implementation guardrails
- `shared/contracts.ts`
- `FORGE-ASSET-CONTRACT.md`
- `AI0-RUNTIME-OVERRIDE.md`
- `MATERIALIZER-HANDOFF.md`
- strict World Forge validation + lossless normalization gate

## Stage B — Headless core

Status: complete for the current V1 mechanical surface. Local typecheck/tests are intentionally deferred to the integration checkpoint.

Delivered:

- deterministic card availability, legality and effect planning
- lightweight `front | rear` + `engaged | near | far` position model
- combat discussion -> commit -> resolution -> aftermath flow
- movement pass before action pass
- `fast | normal | heavy` priority, effective speed, stable actor-id tie break
- immediate legality recheck before every queued card
- combat-only shield/stat/timed-status runtime
- explicit aftermath duration law
- deterministic terminal victory/defeat/retreat authority
- party-victory fallen recovery at configured low HP (default 1)
- personal card inventory + equipment semantics
- transient neutral loot pool + unanimous party allocation
- no weight/encumbrance/capacity/RNG loot subsystem
- explicit `policy | ai0` enemy controller families
- bounded AI0/AI1 runtime packet contracts
- presentation-event contract separate from mechanics
- non-combat run phase authority and finale completion boundary

## Stage C — Persistence, story authority and host integration

Status: implementation complete enough for the first architecture/typecheck checkpoint. The remaining external dependency is the concrete World Forge image materializer from Stage D.

Delivered:

### Durable state

- restart-safe JSON persistence beneath `room-storage/game-room/fate-knots/`
- RoomHost `setState/getState` treated only as hot cache
- hydration before Fate Knots host readiness
- atomic per-file writes and cache rollback on persistence failure
- separate Universe Package and Run stores
- mid-combat saves preserve `combatRuntime`
- mid-combat saves preserve active story transition + encounter identity
- universe deletion removes associated runs
- run activation also activates its universe

### Canonical story skeleton

- Universe Package owns bounded `story.knots`, `story.transitions`, and `story.encounters`
- transition requirements limited to completed/revealed knots and party-owned cards
- progression patches limited to reveal/complete knots and reveal locations
- no script/eval/quest DSL
- player-visible scene facts and legal transition ids derived only from canonical story state
- combat destination knot is not activated before victory
- retreat restores source knot/location
- story outcome + combat exit + tracking cleanup has one composed authority path
- encounter factory creates live combat state from canonical definitions; AI does not author live combat state

### V1 story-phase law

Story transition kinds are only:

- `scene`
- `travel`
- `combat`
- `camp`
- `finale`

`loot` is **not** a story-transition kind. Loot is a run phase entered by engine-owned encounter victory when an encounter produces loot.

Normal story choices are available only from `exploration`.

A `finale` transition enters the `finale` phase. Inside `finale`, the story resolver exposes only the combat transition whose encounter id equals `finale.finalEncounterId`. If there is no final encounter, story transitions are not exposed in finale and the explicit finale-choice/success authority remains responsible for completion.

The playability gate requires at least one finale transition and, when `finalEncounterId` exists, a matching combat transition from a finale-entry knot. This is a bounded deadlock check, not generic graph search.

### Run setup

- Forge creates spoiler-safe complete `player-template` character definitions
- local user is required; AI2/US1 are optional player seats
- selected templates are unique in V1
- encounter opponents cannot use player templates
- opposition templates used in encounters require an explicit controller
- V1 combat opening position fixed to `front + near`
- no point-buy/class-tree/encounter-layout subsystem
- host exposes intent-level run creation from seat -> template selections

### AI transport/runtime integration

- AI1 Forge and runtime DM session metadata separated
- runtime AI1 receives canonical scene/result packets and returns narration only
- AI0 uses an isolated OpenCode serve process outside the repository tree
- isolated AI0 tools/MCP/filesystem/web/image generation are disabled
- each AI0 call uses a short-lived session; continuity is canonical packet-owned
- NPC dialogue packets come from canonical role data + visible scene state
- AI0 combat packets contain only engine-computed legal options and visible combat state
- AI0 choices still pass through normal combat commit/legality authority

### Player-facing authority boundary

- `shared/player-view.ts` is the renderer-facing projection boundary
- `fate-knots-state` no longer sends the full Universe Package
- hidden knots, finale canon, NPC role packets, encounters and raw asset paths remain host-only
- `fate-knots-state` no longer sends the full canonical run/combat-runtime snapshot
- detailed gameplay surfaces must use bounded scene/combat/player packets rather than requesting the whole canon
- public raw `SaveUniverse` / `SaveRun` commands were removed
- renderer can send intent-level create/activate/delete/choice/action commands, but it cannot submit replacement canonical state

### Neutral Hub

- Fate Knots registered as a real Game Room feature
- neutral pre-universe Hub works without generated theme assets
- Hub manages universe/run activation/deletion
- Hub receives spoiler-safe player template data only
- Hub exposes optional World Forge brief input
- Forge readiness reports separate blockers for AI1 transport, durable storage, concrete materializer and concurrent Forge activity
- progress exposes safe stage/count/message metadata only; draft/canon is never sent to renderer
- concurrent Forge runs are blocked

## Stage D — World Forge and image materialization

Status: headless orchestration complete; one concrete provider adapter remains.

Delivered:

- engine-owned Forge `requestId`, `universeId`, `createdAt`
- AI1 candidate authoring in a dedicated Forge session
- structural + playability validation before materialization
- pending asset URI law: `fate-knots-pending://<assetId>`
- every visual asset requires exactly one asset plan
- provider-neutral materializer job contract
- single-image and equal-grid sheet jobs
- max eight sheet cells; six-to-eight preferred
- batching planner balances groups for useful 6-8-cell sheets without forcing tiny tails into poor layouts
- partial materializer success retained; missing outputs remain failures
- canonical card-art binding through `card-art:<cardId>` asset tags
- finalization requires real stored files and reruns validation
- completed pipeline: AI1 draft -> validation -> materialization -> finalization -> playability/card-art recheck -> durable save -> provenance checkpoint
- `host/forge-service.ts` keeps Forge disabled until a concrete adapter is registered
- `MATERIALIZER-HANDOFF.md` defines the exact local/Codex adapter task

Remaining hard dependency:

- implement one real `FateKnotsAssetMaterializerAdapter`
- reuse/wrap existing generated-image extraction capability where practical
- persist real source/crop files beneath managed Fate/Game Room storage
- register the adapter through `registerFateKnotsAssetMaterializer`

Do not fake this dependency with placeholder paths. Until a real adapter exists, Hub `Create universe` remains correctly blocked.

## Stage E — Babylon living-book runtime

Status: local/Codex visual work after the first audit/typecheck checkpoint and concrete materializer boundary.

Planned surfaces:

- closed-book reveal and opening transition
- exploration spread
- dialogue/choice composition
- atlas/map spread
- combat two-page spread
- card selection/target/commit affordances
- personal inventory/equipment spread
- unanimous loot-allocation spread
- run-setup/player-template selection
- camp/finale surfaces

Renderer consumes semantic projections/events; it does not infer or mutate mechanics.

Use at least two visually different mock Theme Packages to prove presentation is universe-driven rather than hardcoded to one book.

## Stage F — Presentation collection

Iterative local work independent from rules:

- slash/stab/blunt/projectile effects
- defense/heal/status/movement effects
- persistent status visuals
- card SFX
- ambience
- reusable music instrument/texture resources
- symbolic universe music identity experiment

## Stage G — Optional speech

Later only:

- STT may feed normal player discussion/input
- `voiceProfileId` remains reserved
- TTS is optional and not a V1 dependency

## First architecture / local verification checkpoint

The branch has now reached the first useful external review point.

The review must **not redesign Fate Knots**. It should look for:

- engine/AI/renderer authority leaks
- hidden-canon exposure
- impossible or deadlocked state transitions
- persistence and restart lifecycle faults
- Forge partial-failure/cancellation problems
- AI session isolation regressions
- exactOptionalPropertyTypes / noUncheckedIndexedAccess / strict TypeScript risks
- Game Room integration regressions outside Fate Knots
- places where Babylon/UI could accidentally become canonical state authority

After the architecture audit, run local strict typecheck/build/regression checks. GitHub Actions availability is not assumed.
