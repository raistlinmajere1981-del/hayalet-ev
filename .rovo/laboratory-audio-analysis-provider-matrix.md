# Laboratory Audio Analysis Provider Matrix

This matrix tracks the shared room tool and shared room tool manual paths used by the audio-analysis feature.

| Provider | Tool | Install path | Runtime entry |
| --- | --- | --- | --- |
| `prosody-open-smile` | `opensmile` | shared room tool | bundled `SMILExtract` runtime |
| `emotion-heuristic` | `opensmile` | shared room tool | bundled `SMILExtract` runtime |
| `speaker-timeline` | `pyaudioanalysis` | shared room tool manual | `python3` + local `pyAudioAnalysis` host package |
| `sound-event-classifier` | `yamnet` | shared room tool manual | `python3` + yamnet runner |
| `source-separation-runner` | `demucs` | shared room tool manual | `python3` + demucs runner |
| `music-rhythm-engine` | `librosa` | shared room tool manual | `python3` + librosa runtime |
| `music-rhythm-essentia` | `essentia` | shared room tool manual | `python3` + Essentia fallback |

Notes:

- `speaker-timeline` stays on a fully local `pyAudioAnalysis` path and does not depend on remote inference.
- Manual Python providers are expected to resolve from room-managed virtual environments before falling back to system `python3`.
- The matrix is intentionally v2-ready and aligned with the room tool manifest rather than a standalone audio room.
