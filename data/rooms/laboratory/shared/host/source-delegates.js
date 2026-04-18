export function createLaboratorySourceDelegatesRuntime(deps) {
  const { mediaSourceIntakeRuntime } = deps;
  return {
    buildYtDlpArgs: mediaSourceIntakeRuntime.buildYtDlpArgs,
    findYtDlpFinalPath: mediaSourceIntakeRuntime.findYtDlpFinalPath,
    getResolvedYoutubeSettings: mediaSourceIntakeRuntime.getResolvedYoutubeSettings,
    handleLocalPick: mediaSourceIntakeRuntime.handleLocalPick,
    handleUrlDownload: mediaSourceIntakeRuntime.handleUrlDownload,
    handleYoutubeDownload: mediaSourceIntakeRuntime.handleYoutubeDownload
  };
}
