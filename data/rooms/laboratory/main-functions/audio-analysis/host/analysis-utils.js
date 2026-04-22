import { createAudioAnalysisParserRuntime } from "./analysis-parsers.js";
import { createAudioAnalysisProbeRuntime } from "./analysis-probes.js";
export function createAudioAnalysisUtilityRuntime(deps) {
  const audioAnalysisParserRuntime = createAudioAnalysisParserRuntime();
  const audioAnalysisProbeRuntime = createAudioAnalysisProbeRuntime({
    ...deps,
    buildProsodySummaryFromCsv: audioAnalysisParserRuntime.buildProsodySummaryFromCsv,
    parseBlackDetectLog: audioAnalysisParserRuntime.parseBlackDetectLog,
    parseFreezeDetectLog: audioAnalysisParserRuntime.parseFreezeDetectLog,
    parseSilenceDetectLog: audioAnalysisParserRuntime.parseSilenceDetectLog,
    parseVolumeDetectLog: audioAnalysisParserRuntime.parseVolumeDetectLog
  });
  return {
    buildEmotionHeuristicFromProsody: audioAnalysisParserRuntime.buildEmotionHeuristicFromProsody,
    buildProsodySummaryFromCsv: audioAnalysisParserRuntime.buildProsodySummaryFromCsv,
    parseAspectralStatsText: audioAnalysisParserRuntime.parseAspectralStatsText,
    resolveOpenSmileProsodyRuntime: audioAnalysisProbeRuntime.resolveOpenSmileProsodyRuntime,
    runAudioStructureProbe: audioAnalysisProbeRuntime.runAudioStructureProbe,
    runOpenSmileProsodyExtraction: audioAnalysisProbeRuntime.runOpenSmileProsodyExtraction,
    runVideoStructureProbe: audioAnalysisProbeRuntime.runVideoStructureProbe
  };
}
