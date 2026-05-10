# Repair Room Integration Plan

Generated: 2026-05-10
Status: planning artifact, no implementation yet
Target version: Repair Room V1 + central reusable live capture capability

## Executive Summary

Repair Room is a new Hayalet Ev room for electronics repair sessions. The room is not a
generic camera page. It is a repair workbench where the user works on a physical device
while Android Companion acts only as a sensor surface: live camera, photo capture,
torch/flash, dictation, and voice command intake.

The most important architectural decision is that live camera streaming must be added to
the existing centralized capture system, not implemented as a Repair Room-only feature.
Future rooms should consume the same shared capability used for photo capture, dictation,
and voice commands. Rooms register their own command phrases and room command handlers,
but they do not own Android lifecycle, stream transport, model lifecycle, or media
ingress policy.

V1 should deliver:

- central live camera stream capability for room targets
- Repair Room project/session intake
- operator tool profile
- room UI with live camera, snapshot timeline, annotations, AI messages, and repair notes
- Android torch control
- hands-free wake/command mode for repair work
- AI1/AI2 repair guidance through existing SlotBridge and room command patterns
- AI coordinate/grid protocol for pointing at components without damaging the original image
- room-local session archive under `data/room-storage/repair-room`

## Current System Fit

The repo already has the right foundations:

- Room source of truth: `rooms/<room-id>`
- Room build/install/runtime chain: manifest -> installed record -> room page runtime -> room host
- Central Android Companion service for ADB, photo capture, Android dictation, and media ingress
- Room-targeted capture hooks in the room host runtime
- Room-local command registry and voice command matching
- SlotBridge `room.command` routing for AI and US1 flows
- Forge Room patterns for operator profile, session storage, AI task dispatch, and synthesis
- Laboratory patterns for snapshot/ROI concepts, though its UI/runtime should not be treated as a shared annotation canvas

Known gap:

- Android Companion currently keeps live preview on the phone and sends captured photos to desktop.
- Repair Room requires live camera visibility inside Hayalet Ev UI, so a central stream extension is needed.

## Sub-Agent Review Corrections

The first review found that the product direction is right, but several contracts must be
made explicit before implementation. These are V1 blockers, not later polish.

Required contract corrections:

- Hands-free voice cannot rely on ordinary dictation request IDs. V1 needs an authorized
  wake/command session owned by the central capture service and activated by the room host.
- Live stream support cannot be added as a UI-only extension. V1 needs shared stream
  status types, frame events, subscription APIs, and a backpressure/drop-frame policy.
- AI component pointers must arrive through the existing SlotBridge `room.command` route.
  Standalone JSON is only the inner payload, not the command contract.
- Room targets must be trusted by host registration or opaque capture session tokens.
  Renderer-supplied `room:<roomId>` strings are not sufficient authorization.
- V1 should prefer host activation registration for capture/voice capabilities. Manifest
  schema expansion can follow once the runtime shape is proven.
- Captured assets staged by the central capture service must be claimed or copied into the
  Repair Room session archive with checksum, dimensions, orientation, and source metadata.
- Voice commands with free-form arguments are out of scope until a room-local parser exists.
  V1 commands should be exact or tightly normalized.
- AI coordinates are only safe when each snapshot stores image dimensions, orientation,
  display transform, grid version, and normalized coordinate basis.
- Cross-stack validation must include TypeScript, room checks, Android build, capture
  routing tests, SlotBridge command tests, and manual Android smoke.

## Product Model

Repair Room has three actors:

- User: performs physical repair, owns final decisions, confirms risky actions.
- Android Companion: camera, torch, microphone, local dictation, and wake/command sensor.
- AI slots: diagnostic assistants that suggest steps, annotations, measurements, risks, and follow-up views.

The room should feel like a dense repair bench:

- center: live camera or selected frozen snapshot
- right: AI messages, risk flags, measurement prompts, suggested annotations
- left: project/device info, operator tools, session steps
- bottom: visual memory timeline of snapshots and milestones

The phone is never the primary UI.

## Central Capture Capability

Extend the existing central capture system with a reusable live stream surface.

Shared capture operations:

- `capture.status`
- `device.connect`
- `device.disconnect`
- `companion.launch`
- `photo.capture`
- `dictation.start`
- `dictation.stop`
- `voice.command`
- `stream.start`
- `stream.stop`
- `stream.pause`
- `stream.resume`
- `stream.freeze`
- `stream.snapshot`
- `torch.on`
- `torch.off`
- `torch.toggle`

