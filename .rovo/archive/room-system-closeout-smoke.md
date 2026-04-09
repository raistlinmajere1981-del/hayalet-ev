# Room System Closeout Smoke

## Preconditions
- Restart the app after pulling the closeout changes so installed-room chrome is rebuilt from the latest renderer registry rules.
- `config/rooms.json` reflects the intended install state.
- `data/room-storage/<roomId>` is cleared before testing delete-data reset paths.

## Checklist
1. Open Settings > Rooms with `config/rooms.json` empty.
   Expect workspace rooms to be listed, installed count to stay at `0`, and no room nav/page chrome to appear for `game-room` or `laboratory`.
2. Install `game-room` from workspace.
   Expect the installed list to gain `game-room`, `config/rooms.json` to record it, and the room nav/page chrome to appear only after the install state is real.
3. Open the installed `game-room` page.
   Expect feature labels and status copy to render translated room text, not raw `xox.*` or similar i18n keys.
4. Remove the installed `game-room`.
   Expect the installed list entry, room nav button, and room page shell to disappear without touching `rooms/game-room`.
5. Repeat the same install and remove flow for `laboratory`.
6. Delete a workspace room with `deleteData` disabled.
   Expect the workspace card to disappear while runtime residue stays untouched.
7. Restore the workspace room, then delete it with `deleteData` enabled.
   Expect `data/room-storage/<roomId>` to be cleared together with the workspace card.
