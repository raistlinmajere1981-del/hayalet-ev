import { createLaboratoryWorkbenchState } from "./runtime-primitives.js";
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
    toRecord
  } = deps;
  function getSourceRouteLabel(project) {
    const projectSource = toRecord(project.source);
    if (projectSource.routeLabel) {
      return projectSource.routeLabel;
    }
    if (projectSource.mode === "youtube") {
      return "YouTube";
    }
    if (projectSource.mode === "url") {
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
    const projectSource = toRecord(project.source);
    const projectEdit = toRecord(project.edit);
    const projectProfile = toRecord(project.profile);
    const profilePreflight = toRecord(projectProfile.preflight);
    const audioAnalysis = toRecord(project.audioAnalysis);
    const subtitleAnalysis = toRecord(project.subtitleAnalysis);
    const workbench = toRecord(project.workbench);
    return {
      id: project.id,
      slug: project.slug,
      name: project.name,
      updatedAt: project.updatedAt,
      sourceKind: projectSource.kind,
      sourceMode: projectSource.mode,
      status: projectSource.status,
      hasSource: typeof projectSource.storedPath === "string" && projectSource.storedPath.trim() !== "",
      handoffMode: asNonEmptyString(projectEdit.handoffMode) || "source",
      hasDerivedOutput: Array.isArray(projectEdit.outputs) && projectEdit.outputs.some(function(entry) {
        return asNonEmptyString(toRecord(entry).path) !== null;
      }),
      profileMode: asNonEmptyString(projectProfile.mode) || "beginner",
      profilePreflightStatus: asNonEmptyString(profilePreflight.status) || "idle",
      profileTargetMode: asNonEmptyString(projectProfile.targetAssetMode) || "source",
      processStatus: mediaProcess.status,
      reportStatus: mediaReport.status,
      audioProcessStatus: audioProcess.status,
      audioReportStatus: audioReport.status,
      audioModuleCount: Object.keys(toRecord(audioAnalysis.results)).length,
      subtitleProcessStatus: subtitleProcess.status,
      subtitleReportStatus: subtitleReport.status,
      subtitleEntryCount: Array.isArray(subtitleAnalysis.entries) ? subtitleAnalysis.entries.length : 0,
      workbench: clone(workbench)
    };
  }
  function serializeProject(project, runtime) {
    if (project === null) {
      return null;
    }
    const projectSource = toRecord(project.source);
    const projectEdit = toRecord(project.edit);
    const projectEditPreview = toRecord(projectEdit.preview);
    const projectProfile = toRecord(project.profile);
    const audioAnalysis = normalizeAudioAnalysisState(project.audioAnalysis, runtime);
    const subtitleAnalysis = normalizeSubtitleAnalysisState(project.subtitleAnalysis, runtime);
    const subtitleEdit = toRecord(subtitleAnalysis.edit);
    const workbench = toRecord(project.workbench);
    return {
      id: project.id,
      slug: project.slug,
      name: project.name,
      createdAt: project.createdAt,
      updatedAt: project.updatedAt,
      source: {
        ...clone(project.source),
        previewUrl: toFileUrl(projectSource.storedPath),
        routeLabel: getSourceRouteLabel(project)
      },
      edit: {
        ...clone(project.edit),
        preview: {
          ...clone(projectEditPreview),
          previewUrl: toFileUrl(projectEditPreview.path),
          artifacts: (Array.isArray(projectEditPreview.artifacts) ? projectEditPreview.artifacts : []).map(function(entry) {
            return {
              ...clone(entry),
              previewUrl: toFileUrl(toRecord(entry).path)
            };
          })
        },
        outputs: (Array.isArray(projectEdit.outputs) ? projectEdit.outputs : []).map(
          function(entry) {
            const entryRecord = toRecord(entry);
            return {
              ...clone(entry),
              previewUrl: toFileUrl(entryRecord.path),
              artifacts: (Array.isArray(entryRecord.artifacts) ? entryRecord.artifacts : []).map(function(artifact) {
                return {
                  ...clone(artifact),
                  previewUrl: toFileUrl(toRecord(artifact).path)
                };
              })
            };
          }
        )
      },
      profile: {
        ...clone(project.profile),
        artifacts: (Array.isArray(projectProfile.artifacts) ? projectProfile.artifacts : []).map(function(entry) {
          const entryRecord = toRecord(entry);
          return {
            ...clone(entry),
            previewUrl: toFileUrl(entryRecord.path)
          };
        })
      },
      audioAnalysis: {
        ...clone(audioAnalysis),
        results: Object.keys(toRecord(audioAnalysis.results)).reduce(
          function(accumulator, moduleId) {
            const result = normalizeAudioAnalysisModuleResult(
              toRecord(toRecord(audioAnalysis.results)[moduleId]),
              moduleId,
              {}
            );
            accumulator[moduleId] = {
              ...clone(result),
              artifacts: (Array.isArray(result.artifacts) ? result.artifacts : []).map(function(entry) {
                return {
                  ...clone(entry),
                  previewUrl: toFileUrl(toRecord(entry).path)
                };
              })
            };
            return accumulator;
          },
          {}
        ),
        export: {
          ...clone(toRecord(audioAnalysis.export)),
          items: (Array.isArray(toRecord(audioAnalysis.export).items) ? toRecord(audioAnalysis.export).items : []).map(function(entry) {
            return {
              ...clone(entry),
              fileUrl: toFileUrl(toRecord(entry).path)
            };
          })
        }
      },
      subtitleAnalysis: {
        ...clone(subtitleAnalysis),
        entries: (Array.isArray(subtitleAnalysis.entries) ? subtitleAnalysis.entries : []).map(
          function(entry) {
            return {
              ...clone(entry),
              fileUrl: toFileUrl(toRecord(entry).path)
            };
          }
        ),
        edit: {
          ...clone(subtitleAnalysis.edit),
          outputs: (Array.isArray(subtitleEdit.outputs) ? subtitleEdit.outputs : []).map(function(entry) {
            return {
              ...clone(entry),
              fileUrl: toFileUrl(toRecord(entry).path)
            };
          })
        },
        export: {
          ...clone(toRecord(subtitleAnalysis.export)),
          items: (Array.isArray(toRecord(subtitleAnalysis.export).items) ? toRecord(subtitleAnalysis.export).items : []).map(function(entry) {
            return {
              ...clone(entry),
              fileUrl: toFileUrl(toRecord(entry).path)
            };
          })
        }
      },
      workbench: clone(workbench),
      process: {
        ...clone(project.process),
        records: featureIds.reduce(
          function(accumulator, featureId) {
            const record = getFeatureProcessRecord(project, featureId);
            accumulator[featureId] = {
              ...clone(record),
              artifacts: (Array.isArray(record.artifacts) ? record.artifacts : []).map(function(entry) {
                return {
                  ...clone(entry),
                  previewUrl: toFileUrl(toRecord(entry).path)
                };
              })
            };
            return accumulator;
          },
          {}
        )
      },
      report: {
        ...clone(project.report),
        records: featureIds.reduce(
          function(accumulator, featureId) {
            const record = getFeatureReportRecord(project, featureId);
            accumulator[featureId] = {
              ...clone(record),
              exports: (Array.isArray(record.exports) ? record.exports : []).map(function(entry) {
                return {
                  ...clone(entry),
                  fileUrl: toFileUrl(toRecord(entry).path)
                };
              })
            };
            return accumulator;
          },
          {}
        )
      }
    };
  }
  function getRuntimeRecord(runtime) {
    return runtime && typeof runtime === "object" && Array.isArray(runtime) === false ? runtime : {};
  }
  function buildProjectedProjects(runtime) {
    const runtimeRecord = getRuntimeRecord(runtime);
    const projects = Array.isArray(runtimeRecord.projects) ? runtimeRecord.projects : [];
    return projects.map(function(project) {
      const nextProject = clone(project);
      syncProjectFeatureProjections(runtimeRecord, nextProject);
      return nextProject;
    });
  }
  function serializeJobs(runtime) {
    const runtimeRecord = getRuntimeRecord(runtime);
    return Object.keys(toRecord(runtimeRecord.jobs)).map(function(jobId) {
      const job = toRecord(runtimeRecord.jobs)[jobId];
      if (!job) {
        return null;
      }
      return {
        jobId,
        requestId: job.requestId,
        action: job.action,
        projectId: job.projectId || null,
        toolId: job.toolId || null,
        featureStage: job.featureStage || null,
        operation: job["operation"] || null,
        stage: job.stage || "queued",
        percent: typeof job.percent === "number" ? job.percent : null,
        bytesReceived: typeof job["bytesReceived"] === "number" ? job["bytesReceived"] : null,
        bytesTotal: typeof job["bytesTotal"] === "number" ? job["bytesTotal"] : null,
        message: job.message || null
      };
    }).filter(Boolean);
  }
  function buildToolRegistry(runtime) {
    const runtimeRecord = getRuntimeRecord(runtime);
    return getRuntimeToolIds(runtimeRecord).map(function(toolId) {
      const toolManifest = getToolManifest(runtimeRecord, toolId);
      const systemCommand = toRecord(toolManifest.systemCommand);
      const stageSupport = {};
      mediaStages.forEach(function(stageId) {
        const supportLevel = getStageSupport(toolManifest, stageId);
        if (supportLevel !== "unsupported") {
          stageSupport[stageId] = supportLevel;
        }
      });
      const usedBy = Array.isArray(toolManifest.usedBy) ? toolManifest.usedBy.map(function(entry) {
        return String(entry);
      }) : [];
      const testImpact = Array.isArray(toolManifest.testImpact) ? toolManifest.testImpact.map(function(entry) {
        return String(entry);
      }) : [];
      const availability = asNonEmptyString(toolManifest.availability) || "installable";
      const installerType = asNonEmptyString(toRecord(toolManifest.installer)["type"]);
      const installStrategy = asNonEmptyString(toolManifest.installStrategy) || (availability === "planned" ? "planned" : availability === "system-command" ? "manual" : "automatic");
      return {
        toolId,
        displayName: asNonEmptyString(toolManifest.displayName) || toolId,
        installDirName: asNonEmptyString(toolManifest.installDirName) || toolId,
        availability,
        plannedReason: asNonEmptyString(toolManifest.plannedReason),
        commandName: asNonEmptyString(systemCommand.executableName),
        envVarNames: Array.isArray(systemCommand.envVarNames) ? systemCommand.envVarNames.map(function(entry) {
          return String(entry);
        }) : [],
        installerType,
        setupHint: asNonEmptyString(systemCommand.setupHint),
        installStrategy,
        manualHint: asNonEmptyString(toolManifest.manualHint) || asNonEmptyString(systemCommand.setupHint),
        manualGuide: clone(toRecord(toolManifest.manualGuide)),
        usedBy,
        testImpact,
        readinessImpact: asNonEmptyString(toolManifest.readinessImpact),
        stageSupport
      };
    });
  }
  function buildWorkbenchSnapshot(featureId, workbenchSource = {}) {
    return createLaboratoryWorkbenchState({
      ...toRecord(workbenchSource),
      primaryFeatureId: mediaFeatureId,
      activeModuleId: featureId || defaultFeatureId,
      availableModuleIds: featureIds.slice()
    });
  }
  function buildMediaSnapshot(runtime, featureId, workbenchSource = {}) {
    const runtimeRecord = getRuntimeRecord(runtime);
    const projectedProjects = buildProjectedProjects(runtimeRecord);
    const activeProject = projectedProjects.find(function(project) {
      return project.id === runtimeRecord.activeProjectId;
    }) || null;
    const workbenchSnapshot = buildWorkbenchSnapshot(featureId || defaultFeatureId, {
      ...activeProject === null ? {} : toRecord(activeProject.workbench),
      ...toRecord(workbenchSource)
    });
    return {
      roomId,
      featureId: featureId || defaultFeatureId,
      workbench: workbenchSnapshot,
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
      jobs: serializeJobs(runtimeRecord)
    };
  }
  return {
    buildMediaSnapshot,
    buildToolRegistry,
    serializeJobs,
    serializeProject,
    serializeProjectSummary
  };
}
