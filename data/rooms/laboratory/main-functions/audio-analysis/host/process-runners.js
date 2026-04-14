import { createAudioAnalysisLocalProcessRunners } from "./process-local-runners.js";
import { createAudioAnalysisModelProcessRunners } from "./process-model-runners.js";
import { createAudioAnalysisProcessRunnerSupport } from "./process-runner-support.js";
export function createAudioAnalysisProcessRuntime(deps) {
  const processRunnerSupport = createAudioAnalysisProcessRunnerSupport(deps);
  const {
    runEmotionHeuristicAudioAnalyzer,
    runProsodyAudioAnalyzer,
    runSignalHealthAudioAnalyzer,
    runSpectralArtifactsAudioAnalyzer,
    runTranscriptionAudioAnalyzer
  } = createAudioAnalysisLocalProcessRunners({
    ...deps,
    ...processRunnerSupport
  });
  const {
    runMusicRhythmAudioAnalyzer,
    runSoundEventsAudioAnalyzer,
    runSourceSeparationAudioAnalyzer,
    runSpeakerDiarizationAudioAnalyzer
  } = createAudioAnalysisModelProcessRunners({
    ...deps,
    ...processRunnerSupport
  });
  function getModuleRunner(moduleId) {
    const runners = {
      "signal-health": runSignalHealthAudioAnalyzer,
      "spectral-artifacts": runSpectralArtifactsAudioAnalyzer,
      transcription: runTranscriptionAudioAnalyzer,
      "speaker-diarization": runSpeakerDiarizationAudioAnalyzer,
      prosody: runProsodyAudioAnalyzer,
      emotion: runEmotionHeuristicAudioAnalyzer,
      "sound-events": runSoundEventsAudioAnalyzer,
      "source-separation": runSourceSeparationAudioAnalyzer,
      "music-rhythm-tonal": runMusicRhythmAudioAnalyzer
    };
    return runners[moduleId] || null;
  }
  return {
    generateProcessSpectrogram: processRunnerSupport.generateProcessSpectrogram,
    getModuleProcessDir: processRunnerSupport.getModuleProcessDir,
    getModuleRunner
  };
}
