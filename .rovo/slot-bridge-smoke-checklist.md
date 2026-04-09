# SlotBridge Smoke Checklist

## Rollout order
1. Parser and type layer
2. Bridge dispatcher
3. `message.sendWait` full-sync reply capture
4. Room transport migration
5. Game Room prompt updates
6. Legacy adapter cleanup

## Manual checks
1. Text send: run `++cmd:SlotBridge({"action":"message.send","toSlot":"ai1","payload":{"text":"ping"}})` and confirm delivery.
2. Waited reply: run `message.sendWait` with a fresh `reqId` and confirm reply text is returned.
3. Generated image reply: trigger a provider image response through `message.sendWait` and confirm `artifacts` contains an `image/*` attachment.
4. File send with reference: send a known archived attachment by `archive:<slot>:<conversationId>:<messageId>:<name>` reference and confirm the destination receives the file.
5. Room UI action: trigger a Game Room UI action and confirm host dispatch reaches `SlotBridge -> room.command`.
6. US1 room transport: send a migrated `roomCommand` envelope across US1 and confirm the receive side applies the room action without public `GameRoom...` commands.
7. Legacy wrappers: trigger `AIAssistantSend` and `AssistantAISend` once and confirm logs include `slot-bridge-legacy-adapter`.

## Exit criteria
- Targeted SlotBridge regressions pass.
- Targeted Game Room and US1 regressions pass.
- `npm run typecheck` passes.
- No unexpected public room command names appear in the command catalog.
