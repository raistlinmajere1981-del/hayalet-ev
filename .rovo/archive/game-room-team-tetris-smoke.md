# Game Room Team Tetris Smoke

## Manual pass

1. Open `game-room` and switch to the `team-tetris` feature.
2. Confirm `AI1`, `AI2`, and `US1` must all be ready before `Start Match` enables.
3. Start once with hidden pairs on, once with hidden pairs off.
4. Verify the surface shows:
   - two main boards
   - richer private context on the local team side
   - public-only snapshot on the opponent side
5. On a local-user turn:
   - rotate the piece
   - draw a path on the private board
   - submit the move
6. Confirm AI turns dispatch without crashing and US1 turns do not unblock when `US1` is disconnected.
7. Switch away from `team-tetris` and confirm the active Team Tetris match resets.
8. Finish a hidden-pair match and confirm randomized pairs are revealed on game over.

## Automated pass

- `node --import tsx --test scripts/tests/game-room-team-tetris-room-regressions.test.ts`
- `node --import tsx --test scripts/tests/game-room-team-tetris-engine-regressions.test.ts`
- `node --import tsx --test scripts/tests/game-room-team-tetris-visibility-regressions.test.ts`
- `node --import tsx --test scripts/tests/game-room-team-tetris-host-regressions.test.ts`
- `node --import tsx --test scripts/tests/game-room-team-tetris-ui-path-regressions.test.ts`
- `node --import tsx --test scripts/tests/us1-conversation-service-regressions.test.ts`
- `node --import tsx --test scripts/tests/catch-manager-regressions.test.ts`
- `node --import tsx --test scripts/tests/scene-debug-room-regressions.test.ts`
- `node --import tsx --test scripts/tests/room-bundle-import-regressions.test.ts`
- `node --import tsx --test scripts/tests/i18n-remediation-regressions.test.ts`
- `npm run typecheck`

## Expected outcomes

- Team Tetris never starts without `AI1`, `AI2`, and `US1`.
- Local submission payloads use canonical `rowShifts`.
- Stale or duplicate remote moves do not mutate the match.
- Invalid AI or remote moves block the match instead of corrupting state.
- Hidden-pair mode stays hidden until game over, then reveals pairings if enabled.
