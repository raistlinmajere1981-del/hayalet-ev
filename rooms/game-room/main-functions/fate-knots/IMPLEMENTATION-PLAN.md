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
- no Babylon dependency
- no image/audio generation dependency
- no Game Room shared integration until the feature core is coherent

## Stage C — Persistence and host integration (Nexa + local verification)

Status: in progress. The updated `main` was reviewed before shared integration; its intervening Laboratory/Yahtzee changes do not overlap the Fate Knots Stage C files.

Delivered:

- dedicated `feat/fate-knots-stage-c` integration branch over the completed headless rebuild
- separate Universe Package and Run State stores in `host/persistence.ts`
- Universe Package persistence reuses the Forge validation/normalization gate rather than duplicating canon validation
- run snapshots preserve `combatRuntime` beside `RunState` only while combat is active, allowing safe mid-combat save/resume for shields, timed statuses and combat-scoped modifiers
- active combat requires an actor-matched combat-runtime snapshot; non-combat saves reject stray combat runtime
- universe deletion removes associated runs; run activation also activates its universe
- Fate Knots host management command family for refresh/save/activate/delete of universes and runs
- Game Room host runtime initializes Fate Knots persistence and publishes `fate-knots-state`
- Fate Knots registered in shared Game Room feature metadata and room manifest
- neutral pre-universe Hub in `ui/hub.js` + `ui/hub.css`
- Hub manages accepted saved universes/runs without pretending an uncreated universe already has a book/theme
- Hub uses the stable Game Room environment until a canonical Universe Package exists
- World Forge creation is visibly reserved but remains disabled until the real orchestration/transport is connected
- active Fate Knots feature receives its own host-state refresh through the shared Game Room lifecycle

Remaining Stage C integration:

- provider transport boundary for AI1 DM packets
- isolated background AI0 transport that does not switch or reuse the visible development-agent session
- create/materialize the Fate Knots AI0 app-data workspace and minimal runtime policy/config before the first NPC request
- pin short-lived AI0 OpenCode sessions to that external directory and keep all tools/MCP disabled for the request
- validate AI0 structured responses before forwarding them to the engine
- persistence-facing cleanup/migration of the current internal `teamPoolItemIds` loot-pool name when the persisted V1 schema is finalized
- local typecheck/build/regression verification after integration stabilizes

AI0 transport direction after repository/OpenCode inspection:

- do not use normal SlotBridge `session.open`; it changes the visible AI0 development session and does not provide the required workspace isolation
- prefer a short background OpenCode session scoped to the external Fate Knots runtime directory while reusing the already-running OpenCode server process
- send only the minimal Fate system policy + bounded packet and explicitly disable tools for each request
- delete/close the temporary session after the response so NPC continuity remains canonical-packet-owned rather than conversation-history-owned
- if the installed OpenCode build cannot create directory-scoped sessions, fail closed and use an explicit isolated compatibility path; never silently fall back to a repository-root NPC session

## Stage D — World Forge orchestration (shared)

Status: neutral Hub shell is already delivered in Stage C; World Forge itself remains pending.

Implement orchestration behind the existing Hub:

- create-universe flow
- connection/readiness display
- World Forge progress
- candidate draft -> validation -> canonical Universe Package
- generated theme/assets attached to the universe
- provider-independent image adapter
- optional batch image-sheet extraction using `forge/image-sheet.ts`

The Hub must continue to work without a generated book/background/theme.

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

GitHub Actions are not assumed available. Run the repository's normal typecheck/build/tests and live Game Room checks locally once Stage C integration reaches a stable checkpoint.

Until then, keep commits small and preserve the Fate Knots engine/AI authority boundaries rather than weakening contracts to satisfy UI shortcuts.
