type LaboratorySourceDelegatesRecord = Record<string, unknown>;

type LaboratorySourceIntakeRuntime = {
  handleLocalPick: (api: unknown, runtime: unknown, requestId: string) => Promise<unknown>;
  handleUrlDownload: (api: unknown, runtime: unknown, requestId: string) => Promise<unknown>;
  getResolvedYoutubeSettings: (
    project: LaboratorySourceDelegatesRecord,
    sourcePresets: LaboratorySourceDelegatesRecord
  ) => LaboratorySourceDelegatesRecord;
  findYtDlpFinalPath: (stdoutValue: string) => string | null;
  buildYtDlpArgs: (
    project: LaboratorySourceDelegatesRecord,
    toolState: LaboratorySourceDelegatesRecord,
    sourceDir: string
  ) => unknown[];
  handleYoutubeDownload: (api: unknown, runtime: unknown, requestId: string) => Promise<unknown>;
};

type LaboratorySourceDelegatesRuntimeDeps = {
  mediaSourceIntakeRuntime: LaboratorySourceIntakeRuntime;
};

export function createLaboratorySourceDelegatesRuntime(deps: LaboratorySourceDelegatesRuntimeDeps) {
  const { mediaSourceIntakeRuntime } = deps;

  const handleLocalPick: (api: unknown, runtime: unknown, requestId: string) => Promise<unknown> =
    async function handleLocalPick(api: any, runtime: any, requestId: any) {
      return mediaSourceIntakeRuntime.handleLocalPick(api, runtime, requestId);
    };

  const handleUrlDownload: (api: unknown, runtime: unknown, requestId: string) => Promise<unknown> =
    async function handleUrlDownload(api: any, runtime: any, requestId: any) {
      return mediaSourceIntakeRuntime.handleUrlDownload(api, runtime, requestId);
    };

  const getResolvedYoutubeSettings: (
    project: LaboratorySourceDelegatesRecord,
    sourcePresets: LaboratorySourceDelegatesRecord
  ) => LaboratorySourceDelegatesRecord = function getResolvedYoutubeSettings(
    project: any,
    sourcePresets: any
  ) {
    return mediaSourceIntakeRuntime.getResolvedYoutubeSettings(project, sourcePresets);
  };

  const findYtDlpFinalPath: (stdoutValue: string) => string | null = function findYtDlpFinalPath(stdoutValue: any) {
    return mediaSourceIntakeRuntime.findYtDlpFinalPath(stdoutValue);
  };

  const buildYtDlpArgs: (
    project: LaboratorySourceDelegatesRecord,
    toolState: LaboratorySourceDelegatesRecord,
    sourceDir: string
  ) => unknown[] = function buildYtDlpArgs(project: any, toolState: any, sourceDir: any) {
    return mediaSourceIntakeRuntime.buildYtDlpArgs(project, toolState, sourceDir);
  };

  const handleYoutubeDownload: (
    api: unknown,
    runtime: unknown,
    requestId: string
  ) => Promise<unknown> = async function handleYoutubeDownload(api: any, runtime: any, requestId: any) {
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
