export function createMediaSourceFileRuntime(deps: any) {
  const { asNonEmptyString, getSourceConfig, toRecord } = deps;

  function normalizeMimeType(fileName: unknown, kind: string) {
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

  function stripMimeParameters(value: unknown) {
    const rawValue = asNonEmptyString(value);
    if (rawValue === null) {
      return null;
    }

    const normalized = rawValue.split(";")[0].trim().toLowerCase();
    return normalized || null;
  }

  function getFileExtension(fileName: unknown) {
    const rawValue = asNonEmptyString(fileName);
    if (rawValue === null) {
      return null;
    }

    const match = rawValue.toLowerCase().match(/\.([a-z0-9]+)$/);
    return match ? match[1] : null;
  }

  function getSupportedMimeTypes(sourcePresets: any, kind: string) {
    const sourceConfig = getSourceConfig(sourcePresets, kind);
    return toRecord(sourceConfig).supportedMimeTypes instanceof Array
      ? toRecord(sourceConfig).supportedMimeTypes.map(stripMimeParameters).filter(Boolean)
      : [];
  }

  function getSupportedExtensions(sourcePresets: any, kind: string) {
    const sourceConfig = getSourceConfig(sourcePresets, kind);
    const filters = Array.isArray(sourceConfig.fileDialogFilters)
      ? sourceConfig.fileDialogFilters
      : [];
    const values: string[] = [];

    filters.forEach(function (filter: Record<string, unknown>) {
      if (!filter || Array.isArray(filter["extensions"]) === false) {
        return;
      }

      filter["extensions"].forEach(function (extension: unknown) {
        const normalized = asNonEmptyString(extension);
        if (normalized) {
          values.push(normalized.toLowerCase().replace(/^\./, ""));
        }
      });
    });

    return Array.from(new Set(values));
  }

  function validateSourceCandidate(
    runtime: any,
    kind: string,
    storedFileName: unknown,
    mimeType: unknown
  ) {
    const normalizedMimeType = stripMimeParameters(mimeType);
    const normalizedExtension = getFileExtension(storedFileName);
    const supportedMimeTypes = getSupportedMimeTypes(runtime.sourcePresets, kind);
    const supportedExtensions = getSupportedExtensions(runtime.sourcePresets, kind);
    const extensionMatches =
      normalizedExtension !== null && supportedExtensions.includes(normalizedExtension);
    const mimeMatches =
      normalizedMimeType !== null &&
      (supportedMimeTypes.includes(normalizedMimeType) ||
        normalizedMimeType.startsWith(`${kind}/`));

    if (
      normalizedMimeType === "text/html" ||
      normalizedMimeType === "application/xhtml+xml" ||
      normalizedMimeType === "text/plain"
    ) {
      return {
        valid: false,
        error: `Saved file is ${normalizedMimeType}, not a supported ${kind} source.`,
      };
    }

    if (mimeMatches || extensionMatches) {
      return {
        valid: true,
        mimeType:
          mimeMatches && normalizedMimeType !== null
            ? normalizedMimeType
            : normalizeMimeType(storedFileName, kind),
      };
    }

    if (normalizedMimeType === "application/octet-stream" && extensionMatches) {
      return {
        valid: true,
        mimeType: normalizeMimeType(storedFileName, kind),
      };
    }

    return {
      valid: false,
      error: `Saved file is not a supported ${kind} source.`,
    };
  }

  function findCompanionExecutableName(toolEntry: any, baseName: string) {
    const companionPaths = toRecord(toRecord(toolEntry).companionPaths);
    const keys = Object.keys(companionPaths);
    const match = keys.find(function (key: string) {
      return (
        key.toLowerCase() === baseName.toLowerCase() ||
        key.toLowerCase().startsWith(`${baseName.toLowerCase()}.`)
      );
    });
    return match || null;
  }

  function deriveFilename(urlValue: string, kind: string, hint: unknown) {
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
      // noop
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
    validateSourceCandidate,
  };
}
