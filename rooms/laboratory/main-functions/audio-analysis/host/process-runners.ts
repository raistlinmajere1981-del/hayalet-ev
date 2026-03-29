import { createAudioAnalysisLocalProcessRunners } from "./process-local-runners.js";
import { createAudioAnalysisModelProcessRunners } from "./process-model-runners.js";
import { createAudioAnalysisProcessRunnerSupport } from "./process-runner-support.js";

type AudioAnalysisProcessRuntimeDeps =
  & Parameters<typeof createAudioAnalysisProcessRunnerSupport>[0]
  & Parameters<typeof createAudioAnalysisLocalProcessRunners>[0]
  & Parameters<typeof createAudioAnalysisModelProcessRunners>[0];

type AudioAnalysisProcessRunnerSupportRuntime = ReturnType<
  typeof createAudioAnalysisProcessRunnerSupport
>;
type AudioAnalysisLocalProcessRuntime = ReturnType<
  typeof createAudioAnalysisLocalProcessRunners
>;
type AudioAnalysisModelProcessRuntime = ReturnType<
  typeof createAudioAnalysisModelProcessRunners
>;

type AudioAnalysisProcessRuntime = {
  generateProcessSpectrogram:
    AudioAnalysisProcessRunnerSupportRuntime["generateProcessSpectrogram"];
  getModuleProcessDir:
    AudioAnalysisProcessRunnerSupportRuntime["getModuleProcessDir"];
  getModuleRunner: (
    moduleId: string,
  ) =>
    | AudioAnalysisLocalProcessRuntime[keyof AudioAnalysisLocalProcessRuntime]
    | AudioAnalysisModelProcessRuntime[keyof AudioAnalysisModelProcessRuntime]
    | null;
};

export function createAudioAnalysisProcessRuntime(
  deps: AudioAnalysisProcessRuntimeDeps,
): AudioAnalysisProcessRuntime {
  const processRunnerSupport = createAudioAnalysisProcessRunnerSupport(deps);
  const {
    runEmotionHeuristicAudioAnalyzer,
    runProsodyAudioAnalyzer,
    runSignalHealthAudioAnalyzer,
    runSpectralArtifactsAudioAnalyzer,
    runTranscriptionAudioAnalyzer,
  } = createAudioAnalysisLocalProcessRunners({
    ...deps,
    ...processRunnerSupport,
  });
  const {
    runMusicRhythmAudioAnalyzer,
    runSoundEventsAudioAnalyzer,
    runSourceSeparationAudioAnalyzer,
    runSpeakerDiarizationAudioAnalyzer,
  } = createAudioAnalysisModelProcessRunners({
    ...deps,
    ...processRunnerSupport,
  });

  function getModuleRunner(moduleId: string) {
    const runners: Record<
      string,
      | AudioAnalysisLocalProcessRuntime[keyof AudioAnalysisLocalProcessRuntime]
      | AudioAnalysisModelProcessRuntime[keyof AudioAnalysisModelProcessRuntime]
    > = {
      "signal-health": runSignalHealthAudioAnalyzer,
      "spectral-artifacts": runSpectralArtifactsAudioAnalyzer,
      transcription: runTranscriptionAudioAnalyzer,
      "speaker-diarization": runSpeakerDiarizationAudioAnalyzer,
      prosody: runProsodyAudioAnalyzer,
      emotion: runEmotionHeuristicAudioAnalyzer,
      "sound-events": runSoundEventsAudioAnalyzer,
      "source-separation": runSourceSeparationAudioAnalyzer,
      "music-rhythm-tonal": runMusicRhythmAudioAnalyzer,
    };
    return runners[moduleId] || null;
  }

  return {
    generateProcessSpectrogram: processRunnerSupport.generateProcessSpectrogram,
    getModuleProcessDir: processRunnerSupport.getModuleProcessDir,
    getModuleRunner: getModuleRunner,
  };
}
