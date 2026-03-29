type LaboratorySourceDelegatesRecord = Record<string, unknown>;

type LaboratorySourceIntakeRuntime = {
  handleLocalPick: (
    api: unknown,
    runtime: unknown,
    requestId: string,
  ) => Promise<unknown>;
  handleUrlDownload: (
    api: unknown,
    runtime: unknown,
    requestId: string,
  ) => Promise<unknown>;
  getResolvedYoutubeSettings: (
    project: LaboratorySourceDelegatesRecord,
    sourcePresets: LaboratorySourceDelegatesRecord,
  ) => LaboratorySourceDelegatesRecord;
  findYtDlpFinalPath: (stdoutValue: string) => string | null;
  buildYtDlpArgs: (
    project: LaboratorySourceDelegatesRecord,
    toolState: LaboratorySourceDelegatesRecord,
    sourceDir: string,
  ) => unknown[];
  handleYoutubeDownload: (
    api: unknown,
    runtime: unknown,
    requestId: string,
  ) => Promise<unknown>;
};

type LaboratorySourceDelegatesRuntimeDeps = {
  mediaSourceIntakeRuntime: LaboratorySourceIntakeRuntime;
};

export function createLaboratorySourceDelegatesRuntime(
  deps: LaboratorySourceDelegatesRuntimeDeps,
) {
  const { mediaSourceIntakeRuntime } = deps;

  const handleLocalPick: (
    api: unknown,
    runtime: unknown,
    requestId: string,
  ) => Promise<unknown> = async function handleLocalPick(api, runtime, requestId) {
    return mediaSourceIntakeRuntime.handleLocalPick(api, runtime, requestId);
  };

  const handleUrlDownload: (
    api: unknown,
    runtime: unknown,
    requestId: string,
  ) => Promise<unknown> = async function handleUrlDownload(api, runtime, requestId) {
    return mediaSourceIntakeRuntime.handleUrlDownload(api, runtime, requestId);
  };

  const getResolvedYoutubeSettings: (
    project: LaboratorySourceDelegatesRecord,
    sourcePresets: LaboratorySourceDelegatesRecord,
  ) => LaboratorySourceDelegatesRecord = function getResolvedYoutubeSettings(
    project,
    sourcePresets,
  ) {
    return mediaSourceIntakeRuntime.getResolvedYoutubeSettings(project, sourcePresets);
  };

  const findYtDlpFinalPath: (
    stdoutValue: string,
  ) => string | null = function findYtDlpFinalPath(stdoutValue) {
    return mediaSourceIntakeRuntime.findYtDlpFinalPath(stdoutValue);
  };

  const buildYtDlpArgs: (
    project: LaboratorySourceDelegatesRecord,
    toolState: LaboratorySourceDelegatesRecord,
    sourceDir: string,
  ) => unknown[] = function buildYtDlpArgs(project, toolState, sourceDir) {
    return mediaSourceIntakeRuntime.buildYtDlpArgs(project, toolState, sourceDir);
  };

  const handleYoutubeDownload: (
    api: unknown,
    runtime: unknown,
    requestId: string,
  ) => Promise<unknown> = async function handleYoutubeDownload(api, runtime, requestId) {
    return mediaSourceIntakeRuntime.handleYoutubeDownload(api, runtime, requestId);
  };

  return {
    buildYtDlpArgs,
    findYtDlpFinalPath,
    getResolvedYoutubeSettings,
    handleLocalPick,
    handleUrlDownload,
    handleYoutubeDownload,
  };
}
