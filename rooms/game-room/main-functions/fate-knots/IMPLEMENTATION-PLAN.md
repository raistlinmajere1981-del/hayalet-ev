# Fate Knots — Implementation Plan

The rebuild is intentionally staged so each change is reviewable and can be merged/rebased independently of unrelated room work.

## Stage A — Contract lock (Nexa / branch-safe)

Status: complete for the current V1 contract.

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
- `WORLD-FORGE-RUNTIME.md` for provider-neutral Forge lifecycle/authority boundaries
- `forge/universe-validation.ts` runtime validation + lossless normalization gate for World Forge candidates

## Stage B — Headless core (Nexa / branch-safe)

Status: complete for the current V1 contract surface. Local typecheck/tests remain intentionally deferred until branch reconciliation.

Delivered:

- external/default rules configuration contract in `rules/config.ts`
- lightweight `front | rear` + `engaged | near | far` position helpers in `shared/position.ts`
- deterministic owned/granted/blocked card availability and legality resolver in `shared/card-legality.ts`
- explicit standing/fallen target legality in the shared card requirement contract
- deterministic card effect planning in `shared/effect-resolution.ts`
- mechanical effect target stored separately from presentation `applyTo`
- ordered mechanical patches for damage/heal/shield/status/movement/stat/resource/card/reveal/retreat effects
- combat discussion -> commit -> resolution -> aftermath phase/commit flow in `shared/combat-flow.ts`
- combat-only runtime state in `shared/combat-runtime.ts`
- atomic ordered patch application in `shared/combat-patch-apply.ts`
- shield absorption before HP damage and `0 HP -> fallen` under combat authority
- duplicate owned item-card ids represent physical copies; `consume` removes one copy while `revoke` removes all copies
- run reveal patches are deferred out of combat authority
- explicit terminal evaluation in `shared/combat-result.ts`
- ambiguous simultaneous terminal states are rejected rather than resolved by implementation order
- deterministic two-pass resolution ordering in `shared/resolution-order.ts`: movement first, then action
- ordering by `fast | normal | heavy`, effective speed, then stable actor-id tie break
- enemy tactical controller contract in `shared/enemy-controller.ts`
- explicit `policy | ai0` enemy controller families
- AI0 combat packets expose legal options and visible state but never hidden participant commits
- deterministic policy heuristics remain explicit content modules rather than implicit fallback behavior
- full ordered turn execution in `shared/combat-resolution-executor.ts`
- movement resolves before the action queue is rebuilt
- every queued card is revalidated immediately before execution
- a fallen actor loses unresolved queued actions
- terminal state stops later queued actions
- V1 effect-duration law and aftermath settlement in `shared/combat-aftermath.ts`
- shields/direct combat stat modifiers clear at aftermath
- non-persistent untimed statuses are turn-scoped
- `durationTurns` survives the application turn plus the configured following turns
- timed status reapplication refreshes one timer rather than stacking timers
- persistent untimed statuses survive until explicit removal
- V1 victory recovery in `shared/post-combat-settlement.ts`: standing actors keep HP, fallen party actors recover at configured low HP (default 1), no implicit injury system
- terminal cleanup in `shared/combat-closure.ts`
- combat entry/exit authority in `shared/run-flow.ts`
- party defeat automatically moves the run to `failed`; victory/retreat require explicit engine-selected next phase
- party combat state synchronizes back into persistent run actor state only at combat exit
- bounded non-combat run transitions and explicit finale completion in `shared/run-phase.ts`
- unresolved loot blocks leaving loot; combat phases cannot be changed through generic run-phase helper
- V1 personal inventory/loot flow in `shared/loot.ts`
- `ownedCardIds` is personal inventory; `item` and `equipment` cards are visible ownership
- `teamPoolItemIds` is transient neutral/unassigned loot, not a permanent communal backpack
- loot allocation requires unanimous current-party approval and complete allocation coverage
- `equipmentIds` stores currently equipped mechanical equipment definitions only
- no weight, encumbrance, inventory-capacity or loot RNG subsystem in V1
- Universe Package validation checks structural safety, unique IDs, references, effect shapes, map/finale links and equipment-card ownership consistency
- canonical `npcRoles` are validated against each NPC's `rolePacketId`
- normalization is lossless only: trim/dedupe/copy; it does not invent canon/rules/assets/fallbacks
- isolated AI0 runtime contract in `shared/ai0-runtime.ts`
- AI0 explicitly has no MCP/tool discovery, filesystem, shell, web, image-generation or project-memory capability
- AI0 requests are stateless packets; continuity comes from canonical NPC/relationship/combat packets
- canonical AI0 NPC role packet builder in `shared/npc-role.ts`
- bounded AI1 scene and terminal combat-result packet builders in `shared/dm-packets.ts`
- AI1 scene packets accept explicit player-visible facts/transitions and refuse combat phases
- semantic presentation-event helpers in `shared/presentation-events.ts`

