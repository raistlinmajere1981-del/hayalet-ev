# Transcript Centralization

Hayalet Ev now treats local speech transcription as a core capability owned by the Electron main process.

## Why This Exists

- `whisper.cpp` binary discovery, build, cache, and model verification live in one place.
- App-shell dictation resolves its active language from `settings.general.language` and its active profile from `settings.general.transcriptModelVariant`.
- Installation, repair, and managed model lifecycle live in the main Settings panel.
- Rooms do not own binary or model lifecycle. They consume the capability through existing room-host seams.
- `++cmd` is optional follow-up orchestration, not the transport for local microphone capture or transcription.

## Security Boundaries

- Managed file transcription is limited to room-managed storage paths.
- Room-originated transcript work should flow through `room-tools` / room-host mediation instead of broad preload transcript APIs.
- Room-targeted ingress uses typed targets such as `room:<roomId>` and is relayed by the room host layer.

## Model Policy

- English `light` -> `tiny.en`
- English `full` -> `base.en`
- Turkish `light` -> multilingual `tiny`
- Turkish `full` -> multilingual `base`

Unknown locales fall back to English unless an explicit request overrides the language at job start.

## Compatibility Rules

- Preserve `HAYALET_EV_TRANSCRIPT_WHISPER_BIN`.
- Preserve `HAYALET_EV_TRANSCRIPT_WHISPER_MODEL`.
- Keep existing shell dictation callers working through compatibility aliases while the capability surface converges.
- The legacy `WhisperManager` / whisper page remains a deferred-message queue feature and is not part of speech transcription runtime ownership.

## Room Guidance

- Use room-host or `room-tools` mediation for transcript jobs.
- Keep Laboratory and other rooms in passive status/probe mode for `whisper.cpp`; they should not expose install, update, or model ownership flows.
- Keep room capture browser-owned, but keep transcription centralized.
