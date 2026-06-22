import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
export const PROJECT_ROOT = join(__dirname, "..", "..");
export const SRC_ROOT = join(PROJECT_ROOT, "src");
export const ROOMS_ROOT = join(PROJECT_ROOT, "rooms");
export const BASELINE_PATH = join(
  PROJECT_ROOT,
  "scripts",
  "baselines",
  "design-system-audit-baseline.json"
);
export const SHARED_SCENE_SCALE_PATH = join(
  PROJECT_ROOT,
  "src",
  "styles",
  "design-system",
  "tokens",
  "scene-scale.css"
);

export const SCAN_EXTENSIONS = new Set([".css", ".html", ".js", ".ts"]);
export const IGNORED_DIRS = new Set(["node_modules", "dist", ".git", ".vite", "coverage", "logs"]);
export const HEX_COLOR_RE = /#[0-9A-Fa-f]{3,8}\b/g;
export const COLOR_FUNCTION_RE = /\b(?:rgb|rgba|hsl|hsla|lab|lch|oklab|oklch)\((?:[^()]|\([^()]*\))*\)/g;
export const INLINE_STYLE_RE = /\bstyle\s*=\s*["']/g;
export const EXTERNAL_ASSET_RE = /\b(?:href|src)\s*=\s*["']https?:\/\//g;
export const CSS_VAR_DEFINE_RE = /(^|[\s{;])(--[A-Za-z0-9_-]+)\s*:/gm;
export const CSS_VAR_DECL_RE = /(^|[\s{;])(--[A-Za-z0-9_-]+)\s*:\s*([^;]+);/gm;
export const CSS_VAR_USE_RE = /var\(\s*(--[A-Za-z0-9_-]+)\b/g;
export const CUSTOM_MEDIA_DEFINE_RE = /@custom-media\s+(--[A-Za-z0-9_-]+)\s+([^;]+);/g;
export const CUSTOM_MEDIA_USE_RE = /@media[^{]*\(\s*(--[A-Za-z0-9_-]+)\s*\)/g;
export const RAW_MEDIA_QUERY_RE = /@media\s*\((?:max-width|min-width):\s*[0-9]+px\)/g;
export const RAW_CSS_UNIT_RE = /(^|[^\w-])(-?\d*\.?\d+(?:px|rem|em))\b/g;
export const CUSTOM_PROP_DECL_RE = /--[A-Za-z0-9_-]+\s*:\s*[^;]+;/g;
export const GRADIENT_RE = /\b(?:linear|radial|conic)-gradient\((?:[^()]|\([^()]*\))*\)/g;
export const SCENE_SCALE_VAR_RE = /var\(\s*(--scene-(?:rem|px|em)-[A-Za-z0-9_-]+)\b/g;
