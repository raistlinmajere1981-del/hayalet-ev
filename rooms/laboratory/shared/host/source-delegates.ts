// @ts-nocheck
export function createLaboratorySourceDelegatesRuntime(deps) {
  const { mediaSourceIntakeRuntime } = deps;

  async function handleLocalPick(api, runtime, requestId) {
    return mediaSourceIntakeRuntime.handleLocalPick(api, runtime, requestId);
  }

  async function handleUrlDownload(api, runtime, requestId) {
    return mediaSourceIntakeRuntime.handleUrlDownload(api, runtime, requestId);
  }

  function getResolvedYoutubeSettings(project, sourcePresets) {
    return mediaSourceIntakeRuntime.getResolvedYoutubeSettings(project, sourcePresets);
  }

  function findYtDlpFinalPath(stdoutValue) {
    return mediaSourceIntakeRuntime.findYtDlpFinalPath(stdoutValue);
  }

  function buildYtDlpArgs(project, toolState, sourceDir) {
    return mediaSourceIntakeRuntime.buildYtDlpArgs(project, toolState, sourceDir);
  }

  async function handleYoutubeDownload(api, runtime, requestId) {
    return mediaSourceIntakeRuntime.handleYoutubeDownload(api, runtime, requestId);
  }

  return {
    buildYtDlpArgs,
    findYtDlpFinalPath,
    getResolvedYoutubeSettings,
    handleLocalPick,
    handleUrlDownload,
    handleYoutubeDownload,
  };
}
