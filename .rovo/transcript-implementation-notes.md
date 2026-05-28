# Transcript Implementation Notes

## Scope

- This dictation/transcript feature is app-level and room-independent.
- It must work even when no room, including `laboratory`, is installed.
- It is intentionally separate from the existing scheduled-message `whisper` feature.

## Sprint 0 Decisions

### Permission model

- Desktop microphone capture runs in the active renderer with `navigator.mediaDevices.getUserMedia(...)`.
- No room runtime or laboratory permission seam is reused.
- Cleanup happens from the page-level dictation binding:
  - stopping capture closes the stream and audio context
  - disposing the binding aborts any active capture
  - page-level rebinds on locale refresh reset the control state cleanly

### Capture format

- The renderer normalizes recorded audio into mono PCM16 WAV at `16 kHz`.
- The renderer sends the WAV payload to Electron main as base64.
- This keeps the first-pass transcription path codec-light and avoids depending on `MediaRecorder` container quirks.

### Runtime and provisioning path

- The transcript runtime uses a dedicated app-data directory under `Paths.getDataDir()/transcript`.
- No `rooms/` assets, room-tool manifests, or laboratory toolchain files are used.
- Runtime resolution order:
  - explicit env override via `HAYALET_EV_TRANSCRIPT_WHISPER_BIN`
  - previously built local runtime under the transcript app-data directory
  - `whisper-cli` already available on `PATH`
  - otherwise clone and build `whisper.cpp` in the transcript app-data directory
- Model resolution order:
  - explicit env override via `HAYALET_EV_TRANSCRIPT_WHISPER_MODEL`
  - app-data cached `ggml-base.bin`
  - otherwise download the official multilingual base model and verify SHA1

## UI contract

- `analyze` inserts into `#compose-input`
- native OpenCode UI inserts into `#chat-input`
- Both use the same transcript insertion helper and dispatch `input` after insertion.

## Future Android ingress contract

The current ingress seam accepts:

- `source`: `pc-mic | android-bridge | synthetic-test`
- `target`: `analyze-compose | assistant-opencode-native | null`
- `text`
- `isFinal`
- `metadata`
- `requestId`

Transport is intentionally unspecified so a later Android bridge can use USB/ADB, reverse port forwarding, or another local channel without changing page adapters.
