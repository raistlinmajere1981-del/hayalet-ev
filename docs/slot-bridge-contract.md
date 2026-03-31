# SlotBridge Contract

## Public command surface
- Public entrypoint: `++cmd:SlotBridge({...})`
- Supported actions:
  - `message.send`
  - `message.sendWait`
  - `message.sendWithAttachments`
  - `file.send`
  - `connection.ensure`
  - `session.open`
  - `session.switch`
  - `room.command`

## Envelope
- Core fields:
  - `version`
  - `reqId`
  - `action`
  - `fromSlot`
  - `toSlot`
  - `replyToSlot`
  - `delivery`
  - `wait`
  - `timeoutMs`
  - `force`
  - `connectPolicy`
  - `sessionRef`
  - `payload`
  - `attachments`
- `force: true` remains accepted at the public edge and normalizes to `connectPolicy: "ensure"` internally.

## Result shape
- Standard result fields:
  - `success`
  - `ok`
  - `reqId`
  - `code`
  - `message`
  - `reply`
  - `session`
  - `artifacts`
  - `data`
- `message.sendWait` resolves replies from the archive-backed sync path and can return persisted attachments, including generated images.

## Attachment contract
- Public file-bearing actions should prefer attachment references, not arbitrary local paths.
- Supported descriptor styles:
  - `kind: "attachment-ref"` with `ref: "archive:<slot>:<conversationId>:<messageId>:<name>"`
  - archived reply artifacts returned by `message.sendWait`
  - internal filesystem paths only from trusted sources such as `room-ui`, `system`, or `user`
- AI-authored payloads from `ai0`, `ai1`, or `ai2` do not get direct raw filesystem access.

## Room command model
- Room actions stay internal and dispatch through `action: "room.command"`.
- Room manifests can mark action specs with `exposure: "internal"` so the public catalog does not leak room-local action ids.
- Room UI still uses `roomAPI.sendCommand(...)`; the host converts that request into a `SlotBridge` room action.

## Legacy adapters
- `AIAssistantSend` and `AssistantAISend` remain available as compatibility wrappers.
- Both wrappers route through `SlotBridge` and emit adapter telemetry so remaining legacy callers can be identified in logs.
