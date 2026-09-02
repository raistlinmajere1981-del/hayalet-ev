# Fate Knots — V1 Combat Discussion Contract

This file locks the first working combat-discussion UX without redesigning the deterministic combat engine.

## Scope

V1 uses one shared party discussion surface during combat. It is intentionally simpler than directed dialogue.

Participants in this shared combat chat:

- local user
- AI2 when that player seat is active
- US1 when that player seat is active

AI1 remains outside per-action combat resolution. AI0 opposition actors do not receive party combat discussion. The shared party chat must therefore never be used as an input channel for enemy tactical selection.

## No recipient selector in V1

Combat discussion has no per-message recipient selection and no private player-to-player threads.

All combat discussion messages are addressed to the active player party as one group.

This is a deliberate V1 simplification. Directed/private conversation can be considered later only if real play reveals a need for it.

## Lifetime

The shared discussion surface remains usable during both:

- `combat-discussion`
- `combat-commit`

A player may speak any number of times before completing that turn's move.

Completing one player's move closes message input for that seat for the current turn, but does not close the shared transcript or discussion input for players who have not yet committed. The discussion surface closes for the turn only when all required standing player-party actors have committed and deterministic resolution begins.

Fallen actors are not required to commit a normal move.

## Player-facing flow

There is no separate mandatory `Close discussion` or `Begin commit phase` control in the V1 player UX.

The intended interaction is:

1. players discuss freely in the shared party chat
2. each player selects up to the engine-configured legal movement/action budget
3. the player uses one `Complete move` / `Hamleyi tamamla` action
4. if the engine is still in `combat-discussion`, the first completed move may open `combat-commit` internally before storing that player's validated commit
5. that seat's message input and plan editing close for the turn; other uncommitted players may continue talking and changing their own uncommitted plan
6. committed plans remain hidden from AI0 and must not be exposed as card/target details through the chat UI
7. after every required standing player-party actor has a legal commit, the host obtains any still-required opposition commits through the normal deterministic-policy/AI0 authority and the engine enters deterministic resolution

UI may show that another party member is ready/committed through themed presentation, but must not reveal that player's committed card or target before resolution unless a later rule explicitly permits it.

## Authority

Chat content is communication, not mechanical authority.

- messages never mutate HP, position, status, inventory, legality, commit state, or combat result
- combat legality remains engine-owned
- `Complete move` must pass through the normal host/engine legality and commit path
- a completed move is locked for that turn; the V1 host does not allow the same seat to replace it afterward
- a committed seat cannot append new combat-chat messages for that turn
- a chat message cannot be interpreted as an implicit card commit
- AI/player adapters may use visible party discussion as conversational context only where their player-role transport explicitly supports it
- opposition decisions receive legal combat state through their existing authority path, never the party transcript or hidden party commits

## Persistence

V1 combat chat is not canonical Universe/Run state.

The implemented host keeps a bounded hot transcript scoped to `runId + combatId + turnIndex`. It retains at most 80 messages of at most 2000 characters each. A new combat or turn creates a fresh transcript surface.

Losing the transcript must not alter mechanical canon or make a saved run invalid. Do not place the chat transcript inside hidden world canon, NPC memory, combat commits, or the normal rules state merely to preserve UI history.

Actual completed combat moves remain canonical and are persisted through the normal crash-atomic Fate Knots Universe/Run envelope.

## Command/sender boundary

Sender identity is command-bound rather than supplied by message payload:

- `GameRoomFateKnotsGetCombatDiscussion` — `room-ui/internal`
- `GameRoomFateKnotsSendCombatMessage` — local `user`, `room-ui/internal`
- `GameRoomFateKnotsAi2CombatMessage` — `ai2`, `ai-slots/internal`
- `GameRoomFateKnotsRemoteCombatMessage` — `us1`, `us1/internal`
- `GameRoomFateKnotsCompleteCombatMove` — local `user`, `room-ui/internal`
- `GameRoomFateKnotsAi2CompleteCombatMove` — `ai2`, `ai-slots/internal`
- `GameRoomFateKnotsRemoteCompleteCombatMove` — `us1`, `us1/internal`

Neither chat nor CompleteMove payloads accept `seatId` or `actorId` from the caller.

## Resolution boundary

`Hamleyi tamamla` does not itself execute the full combat turn presentation/mechanics pipeline.

When the final required player-party move is locked, the host obtains and validates any required opposition commits and advances the canonical combat only to `combat-resolution`. The separate deterministic resolution authority then owns mechanical execution and semantic presentation events. This preserves a clean state boundary for the living-book renderer instead of skipping directly over the committed-turn presentation point.

## Presentation

The first working version may use a simple shared chat panel integrated into the combat spread. This is a deliberate V1 exception to the general preference against chat-app-like story UI: tactical party coordination benefits from one clear shared surface.

It does not need recipient chips, threads, speech bubbles per target, or complex scene-directed dialogue routing.

The living-book visual pass may later theme this surface, but the interaction law remains: one party conversation, unlimited messages until that seat completes its move, hidden commits, then deterministic resolution after all required seats are ready.
