import { decodeBase64 } from "../../constants/index.js";
import { toRoomRuntimeFileUrl } from "./room-runtime-url.js";

const BASE64_PATTERN = /^[A-Za-z0-9+/]+={0,2}$/;
const IMPORT_FROM_PATTERN = /import\s+([\s\S]*?)\s+from\s+(["'])([^"']+)\2;/g;
const IMPORT_SIDE_EFFECT_PATTERN = /import\s+(["'])([^"']+)\1;/g;
const EXPORT_FROM_PATTERN = /export\s+(\*|\{[\s\S]*?\})\s+from\s+(["'])([^"']+)\2;/g;
const MODULE_EXPORTS_PATTERN = /(^|\n)(\s*)module\.exports\s*=\s*/m;

export function decodeRoomHostSource(source: string): string {
  const trimmed = source.trim();
  if (trimmed === "") {
    return "";
  }

  const looksLikeBase64 = trimmed.length % 4 === 0 && BASE64_PATTERN.test(trimmed);
  if (looksLikeBase64 === false) {
    return source;
  }

  const decoded = decodeBase64(trimmed);
  return decoded.trim() !== "" ? decoded : source;
}

function encodeUtf8Base64(source: string): string {
  if (typeof Buffer !== "undefined") {
    return Buffer.from(source, "utf8").toString("base64");
  }

  const bytes = new TextEncoder().encode(source);
  let binary = "";
  for (let index = 0; index < bytes.length; index += 1) {
    binary += String.fromCharCode(bytes[index] || 0);
  }
  return btoa(binary);
}

function normalizeFileUrlPath(fileUrl: string): string {
  const pathname = decodeURIComponent(new URL(fileUrl).pathname);
  return /^\/[A-Za-z]:\//.test(pathname) ? pathname.slice(1) : pathname;
}

function normalizeRoomHostBoundaryPath(filePath: string): string {
  return filePath.replace(/\\/g, "/");
}

function resolveRoomHostRootPath(entryPath: string): string {
  const entryUrl = new URL(toRoomRuntimeFileUrl(entryPath));
  return normalizeFileUrlPath(new URL("../", new URL("./", entryUrl)).toString());
}

function assertRoomHostPathWithinRoot(
  filePath: string,
  roomRootPath: string,
  specifier: string
): string {
  const normalizedPath = normalizeRoomHostBoundaryPath(filePath);
  const normalizedRoot = normalizeRoomHostBoundaryPath(roomRootPath);
  const rootPrefix = normalizedRoot.endsWith("/") ? normalizedRoot : `${normalizedRoot}/`;
  if (!normalizedPath.startsWith(rootPrefix)) {
    throw new Error(`Room host module import escaped room root: ${specifier}`);
  }
  return normalizedPath;
}

function resolveRoomHostModulePath(modulePath: string, specifier: string): string {
  const moduleUrl = toRoomRuntimeFileUrl(modulePath);
  return normalizeFileUrlPath(new URL(specifier, moduleUrl).toString());
}

function collectRoomHostModuleSpecifiers(source: string): string[] {
  const specifiers = new Set<string>();

  const collectMatches = function (pattern: RegExp, specifierIndex: number) {
    pattern.lastIndex = 0;
    let match = pattern.exec(source);
    while (match !== null) {
      const specifier = match[specifierIndex];
      if (typeof specifier === "string" && specifier.trim() !== "") {
        specifiers.add(specifier.trim());
      }
      match = pattern.exec(source);
    }
  };

  collectMatches(IMPORT_FROM_PATTERN, 3);
  collectMatches(IMPORT_SIDE_EFFECT_PATTERN, 2);
  collectMatches(EXPORT_FROM_PATTERN, 3);
  return Array.from(specifiers);
}

function rewriteRoomHostModuleSpecifiers(
  source: string,
  resolveSpecifier: (specifier: string) => string
): string {
  return source
    .replace(IMPORT_FROM_PATTERN, function (_, clause, quote, specifier) {
      return `import ${clause} from ${quote}${resolveSpecifier(specifier)}${quote};`;
    })
    .replace(IMPORT_SIDE_EFFECT_PATTERN, function (_, quote, specifier) {
      return `import ${quote}${resolveSpecifier(specifier)}${quote};`;
    })
    .replace(EXPORT_FROM_PATTERN, function (_, clause, quote, specifier) {
      return `export ${clause} from ${quote}${resolveSpecifier(specifier)}${quote};`;
    });
}

function transformModuleExportsToEsm(source: string): string {
  if (!MODULE_EXPORTS_PATTERN.test(source)) {
    return source;
  }

  return source.replace(MODULE_EXPORTS_PATTERN, "$1$2const __room_module_exports__ = ") +
    "\nexport default __room_module_exports__;\n";
}

export async function buildRoomHostModuleDataUrl(
  entryPath: string,
  readModuleSource: (filePath: string) => Promise<string>
): Promise<string> {
  const roomRootPath = resolveRoomHostRootPath(entryPath);
  const moduleUrlCache = new Map<string, Promise<string>>();

  const loadModule = async (filePath: string): Promise<string> => {
    const normalizedPath = assertRoomHostPathWithinRoot(filePath, roomRootPath, filePath);
    const cached = moduleUrlCache.get(normalizedPath);
    if (cached) {
      return await cached;
    }

    const pending = (async function () {
      const source = await readModuleSource(normalizedPath);
      const specifiers = collectRoomHostModuleSpecifiers(source).filter(function (specifier) {
        return specifier.startsWith("./") || specifier.startsWith("../");
      });
      const replacements = new Map<string, string>();

      for (const specifier of specifiers) {
        const dependencyPath = assertRoomHostPathWithinRoot(
          resolveRoomHostModulePath(normalizedPath, specifier),
          roomRootPath,
          specifier
        );
        replacements.set(specifier, await loadModule(dependencyPath));
      }

      const rewrittenSource = transformModuleExportsToEsm(
        rewriteRoomHostModuleSpecifiers(source, function (specifier) {
          return replacements.get(specifier) || specifier;
        })
      );
      return `data:text/javascript;base64,${encodeUtf8Base64(rewrittenSource)}`;
    })();

    moduleUrlCache.set(normalizedPath, pending);
    return await pending;
  };

  return await loadModule(entryPath);
}
