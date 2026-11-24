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
- strict World Forge validation + canonical unknown-input boundary

## Stage B — Headless core

Status: complete for the current V1 mechanical surface.

Delivered:

- deterministic card availability, legality and effect planning
- lightweight `front | rear` + `engaged | near | far` position model
- combat discussion -> commit -> resolution -> aftermath flow
- movement pass before action pass
- `fast | normal | heavy` priority, effective speed, stable actor-id tie break
- immediate legality recheck before every queued card
- primary-target commit enforcement; secondary-target mechanics fail closed in V1
- combat-only shield/stat/timed-status runtime
- explicit aftermath duration law
- deterministic terminal victory/defeat/retreat authority
- party-victory fallen recovery at configured low HP (default 1)
- personal card inventory + equipment semantics
- transient neutral loot pool + unanimous party allocation
- no weight/encumbrance/capacity/RNG loot subsystem
- explicit `policy | ai0` enemy controller families
- executable V1 `first-legal` deterministic policy fallback
- every encounter opponent requires an explicit controller
- bounded AI0/AI1 runtime packet contracts
- combat `reveal` effects composed into run-owned knot reveal state
- presentation-event contract separate from mechanics
- non-combat run phase authority and authored terminal-story completion boundary

V1 deliberately rejects authored mechanics that the engine does not yet give observable meaning to:

- `secondaryTarget` effects
- non-empty status-definition stat modifiers
- direct `modify-stat` effects for attack/defense/hp/energy

Direct combat `modify-stat` currently supports `speed` and `maxHp` only.

## Stage C — Persistence, story authority and host integration

Status: core story, persistence and player lifecycle implemented. Solo end-to-end engine acceptance passed on the generated universe (exploration, camp, loot, AI0 dialogue and combat, two finale routes). AI2/US1 live multiplayer and AI1 dynamic narration remain separate acceptance tasks.

Delivered:

### Durable state

- restart-safe JSON persistence beneath `room-storage/game-room/fate-knots/`
- RoomHost `setState/getState` treated only as hot cache
- hydration before Fate Knots host operations
- one atomically written `state-v1.json` envelope contains Universe + Run stores together
- old split Universe/Run files are migration input only when no envelope exists
- invalid durable state fails closed instead of being converted to empty state and overwritten
- cache rollback on persistence failure
- mid-combat saves preserve `combatRuntime`
- mid-combat saves preserve active story transition + encounter identity
- universe IDs are immutable canonical identities
- run IDs are host-generated at creation
- active run/universe identity stays coherent
- universe deletion removes associated runs
- run/universe deletion clears associated Fate DM session metadata
- run activation also activates its universe

### Canonical story skeleton

- Universe Package owns bounded `story.knots`, `story.transitions`, and `story.encounters`
- transition requirements limited to completed/revealed knots and party-owned cards
- progression patches limited to reveal/complete knots and reveal locations
- no script/eval/quest DSL
- player-visible scene facts and legal transition ids derived only from canonical story state
- combat destination knot is not activated before victory
- combat `revealId` means a canonical story-knot id in V1
- retreat restores source knot/location
- story outcome + combat exit + tracking cleanup has one composed authority path
- encounter loot preserves the originating combat transition/encounter identity until loot settlement
- unanimous loot settlement returns to `exploration`, recomputes objective readiness, and clears story combat tracking
- encounter factory creates live combat state from canonical definitions; AI does not author live combat state

### V1 story-phase law

Story transition kinds are only:

- `scene`
- `travel`
- `combat`
- `camp`
- `finale`

`loot` is **not** a story-transition kind. Loot is a run phase entered by engine-owned encounter victory when an encounter produces loot.

Encounter loot may contain only `item` and `equipment` cards.

Normal story choices are available only from `exploration`.

A currently legal `kind: "finale"` story transition is itself the canonical terminal-success action. Taking it sets the run to `completed`; V1 does not enter a privileged playable `finale` phase first. `finaleUnlocked` means only that the scenario-level prerequisite set is satisfied.

`finale.finalEncounterId` is optional metadata describing a possible authored combat route. Reaching `finaleLocationId`, unlocking the finale, starting that encounter, or winning it does **not** complete the run. A victory with loot enters normal loot coordination and then returns to `exploration`; a victory without loot returns directly to `exploration`. The party may then camp, prepare, choose another route, or take a legal terminal finale transition.

