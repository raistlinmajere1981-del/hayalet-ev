# Fate Knots — Codex Handoff Guardrails

This file exists to keep local Codex work from redesigning Fate Knots while solving implementation or visual tasks.

Read `README.md` first. For image-provider work also read `FORGE-ASSET-CONTRACT.md` and `MATERIALIZER-HANDOFF.md`.

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
- a generic quest scripting/eval DSL
- an encounter coordinate/layout DSL for V1
- a `loot` story-transition kind
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

Combat remains headless and deterministic. AI1 sees bounded scene context and a final combat result summary, not per-action combat authority.

## Fixed renderer / host authority boundary

The renderer is not a trusted canonical-state store.

`fate-knots-state` intentionally exposes only spoiler-safe projections built through `shared/player-view.ts` plus Forge readiness/progress metadata.

Do **not** send the full `FateKnotsUniversePackage` to Hub/Babylon/player-facing renderer code. In particular, renderer state must not receive:

- hidden story knots
- full story graph
- finale hidden canon
- NPC role/knowledge packets
- encounter definitions that are not currently player-visible
- raw provider/storage asset paths merely for convenience

Do **not** send the full persisted Run snapshot or combat-runtime bookkeeping to the generic Hub state either. Detailed gameplay views must use bounded scene/combat/player projections.

Public raw `GameRoomFateKnotsSaveUniverse` and `GameRoomFateKnotsSaveRun` commands were deliberately removed. Do not recreate equivalent "replace canonical state" commands from Babylon/UI.

Player-facing code sends **intent** such as create/activate/delete universe/run, choose transition/card/target, commit action or resolve a specific allowed interaction. Host/engine code derives and persists the resulting canonical state.

Debug tooling may inspect canonical state through an explicitly debug-only surface later, but that surface must not become the normal gameplay data path.

## Fixed canonical story authority

World Forge creates a bounded story skeleton as canonical data. Runtime AI does not invent progression.

The Universe Package owns:

- `story.startKnotId`
- canonical story knots and their player-visible facts
- bounded story transitions
- canonical combat encounters
- hidden/revealed knot identity
- finale prerequisites

V1 story-transition kinds are exactly:

- `scene`
- `travel`
- `combat`
- `camp`
- `finale`

`loot` is a **run phase**, not a story-transition kind. The engine opens loot after encounter victory when canonical encounter loot exists. Every encounter loot entry must be an `item` or `equipment` card.

Normal story choices are selectable only from `exploration`.

A `finale` transition moves the run into `finale`. While the run is in `finale`, the story resolver exposes only a combat transition whose `encounterId` equals `finale.finalEncounterId`. If the final encounter yields loot, the originating finale transition/encounter identity remains attached through loot settlement so the composed loot authority can return the run to `finale` rather than incorrectly resetting it to exploration.

If no final encounter exists, finale completion/choice authority remains explicit elsewhere; do not improvise a generic finale transition loop.

The playability gate requires at least one finale transition. When `finalEncounterId` exists, a matching combat transition must originate from a finale-entry knot. Do not replace this bounded deadlock check with a generic workflow engine.

V1 transition requirements are limited to:

- completed knot ids
- revealed knot ids
- party-owned card ids

V1 progression patches are limited to:

- reveal knot ids
- complete knot ids
- reveal location ids

Do not replace this with scripts, expression evaluation, arbitrary prompt conditions, quest bytecode, or a generic workflow engine.

AI1 scene packets derive `visibleFacts` and `availableTransitionIds` from the canonical story resolver. Renderer/host code must not inject arbitrary transition lists.

Combat `reveal` effects are run-owned deferred patches. In V1 `revealId` is exactly a canonical `story.knots` id; the composed combat/run resolver applies successful reveal patches to `revealedKnotIds`. Do not invent a second generic reveal namespace.

Combat transitions do not reveal/activate their destination knot before victory. Retreat restores the source knot/location. Story transition and encounter ids remain attached until combat has actually exited so mid-combat persistence stays coherent.

The V1 encounter opening position is fixed at `front + near` for both player and opposition actors. Tactical differentiation begins through movement cards. Do not add encounter coordinates or per-enemy placement unless a later design task explicitly requests it.

## Fixed V1 run setup

World Forge creates complete spoiler-safe player templates tagged exactly `player-template`.