Room targeting:

- Room host activation creates an authorized capture session for `repair-room`.
- Room renderers call capture operations through that session, not by asserting arbitrary room IDs.
- The capture service routes stream frames, media ingress, dictation ingress, and command events by authorized target.
- A typed label such as `room:repair-room` may remain useful for logging, but authorization comes from host registration or an opaque session token.

Room-owned extension points:

- capture capability declaration through host activation in V1
- optional manifest capability declaration after schema support exists
- voice command phrase lists
- room command specs and handlers
- room-local protocol files for AI responses
- room-local UI behavior for capture events

Central ownership remains:

- Android Companion install/update/open
- ADB and wireless device state
- stream transport and bridge health
- dictation model/runtime policy
- media ingress path safety
- cross-window fan-out

## Live Stream Extension

V1 stream target:

- one active Android device
- one active camera stream
- CameraX back camera by default
- torch control
- desktop-visible live stream in room UI
- high-quality still capture remains separate from low-latency stream frames

Recommended V1 transport shape:

- Android Companion opens a CameraX stream session.
- Companion sends encoded frames or low-latency JPEG/WebP frame packets to the desktop bridge.
- Electron capture service owns the stream session and routes frames to subscribed room targets.
- Repair Room UI renders the stream in a controlled stage.
- `stream.snapshot` can freeze the current frame as a room asset.
- `photo.capture` can request a separate high-quality still photo for evidence/archive use.

This intentionally separates:

- live stream: responsive, preview-oriented
- snapshot/still: archive-quality, metadata-rich, session-owned

Required stream contract additions:

- `CaptureStreamStatus`: idle, starting, live, paused, degraded, failed, stopped
- frame event envelope with stream id, frame id, timestamp, width, height, orientation, encoding, and target token
- subscription API for room host/runtime consumers
- backpressure policy: prefer dropping stale preview frames over growing an unbounded queue
- stream health events for FPS, latency, reconnects, and companion-side failures
- separate snapshot claim path so archived images do not depend on transient preview frame URLs

Future adapter seam:

- Android CameraX adapter
- USB/UVC camera adapter
- IP camera adapter
- screen mirror adapter

Repair Room should consume the adapter-neutral central stream contract.

## Android Companion Additions

Android Companion needs new central capabilities:

- stream session start/stop for desktop targets
- frame upload or frame socket channel
- torch on/off/toggle
- active lens reporting
- stream health and FPS reporting
- wake/command mode for hands-free operation

The companion should keep photo capture and dictation behavior compatible with the current capture system.

Important distinction:

- The phone may still show its own preview for operator convenience.
- The authoritative Repair Room workbench view is inside Hayalet Ev UI.

## Voice And Wake Command Model

Current dictation is button-start/button-stop. Repair Room needs a hands-free mode.

Add a central `repair hands-free` style mode to the capture system, generalized enough for other rooms:

- passive wake listening
- active command capture window
- silence-based auto-stop
- explicit cancel phrase
- room-local command matching

V1 behavior:

- Room host activates an authorized hands-free command session.
- Passive mode listens only for wake phrases or short command triggers.
- After wake, companion records a short utterance for that active room session.
- Recording ends on silence timeout, max duration, or stop phrase.
- Final transcript is routed through the central command session, then into the room command registry.
- Room command registry matches exact or tightly normalized phrases in V1.
- Matched command invokes a room command.
- Unmatched text can be added as a note only when the user starts with an explicit note trigger.

Recommended wake phrases:

- `Hayalet dinle`
- `Komut`
- `Not al`
- `AI'ye sor`

Recommended Repair Room voice commands:

- `snapshot al`
- `fotoğraf çek`
- `freeze`
- `fener aç`
- `fener kapat`
- `AI'ye gönder`
- `son görüntüyü aç`
- `referans kaydet`
- `ölçüm ekle`
- `continuity var`
- `continuity yok`
- `voltaj ölçümü`
- `not al`
- `sonraki adım`
- `risk işaretle`

V1 matching constraint:

- Commands above should be argument-free unless a room-local parser is added.
- Measurement values can be entered in the UI first; dictated measurement values require a dedicated parser phase.
- Existing exact-match behavior should be preserved for the first version, then expanded deliberately.

