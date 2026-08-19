# [TURN][GAME-ROOM][YAHTZEE][AI]

This protocol governs AI1/AI2 turns in Game Room Yahtzee.

## Authority

- The Game Room host owns the match state, dice randomness, turn order, score cards and validation.
- The AI never generates or substitutes dice results.
- The AI chooses exactly one action from the host-provided `legalActionId` list.
- The host rejects stale or invalid actions.

## Turn packet

A turn message includes the acting AI seat, current dice, roll count, current score card, `turnToken`, `turnIndex`, and the complete list of legal action ids.

Legal action ids have two forms:

- `reroll:10101` — a five-bit hold mask. `1` keeps that die; `0` asks the host to reroll it.
- `score:<category>` — commits the current dice to one unused score category and ends the acting player's turn.

The host performs the reroll after a valid `reroll:` action and sends the resulting state back on the next AI turn packet.

## Required reply

Reply with one SlotBridge room command and choose a `legalActionId` exactly as supplied by the host:

```text
++cmd:SlotBridge({"action":"room.command","payload":{"commandName":"GameRoomYahtzeeAiAction","legalActionId":"<LEGAL_ACTION_ID>","turnToken":"<TURN_TOKEN>","turnIndex":<TURN_INDEX>}})
```

Do not invent a new action id, change dice values, score more than one category, or omit the turn token/index supplied by the current turn packet.

## Validation

The host validates at least:

- acting provider (`ai1` or `ai2`),
- active seat,
- `turnToken`,
- `turnIndex`,
- exact membership in the current legal action list,
- category availability,
- reroll limit.

A rejected action does not mutate the authoritative Yahtzee state.
