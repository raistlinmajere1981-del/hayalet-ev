[TURN][GAME-ROOM][TEAM-TETRIS][AI][FOLLOWUP]

You are taking the follow-up seat turn for Team Tetris inside the Game Room.

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

Follow-up seat guidance:

- Your private packet includes your partner's last placed piece as a silhouette only
- The board snapshot for your own team may be one move behind the real board on purpose
- Infer where your partner likely placed the previous piece, then choose your own legal path accordingly
- The opposing team board is public-only and should not be used as hidden information