Safety:

- Do not make passive listening a broad transcript recorder.
- Keep wake and command windows visible in UI.
- Store command transcripts as session events only when they affect the repair session.

## Repair Room Structure

Proposed source layout:

- `rooms/repair-room/manifest.json`
- `rooms/repair-room/i18n/en.json`
- `rooms/repair-room/i18n/tr.json`
- `rooms/repair-room/ui/index.html`
- `rooms/repair-room/ui/index.ts`
- `rooms/repair-room/ui/repair-room-ui-runtime.ts`
- `rooms/repair-room/ui/panels/*`
- `rooms/repair-room/ui/annotation/*`
- `rooms/repair-room/host/index.ts`
- `rooms/repair-room/host/runtime.ts`
- `rooms/repair-room/host/session-runtime.ts`
- `rooms/repair-room/host/capture-runtime.ts`
- `rooms/repair-room/host/voice-runtime.ts`
- `rooms/repair-room/host/ai-runtime.ts`
- `rooms/repair-room/host/archive-runtime.ts`
- `rooms/repair-room/shared/types/*`
- `rooms/repair-room/shared/host/*`
- `rooms/repair-room/shared/ui/*`
- `rooms/repair-room/main-functions/repair-session/protocols/*`
- `rooms/repair-room/main-functions/repair-session/assets/*`

Room identity:

- room id: `repair-room`
- primary feature id: `repair-session`
- source of truth: `rooms/repair-room`
- mutable runtime data: `data/room-storage/repair-room`

## Operator Tool Profile

Before first real use, the room should ask the user to define available tools.

V1 tool profile fields:

- multimeter
- soldering iron
- hot air station
- microscope or macro camera
- bench power supply
- current-limited supply capability
- USB meter/tester
- thermal camera or thermometer
- flux, IPA, solder wick, solder paste
- ESD mat/wrist strap
- common spare parts
- skill levels: soldering, measurement, hot air, board-level diagnosis
- risk tolerance: low, medium, high
- preferred guidance mode: learn-first or result-first

AI use:

- AI must not assume tools marked unavailable.
- AI should downgrade steps when skill level is low.
- AI should ask for confirmation before high-risk steps.
- AI should prefer reversible checks before destructive work.

Implementation guidance:

- Reuse Forge Room concepts where helpful, but keep Repair Room profile room-local.
- Consider a later shared operator profile abstraction only after Repair Room proves the shape.

## Project Intake

New repair project fields:

- device type
- brand/model
- board or revision info if known
- symptom
- what happened before failure
- previous repair attempts
- visible damage
- power behavior
- available documents or schematics
- user notes
- risk notes

V1:

- user enters this manually
- optional attachments can be added

V2:

- Assistant AI can help extract project details from photos, documents, or user messages.
- service manual or schematic lookup may be added later.

## Session Storage Model

Use room-local filesystem storage as primary store.

Root:

- `data/room-storage/repair-room/sessions/<sessionId>/`

Suggested files:

- `session.json`
- `events.jsonl`
- `device.json`
- `operator-profile-snapshot.json`
- `snapshots/`
- `annotations/`
- `measurements/`
- `ai/`
- `assets/`
- `exports/`

Suggested room-level index:

- `data/room-storage/repair-room/session-index.json`

Core records:

- `RepairSessionRecord`
- `RepairProjectRecord`
- `RepairDeviceRecord`
- `RepairSnapshotRecord`
- `RepairAnnotationRecord`
- `RepairMeasurementRecord`
- `RepairAiJobRecord`
- `RepairAiResultRecord`
- `RepairRiskFlag`
- `RepairEvent`
- `RepairAssetDescriptor`

Rules:

- snapshots and annotations are immutable by default; edits create revisions or events
- generated overlay images are derived artifacts, not source of truth
- session archive must be readable as a folder without requiring SQLite
- global archive remains secondary for AI conversation references only

Capture asset claim rules:

- central capture may stage photos and frames outside the room archive
- Repair Room must claim or copy selected assets into the active session folder
- claimed assets store checksum, dimensions, EXIF/orientation, capture source, import time, and original staged asset reference
- cleanup of unclaimed staged assets remains a central capture responsibility
- session records refer to claimed room assets, not temporary central staging paths

## Visual Memory And Snapshot Timeline

The room should treat visual evidence as a timeline:

