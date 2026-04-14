export function createMediaSourceFileRuntime(deps) {
  const { asNonEmptyString, getSourceConfig, toRecord } = deps;
  function toSourceConfigRecord(value) {
    return toRecord(value);
  }
  function toFilterRecord(value) {
    return toRecord(value);
  }
  function normalizeMimeType(fileName, kind) {
    const lowerName = String(fileName || "").toLowerCase();
    if (kind === "audio") {
      if (lowerName.endsWith(".m4a")) return "audio/mp4";
      if (lowerName.endsWith(".wav")) return "audio/wav";
      if (lowerName.endsWith(".flac")) return "audio/flac";
      if (lowerName.endsWith(".ogg")) return "audio/ogg";
      if (lowerName.endsWith(".aac")) return "audio/aac";
      return "audio/mpeg";
    }
    if (kind === "image") {
      if (lowerName.endsWith(".png")) return "image/png";
      if (lowerName.endsWith(".webp")) return "image/webp";
      if (lowerName.endsWith(".gif")) return "image/gif";
      if (lowerName.endsWith(".bmp")) return "image/bmp";
      return "image/jpeg";
    }
    if (lowerName.endsWith(".webm")) return "video/webm";
    if (lowerName.endsWith(".mov")) return "video/quicktime";
    if (lowerName.endsWith(".mkv")) return "video/x-matroska";
    if (lowerName.endsWith(".avi")) return "video/x-msvideo";
    if (lowerName.endsWith(".m4v")) return "video/x-m4v";
    return "video/mp4";
  }
  function stripMimeParameters(value) {
    const rawValue = asNonEmptyString(value);
    if (rawValue === null) {
      return null;
    }
    const [mimeToken = ""] = rawValue.split(";");
    const normalized = mimeToken.trim().toLowerCase();
    return normalized || null;
  }
  function getFileExtension(fileName) {
    const rawValue = asNonEmptyString(fileName);
    if (rawValue === null) {
      return null;
    }
    const match = rawValue.toLowerCase().match(/\.([a-z0-9]+)$/);
    const extension = match?.[1];
    return extension ? extension : null;
  }
  function getSupportedMimeTypes(sourcePresets, kind) {
    const sourceConfig = toSourceConfigRecord(getSourceConfig(sourcePresets, kind));
    return Array.isArray(sourceConfig.supportedMimeTypes) ? sourceConfig.supportedMimeTypes.map(stripMimeParameters).filter((value) => value !== null) : [];
  }
  function getSupportedExtensions(sourcePresets, kind) {
    const sourceConfig = toSourceConfigRecord(getSourceConfig(sourcePresets, kind));
    const filters = Array.isArray(sourceConfig.fileDialogFilters) ? sourceConfig.fileDialogFilters.map(toFilterRecord) : [];
    const values = [];
    filters.forEach(function(filter) {
      if (Array.isArray(filter.extensions) === false) {
        return;
      }
      filter.extensions.forEach(function(extension) {
        const normalized = asNonEmptyString(extension);
        if (normalized) {
          values.push(normalized.toLowerCase().replace(/^\./, ""));
        }
      });
    });
    return Array.from(new Set(values));
  }
  function validateSourceCandidate(runtime, kind, storedFileName, mimeType) {
    const normalizedMimeType = stripMimeParameters(mimeType);
    const normalizedExtension = getFileExtension(storedFileName);
    const supportedMimeTypes = getSupportedMimeTypes(runtime.sourcePresets, kind);
    const supportedExtensions = getSupportedExtensions(runtime.sourcePresets, kind);
    const extensionMatches = normalizedExtension !== null && supportedExtensions.includes(normalizedExtension);
    const mimeMatches = normalizedMimeType !== null && (supportedMimeTypes.includes(normalizedMimeType) || normalizedMimeType.startsWith(`${kind}/`));
    if (normalizedMimeType === "text/html" || normalizedMimeType === "application/xhtml+xml" || normalizedMimeType === "text/plain") {
      return {
        valid: false,
        error: `Saved file is ${normalizedMimeType}, not a supported ${kind} source.`
      };
    }
    if (mimeMatches || extensionMatches) {
      return {
        valid: true,
        mimeType: mimeMatches ? normalizedMimeType : normalizeMimeType(storedFileName, kind)
      };
    }
    return {
      valid: false,
      error: `Saved file is not a supported ${kind} source.`
    };
  }
  function findCompanionExecutableName(toolEntry, baseName) {
    const companionPaths = toRecord(toRecord(toolEntry)["companionPaths"]);
    const keys = Object.keys(companionPaths);
    const match = keys.find(function(key) {
      return key.toLowerCase() === baseName.toLowerCase() || key.toLowerCase().startsWith(`${baseName.toLowerCase()}.`);
    });
    return match || null;
  }
  function deriveFilename(urlValue, kind, hint) {
    const hintValue = asNonEmptyString(hint);
    if (hintValue) {
      return hintValue;
    }
    try {
      const parsed = new URL(urlValue);
      const pathname = decodeURIComponent(parsed.pathname || "");
      const rawName = pathname.split("/").filter(Boolean).pop();
      if (rawName && rawName.indexOf(".") > 0) {
        return rawName;
      }
    } catch (_error) {
    }
    if (kind === "audio") return "downloaded-audio.mp3";
    if (kind === "image") return "downloaded-image.jpg";
    return "downloaded-video.mp4";
  }
  return {
    deriveFilename,
    findCompanionExecutableName,
    normalizeMimeType,
    stripMimeParameters,
    validateSourceCandidate
  };
}