Camp is also not travel. A `camp` transition means **camp here** at its source knot: it must omit `toKnotId` and `toLocationId`, and the source location must have `campAllowed=true`.

The playability gate requires at least one authored finale transition and, when `finalEncounterId` exists, at least one authored combat transition referencing that encounter. This is a bounded deadlock/reference check, not generic graph search and not a special finale-combat phase.

### Run setup and multiplayer ownership

- Forge creates spoiler-safe complete `player-template` character definitions
- local USER is required; AI2/US1 are optional player seats
- each active player seat owns its own character choice; the host cannot choose AI2/US1's character on their behalf
- selected templates are unique in V1
- encounter opponents cannot use player templates
- every encounter opponent requires an explicit `policy | ai0` controller
- V1 policy registry currently contains only `first-legal`
- V1 combat opening position fixed to `front + near`
- no point-buy/class-tree/encounter-layout subsystem
- run creation verifies the previously recorded seat-owned selections before canonical creation
- stale optional-seat selections are cleared when a seat leaves setup or setup is closed

### AI and remote-player transport/runtime integration

- AI1 Forge and runtime DM session metadata separated
- runtime AI1 receives canonical scene/result packets and returns narration only
- AI0 uses an isolated OpenCode serve process outside the repository tree
- isolated AI0 tools/MCP/filesystem/web/image generation are disabled
- each AI0 call uses a short-lived session; continuity is canonical packet-owned
- NPC dialogue packets come from canonical role data + visible scene state
- AI0 combat packets contain only engine-computed legal options and visible combat state
- hidden commits are not sent to AI0
- AI0 choices still pass through normal combat commit/legality authority
- Electron owns the fixed AI0 policy/system prompt; renderer/room-host IPC cannot supply prompt text
- AI0 IPC validates the bounded Fate runtime packet before invoking the service
- AI2 is a real seat-bound player lifecycle: setup, exploration, private combat options/commit, loot approval and camp readiness are dispatched as bounded prompts and returned through AI2-scoped commands
- repeated AI2 lifecycle probes are deduplicated and never grant AI2 mechanic/canonical authority
- US1 is a real remote human player, not a second World Host
- World Host sends US1 only a player-safe mirror; canonical Universe/Run, hidden canon and mechanic authority stay on World Host
- US1 setup/exploration/NPC/combat/loot/camp actions return as intent-only room commands and are revalidated by existing `scope: "us1"` host handlers
- no timeout/disconnect fallback removes a required active player seat or silently substitutes another controller

### Player-facing authority boundary

- `shared/player-view.ts` / bounded gameplay projections are renderer-facing authority boundaries
- Fate state surfaces do not send the full Universe Package
- hidden knots, finale canon, NPC role packets, encounters and raw hidden asset data remain host-only
- renderer/remote mirrors do not receive a replacement canonical run/combat-runtime snapshot that they can write back
- detailed gameplay surfaces use bounded scene/combat/player packets rather than requesting the whole canon
- public raw `SaveUniverse` / `SaveRun` host handlers were removed
- renderer can send intent-level create/activate/delete/choice/action commands, but it cannot submit replacement canonical state

### Neutral Hub / shared Game Room integration

- Fate Knots registered as a real Game Room feature
- neutral pre-universe Hub works without generated theme assets
- Hub manages universe/run activation/deletion
- Hub receives spoiler-safe player template data only
- Hub exposes optional World Forge brief input
- Forge readiness reports separate blockers for AI1 transport, durable storage, concrete materializer and concurrent Forge activity
- progress exposes safe stage/count/message metadata only; draft/canon is never sent to renderer
- concurrent Forge runs are blocked
- Game Room itself opens in a lightweight neutral `game-room-home` state instead of eagerly mounting Tavla
- Tavla US1 background sync starts only while Tavla is the active feature
- Tavla Konva stage/ResizeObserver resources are explicitly destroyed when another game mounts
- Yahtzee disposes Babylon/audio when deactivated and also destroys Tavla before its own special bridge mount

## Stage D — World Forge and image materialization

Status: complete for the AI1 authoring + AI0 shared OpenCode image path; live 37/37 asset acceptance passed on 2026-11-24. AI1 image authoring remains a separate live acceptance task.

Delivered:

