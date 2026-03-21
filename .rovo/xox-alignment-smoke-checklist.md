# XOX Alignment Smoke Checklist

**Generated**: 2026-03-21

## Runtime Matrix

- `AI1 + user starts`
  - Start button enables only when `AI1` is ready
  - User move dispatches board snapshot + protocol on first AI turn
  - AI move is applied only from `AI1`

- `AI1 + AI starts`
  - Protocol + empty board dispatch immediately on start
  - First accepted move comes only from `AI1`

- `AI2 + user starts`
  - Target selection updates opponent card and command routing to `AI2`
  - User move triggers AI prompt with current board text

- `AI2 + AI starts`
  - Empty board is sent immediately to `AI2`
  - Returned move is ignored if it comes from `AI1`

## Failure Matrix

- `Selected slot disconnects mid-game`
  - Room enters blocked state
  - UI shows blocked status and requires reset

- `Malformed AI command`
  - Catcher ignores malformed syntax
  - No board mutation occurs

- `Invalid AI move`
  - Host blocks the match on invalid cell or filled cell
  - UI receives the blocked result

- `Game-over lockout`
  - After user win / AI win / draw, extra user or AI moves are rejected until reset

## Validation Notes

- Automated coverage now exists for start order, provider mismatch, invalid AI move, draw, user win, room-page host-context wiring, and installed-room scene/debug registration.
- Manual in-app smoke is still recommended after future room/feature changes that touch scene assets, slot readiness behavior, or room install/restart flows.
