# Fate Knots — Branch Reconciliation Handoff

Target working branch:

`feat/fate-knots-unified`

Base of that branch:

`feat/fate-knots-stage-c`

Merge source:

`feat/fate-knots-rebuild`

GitHub reports the two source branches as diverged and not automatically mergeable. Resolve locally; do not use wholesale `ours` or `theirs` for the whole merge.

## Preserve from the Stage C side

Keep the earlier audit/lifecycle and shared Game Room corrections. In particular, do not regress cleanup/lifecycle behavior or reintroduce a heavy default Game Room startup merely because an older rebuild-side shared file differs.

Preserve any stricter host/persistence/IPC authority fixes that were added during the Stage C audit unless the rebuild side contains an explicitly newer equivalent with the same or stronger guarantees.

## Preserve from the rebuild side

Keep the later Fate Knots additions, including the provider-neutral Forge/AI0 work, player-safe gameplay projection, renderer asset/presentation boundaries, combat legal-options helpers, updated Fate Knots Hub/run-setup work, and newer Fate-specific regressions/docs.

Do not drop new Fate files simply because they do not exist on the Stage C side.

## Conflict policy

For each conflict, preserve behavior rather than commit age.

Prefer the result that simultaneously maintains:

- engine-owned canonical state
- no renderer raw Universe/Run persistence authority
- player-safe projections only
- AI0 isolated/stateless/no-tool runtime boundary
- AI1 outside per-action combat mechanics
- deterministic combat resolution
- hidden commits until resolution
- neutral/lightweight Game Room startup
- explicit feature cleanup when switching games

Do not reintroduce `SaveUniverse` / `SaveRun` browser authority or make Backgammon the heavy automatic runtime merely to resolve a manifest/runtime conflict.

## New V1 combat-discussion decision

After reconciliation, treat `COMBAT-DISCUSSION-V1.md` on this unified branch as the current UX contract.

V1 combat uses one party-only shared discussion surface for user + active AI2 + active US1. No recipient selector. Discussion remains available through `combat-discussion` and `combat-commit` until all required standing player actors have completed their moves. Actual card/target commits remain separate and hidden from AI0.

## After the merge

Run the repository normal typecheck/build/tests and Fate Knots/Game Room regressions locally. Also do a live Game Room smoke check:

- opening Game Room must stay lightweight and must not automatically initialize the heavy Backgammon presentation
- switching away from Backgammon must release its presentation resources
- Fate Knots neutral Hub must load without falling through to another game renderer

Fix real integration/type failures, but do not weaken Fate Knots secrecy/authority contracts to satisfy stale tests.
