export function createLaboratorySourceDelegatesRuntime(deps) {
  const { mediaSourceIntakeRuntime } = deps;
  const handleLocalPick = async function handleLocalPick2(api, runtime, requestId) {
    return mediaSourceIntakeRuntime.handleLocalPick(api, runtime, requestId);
  };
  const handleUrlDownload = async function handleUrlDownload2(api, runtime, requestId) {
    return mediaSourceIntakeRuntime.handleUrlDownload(api, runtime, requestId);
  };
  const getResolvedYoutubeSettings = function getResolvedYoutubeSettings2(project, sourcePresets) {
    return mediaSourceIntakeRuntime.getResolvedYoutubeSettings(project, sourcePresets);
  };
  const findYtDlpFinalPath = function findYtDlpFinalPath2(stdoutValue) {
    return mediaSourceIntakeRuntime.findYtDlpFinalPath(stdoutValue);
  };
  const buildYtDlpArgs = function buildYtDlpArgs2(project, toolState, sourceDir) {
    return mediaSourceIntakeRuntime.buildYtDlpArgs(project, toolState, sourceDir);
  };
  const handleYoutubeDownload = async function handleYoutubeDownload2(api, runtime, requestId) {
    return mediaSourceIntakeRuntime.handleYoutubeDownload(api, runtime, requestId);
  };
  return {
    buildYtDlpArgs,
    findYtDlpFinalPath,
    getResolvedYoutubeSettings,
    handleLocalPick,
    handleUrlDownload,
    handleYoutubeDownload
  };
}
