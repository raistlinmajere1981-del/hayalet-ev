// @ts-nocheck
export function createMediaEditSupportRuntime(deps) {
  const {
    asNonEmptyString,
    asNumber,
    clampNumber,
    createDefaultEditState,
    getFocusRegionCrop,
    getProjectEditOutputDir,
    getProjectEditPreviewDir,
    getResizePresetMap,
    markCloseoutAsStale,
    mergeObjects,
    normalizeSourceMetadata,
    toRecord,
  } = deps;

  function sanitizeFileSegment(value, fallback) {
    const baseValue = asNonEmptyString(value) || fallback || "artifact";
    const normalized = baseValue
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "");
    return normalized || fallback || "artifact";
  }

  function getPreparedSourcePath(project) {
    return asNonEmptyString(toRecord(project.source).storedPath);
  }

  function requirePreparedSource(project) {
    const storedPath = getPreparedSourcePath(project);
    if (storedPath === null) {
      throw new Error("Prepare a source file before using the edit stage.");
    }
    return storedPath;
  }

  function getDerivedExtension(kind) {
    if (kind === "audio") {
      return "wav";
    }
    if (kind === "image") {
      return "png";
    }
    return "mp4";
  }

  function getDerivedMimeType(kind) {
    if (kind === "audio") {
      return "audio/wav";
    }
    if (kind === "image") {
      return "image/png";
    }
    return "video/mp4";
  }

  function getEditRecipeSignature(project) {
    return JSON.stringify({
      kind: toRecord(project.source).kind,
      recipe: toRecord(project.edit).recipe,
    });
  }

  function toFfmpegTimestamp(seconds, fallback) {
    const numericValue = Number(seconds);
    if (Number.isFinite(numericValue) !== true || numericValue < 0) {
      return fallback || "0";
    }
    return numericValue.toFixed(3);
  }

  function toEvenInteger(value, minimum) {
    const numericValue = Math.max(minimum || 2, Math.round(Number(value) || 0));
    return numericValue % 2 === 0 ? numericValue : numericValue - 1;
  }

  function isFullFrameCrop(cropNormalized) {
    const crop = toRecord(cropNormalized);
    return (
      Number(crop.x || 0) <= 0 &&
      Number(crop.y || 0) <= 0 &&
      Number(crop.width || 0) >= 0.999 &&
      Number(crop.height || 0) >= 0.999
    );
  }

  function resolveCropPixels(project) {
    const recipe = toRecord(toRecord(project.edit).recipe);
    const common = toRecord(recipe.common);
    const crop = toRecord(common.cropNormalized);
    const metadata = normalizeSourceMetadata(toRecord(project.source).metadata);
    const width = asNumber(toRecord(metadata).width);
    const height = asNumber(toRecord(metadata).height);

    if (width === null || height === null || isFullFrameCrop(crop)) {
      return null;
    }

    const rawX = clampNumber(crop.x, 0, 1, 0);
    const rawY = clampNumber(crop.y, 0, 1, 0);
    const rawWidth = clampNumber(crop.width, 0.02, 1, 1);
    const rawHeight = clampNumber(crop.height, 0.02, 1, 1);

    const pixelWidth = Math.min(width, toEvenInteger(width * rawWidth, 2));
    const pixelHeight = Math.min(height, toEvenInteger(height * rawHeight, 2));
    const maxX = Math.max(0, width - pixelWidth);
    const maxY = Math.max(0, height - pixelHeight);
    const pixelX = Math.min(maxX, Math.max(0, Math.floor(width * rawX)));
    const pixelY = Math.min(maxY, Math.max(0, Math.floor(height * rawY)));

    return {
      x: pixelX,
      y: pixelY,
      width: pixelWidth,
      height: pixelHeight,
    };
  }

  function resolveResizeTarget(runtime, resizePresetId, customWidth, customHeight) {
    const resizePresets = getResizePresetMap(runtime.editPresets);
    const presetId = asNonEmptyString(resizePresetId) || "keep";
    const preset = toRecord(resizePresets[presetId]);

    if (presetId === "keep") {
      return null;
    }

    if (presetId === "custom") {
      const width = asNumber(customWidth);
      const height = asNumber(customHeight);
      if (width === null && height === null) {
        return null;
      }
      return {
        width: width !== null ? toEvenInteger(width, 2) : -2,
        height: height !== null ? toEvenInteger(height, 2) : -2,
      };
    }

    const width = asNumber(preset.width);
    const height = asNumber(preset.height);
    if (width === null && height === null) {
      return null;
    }

    return {
      width: width !== null ? width : -2,
      height: height !== null ? height : -2,
    };
  }

  function buildVideoFilterArgs(runtime, project) {
    const recipe = toRecord(toRecord(project.edit).recipe);
    const video = toRecord(recipe.video);
    const filters = [];
    const cropPixels = resolveCropPixels(project);
    const blurFocusOutside = video.blurFocusOutside === true && cropPixels !== null;

    if (blurFocusOutside) {
      filters.push(
        `split=2[base][focus];` +
          `[base]boxblur=18:1[blurred];` +
          `[focus]crop=${cropPixels.width}:${cropPixels.height}:${cropPixels.x}:${cropPixels.y}[focuscrop];` +
          `[blurred][focuscrop]overlay=${cropPixels.x}:${cropPixels.y}`
      );
    } else if (cropPixels !== null) {
      filters.push(`crop=${cropPixels.width}:${cropPixels.height}:${cropPixels.x}:${cropPixels.y}`);
    }

    const resizeTarget = resolveResizeTarget(
      runtime,
      video.resizePreset,
      video.customWidth,
      video.customHeight
    );
    if (resizeTarget !== null) {
      filters.push(`scale=${resizeTarget.width}:${resizeTarget.height}:flags=lanczos`);
    }

    const fpsLimit = clampNumber(video.fpsLimit, 1, 60, null);
    if (fpsLimit !== null) {
      filters.push(`fps=${Math.round(fpsLimit)}`);
    }

    return filters;
  }

  function buildAudioFilterArgs(project) {
    const recipe = toRecord(toRecord(project.edit).recipe);
    const audio = toRecord(recipe.audio);
    const filters = [];

    if (audio.silenceTrim === true) {
      filters.push(
        "silenceremove=start_periods=1:start_silence=0.2:start_threshold=-45dB:stop_periods=-1:stop_silence=0.3:stop_threshold=-45dB"
      );
    }
    if (audio.normalize === true) {
      filters.push(`loudnorm=I=${clampNumber(audio.normalizeTargetDb, -30, -8, -16)}:TP=-1.5:LRA=11`);
    }
    const highpassHz = clampNumber(audio.highpassHz, 0, 24000, 0);
    if (highpassHz > 0) {
      filters.push(`highpass=f=${Math.round(highpassHz)}`);
    }
    const lowpassHz = clampNumber(audio.lowpassHz, 0, 24000, 0);
    if (lowpassHz > 0) {
      filters.push(`lowpass=f=${Math.round(lowpassHz)}`);
    }

    return filters;
  }

  function buildImageFilterArgs(runtime, project) {
    const recipe = toRecord(toRecord(project.edit).recipe);
    const image = toRecord(recipe.image);
    const filters = [];
    const cropPixels = resolveCropPixels(project);

    if (cropPixels !== null) {
      filters.push(`crop=${cropPixels.width}:${cropPixels.height}:${cropPixels.x}:${cropPixels.y}`);
    }

    const rotateDegrees = clampNumber(image.rotateDegrees, -360, 360, 0);
    if (rotateDegrees !== 0) {
      filters.push(`rotate=${(rotateDegrees * Math.PI) / 180}:fillcolor=black`);
    }

    const resizeTarget = resolveResizeTarget(
      runtime,
      image.resizePreset,
      image.customWidth,
      image.customHeight
    );
    if (resizeTarget !== null) {
      filters.push(`scale=${resizeTarget.width}:${resizeTarget.height}:flags=lanczos`);
    }

    const brightness = clampNumber(image.brightness, -1, 1, 0);
    const contrast = clampNumber(image.contrast, 0.2, 3, 1);
    if (brightness !== 0 || contrast !== 1) {
      filters.push(`eq=brightness=${brightness}:contrast=${contrast}`);
    }

    const sharpen = clampNumber(image.sharpen, 0, 3, 0);
    if (sharpen > 0) {
      filters.push(`unsharp=5:5:${sharpen}:5:5:0`);
    }

    const blurStrength = clampNumber(image.blurStrength, 0, 3, 0);
    if (blurStrength > 0) {
      filters.push(`boxblur=${Math.max(1, Math.round(blurStrength * 4))}:1`);
    }

    return filters;
  }

  function buildEditCommand(runtime, project, outputPath, mode) {
    const sourceKind = toRecord(project.source).kind;
    const sourcePath = requirePreparedSource(project);
    const recipe = toRecord(toRecord(project.edit).recipe);
    const args = ["-y"];

    if (sourceKind === "video") {
      const video = toRecord(recipe.video);
      if (video.trimEnabled === true) {
        args.push("-ss", toFfmpegTimestamp(video.trimStartSeconds, "0"));
        const endSeconds = clampNumber(video.trimEndSeconds, 0, 86400, 0);
        if (endSeconds > 0) {
          args.push("-to", toFfmpegTimestamp(endSeconds, null));
        }
      }
    }

    if (sourceKind === "audio") {
      const audio = toRecord(recipe.audio);
      if (audio.trimEnabled === true) {
        args.push("-ss", toFfmpegTimestamp(audio.trimStartSeconds, "0"));
        const endSeconds = clampNumber(audio.trimEndSeconds, 0, 86400, 0);
        if (endSeconds > 0) {
          args.push("-to", toFfmpegTimestamp(endSeconds, null));
        }
      }
    }

    args.push("-i", sourcePath);

    if (sourceKind === "video") {
      const filters = buildVideoFilterArgs(runtime, project);
      if (filters.length > 0) {
        args.push("-vf", filters.join(","));
      }

      if (toRecord(recipe.video).includeAudio !== true) {
        args.push("-an");
      } else {
        args.push("-c:a", "aac", "-b:a", mode === "preview" ? "128k" : "160k");
      }

      args.push(
        "-c:v",
        "libx264",
        "-preset",
        mode === "preview" ? "veryfast" : "medium",
        "-crf",
        mode === "preview" ? "25" : "22",
        "-pix_fmt",
        "yuv420p",
        "-movflags",
        "+faststart",
        outputPath
      );
      return args;
    }

    if (sourceKind === "audio") {
      const filters = buildAudioFilterArgs(project);
      if (filters.length > 0) {
        args.push("-af", filters.join(","));
      }
      if (toRecord(recipe.audio).mono === true) {
        args.push("-ac", "1");
      }
      args.push("-c:a", "pcm_s16le", outputPath);
      return args;
    }

    const filters = buildImageFilterArgs(runtime, project);
    if (filters.length > 0) {
      args.push("-vf", filters.join(","));
    }
    args.push("-frames:v", "1", outputPath);
    return args;
  }

  function buildEditTargetPath(runtime, project, mode) {
    const extension = getDerivedExtension(project.source.kind);
    const common = toRecord(toRecord(toRecord(project.edit).recipe).common);
    const baseName = sanitizeFileSegment(common.outputNameHint, `${project.slug}-analysis`);

    if (mode === "preview") {
      return `${getProjectEditPreviewDir(runtime, project)}/${baseName}-preview.${extension}`;
    }

    const stamp = Date.now();
    return `${getProjectEditOutputDir(runtime, project)}/${baseName}-${stamp}.${extension}`;
  }

  function buildEditOutputLabel(project, mode) {
    const baseName = asNonEmptyString(toRecord(toRecord(toRecord(project.edit).recipe).common).outputNameHint);
    const route = baseName || project.name;
    return mode === "preview" ? `${route} Preview` : `${route} Derived Output`;
  }

  function markEditAsDirty(nextProject, recipeSignature) {
    nextProject.edit.dirty = true;
    nextProject.edit.lastError = null;
    nextProject.edit.lastActionAt = new Date().toISOString();

    const preview = toRecord(nextProject.edit.preview);
    const previewPath = asNonEmptyString(preview.path);
    const previewSignature = asNonEmptyString(preview.recipeSignature);

    nextProject.edit.preview = {
      ...preview,
      status: previewPath ? (previewSignature === recipeSignature ? "ready" : "stale") : "idle",
      error: null,
    };
    markCloseoutAsStale(nextProject, "Edit recipe changed; rerun downstream processing.");
  }

  function resetEditForCurrentSource(runtime, nextProject) {
    const previousMode = asNonEmptyString(toRecord(nextProject.edit).mode);
    nextProject.edit = createDefaultEditState(runtime.editPresets, nextProject.source.kind);
    if (previousMode === "advanced") {
      nextProject.edit.mode = "advanced";
    }
    markCloseoutAsStale(nextProject, "Source media changed.");
  }

  function findEditPreset(runtime, project, presetId) {
    const sourceKind = toRecord(project.source).kind;
    const mode = asNonEmptyString(toRecord(project.edit).mode) || "beginner";
    const presetsByKind = toRecord(toRecord(runtime.editPresets).presets);
    const presetList = Array.isArray(toRecord(toRecord(presetsByKind[sourceKind])[mode]))
      ? toRecord(presetsByKind[sourceKind])[mode]
      : [];

    return (
      presetList.find(function (entry) {
        return asNonEmptyString(toRecord(entry).id) === presetId;
      }) || null
    );
  }

  function applyEditRecipePatch(runtime, nextProject, patch, options) {
    const recipePatch = toRecord(patch);
    nextProject.edit.recipe = mergeObjects(nextProject.edit.recipe, recipePatch);

    const commonPatch = toRecord(recipePatch.common);
    const nextFocusRegionId = asNonEmptyString(toRecord(nextProject.edit.recipe.common).focusRegionId);
    if (nextFocusRegionId && Object.prototype.hasOwnProperty.call(commonPatch, "cropNormalized") === false) {
      nextProject.edit.recipe.common.cropNormalized = getFocusRegionCrop(
        runtime.editPresets,
        nextFocusRegionId
      );
    }

    if (options && typeof options.presetId === "string" && options.presetId.trim() !== "") {
      nextProject.edit.activePresetId = options.presetId.trim();
    }

    markEditAsDirty(nextProject, getEditRecipeSignature(nextProject));
  }

  return {
    applyEditRecipePatch,
    buildEditCommand,
    buildEditOutputLabel,
    buildEditTargetPath,
    findEditPreset,
    getDerivedMimeType,
    getEditRecipeSignature,
    getPreparedSourcePath,
    requirePreparedSource,
    resetEditForCurrentSource,
    sanitizeFileSegment,
  };
}
