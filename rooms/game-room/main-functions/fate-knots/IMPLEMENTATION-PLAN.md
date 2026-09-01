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

No Game Room registration or shared host wiring is required in this stage.

## Stage B — Headless core (Nexa / branch-safe)

Status: complete for the current V1 contract surface. Local typecheck/tests remain intentionally deferred until branch reconciliation.

Build inside `main-functions/fate-knots` without final visuals.

Delivered:

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
- bounded non-combat run transitions and explicit finale completion in `shared/run-phase.ts`
- unresolved loot blocks leaving the loot phase; combat phases cannot be changed through the generic run-phase helper
- V1 personal inventory/loot flow in `shared/loot.ts`
- `ownedCardIds` is the personal card inventory; `item` and `equipment` cards are inventory-visible ownership
- `teamPoolItemIds` is a transient neutral/unassigned loot pool, not a permanent shared inventory
- loot allocation requires unanimous approval from the current party and covers every loot entry; no agreement means no state mutation
- equipment ownership is the equipment card; `equipmentIds` stores only currently equipped mechanical definitions
- one explicit equipment slot may be occupied at a time; equipping a new definition in the same slot unequips the old one
- no weight, encumbrance, inventory-capacity or loot RNG subsystem in V1
- Universe Package validation checks structural safety, unique IDs, references, effect target/value/duration shapes, map/finale links and equipment-card ownership consistency
- canonical `npcRoles` definitions are part of the Universe Package and are validated against each NPC's `rolePacketId`
- normalization is lossless only: trim/dedupe/copy; it does not invent missing canon, rules, assets or fallback content
- isolated AI0 runtime contract in `shared/ai0-runtime.ts`
- AI0 NPC runtime explicitly has no MCP/tool discovery, filesystem, shell, web, image-generation or project-memory capability
- AI0 runtime requests are stateless packets; continuity comes from canonical NPC/relationship/combat packets rather than coding-agent session history
- AI0 dialogue/combat responses are revalidated against request IDs, legal interaction IDs and engine-provided legal combat options
- canonical AI0 NPC role packet builder in `shared/npc-role.ts`
- AI0 role packets are rebuilt from Universe Package `npcRoles`, current run/location state and engine-approved legal interactions
- bounded AI1 scene and terminal combat-result packet builders in `shared/dm-packets.ts`
- AI1 scene packets accept only explicit player-visible facts/transitions and refuse all combat phases
- semantic presentation-event helpers in `shared/presentation-events.ts`
- presentation events report resolved cards, fallen actors, status/position deltas, combat start/end and page transitions without owning mechanics or animation choices

Requirements preserved:

- deterministic by default
- no Babylon dependency in the headless core
- no image/audio generation dependency
- mechanics remain independent from Game Room presentation

## Stage C — Persistence and host integration (Nexa + local verification)

Status: substantially implemented on `feat/fate-knots-rebuild`; local reconciliation/typecheck/tests/live validation remain pending.

Delivered:

- separate validated persistence for canonical Universe Packages and Run States in `host/persistence.ts`
- persistence reads reject malformed/incompatible records rather than silently coercing them into canonical state
- neutral, player-safe Hub projection in `host/hub-state.ts`
- intent-level Hub management commands for read/select/delete operations; no renderer command can submit raw `SaveUniverse` or `SaveRun` state
- explicit run bootstrap contract: Forge must provide `map.startNodeId`; character templates must provide `playerSelectable` and `startingPosition`
- `CreateRun` creates a canonical `run-setup` state from an accepted universe plus explicit player-seat/character assignments
- `StartRun` separately opens the Forge-authored start node and enters exploration; this keeps map/world canon hidden during character setup
- player-safe run-setup projection in `host/run-setup-state.ts`; renderer receives selectable public character start data rather than the raw Universe Package
- Game Room feature registration through `FATE_KNOTS_FEATURE_ID`
- Fate Knots management/setup/run command families registered by the Game Room host
- active-feature state bridge emits `fate-knots-hub-state`
- player seat availability is derived from current Game Room context: local user is available, AI2/US1 require dispatchable slots
- neutral Hub browser runtime in `ui/hub.js`, `ui/hub.css`, and `ui/bridge.js`
- Fate Knots browser bridge wraps after the Yahtzee runtime and prevents the feature from falling through to the Tavla renderer
- Game Room manifest version `2.8.0` registers Fate Knots command specs
- Fate Knots manifest entry intentionally has no invented `scene`/hotspot coordinates; visual room placement remains a later presentation task
- structural manifest and installed-copy regression contracts updated for the fourth Game Room feature
- dedicated `game-room-fate-knots-room-regressions.test.ts` guards host authority, player-safe setup data, Hub load order and the absence of raw browser persistence commands

