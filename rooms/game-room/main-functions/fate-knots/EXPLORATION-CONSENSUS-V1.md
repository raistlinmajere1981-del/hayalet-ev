# Fate Knots — Exploration Consensus V1

This file locks the first multiplayer exploration decision contract.

## Core rule

Exploration progression is a party decision.

Every active player seat chooses one currently legal story transition. Choices are public to the player party and may be changed freely while consensus has not been reached.

The engine advances only when every active player seat has selected the same legal transition.

There is no separate confirm button in V1. Unanimous matching choice is the confirmation.

Active player seats are:

- local `user`
- `ai2` when that player seat is present in the run
- `us1` when that remote player seat is present in the run

AI1 does not vote. AI0/NPC actors do not vote.

## Discussion

Exploration has one party-only shared discussion surface, analogous to combat discussion but with different secrecy rules.

Participants may send any number of messages while the current exploration decision remains unresolved.

Discussion messages are communication only. They never mutate canonical run state and are never interpreted as implicit story choices.

## Public choices

Unlike combat card/target commits, exploration choices are intentionally visible to the other player seats.

Example:

- user selects `Go to town`
- US1 selects `Make camp`
- both choices remain visible
- the party discusses
- user changes to `Make camp`
- once every active seat selects `Make camp`, the host applies that canonical story transition

A seat may replace its own uncommitted exploration choice any number of times before consensus.

## Authority

The renderer and remote transport submit only a transition intent.

The host/engine:

1. derives the current legal transitions from canonical Universe + Run state
2. validates the seat-bound choice against that legal set
3. records the public hot vote
4. checks unanimity across current player seats
5. when unanimous, applies exactly that canonical transition through the normal host persistence path

Callers never submit arbitrary progression patches, destination ids, encounter ids, phase changes or full Run snapshots.

Sender identity is command-bound rather than supplied by payload.

## Lifetime and persistence

Exploration discussion and votes are coordination state, not canonical Universe/Run state.

The hot surface is scoped to the current run + active story knot + active location. Entering another story position creates a fresh coordination surface.

Losing the discussion transcript or vote cache must not invalidate a saved run. Canonical progression begins only after unanimous choice has been accepted and durably saved.

## Disconnect behavior

V1 has no fallback player and no timeout move.

If a required player seat is disconnected/unavailable, progression pauses. The host does not replace US1 with AI, invent a vote, remove the seat from consensus, or auto-advance.

After reconnect, the remote client receives the current player-safe projection and resumes the same run.

## Secrecy

The exploration surface may expose only the engine-derived player-visible transition summaries for the current state.

It must not expose:

- hidden story knots
- unrevealed locations
- transition requirements that reveal hidden canon
- future encounters
- finale internals
- raw Universe Package data

The renderer receives transition id, player-facing label and kind only.