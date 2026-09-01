# Fate Knots — World Forge Runtime Boundary

This document fixes the provider-neutral host lifecycle for creating a new Fate Knots universe.

It does **not** choose the text/model provider, prompt format, user-facing genre/theme form, image provider, or transport wire syntax.

## Authority chain

World Forge output is always an untrusted candidate.

The only allowed authority chain is:

`provider candidate -> host Forge lifecycle -> canonical validation -> persistence -> accepted universe`

A provider, renderer, AI1, AI0, Codex visual task, or browser command must not write a candidate directly into the canonical Universe Package library.

`host/forge-acceptance.ts` is the acceptance gate. It runs `normalizeFateKnotsCanonicalUniversePackage` before `saveFateKnotsUniverse`.

## Host lifecycle

`host/forge-orchestration.ts` owns the provider-neutral lifecycle:

`idle -> generating -> validating -> accepted | failed`

Rules:

- Forge starts unavailable until an actual provider adapter is explicitly attached.
- Beginning a Forge request while unavailable must not create a fake `generating` state.
- Only one `generating` or `validating` request may be active at a time.
- Provider completion must match the active host request ID.
- A candidate cannot be accepted directly from `generating`; the lifecycle must enter `validating` first.
- The candidate is passed directly to the host acceptance gate and is not stored in the lifecycle state.
- Failed canonical validation or persistence moves the lifecycle to `failed`.
- Provider failures expose only a bounded failure code to the Hub, never provider output, prompt text, stack traces, or candidate canon.
- `acceptedUniverseId` is exposed only after canonical persistence succeeds.

## Hub projection

The neutral Hub may receive only this Forge metadata:

- provider availability
- lifecycle stage
- lifecycle revision
- accepted universe ID, after success
- short normalized failure code

The Hub must not receive:

- provider prompt/system instructions
- provider conversation/session history
- raw candidate Universe Package
- validator issue details containing hidden canon
- hidden knots
- finale data
- NPC role packets
- secret map/story data

The current host wires this safe lifecycle snapshot into `fate-knots-hub-state`. The actual provider adapter is intentionally still absent, so Forge remains unavailable in the live Hub until that adapter is implemented.

## Provider adapter responsibility

A later provider adapter may:

1. mark itself available,
2. accept a host-approved Forge request,
3. generate a candidate outside canonical state,
4. mark the lifecycle as validating,
5. submit the candidate to the host orchestrator,
6. report a bounded failure code when generation itself fails.

It may not bypass the host orchestrator or acceptance gate.

The exact user-facing Forge request grammar remains deliberately open. Do not invent mandatory genre/theme/seed fields until that interaction is designed explicitly.
