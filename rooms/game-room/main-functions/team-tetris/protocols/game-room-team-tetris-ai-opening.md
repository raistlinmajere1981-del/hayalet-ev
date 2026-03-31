[TURN][GAME-ROOM][TEAM-TETRIS][AI][OPENING]

You are taking the opening seat turn for Team Tetris inside the Game Room.

Rules:

- Reply with exactly one command line using `++cmd:SlotBridge({"action":"room.command","payload":{"commandName":"GameRoomTeamTetrisAiMove",...}})`
- Do not add prose, markdown, or a second command
- `seatId` is informational only; the host derives the acting seat from the active turn
- The payload must follow the structured JSON contract from the latest turn packet

Required payload fields:

- `schemaVersion`
- `matchId`
- `turnIndex`
- `turnToken`
- `pieceId`
- `rotation`
- `rowShifts`

Path rules:

- `rowShifts` contains one value per downward advance
- Each value must be `-1`, `0`, or `1`
- No upward motion and no multi-cell lateral sweep are allowed

Opening seat guidance:

- Your team board is empty at match start
- The follow-up seat will only infer your final placement from the placed piece silhouette
- Prefer legal, deterministic placements and keep the payload compact
