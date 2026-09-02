# Fate Knots — US1 Multiplayer V1

This file locks the first real-human remote-player authority model.

## Single world host

The Hayalet Ev instance that starts the Fate Knots run is the single authoritative World Host.

The World Host owns:

- canonical Universe Package
- canonical Run state
- hidden story canon
- World Forge and generated-source provenance
- AI1 DM runtime
- AI0 NPC/opposition runtime
- story/combat/loot/camp mechanics
- durable save authority

US1 is a remote player client, not a second authoritative engine.

Remote commands submit player intent only. The World Host validates and resolves those intents.

## Universe creation

World Forge runs only on the World Host in V1.

US1 does not receive the Forge brief, hidden draft, complete character/NPC roster, story graph, future encounter catalog, finale definition, unrevealed map data or full asset manifest while the universe is being built.

A neutral waiting surface is sufficient until the host has accepted a canonical universe and can publish a player-safe setup projection.

## Run setup

Every human chooses their own distinct `player-template`.

- local user chooses the `user` character
- remote human chooses the `us1` character
- AI2 chooses/receives its own seat choice when active

One player does not silently choose another human player's character in V1.

Only spoiler-safe player-template data is shared during setup.

## Player projection

US1 receives the same class of bounded player-visible information that the local renderer is allowed to receive, with seat-specific private data narrowed further where necessary.

Never transmit the raw Universe Package or raw persisted Run snapshot as the normal remote data path.

The remote client may receive:

- current theme/presentation resources needed now
- current revealed scene/location/map information
- party-visible actor state
- public story choices and exploration consensus state
- shared party discussion
- that US1 seat's private legal combat options
- public combat state and semantic resolution results
- current visible loot/camp state

It must not receive:

- hidden knots/future transitions
- unrevealed locations or encounters
- NPC hidden knowledge/persona internals
- opposition hidden card ownership/commits
- another player's hidden combat card/target commit
- finale internals not currently player-visible

## Asset synchronization

Generated runtime assets are revealed incrementally.

Do not send the complete universe asset tree to the remote machine at run start. A hidden future portrait/file name is itself a spoiler even if the renderer never displays it.

The host sends only assets referenced by the current remote-safe projection. Newly revealed scenes/cards/NPCs/items may add further assets later.

Remote asset storage is cache/presentation material only. It is not canonical universe persistence.

## Exploration

Exploration uses `EXPLORATION-CONSENSUS-V1.md`.

US1 can:

- read current public legal story choices
- see the party's current public choices
- participate in shared exploration discussion
- replace its own vote while consensus is unresolved

The World Host advances only after unanimous matching player-seat choice.

## Combat

US1 receives only its own legal card/target options.

Other player commits remain hidden until deterministic resolution. Party-ready state may be public.

Combat is resolved once by the World Host. Remote clients render the resulting safe semantic/presentation events; they do not independently calculate canonical combat outcomes.

## Disconnect/reconnect

A required US1 disconnect pauses progression.

V1 has:

- no AI fallback
- no timeout action
- no automatic seat removal
- no host migration/failover

The canonical run remains on the World Host. On reconnect, US1 requests/rebuilds from the latest remote-safe projection and continues.

## Language

A V1 universe has one content language fixed at Forge creation.

The shared universe narration, card copy, authored labels and NPC dialogue use that universe language for all player seats. Application chrome/local settings may remain independently localized.