Requirements preserved:

- deterministic by default
- no Babylon dependency in the headless core
- no image/audio generation dependency
- mechanics independent from Game Room presentation

## Stage C — Persistence and host integration (Nexa + local verification)

Status: substantially implemented on `feat/fate-knots-rebuild`; real provider adapters and local reconciliation/typecheck/tests/live validation remain pending.

Delivered:

- separate validated persistence for canonical Universe Packages and Run States in `host/persistence.ts`
- malformed/incompatible persistence records are rejected instead of silently coerced
- neutral player-safe Hub projection in `host/hub-state.ts`
- intent-level Hub management commands; renderer cannot submit raw `SaveUniverse` or `SaveRun` state
- explicit run bootstrap contract: Forge supplies `map.startNodeId`; characters supply `playerSelectable` and `startingPosition`
- `CreateRun` creates canonical `run-setup`; `StartRun` separately opens the Forge-authored start node
- player-safe run-setup projection in `host/run-setup-state.ts`
- Game Room feature registration through `FATE_KNOTS_FEATURE_ID`
- management/setup/run command families registered by Game Room host
- active-feature bridge emits `fate-knots-hub-state`
- player seat availability comes from Game Room context; local user is available, AI2/US1 require dispatchable slots
- neutral Hub browser runtime in `ui/hub.js`, `ui/hub.css`, `ui/bridge.js`
- Fate Knots browser bridge wraps after Yahtzee and prevents fallback into Tavla renderer
- Hub setup uses only player-safe setup data, unique character assignment and separate CreateRun/StartRun actions
- Game Room manifest `2.8.0` registers Fate Knots command specs without inventing a scene/hotspot
- structural/installed-copy regressions include the fourth Game Room feature
- physical AI0 workspace materialization in `host/ai0-workspace.ts` and `host/ai0-workspace-electron.ts`
- AI0 workspace lives under managed Game Room app-data storage, outside the repository
- each AI0 workspace preparation removes the previous per-universe directory and recreates only the declared minimal runtime policy
- `prepareFateKnotsAi0RuntimeWorkspace(universeId)` is the single provider-preparation entry point
- AI0 provider responses are accepted as `unknown`, parsed into the bounded allowed response shape, then revalidated against request IDs and engine legality
- provider-only extra fields are discarded; malformed/illegal responses cannot reach the engine as typed data
- provider-neutral AI0 transport in `host/ai0-transport.ts`
- transport order is fixed: isolated workspace -> empty-tool runtime profile -> bounded packet -> unknown provider response -> shape gate -> legality gate
- combat workspace selection receives `universeId` explicitly from host/runtime context rather than leaking it into the combat-visible packet
- player-safe active-run projection in `host/gameplay-state.ts`
- gameplay projection exposes current visible location/map, party state, visible card/equipment/status summaries and bounded visible combat state
- gameplay projection excludes hidden knots/finale/NPC role packets, enemy owned/available cards and combat commits
- read-only `GameRoomFateKnotsGetGameplayState` command returns only the safe gameplay projection
- gameplay-state command is catalogued and explicitly registered as `room-ui` / `internal`; it is not an AI/public canonical-state surface
- dedicated tests cover AI0 workspace isolation, provider-response parsing, transport ordering, gameplay-state secrecy and Game Room registration

Still pending in Stage C:

- actual Hayalet Ev provider/wrapper adapter that invokes AI0 through the already-defined transport
- actual AI1 transport wiring for DM scene/result packets
- AI1 response contract remains intentionally unresolved; do not invent whether AI1 returns prose only or structured transition data until that runtime interaction is designed
- additional host gameplay mutation commands only when an existing authority contract can determine legality without inventing story gating
- persistence migration strategy if an older persisted Fate Knots schema later needs support
- local branch reconciliation against current `main`/Laboratory/Yahtzee work
- local typecheck/build/tests and live Game Room validation