- engine-owned Forge `requestId`, `universeId`, `createdAt`
- AI1 candidate authoring in a dedicated Forge session
- one `unknown -> canonical Universe Package` parser boundary for AI/disk input
- string normalization before identity/reference validation
- structural + playability validation before materialization
- pending asset URI law: `fate-knots-pending://<assetId>`
- every visual asset requires exactly one asset plan
- provider-neutral materializer job contract
- single-image and equal-grid sheet jobs
- max eight sheet cells; six-to-eight preferred
- sheet source aspect ratio derived from grid dimensions × per-cell aspect ratio
- batching planner balances groups for useful 6-8-cell sheets without forcing tiny tails into poor layouts
- partial materializer success retained; missing outputs remain failures
- duplicate/foreign returned asset identities fail closed
- canonical card-art binding through `card-art:<cardId>` asset tags
- finalization requires real stored files and reruns validation
- host verifies each final asset is a readable, non-empty `image/*` file under managed Fate Knots asset storage
- Forge exceptions always reach a terminal failed progress state
- canonical durable save is the commit point; later provenance failure is a warning, not a false Forge failure
- completed pipeline: AI1 draft -> canonical boundary -> validation -> materialization -> managed-file verification -> finalization -> playability/card-art recheck -> durable save -> provenance checkpoint
- `host/forge-service.ts` keeps Forge disabled until a concrete adapter is registered
- `MATERIALIZER-HANDOFF.md` defines the exact local/Codex adapter task

Live acceptance:

- AI1 authored the first playable universe.
- AI0 used the common OpenCode image tool; 37 managed assets verified.
- Durable per-job checkpointing resumes only missing assets; 36 retained images verified unchanged by SHA-256.
- No separate Codex CLI or room-owned OpenCode worker is required.

## Stage E — Babylon living-book runtime

Status: deferred until the next Fate Knots milestone. The current functional renderer is not the living-book presentation.

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
- camp and terminal-objective/epilogue surfaces

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

## Architecture-audit correction checkpoint

The first external audit found concrete authority/lifecycle/strict-TypeScript issues. The branch contains the corresponding fixes for the reported BLOCKER/HIGH paths, including:

- Electron environment-index strict typing
- synchronous Game Room host activation contract
- target legality before commit
- executable enemy policy authority
- unknown/canonical Universe boundary
- loot type validation
- run identity/session cleanup
- crash-consistent durable persistence
- Forge busy/provenance lifecycle
- materializer identity/aspect/path verification
- post-combat/loot objective continuity without a privileged finale phase
- run-owned combat reveal application
- AI0 IPC prompt ownership
- shared Game Room idle-home/Tavla cleanup

## Unified rebuild reconciliation checkpoint

The unified branch also carries the rebuild-side Stage C/D additions:

- provider-neutral Forge lifecycle and host-only canonical acceptance
- isolated external AI0 workspace and provider-response transport gates
- player-safe neutral Hub and run-setup projections
- seat-owned USER/AI2/US1 setup selections
- automatic bounded AI2 player lifecycle
- intent-only US1 remote mirror lifecycle
- separate CreateRun and StartRun intent commands
- bounded active-gameplay projection and browser handoff
- renderer-safe asset, card-art and presentation-cue projection
- deterministic shared combat legal-options helpers and seat-private player options commands
- Fate-specific regression coverage for Forge, AI0, gameplay, multiplayer, presentation and Game Room integration

These additions use the Stage C durable store through compatibility projections. They do not create a parallel Universe/Run authority, and mutating room commands are committed through the validated crash-atomic state envelope after hydration.

`COMBAT-DISCUSSION-V1.md` is the current V1 UX decision. Discussion is one party-only shared surface with no recipient selector, remains open through `combat-discussion` and `combat-commit` until all required standing player actors commit, and never reveals hidden card/target selections to AI0.

The USER/AI2/US1 lifecycle checkpoint has been locally typechecked, linted, regression-tested and built. Before visual integration, keep the next checks focused on:

- end-to-end headless phase continuity and tracking cleanup
- engine/AI/renderer authority leaks
- hidden-canon exposure
- impossible or deadlocked state transitions
- persistence and restart lifecycle faults
- Forge partial-failure/cancellation problems
- AI session isolation regressions
- exactOptionalPropertyTypes / noUncheckedIndexedAccess / strict TypeScript risks
- Game Room integration regressions outside Fate Knots
- places where Babylon/UI could accidentally become canonical state authority

The next hard implementation boundary after the headless-flow audit is the real World Forge asset materializer. Do not redesign Fate Knots or spend the visual/Codex budget on another mechanics layer before that adapter is proven.