- local user must select one template
- AI2 and US1 may optionally select one template each
- selected player templates must be distinct in V1
- encounter opponents may not use a `player-template`
- every character actually referenced by an encounter must have an explicit combat controller
- generic enemy templates may use `opposition-template`

V1 intentionally does not implement point-buy, class trees, origin combinators, or a large character-builder subsystem. The selected complete template becomes actor state through the engine run-setup helper.

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

The implemented V1 compatibility path uses a separate OpenCode `serve` process rooted in external Fate app-data storage, not the visible development AI0 session/server. Stable OpenCode V1 per-session directory override was deliberately not trusted; V2 directory-scoped sessions are not a dependency.

V1 Fate Knots AI0 runtime has no tools by default: no filesystem, shell, MCP, web, image generation, GitHub or project memory. World Forge image generation is a separate authority surface and must not be attached to the NPC actor merely because both use AI.

AI0 calls are packet-driven/stateless. NPC continuity comes from canonical persona/known/relationship facts and current scene/combat packets supplied by the engine. AI0 output is validated before the engine accepts any interaction or combat choice.

The Electron AI0 IPC boundary owns the fixed Fate policy/system prompt. Renderer/room-host requests may supply bounded runtime data only; do not reintroduce renderer-controlled `policyText` or `systemPrompt` fields.

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

A card effect using `primaryTarget` makes a primary target mandatory at commit time. V1 does **not** define secondary-target legality/commit semantics; World Forge rejects `secondaryTarget` effects rather than allowing Codex or AI to invent a second-target rule.

`0 HP` means `fallen` during combat. Party defeat ends the run.

## Fixed V1 party-victory recovery

- standing party actors keep the exact HP they finished combat with
- a party actor that was `fallen` when the party wins returns at the configured low recovery HP; V1 default is `1 HP`
- recovered actors are no longer `fallen`
- canonical `maxHp` is not automatically reduced
- V1 does not automatically invent or attach a generic injury card

If a lasting wound is desired later, represent it explicitly as an injury/status card with visible mechanics and an explicit removal/recovery rule. Do not silently lower max HP or invent a restoration timer in renderer/local code.

## Fixed V1 effect duration law

- damage/heal/resource/card ownership/movement effects are immediate state changes
- shields are turn-scoped and clear in aftermath
- direct combat stat modifiers are turn-scoped and clear in aftermath
- V1 direct `modify-stat` effects may modify only `speed` or `maxHp`; attack/defense stat effects are rejected until an explicit combat formula uses them
- status-definition `modifiers` are not a V1 authored mechanic and World Forge rejects non-empty status modifier lists
- a non-persistent status without `durationTurns` lasts only the current turn and clears in aftermath
- a status with `durationTurns: N` survives the application turn and then remains for N complete following turns
- timed status counters do not decrement in the application turn
- reapplying the same timed status refreshes one timer rather than stacking duplicate timers
- a persistent status without `durationTurns` remains until explicit removal
- `durationTurns` overrides default status persistence for that application

If a design later needs a multi-turn stat change, represent it through an explicit supported status/card contract rather than adding another modifier timer system silently.

## Fixed V1 inventory and loot law

Inventory remains card-native and deliberately small:

- every actor owns a personal card inventory through `ownedCardIds`
- `item` and `equipment` cards are inventory-visible physical belongings
- duplicate owned item-card IDs represent multiple physical copies
- consuming an item removes one owned copy; revoking a card removes all copies of that card id
- equipment ownership is represented by owning its `equipment` card
- an equipment card points through `sourceId` to its mechanical equipment definition
- `equipmentIds` stores only currently equipped definitions
- equipping may replace another definition in the same explicit slot
- V1 has no weight, encumbrance or inventory-capacity limit

`teamPoolItemIds` is currently an internal/transitional field name for the neutral, unassigned loot pool. It is not a permanent communal backpack.

Loot allocation is a party decision:

- every loot occurrence is allocated to one party actor or explicitly left behind
- the exact proposal requires approval from every current party actor
- without unanimity no allocation state is mutated
- AI1 may narrate loot but does not choose ownership
- AI0 does not choose player loot ownership
- the engine does not randomly distribute contested loot

Do not rename persistence fields ad hoc during visual work; any migration must be explicit.