- before repair
- board overview
- close-up
- measurement point
- intermediate state
- after repair
- comparison/reference frame

Each snapshot should store:

- capture source
- asset path
- checksum
- width and height
- EXIF/orientation and applied rotation
- taken time
- stream frame context if available
- display fit transform used by the annotation stage
- grid version and grid density when sent to AI
- active tool/profile state
- user note
- linked annotations
- linked measurements
- linked AI jobs/results

Timeline features:

- pin as reference
- compare with current frame
- show annotation layers
- filter by milestone
- send selected frame to AI
- export selected snapshot with overlays

## Annotation Toolset

Repair Room needs a simple but real drawing layer.

V1 tools:

- select/move
- arrow
- rectangle
- freehand pen
- point/pin
- text note
- color swatches
- undo/redo
- show/hide layers
- delete selected

Layer kinds:

- user annotation
- AI suggestion
- measurement point
- risk mark
- reference mark

Annotation source of truth:

- vector JSON, normalized to image coordinates
- not flattened PNG

Suggested geometry:

- point: normalized x/y
- box: normalized x/y/width/height
- arrow: normalized start/end
- path: normalized point list
- text: normalized anchor + text

Author fields:

- `authorKind`: user, ai, system
- `authorSlot`: ai1, ai2, null
- `sourceJobId`
- `confidence`
- `createdAt`

## AI Component Pointing Protocol

AI must be able to point to a component without modifying the original image.

Use three image concepts:

- original frame: clean archived image
- AI analysis frame: derived image with subtle grid overlay
- UI overlay: rendered annotation on the clean image

Grid requirements:

- grid is added only to AI analysis copy
- original snapshot remains clean
- grid should be low contrast and not hide component detail
- edges show row/column labels
- default grid can start at 12x12
- UI can toggle the grid display separately

AI response should return both grid and normalized coordinates through SlotBridge.

Canonical V1 command route:

```text
++cmd:SlotBridge({
  "action": "room.command",
  "commandName": "RepairRoomSuggestComponentPointer",
  "payload": {
    "snapshotId": "...",
    "gridVersion": "...",
    "gridCell": "D7",
    "x": 0.43,
    "y": 0.68,
    "label": "Likely hot regulator"
  }
})
```

Coordinate policy:

- `x` and `y` are normalized against the original image, from 0 to 1
- `gridCell` is human-readable fallback
- optional `box` can be used when component area matters
- UI renders the result as a suggested AI annotation
- user reviews before applying to permanent annotation layer
- snapshot metadata must confirm width, height, orientation, display transform, and grid version before rendering the pointer

Prompt rule:

- AI must avoid vague phrases like "the component near the top".
- AI must give `gridCell` plus normalized coordinate for any physical target.
- If confidence is low, AI must ask for a closer snapshot.

## AI Slot Integration

Use existing SlotBridge and room command patterns.

AI-originated structured changes must use `++cmd:SlotBridge` with `action`
set to `room.command` and a Repair Room command name. Free-floating JSON can be
used inside the AI prompt as a schema explanation, but it is not accepted as the
runtime command.

Recommended AI roles:

- AI1: diagnostic lead
- AI2: safety checker / second opinion

AI may produce:

- text guidance
- risk flags
- suggested annotations
- component pointers
- measurement requests
- close-up requests
- session note suggestions

AI should not directly:

- connect/disconnect devices
- start capture silently
- mutate accepted annotations without review
- mark risky physical action as completed
- bypass user confirmation

Room command examples:

- `RepairRoomAddAiAnnotation`
- `RepairRoomSuggestComponentPointer`
- `RepairRoomRequestCloseup`
- `RepairRoomSetRiskFlag`
- `RepairRoomAppendSessionNote`
- `RepairRoomAskMeasurement`
- `RepairRoomProposeNextStep`

Room UI command examples:

- `RepairRoomCreateSession`
- `RepairRoomUpdateProject`
- `RepairRoomUpdateToolProfile`
- `RepairRoomStartStream`
- `RepairRoomStopStream`
- `RepairRoomToggleTorch`
- `RepairRoomCaptureSnapshot`
- `RepairRoomFreezeFrame`
- `RepairRoomAddUserAnnotation`
- `RepairRoomAcceptAiAnnotation`
- `RepairRoomRejectAiAnnotation`
- `RepairRoomAddMeasurement`
- `RepairRoomDispatchAiReview`
- `RepairRoomSaveSession`
- `RepairRoomExportSession`

