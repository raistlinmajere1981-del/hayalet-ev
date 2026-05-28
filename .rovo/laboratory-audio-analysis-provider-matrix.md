# Laboratory Audio Analysis Provider Matrix

This matrix keeps the audio-analysis rollout aligned with the shared room-tool contract.

| Provider | Modules | Tooling | Install path |
| --- | --- | --- | --- |
| ffmpeg-signal | signal-health, spectral-artifacts | ffmpeg | shared room tool |
| ffmpeg-signal-recovery | signal-recovery, band-pass-exploration, spectrogram-guided-recovery, hidden-pattern-extraction | ffmpeg | shared room tool |
| ffmpeg-frequency-recovery | frequency-shift-reversal | ffmpeg | shared room tool |
| ffmpeg-phase-lab | phase-recovery-experiment | ffmpeg | shared room tool |
| speech-runtime-transcript | transcription | transcript-runtime | central Speech Runtime |
| speaker-timeline | speaker-diarization | pyAudioAnalysis, ffmpeg, python3 | shared room tool manual |
| prosody-open-smile | prosody | openSMILE | shared room tool |
| emotion-heuristic | emotion | openSMILE | shared room tool |
| sound-event-classifier | sound-events | yamnet, python3 | shared room tool manual |
| source-separation-runner | source-separation | demucs, python3 | shared room tool manual |
| music-rhythm-engine | music-rhythm-tonal | librosa, python3 | shared room tool manual |
| music-rhythm-essentia | music-rhythm-tonal fallback | essentia, python3 | shared room tool manual |

Notes:
- Manual providers must stay capability-driven and never imply managed install availability when only a system command is supported.
- pyAudioAnalysis stays visible because speaker-timeline is part of the persistent v2-ready audio contract.
