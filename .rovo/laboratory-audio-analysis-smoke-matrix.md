# Laboratory Audio Analysis Smoke Matrix

Target smoke coverage for the shared audio-analysis runtime:

- signal-health: probe loudness, silence, and continuity with FFmpeg only.
- signal-recovery: generate recovery mix, spectrogram preview, and manifest.
- frequency-shift-reversal: confirm inverse shift artifact generation and warning text.
- band-pass-exploration: verify focused speech-band preview output.
- spectrogram-guided-recovery: verify recovery variant tuned for spectrogram inspection.
- hidden-pattern-extraction: verify reveal-oriented dynamic range expansion output.
- phase-recovery-experiment: verify phase-isolation variant and guarded warning text.
- transcription: verify Whisper sample path only when the selected model is ready.
- speaker-diarization: verify pyAudioAnalysis fallback behavior and local-only execution path.
- prosody: verify openSMILE contours and summary output.
- emotion: verify heuristic summary derived from prosody output.
- sound-events: verify yamnet event summary when python3 runtime is available.
- source-separation: verify isolated stem manifest and exported artifacts.
- music-rhythm-tonal: verify BPM, beat density, and dominant pitch-class summaries.
