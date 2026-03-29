// @ts-nocheck
export function createLaboratoryRoomSnapshotRuntime(deps) {
  const {
    asNonEmptyString,
    clone,
    defaultFeatureId,
    featureIds,
    mediaStages,
    audioFeatureId,
    subtitleFeatureId,
    getFeatureProcessRecord,
    getFeatureReportRecord,
    getRuntimeToolIds,
    getStageSupport,
    getToolManifest,
    mediaFeatureId,
    normalizeAudioAnalysisModuleResult,
    normalizeAudioAnalysisState,
    normalizeSubtitleAnalysisState,
    roomId,
    syncProjectFeatureProjections,
    toFileUrl,
    toRecord,
  } = deps;

  function getSourceRouteLabel(project) {
    if (project.source.routeLabel) {
      return project.source.routeLabel;
    }
    if (project.source.mode === "youtube") {
      return "YouTube";
    }
    if (project.source.mode === "url") {
      return "Direct URL";
    }
    return "Local copy";
  }

  function serializeProjectSummary(project) {
    const mediaProcess = getFeatureProcessRecord(project, mediaFeatureId);
    const audioProcess = getFeatureProcessRecord(project, audioFeatureId);
    const mediaReport = getFeatureReportRecord(project, mediaFeatureId);
    const audioReport = getFeatureReportRecord(project, audioFeatureId);
    const subtitleProcess = getFeatureProcessRecord(project, subtitleFeatureId);
    const subtitleReport = getFeatureReportRecord(project, subtitleFeatureId);

    return {
      id: project.id,
      slug: project.slug,
      name: project.name,
      updatedAt: project.updatedAt,
      sourceKind: project.source.kind,
      sourceMode: project.source.mode,
      status: project.source.status,
      hasSource: typeof project.source.storedPath === "string" && project.source.storedPath.trim() !== "",
      handoffMode: asNonEmptyString(toRecord(project.edit).handoffMode) || "source",
      hasDerivedOutput:
        Array.isArray(toRecord(project.edit).outputs) &&
        toRecord(project.edit).outputs.some(function (entry) {
          return asNonEmptyString(toRecord(entry).path) !== null;
        }),
      profileMode: asNonEmptyString(toRecord(project.profile).mode) || "beginner",
      profilePreflightStatus: asNonEmptyString(toRecord(toRecord(project.profile).preflight).status) || "idle",
      profileTargetMode: asNonEmptyString(toRecord(project.profile).targetAssetMode) || "source",
      processStatus: mediaProcess.status,
      reportStatus: mediaReport.status,
      audioProcessStatus: audioProcess.status,
      audioReportStatus: audioReport.status,
      audioModuleCount: Object.keys(toRecord(toRecord(project.audioAnalysis).results)).length,
      subtitleProcessStatus: subtitleProcess.status,
      subtitleReportStatus: subtitleReport.status,
      subtitleEntryCount: Array.isArray(toRecord(project.subtitleAnalysis).entries)
        ? toRecord(project.subtitleAnalysis).entries.length
        : 0,
    };
  }

  function serializeProject(project, runtime) {
    if (project === null) {
      return null;
    }

    const audioAnalysis = normalizeAudioAnalysisState(project.audioAnalysis, runtime);
    const subtitleAnalysis = normalizeSubtitleAnalysisState(project.subtitleAnalysis, runtime);

    return {
      id: project.id,
      slug: project.slug,
      name: project.name,
      createdAt: project.createdAt,
      updatedAt: project.updatedAt,
      source: {
        ...clone(project.source),
        previewUrl: toFileUrl(project.source.storedPath),
        routeLabel: getSourceRouteLabel(project),
      },
      edit: {
        ...clone(project.edit),
        preview: {
          ...clone(toRecord(project.edit).preview),
          previewUrl: toFileUrl(toRecord(toRecord(project.edit).preview).path),
          artifacts: (Array.isArray(toRecord(toRecord(project.edit).preview).artifacts)
            ? toRecord(toRecord(project.edit).preview).artifacts
            : []
          ).map(function (entry) {
            return {
              ...clone(entry),
              previewUrl: toFileUrl(toRecord(entry).path),
            };
          }),
        },
        outputs: (Array.isArray(toRecord(project.edit).outputs) ? project.edit.outputs : []).map(
          function (entry) {
            return {
              ...clone(entry),
              previewUrl: toFileUrl(entry.path),
              artifacts: (Array.isArray(entry.artifacts) ? entry.artifacts : []).map(function (artifact) {
                return {
                  ...clone(artifact),
                  previewUrl: toFileUrl(toRecord(artifact).path),
                };
              }),
            };
          }
        ),
      },
      profile: {
        ...clone(project.profile),
        artifacts: (Array.isArray(toRecord(project.profile).artifacts) ? project.profile.artifacts : []).map(
          function (entry) {
            return {
              ...clone(entry),
              previewUrl: toFileUrl(entry.path),
            };
          }
        ),
      },
      audioAnalysis: {
        ...clone(audioAnalysis),
        results: Object.keys(toRecord(audioAnalysis.results)).reduce(
          function (accumulator, moduleId) {
            const result = normalizeAudioAnalysisModuleResult(
              toRecord(toRecord(audioAnalysis.results)[moduleId]),
              moduleId,
              {}
            );
            accumulator[moduleId] = {
              ...clone(result),
              artifacts: result.artifacts.map(function (entry) {
                return {
                  ...clone(entry),
                  previewUrl: toFileUrl(entry.path),
                };
              }),
            };
            return accumulator;
          },
          {}
        ),
        export: {
          ...clone(toRecord(audioAnalysis.export)),
          items: (
            Array.isArray(toRecord(audioAnalysis.export).items)
              ? toRecord(audioAnalysis.export).items
              : []
          ).map(function (entry) {
            return {
              ...clone(entry),
              fileUrl: toFileUrl(entry.path),
            };
          }),
        },
      },
      subtitleAnalysis: {
        ...clone(subtitleAnalysis),
        entries: subtitleAnalysis.entries.map(function (entry) {
          return {
            ...clone(entry),
            fileUrl: toFileUrl(entry.path),
          };
        }),
        edit: {
          ...clone(subtitleAnalysis.edit),
          outputs: (Array.isArray(toRecord(subtitleAnalysis.edit).outputs)
            ? toRecord(subtitleAnalysis.edit).outputs
            : []
          ).map(function (entry) {
            return {
              ...clone(entry),
              fileUrl: toFileUrl(entry.path),
            };
          }),
        },
        export: {
          ...clone(toRecord(subtitleAnalysis.export)),
          items: (
            Array.isArray(toRecord(subtitleAnalysis.export).items)
              ? toRecord(subtitleAnalysis.export).items
              : []
          ).map(function (entry) {
            return {
              ...clone(entry),
              fileUrl: toFileUrl(entry.path),
            };
          }),
        },
      },
      process: {
        ...clone(project.process),
        records: featureIds.reduce(function (accumulator, featureId) {
          const record = getFeatureProcessRecord(project, featureId);
          accumulator[featureId] = {
            ...clone(record),
            artifacts: record.artifacts.map(function (entry) {
              return {
                ...clone(entry),
                previewUrl: toFileUrl(entry.path),
              };
            }),
          };
          return accumulator;
        }, {}),
      },
      report: {
        ...clone(project.report),
        records: featureIds.reduce(function (accumulator, featureId) {
          const record = getFeatureReportRecord(project, featureId);
          accumulator[featureId] = {
            ...clone(record),
            exports: record.exports.map(function (entry) {
              return {
                ...clone(entry),
                fileUrl: toFileUrl(entry.path),
              };
            }),
          };
          return accumulator;
        }, {}),
      },
    };
  }

  function getRuntimeRecord(runtime) {
    return runtime && typeof runtime === "object" && Array.isArray(runtime) === false ? runtime : {};
  }

  function buildProjectedProjects(runtime) {
    const runtimeRecord = getRuntimeRecord(runtime);
    const projects = Array.isArray(runtimeRecord.projects) ? runtimeRecord.projects : [];
    return projects.map(function (project) {
      const nextProject = clone(project);
      syncProjectFeatureProjections(runtimeRecord, nextProject);
      return nextProject;
    });
  }

  function serializeJobs(runtime) {
    const runtimeRecord = getRuntimeRecord(runtime);
    return Object.keys(toRecord(runtimeRecord.jobs))
      .map(function (jobId) {
        const job = toRecord(runtimeRecord.jobs)[jobId];
        if (!job) {
          return null;
        }

        return {
          jobId: jobId,
          requestId: job.requestId,
          action: job.action,
          projectId: job.projectId || null,
          toolId: job.toolId || null,
          featureStage: job.featureStage || null,
          stage: job.stage || "queued",
          percent: typeof job.percent === "number" ? job.percent : null,
          message: job.message || null,
        };
      })
      .filter(Boolean);
  }

  function buildToolRegistry(runtime) {
    const runtimeRecord = getRuntimeRecord(runtime);
    return getRuntimeToolIds(runtimeRecord).map(function (toolId) {
      const toolManifest = getToolManifest(runtimeRecord, toolId);
      const systemCommand = toRecord(toolManifest.systemCommand);
      const stageSupport = {};

      mediaStages.forEach(function (stageId) {
        const supportLevel = getStageSupport(toolManifest, stageId);
        if (supportLevel !== "unsupported") {
          stageSupport[stageId] = supportLevel;
        }
      });

      return {
        toolId: toolId,
        displayName: asNonEmptyString(toolManifest.displayName) || toolId,
        installDirName: asNonEmptyString(toolManifest.installDirName) || toolId,
        availability: asNonEmptyString(toolManifest.availability) || "installable",
        plannedReason: asNonEmptyString(toolManifest.plannedReason),
        commandName: asNonEmptyString(systemCommand.executableName),
        setupHint: asNonEmptyString(systemCommand.setupHint),
        stageSupport: stageSupport,
      };
    });
  }

  function buildMediaSnapshot(runtime, featureId) {
    const runtimeRecord = getRuntimeRecord(runtime);
    const projectedProjects = buildProjectedProjects(runtimeRecord);
    const activeProject =
      projectedProjects.find(function (project) {
        return project.id === runtimeRecord.activeProjectId;
      }) || null;

    return {
      roomId: roomId,
      featureId: featureId || defaultFeatureId,
      ready: runtimeRecord.hydrated === true,
      stages: mediaStages.slice(),
      sourcePresets: clone(runtimeRecord.sourcePresets || {}),
      ytDlpForm: clone(runtimeRecord.ytDlpForm || {}),
      editPresets: clone(runtimeRecord.editPresets || {}),
      editCapabilities: clone(runtimeRecord.editCapabilities || {}),
      profilePresets: clone(runtimeRecord.profilePresets || {}),
      profileCapabilities: clone(runtimeRecord.profileCapabilities || {}),
      profileModels: clone(runtimeRecord.profileModels || {}),
      subtitleSourcePresets: clone(runtimeRecord.subtitleSourcePresets || {}),
      subtitleYoutubeForm: clone(runtimeRecord.subtitleYoutubeForm || {}),
      subtitleEditPresets: clone(runtimeRecord.subtitleEditPresets || {}),
      subtitleAnalysisCatalog: clone(runtimeRecord.subtitleAnalysisCatalog || {}),
      subtitleAnalysisCapabilities: clone(runtimeRecord.subtitleAnalysisCapabilities || {}),
      subtitleAnalysisProviders: clone(runtimeRecord.subtitleAnalysisProviders || {}),
      audioAnalysisCatalog: clone(runtimeRecord.audioAnalysisCatalog || {}),
      audioAnalysisCapabilities: clone(runtimeRecord.audioAnalysisCapabilities || {}),
      audioAnalysisPresets: clone(runtimeRecord.audioAnalysisPresets || {}),
      audioAnalysisProviders: clone(runtimeRecord.audioAnalysisProviders || {}),
      toolRegistry: buildToolRegistry(runtimeRecord),
      profileModelState: clone(runtimeRecord.profileModelState || {}),
      projects: projectedProjects.map(serializeProjectSummary),
      activeProjectId: runtimeRecord.activeProjectId,
      activeProject: serializeProject(activeProject, runtimeRecord),
      toolState: clone(runtimeRecord.toolState || { tools: {} }),
      jobs: serializeJobs(runtimeRecord),
    };
  }

  return {
    buildMediaSnapshot,
    buildToolRegistry,
    serializeJobs,
    serializeProject,
    serializeProjectSummary,
  };
}