## Guided Measurement System

V1 is manual-entry but structured.

Measurement kinds:

- continuity
- voltage
- resistance
- diode mode
- current draw
- temperature
- visual observation

Each measurement stores:

- value
- unit
- mode
- target annotation or component pointer
- snapshot id
- tool used
- timestamp
- user note
- AI prompt/result linkage if relevant

AI workflow:

- AI asks for a measurement point.
- UI shows a suggested marker.
- User measures physically.
- User enters or dictates result.
- Room records the measurement and sends context back to AI when needed.

Voice command handling:

- `ölçüm ekle`
- `continuity var`
- `continuity yok`
- `voltaj ölçümü`

Free-form dictated values such as `3.3 volt` or `10 kilo ohm` should be handled by a
room-local measurement parser after the exact-command V1 is stable.

## Safety Model

Repair Room is an assistant, not automation.

Risk levels:

- info
- caution
- high-risk
- stop-and-confirm

Confirmation required for:

- powered-board probing
- battery removal or battery-adjacent work
- hot air or soldering recommendations
- unknown voltage injection
- suspected short circuit
- high-current bench PSU use
- destructive component removal

AI result handling:

- high-risk suggestions are visually distinct
- accepted risk actions create session events
- rejected risk actions stay visible in AI history but do not mutate workflow state

## UI Plan

Primary layout:

- left rail: project, device, tool profile, session status
- center stage: live stream or selected snapshot
- center overlay: annotation and measurement layers
- right rail: AI conversation, risk flags, suggested actions
- bottom strip: snapshot timeline and milestones

Core controls:

- start/stop stream
- snapshot
- freeze
- torch
- send current frame to AI
- grid toggle
- annotation mode
- measurement mode
- voice mode status

No marketing-style landing screen. Opening the room should show the actual repair bench.

## Implementation Phases

### Phase 1: Contract Freeze

- Define shared capture stream operations, status objects, frame events, and subscription API.
- Define room capture capability registration through host activation and opaque session tokens.
- Define capture asset claim/copy contract from central staging into room session archives.
- Define wake/command session authorization and transcript routing.
- Define Repair Room manifest command specs.
- Define SlotBridge `room.command` schemas for pointers, annotations, measurements, and risks.
- Define storage schema and session event names.
- Define snapshot coordinate metadata: dimensions, orientation, display transform, grid version.

Validation:

- typecheck for shared types
- unit tests for command/event normalization
- target/session authorization tests
- SlotBridge room command schema tests
- manifest validation tests only for fields that already exist in the manifest schema

### Phase 2: Central Live Capture Capability

- Extend Android Companion with stream and torch commands.
- Extend Electron capture service with stream session state.
- Add room-targeted stream event fan-out.
- Add backpressure/drop policy for preview frames.
- Add stream health and failure events.
- Add stream snapshot/freeze handling.
- Add asset claim/copy path into the active room session.
- Keep photo capture and dictation compatibility intact.

Validation:

- Android companion build/regression tests
- capture service stream routing tests
- frame backpressure and subscriber lifecycle tests
- asset claim/copy tests
- manual smoke with one Android device

### Phase 3: Hands-Free Voice Mode

- Add wake/command mode to central capture system.
- Add passive wake and active utterance windows.
- Route final transcripts through authorized command sessions.
- Allow rooms to register exact phrase lists at host activation time.
- Keep measurement-value dictation behind a room-local parser milestone.
- Keep broad continuous recording out of V1.

Validation:

- voice command matcher tests
- wake session authorization tests
- room command dispatch tests
- manual smoke for snapshot/torch/note commands

### Phase 4: Repair Room Skeleton

- Add `rooms/repair-room` package.
- Add manifest, scene entry, room UI, host runtime, i18n, and storage paths.
- Add project intake and operator tool profile screens.
- Add empty session create/load/save flow.

Validation:

- `npm run rooms:typecheck`
- `npm run rooms:build`
- room host import smoke test
- room installed UI smoke test

### Phase 5: Visual Workbench

- Render central stream in room UI.
- Add snapshot timeline.
- Add freeze/current frame model.
- Add torch and capture controls.
- Persist snapshot records and assets.

Validation:

- stream event rendering tests
- snapshot storage tests
- room UI state tests