Still pending in Stage C:

- actual AI1 transport wiring for DM scene/result packets
- actual isolated AI0 provider/wrapper transport wiring for NPC dialogue and delegated combat choices
- create the Fate Knots AI0 runtime workspace outside the repository under app/user data
- materialize only the minimal Fate Knots NPC runtime policy in that workspace when the provider wrapper requires a policy file
- launch AI0 NPC/combat calls from that isolated workspace so root `AGENTS.md` and `.rovo/*` are never bootstrapped into gameplay context
- expose an empty tool/MCP capability set for V1 AI0 runtime calls
- keep AI0 gameplay continuity packet-owned rather than reusing development-agent conversation history
- any additional host gameplay commands needed to connect the already-headless run/combat/loot authorities to the final presentation runtime
- persistence migration strategy if an older persisted Fate Knots schema must later be supported
- local branch reconciliation against current `main`/Laboratory work
- local typecheck/build/tests and live Game Room validation

## Stage D — Neutral Hub and World Forge orchestration (shared)

Status: partially implemented. The neutral Hub/read-management foundation exists; World Forge orchestration is not yet wired.

Already delivered from Stage C overlap:

- saved-universe and saved-run Hub projection
- activate/continue/delete management commands
- connection/readiness projection
- player-safe character setup packet
- provider-independent Universe candidate validation/normalization gate
- provider-independent Forge asset contracts and optional image-sheet extraction helper

Still required:

- create-new-universe / World Forge orchestration command flow
- Forge progress/state reporting to the neutral Hub
- candidate -> validation -> canonical Universe Package acceptance and persistence flow
- provider adapter for Forge text/content generation without assigning Forge authority to AI1 or AI0 by accident
- generated theme/assets attached to the accepted universe
- provider-independent image adapter
- optional batch image-sheet generation/extraction using `forge/image-sheet.ts`
- neutral Hub controls for character assignment and `CreateRun` / `StartRun` using only the player-safe setup projection

The World Forge provider is deliberately not fixed by the current game-role model. AI1 remains runtime DM and AI0 remains runtime NPC actor; neither should become Forge authority merely as an implementation shortcut.

The Hub must work without a generated book/background/theme.

Batch image generation is an optimization, not a runtime dependency. Prefer 6-8 illustration cells per request when quality is acceptable; extract accepted cells into normal individual assets and regenerate failed cells independently. Generated card art must not bake card typography/rules/UI into the image.

## Stage E — Babylon book runtime (Codex/local)

Local visual/runtime work after contracts are available:

- choose/implement the actual Game Room Fate Knots feature scene/hotspot placement without changing mechanics
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

Codex should consume semantic state/events rather than infer mechanics from UI or read hidden Universe Package fields directly.

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

GitHub Actions are not assumed available. The Stage C branch now touches shared Game Room host/UI/manifest files, so local reconciliation is mandatory before treating it as merge-ready.

After the current Laboratory work and Fate Knots branch are reconciled locally, run the repository's normal typecheck/build/tests plus installed-copy and live Game Room checks. Do not weaken Fate Knots contracts merely to satisfy an unrelated stale expectation; update stale feature/version expectations deliberately where the fourth Game Room feature changes them.