## Fixed enemy combat control

Enemy mechanics remain engine-owned. Tactical choice has exactly two controller families:

- `policy`: deterministic engine policy identified by an explicit `policyId`
- `ai0`: personality-driven NPC choice over engine-provided legal options

Every character referenced by a canonical encounter must have one of those controllers. `opposition-template` is useful content metadata but is not the authority gate by itself.

V1 currently registers exactly one deterministic policy id: `first-legal`. It is deliberately non-personality-driven and chooses:

1. first legal action by stable card id, then stable target id
2. otherwise first legal movement by stable card id, then stable target id
3. otherwise an explicit empty commit

It intentionally selects at most one card slot per turn because the current commit contract has one shared `primaryTargetId`. Do not invent additional policy IDs or personality heuristics until a later task explicitly defines them.

AI0 receives only combat-visible state and legal card/target options. It must not receive other participants' hidden commits or hidden canon. AI0 returns a choice; the normal legality/commit path validates it again before storage.

Simple creatures may use `first-legal`. AI0 is intended for NPCs/bosses where personality adds value.

## Fixed World Forge and asset authority

AI1 World Forge authoring produces a **non-canonical candidate**. It does not directly save a playable universe.

The engine owns Forge `requestId`, `universeId` and `createdAt`. AI1 must round-trip them unchanged.

Unknown AI/disk Universe input crosses one parser boundary before it becomes canonical. Strings are normalized before identity/reference validation, required nested shapes are checked before typed normalization, and the normalized result is validated again. Do not replace this with `as FateKnotsUniversePackage` at an untrusted boundary.

Before materialization every visual asset path is a `fate-knots-pending://<assetId>` sentinel. AI-authored local paths/URLs are not canonical.

The canonical pipeline is:

`AI1 draft -> unknown/canonical boundary -> structural/playability validation -> asset materialization -> managed-file verification -> final validation -> durable Universe save`

Do not bypass materialization with guessed placeholder paths or missing files.

Image generation is behind `FateKnotsAssetMaterializerAdapter`. Provider-specific generation/crop/storage remains behind that interface. The concrete task is documented in `MATERIALIZER-HANDOFF.md`.

Batching rules:

- at most eight cells per image sheet
- six-to-eight related illustrations are preferred when quality is acceptable
- four/five compatible cells may still use a sheet when it avoids wasteful provider calls
- small tails may fall back to single generation
- each plan aspect ratio describes an individual cell; sheet source aspect ratio is derived from grid dimensions × cell ratio
- partial success is retained; missing cells may regenerate independently
- foreign/duplicate provider asset IDs are malformed and fail closed
- runtime consumes extracted individual assets, not the original sheet

Generated card art contains illustration only. Typography, rules, icons, frame and interaction state remain renderer-owned.

Canonical card-art binding uses one asset tag: `card-art:<cardId>`. The binding asset is kind `other`; duplicate/foreign bindings are invalid. Do not invent a second card-art mapping in Babylon code.

Before finalization every materialized runtime asset must be a readable, non-empty `image/*` file under the managed Fate Knots `assets/` storage tree. Provider URLs, `data:`/blob URLs, outside paths and guessed paths are not canonical.

World Forge image generation is not an AI0 tool capability.

The canonical Universe durable save is the Forge commit point. A later provenance/checkpoint write failure is a retryable warning and must not make an already-saved universe appear to have failed.

## Fixed persistence authority

RoomHost `setState/getState` is a volatile hot cache, not persistence.

Fate Knots restart-safe authority is one atomically-written `state-v1.json` envelope under managed Game Room storage containing the validated Universe store and Run store together. The older split `universes-v1.json` / `runs-v1.json` files are migration input only when no envelope exists; invalid durable state fails closed rather than being sanitized to empty and overwritten.

Mid-combat saves preserve combat-runtime state and active story transition/encounter identity.

Universe IDs are immutable canonical identities. Saving a different Universe Package under an existing `universeId` is rejected. Run creation IDs are host-generated rather than renderer supplied; ordinary snapshot saves update the existing run identity.

`activeRunId`, `activeUniverseId` and the active run's `universeId` must remain coherent. Run/universe deletion also clears associated Fate DM session metadata.