### Phase 6: Annotation And Grid Protocol

- Build vector annotation editor.
- Add user annotation tools.
- Add AI analysis grid generation.
- Add AI pointer result rendering.
- Add accept/reject for AI annotations.

Validation:

- annotation normalization tests
- grid coordinate mapping tests
- visual smoke for common image sizes

### Phase 7: AI Review And Measurement Loop

- Add AI dispatch for selected frame/session context.
- Add AI1/AI2 roles.
- Parse structured AI results.
- Add measurement workbook.
- Link measurements to snapshots/annotations.

Validation:

- SlotBridge room command tests
- AI response parser tests
- measurement storage tests
- conflict/risk handling tests

### Phase 8: Archive And Closeout

- Add session export folder.
- Add readable summary manifest.
- Include clean images, overlay renders, annotations JSON, measurements, AI results, and event log.
- Add smoke checklist.

Validation:

- export shape tests
- manual full repair-session dry run

## Test Plan

Core tests:

- shared capture operation type tests
- `CaptureStreamStatus` and frame envelope tests
- Android companion command/profile tests
- capture service target routing tests
- capture session authorization tests
- stream subscriber lifecycle and backpressure tests
- capture asset claim/copy tests
- room command registry tests
- voice command exact-match tests
- wake/command session tests
- room manifest validation
- Repair Room host import smoke
- Repair Room UI smoke
- session storage tests
- snapshot orientation/display transform tests
- annotation geometry tests
- grid coordinate tests
- SlotBridge AI room command parser tests
- measurement workbook tests
- archive export tests

Required command checks:

- `npm run typecheck`
- `npm run rooms:check`
- `npm run android:build`

Manual smoke:

- connect Android device
- launch companion
- start Repair Room stream
- toggle torch
- capture snapshot
- draw box/arrow/text
- send grid image to AI
- accept AI component pointer
- dictate `snapshot al`
- dictate `fener aç`
- add manual measurement
- save and reload session
- export session folder

## V1 Scope

In scope:

- one Android device
- one active camera stream
- one active Repair Room session
- torch control
- snapshot/freeze
- annotation tools
- grid-based AI component pointing
- AI1/AI2 review
- manual structured measurements
- room-local archive
- wake/command voice mode

Out of scope:

- multi-camera simultaneous stream
- hardware multimeter integration
- service manual lookup
- schematic auto-ingestion by AI
- OCR/component recognition automation
- long video recording and timeline scrub
- automatic AI mutation of accepted repair state
- cross-session similarity search

## Open Decisions Before Implementation

- Exact stream transport: MJPEG/WebSocket, frame HTTP polling, WebRTC, or custom socket.
- Default stream resolution and FPS.
- Exact frame backpressure policy and maximum preview queue depth.
- Whether torch requires a separate companion permission/status surface.
- Wake phrase set and language handling for Turkish/English.
- Whether fuzzy voice matching should wait until after the exact-command V1.
- Whether capture capability declarations should remain host-activation-only in V1 or also update manifest schema.
- Whether operator tool profile should stay Repair Room-local or graduate into shared app profile later.
- Grid density default: 8x8, 10x10, or 12x12.
- AI result parser strictness: JSON-only or JSON plus fallback extraction.

## Implementation Guardrails

- Do not put Android lifecycle inside Repair Room.
- Do not make room renderers write arbitrary files.
- Do not authorize capture operations from renderer-provided room labels alone.
- Do not store annotations only as flattened images.
- Do not accept AI component coordinates without matching snapshot transform and grid metadata.
- Do not let AI directly perform high-risk physical workflow commands.
- Do not make passive listening a full transcript recorder.
- Do not treat staged capture assets as durable room archive records until the room claims or copies them.
- Do not edit generated room artifacts under `data/rooms` as source.
- Keep visible copy room-local i18n-first.
- Keep central capture contracts reusable by future rooms.

## Recommended First Engineering Step

Start with the central capture contract, not the Repair Room UI.

The first implementation PR should define:

- shared stream operation types
- stream status/event envelopes
- room capture capability registration and authorization shape
- capture asset claim/copy shape
- torch operation shape
- wake/command mode shape
- SlotBridge `room.command` payloads for AI pointers and annotations
- tests proving existing photo/dictation behavior remains compatible

After that, implement the Android/Electron stream bridge, then build Repair Room on top.
