type LaboratoryProjectConfigRuntime = {
  audioAnalysisCapabilities: unknown;
  audioAnalysisCatalog: unknown;
  audioAnalysisPresets: unknown;
  audioAnalysisProviders: unknown;
  editCapabilities: unknown;
  editPresets: unknown;
  packageToolsDir: string | null;
  profileCapabilities: unknown;
  profileModels: unknown;
  profilePresets: unknown;
  projectSchema: unknown;
  sourcePresets: unknown;
  subtitleAnalysisCapabilities: unknown;
  subtitleAnalysisCatalog: unknown;
  subtitleAnalysisProviders: unknown;
  subtitleEditPresets: unknown;
  subtitleSourcePresets: unknown;
  subtitleYoutubeForm: unknown;
  toolchainManifest: unknown;
  ytDlpForm: unknown;
};

type LaboratoryProjectConfigLoaderDeps = {
  readJsonFile: (filePath: string) => Promise<unknown>;
};

type LaboratoryRoomApi = {
  room: {
    installedDir: string;
  };
};

export function createLaboratoryProjectConfigLoader(
  deps: LaboratoryProjectConfigLoaderDeps,
) {
  const { readJsonFile } = deps;

  async function loadRuntimeConfigs(
    api: LaboratoryRoomApi,
    runtime: LaboratoryProjectConfigRuntime,
  ): Promise<void> {
    const baseDir = `${api.room.installedDir}/shared/data/tools`;
    const [
      sourcePresets,
      projectSchema,
      ytDlpForm,
      toolchainManifest,
      editPresets,
      editCapabilities,
      profilePresets,
      profileCapabilities,
      profileModels,
      subtitleSourcePresets,
      subtitleYoutubeForm,
      subtitleEditPresets,
      subtitleAnalysisCatalog,
      subtitleAnalysisCapabilities,
      subtitleAnalysisProviders,
      audioAnalysisCatalog,
      audioAnalysisCapabilities,
      audioAnalysisPresets,
      audioAnalysisProviders,
    ] = await Promise.all([
      readJsonFile(`${baseDir}/source-presets.json`),
      readJsonFile(`${baseDir}/project-schema.json`),
      readJsonFile(`${baseDir}/yt-dlp.form.json`),
      readJsonFile(`${baseDir}/toolchain.manifest.json`),
      readJsonFile(`${baseDir}/edit-presets.json`),
      readJsonFile(`${baseDir}/edit-capabilities.json`),
      readJsonFile(`${baseDir}/profile-presets.json`),
      readJsonFile(`${baseDir}/profile-capabilities.json`),
      readJsonFile(`${baseDir}/profile-models.json`),
      readJsonFile(`${baseDir}/subtitle-source-presets.json`),
      readJsonFile(`${baseDir}/subtitle-youtube.form.json`),
      readJsonFile(`${baseDir}/subtitle-edit-presets.json`),
      readJsonFile(`${baseDir}/subtitle-analysis-catalog.json`),
      readJsonFile(`${baseDir}/subtitle-analysis-capabilities.json`),
      readJsonFile(`${baseDir}/subtitle-analysis-providers.json`),
      readJsonFile(`${baseDir}/audio-analysis-catalog.json`),
      readJsonFile(`${baseDir}/audio-analysis-capabilities.json`),
      readJsonFile(`${baseDir}/audio-analysis-presets.json`),
      readJsonFile(`${baseDir}/audio-analysis-providers.json`),
    ]);

    runtime.packageToolsDir = baseDir;
    runtime.toolchainManifest = toolchainManifest || {};
    runtime.sourcePresets = sourcePresets || {};
    runtime.projectSchema = projectSchema || {};
    runtime.ytDlpForm = ytDlpForm || {};
    runtime.editPresets = editPresets || {};
    runtime.editCapabilities = editCapabilities || {};
    runtime.profilePresets = profilePresets || {};
    runtime.profileCapabilities = profileCapabilities || {};
    runtime.profileModels = profileModels || {};
    runtime.subtitleSourcePresets = subtitleSourcePresets || {};
    runtime.subtitleYoutubeForm = subtitleYoutubeForm || {};
    runtime.subtitleEditPresets = subtitleEditPresets || {};
    runtime.subtitleAnalysisCatalog = subtitleAnalysisCatalog || {};
    runtime.subtitleAnalysisCapabilities = subtitleAnalysisCapabilities || {};
    runtime.subtitleAnalysisProviders = subtitleAnalysisProviders || {};
    runtime.audioAnalysisCatalog = audioAnalysisCatalog || {};
    runtime.audioAnalysisCapabilities = audioAnalysisCapabilities || {};
    runtime.audioAnalysisPresets = audioAnalysisPresets || {};
    runtime.audioAnalysisProviders = audioAnalysisProviders || {};
  }

  return {
    loadRuntimeConfigs,
  };
}