Do not move canonical saves into RoomHost Map, localStorage, Babylon scene objects, provider session history or AI memory.

Canonical persistence calls remain host/engine-internal. Do not expose a generic renderer API that accepts an arbitrary full Universe or Run object and persists it.

## Fixed presentation direction

Before universe creation/load:

- neutral Fate Knots Hub is allowed
- normal management UI is allowed

After universe creation/load:

- generated universe theme owns the presentation
- living book is the primary gameplay surface
- exploration, choices, dialogue, map, combat, loot, camp and finale appear through book-native presentation
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

Cards/events reference reusable presentation IDs. Presentation may include animation/particle effect, target, timing, persistent status visual and SFX.

Exact visual style, textures, lighting and timing may be creatively implemented as long as semantic event contracts are preserved.

## Audio direction

SFX comes from a reusable catalog.

Universe music may use a symbolic per-universe theme plus reusable instrument/texture resources, with catalog fallback.

TTS is optional and must not block V1.

## Reserved decisions — do not guess

The following remain balancing/content/provider decisions rather than renderer choices:

- exact player/base stat values generated for a universe
- exact starting card catalogs generated for a universe
- exact energy/resource costs
- future deterministic enemy policy heuristics beyond the V1 `first-legal` baseline
- exact loot quantities/content generated by a given encounter
- exact camp healing and when equipment changes are permitted in scene flow
- exact symbolic music notation/synthesis backend
- final persistence migration naming for the transient loot-pool field
- concrete image-provider mechanics that stay behind the materializer adapter
- any future secondary-target legality/commit grammar
- any future attack/defense combat formula

## Areas where Codex has creative freedom

Codex may decide, within a specific task:

- texture/art style execution requested for a universe
- exact Babylon material/light parameters
- particle shapes and animation curves
- micro-animation duration/easing
- camera composition that preserves required page/interaction layout
- implementation of the concrete image materializer behind the locked adapter
- crop/storage implementation obeying exact planned asset IDs and sheet geometry
- implementation refactors that do not alter contracts
- naming of internal private helpers
- performance optimizations preserving behavior

When a task would require a new game rule, phase, card economy, AI authority, story-progression grammar or player-facing interaction grammar, stop and preserve the existing contract rather than inventing it.

## Unified branch reconciliation contract

The unified branch keeps the stricter Stage C lifecycle, hydration and crash-atomic persistence authority while using the rebuild's modular neutral Hub, run-setup, gameplay projection, combat-options, Forge and AI0 boundaries.

The room-ui command surface is intent/read-only oriented:

- `GameRoomFateKnotsGetHubState`
- `GameRoomFateKnotsActivateUniverse`
- `GameRoomFateKnotsGetRunSetup`
- `GameRoomFateKnotsCreateRun`
- `GameRoomFateKnotsStartRun`
- `GameRoomFateKnotsGetGameplayState`
- `GameRoomFateKnotsGetCombatOptions`
- `GameRoomFateKnotsActivateRun`
- `GameRoomFateKnotsDeleteRun`
- `GameRoomFateKnotsDeleteUniverse`

These commands must not be replaced by raw `SaveUniverse` / `SaveRun` authority. Mutating commands wait for durable hydration and commit through the single validated Universe+Run envelope. The compatibility library/session reads in `host/persistence.ts` are projections over that stricter store, not a second canonical persistence model.

The current combat-discussion UX authority is `COMBAT-DISCUSSION-V1.md`: one party-only shared surface for the user plus active AI2/US1, no recipient selector, discussion available through `combat-discussion` and `combat-commit`, and card/target commits hidden until deterministic resolution.

## Local testing / architecture audit expectation

GitHub Actions availability is not assumed. At the integration checkpoint local Codex should run strict typecheck/build/tests when available and report failures without weakening contracts.

For the architecture audit, **do not redesign the game**. Look specifically for:

- canonical authority leaks between engine, AI and renderer
- hidden-canon exposure
- broken references and impossible/deadlocked transitions
- persistence/restart/rollback lifecycle gaps
- Forge partial-failure and concurrent-run faults
- AI session isolation regressions
- exactOptionalPropertyTypes / noUncheckedIndexedAccess / strict TypeScript failures
- shared Game Room regressions introduced by Fate integration
- any place Babylon/UI could accidentally become rules or persistence authority
