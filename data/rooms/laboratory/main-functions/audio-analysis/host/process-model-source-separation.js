import { getAudioAnalysisProcessRootDir } from "../../../shared/host/project-paths.js";
function toRecord(value) {
  return value !== null && typeof value === "object" ? value : {};
}
function asNonEmptyString(value) {
  return typeof value === "string" && value.trim() !== "" ? value : null;
}
function isNonNullString(value) {
  return typeof value === "string" && value.length > 0;
}
function toDirectoryEntryRecord(value) {
  return toRecord(value);
}
function getTargetPath(target) {
  return asNonEmptyString(target.path);
}
function getArtifactIds(artifacts) {
  return artifacts.map(function(artifact) {
    return asNonEmptyString(artifact.id);
  }).filter(isNonNullString);
}
export function createAudioAnalysisSourceSeparationModelRunner(deps) {
  const {
    clone,
    createProcessArtifact,
    createProcessFinding,
    ensureProcessRuntimeDirectories,
    listDirectory,
    runProfileTool,
    sanitizeFileSegment,
    writeJsonFile
  } = deps;
  function getProcessRootDir(runtime, project) {
    return getAudioAnalysisProcessRootDir(
      runtime,
      project
    );
  }
  return async function runSourceSeparationAudioAnalyzer(runtime, project, requestId, jobId, target, artifactBase, moduleOutputDir, moduleId) {
    await ensureProcessRuntimeDirectories(runtime, project, requestId, moduleOutputDir);
    const targetPath = getTargetPath(target);
    if (targetPath === null) {
      return {
        findings: [],
        artifacts: [],
        warnings: ["Source separation requires an audio target path before processing can start."],
        status: "blocked",
        summary: "Source separation is waiting for a prepared audio target."
      };
    }
    const modelName = "htdemucs";
    const preparedInputBase = sanitizeFileSegment(`${artifactBase}-demucs-input`, "demucs-input");
    const preparedInputPath = `${moduleOutputDir}/${preparedInputBase}.wav`;
    const stemDir = `${moduleOutputDir}/separated/${modelName}/${preparedInputBase}`;
    const manifestPath = `${moduleOutputDir}/${artifactBase}-stems.json`;
    await runProfileTool(runtime, {
      requestId,
      jobId,
      toolId: "ffmpeg",
      cwd: getProcessRootDir(runtime, project),
      args: ["-y", "-i", targetPath, "-vn", "-ac", "2", "-ar", "44100", preparedInputPath],
      timeoutMs: 4 * 60 * 1e3
    });
    await runProfileTool(runtime, {
      requestId,
      jobId,
      toolId: "demucs",
      cwd: moduleOutputDir,
      args: ["-m", "demucs", "-d", "cpu", "-n", modelName, preparedInputPath],
      timeoutMs: 30 * 60 * 1e3
    });
    const stems = (await listDirectory(stemDir)).map(toDirectoryEntryRecord).filter(function(entry) {
      return entry.isDirectory !== true && /\.(wav|mp3|flac|ogg|m4a)$/i.test(String(entry.name ?? ""));
    }).map(function(entry) {
      const fileName = String(entry.name ?? "");
      return {
        path: String(entry.path ?? ""),
        fileName,
        stemName: fileName.replace(/\.[^.]+$/, "") || fileName
      };
    });
    if (stems.length === 0) {
      return {
        findings: [],
        artifacts: [],
        warnings: [
          "Demucs finished without producing any stem files in the expected output directory."
        ],
        status: "failed",
        summary: "Source separation did not produce any isolated stems for the current target."
      };
    }
    await writeJsonFile(manifestPath, {
      generatedAt: (/* @__PURE__ */ new Date()).toISOString(),
      target: clone(target),
      modelName,
      preparedInputPath,
      stemDir,
      stems
    });
    const stemArtifacts = stems.map(function(stem) {
      return createProcessArtifact(
        moduleId,
        "isolated-track",
        stem.path,
        `Separated Stem - ${stem.stemName}`,
        {
          stemName: stem.stemName,
          modelName
        }
      );
    });
    const summaryArtifact = createProcessArtifact(
      moduleId,
      "source-separation-manifest",
      manifestPath,
      "Source Separation Manifest",
      {
        modelName,
        stemCount: stems.length,
        stemNames: stems.map(function(stem) {
          return stem.stemName;
        })
      }
    );
    const artifacts = [summaryArtifact, ...stemArtifacts];
    const artifactIds = getArtifactIds(artifacts);
    const warningText = "Demucs stems can contain bleed or musical artifacts, so isolated tracks should be reviewed manually.";
    return {
      findings: [
        createProcessFinding(
          moduleId,
          "model",
          "low",
          "medium",
          "Separated stem bundle generated",
          `Demucs (${modelName}) produced ${stems.length} isolated stem file(s): ${stems.map(function(stem) {
            return stem.stemName;
          }).join(", ")}. ${warningText}`,
          stems.length,
          artifactIds
        )
      ],
      artifacts,
      warnings: [warningText],
      status: "ready",
      summary: "Source separation generated isolated stems for the active audio target."
    };
  };
}
