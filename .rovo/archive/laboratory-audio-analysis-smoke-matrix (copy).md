# Laboratory Audio Analysis Smoke Matrix

This smoke matrix is the quick operator checklist for the audio-analysis feature inside the shared laboratory workbench.

| Module id | Minimum smoke path | Expected outcome |
| --- | --- | --- |
| `signal-health` | Load source and run FFmpeg probe | summary cards update with signal health |
| `spectral-artifacts` | Run FFmpeg-backed extraction | artifact warnings and descriptors populate |
| `transcription` | Verify Whisper tool + model | transcript artifacts become available |
| `speaker-diarization` | Run `pyaudioanalysis` + FFmpeg | speaker timeline populates |
| `prosody` | Run `opensmile` profile | prosody metrics are emitted |
| `emotion` | Run `opensmile` heuristic pass | emotion summary is emitted |
| `sound-events` | Run `yamnet` classifier | sound event buckets populate |
| `source-separation` | Run `demucs` path | separated stems are recorded |
| `music-rhythm-tonal` | Run `librosa` path, optional Essentia fallback | BPM and dominant pitch-class metadata populate |

Targeted checks:

- `music-rhythm-tonal` must still pass when only the primary `librosa` path is available.
- `source-separation` must remain optional for report opening and should surface stale report messaging honestly.
