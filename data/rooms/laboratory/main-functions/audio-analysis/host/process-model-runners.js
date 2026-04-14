import { createAudioAnalysisMusicRhythmModelRunner } from "./process-model-music-rhythm.js";
import { createAudioAnalysisSoundEventsModelRunner } from "./process-model-sound-events.js";
import { createAudioAnalysisSourceSeparationModelRunner } from "./process-model-source-separation.js";
import { createAudioAnalysisSpeakerDiarizationModelRunner } from "./process-model-speaker-diarization.js";
export function createAudioAnalysisModelProcessRunners(deps) {
  const runMusicRhythmAudioAnalyzer = createAudioAnalysisMusicRhythmModelRunner(deps);
  const runSoundEventsAudioAnalyzer = createAudioAnalysisSoundEventsModelRunner(deps);
  const runSourceSeparationAudioAnalyzer = createAudioAnalysisSourceSeparationModelRunner(deps);
  const runSpeakerDiarizationAudioAnalyzer = createAudioAnalysisSpeakerDiarizationModelRunner(deps);
  return {
    runMusicRhythmAudioAnalyzer,
    runSoundEventsAudioAnalyzer,
    runSourceSeparationAudioAnalyzer,
    runSpeakerDiarizationAudioAnalyzer
  };
}