Important boundary:

`GameRoomFateKnotsGetGameplayState` is the renderer read surface after run setup. The future living-book runtime should consume this projection plus semantic presentation events rather than reading raw Universe Package/Run State or recomputing mechanics in Babylon/UI code.

## Stage D — Neutral Hub and World Forge orchestration (shared)

Status: provider-neutral lifecycle and acceptance shell implemented; actual provider adapter/request grammar and generated asset orchestration remain pending.

Delivered:

- saved-universe/saved-run Hub projection
- activate/continue/delete management commands
- connection/readiness projection
- player-safe character setup packet
- provider-independent Universe candidate validation/normalization gate
- host-only `host/forge-acceptance.ts`: untrusted candidate must pass canonical normalization before persistence
- provider-neutral `host/forge-orchestration.ts` lifecycle: `idle -> generating -> validating -> accepted | failed`
- Forge starts unavailable and cannot enter fake `generating` state until a provider adapter marks itself available
- one active Forge request at a time with request-id matching
- candidate data never lives in Hub lifecycle state; it passes directly into host-only acceptance
- Hub receives only bounded Forge metadata: availability, stage, revision, accepted universe ID and short failure code
- no room-ui/browser command can submit or approve a raw Forge candidate
- `WORLD-FORGE-RUNTIME.md` locks provider/host authority boundary
- `fate-knots-forge-orchestration.test.ts` guards lifecycle behavior without inventing Forge content
- provider-independent Forge asset contracts and optional image-sheet extraction helper

Still required:

- explicit create-new-universe / World Forge request command once user-facing request grammar is decided
- actual Forge text/content provider adapter without assigning Forge authority to AI1/AI0 by shortcut
- adapter drives existing provider availability/lifecycle
- render the already-projected Forge lifecycle state in neutral Hub
- generated theme/assets attached to accepted universe
- provider-independent image adapter
- optional 6–8-cell batch image-sheet generation/extraction using `forge/image-sheet.ts`

The World Forge provider is deliberately not fixed by the game-role model. AI1 remains runtime DM and AI0 remains runtime NPC actor.

The user-facing Forge request grammar is also deliberately unresolved. Do not add mandatory genre/theme/seed fields until that interaction is explicitly designed.

The Hub must work without a generated book/background/theme.

Batch image generation is an optimization, not a runtime dependency. Generate illustration cells, extract accepted cells into normal assets, regenerate failed cells independently, and never bake precise card typography/rules/UI into generated art.

## Stage E — Babylon book runtime (Codex/local)

Local visual/runtime work after contracts are verified:

- choose actual Fate Knots Game Room feature scene/hotspot placement without changing mechanics
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

Renderer rules:

- consume `GameRoomFateKnotsGetGameplayState` for player-visible canonical state
- consume semantic presentation events for effects/transitions
- do not read hidden Universe Package fields directly
- do not infer mechanics from UI/Babylon state
- do not expose internal numeric priority tiers as raw player-facing UI unless deliberately mapped to themed presentation language

Use at least two visually different mock universe Theme Packages to prove renderer theme-independence.

## Stage F — Presentation collection (Codex/local, iterative)

Grow reusable catalogs independently from rules engine:

- slash/stab/blunt/projectile effects
- defense/heal/status/movement effects
- persistent status visuals
- card SFX
- ambience
- music instrument/texture resources
- universe music identity experiment

Artistic variation is encouraged; game-rule invention is not.

## Stage G — Optional speech layer (later)

- STT can feed normal player discussion/input
- reserve/use `voiceProfileId`
- TTS remains optional until multiple useful voice profiles are available

Do not make speech a V1 launch dependency.

## Local testing handoff

GitHub Actions are not assumed available. Stage C/D now touches shared Game Room host/UI/manifest/tests, so local reconciliation is mandatory before merge-ready status.

The remote branch is currently only one `main` commit behind; that commit is mainly Laboratory work plus a Yahtzee presentation cleanup. Fate Knots does not mechanically depend on the removed Yahtzee theme `stageConfig`; stale installed-copy expectation for that field has been removed on this branch.

After current local Laboratory/Yahtzee work and Fate Knots are reconciled, run the repository normal typecheck/build/tests plus installed-copy and live Game Room checks. Do not weaken Fate Knots contracts merely to satisfy unrelated stale expectations; update stale feature/version expectations deliberately.