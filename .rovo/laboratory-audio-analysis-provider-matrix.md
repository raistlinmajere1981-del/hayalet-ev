# Laboratory Audio Analysis Provider Matrix

## Purpose

This matrix freezes the Sprint 1 provider selection and fallback policy for `audio-analysis` so Sprint 2 can add runtime orchestration without resetting the room contract.

## Active V1 Paths

| Module | Primary Provider | Fallback | Status | Notes |
| --- | --- | --- | --- | --- |
| `signal-health` | `ffmpeg-signal` | none | active | Local binary-backed signal checks, loudness, silence, and continuity summaries. |
| `spectral-artifacts` | `ffmpeg-signal` | none | active | Keeps waveform and spectrogram artifacts; Sprint 2 upgrades descriptor richness without changing the outer envelope. |
| `transcription` | `whisper-transcript` | none | active | Requires shared `whisper.cpp` tool and a ready model. |
| `speaker-diarization` | `speaker-timeline` | none | active-manual | Uses a fully local pyAudioAnalysis runner when the host package is installed; otherwise it falls back to honest missing-tool blockers. |

## Current V2 Paths

| Module | Primary Provider | Fallback | Provider Type | Install Strategy | Expected Artifacts |
| --- | --- | --- | --- | --- | --- |
| `prosody` | `prosody-open-smile` | none yet | script-or-binary | shared room tool manual | `prosody-summary-json`, `contour-csv` |
| `emotion` | `emotion-heuristic` | none yet | heuristic-model | shared room tool manual | `emotion-summary-json` |
| `sound-events` | `sound-event-classifier` | none yet | model-backed-runtime | shared room tool manual | `sound-events-json` |
| `source-separation` | `source-separation-runner` | none yet | model-backed-runtime | shared room tool manual | `stems-manifest-json`, isolated tracks |
| `music-rhythm-tonal` | `music-rhythm-engine` | `music-rhythm-essentia` | descriptor-engine | shared room tool manual | `music-analysis-json` |

## Selection Rules

- Prefer room-local and offline-capable providers.
- Keep planned providers in descriptors even when no installer exists yet.
- Prefer shared room-tool visibility even for manual host dependencies so the settings overlay stays honest.
- Package room-local config assets when a manual binary needs reproducible analyzer presets.
- Prepare manual Python-backed tools in the overlay before the runtime rollout so missing dependencies are visible without fake module readiness.
- Keep manual model-backed runtimes honest: implemented modules may ship before the dependency exists locally, but they must fall back to `missing-tool` and never fake completion.
- Current manual Python tool probes assume `python3` is on PATH; Windows and custom-venv handling remain a later portability pass.
- Do not collapse planned and gated states into fake readiness.
- Treat emotion output as heuristic-only in both runtime and UI copy.
- Keep future provider additions descriptor-driven so shared Electron seams remain room-neutral.
