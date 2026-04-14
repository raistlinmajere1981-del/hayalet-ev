# Laboratory Audio Analysis Smoke Matrix

## Goal

These fixtures define the minimum manual smoke set for `audio-analysis` v2 rollout checks.

| Fixture | Primary Use | Expected Modules |
| --- | --- | --- |
| `speech-clean-short` | clean mono speech clip | `signal-health`, `spectral-artifacts`, `transcription`, `prosody` |
| `speech-multi-speaker` | overlapping or alternating speakers | `transcription`, `speaker-diarization`, `emotion` |
| `ambient-noisy` | noisy room or street ambience | `signal-health`, `spectral-artifacts`, `sound-events` |
| `music-heavy` | soundtrack or song-forward media | `spectral-artifacts`, `music-rhythm-tonal`, `source-separation` |
| `long-form-mixed` | long clip with speech and background audio | process cancellation, export persistence, future windowed analyzers |

## Sprint 1 Coverage

- Confirm old projects load with an empty `audioAnalysis` branch.
- Confirm new projects persist `audioAnalysis.results`, `providerState`, and `capabilityState`.
- Confirm planned modules stay visible and honest after reload/export.

## Later Sprint Checks

- Validate per-module cancellation on `long-form-mixed`.
- Validate honest provider readiness messaging for the prepared `demucs`, `librosa`, and `essentia` tool slots while their modules remain planned.
- Validate local `pyAudioAnalysis` speaker segmentation on a known multi-speaker fixture once the host package is installed.
- Validate descriptor-grade spectral metrics without changing the report layout contract.
