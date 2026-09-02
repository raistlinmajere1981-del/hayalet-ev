# Fate Knots — Camp and Social V1 Contract

This document locks the smallest useful V1 rules for camp and non-combat NPC interaction without adding a generic quest/social simulation layer.

## Camp

A `camp` story transition moves the canonical run to an authored destination whose location has `campAllowed: true`.

Camp recovery is intentionally simple:

- every party actor returns to full `maxHp`;
- every party actor's energy returns to that character template's authored base energy;
- a fallen party actor stands up;
- persistent statuses and injuries are **not** cleared automatically;
- no food, watch order, sleep quality, camp materials, encumbrance, crafting or random camp-event subsystem exists in V1.

Equipment may be changed only during run setup or camp. Physical ownership remains card-based: an equipment definition can be equipped only when the actor owns an `equipment` card whose `sourceId` references that definition. Equipping replaces any currently equipped definition in the same slot and the engine rebuilds available cards.

Leaving camp is a party action. Each active player seat becomes ready independently. The host may return the run to `exploration` only after every active player seat is ready. A disconnected required seat therefore pauses camp exit; there is no timeout or fallback player.

## Non-combat NPC interaction

AI0 is an actor, not story authority. Dialogue prose alone never changes canonical state.

V1 does **not** introduce a second social/quest DSL. An NPC may propose only already-authored canonical story transitions. World Forge binds an NPC to those transitions with `roleTags` using this convention:

`interaction:<story-transition-id>`

At runtime the engine intersects those authored ids with the transitions that are currently legal from the active knot. Only that intersection is sent to AI0 as `legalInteractionIds`.

AI0 may return one `selectedInteractionId`, but that id is a proposal only. It never bypasses player authority. If the proposal should progress the story, USER / AI2 / US1 still converge on the same transition through the normal exploration consensus system.

This gives NPC dialogue useful mechanical consequences without allowing AI0 to invent rewards, reveal hidden canon, move the party, start combat or complete the scenario from prose.

## Finale relationship

An NPC interaction may expose or suggest one of the pre-forged canonical routes toward the main objective, including an alternate non-combat route. The route itself remains an ordinary authored transition chain.

A `finale` transition is the explicit terminal success transition. Reaching a boss, entering a finale location, unlocking `finaleUnlocked`, or winning an encounter is not automatically completion. Only taking a currently legal authored terminal `finale` transition completes the run and opens the epilogue.
